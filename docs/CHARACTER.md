# Qu — Traqu’s little companion

Qu is an original monochrome ink creature: soft rounded body, asymmetric ears, bright eyes, small arms and feet, and a little tail curl. Its personality comes from Traqu’s promise of small, steady progress. It is neither a letter-shaped logo nor a paper/document character.

## Interaction

- Hover: a short greeting when resting.
- Click / Enter / Space: a small hop.
- Double-click / R / arrow keys: a short run there and back; Left starts in the opposite direction.
- S: sway. W: wave. Escape: stay steady until another explicit interaction.
- At rest: an occasional blink, with a gentle sway every third interval. No continuous idle loop.
- Loading: three running cycles, then rest. Completion: a greeting.
- Hidden tabs, unfocused windows, and offscreen characters pause. Reduced motion keeps a steady pose even when activated.

Qu stays in reserved space in empty/import/completion states. A 48px version sits beside workspace status on open plans and editors; the compact website navbar hides it where space is limited. Buttons have keyboard instructions, a visible focus indicator, and no form-submit behavior. No external requests, accounts, or persistence are needed for the character.

## Assets and provenance

`frontend/public/characters/qu-sprites.png` is a generated transparent 1536 × 1024 PNG with 6 columns × 4 rows: idle/blink, run, sway, and greeting. The app uses discrete CSS sprite frames and small transform responses. The original generated file is retained under the Codex generated-images folder. `docs/readme/qu.gif` is a capture of the real in-app animation.

Created with the built-in ImageGen tool. The original paper design was replaced at the user’s request. This is an original character; it does not reuse a Codex pet, Octocat, or another product’s mascot.

Exact generation prompt:

```text
Design Qu, the original living companion for Traqu, an understated app that helps people turn big plans into small steady steps. The character should feel like the personality of Traqu itself: sincere, curious, quietly encouraging, a little playful. Not a logo with a face. No letter T or other lettering, no paper, no document, no origami, no robot, no props, no green or other colours. Strict black, white, neutral greys. A cute organic ink creature: compact softly rounded slightly pear-shaped charcoal body, a distinctive pair of asymmetrical small rounded ear nubs (one perked, one gently drooping), bright expressive white oval eyes with tiny dark pupils, small cheek contours, a tiny friendly smile, little mitten arms, short rounded feet that clearly take little steps. One tiny curl at the back gives a sense of a path followed. An ownable simple silhouette, genuine warmth, tasteful premium 2D cartoon, crisp hand-ink edges and very subtle neutral shading, readable at 64px. Original identity. Do NOT resemble or copy Codex pets, Octocat, Moomin, or any existing mascot.

Deliver a transparent-background PRODUCTION ANIMATION SPRITE SHEET, exactly 6 equal square columns by 4 equal square rows, total canvas ratio 3:2, 24 poses of THE SAME character. Equal spacing matters. Character centered identically within each cell, same scale, feet aligned to consistent baseline, character occupies about 62% cell height with generous transparent padding. Each cell is fully separate. No drawn grid, no labels, no text, no ground, no shadows outside the character, no scene.

Row 1 top: 6 frames of steady front-facing idle/blink, eyes open, open, half-blink, closed, half-open, open. Relaxed warm expression, slight breathing only.
Row 2: 6 successive RUN CYCLE frames facing right. Clear alternating arm and foot positions with contact, down, passing, up, contact, passing. Body remains the same size and anchored at same center. Real changing legs, not identical copies.
Row 3: 6 front-facing SWAY frames: lean left, slight left, upright, slight right, lean right, upright. Arms balance gently.
Row 4 bottom: 6 friendly WAVE frames front-facing, right mitten low, rising, raised, wave left, wave right, resting again.

Keep the design beautiful, sincere and charming. Traqu is quiet white-and-ink, generous space, thoughtful motion. This small character should feel like a loyal little partner for getting things done, not a cartoon advertisement. Transparent PNG sprite sheet only.
```
