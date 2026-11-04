---
name: traqu-roadmaps
description: Create daily roadmaps, study schedules, and task plans that import accurately into Traqu as JSON, Markdown, or selectable-text PDFs. Use when the user wants a plan for Traqu or requests its interchange format.
---

# Plans you can start one day at a time

Respect the user's subject, available time, dates, and format. Do not invent dates, completed work, deadlines, or guaranteed outcomes. Traqu is a daily consistency tool: a week is a folder, a day is a session, and each checkbox is a real action.

## Daily structure is required for schedules

Organize a roadmap as **Week 1 → Day 1, Day 2 …**, then Week 2 and its days. Use explicit `Day N` headings and globally increasing day numbers. Every scheduled action belongs to one day. Give each day a manageable workload, a clear outcome, and all the context needed to begin. Do not put a whole week's actions in one flat section. If the user requests a non-scheduled reference checklist, preserve that intention instead of inventing a daily schedule.

Use confirmed dates as ISO `YYYY-MM-DD` in the day label and task date fields. If the starting date is unknown, use `Week 1 / Day 1` and omit date fields; do not guess. A scheduled rest/review day should have an explicit, honest action such as “Take the planned recovery day”; never invent checked tasks or activity history. Explain the planned cadence and recovery days.

## Prefer a JSON file

Use [roadmap-example.json](https://traqu.vercel.app/agents/roadmap-example.json). The root has `tasks` and optionally `document`. Each task has:

- `title`: one actionable task, without checkbox or metadata prefixes.
- `timeframe`: the same distinct day label for all actions on that day, e.g. `Week 1 / Day 1 · 2026-11-04`.
- `granularity`: `day` for daily sessions, including undated sessions.
- `start_date` and `end_date`: the same confirmed ISO date for that day; omit both when unknown.
- `is_done`: false, unless the user explicitly says the task is already done.
- `properties`: a dictionary including `Week` (e.g. `Week 1: Foundations`) and `Day` (e.g. 1). Store Time, Duration, Timezone, Priority, Optional, links, and status here. Use `Optional: "Yes"` for optional work. These are context, not reminders.
- `blocks`: supporting notes, code, resources, and completion evidence. A note is `{"type":"note","data":{"text":"Done when a clean checkout works."},"position":0}`.

Do not include database IDs. Put general explanations in root `document` heading/paragraph elements. Task-specific explanations belong in that task's blocks. Never manufacture separate checkboxes for Time, Duration, Priority, Optional, Status, links, LeetCode references, or explanatory paragraphs. One task may have several note blocks.

## Markdown / plain text

Use week headings followed by explicit day headings. See [roadmap-example.md](https://traqu.vercel.app/agents/roadmap-example.md).

```markdown
# Week 1: Foundations
## Day 1 · 2026-11-04
- [ ] Set up the workspace
Time: 19:00-19:30 | Duration: 30m | Priority: High
Done when the setup works from a clean checkout.
## Day 2 · 2026-11-05
- [ ] Build and verify a small feature
Duration: 45m
Run it, capture the result, and write down one lesson.
```

Each checkbox is an action. Following metadata and paragraphs are context for that action, up to the next action/day. Keep unrelated reference material outside the daily checklist. Indented checkbox subtasks should be independently actionable; explanatory bullets should be plain paragraphs instead.

## PDF layout

Deliver a selectable-text PDF plus a matching JSON sidecar for reliable import. Use explicit `Week N` and `Day N · YYYY-MM-DD` headings. Repeat day headings after page breaks when needed. Keep a whole day together where practical. Avoid image-only text, merged cells, rotated labels, and decorative page-sized borders. Embed fonts and inspect rendered pages for clipping/overlap.

For tables, use one real action per Task row, with separate Day/Date and Time/Duration columns. Repeat column headers across page breaks. For day cards, put the explicit day heading first, then checkbox actions and their supporting details. Reference schedules and aggregate targets should be labelled separately.

## Check before delivery

Validate JSON, dates, globally ordered day numbers, week membership, and daily workload against the user's time. Count days and actual actions; metadata must not inflate that count. Inspect Day 1, the last day, week/month/year transitions, rest days, wrapped lines, and page breaks. Verify PDF/Markdown and JSON describe the same days, actions, and dates. Explain ambiguities and keep source context rather than guessing. Recommend importing the JSON sidecar.
