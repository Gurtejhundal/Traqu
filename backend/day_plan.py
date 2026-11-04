"""Explicit day headings and checkbox actions, with supporting context attached."""
from collections import defaultdict, deque
from datetime import date
import re

DAY = re.compile(r'\bday\s*0*(\d+)\b', re.I)
WEEK = re.compile(r'^week\s*0*(\d+)\b.*', re.I)
CHECK = re.compile(r'^(?:[-*+•]\s*)?(?:\[([ xX✓✔])\]|([☐☑☒]))\s*(.+)')
META = re.compile(r'^(Time|Duration|Priority|Optional|Timezone|Status|LeetCode|Date)\s*:\s*(.+)', re.I)


def document_lines(elements):
    for element in elements or []:
        kind = element.get('type')
        if kind == 'list':
            for item in element.get('items', []):
                yield str(item).strip(), False
        elif kind in {'heading', 'paragraph', 'callout', 'code'}:
            for line in str(element.get('text', '')).splitlines():
                if line.strip():
                    yield line.strip(), kind == 'heading'


def parse_day_document(elements):
    lines = list(document_lines(elements))
    # A day label in explanatory prose is not a new day.
    headings = [text for text, heading in lines if DAY.search(text) and
                (heading or re.match(r'^(?:#{1,6}\s*)?(?:day\s*\d|\d{4}-\d{2}-\d{2}|week\s*\d+.*[/›])', text, re.I))]
    if not headings or not any(CHECK.match(text) for text, _ in lines):
        return None
    tasks, current, week, last = [], None, '', None
    for text, heading in lines:
        clean = re.sub(r'^#{1,6}\s*', '', text).strip()
        match = DAY.search(clean)
        if clean in headings or text in headings:
            current = {'number': int(match[1]), 'date': None, 'title': clean, 'intro': []}
            iso = re.search(r'\b\d{4}-\d{2}-\d{2}\b', clean)
            if iso:
                try:
                    current['date'] = date.fromisoformat(iso[0]).isoformat()
                except ValueError:
                    pass
            inline_week = re.search(r'\bweek\s*\d+[^/›]*', clean, re.I)
            if inline_week:
                week = inline_week[0].strip()
            current['week'] = week
            last = None
            continue
        if WEEK.match(clean):
            week = clean
            if current and last is None:
                current['week'] = week
            continue
        if not current:
            continue
        checked = CHECK.match(clean)
        if checked:
            label = f"Day {current['number']}" + (f" · {current['date']}" if current['date'] else '')
            if current['week']:
                label = f"{current['week']} / {label}"
            last = {'title': checked[3].strip(), 'timeframe': label, 'granularity': 'day',
                    'is_done': checked[1] in {'x', 'X', '✓', '✔'} or checked[2] in {'☑', '☒'},
                    'properties': {'Day': current['number'], **({'Week': current['week']} if current['week'] else {})},
                    'blocks': []}
            if current['date']:
                last.update(start_date=current['date'], end_date=current['date'])
            if current['intro']:
                last['blocks'].append({'type': 'note', 'data': {'text': 'Daily context\n' + '\n'.join(current['intro'])}, 'position': 0})
                current['intro'] = []
            tasks.append(last)
            continue
        if last is None:
            current['intro'].append(clean)
            continue
        metadata = META.match(clean)
        if metadata:
            for segment in re.split(r'\s*\|\s*', clean):
                item = META.match(segment)
                if item:
                    key = item[1].title()
                    last['properties'][key] = item[2].strip()
            continue
        if heading and not DAY.search(clean):
            # A heading under a day is context, not a checkbox.
            last['properties']['Section'] = clean
        elif clean:
            if last['blocks'] and last['blocks'][-1]['type'] == 'note':
                last['blocks'][-1]['data']['text'] += '\n' + clean
            else:
                last['blocks'].append({'type': 'note', 'data': {'text': clean}, 'position': len(last['blocks'])})
    return tasks or None


def recover_day_copy(snapshot):
    tasks = parse_day_document(snapshot.get('document'))
    if not tasks:
        return None
    originals = defaultdict(deque)
    for task in snapshot['tasks']:
        originals[re.sub(r'\s+', ' ', task['title']).strip()].append(task)
    matched = 0
    for task in tasks:
        queue = originals.get(re.sub(r'\s+', ' ', task['title']).strip())
        if queue:
            previous = queue.popleft()
            matched += 1
            task['is_done'] = previous['is_done']
            task['properties'] = {**task['properties'], **previous.get('properties', {})}
            saved = [{key: value for key, value in block.items() if key != 'id'} for block in previous.get('blocks', [])]
            task['blocks'] = saved + task['blocks']
            for index, block in enumerate(task['blocks']):
                block['position'] = index
    return {'name': snapshot['name'][:180] + ' · Daily', 'tasks': tasks, 'document': snapshot.get('document', []),
            'matched': matched, 'unmatched': len(snapshot['tasks']) - matched, 'days': len({task['timeframe'] for task in tasks}), 'revision': snapshot['revision'],
            'message': 'Creates a daily copy from explicit source headings. The original roadmap and its full source are kept.'}
