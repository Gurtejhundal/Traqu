# Traqu — reusable design and motion prompt

Copy the brief below when asking a designer or coding agent to extend Traqu.

> Work inside the existing Traqu project: React/Vite, FastAPI, and an Electron desktop shell for Linux, Windows, and macOS. Inspect the existing screens, tokens, components, and real app behavior before editing. Preserve the exact name **Traqu**, the established white-and-ink identity, and the working roadmap workflow.
>
> Make the experience feel precise, fluid, and thoughtfully crafted, with the quality of Apple interaction design and an original identity of its own. Motion should be noticeable enough to give the app life, quiet enough for hours of focused reading, and consistently tied to something the user just did.
>
> Use warm white surfaces, charcoal typography, hairline borders, generous but useful spacing, restrained rounded controls, and a small forest-green accent. Keep strong hierarchy and readable task content. Avoid generic dashboard decoration, neon gradients, excessive glass, bouncing panels, scroll tricks, constant floating, giant mascots, sounds, confetti, and animations that delay interaction.
>
> The original companion is **Qu**, a cute monochrome ink creature with asymmetric ears, bright eyes, little feet, and a tail curl. It embodies small, steady progress, with no letter-shaped logo or paper body. Use `frontend/public/characters/qu-sprites.png`: idle/blink, run, sway, and wave poses. Give it short hover, click, double-click, and keyboard reactions with quiet rests. Keep the character in reserved space and never cover text, controls, or errors. Preserve its original identity without copying another product's pet.
>
> Build a coherent motion system: short fade-and-rise page arrivals, a gentle departure before navigation, spring-like press feedback, subtle menu reveals, smooth progress changes, and a short capped stagger for newly displayed document rows. Use roughly 140–240 ms for routine feedback and 300–450 ms for an occasional character response. Keep translation small, scale changes within a few percent, and spring damping high enough to settle quickly. Do not animate every list row indefinitely or replay celebrations on unrelated rerenders.
>
> Prefer transform and opacity, lazy-load expensive features, keep the app offline-capable, and test large roadmaps. Respect `prefers-reduced-motion` in both CSS and JavaScript: replace physical movement with brief fades and stop character loops. Preserve visible keyboard focus, accessible names, native form behavior, adequate contrast, and stable layouts.
>
> Preserve functional guarantees: desktop navigation contains Library and New; website-only downloads/agent pages stay out of the app; a compact skill disclosure lives below the import source controls. Imports have a review step with editable titles and explicit warnings. Keep checked tasks checked, recurring tasks intact, supplied assignments trackable, and source context available. Never invent missing dates, weeks, or exercises. Preserve stable task/section/block identities, reject stale structural saves, and keep JSON backup/restore reliable. Presentation exports must include dates and use Unicode-capable text rendering. Hosted browser identity must come from the server, with durable storage configured; public owner headers are not authentication.
>
> Implement the change in this repository, test the actual flows, capture before/after screens at matching viewport sizes, verify normal and reduced motion, and report what changed and any remaining limitations. Do not replace the project with a generic template, claim untested OS performance, or publish before the relevant checks pass.

## Current motion implementation

- `frontend/src/components/MotionUI.jsx`: Motion provider, route enter/exit, and the Qu component.
- `frontend/src/index.css`: press/hover responses, document-row arrivals, surface reveals, and reduced-motion rules.
- Routine spring: stiffness 420, damping 36, mass 0.85. Route travel: 8 px on arrival, 4 px on departure, 220 ms easing. Document-row stagger: 28 ms, capped after the first eight intervals.
- The loading character runs for three short cycles, then rests. Idle blinks and sways are sparse; offscreen/unfocused windows pause. Escape rests; reduced motion keeps a steady pose.
- Qu is an accessible interactive companion button. Meaningful app status remains visible as text. UI controls use the existing Lucide icon set.

## Mascot asset provenance

See [Character design, interaction, and exact ImageGen prompt](CHARACTER.md). The sprite asset and captured README animation are included in the repository.
