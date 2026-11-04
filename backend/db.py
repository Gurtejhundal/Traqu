import json
from contextlib import closing
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
import sqlite3
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import case, func, inspect, text
from sqlalchemy.orm import selectinload
from sqlalchemy.schema import CreateTable, CreateIndex

from database import SessionLocal, engine
import models_db as models
import activity


def init_db():
    _snapshot_local_database()
    models.Base.metadata.create_all(bind=engine)
    _run_lightweight_migrations()
    _ensure_monotonic_sqlite_ids()
    _migrate_legacy_task_properties()


def _snapshot_local_database():
    """Keep seven daily, consistent SQLite snapshots before startup migrations."""
    if engine.dialect.name != 'sqlite' or not engine.url.database or engine.url.database == ':memory:':
        return
    source = Path(engine.url.database)
    if not source.is_file() or not source.stat().st_size:
        return
    directory = source.parent / 'backups'
    directory.mkdir(mode=0o700, exist_ok=True)
    destination = directory / f'roadmap-{datetime.now():%Y-%m-%d}.db'
    if destination.exists():
        return
    temporary = destination.with_suffix('.pending')
    try:
        # A SQLite connection context commits but does not close the handle.
        # Windows requires both handles closed before replacing the snapshot.
        with closing(sqlite3.connect(source)) as origin, closing(sqlite3.connect(temporary)) as backup:
            with backup:
                origin.backup(backup)
        temporary.chmod(0o600)
        temporary.replace(destination)
        for older in sorted(directory.glob('roadmap-*.db'), reverse=True)[7:]:
            older.unlink()
    finally:
        temporary.unlink(missing_ok=True)


def _run_lightweight_migrations():
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    migrations = {
        "roadmaps": {
            "user_id": "user_id VARCHAR DEFAULT 'public_user'",
            "document_json": "document_json TEXT DEFAULT '[]'",
            "revision": "revision INTEGER NOT NULL DEFAULT 1",
        },
        "timeframes": {
            "start_date": "start_date VARCHAR",
            "end_date": "end_date VARCHAR",
            "position": "position INTEGER NOT NULL DEFAULT 0",
        },
        "tasks": {
            "properties_json": "properties_json TEXT DEFAULT '{}'",
            "position": "position INTEGER NOT NULL DEFAULT 0",
        },
    }

    with engine.begin() as connection:
        for table_name, columns in migrations.items():
            if table_name not in table_names:
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, ddl in columns.items():
                if column_name not in existing_columns:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))

        if "roadmaps" in table_names:
            connection.execute(
                text("UPDATE roadmaps SET user_id = 'public_user' WHERE user_id IS NULL OR user_id = ''")
            )


def _ensure_monotonic_sqlite_ids():
    """Upgrade old SQLite tables atomically without renumbering user records.

    AUTOINCREMENT prevents a deleted object's URL being reassigned to new work.
    SQLite cannot add that constraint with ALTER COLUMN. Foreign keys are
    disabled only on this dedicated connection while all four tables are rebuilt;
    integrity is checked before committing, and restored even after rollback.
    """
    if engine.dialect.name != "sqlite":
        return
    connection = engine.raw_connection()
    cursor = connection.cursor()
    try:
        definitions = dict(cursor.execute(
            "SELECT name, sql FROM sqlite_master WHERE type='table'"
        ).fetchall())
        tables = [table for table in models.Base.metadata.sorted_tables
                  if "AUTOINCREMENT" not in definitions.get(table.name, "").upper()]
        if not tables:
            return
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.execute("BEGIN IMMEDIATE")
        for table in tables:
            temporary_name = f"_traqu_upgrade_{table.name}"
            ddl = str(CreateTable(table).compile(dialect=engine.dialect))
            ddl = ddl.replace(f"CREATE TABLE {table.name}", f"CREATE TABLE {temporary_name}", 1)
            cursor.execute(ddl)
            columns = ', '.join(f'"{column.name}"' for column in table.columns)
            cursor.execute(f'INSERT INTO "{temporary_name}" ({columns}) SELECT {columns} FROM "{table.name}"')
            cursor.execute(f'DROP TABLE "{table.name}"')
            cursor.execute(f'ALTER TABLE "{temporary_name}" RENAME TO "{table.name}"')
            for index in table.indexes:
                cursor.execute(str(CreateIndex(index).compile(dialect=engine.dialect)))
        if cursor.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("Database upgrade failed its foreign-key integrity check.")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        connection.close()


class RevisionConflict(ValueError):
    pass


