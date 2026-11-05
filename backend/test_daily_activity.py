"""Daily import, additive recovery, owner boundaries and real activity semantics."""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
import activity
import db
from database import SessionLocal
from day_plan import parse_day_document
from main import app
import models_db as models
from roadmap_parser import parse_tasks
from testing_helpers import smart_put

client = TestClient(app)
db.init_db()

SOURCE = '''# Week 1: Foundations
## Day 1 · 2026-11-04
- [ ] Set up C++
Time: 19:00-19:25 IST | Duration: 25m | Priority: High | Optional: No
Compile one small program. Keep the command and its output.
- [x] Review vectors
LeetCode: 1929
Status: Try without hints.
## Day 2 · 2026-11-05
- [ ] Solve one array problem
Duration: 30m
'''


def owner():
    return {'X-Local-User-Id': 'daily_' + uuid4().hex}


def create(headers, text=SOURCE):
    result = client.post('/roadmaps', headers=headers, json={'name': 'Daily ' + uuid4().hex, 'text': text})
    assert result.status_code == 200, result.text
    rid = result.json()['id']
    return rid, client.get(f'/roadmaps/{rid}/tasks', headers=headers).json()


def test_day_parser_preserves_dates_actions_and_context_without_metadata_checkboxes():
    tasks = parse_tasks(SOURCE)
    assert len(tasks) == 3
    assert tasks[0]['start_date'] == tasks[0]['end_date'] == '2026-11-04'
    assert tasks[0]['properties']['Day'] == 1
    assert tasks[0]['properties']['Week'] == 'Week 1: Foundations'
    assert tasks[0]['properties']['Duration'] == '25m'
    assert tasks[0]['properties']['Optional'] == 'No'
    assert tasks[0]['blocks'][0]['data']['text'].startswith('Compile one small program')
    assert tasks[1]['is_done'] is True
    assert tasks[1]['properties']['Leetcode'] == '1929'
    assert tasks[2]['start_date'] == '2026-11-05'
    assert len({task['timeframe'] for task in tasks}) == 2


def test_explicit_pdf_style_day_headings_and_undated_days():
    tasks = parse_day_document([
        {'type': 'heading', 'level': 2, 'text': '2026-11-04 - Wednesday - Day 001'},
        {'type': 'paragraph', 'text': 'Week 1: Foundations'},
        {'type': 'paragraph', 'text': '- [ ] Study arrays'},
        {'type': 'paragraph', 'text': 'Time: 19:00-19:25 | Duration: 25m'},
        {'type': 'heading', 'level': 2, 'text': 'Day 2'},
        {'type': 'paragraph', 'text': '- [ ] Practice arrays'},
    ])
    assert len(tasks) == 2
    assert tasks[0]['timeframe'].startswith('Week 1: Foundations / Day 1')
    assert tasks[0]['granularity'] == tasks[1]['granularity'] == 'day'
    assert 'start_date' not in tasks[1]
    assert parse_day_document([{'type': 'paragraph', 'text': 'On day 1 you should start.'}]) is None


def test_day_copy_is_reviewed_additive_and_preserves_matching_state():
    headers = owner()
    source = [
        {'type': 'heading', 'level': 1, 'text': 'Week 1'},
        {'type': 'heading', 'level': 2, 'text': 'Day 1 · 2026-11-04'},
        {'type': 'paragraph', 'text': '- [ ] Same task'},
        {'type': 'heading', 'level': 2, 'text': 'Day 2 · 2026-11-05'},
        {'type': 'paragraph', 'text': '- [ ] Same task'}]
    response = client.post('/roadmaps/import', headers=headers, json={
        'name': 'Old weekly ' + uuid4().hex, 'document': source, 'tasks': [
            {'title': 'Same task', 'timeframe': 'Week 1', 'is_done': True,
             'blocks': [{'type': 'note', 'data': {'text': 'My saved note'}, 'position': 0}]},
            {'title': 'Same task', 'timeframe': 'Week 1', 'is_done': False},
            {'title': 'My custom action', 'timeframe': 'Week 1'}]})
    assert response.status_code == 200, response.text
    rid = response.json()['id']
    original = client.get(f'/roadmaps/{rid}/export', headers=headers).json()
    preview = client.get(f'/roadmaps/{rid}/recover-days', headers=headers).json()
    assert preview['available'] and preview['days'] == 2 and preview['matched'] == 2 and preview['unmatched'] == 1
    assert preview['tasks'][0]['is_done'] and not preview['tasks'][1]['is_done']
    assert preview['tasks'][0]['blocks'][0]['data']['text'] == 'My saved note'
    assert client.get(f'/roadmaps/{rid}/recover-days', headers=owner()).status_code == 404
    assert client.post(f'/roadmaps/{rid}/recover-days', headers=headers, json={'revision': 0}).status_code == 409
    copied = client.post(f'/roadmaps/{rid}/recover-days', headers=headers, json={'revision': preview['revision']})
    assert copied.status_code == 200, copied.text
    assert copied.json()['id'] != rid
    assert client.get(f'/roadmaps/{rid}/export', headers=headers).json() == original
    tasks = client.get(f"/roadmaps/{copied.json()['id']}/tasks", headers=headers).json()
    assert tasks[0]['granularity'] == 'day' and tasks[0]['start_date'] == '2026-11-04'
    assert client.get('/activity', headers=headers).json()['total_completions'] == 0


