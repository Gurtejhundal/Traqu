import json
from contextlib import closing
from io import BytesIO
import sqlite3
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from docx import Document

import db
from main import app
from roadmap_parser import parse_tasks


@pytest.fixture
def workspace():
    db.init_db()
    with TestClient(app) as client:
        client.headers['X-Local-User-Id'] = f'audit-fix-{uuid4().hex}'
        yield client


def create(client, tasks=None):
    response = client.post('/roadmaps/import', json={'name': f'Fixture {uuid4().hex}', 'tasks': tasks or [
        {'title': 'Task A', 'timeframe': 'First'}, {'title': 'Task B', 'timeframe': 'Second'},
    ]})
    assert response.status_code == 200, response.text
    return response.json()['id']


def export(client, rid):
    response = client.get(f'/roadmaps/{rid}/export')
    assert response.status_code == 200
    return response.json()


def test_standard_lists_keep_titles_completion_and_repeated_actions():
    tasks = parse_tasks('# Week 1\n- [x] Finished task\n- [ ] Remaining task\n1. Install Python\n2. Write a script')
    assert [(task['title'], task['is_done']) for task in tasks] == [
        ('Finished task', True), ('Remaining task', False), ('Install Python', False), ('Write a script', False)]
    assert [task['title'] for task in parse_tasks('- Walk\n- Drink water\n- Walk')] == ['Walk', 'Drink water', 'Walk']


def test_reordering_preserves_ids_and_stale_task_links_still_target_the_same_action(workspace):
    rid = create(workspace)
    original = export(workspace, rid)
    aid = original['tasks'][0]['id']
    original['tasks'].reverse()
    response = workspace.put(f'/roadmaps/{rid}/smart', json=original)
    assert response.status_code == 200, response.text
    result = export(workspace, rid)['tasks']
    assert [task['title'] for task in result] == ['Task B', 'Task A']
    assert result[1]['id'] == aid
    assert workspace.put(f'/tasks/{aid}/status', json={'is_done': True}).status_code == 200
    assert [task['title'] for task in export(workspace, rid)['tasks'] if task['is_done']] == ['Task A']


def test_stale_structural_save_keeps_new_progress_and_missing_revision_is_rejected(workspace):
    rid = create(workspace)
    old = export(workspace, rid)
    aid = old['tasks'][0]['id']
    workspace.put(f'/tasks/{aid}/status', json={'is_done': True})
    assert workspace.put(f'/roadmaps/{rid}/smart', json=old).status_code == 409
    assert export(workspace, rid)['tasks'][0]['is_done'] is True
    old.pop('revision')
    assert workspace.put(f'/roadmaps/{rid}/smart', json=old).status_code == 428


@pytest.mark.parametrize('mutation', ['title', 'properties', 'blocks', 'dates', 'name'])
def test_other_changes_invalidate_editor_snapshots(workspace, mutation):
    rid = create(workspace)
    old = export(workspace, rid)
    task = old['tasks'][0]
    if mutation == 'title':
        response = workspace.put(f"/tasks/{task['id']}", json={'title': 'Changed title'})
    elif mutation == 'properties':
        response = workspace.put(f"/tasks/{task['id']}/properties", json={'properties': {'Priority': 'High'}})
    elif mutation == 'blocks':
        response = workspace.post(f"/tasks/{task['id']}/blocks", json={'type': 'note', 'data': {'text': 'Keep this'}})
    elif mutation == 'dates':
        response = workspace.put(f"/timeframes/{task['timeframe_id']}/dates", json={'start_date': '2026-11-03'})
    else:
        response = workspace.put(f'/roadmaps/{rid}/name', json={'name': 'Updated name'})
    assert response.status_code in {200, 201}, response.text
    assert workspace.put(f'/roadmaps/{rid}/smart', json=old).status_code == 409