def _touch_roadmap(db, roadmap_id):
    db.query(models.Roadmap).filter(models.Roadmap.id == roadmap_id).update(
        {models.Roadmap.revision: models.Roadmap.revision + 1}, synchronize_session=False
    )


def _claim_revision(db, roadmap_id, user_id, expected):
    if expected is None:
        raise RevisionConflict("Reload the roadmap before saving: a revision is required.")
    updated = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id,
        models.Roadmap.revision == expected,
    ).update({models.Roadmap.revision: models.Roadmap.revision + 1}, synchronize_session=False)
    if not updated:
        raise RevisionConflict("This roadmap changed in another view. Reload the editor before saving; your draft has been kept.")


def _legacy_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "y",
        "x",
        "done",
        "checked",
    }


def _legacy_falsey(value: Any) -> bool:
    if value is False or value is None:
        return True
    return str(value).strip().lower() in {"", "0", "false", "no", "n", "off", "unchecked"}


def _legacy_revision_count(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    raw = str(value or "").strip()
    return int(raw) if re.fullmatch(r"\+?\d+", raw) and int(raw) > 0 else None


def _migrate_legacy_task_properties() -> None:
    """Move meaningful revision/revisit values into optional task blocks.

    Empty defaults are removed without creating blocks. The migration is
    idempotent because migrated keys are removed from properties_json.
    """
    db = SessionLocal()
    try:
        changed = False
        for task in db.query(models.Task).all():
            properties = _decode_properties(task.properties_json)
            revision_keys = [key for key in properties if key.strip().lower() in {"revision", "revision count", "revisions"}]
            revisit_keys = [key for key in properties if key.strip().lower() in {"revisit", "visit again"}]
            if not revision_keys and not revisit_keys:
                continue

            next_position = (
                max(
                    (
                        block.position
                        for block in task.blocks
                        if isinstance(block.position, int) and block.position >= 0
                    ),
                    default=-1,
                )
                + 1
            )
            task_changed = False
            for key in revision_keys:
                value = properties[key]
                count = _legacy_revision_count(value)
                if count is not None:
                    properties.pop(key)
                    task_changed = True
                    task.blocks.append(
                        models.TaskBlock(
                            type="counter",
                            data_json=json.dumps(
                                {"label": "Revision", "value": count, "step": 1},
                                ensure_ascii=False,
                            ),
                            position=next_position,
                        )
                    )
                    next_position += 1
                elif _legacy_falsey(value):
                    properties.pop(key)
                    task_changed = True

            for key in revisit_keys:
                revisit = properties[key]
                if _legacy_truthy(revisit):
                    properties.pop(key)
                    task_changed = True
                    task.blocks.append(
                        models.TaskBlock(
                            type="bookmark",
                            data_json=json.dumps(
                                {"label": "Revisit", "bookmarked": True},
                                ensure_ascii=False,
                            ),
                            position=next_position,
                        )
                    )
                    next_position += 1
                elif _legacy_falsey(revisit):
                    properties.pop(key)
                    task_changed = True

            if task_changed:
                task.properties_json = _encode_properties(properties)
                changed = True

        if changed:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _roadmap_task_counts(db, roadmap_ids: List[int]) -> Dict[int, tuple[int, int]]:
    if not roadmap_ids:
        return {}

    rows = (
        db.query(
            models.Timeframe.roadmap_id,
            func.count(models.Task.id),
            func.coalesce(
                func.sum(case((models.Task.is_done.is_(True), 1), else_=0)),
                0,
            ),
        )
        .outerjoin(models.Task, models.Task.timeframe_id == models.Timeframe.id)
        .filter(models.Timeframe.roadmap_id.in_(roadmap_ids))
        .group_by(models.Timeframe.roadmap_id)
        .all()
    )
    return {
        int(roadmap_id): (int(total or 0), int(completed or 0))
        for roadmap_id, total, completed in rows
    }


def _roadmap_to_dict(
    roadmap: models.Roadmap,
    counts: tuple[int, int] = (0, 0),
    *,
    include_raw_text: bool = True,
) -> Dict[str, Any]:
    result = {
        "id": roadmap.id,
        "name": roadmap.name,
        "created_at": roadmap.created_at,
        "total_tasks": counts[0],
        "completed_tasks": counts[1],
        "revision": roadmap.revision,
    }
    if include_raw_text:
        result["raw_text"] = roadmap.raw_text
    return result


def get_roadmaps(user_id: str) -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        roadmaps = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.user_id == user_id)
            .order_by(models.Roadmap.created_at.desc())
            .all()
        )
        counts = _roadmap_task_counts(db, [roadmap.id for roadmap in roadmaps])
        return [
            _roadmap_to_dict(
                roadmap,
                counts.get(roadmap.id, (0, 0)),
                include_raw_text=False,
            )
            for roadmap in roadmaps
        ]
    finally:
        db.close()