def test_real_completion_bulk_atomicity_same_day_undo_and_owner_isolation():
    headers = owner()
    rid, tasks = create(headers)
    assert client.get('/activity', headers=headers).json()['total_completions'] == 0
    tid = tasks[0]['id']
    for _ in range(2):
        assert client.put(f'/tasks/{tid}/status', headers=headers, json={'is_done': True, 'timezone': 'Asia/Kolkata'}).status_code == 200
    summary = client.get('/activity?timezone=Asia/Kolkata', headers=headers).json()
    assert summary['total_completions'] == 1 and summary['current_streak'] == 1
    history = client.get('/activity/' + summary['today'], headers=headers).json()
    assert history['items'][0]['title'] == tasks[0]['title']
    assert client.get('/activity/' + summary['today'], headers=owner()).json()['total'] == 0
    assert client.put(f'/tasks/{tid}/status', headers=owner(), json={'is_done': False}).status_code == 404
    assert client.post(f'/roadmaps/{rid}/tasks/status', headers=headers, json={'task_ids': [tid, 99999999], 'is_done': False}).status_code == 404
    assert client.get('/activity', headers=headers).json()['total_completions'] == 1
    assert client.put(f'/tasks/{tid}/status', headers=headers, json={'is_done': False, 'timezone': 'Asia/Kolkata'}).status_code == 200
    assert client.get('/activity', headers=headers).json()['total_completions'] == 0
    assert client.post(f'/roadmaps/{rid}/tasks/status', headers=headers, json={'task_ids': [t['id'] for t in tasks], 'is_done': True, 'timezone': 'Asia/Kolkata'}).status_code == 200
    # Already imported checked task gets no new credit: only the two actual changes.
    assert client.get('/activity', headers=headers).json()['total_completions'] == 2
    assert client.put(f'/tasks/{tid}/status', headers=headers, json={'is_done': False, 'timezone': 'made/up'}).status_code == 400
    assert client.get('/activity/not-a-date', headers=headers).status_code == 400


def test_timezone_boundaries_reopening_on_later_day_and_streaks(monkeypatch):
    headers = owner()
    rid, tasks = create(headers)
    class Clock(datetime):
        instant = datetime(2026, 11, 3, 23, 50, tzinfo=timezone.utc)
        @classmethod
        def now(cls, tz=None):
            return cls.instant.astimezone(tz) if tz else cls.instant
    monkeypatch.setattr(activity, 'datetime', Clock)
    put = lambda done: client.put(f"/tasks/{tasks[0]['id']}/status", headers=headers, json={'is_done': done, 'timezone': 'Asia/Kolkata'})
    assert put(True).status_code == 200
    assert client.get('/activity?timezone=Asia/Kolkata', headers=headers).json()['days'] == [{'date': '2026-11-04', 'count': 1}]
    Clock.instant = datetime(2026, 11, 4, 23, 50, tzinfo=timezone.utc)
    assert put(False).status_code == 200
    assert client.get('/activity?timezone=Asia/Kolkata', headers=headers).json()['total_completions'] == 1
    assert put(True).status_code == 200
    summary = client.get('/activity?timezone=Asia/Kolkata', headers=headers).json()
    assert summary['current_streak'] == summary['longest_streak'] == 2
    Clock.instant = datetime(2026, 11, 6, 23, 50, tzinfo=timezone.utc)
    assert client.get('/activity?timezone=Asia/Kolkata', headers=headers).json()['current_streak'] == 0


