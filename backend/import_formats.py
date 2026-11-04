"""Small, explicit text interchange formats shared by preview and import."""
import csv
from io import StringIO
import json
import re

import roadmap_parser as parser


def structured_text(text, extension):
    if extension == '.csv':
        reader = csv.DictReader(StringIO(text))
        if not reader.fieldnames or 'title' not in reader.fieldnames:
            raise ValueError('CSV needs a title column; timeframe, is_done, start_date, and end_date are optional.')
        tasks = []
        for row in reader:
            if len(tasks) >= 5000:
                raise ValueError('A roadmap can contain at most 5000 tasks.')
            if not row.get('title', '').strip():
                continue
            item = {'title': row['title'], 'timeframe': row.get('timeframe') or 'General',
                    'is_done': parser._json_boolean(row.get('is_done'))}
            for key in ('start_date', 'end_date', 'granularity', 'section_key'):
                if row.get(key):
                    item[key] = row[key]
            for key, expected in (('properties', dict), ('blocks', list)):
                if row.get(key):
                    value = json.loads(row[key])
                    if not isinstance(value, expected):
                        raise ValueError(f'CSV {key} must contain a JSON {expected.__name__}.')
                    item[key] = value
            tasks.append(item)
        return json.dumps({'tasks': tasks}, ensure_ascii=False)
    if extension in {'.yaml', '.yml'}:
        import yaml
        # SafeLoader prohibits constructors. The node cap also prevents small
        # alias documents expanding into unbounded JSON or recursive objects.
        try:
            payload = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            raise ValueError('YAML syntax is invalid.') from exc
        count = 0
        active = set()
        def bounded(value):
            nonlocal count
            count += 1
            if count > 150_000:
                raise ValueError('YAML contains too many values.')
            if isinstance(value, (list, dict)):
                identity = id(value)
                if identity in active:
                    raise ValueError('Recursive YAML aliases are not supported.')
                active.add(identity)
                values = value.values() if isinstance(value, dict) else value
                for nested in values:
                    bounded(nested)
                active.remove(identity)
        bounded(payload)
        # SafeLoader resolves ISO dates to date objects; JSON needs their ISO text.
        return json.dumps(payload, ensure_ascii=False, default=str, allow_nan=False)
    return text


def source_outline(text):
    elements = []
    code = None
    for line in text.splitlines():
        if re.match(r'^\s*```|^\s*~~~', line):
            if code is None:
                code = []
            else:
                elements.append({'type': 'code', 'text': '\n'.join(code)})
                code = None
            continue
        if code is not None:
            code.append(line)
        elif line.strip():
            heading = re.match(r'^\s*(#{1,6})\s+(.+)', line)
            elements.append({'type': 'heading', 'level': len(heading[1]), 'text': heading[2]}
                            if heading else {'type': 'paragraph', 'text': line.strip()})
        if len(elements) > 10000:
            raise ValueError('The source outline exceeds 10000 elements.')
    if code:
        elements.append({'type': 'code', 'text': '\n'.join(code)})
    return elements
