"""Synthetic fixtures reproduce planner geometry without publishing personal PDFs."""
from datetime import date, timedelta
from io import BytesIO
import json
from pathlib import Path

import pytest
from reportlab.pdfgen import canvas
from pdf_importer import parse_pdf_document


def planner_pdf(start=date(2026, 12, 28), background=True, aligned=False):
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=(840, 600))
    def text(x, top, value, size=9):
        c.setFont('Helvetica', size)
        c.drawString(x, 600-top-size, value)
    if background:
        c.setFillColorRGB(1, 1, 1)
        c.rect(0, 0, 840, 600, fill=1)
        c.setFillColorRGB(0, 0, 0)
    text(40, 25, 'WEEK 01 / 30')
    text(40, 46, 'Foundations / small steps', 18)
    end = start + timedelta(days=6)
    text(40, 77, f'{start:%d %b %Y} - {end:%d %b %Y}')
    text(50, 106, 'DAY / DATE')
    text(171, 106, 'TIME (IST) / TASK / DURATION')
    text(780, 106, 'DONE')
    for i in range(7):
        day = start + timedelta(days=i)
        top = 133 + i*58
        text(50, top, day.strftime('%A').upper())
        text(50, top+14, day.strftime('%d %b'))
        text(50, top+28, f'Day {i+1}', 7)
        text(171, top if aligned else top-7, f'19:00-19:30 (30m) Build lesson {i+1}; keep this context')
        text(171, top+7, '19:30-19:40 (10m) Error log | 19:40-20:00 (20m) Review')
        if i == 2:
            text(171, top+38, 'OPTIONAL 20:00-20:15 (15m): Extra practice')
    text(40, 575, 'REFERENCE FOOTER | not a task')
    c.showPage()
    text(40, 25, 'DAY 8 - MONDAY, 04 JAN 2027')
    text(40, 60, 'Final checkpoint', 20)
    text(58, 160, '19:00-19:45 (45 min) - Audit the work')
    text(58, 185, 'Verify the result and preserve this explanation.')
    text(58, 260, '19:45-20:00 (15m) - Plan next week')
    text(58, 285, 'Choose one specific next step.')
    c.save()
    return stream.getvalue()


@pytest.mark.parametrize('background', [True, False])
@pytest.mark.parametrize('aligned', [True, False])
def test_shaded_or_borderless_weekly_planner_keeps_each_date_and_slot(background, aligned):
    r = parse_pdf_document(planner_pdf(background=background, aligned=aligned))
    assert len(r.tasks) == 24  # 7*3 + one optional + two dated cards
    dated = {task['start_date'] for task in r.tasks}
    assert dated == {(date(2026, 12, 28) + timedelta(days=i)).isoformat() for i in range(8)}
    assert r.tasks[0]['title'] == 'Build lesson 1; keep this context'
    assert r.tasks[0]['properties']['Timezone'] == 'IST'
    optional = [t for t in r.tasks if t['properties'].get('Optional') == 'Yes']
    assert len(optional) == 1 and optional[0]['start_date'] == '2026-12-30'
    assert optional[0]['title'] == 'Extra practice'
    assert not any('FOOTER' in t['title'] for t in r.tasks)
    assert r.tasks[-3]['title'] == 'Review'
    assert r.tasks[-2]['blocks'][0]['data']['text'] == 'Verify the result and preserve this explanation.'
    assert r.tasks[-1]['properties']['Duration'] == '15 min'
    assert r.outline


def test_agent_examples_are_a_supported_lossless_contract():
    from roadmap_parser import parse_tasks
    example = Path(__file__).resolve().parents[1] / 'frontend/public/agents/roadmap-example.json'
    tasks = parse_tasks(example.read_text())
    expected = json.loads(example.read_text())['tasks']
    assert len(tasks) == 3
    for actual, original in zip(tasks, expected):
        for field in ('title', 'timeframe', 'start_date', 'end_date', 'is_done', 'properties', 'blocks'):
            assert actual[field] == original[field]


def test_markdown_example_maps_dates_and_explicit_iso_ranges():
    from roadmap_parser import parse_tasks
    example = Path(__file__).resolve().parents[1] / 'frontend/public/agents/roadmap-example.md'
    tasks = parse_tasks(example.read_text())
    assert len(tasks) == 3
    assert [t['start_date'] for t in tasks] == ['2026-11-02', '2026-11-02', '2026-11-03']
    ranged = parse_tasks('## Week 1 2026-11-02 to 2026-11-08\n- [ ] Do one thing')
    assert (ranged[0]['start_date'], ranged[0]['end_date']) == ('2026-11-02', '2026-11-08')
    ambiguous = parse_tasks('## Week 1 November 2–8\n- Do one thing')
    assert 'start_date' not in ambiguous[0]
    invalid = parse_tasks('## Day 1 2026-02-30\n- [ ] Do one thing')
    assert 'start_date' not in invalid[0]


def test_real_planner_when_explicitly_provided():
    import os
    sample = os.getenv('TRAQO_PLANNER_PDF')
    if not sample:
        pytest.skip('Set TRAQO_PLANNER_PDF to run the private 40-page benchmark')
    r = parse_pdf_document(Path(sample).read_bytes())
    assert len(r.tasks) == 724
    assert len({t['start_date'] for t in r.tasks if t.get('start_date')}) == 212
    assert sum(t['properties'].get('Optional') == 'Yes' for t in r.tasks) == 56
    assert not any('NEW core exercises' in t['title'] for t in r.tasks)
    for page in range(7, 37):
        assert [t for t in r.tasks if t['source']['page'] == page][-1]['title'] == 'Log results, applications and next-week plan'


def test_pdf_upload_persists_dates_metadata_and_notes_through_export():
    from uuid import uuid4
    from fastapi.testclient import TestClient
    import db
    from main import app
    db.init_db()
    headers = {'X-Local-User-Id': f'planner-{uuid4().hex}'}
    with TestClient(app) as client:
        response = client.post('/roadmaps/import-file', headers=headers,
                               data={'name': 'Synthetic daily planner'},
                               files={'file': ('planner.pdf', planner_pdf(aligned=True), 'application/pdf')})
        assert response.status_code == 200, response.text
        roadmap_id = response.json()['id']
        try:
            assert response.json()['tasks'] == 24
            frames = client.get(f'/roadmaps/{roadmap_id}/timeframes', headers=headers).json()
            assert len(frames) == 8
            assert frames[0]['start_date'] == '2026-12-28'
            assert frames[-1]['end_date'] == '2027-01-04'
            exported = client.get(f'/roadmaps/{roadmap_id}/export', headers=headers).json()
            assert len(exported['tasks']) == 24
            assert exported['tasks'][0]['properties']['Timezone'] == 'IST'
            assert exported['tasks'][-2]['blocks'][0]['data']['text'] == 'Verify the result and preserve this explanation.'
            assert exported['document']
        finally:
            client.delete(f'/roadmaps/{roadmap_id}', headers=headers)
