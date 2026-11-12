"""Local profiles and real completion history; imported checkmarks create no credit."""
from datetime import date, datetime, timedelta, timezone
import json
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy import func
from database import SessionLocal
import models_db as models

DEFAULT_PROFILE = {'name': 'Your workspace', 'bio': '', 'goal': '', 'timezone': '',
                   'week_start': 'monday', 'compact': False, 'pet_motion': True, 'reduced_motion': False,
                   'avatar': '', 'avatar_shape': 'circle', 'avatar_monochrome': True, 'cover': 'paper',
                   'calendar_palette': 'graphite', 'weekly_goal': 5, 'return_note': '', 'onboarding_completed': False, 'interests': [],
                   'reminder_enabled': False, 'reminder_time': '19:00', 'desktop_notifications': False, 'notifications_seen': []}


def zone(value):
    try:
        return ZoneInfo(value or 'UTC')
    except (ZoneInfoNotFoundError, ValueError, TypeError) as exc:
        raise ValueError('Choose a valid IANA timezone, for example Asia/Kolkata.') from exc


def read_profile(session, user_id):
    row = session.query(models.WorkspaceProfile).filter_by(user_id=user_id).first()
    return {**DEFAULT_PROFILE, **(json.loads(row.settings_json) if row else {})}


def write_profile(session, user_id, settings):
    zone(settings.get('timezone'))
    row = session.query(models.WorkspaceProfile).filter_by(user_id=user_id).first()
    if row is None:
        row = models.WorkspaceProfile(user_id=user_id)
        session.add(row)
    row.settings_json = json.dumps(settings, ensure_ascii=False)


def record(session, task, is_done, user_id, requested_zone=None):
    if bool(task.is_done) == bool(is_done):
        return
    profile = read_profile(session, user_id)
    tz = requested_zone or profile['timezone'] or 'UTC'
    now = datetime.now(timezone.utc)
    local_day = now.astimezone(zone(tz)).date().isoformat()
    existing = session.query(models.DailyActivity).filter_by(user_id=user_id, task_id=task.id, day=local_day).first()
    if existing is None:
        existing = models.DailyActivity(user_id=user_id, event_key=str(uuid4()), task_id=task.id,
                                       roadmap_id=task.timeframe.roadmap_id, day=local_day)
        session.add(existing)
    existing.title = task.title
    existing.roadmap_name = task.timeframe.roadmap.name
    existing.timeframe = task.timeframe.label
    existing.is_done = is_done
    existing.timezone = tz
    existing.occurred_at = now.isoformat()


def get_profile(user_id):
    with SessionLocal() as session:
        return read_profile(session, user_id)


def save_profile(user_id, settings):
    with SessionLocal() as session:
        write_profile(session, user_id, settings)
        session.commit()
        return read_profile(session, user_id)


def summary(user_id, tz='UTC', year=None):
    today = datetime.now(timezone.utc).astimezone(zone(tz)).date()
    year = year or today.year
    if not 2000 <= year <= today.year + 1:
        raise ValueError('Choose a year between 2000 and next year.')
    with SessionLocal() as session:
        rows = session.query(models.DailyActivity.day, func.count(models.DailyActivity.id)).filter(
            models.DailyActivity.user_id == user_id, models.DailyActivity.is_done.is_(True)
        ).group_by(models.DailyActivity.day).order_by(models.DailyActivity.day).all()
        counts = {day: count for day, count in rows}
        longest = run = 0
        previous = None
        for value in sorted(counts):
            current = date.fromisoformat(value)
            run = run + 1 if previous is not None and current == previous + timedelta(days=1) else 1
            longest = max(longest, run)
            previous = current
        cursor = today if today.isoformat() in counts else today - timedelta(days=1)
        streak = 0
        while cursor.isoformat() in counts:
            streak += 1
            cursor -= timedelta(days=1)
        years = sorted({int(value[:4]) for value in counts} | {today.year}, reverse=True)
        return {'today': today.isoformat(), 'year': year, 'years': years, 'current_streak': streak,
                'longest_streak': longest, 'active_days': len(counts),
                'total_completions': sum(counts.values()),
                'days': [{'date': day, 'count': count} for day, count in counts.items() if day.startswith(str(year))],
                'recent_days': [{'date': (today - timedelta(days=offset)).isoformat(),
                                 'count': counts.get((today - timedelta(days=offset)).isoformat(), 0)}
                                for offset in range(6, -1, -1)],
                'started_at': min(counts) if counts else None}