def test_profile_backup_and_history_restore_are_owner_scoped_additive_and_idempotent():
    headers = owner()
    settings = {**activity.DEFAULT_PROFILE, 'name': 'My local profile', 'bio': 'Learning daily', 'goal': 'One step', 'timezone': 'Asia/Kolkata', 'week_start': 'sunday', 'compact': True, 'pet_motion': False, 'reduced_motion': True}
    assert client.put('/profile', headers=headers, json=settings).json() == settings
    assert client.get('/profile', headers=owner()).json()['name'] != settings['name']
    assert client.put('/profile', headers=headers, json={**settings, 'timezone': 'bad/zone'}).status_code == 400
    assert client.put('/profile', headers=headers, json={**settings, 'name': 'x' * 81}).status_code == 422
    assert client.put('/profile', headers=headers, json={**settings, 'name': '   '}).status_code == 422
    rid, tasks = create(headers)
    assert client.put(f"/tasks/{tasks[0]['id']}/status", headers=headers, json={'is_done': True}).status_code == 200
    backup = client.get('/backup', headers=headers).json()
    assert backup['profile'] == settings and len(backup['activity']) == 1
    target = owner()
    import json
    for _ in range(2):
        result = client.post('/backup/restore-file', headers=target, files={'file': ('backup.json', json.dumps(backup).encode(), 'application/json')})
        assert result.status_code == 200, result.text
    assert client.get('/profile', headers=target).json() == settings
    assert client.get('/activity', headers=target).json()['total_completions'] == 1
    broken = {**backup, 'activity': [{**backup['activity'][0], 'day': '2000-01-01'}]}
    before = client.get('/roadmaps', headers=target).json()
    assert client.post('/backup/restore-file', headers=target, files={'file': ('backup.json', json.dumps(broken).encode())}).status_code == 400
    assert client.get('/roadmaps', headers=target).json() == before


def test_structural_editor_changes_count_but_new_checked_tasks_do_not():
    headers = owner()
    rid, tasks = create(headers)
    exported = client.get(f'/roadmaps/{rid}/export', headers=headers).json()
    exported['tasks'][0]['is_done'] = True
    exported['tasks'].append({'title': 'Already done elsewhere', 'timeframe': 'Week 1 / Day 3', 'is_done': True})
    response = smart_put(client, f'/roadmaps/{rid}/smart', headers=headers, json={'name': exported['name'], 'tasks': exported['tasks']})
    assert response.status_code == 200, response.text
    assert client.get('/activity', headers=headers).json()['total_completions'] == 1


def test_uploaded_pdf_and_docx_keep_explicit_day_sessions_and_context():
    from io import BytesIO
    from reportlab.pdfgen import canvas
    from docx import Document
    headers = owner()
    stream = BytesIO()
    pdf = canvas.Canvas(stream)
    y = 790
    for text in ['Week 1: Foundations', 'Day 1 - 2026-11-04', '- [ ] Build one example', 'Time: 19:00-19:25 | Duration: 25m', 'Keep the output.', 'Day 2 - 2026-11-05', '- [ ] Review the example']:
        pdf.setFont('Helvetica-Bold' if text.startswith(('Week', 'Day')) else 'Helvetica', 12)
        pdf.drawString(50, y, text); y -= 28
    pdf.save()
    word = Document()
    word.add_heading('Week 1: Foundations', 1)
    word.add_heading('Day 1 - 2026-11-04', 2)
    word.add_paragraph('- [ ] Build one example')
    word.add_paragraph('Time: 19:00-19:25 | Duration: 25m')
    word.add_paragraph('Keep the output.')
    word.add_heading('Day 2 - 2026-11-05', 2)
    word.add_paragraph('- [ ] Review the example')
    docx = BytesIO(); word.save(docx)
    for name, content in [('days.pdf', stream.getvalue()), ('days.docx', docx.getvalue())]:
        result = client.post('/roadmaps/preview-file', headers=headers, files={'file': (name, content)})
        assert result.status_code == 200, result.text
        tasks = result.json()['tasks']
        assert len(tasks) == 2, (name, tasks)
        assert tasks[0]['granularity'] == 'day' and tasks[0]['start_date'] == '2026-11-04'
        assert tasks[1]['start_date'] == '2026-11-05'
        assert tasks[0]['properties']['Duration'] == '25m'
