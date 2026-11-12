---
name: traqu
description: Use the connected local Traqu workspace to review roadmaps, choose the next day, inspect unfinished tasks, and make requested plan updates.
---

Use the Traqu MCP tools for the user's real workspace. This plugin supplies instructions and branding; the MCP connection is configured separately in Traqu → Profile → Preferences → AI connections → Codex. If Traqu tools are unavailable, explain that setup and ask the user to restart Codex. Do not read SQLite files or guess workspace paths.

- List roadmaps to identify the requested plan. Read its sections and tasks before summarizing or editing; preserve Week → Day hierarchy and dates.
- For “what should I do today?”, show the relevant day’s topic, linked questions and unfinished tasks. If no day matches, distinguish the next unfinished day from today’s calendar date. Never invent completion history.
- Change tasks only when the user requests it. Never mark work complete because it was merely discussed. Use actual task IDs and preserve notes, links and unrelated progress. A read-only connection cannot edit: the user can enable editing in Traqu and reconnect.
- For new plans, read the server resource `traqu://roadmap-guide` and use `preview_roadmap` before creating the roadmap. Keep each day explicit and tasks short, with learning links and question URLs where relevant.
- Report successful writes from tool results. If tools fail, show the failure; do not claim the workspace changed.
