<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/readme/hero.png">
    <img src="docs/readme/hero.gif" alt="Traqo — big plans, small steady wins. A gently animated roadmap illustration in Traqo’s white-and-ink design." width="1200">
  </picture>
</p>

<p align="center"><b>your next chapter, one checkbox at a time.</b><br>Turn a PDF, a Word document, or that very ambitious pasted plan into a roadmap you can actually follow.</p>

<p align="center">
  <a href="#get-the-app"><b>↓ Get the app</b></a> &nbsp; · &nbsp;
  <a href="#see-it-in-action"><b>See it in action</b></a> &nbsp; · &nbsp;
  <a href="#run-from-source"><b>Run from source</b></a> &nbsp; · &nbsp;
  <a href="#support-the-next-update"><b>The side quest 🎮</b></a>
</p>

<p align="center"><code>Linux · Windows · macOS</code> &nbsp; <code>offline ready</code> &nbsp; <code>no account</code> &nbsp; <code>saved on your computer</code></p>

---

## From “saved for later” to “done.”

The study plan is in a PDF. The project roadmap is in a chat. The next step is somewhere on page 37.

**Traqo gives the plan a place to live.** Import it, keep its sections and useful context, then work through one clear area at a time. Check something off. Add a note. Come back tomorrow with your progress still there.

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="docs/readme/flow.png">
  <img src="docs/readme/flow.gif" alt="Illustrated workflow: import a plan, focus on a section, and save your progress locally." width="1200">
</picture>

<sub>The animations above illustrate the workflow. The desktop captures below show the real app.</sub>

## Get the app

| Your computer | Pick this build |
| --- | --- |
| **Linux x64** | AppImage for a portable app, or `.deb` for Debian/Ubuntu |
| **Windows x64** | Setup `.exe` with an install-location chooser |
| **Mac · Apple Silicon** | `macOS-arm64` artifact → `.dmg` or `.zip` |
| **Mac · Intel** | `macOS-x64` artifact → `.dmg` or `.zip` |

<p align="center"><a href="https://github.com/Gurtejhundal/Traqu/actions/workflows/desktop.yml?query=branch%3Amain"><b>↓ Open desktop downloads</b></a></p>

Open a **successful build**, scroll to **Artifacts**, and download the build for your computer. Extract the artifact ZIP to find the installer. GitHub requires sign-in to download artifacts; builds are retained for 30 days.

The installed app includes its Python engine and interface. You can use it offline without installing Python or Node.js. Builds are currently unsigned; signing and Apple notarization are not configured yet.

## See it in action

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/screenshots/roadmap.png">
    <img src="docs/screenshots/desktop-demo.gif" alt="Real Traqo desktop walkthrough: paste a roadmap, import its sections, complete tasks, and return to the library." width="1080">
  </picture>
</p>

<p align="center"><sub>Real Electron captures · sample plans · no personal workspace data</sub></p>

<table>
  <tr><th>Your plans, together</th><th>One section, in focus</th></tr>
  <tr>
    <td valign="top"><a href="docs/screenshots/library.png"><img src="docs/screenshots/library.png" alt="Traqo library with three sample roadmaps and completion progress" width="460"></a></td>
    <td valign="top"><a href="docs/screenshots/roadmap.png"><img src="docs/screenshots/roadmap.png" alt="A focused roadmap section with contents navigation, saved checkmarks, and progress" width="460"></a></td>
  </tr>
</table>

<details>
<summary>Take a closer look at importing a plan</summary>

![Paste a roadmap or upload a document](docs/screenshots/import.png)

</details>

## A little less friction. A little more follow-through.

| When your plan looks like… | Traqo helps you… |
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

Native menus also provide clipboard actions, zoom, full-screen mode, and PDF/Word save dialogs. Traqo remembers your window size between launches.

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
- Traqo is a personal, single-user workspace. The local owner key is not multi-user authentication.
- The desktop workspace starts separately from an existing web database; the [migration instructions](docs/DESKTOP.md#local-data-and-migration) explain how to preserve existing progress.
- This version does not include cloud sync, automatic updates, or application-level database encryption.

</details>

## Support the next update

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/readme/support.png">
    <img src="docs/readme/support.gif" alt="An animated controller for an optional side quest: support Traqo’s next update and the console fund." width="960">
  </picture>
</p>

If Traqo helps you turn a plan into progress, you can help fuel the next update—or the ongoing PS5 side quest. Support is completely optional, and a GitHub star is appreciated too.

<p align="center">
  <a href="docs/readme/upi-qr.png"><img src="docs/readme/upi-qr.png" alt="UPI payment QR for Gurtejbir Singh, reused unchanged from the .cnote README" width="205" height="205"></a><br>
  <b>Scan with a UPI app · any amount helps.</b><br>
  <sub>Gurtejbir Singh · <code>gurtejbir.29107@okhdfcbank</code></sub>
</p>

---

<p align="center"><b>Traqo</b> — plan. focus. follow through.<br><sub>Made by <a href="https://github.com/Gurtejhundal">Gurtejbir Singh</a> · your plans, at your pace.</sub></p>
