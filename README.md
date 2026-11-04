<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/readme/hero.png">
    <img src="docs/readme/hero.gif" alt="Traqu — big plans, small steady wins. A gently animated roadmap illustration in Traqu’s white-and-ink design." width="1200">
  </picture>
</p>

<p align="center"><b>your next chapter, one checkbox at a time.</b><br>Turn a PDF, a Word document, or that very ambitious pasted plan into a roadmap you can actually follow.</p>

<p align="center">
  <a href="#get-the-app"><b>↓ Get the app</b></a> &nbsp; · &nbsp;
  <a href="#see-it-in-action"><b>See it in action</b></a> &nbsp; · &nbsp;
  <a href="#run-from-source"><b>Run from source</b></a> &nbsp; · &nbsp;
  <a href="#buy-me-a-coffee"><b>Buy me a coffee ☕</b></a>
</p>

<p align="center"><code>Linux · Windows · macOS</code> &nbsp; <code>offline ready</code> &nbsp; <code>no account</code> &nbsp; <code>saved on your computer</code></p>

---

## From “saved for later” to “done.”

The study plan is in a PDF. The project roadmap is in a chat. The next step is somewhere on page 37.

**Traqu gives the plan a place to live.** Import it, keep its sections and useful context, then work through one clear day at a time. Open a week, choose a dated day, and start its checklist. Check something off. Add a note. Come back tomorrow with your progress still there.

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="docs/readme/flow.png">
  <img src="docs/readme/flow.gif" alt="Illustrated workflow: import a plan, focus on a section, and save your progress locally." width="1200">
</picture>

<sub>The animations above illustrate the workflow. The desktop captures below show the real app.</sub>

## Get the app

