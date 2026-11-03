# PDF import: measured behavior and format contract

Traqu uses pdfplumber geometry, typography and deterministic parsing rules. No learned model was trained or fine-tuned in this update. The agent skill is a generation/import contract; it does not depend on proprietary ChatGPT, Claude or Gemini training data.

## Private planner benchmark

The user-supplied 40-page daily planner covers 2 November 2026 through 1 June 2027. Its original PDF and extracted personal contents are not committed. Baseline main returned zero tasks: page-background rectangles were mistaken for single-column tables that hid the actual planner text.

The updated importer extracts **724 timed tasks**:

- 660 regular time slots in 30 weekly planners;
- 50 explicitly optional planner slots;
- 8 tasks on the final two dated checkpoint pages;
- 6 optional setup tasks, without invented calendar dates.

All **212 calendar dates** are retained. A single time slot can contain multiple exercises; these remain together because the source does not give each exercise an independent time. The total is therefore a count of actionable time slots, not the document's separate DSA exercise target.

Weekly/day labels, time ranges, durations, explicitly stated timezone, optional status and source page are kept as task properties. Single-day card explanations are note blocks. The full source outline is retained separately, including reference schedules and aggregate targets.

Local Linux / Python 3.12 benchmark, one isolated process per run, `/usr/bin/time` peak RSS:

| Importer | Tasks | Peak process RSS | Wall time |
| --- | ---: | ---: | ---: |
| Baseline | 0 | 176,316 KB | 2.06 s |
| Updated with independent column extraction | 724 | 55,908 KB | 3.16 s |

This sample used about **68% less peak memory**, at the cost of additional extraction work. These are local observations on one document, not accuracy percentages or cross-platform performance guarantees. Releasing page caches prevents every page's character/graphics data from remaining resident for the entire import.

## Reproduce

```bash
# Install project test dependencies in the desktop environment first.
TRAQO_PLANNER_PDF=/absolute/path/to/planner.pdf \
PYTHONPATH=backend .venv-desktop/bin/python -m pytest backend/test_pdf_schedule.py -q
```

The private benchmark test is skipped when that environment variable is absent. The committed tests generate synthetic PDFs in memory, covering borderless/shaded layouts, aligned columns, compound time slots, optional work, December/January transitions, final-day cards and supporting notes. An API integration test verifies upload → SQLite timeframes/tasks → export, including dates and metadata. Existing continuation-table, list hierarchy, reference-page, DOCX and round-trip tests remain in the suite.

## Agent-compatible authoring

Use the [downloadable skill](../frontend/public/agents/SKILL.md) and [JSON example](../frontend/public/agents/roadmap-example.json). JSON is the most reliable interchange format; pair it with a readable PDF when presentation matters. Markdown checklists support a single ISO date in each section heading. Rich time-slot metadata is preserved through JSON.

PDF schedules should contain selectable text, explicit week date bounds, a left day/date column and a separate task/time column. Single-day cards should use a full dated `DAY N - MONDAY, 02 NOV 2026` heading. Unknown years, invalid dates and conflicting weekdays are not guessed. Generic task tables and explicit checklists still use the existing parser.

## Limits

Scanned/image-only PDFs need OCR before import; Traqu does not perform OCR. Complex merged cells, irregular layouts, cross-page day rows, ambiguous dates and inconsistent time slots may need manual review or a JSON sidecar. No arbitrary-PDF accuracy guarantee is implied. Resource limits remain: 8 MB upload, 250 pages, 50,000 extracted lines, 25,000 table rows, 5,000 tasks and 10,000 outline elements.

Dates schedule sections; time-slot properties do not create notifications or calendar events. Optional work is labelled and remains a normal task that contributes to task progress. The desktop workspace stores data locally. The web edition uses its configured backend storage and is not equivalent to the private desktop session.