def test_deleted_task_identity_is_not_reused_and_cross_roadmap_ids_are_rejected(workspace):
    rid = create(workspace)
    original = export(workspace, rid)
    deleted = original['tasks'][-1]
    assert workspace.delete(f"/tasks/{deleted['id']}").status_code == 200
    new = workspace.post('/tasks', json={'roadmap_id': rid, 'timeframe_id': original['tasks'][0]['timeframe_id'], 'title': 'New task'}).json()
    assert new['id'] > deleted['id']
    assert workspace.put(f"/tasks/{deleted['id']}/status", json={'is_done': True}).status_code == 404
    other = create(workspace)
    payload = export(workspace, rid)
    payload['tasks'][0]['id'] = export(workspace, other)['tasks'][0]['id']
    assert workspace.put(f'/roadmaps/{rid}/smart', json=payload).status_code == 400
    assert export(workspace, rid)['tasks'][0]['title'] == 'Task A'


def test_task_move_and_empty_section_cleanup_keep_notes_and_ids(workspace):
    rid = create(workspace)
    initial = export(workspace, rid)
    aid = initial['tasks'][0]['id']
    workspace.post(f'/tasks/{aid}/blocks', json={'type': 'note', 'data': {'text': 'Keep on move'}})
    payload = export(workspace, rid)
    blockid = payload['tasks'][0]['blocks'][0]['id']
    payload['tasks'][0]['timeframe_id'] = payload['tasks'][1]['timeframe_id']
    payload['tasks'][0]['timeframe'] = payload['tasks'][1]['timeframe']
    response = workspace.put(f'/roadmaps/{rid}/smart', json=payload)
    assert response.status_code == 200, response.text
    result = export(workspace, rid)
    assert result['tasks'][0]['id'] == aid
    assert result['tasks'][0]['blocks'][0]['id'] == blockid
    assert len(workspace.get(f'/roadmaps/{rid}/timeframes').json()) == 1


def test_json_restore_retains_adjacent_duplicate_named_sections(workspace):
    rid = create(workspace, [
        {'title': 'Monday work', 'timeframe': 'Monday', 'start_date': '2026-11-02', 'end_date': '2026-11-02'},
        {'title': 'Tuesday work', 'timeframe': 'Tuesday', 'start_date': '2026-11-03', 'end_date': '2026-11-03'},
    ])
    payload = export(workspace, rid)
    for task in payload['tasks']:
        task['timeframe'] = 'Daily'
    assert workspace.put(f'/roadmaps/{rid}/smart', json=payload).status_code == 200
    snapshot = export(workspace, rid)
    restored = workspace.post('/roadmaps/import-file', data={'name': 'Restored duplicate names'},
                              files={'file': ('backup.json', json.dumps(snapshot).encode(), 'application/json')})
    assert restored.status_code == 200, restored.text
    tasks = export(workspace, restored.json()['id'])['tasks']
    assert len({task['timeframe_id'] for task in tasks}) == 2
    assert [task['start_date'] for task in tasks] == ['2026-11-02', '2026-11-03']


@pytest.mark.parametrize('extension,content', [
    ('csv', 'timeframe,title,is_done\nWeek 1,Install Python,true\nWeek 2,Build a demo,false'),
    ('yaml', 'tasks:\n  - title: Install Python\n    timeframe: Week 1\n    is_done: true\n  - title: Build a demo\n    timeframe: Week 2\n    is_done: false'),
])
def test_structured_text_imports_have_real_fields(workspace, extension, content):
    response = workspace.post('/roadmaps/import-file', data={'name': f'Structured {extension}'},
                              files={'file': (f'plan.{extension}', content.encode(), 'text/plain')})
    assert response.status_code == 200, response.text
    tasks = export(workspace, response.json()['id'])['tasks']
    assert [(task['title'], task['timeframe'], task['is_done']) for task in tasks] == [
        ('Install Python', 'Week 1', True), ('Build a demo', 'Week 2', False)]