| Your computer | Direct download |
| --- | --- |
| <img src="frontend/public/os/windows.svg" width="16" height="16" alt=""> **Windows x64** | [Setup .exe](https://github.com/Gurtejhundal/Traqu/releases/latest/download/Traqu-Windows-x64.exe) |
| <img src="frontend/public/os/linux.svg" width="16" height="16" alt=""> **Linux x64** | [AppImage](https://github.com/Gurtejhundal/Traqu/releases/latest/download/Traqu-Linux-x64.AppImage) · [Debian / Ubuntu .deb](https://github.com/Gurtejhundal/Traqu/releases/latest/download/Traqu-Linux-x64.deb) |
| <img src="frontend/public/os/apple.svg" width="16" height="16" alt=""> **Mac · Apple Silicon** | [DMG](https://github.com/Gurtejhundal/Traqu/releases/latest/download/Traqu-macOS-arm64.dmg) · [ZIP](https://github.com/Gurtejhundal/Traqu/releases/latest/download/Traqu-macOS-arm64.zip) |
| <img src="frontend/public/os/apple.svg" width="16" height="16" alt=""> **Mac · Intel** | [DMG](https://github.com/Gurtejhundal/Traqu/releases/latest/download/Traqu-macOS-x64.dmg) · [ZIP](https://github.com/Gurtejhundal/Traqu/releases/latest/download/Traqu-macOS-x64.zip) |

<p align="center"><a href="https://traqu.vercel.app/downloads"><b>↓ Desktop download guide</b></a> &nbsp; · &nbsp; <a href="https://github.com/Gurtejhundal/Traqu/releases/latest"><b>Release notes &amp; checksums</b></a></p>

Download directly: no Actions artifact ZIP or GitHub sign-in required. Releases stay available after temporary CI artifacts expire. Each release publishes only after source and packaged-app tests pass on all four native targets.

**Install:** run the Windows setup; on Mac, open the DMG and drag Traqu to Applications; on Debian/Ubuntu install the DEB with your package manager. For AppImage, enable execution in file properties (or `chmod +x Traqu-Linux-x64.AppImage`) and open it. AppImage may need FUSE 2 from your distribution.

The desktop app includes its Python engine and interface, works offline, and saves to your computer. Baselines: Windows 10/11 x64, macOS 13+ (Intel or Apple Silicon), and Linux x64 builds made on Ubuntu 22.04. Linux/Windows ARM installers are not available yet.

Builds are **unsigned**: Windows may show SmartScreen and macOS may require approval under System Settings → Privacy & Security. Signing and Apple notarization are not configured. See [Electron platform support](https://github.com/electron/electron#platform-support) and the [macOS 13 minimum introduced in Electron 44](https://www.electronjs.org/blog/electron-44-0).

## Plan with an AI agent

[Open the agent guide](https://traqu.vercel.app/agents) · [Download SKILL.md](frontend/public/agents/SKILL.md) · [JSON template](frontend/public/agents/roadmap-example.json) · [Markdown template](frontend/public/agents/roadmap-example.md)

Give your agent a daily format: Week → Day, one action per checkbox, and dates only when confirmed. Keep timing, optional work, links, and notes attached to their actions. JSON preserves the most detail; a selectable-text PDF can accompany it. Traqu uses a deterministic, layout-aware parser, not a trained language model. The skill describes formats covered by regression tests.

<img src="docs/screenshots/agents.png" alt="Traqu agent guide with a downloadable skill, copyable prompt and JSON example." width="1080">

Dated daily planners now keep individual time slots, weekly context, durations, optional status, and source-page references. On the supplied private 40-page benchmark: **724 timed tasks across all 212 dates**, including 56 optional tasks. The original file is not published. See [parser evaluation and limits](docs/PDF_IMPORT.md).

## One day at a time

**Week folders → dated day cards → today’s checklist.** Start Day 1, keep its instructions beside each action, and move on when you’re ready. Completed day cards fade and their titles cross out. You can revisit or reopen any day.

<img src="docs/screenshots/daily-completion.png" alt="Traqu daily plan with expandable week folders, dated day cards, a faded completed first day, and Start Day 2" width="1080">

**Your corner of Traqu** keeps your name, bio, goal, timezone, week start, task spacing, and motion preferences together. A GitHub-style contribution calendar records real completions; select a date to see that day’s work, or replay the snake’s path through your activity.

<img src="docs/screenshots/profile.png" alt="Traqu profile with goal, current and longest streaks, yearly contribution calendar, and snake replay" width="1080">

History starts with completions recorded in this version. Imported checkmarks do not fabricate past activity. Same-day undo removes the task’s credit; reopening later keeps the earlier record. Workspace backups include profile and history; restoring keeps an existing profile and merges history by event identity.

For an older flat import whose saved source contains explicit day headings and checkboxes, choose **Preview daily copy → Create daily copy**. Review the day/action counts first. Matching titles keep their completion state and notes in source order; unmatched custom rows remain in the original plan. The original roadmap and full source stay available.

## See it in action

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/screenshots/roadmap.png">
    <img src="docs/screenshots/desktop-demo.gif" alt="Real Traqu desktop walkthrough: paste a roadmap, import its sections, complete tasks, and return to the library." width="1080">
  </picture>
</p>

<p align="center"><sub>Real Electron captures · sample plans · no personal workspace data</sub></p>

<table>
  <tr><th>Your plans, together</th><th>One section, in focus</th></tr>
  <tr>
    <td valign="top"><a href="docs/screenshots/library.png"><img src="docs/screenshots/library.png" alt="Traqu library with three sample roadmaps and completion progress" width="460"></a></td>
    <td valign="top"><a href="docs/screenshots/roadmap.png"><img src="docs/screenshots/roadmap.png" alt="A focused roadmap section with contents navigation, saved checkmarks, and progress" width="460"></a></td>
  </tr>
</table>

<details>
<summary>Take a closer look at importing a plan</summary>

![Paste a roadmap or upload a document](docs/screenshots/import.png)

</details>

## A little less friction. A little more follow-through.

| When your plan looks like… | Traqu helps you… |
| --- | --- |
| A long PDF, DOCX, or pasted chat response | Import it into sections and tasks |
| Weeks, phases, sprints, or several parallel tracks | Keep a structure you can navigate |
| Notes, tables, code, and supporting material | Keep useful context with the roadmap |
| Too much to look at all at once | Choose a section and focus on the next step |
| “I should probably revisit this” | Add notes, checklists, counters, bookmarks, labels, or due dates |
| A plan you want to take elsewhere | Export to PDF or Word |
| Something you want to keep to yourself | Work locally, with no account or hosted sign-in |

**Your work stays on your computer.** The desktop app starts its own private local service and saves roadmaps in SQLite in your OS user-data folder. Updating the app keeps that folder separate from the installed program.

Use **File → Show Data Folder** to find your workspace and **File → Show Logs** for diagnostics. On Linux and Windows, press **Alt** to reveal the menu.

## Small shortcuts. Useful momentum.

| Action | Linux / Windows | macOS |
| --- | --- | --- |
| New roadmap | `Ctrl + N` | `Cmd + N` |
| Back to the library | `Ctrl + Shift + L` | `Cmd + Shift + L` |
| Reload the workspace | `Ctrl + R` | `Cmd + R` |

Native menus also provide clipboard actions, zoom, full-screen mode, and PDF/Word save dialogs. Traqu remembers your window size between launches.

## Run from source

For development, use **Node.js 24** and **Python 3.12**:

```bash
npm ci
npm run setup
npm start
```

Build an installer for your current OS with `npm run dist`. Output goes into `release/`. Each OS and CPU architecture needs its own native build; the desktop workflow handles Linux, Windows, Apple Silicon, and Intel Mac builds.

| Need the details? | Start here |
| --- | --- |
| Desktop architecture, builds, tests, and moving an existing database | [Desktop guide](docs/DESKTOP.md) |
| Run the web app and API separately, or use the Windows browser launcher | [Development guide](docs/DEVELOPMENT.md) |
| Source and regeneration notes for these animations | [README media](docs/readme/README.md) |

React + Vite for the workspace. FastAPI + SQLAlchemy for the import engine. SQLite for local data. Electron for the desktop shell.

<details>
<summary>A few practical limits</summary>

- PDFs need selectable text. Scanned image PDFs need OCR before import.
- Desktop is a private, account-free local workspace. Hosted browser workspaces require signed sessions and durable storage; clearing browser data can remove anonymous access. Export backups.
- The desktop workspace starts separately from an existing web database; the [migration instructions](docs/DESKTOP.md#local-data-and-migration) explain how to preserve existing progress.
- This version does not include cloud sync, automatic updates, or application-level database encryption.

</details>

## A little company for big plans

<p align="center"><img src="docs/readme/qu.gif" width="136" alt="Qu, Traqu’s original monochrome companion, running, waving, and swaying"></p>

Meet **Qu**, a little ink creature for small, steady progress. Click to hop, double-click to run, or use S to sway, W to wave, and Escape to rest. At rest, Qu’s pupils follow the cursor. Short page transitions and gentle press feedback give the workspace a little life, with reduced-motion support. Import review catches incomplete plans before saving; JSON backup/restore and stable editing help keep progress safe.

[Design and motion prompt](docs/DESIGN_PROMPT.md) · [Meet Qu](docs/CHARACTER.md) · [Import, backup, and hosting details](docs/RELIABILITY.md)


## Buy me a coffee

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/readme/support.png">
    <img src="docs/readme/support.gif" alt="A gently animated coffee cup: an optional way to support Traqu." width="960">
  </picture>
</p>

If Traqu makes your day a little easier, you can buy me a coffee. Thanks for supporting the next update. A GitHub star is always welcome too.

<p align="center">
  <a href="docs/readme/upi-qr.png"><img src="docs/readme/upi-qr.png" alt="UPI payment QR for Gurtejbir Singh, reused unchanged from the .cnote README" width="205" height="205"></a><br>
  <b>Scan with a UPI app · coffee is always appreciated.</b><br>
  <sub>Gurtejbir Singh · <code>gurtejbir.29107@okhdfcbank</code></sub>
</p>

---

<p align="center"><b>Traqu</b> — plan. focus. follow through.<br><sub>Made by <a href="https://github.com/Gurtejhundal">Gurtejbir Singh</a> · your plans, at your pace.</sub></p>
