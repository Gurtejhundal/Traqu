# README media

The README uses Traqo's existing white-and-ink palette, quiet gray surfaces, thin borders, and a small green saved-status accent. The original monogram and checklist treatment follow the desktop interface.

| Asset | Source |
| --- | --- |
| `hero.gif`, `flow.gif`, `support.gif` | Original vector illustrations authored in `artwork.html`, rendered at 12 fps |
| `hero.png`, `flow.png`, `support.png` | Still frames from the same artwork, used for reduced-motion preferences |
| `upi-qr.png` | Byte-for-byte copy of [the QR used by .cnote](https://github.com/Gurtejhundal/.cnote/blob/main/media/readme/upi-qr.png) |
| `../screenshots/*` | Real Electron captures; see [the desktop verification and media guide](../DESKTOP.md#verification-and-media) |

The vector animations illustrate product behavior; they are not presented as app screenshots. No QR modules, colors, payment fields, or recipient details were redrawn. The copied PNG's Git blob SHA is `f9f7ab33d475e232664b0e765df41f266f4c1d95`. Its decoded payload is:

```text
upi://pay?pa=gurtejbir.29107@okhdfcbank&pn=Gurtejbir%20Singh&cu=INR
```

The QR remains a separate static image, preserving its quiet zone and contrast. It is also a link to the full-resolution PNG.

To regenerate the original motion artwork, install the root development dependencies, Playwright's Chromium, and `ffmpeg`:

```bash
npm ci
npx playwright install chromium
node scripts/render-readme.cjs
```

Alternatively, set `CHROMIUM_PATH` to an installed Chrome/Chromium executable. The script writes the GIFs and still PNGs into this folder and removes its temporary frame sequences. It does not touch the payment QR or desktop screenshots.

The README uses `<picture>` sources for `prefers-reduced-motion: reduce`. If a viewer does not apply that media preference, the still PNGs remain available here as direct alternatives.
