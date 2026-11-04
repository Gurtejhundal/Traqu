"""Read day-row problem assignments without mistaking the first action for a heading."""
from datetime import date, timedelta
import re

MONTHS = {name: index + 1 for index, name in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
)}
DAY = re.compile(r"^DAY\s+(\d+)\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(\d{1,2})\s+([A-Za-z]+)\b(.*)", re.I)
DATE = re.compile(r"\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})\b")
PROBLEM = re.compile(r"#(\d+)\s+(.+?)(?=\s+#\d+\s+|$)")


def parse_assignment_plan(text):
    if not re.search(r"LEETCODE ASSIGNMENTS", text, re.I):
        return None
    lines = text.splitlines()
    if sum(bool(DAY.match(line)) for line in lines) < 2:
        return None
    tasks = []
    bounds = []
    week = ""
    day = None
    active = False
    pending = ""

    def append_problem(value):
        if day is None:
            return
        for problem in PROBLEM.finditer(value):
            title = problem[2].strip()
            pattern = re.search(r"\s*\[([^\]]+)\]\s*$", title)
            properties = {"LeetCode ID": problem[1]}
            if pattern:
                properties["Pattern"] = pattern[1]
                title = title[:pattern.start()].strip()
            item = {"title": f"#{problem[1]} {title}", "timeframe": day["label"],
                    "is_done": False, "granularity": "day" if day["date"] else "section",
                    "properties": properties}
            if day["date"]:
                item.update(start_date=day["date"], end_date=day["date"])
            tasks.append(item)

    for line in lines:
        line = line.strip()
        if re.match(r"^WEEK\s+\d+\s*/", line, re.I):
            if pending:
                append_problem(pending)
                pending = ""
            match = re.match(r"^WEEK\s+(\d+)", line, re.I)
            week = f"Week {int(match[1])}"
            bounds = []
            for value in DATE.finditer(line):
                try:
                    bounds.append(date(int(value[3]), MONTHS[value[2][:3].lower()], int(value[1])))
                except (ValueError, KeyError):
                    pass
            day = None
            active = False
            continue
        match = DAY.match(line)
        if match:
            if pending:
                append_problem(pending)
                pending = ""
            candidates = []
            if len(bounds) >= 2 and 0 <= (bounds[1] - bounds[0]).days <= 6:
                candidates = [bounds[0] + timedelta(days=n) for n in range((bounds[1] - bounds[0]).days + 1)]
                candidates = [value for value in candidates if value.day == int(match[3])
                              and value.month == MONTHS.get(match[4][:3].lower())
                              and value.strftime('%a').lower() == match[2].lower()]
            iso = candidates[0].isoformat() if len(candidates) == 1 else None
            label = f"{week} / Day {int(match[1])}" + (f" · {iso}" if iso else f" · {match[3]} {match[4]}")
            day = {"label": label, "date": iso}
            active = True
            line = match[5].strip()
            if "CONTEST" in line.upper():
                contest = {"title": "Timed contest", "timeframe": label, "is_done": False,
                           "granularity": "day" if iso else "section", "properties": {"Type": "Contest"}}
                if iso:
                    contest.update(start_date=iso, end_date=iso)
                tasks.append(contest)
        if re.match(r"^(DAILY CONCEPT|CS FOCUS|PROJECT EVIDENCE|WEEKLY GATE|SDE 400|LeetCode lookup|Core question range)\b", line, re.I):
            if pending:
                append_problem(pending)
                pending = ""
            active = False
        if not active:
            continue
        if re.search(r"#\d+\s+", line):
            if pending:
                append_problem(pending)
            pending = line[line.index('#'):]
        elif pending and line and line.upper() not in {"NEW", "CONTEST + 1"}:
            pending += " " + line
        if pending and pending.rstrip().endswith(']'):
            append_problem(pending)
            pending = ""
    if pending:
        append_problem(pending)
    return tasks or None


def assignment_warnings(text, tasks):
    if not re.search(r"LEETCODE ASSIGNMENTS", text, re.I):
        return []
    warnings = []
    weeks = {int(value) for value in re.findall(r"^WEEK\s+(\d+)\s*/", text, re.M | re.I)}
    total = max((int(value) for value in re.findall(r"^WEEK\s+\d+\s*/\s*(\d+)", text, re.M | re.I)), default=0)
    if total and len(weeks) < total:
        missing = ', '.join(map(str, sorted(set(range(1, total + 1)) - weeks)))
        warnings.append(f"The source contains {len(weeks)} of {total} weeks. Missing weeks: {missing}. No missing work was invented.")
    unique = {task.get('properties', {}).get('LeetCode ID') for task in tasks} - {None}
    promised = re.search(r"\b(\d+)\s+(?:core\s+)?unique\s+LeetCode", text, re.I)
    if promised and len(unique) < int(promised[1]):
        warnings.append(f"The source promises {promised[1]} unique problems but supplies {len(unique)}. Only supplied assignments are imported.")
    return warnings