@pytest.mark.parametrize('content', ['tasks: [', 'tasks: &a [*a]', '!!python/object/apply:os.system [echo nope]'])
def test_invalid_or_recursive_yaml_is_rejected(workspace, content):
    response = workspace.post('/roadmaps/preview-file', files={'file': ('plan.yaml', content.encode(), 'text/plain')})
    assert response.status_code == 400


def test_preview_is_read_only_and_file_json_cannot_bypass_limits(workspace):
    before = workspace.get('/roadmaps').json()
    preview = workspace.post('/roadmaps/preview', json={'text': '# Week 1\n- [x] Finish one thing'}).json()
    assert preview['tasks'][0]['is_done'] is True
    assert workspace.get('/roadmaps').json() == before
    response = workspace.post('/roadmaps/import-file', data={'name': 'Long task'}, files={
        'file': ('plan.json', json.dumps({'tasks': [{'title': 'a' * 4001, 'timeframe': 'Week 1'}]}).encode(), 'application/json')})
    assert response.status_code == 400
    assert workspace.post('/roadmaps', json={'name': 'Too many actions', 'text': '\n'.join(f'- Task {i}' for i in range(5001))}).status_code == 400


def test_chunked_requests_cannot_bypass_the_body_limit(workspace):
    chunks = (b'x' * 16384 for _ in range(1025))
    response = workspace.post('/roadmaps', content=chunks, headers={'Content-Type': 'application/json'})
    assert response.status_code == 413


def test_assignments_embedded_in_day_rows_are_actions_with_dates_and_warnings(workspace):
    text = '''6 unique LeetCode problems
WEEK 01 / 02 | 02 Nov 2026 - 08 Nov 2026
DAY / TOPIC LEETCODE ASSIGNMENTS (OPEN EXACT PROBLEM)
DAY 1 Mon 02 Nov 2 NEW #414 Third Maximum Number [Arrays]
#189 Rotate Array [Arrays]
DAY 7 Sun 08 Nov CONTEST + 1
NEW
#66 Plus One [Arrays]
DAILY CONCEPT
This is supporting explanation, not an action.
'''
    result = workspace.post('/roadmaps/preview', json={'text': text}).json()
    assert [task['title'] for task in result['tasks']] == ['#414 Third Maximum Number', '#189 Rotate Array', 'Timed contest', '#66 Plus One']
    assert [task['start_date'] for task in result['tasks']] == ['2026-11-02', '2026-11-02', '2026-11-08', '2026-11-08']
    assert len(result['warnings']) == 2


def test_workspace_backup_restore_is_atomic_and_never_overwrites(workspace):
    rid = create(workspace)
    original = export(workspace, rid)
    backup = workspace.get('/backup').json()
    response = workspace.post('/backup/restore-file', files={'file': ('backup.json', json.dumps(backup).encode(), 'application/json')})
    assert response.status_code == 200, response.text
    assert len(workspace.get('/roadmaps').json()) == 2
    assert export(workspace, rid) == original
    restored = export(workspace, response.json()['roadmaps'][0]['id'])
    assert '(restored 2)' in restored['name']
    assert [task['title'] for task in restored['tasks']] == ['Task A', 'Task B']
    backup['roadmaps'].append({'name': 'Invalid backup item', 'tasks': [{'title': '', 'timeframe': 'General'}]})
    assert workspace.post('/backup/restore-file', files={'file': ('bad.json', json.dumps(backup).encode(), 'application/json')}).status_code == 400
    assert len(workspace.get('/roadmaps').json()) == 2


