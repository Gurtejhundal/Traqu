const { existsSync } = require('node:fs');
const path = require('node:path');


function workspaceDirectoryOverride(appData, override) {
  if (override) return path.resolve(override);
  const current = path.join(appData, 'Traqu', 'roadmap.db');
  const legacy = path.join(appData, 'Traqo');
  return !existsSync(current) && existsSync(path.join(legacy, 'roadmap.db')) ? legacy : null;
}

function isWorkspaceURL(url, origin) {
  try { return new URL(url).origin === origin; } catch { return false; }
}

function isExternalURL(url) {
  try { return ['https:', 'http:', 'mailto:'].includes(new URL(url).protocol); } catch { return false; }
}

function validWindowState(state) {
  if (!state || !Number.isInteger(state.width) || !Number.isInteger(state.height)) return {};
  if (state.width < 860 || state.height < 600 || state.width > 10000 || state.height > 10000) return {};
  return { width: state.width, height: state.height, maximized: state.maximized === true };
}

module.exports = { isWorkspaceURL, isExternalURL, validWindowState, workspaceDirectoryOverride };
