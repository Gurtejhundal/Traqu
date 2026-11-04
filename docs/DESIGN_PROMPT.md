# Traqu — reusable design and motion prompt

Copy the brief below when asking a designer or coding agent to extend Traqu.

> Work inside the existing Traqu project: React/Vite, FastAPI, and an Electron desktop shell for Linux, Windows, and macOS. Inspect the existing screens, tokens, components, and real app behavior before editing. Preserve the exact name **Traqu**, the established white-and-ink identity, and the working roadmap workflow.
>
> Make the experience feel precise, fluid, and thoughtfully crafted, with the quality of Apple interaction design and an original identity of its own. Motion should be noticeable enough to give the app life, quiet enough for hours of focused reading, and consistently tied to something the user just did.
>
> Use warm white surfaces, charcoal typography, hairline borders, generous but useful spacing, restrained rounded controls, and a small forest-green accent. Keep strong hierarchy and readable task content. Avoid generic dashboard decoration, neon gradients, excessive glass, bouncing panels, scroll tricks, constant floating, giant mascots, sounds, confetti, and animations that delay interaction.
>
> The original companion is **Qu**, a small folded-paper creature with ink eyes, little feet, and a green detail. Use the actual asset in `frontend/public/characters/qu.png`. Give Qu a supporting role in empty libraries, import/loading states, and completed plans. Its movement should suggest attention and a little encouragement. Keep it away from dense task rows and never cover text, controls, or errors. Treat GitHub's distinctive mascot identity as a quality reference, without copying Octocat or another existing character.
>
> Build a coherent motion system: short fade-and-rise page arrivals, a gentle departure before navigation, spring-like press feedback, subtle menu reveals, smooth progress changes, and a short capped stagger for newly displayed document rows. Use roughly 140–240 ms for routine feedback and 300–450 ms for an occasional character response. Keep translation small, scale changes within a few percent, and spring damping high enough to settle quickly. Do not animate every list row indefinitely or replay celebrations on unrelated rerenders.
>
> Prefer transform and opacity, lazy-load expensive features, keep the app offline-capable, and test large roadmaps. Respect `prefers-reduced-motion` in both CSS and JavaScript: replace physical movement with brief fades and stop character loops. Preserve visible keyboard focus, accessible names, native form behavior, adequate contrast, and stable layouts.
>
> Preserve functional guarantees: desktop navigation contains Library and New; website-only downloads/agent pages stay out of the app. Imports have a review step with editable titles and explicit warnings. Keep checked tasks checked, recurring tasks intact, supplied assignments trackable, and source context available. Never invent missing dates, weeks, or exercises. Preserve stable task/section/block identities, reject stale structural saves, and keep JSON backup/restore reliable. Presentation exports must include dates and use Unicode-capable text rendering. Hosted browser identity must come from the server, with durable storage configured; public owner headers are not authentication.
>
> Implement the change in this repository, test the actual flows, capture before/after screens at matching viewport sizes, verify normal and reduced motion, and report what changed and any remaining limitations. Do not replace the project with a generic template, claim untested OS performance, or publish before the relevant checks pass.

## Current motion implementation

- `frontend/src/components/MotionUI.jsx`: Motion provider, route enter/exit, and the Qu component.
- `frontend/src/index.css`: press/hover responses, document-row arrivals, surface reveals, and reduced-motion rules.
- Routine spring: stiffness 420, damping 36, mass 0.85. Route travel: 8 px on arrival, 4 px on departure, 220 ms easing. Document-row stagger: 28 ms, capped after the first eight intervals.
- The loading character moves for three short cycles, then rests. It does not run an idle animation forever.
- Qu is decorative; meaningful status remains visible as text. UI controls use the existing Lucide icon set.

## Mascot asset provenance

Qu was generated with the built-in Image Gen tool and copied into this repository as `frontend/public/characters/qu.png`. The original generated file is retained separately. This is an original project character, not an Octocat or Fitbit character adaptation.

Generation prompt:

```text
Create one original mascot asset for Traqu, a minimalist desktop roadmap app. Asset only, transparent background, full body centered with generous transparent padding. A charming small origami-paper creature called Qu: rounded ivory folded paper body, one slightly folded upper corner, soft charcoal ink outlines, two expressive dark oval eyes, tiny rounded charcoal feet, a short curved arm raised in a restrained friendly wave, a subtle tiny green checked-paper detail. Memorable silhouette, tactile matte paper with very subtle dimensional shading, premium editorial character design, crisp and readable at 80px tall. Adult productivity companion, playful but sophisticated, warm and calm, inspired by the idea of an ownable developer-tool mascot without resembling GitHub Octocat, any cat, Fitbit characters, Apple characters, or existing branded characters. White-and-ink palette, single muted forest green accent, no neon, no gradient background, no text, no letters, no app icon, no UI, no frame, no scenery. Landscape transparent composition suitable for a 160px wide by 140px tall empty-state slot, character at 70 percent image height.
```
