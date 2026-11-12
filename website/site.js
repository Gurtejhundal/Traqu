'use strict';
// This site has no account, workspace API, cookies or analytics.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches;
const footer = document.querySelector('.site-footer > div');
if (footer) {
  const control = document.createElement('button');
  control.type = 'button'; control.className = 'motion-toggle';
  control.textContent = 'Pause animations'; footer.append(control);
}
function applyMotion() {
  document.documentElement.dataset.motion = paused ? 'paused' : 'playing';
  for (const button of document.querySelectorAll('.motion-toggle')) {
    button.textContent = paused ? 'Play animations' : 'Pause animations';
    button.setAttribute('aria-pressed', String(paused));
  }
  for (const image of document.querySelectorAll('img[src$=".gif"], img[data-animation]')) {
    image.dataset.animation ||= image.getAttribute('src');
    const still = image.dataset.animation.includes('desktop-demo') ? 'media/screenshots/roadmap.png' : 'media/readme/support.png';
    image.src = paused ? still : image.dataset.animation;
  }
  if (paused) document.querySelector('.pet')?.setAttribute('data-action', 'rest');
}
for (const button of document.querySelectorAll('.motion-toggle')) button.addEventListener('click', () => { paused = !paused; applyMotion(); });
reducedMotion.addEventListener('change', event => { paused = event.matches; applyMotion(); });
applyMotion();

// Qu reuses the app's original sprite and separate gaze layers.
const pet = document.querySelector('.pet');
if (pet) {
  const sprite = document.createElement('span'); sprite.className = 'pet-sprite';
  const image = document.createElement('img'); image.src = 'media/characters/qu-sprites.png'; image.alt = ''; image.draggable = false;
  sprite.append(image); pet.append(sprite);
  let settle, frame = 0;
  const play = action => {
    clearTimeout(settle); pet.dataset.action = 'rest';
    if (paused || reducedMotion.matches || action === 'rest') return;
    void pet.offsetWidth; pet.dataset.action = action;
    settle = setTimeout(() => { pet.dataset.action = 'rest'; }, action === 'run' ? 1450 : 1150);
  };
  pet.addEventListener('click', () => play('hop'));
  pet.addEventListener('dblclick', () => play('run'));
  pet.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = {r:'run',s:'sway',Escape:'rest',ArrowLeft:'run',ArrowRight:'run'}[event.key];
    if (action) { event.preventDefault(); play(action); }
  });
  for (const button of document.querySelectorAll('[data-pet-action]')) button.addEventListener('click', () => play(button.dataset.petAction));
  window.addEventListener('pointermove', event => {
    if (paused || reducedMotion.matches || document.hidden || frame) return;
    const rect = pet.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) return;
    const x = Math.max(-4, Math.min(4, (event.clientX - rect.left - rect.width / 2) / 100));
    const y = Math.max(-3, Math.min(3, (event.clientY - rect.top - rect.height / 2) / 100));
    frame = requestAnimationFrame(() => { pet.querySelector('.pupils').style.transform = `translate(${x}px,${y}px)`; frame = 0; });
  }, {passive:true});
  document.documentElement.addEventListener('pointerleave', () => { pet.querySelector('.pupils').style.transform = ''; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) play('rest'); });
}

const promptBox = document.querySelector('#roadmap-prompt');
let promptReady;
if (promptBox) {
  promptReady = fetch('agents/SKILL.md').then(response => {
    if (!response.ok) throw new Error('The roadmap instructions could not be loaded. Download the skill or refresh this page.');
    return response.text();
  }).then(guide => {
    const prompt = 'Create a day-by-day roadmap I can import into Traqu. Ask for my goal, start/end dates, current level and realistic daily time budget if missing. Follow the complete instructions below. Return a downloadable JSON file, or Markdown if file generation is unavailable. Keep the language simple: topic name, clear action, and verified resource/problem links. Do not claim live access to my Traqu workspace. I will review and import this as a new plan.\n\n' + guide;
    promptBox.value = prompt; return prompt;
  }).catch(error => { promptBox.value = error.message; document.querySelector('#copy-status').textContent = error.message; return null; });
  document.querySelector('#copy-prompt').addEventListener('click', async () => {
    const text = await promptReady;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); document.querySelector('#copy-status').textContent = 'Copied. Paste into your chat and add your goal, dates and available time.'; }
    catch { document.querySelector('#prompt-review').open = true; promptBox.focus(); promptBox.select(); document.querySelector('#copy-status').textContent = 'Select and copy the prompt above. Clipboard access is unavailable.'; }
  });
}
const upiButton = document.querySelector('#copy-upi');
upiButton?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('gurtejbir.29107@okhdfcbank'); document.querySelector('#upi-status').textContent = 'UPI ID copied.'; }
  catch { document.querySelector('#upi-status').textContent = 'Copy the UPI ID shown above, or scan the QR.'; }
});