def get_roadmap(roadmap_id: int, user_id: str) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return None
        counts = _roadmap_task_counts(db, [roadmap.id])
        return _roadmap_to_dict(roadmap, counts.get(roadmap.id, (0, 0)))
    finally:
        db.close()


def roadmap_name_exists(
    name: str,
    user_id: str,
    *,
    exclude_roadmap_id: Optional[int] = None,
) -> bool:
    db = SessionLocal()
    try:
        query = db.query(models.Roadmap.id).filter(
            models.Roadmap.user_id == user_id,
            func.lower(func.trim(models.Roadmap.name)) == name.strip().lower(),
        )
        if exclude_roadmap_id is not None:
            query = query.filter(models.Roadmap.id != exclude_roadmap_id)
        return query.first() is not None
    finally:
        db.close()


def roadmap_exists(roadmap_id: int, user_id: str) -> bool:
    db = SessionLocal()
    try:
        return (
            db.query(models.Roadmap.id)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
            is not None
        )
    finally:
        db.close()


def save_roadmap(name: str, raw_text: str, user_id: str) -> int:
    db = SessionLocal()
    try:
        roadmap = models.Roadmap(name=name, raw_text=raw_text, user_id=user_id)
        db.add(roadmap)
        db.commit()
        db.refresh(roadmap)
        return roadmap.id
    finally:
        db.close()


def delete_roadmap(roadmap_id: int, user_id: str) -> bool:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return False
        db.delete(roadmap)
        db.commit()
        return True
    finally:
        db.close()


def rename_roadmap(roadmap_id: int, new_name: str, user_id: str) -> bool:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return False
        _touch_roadmap(db, roadmap_id)
        roadmap.name = new_name
        db.commit()
        return True
    finally:
        db.close()


def _replace_roadmap_tasks(db, roadmap_id: int, tasks: List[Dict[str, Any]], timezone=None):
    """Reconcile an ordered outline while keeping surviving object identities."""
    frames = db.query(models.Timeframe).options(
        selectinload(models.Timeframe.tasks).selectinload(models.Task.blocks)
    ).filter(models.Timeframe.roadmap_id == roadmap_id).all()
    frames_by_id = {frame.id: frame for frame in frames}
    tasks_by_id = {task.id: task for frame in frames for task in frame.tasks}
    candidates = defaultdict(deque)
    for frame in frames:
        for task in frame.tasks:
            candidates[(frame.id, task.title)].append(task)
    frame_map = {}
    kept_tasks = set()
    kept_frames = set()
    fallback_run = 0
    previous_label = None
    previous_fallback = False
    for order, item in enumerate(tasks):
        title = str(item.get("title", "")).strip()
        if not title:
            raise ValueError("Task title is required.")
        label = str(item.get("timeframe") or item.get("timeframe_label") or "General").strip()
        frame_id = item.get("timeframe_id")
        source_key = item.get("section_key")
        if frame_id is None and not source_key:
            matching_frames = [frame for frame in frames if frame.label == label]
            if len(matching_frames) == 1:
                frame_id = matching_frames[0].id
        if frame_id is not None:
            if frame_id not in frames_by_id:
                raise ValueError("Timeframe does not belong to this roadmap.")
            key = ("id", frame_id)
            previous_fallback = False
        elif source_key:
            key = ("source", source_key)
            previous_fallback = False
        else:
            if not previous_fallback or label != previous_label:
                fallback_run += 1
            key = ("run", fallback_run)
            previous_fallback = True
            previous_label = label
        if key not in frame_map:
            frame = frames_by_id.get(frame_id)
            if frame is None:
                frame = models.Timeframe(roadmap_id=roadmap_id, label=label, granularity="section")
                db.add(frame)
                db.flush()
            frame.label = label
            frame.position = len(frame_map)
            frame.granularity = str(item.get("granularity") or frame.granularity or "section").strip()
            for field in ("start_date", "end_date"):
                if field in item:
                    setattr(frame, field, item[field])
            frame_map[key] = frame
            kept_frames.add(frame.id)
        frame = frame_map[key]
        task_id = item.get("id")
        if task_id is not None:
            task = tasks_by_id.get(task_id)
            if task is None or task.id in kept_tasks:
                raise ValueError("Task identity is unknown, repeated, or belongs to another roadmap.")
        else:
            task = next((candidate for candidate in candidates[(frame.id, title)]
                         if candidate.id not in kept_tasks), None)
        if task is None:
            task = models.Task(timeframe_id=frame.id, title=title, is_done=False)
            db.add(task)
            db.flush()
        kept_tasks.add(task.id)
        task.timeframe_id = frame.id
        task.title = title
        task.position = order
        if task.id in tasks_by_id:
            activity.record(db, task, bool(item.get("is_done", False)), task.timeframe.roadmap.user_id, timezone)
        task.is_done = bool(item.get("is_done", False))
        task.properties_json = _encode_properties(item.get("properties") or {})
        old_blocks = {block.id: block for block in task.blocks}
        kept_blocks = set()
        raw_blocks = item.get("blocks") or []
        if not isinstance(raw_blocks, list) or any(not isinstance(block, dict) for block in raw_blocks):
            raise ValueError("Task blocks must be a list of objects.")
        ordered = sorted(enumerate(raw_blocks), key=lambda pair: (
            pair[1].get("position") if isinstance(pair[1].get("position"), int)
            and pair[1]["position"] >= 0 else pair[0]
        ))
        for position, (_, block_data) in enumerate(ordered):
            block_id = block_data.get("id")
            if block_id is not None:
                block = old_blocks.get(block_id)
                if block is None or block_id in kept_blocks:
                    raise ValueError("Block identity does not belong to this task or is repeated.")
            else:
                block = models.TaskBlock(task_id=task.id)
                db.add(block)
            block.type = _normalize_block_type(str(block_data.get("type") or ""))
            block.data_json = _encode_block_data(block_data.get("data") or {})
            block.position = position
            if block.id is not None:
                kept_blocks.add(block.id)
        for block_id, block in old_blocks.items():
            if block_id not in kept_blocks:
                db.delete(block)
    for task_id, task in tasks_by_id.items():
        if task_id not in kept_tasks:
            db.delete(task)
    db.flush()
    for frame in frames:
        if frame.id not in kept_frames:
            # Moved tasks were updated above; avoid ORM delete-orphan cascading
            # over the old, eagerly loaded relationship collection.
            db.query(models.Timeframe).filter(models.Timeframe.id == frame.id).delete(synchronize_session=False)
    db.flush()


