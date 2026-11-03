---
name: traqu-roadmaps
description: Create roadmaps, study schedules, and task plans that import accurately into Traqu as JSON, Markdown, or selectable-text PDFs. Use when the user wants a plan for Traqu or requests its interchange format.
---

# Plans that survive import

Respect the user's subject, available time, dates, and chosen format. Do not invent dates, completed work, deadlines, or guaranteed outcomes. If dates are unknown, use a named section and omit dates.

## Choose a representation

Prefer JSON when preserving dates, optional work, time slots, notes, and completion state matters. Deliver a human-readable PDF alongside a matching JSON sidecar when the user wants a polished PDF. Traqu's importer is deterministic and layout-aware; this contract is not a trained-model API or a guarantee for arbitrary PDFs.

Use [roadmap-example.json](https://traqu.vercel.app/agents/roadmap-example.json) as the supported interchange shape. The root contains `tasks` and optionally `document`. Each task has:

- `title`: one actionable task, without a checkbox or metadata prefix.
- `timeframe`: a consistent section/day label shared by tasks in that section.
- `granularity`: `day` for dated daily plans, otherwise `section`.
- `start_date` and `end_date`: real `YYYY-MM-DD` dates, omitted when unknown.
- `is_done`: a JSON boolean; default false.
- `properties`: a dictionary for Time, Duration, Timezone, Priority, Optional, and other context. Use `Optional: "Yes"` for optional work. Time slots are metadata, not reminders or notifications.
- `blocks`: a list; a note is `{"type":"note","data":{"text":"completion evidence or explanation"},"position":0}`.

Use distinct labels for distinct date ranges. Do not include database IDs. Keep general explanations in the root `document`, as heading/paragraph elements, separate from tasks. Preserve code, links and notes as context rather than manufacturing tasks from them.

## Markdown / plain text

Use explicit section headings and one `- [ ] Task` or `- [x] Task` per line. See [roadmap-example.md](https://traqu.vercel.app/agents/roadmap-example.md). A heading with exactly one valid ISO date sets that section's calendar date. JSON preserves richer metadata; Markdown time strings remain readable text.

## PDF layout

Generate selectable text, not screenshots of text. Use embedded fonts, readable contrast, and sufficient space for wrapped task text. Inspect rendered pages for clipping and overlapping text.

For checklists, use a clear `Task` column with one task per row and separate metadata columns. Repeat column headers after a page break. Avoid merged cells, rotated labels, and page-sized decorative rectangle borders: these can confuse table detection.

For weekly daily planners, include a header such as `02 Nov 2026 - 08 Nov 2026`, a `DAY / DATE` left column and a `TIME (IST) / TASK / DURATION` column. Each day has weekday, date, and optionally `Day N`. Write each time slot as `19:00-19:30 (30m) Action`; use a new line for each slot and prefix optional slots with `OPTIONAL`. For single-day cards, use `DAY 1 - MONDAY, 02 NOV 2026`, then timed task titles with supporting notes below. Reference schedules and aggregate targets should be labelled separately from actionable tasks.

## Check before delivery

Validate JSON syntax and ISO dates. Count intended actionable time slots/tasks and compare that with the delivered output. Check the first and last day, month/year transitions, optional tasks, wrapped lines, and page breaks. Ensure PDF and JSON task counts and dates agree. Say when an input is ambiguous; preserve its source rather than guessing. Import the JSON sidecar for the most reliable result.