// Render bundled Markdown as safe DOM nodes; source HTML is never executed.
function inlineText(parent, text, file) {
  const expression = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    if (match[1]) {
      const link = document.createElement('a'); link.textContent = match[1];
      const url = new URL(match[2], `https://github.com/Gurtejhundal/Traqu/blob/main/docs/${file}`);
      if (['https:','http:'].includes(url.protocol)) link.href = url.href;
      parent.append(link);
    } else {
      const element = document.createElement(match[3] ? 'code' : 'strong'); element.textContent = match[3] || match[4]; parent.append(element);
    }
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}
function renderManual(text, file) {
  const body = document.querySelector('#manual-body'); body.replaceChildren();
  let code = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) { if (code) code = null; else { code = document.createElement('pre'); body.append(code); } continue; }
    if (code) { code.append(document.createTextNode(line + '\n')); continue; }
    if (!line.trim()) continue;
    const heading = /^(#{1,3})\s+(.+)/.exec(line);
    const element = document.createElement(heading ? `h${heading[1].length}` : 'p');
    if (!heading) element.className = 'raw-line';
    inlineText(element, heading ? heading[2] : line, file); body.append(element);
  }
}
const manualDialog = document.querySelector('#manual-dialog');
let manualRequest = 0;
for (const button of document.querySelectorAll('[data-manual]')) button.addEventListener('click', async () => {
  const file = button.dataset.manual;
  if (!/^[A-Z_]+\.md$/.test(file)) return;
  const request = ++manualRequest;
  document.querySelector('#manual-title').textContent = button.querySelector('span').textContent;
  document.querySelector('#manual-body').textContent = 'Opening the manual…';
  document.querySelector('#download-manual').href = `manual/${file}`;
  document.querySelector('#source-manual').href = `https://github.com/Gurtejhundal/Traqu/blob/main/docs/${file}`;
  manualDialog.showModal();
  try {
    const response = await fetch(`manual/${file}`);
    if (!response.ok) throw new Error('This manual could not be loaded. Use View source to read it on GitHub.');
    const text = await response.text(); if (request === manualRequest) renderManual(text, file);
  } catch (error) { if (request === manualRequest) document.querySelector('#manual-body').textContent = error.message; }
});
document.querySelector('#close-manual')?.addEventListener('click', () => manualDialog.close());

// Optional public release metadata. Links work even if GitHub's API is unavailable.
if (document.querySelector('#release-status')) {
  fetch('https://api.github.com/repos/Gurtejhundal/Traqu/releases/latest', {signal:AbortSignal.timeout(5000)})
    .then(response => { if (!response.ok) throw new Error('Release lookup unavailable'); return response.json(); })
    .then(release => {
      const version = /^v(\d+)\.(\d+)\.(\d+)$/.exec(release.tag_name || '');
      if (!version || release.draft || release.prerelease) return;
      document.querySelector('#release-status').textContent = `Latest published desktop release · ${release.tag_name}`;
      const bundled = Number(version[1]) > 1 || Number(version[1]) === 1 && (Number(version[2]) > 6 || Number(version[2]) === 6 && Number(version[3]) >= 1);
      document.querySelector('#mcp-release-note').textContent = bundled ? `The latest published desktop release includes MCP setup. Open Profile → ${Number(version[1]) > 1 || Number(version[2]) >= 8 ? 'AI connections' : 'Preferences → AI connections'}.` : `The latest desktop download is ${release.tag_name}. Multi-client setup needs 1.6.1+. Use the source MCP manual for now, or wait for the new installers to finish verification.`;
    }).catch(() => { /* Static links and explicit version requirements remain usable. */ });
}