def update_roadmap_content(roadmap_id: int, new_text: str, parser_func, user_id: str, revision=None) -> bool:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return False

        existing_task_rows = (
            db.query(
                models.Task.id,
                models.Timeframe.id.label("timeframe_id"),
                models.Timeframe.label,
                models.Task.title,
                models.Task.is_done,
                models.Task.properties_json,
            )
            .join(models.Timeframe)
            .filter(models.Timeframe.roadmap_id == roadmap_id)
            .order_by(models.Timeframe.position.asc(), models.Timeframe.id.asc(), models.Task.position.asc(), models.Task.id.asc())
            .all()
        )
        task_ids = [row.id for row in existing_task_rows]
        blocks_by_task = defaultdict(list)
        if task_ids:
            block_rows = (
                db.query(
                    models.TaskBlock.task_id,
                    models.TaskBlock.type,
                    models.TaskBlock.data_json,
                    models.TaskBlock.position,
                    models.TaskBlock.id,
                )
                .filter(models.TaskBlock.task_id.in_(task_ids))
                .order_by(
                    models.TaskBlock.task_id.asc(),
                    models.TaskBlock.position.asc(),
                    models.TaskBlock.id.asc(),
                )
                .all()
            )
            for block_row in block_rows:
                blocks_by_task[block_row.task_id].append(
                    {
                        "type": block_row.type,
                        "data": _decode_block_data(block_row.data_json),
                        "position": block_row.position,
                    }
                )

        existing_by_key = defaultdict(deque)
        for row in existing_task_rows:
            existing_by_key[(row.label, row.title)].append(
                {
                    "timeframe_id": row.timeframe_id,
                    "is_done": row.is_done,
                    "properties": _decode_properties(row.properties_json),
                    "blocks": blocks_by_task[row.id],
                }
            )

        parsed = parser_func(new_text)
        tasks = [
            {
                "title": item["title"],
                "timeframe": item.get("timeframe_label", "General"),
                **(
                    {"timeframe_id": item["timeframe_id"]}
                    if item.get("timeframe_id") is not None
                    else {}
                ),
                "granularity": item.get("granularity", "section"),
                "is_done": item.get("is_done", False),
            }
            for item in parsed
            if item.get("type") == "task"
        ]
        for task in tasks:
            key = (task["timeframe"], task["title"])
            if not existing_by_key[key]:
                continue
            existing_task = existing_by_key[key].popleft()
            task.update(existing_task)

        _claim_revision(db, roadmap_id, user_id, revision)
        roadmap.raw_text = new_text
        _replace_roadmap_tasks(db, roadmap_id, tasks)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_roadmap_smart(
    roadmap_id: int,
    name: str,
    tasks: List[Dict[str, Any]],
    user_id: str,
    raw_text: str = "",
    revision=None,
    timezone=None,
) -> bool:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return False

        _claim_revision(db, roadmap_id, user_id, revision)
        roadmap.name = name
        if raw_text:
            roadmap.raw_text = raw_text
        _replace_roadmap_tasks(db, roadmap_id, tasks, timezone)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def save_imported_roadmap(
    name: str,
    tasks: List[Dict[str, Any]],
    user_id: str,
    raw_text: str = "",
    document: Optional[List[Dict[str, Any]]] = None,
) -> int:
    db = SessionLocal()
    try:
        roadmap = models.Roadmap(
            name=name,
            raw_text=raw_text,
            user_id=user_id,
            document_json=json.dumps(document or [], ensure_ascii=False, allow_nan=False),
        )
        db.add(roadmap)
        db.flush()
        _replace_roadmap_tasks(db, roadmap.id, tasks)
        db.commit()
        db.refresh(roadmap)
        return roadmap.id
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


