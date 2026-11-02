"""Conservative extraction of dated, spatial daily planners.

This is a deterministic adapter, not an LLM. Dates come from the document;
relative day numbers alone never imply a calendar date.
"""

from datetime import date, timedelta
import re


_MONTHS = {name: index for index, name in enumerate(
    ('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'), 1)}
_DATE = re.compile(r'\b(\d{1,2})\s+(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+(\d{4})\b', re.I)
_TIME = re.compile(
    r'(?P<optional>OPTIONAL\s+)?(?P<start>(?:[01]?\d|2[0-3]):[0-5]\d)\s*[-–—]\s*'
    r'(?P<end>(?:[01]?\d|2[0-3]):[0-5]\d)\s*'
    r'(?:\((?P<duration>\d+)\s*(?:m|min|mins|minutes?)\))?\s*[:\-–]?\s*', re.I)
_WEEKDAY = re.compile(r'^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$', re.I)


def _dates(text):
    result = []
    for match in _DATE.finditer(text):
        try:
            result.append(date(int(match[3]), _MONTHS[match[2][:3].lower()], int(match[1])))
        except ValueError:
            continue
    return result


def _slots(text):
    matches = list(_TIME.finditer(text))
    result = []
    for index, match in enumerate(matches):
        title = text[match.end():matches[index + 1].start() if index + 1 < len(matches) else len(text)]
        title = title.strip(' \n•·|:–-')
        if not title:
            continue
        result.append((match, title))
    return result


def _task(match, title, label, day_date, page_number, top, week='', timezone='', optional=False):
    start, end = match['start'], match['end']
    duration = match['duration']
    properties = {'Time': f'{start}–{end}', 'Source': f'PDF · page {page_number}'}
    if duration:
        properties['Duration'] = f'{duration} min'
    if timezone:
        properties['Timezone'] = timezone
    if week:
        properties['Week'] = week
    if optional or match['optional']:
        properties['Optional'] = 'Yes'
    task = {'title': title, 'timeframe': label, 'granularity': 'day' if day_date else 'section',
            'is_done': False, 'properties': properties, 'blocks': [],
            'source': {'page': page_number, 'top': top, 'kind': 'scheduled_task'}}
    if day_date:
        task.update(start_date=day_date.isoformat(), end_date=day_date.isoformat())
    return task


