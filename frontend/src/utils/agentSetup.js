export const clients = [
    ['codex', 'Codex', 'Plugin'], ['claude-code', 'Claude Code', 'Plugin'], ['cursor', 'Cursor', 'Skill'],
    ['gemini-cli', 'Gemini CLI', 'Skill'], ['antigravity', 'Antigravity', 'Skill'], ['claude-desktop', 'Claude Desktop', 'Chat prompt'],
]
export const installSteps = {
    codex: 'codex plugin marketplace add Gurtejhundal/Traqu\ncodex plugin add traqu@traqu',
    'claude-code': 'claude plugin marketplace add Gurtejhundal/Traqu\nclaude plugin install traqu@traqu --scope user',
    'gemini-cli': 'gemini skills install https://github.com/Gurtejhundal/Traqu.git --path plugins/traqu/skills/traqu',
    cursor: 'Download SKILL.md from https://raw.githubusercontent.com/Gurtejhundal/Traqu/main/plugins/traqu/skills/traqu/SKILL.md\nSave it as ~/.cursor/skills/traqu/SKILL.md (your user home folder).\nRestart Cursor, then use /traqu. Connect MCP separately in Traqu.',
    antigravity: 'Download SKILL.md from https://raw.githubusercontent.com/Gurtejhundal/Traqu/main/plugins/traqu/skills/traqu/SKILL.md\nSave it as ~/.gemini/config/skills/traqu/SKILL.md (your user home folder).\nRestart Antigravity, then use /traqu. Connect MCP separately in Traqu.',
}