MAX_PROPERTIES_DATA_BYTES = 256 * 1024


def _reject_non_finite_json(value: str):
    raise ValueError(f"Non-finite JSON number is not supported: {value}")


def _encode_json_object(value: Dict[str, Any], label: str, max_bytes: int) -> str:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object.")
    try:
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be valid JSON.") from exc
    if len(encoded.encode("utf-8")) > max_bytes:
        raise ValueError(f"{label} must be {max_bytes // 1024} KB or smaller.")
    return encoded


def _decode_json_object(value: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(value or "{}", parse_constant=_reject_non_finite_json)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def _encode_properties(value: Dict[str, Any]) -> str:
    return _encode_json_object(value, "Task properties", MAX_PROPERTIES_DATA_BYTES)


def _decode_properties(value: str) -> Dict[str, Any]:
    return _decode_json_object(value)


def _decode_document(value: str) -> List[Dict[str, Any]]:
    try:
        parsed = json.loads(value or "[]", parse_constant=_reject_non_finite_json)
        from roadmap_parser import sanitize_document_elements

        return sanitize_document_elements(parsed)
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def get_roadmap_document(roadmap_id: int, user_id: str) -> Optional[List[Dict[str, Any]]]:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return None
        return _decode_document(roadmap.document_json)
    finally:
        db.close()


BLOCK_TYPE_RE = re.compile(r"^[a-z][a-z0-9_-]{0,39}$")
MAX_BLOCK_DATA_BYTES = 64 * 1024
MAX_BULK_BLOCK_TASKS = 5000
MAX_BULK_BLOCK_TOTAL_BYTES = 16 * 1024 * 1024
BULK_TASK_QUERY_CHUNK_SIZE = 500


def _normalize_block_type(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if not BLOCK_TYPE_RE.fullmatch(normalized):
        raise ValueError(
            "Block type must start with a letter and contain only lowercase letters, numbers, underscores, or hyphens."
        )
    return normalized


def _encode_block_data(value: Dict[str, Any]) -> str:
    return _encode_json_object(value, "Block data", MAX_BLOCK_DATA_BYTES)


def _decode_block_data(value: str) -> Dict[str, Any]:
    return _decode_json_object(value)


def _block_to_dict(block: models.TaskBlock) -> Dict[str, Any]:
    return {
        "id": block.id,
        "task_id": block.task_id,
        "type": block.type,
        "data": _decode_block_data(block.data_json),
        "position": block.position,
        "created_at": block.created_at,
        "updated_at": block.updated_at,
    }


def _task_blocks(task: models.Task) -> List[Dict[str, Any]]:
    return [_block_to_dict(block) for block in sorted(task.blocks, key=lambda item: (item.position, item.id))]


def get_tasks(roadmap_id: int, user_id: str, timeframe_id: Optional[int] = None) -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        query = (
            db.query(models.Task)
            .options(selectinload(models.Task.blocks), selectinload(models.Task.timeframe))
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Timeframe.roadmap_id == roadmap_id, models.Roadmap.user_id == user_id)
        )

        if timeframe_id:
            query = query.filter(models.Task.timeframe_id == timeframe_id)

        tasks = query.order_by(models.Timeframe.position.asc(), models.Timeframe.id.asc(), models.Task.position.asc(), models.Task.id.asc()).all()
        return [
            {
                "id": task.id,
                "title": task.title,
                "is_done": task.is_done,
                "timeframe_id": task.timeframe_id,
                "timeframe_label": task.timeframe.label,
                "start_date": task.timeframe.start_date,
                "end_date": task.timeframe.end_date,
                "granularity": task.timeframe.granularity,
                "created_at": task.created_at,
                "properties": _decode_properties(task.properties_json),
                "blocks": _task_blocks(task),
            }
            for task in tasks
        ]
    finally:
        db.close()


def _task_to_dict(task: models.Task) -> Dict[str, Any]:
    return {
        "id": task.id,
        "title": task.title,
        "is_done": task.is_done,
        "timeframe_id": task.timeframe_id,
        "timeframe_label": task.timeframe.label,
        "start_date": task.timeframe.start_date,
        "end_date": task.timeframe.end_date,
        "granularity": task.timeframe.granularity,
        "created_at": task.created_at,
        "properties": _decode_properties(task.properties_json),
        "blocks": _task_blocks(task),
    }


def create_task(
    roadmap_id: int,
    timeframe_label: str,
    title: str,
    user_id: str,
    timeframe_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return None

        label = timeframe_label.strip() or "General"
        if timeframe_id is not None:
            timeframe = (
                db.query(models.Timeframe)
                .filter(
                    models.Timeframe.id == timeframe_id,
                    models.Timeframe.roadmap_id == roadmap_id,
                )
                .first()
            )
            if timeframe is None:
                return None
        else:
            timeframe = (
                db.query(models.Timeframe)
                .filter(models.Timeframe.roadmap_id == roadmap_id, models.Timeframe.label == label)
                .first()
            )
        if not timeframe:
            timeframe = models.Timeframe(roadmap_id=roadmap_id, label=label, granularity="section", position=(db.query(func.max(models.Timeframe.position)).filter(models.Timeframe.roadmap_id == roadmap_id).scalar() or 0) + 1)
            db.add(timeframe)
            db.flush()

        _touch_roadmap(db, roadmap_id)
        task = models.Task(timeframe_id=timeframe.id, title=title.strip(), is_done=False, position=(db.query(func.max(models.Task.position)).filter(models.Task.timeframe_id == timeframe.id).scalar() or 0) + 1)
        db.add(task)
        db.commit()
        db.refresh(task)
        return _task_to_dict(task)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_task_status(task_id: int, is_done: bool, user_id: str, timezone=None) -> bool:
    db = SessionLocal()
    try:
        task = (
            db.query(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Task.id == task_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not task:
            return False
        _touch_roadmap(db, task.timeframe.roadmap_id)
        db.refresh(task)
        activity.record(db, task, is_done, user_id, timezone)
        task.is_done = is_done
        db.commit()
        return True
    finally:
        db.close()


def update_tasks_status(roadmap_id, task_ids, is_done, user_id, timezone=None):
    with SessionLocal() as session:
        ids = set(task_ids)
        query = session.query(models.Task).join(models.Timeframe).join(models.Roadmap).filter(
            models.Task.id.in_(ids), models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
        if query.count() != len(ids):
            return None
        _touch_roadmap(session, roadmap_id)
        tasks = query.order_by(models.Task.id).all()
        for task in tasks:
            activity.record(session, task, is_done, user_id, timezone)
            task.is_done = is_done
        session.commit()
        return len(tasks)


def update_task_title(task_id: int, title: str, user_id: str) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        task = (
            db.query(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Task.id == task_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not task:
            return None
        _touch_roadmap(db, task.timeframe.roadmap_id)
        task.title = title.strip()
        db.commit()
        db.refresh(task)
        return _task_to_dict(task)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_task_properties(task_id: int, properties: Dict[str, Any], user_id: str) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        task = (
            db.query(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Task.id == task_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not task:
            return None
        _touch_roadmap(db, task.timeframe.roadmap_id)
        task.properties_json = _encode_properties(properties or {})
        db.commit()
        db.refresh(task)
        return _task_to_dict(task)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_task_blocks(task_id: int, user_id: str) -> Optional[List[Dict[str, Any]]]:
    db = SessionLocal()
    try:
        task = (
            db.query(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Task.id == task_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not task:
            return None
        return _task_blocks(task)
    finally:
        db.close()


def create_task_block(
    task_id: int,
    block_type: str,
    data: Dict[str, Any],
    position: Optional[int],
    user_id: str,
) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        task = (
            db.query(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Task.id == task_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not task:
            return None

        _touch_roadmap(db, task.timeframe.roadmap_id)
        siblings = (
            db.query(models.TaskBlock)
            .filter(models.TaskBlock.task_id == task_id)
            .order_by(models.TaskBlock.position.asc(), models.TaskBlock.id.asc())
            .all()
        )
        insert_at = len(siblings) if position is None else min(position, len(siblings))
        block = models.TaskBlock(
            task_id=task_id,
            type=_normalize_block_type(block_type),
            data_json=_encode_block_data(data),
            position=insert_at,
        )
        siblings.insert(insert_at, block)
        for sibling_position, sibling in enumerate(siblings):
            sibling.position = sibling_position
        db.add(block)
        db.commit()
        db.refresh(block)
        return _block_to_dict(block)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_task_blocks_bulk(
    task_ids: List[int],
    block_type: str,
    data: Dict[str, Any],
    user_id: str,
) -> Optional[List[Dict[str, Any]]]:
    """Append one cloned block to every requested task in a single transaction.

    ``None`` means at least one task was missing, was not owned by ``user_id``,
    or belonged to a different roadmap. No blocks are written until the complete,
    de-duplicated target set passes those checks.
    """
    unique_task_ids = list(dict.fromkeys(task_ids))
    if not unique_task_ids:
        raise ValueError("At least one task is required.")
    if len(unique_task_ids) > MAX_BULK_BLOCK_TASKS:
        raise ValueError(f"A bulk block can target at most {MAX_BULK_BLOCK_TASKS} tasks.")

    normalized_type = _normalize_block_type(block_type)
    encoded_data = _encode_block_data(data)
    if len(encoded_data.encode("utf-8")) * len(unique_task_ids) > MAX_BULK_BLOCK_TOTAL_BYTES:
        raise ValueError(
            "Bulk block data would exceed the 16 MB write limit. Use a smaller block or fewer tasks."
        )
    db = SessionLocal()
    try:
        tasks_by_id: Dict[int, models.Task] = {}
        for offset in range(0, len(unique_task_ids), BULK_TASK_QUERY_CHUNK_SIZE):
            task_id_chunk = unique_task_ids[offset : offset + BULK_TASK_QUERY_CHUNK_SIZE]
            tasks = (
                db.query(models.Task)
                .options(
                    selectinload(models.Task.blocks),
                    selectinload(models.Task.timeframe),
                )
                .join(models.Timeframe)
                .join(models.Roadmap)
                .filter(
                    models.Task.id.in_(task_id_chunk),
                    models.Roadmap.user_id == user_id,
                )
                .with_for_update()
                .all()
            )
            tasks_by_id.update({task.id: task for task in tasks})

        if len(tasks_by_id) != len(unique_task_ids):
            db.rollback()
            return None

        roadmap_ids = {
            task.timeframe.roadmap_id
            for task in tasks_by_id.values()
        }
        if len(roadmap_ids) != 1:
            db.rollback()
            return None

        _touch_roadmap(db, next(iter(roadmap_ids)))
        created_blocks: List[models.TaskBlock] = []
        for task_id in unique_task_ids:
            task = tasks_by_id[task_id]
            next_position = (
                max((block.position for block in task.blocks), default=-1) + 1
            )
            block = models.TaskBlock(
                task_id=task_id,
                type=normalized_type,
                data_json=encoded_data,
                position=next_position,
            )
            db.add(block)
            created_blocks.append(block)

        db.flush()
        result = [_block_to_dict(block) for block in created_blocks]
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_task_block(
    block_id: int,
    updates: Dict[str, Any],
    user_id: str,
) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        block = (
            db.query(models.TaskBlock)
            .join(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.TaskBlock.id == block_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not block:
            return None

        _touch_roadmap(db, block.task.timeframe.roadmap_id)
        if "type" in updates:
            block.type = _normalize_block_type(updates["type"])
        if "data" in updates:
            block.data_json = _encode_block_data(updates["data"])
        if "position" in updates:
            siblings = (
                db.query(models.TaskBlock)
                .filter(models.TaskBlock.task_id == block.task_id)
                .order_by(models.TaskBlock.position.asc(), models.TaskBlock.id.asc())
                .all()
            )
            ordered = [sibling for sibling in siblings if sibling.id != block.id]
            new_position = min(int(updates["position"]), len(ordered))
            ordered.insert(new_position, block)
            for position, sibling in enumerate(ordered):
                sibling.position = position

        block.updated_at = datetime.now().isoformat()
        db.commit()
        db.refresh(block)
        return _block_to_dict(block)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def delete_task_block(block_id: int, user_id: str) -> bool:
    db = SessionLocal()
    try:
        block = (
            db.query(models.TaskBlock)
            .join(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.TaskBlock.id == block_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not block:
            return False
        _touch_roadmap(db, block.task.timeframe.roadmap_id)
        task_id = block.task_id
        db.delete(block)
        db.flush()
        siblings = (
            db.query(models.TaskBlock)
            .filter(models.TaskBlock.task_id == task_id)
            .order_by(models.TaskBlock.position.asc(), models.TaskBlock.id.asc())
            .all()
        )
        for position, sibling in enumerate(siblings):
            sibling.position = position
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def delete_task(task_id: int, user_id: str) -> bool:
    db = SessionLocal()
    try:
        task = (
            db.query(models.Task)
            .join(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Task.id == task_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not task:
            return False
        _touch_roadmap(db, task.timeframe.roadmap_id)
        db.delete(task)
        db.commit()
        return True
    finally:
        db.close()


def update_timeframe_task_status(timeframe_id: int, is_done: bool, user_id: str, timezone=None) -> Optional[int]:
    db = SessionLocal()
    try:
        timeframe = (
            db.query(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Timeframe.id == timeframe_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not timeframe:
            return None

        _touch_roadmap(db, timeframe.roadmap_id)
        group_tasks = db.query(models.Task).filter(models.Task.timeframe_id == timeframe_id).all()
        for task in group_tasks:
            activity.record(db, task, is_done, user_id, timezone)
            task.is_done = is_done
        updated = len(group_tasks)
        db.commit()
        return updated
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_timeframes(roadmap_id: int, user_id: str) -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        timeframes = (
            db.query(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Timeframe.roadmap_id == roadmap_id, models.Roadmap.user_id == user_id)
            .order_by(models.Timeframe.position.asc(), models.Timeframe.id.asc())
            .all()
        )
        return [
            {
                "id": timeframe.id,
                "label": timeframe.label,
                "granularity": timeframe.granularity,
                "start_date": timeframe.start_date,
                "end_date": timeframe.end_date,
            }
            for timeframe in timeframes
        ]
    finally:
        db.close()


def update_timeframe_dates(
    timeframe_id: int,
    start_date: Optional[str],
    end_date: Optional[str],
    user_id: str,
) -> bool:
    db = SessionLocal()
    try:
        timeframe = (
            db.query(models.Timeframe)
            .join(models.Roadmap)
            .filter(models.Timeframe.id == timeframe_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not timeframe:
            return False
        _touch_roadmap(db, timeframe.roadmap_id)
        timeframe.start_date = start_date
        timeframe.end_date = end_date
        db.commit()
        return True
    finally:
        db.close()


def export_roadmap_data(roadmap_id: int, user_id: str) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        roadmap = (
            db.query(models.Roadmap)
            .options(
                selectinload(models.Roadmap.timeframes)
                .selectinload(models.Timeframe.tasks)
                .selectinload(models.Task.blocks)
            )
            .filter(models.Roadmap.id == roadmap_id, models.Roadmap.user_id == user_id)
            .first()
        )
        if not roadmap:
            return None

        export_tasks = []
        for timeframe in sorted(roadmap.timeframes, key=lambda item: (item.position, item.id)):
            for task in sorted(timeframe.tasks, key=lambda item: (item.position, item.id)):
                export_tasks.append(
                    {
                        "id": task.id,
                        "title": task.title,
                        "timeframe": timeframe.label,
                        "timeframe_id": timeframe.id,
                        "granularity": timeframe.granularity,
                        "start_date": timeframe.start_date,
                        "end_date": timeframe.end_date,
                        "is_done": task.is_done,
                        "properties": _decode_properties(task.properties_json),
                        "blocks": _task_blocks(task),
                    }
                )

        return {
            "name": roadmap.name,
            "version": 2,
            "revision": roadmap.revision,
            "tasks": export_tasks,
            "document": _decode_document(roadmap.document_json),
        }
    finally:
        db.close()


def restore_workspace(roadmaps, user_id, extras=None):
    """Restore copies in one transaction; never replace existing work."""
    session = SessionLocal()
    try:
        names = {name.lower().strip() for (name,) in session.query(models.Roadmap.name).filter(models.Roadmap.user_id == user_id)}
        restored = []
        for item in roadmaps:
            name = item['name']
            suffix = 1
            while name.lower().strip() in names:
                suffix += 1
                name = f"{item['name'][:175]} (restored {suffix})"
            names.add(name.lower().strip())
            roadmap = models.Roadmap(name=name, user_id=user_id, raw_text='',
                                     document_json=json.dumps(item['document'], ensure_ascii=False, allow_nan=False))
            session.add(roadmap)
            session.flush()
            _replace_roadmap_tasks(session, roadmap.id, item['tasks'])
            restored.append({'id': roadmap.id, 'name': name})
        if extras:
            activity.restore(session, user_id, extras)
        session.commit()
        return restored
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