def day_history(user_id, day, offset=0):
    date.fromisoformat(day)
    with SessionLocal() as session:
        query = session.query(models.DailyActivity).filter_by(user_id=user_id, day=day)
        total = query.count()
        rows = query.order_by(models.DailyActivity.occurred_at.desc(), models.DailyActivity.id.desc()).offset(offset).limit(100).all()
        return {'date': day, 'total': total, 'next_offset': offset + len(rows) if offset + len(rows) < total else None,
                'items': [{'id': row.event_key, 'title': row.title, 'roadmap': row.roadmap_name,
                           'timeframe': row.timeframe, 'is_done': row.is_done,
                           'occurred_at': row.occurred_at, 'timezone': row.timezone} for row in rows]}


def export(user_id):
    with SessionLocal() as session:
        rows = session.query(models.DailyActivity).filter_by(user_id=user_id).order_by(models.DailyActivity.id).all()
        return {'profile': read_profile(session, user_id), 'activity': [
            {field: getattr(row, field) for field in ('event_key', 'roadmap_name', 'title', 'timeframe', 'day', 'timezone', 'is_done', 'occurred_at')}
            for row in rows]}


def validate_backup(payload):
    """Validate all extras before the restore transaction touches any data."""
    from models import ProfileUpdate
    from pydantic import ValidationError
    try:
        profile = ProfileUpdate.model_validate(payload['profile']).model_dump() if 'profile' in payload else None
    except ValidationError as exc:
        raise ValueError('Invalid profile in workspace backup.') from exc
    if profile:
        zone(profile['timezone'])
    rows = payload.get('activity', [])
    if not isinstance(rows, list) or len(rows) > 30000:
        raise ValueError('A workspace backup can contain at most 30000 history records.')
    clean, keys = [], set()
    limits = {'event_key': 40, 'roadmap_name': 200, 'title': 4000, 'timeframe': 500, 'day': 10, 'timezone': 100, 'occurred_at': 50}
    for row in rows:
        if not isinstance(row, dict) or type(row.get('is_done')) is not bool:
            raise ValueError('Invalid activity record in workspace backup.')
        item = {'is_done': row['is_done']}
        for field, limit in limits.items():
            value = row.get(field)
            if not isinstance(value, str) or not value or len(value) > limit:
                raise ValueError('Invalid activity record in workspace backup.')
            item[field] = value
        when = datetime.fromisoformat(item['occurred_at'])
        if when.tzinfo is None or when > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError('Activity timestamps must be past timezone-aware dates.')
        local_date = when.astimezone(zone(item['timezone'])).date()
        if date.fromisoformat(item['day']) != local_date or local_date.year < 2000:
            raise ValueError('Activity dates must match their recorded timezone.')
        if item['event_key'] in keys:
            raise ValueError('Duplicate activity identity in workspace backup.')
        keys.add(item['event_key']); clean.append(item)
    return {'profile': profile, 'activity': clean}


def restore(session, user_id, extras):
    # Restoring is additive. Keep an existing profile; history retains its stable
    # event identity so importing the same backup twice cannot inflate streaks.
    existing = read_profile(session, user_id)
    personal = any(existing.get(key) != value for key, value in DEFAULT_PROFILE.items()
                   if key not in {'onboarding_completed', 'notifications_seen'})
    if extras.get('profile') and not personal:
        write_profile(session, user_id, {**extras['profile'], 'onboarding_completed': existing.get('onboarding_completed', False) or extras['profile'].get('onboarding_completed', False)})
    known = {key for (key,) in session.query(models.DailyActivity.event_key).filter_by(user_id=user_id)}
    for row in extras.get('activity', []):
        if row['event_key'] not in known:
            session.add(models.DailyActivity(user_id=user_id, **row))
            known.add(row['event_key'])