def test_own_word_exports_keep_tasks_dates_notes_and_skip_attribution(workspace):
    document = Document()
    document.add_heading('Export fixture', level=0)
    document.add_paragraph('Generated by Traqu - 2026-11-03', style='Subtitle')
    document.add_heading('Delivery · 2026-11-12 to 2026-11-14', level=1)
    document.add_paragraph('[x] First action', style='List Bullet')
    document.add_paragraph('Note: Context for the first action')
    document.add_paragraph('[ ] Learn 中文 and ਪੰਜਾਬੀ 🚀', style='List Bullet')
    stream = BytesIO()
    document.save(stream)
    response = workspace.post('/roadmaps/import-file', data={'name': 'Word fixture'}, files={
        'file': ('fixture.docx', stream.getvalue(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')})
    assert response.status_code == 200, response.text
    tasks = export(workspace, response.json()['id'])['tasks']
    assert [task['title'] for task in tasks] == ['First action', 'Learn 中文 and ਪੰਜਾਬੀ 🚀']
    assert [task['is_done'] for task in tasks] == [True, False]
    assert all((task['start_date'], task['end_date']) == ('2026-11-12', '2026-11-14') for task in tasks)
    assert 'Context' in tasks[0]['blocks'][0]['data']['text']


def test_sqlite_snapshot_is_readable_and_releases_file_handles(monkeypatch, tmp_path):
    path = tmp_path / 'workspace.db'
    with closing(sqlite3.connect(path)) as source:
        source.execute('CREATE TABLE evidence(value TEXT)')
        source.execute("INSERT INTO evidence VALUES ('Keep my progress')")
        source.commit()
    engine = create_engine(f'sqlite:///{path}')
    monkeypatch.setattr(db, 'engine', engine)
    try:
        db._snapshot_local_database()
        snapshot, = (tmp_path / 'backups').glob('*.db')
        # Windows forbids this rename while the backup connection is open.
        moved = snapshot.replace(snapshot.with_suffix('.verified'))
        with closing(sqlite3.connect(moved)) as restored:
            assert restored.execute('SELECT value FROM evidence').fetchone() == ('Keep my progress',)
        assert not list((tmp_path / 'backups').glob('*.pending'))
    finally:
        engine.dispose()


def test_legacy_sqlite_upgrade_preserves_ids_and_prevents_reuse(monkeypatch, tmp_path):
    path = tmp_path / 'legacy.db'
    with closing(sqlite3.connect(path)) as connection:
        connection.executescript('''
        CREATE TABLE roadmaps(id INTEGER PRIMARY KEY,user_id VARCHAR,name VARCHAR,raw_text TEXT,created_at VARCHAR);
        CREATE TABLE timeframes(id INTEGER PRIMARY KEY,roadmap_id INTEGER REFERENCES roadmaps(id),label VARCHAR,granularity VARCHAR);
        CREATE TABLE tasks(id INTEGER PRIMARY KEY,timeframe_id INTEGER REFERENCES timeframes(id),title TEXT,details VARCHAR,is_done BOOLEAN,created_at VARCHAR);
        CREATE TABLE task_blocks(id INTEGER PRIMARY KEY,task_id INTEGER REFERENCES tasks(id),type VARCHAR,data_json TEXT,position INTEGER,created_at VARCHAR,updated_at VARCHAR);
        INSERT INTO roadmaps VALUES(41,'local_owner','Existing plan','','2026-11-03');
        INSERT INTO timeframes VALUES(63,41,'Existing section','week');
        INSERT INTO tasks VALUES(99,63,'Keep this task',NULL,1,'2026-11-03');
        INSERT INTO task_blocks VALUES(77,99,'note','{"text":"Keep this note"}',0,'2026-11-03','2026-11-03');
        ''')
    engine = create_engine(f'sqlite:///{path}', connect_args={'check_same_thread': False})
    monkeypatch.setattr(db, 'engine', engine)
    monkeypatch.setattr(db, 'SessionLocal', sessionmaker(bind=engine, autoflush=False))
    try:
        db.init_db()
        assert db.get_tasks(41, 'local_owner')[0]['id'] == 99
        assert db.get_tasks(41, 'local_owner')[0]['blocks'][0]['id'] == 77
        assert list((tmp_path / 'backups').glob('*.db'))
        assert db.delete_task(99, 'local_owner')
        assert db.create_task(41, 'Existing section', 'Next task', 'local_owner')['id'] > 99
        with sqlite3.connect(path) as connection:
            assert connection.execute('PRAGMA foreign_key_check').fetchall() == []
    finally:
        engine.dispose()