def scheduled_page_tasks(lines, page_number, page=None, excluded_lines=()):
    """Return None unless explicit daily-planner semantics establish task intent.

    Weekly layouts use the left date column to delimit rows. This prevents a
    vertically centred day label from being interleaved with a preceding task.
    Single-day pages use a full dated heading and separate timed cards.
    """
    header = next((line for line in lines if re.search(r'DAY\s*/\s*DATE.*TIME.*TASK', line['text'], re.I)), None)
    week_line = next((line for line in lines if re.match(r'^WEEK\s+\d+\b', line['text'], re.I)), None)
    if header and week_line:
        left_lines, right_lines = lines, lines
        if page is not None:
            # Reconstruct each column independently. Text extractors otherwise
            # merge a weekday and its task when they share a baseline.
            words = page.crop((0, header['top'] - 1, page.width, header['bottom'] + 1)).extract_words()
            time_header = next((word for word in words if re.match(r'^TIME\b', word['text'], re.I)), None)
            done_header = next((word for word in words if word['text'].upper() == 'DONE'), None)
            if time_header and time_header['x0'] > 6:
                split = time_header['x0'] - 6
                left_lines = page.crop((0, header['bottom'] + 1, split, page.height)).extract_text_lines(return_chars=False)
                right_lines = page.crop((split, header['bottom'] + 1,
                                        done_header['x0'] - 6 if done_header else page.width,
                                        page.height)).extract_text_lines(return_chars=False)
        bounds = next((_dates(line['text']) for line in lines if line['top'] < header['top'] and len(_dates(line['text'])) >= 2), [])
        weekdays = [line for line in left_lines if line['top'] > header['top'] and _WEEKDAY.fullmatch(line['text'])]
        if not bounds or not weekdays:
            return None
        start, end = bounds[:2]
        if not 0 <= (end - start).days <= 6:
            return None
        timezone_match = re.search(r'TIME\s*\(([^)]+)\)', header['text'], re.I)
        timezone = timezone_match[1] if timezone_match else ''
        topic = next((line['text'] for line in lines if week_line['bottom'] < line['top'] < header['top'] and not _dates(line['text'])), '')
        week = f"Week {int(re.search(r'\d+', week_line['text'])[0])}" + (f' · {topic}' if topic else '')
        tasks = []
        for index, anchor in enumerate(weekdays):
            following = weekdays[index + 1]['top'] if index + 1 < len(weekdays) else float('inf')
            left = [line for line in left_lines if abs(line['x0'] - anchor['x0']) < 5 and anchor['top'] <= line['top'] < following]
            day_line = next((line for line in left if re.fullmatch(r'Day\s+\d+', line['text'], re.I)), None)
            date_line = next((line for line in left if re.fullmatch(r'\d{1,2}\s+[A-Za-z]+', line['text'])), None)
            if date_line is None:
                return None  # Ambiguous left column: let the generic parser retain it.
            date_parts = date_line['text'].split()
            candidates = [start + timedelta(days=offset) for offset in range((end-start).days + 1)]
            candidates = [value for value in candidates if value.day == int(date_parts[0])
                          and value.month == _MONTHS.get(date_parts[1][:3].lower())
                          and value.strftime('%A').lower() == anchor['text'].lower()]
            if len(candidates) != 1:
                return None
            day_date = candidates[0]
            label = f"{week} / {day_line['text'] if day_line else anchor['text'].title()} · {day_date.isoformat()}"
            # Date labels are vertically centred; start above the weekday by
            # half the height of its left-column label cluster.
            offset = ((day_line or date_line)['bottom'] - anchor['top']) / 2
            row_start = max(header['bottom'], anchor['top'] - offset)
            row_end = following - offset if following != float('inf') else max(line['bottom'] for line in lines)
            right = [line for line in right_lines if line['x0'] > date_line.get('x1', date_line['x0'] + 50) + 12
                     and row_start <= line['top'] < row_end
                     and not any(other['top'] - 1 <= line['top'] <= other['bottom'] + 1 for other in excluded_lines)]
            fragments = []
            previous = None
            for line in right:
                timed_line = _TIME.search(line['text']) is not None
                continuation = previous is not None and line['top'] - previous['bottom'] <= max(8, previous['bottom'] - previous['top'])
                if timed_line or continuation:
                    fragments.append(line['text'])
                    previous = line
                else:
                    previous = None
            text = ' '.join(fragments)
            for match, title in _slots(text):
                tasks.append(_task(match, title, label, day_date, page_number, row_start + match.start()/10000, week, timezone))
        return tasks or None

    daily = next((line for line in lines if re.match(r'^DAY\s+\d+\s*[-–—]', line['text'], re.I) and _dates(line['text'])), None)
    optional_setup = any(re.match(r'^OPTIONAL SETUP (TASKS|CHECKLIST)', line['text'], re.I) for line in lines)
    if not daily and not optional_setup:
        return None
    day_date = _dates(daily['text'])[0] if daily else None
    if daily:
        weekday = re.search(r'\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b', daily['text'], re.I)
        if weekday and weekday[0].lower() != day_date.strftime('%A').lower():
            return None
    label = f"Day {re.search(r'\d+', daily['text'])[0]} · {day_date.isoformat()}" if daily else 'Optional setup'
    timed = [(index, line, _slots(line['text'])) for index, line in enumerate(lines)
             if _TIME.match(line['text']) and _slots(line['text'])]
    tasks = []
    for position, (index, line, slots) in enumerate(timed):
        stop = timed[position + 1][0] if position + 1 < len(timed) else len(lines)
        if optional_setup and position + 1 < len(timed):
            current = slots[0][0]
            following_slot = timed[position + 1][2][0][0]
            if current['start'] <= following_slot['start'] and current['end'] > following_slot['end']:
                continue  # Parent time span containing smaller actionable slots.
        for match, title in slots:
            task = _task(match, title, label, day_date, page_number, line['top'], optional=optional_setup)
            notes = [item['text'] for item in lines[index+1:stop]
                     if item['top'] - line['bottom'] < 65 and item['x0'] >= line['x0'] - 2
                     and not re.match(r'^(FINAL )?CHECKPOINT\b', item['text'])]
            if notes:
                task['blocks'] = [{'type': 'note', 'data': {'text': ' '.join(notes)}, 'position': 0}]
            tasks.append(task)
    return tasks or None
