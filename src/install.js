import fs from 'node:fs';
import path from 'node:path';
import { SCRIPT, LOG, CLAUDE_SETTINGS, CODEX_HOME, CODEX_HOOKS, CODEX_CONFIG, tildify } from './paths.js';

const CLAUDE_EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop', 'PreCompact'];
const CODEX_EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact', 'Interrupt'];
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'PermissionRequest']);

const quote = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
const hookCommand = (agent) => `${quote(process.execPath)} ${quote(SCRIPT)} hook ${agent}`;
const isOurs = (group) => Array.isArray(group?.hooks) && group.hooks.some((h) => typeof h.command === 'string' && /agentwatch\S*\s+hook\s+(claude|codex)\b/.test(h.command));

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) return {};
  try { return JSON.parse(text); } catch (err) {
    throw new Error(`${tildify(file)} isn't valid JSON (${err.message}). Fix it first; agentwatch won't overwrite it.`);
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const bak = file + '.agentwatch.bak';
  if (fs.existsSync(file) && !fs.existsSync(bak)) fs.copyFileSync(file, bak);
  const tmp = file + '.agentwatch.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function strip(hooks) {
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    hooks[ev] = hooks[ev].filter((g) => !isOurs(g));
    if (hooks[ev].length === 0) delete hooks[ev];
  }
  return hooks;
}

function addGroups(hooks, events, agent, handlerExtra) {
  for (const ev of events) {
    const group = { hooks: [{ type: 'command', command: hookCommand(agent), timeout: 5, ...handlerExtra(ev) }] };
    if (TOOL_EVENTS.has(ev)) group.matcher = '*';
    (hooks[ev] ||= []).push(group);
  }
}

function installClaude() {
  const settings = readJson(CLAUDE_SETTINGS);
  settings.hooks = strip(settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {});
  addGroups(settings.hooks, CLAUDE_EVENTS, 'claude', () => ({}));
  writeJson(CLAUDE_SETTINGS, settings);
  return `Claude Code: hooks added to ${tildify(CLAUDE_SETTINGS)}. Restart running Claude Code sessions to pick them up.`;
}

function installCodex() {
  if (!fs.existsSync(CODEX_HOME)) return `Codex: skipped, ${tildify(CODEX_HOME)} doesn't exist.`;
  const file = readJson(CODEX_HOOKS);
  file.hooks = strip(file.hooks && typeof file.hooks === 'object' ? file.hooks : {});
  // SessionEnd and Interrupt cap their timeout at 3 seconds.
  addGroups(file.hooks, CODEX_EVENTS, 'codex', (ev) => (ev === 'SessionEnd' || ev === 'Interrupt' ? { timeout: 2 } : {}));
  writeJson(CODEX_HOOKS, file);
  const lines = [`Codex: hooks added to ${tildify(CODEX_HOOKS)}. Open /hooks in Codex once and trust them; Codex skips new hooks until you do.`];
  try {
    const toml = fs.readFileSync(CODEX_CONFIG, 'utf8');
    if (/^\s*(codex_)?hooks\s*=\s*false/m.test(toml)) lines.push(`  Note: ${tildify(CODEX_CONFIG)} turns hooks off. Remove that line or set it to true.`);
    if (/^\s*allow_managed_hooks_only\s*=\s*true/m.test(toml)) lines.push('  Note: managed-hooks-only mode is on, so user hooks will not run.');
  } catch { /* no config.toml is fine */ }
  return lines.join('\n');
}

export function install(which = ['claude', 'codex']) {
  const out = [];
  for (const agent of which) {
    try { out.push(agent === 'claude' ? installClaude() : installCodex()); } catch (err) { out.push(`${agent}: ${err.message}`); }
  }
  out.push(`Events go to ${tildify(LOG)}. Run \`agentwatch\` to watch them.`);
  return out.join('\n');
}

export function uninstall() {
  const out = [];
  for (const [label, file] of [['Claude Code', CLAUDE_SETTINGS], ['Codex', CODEX_HOOKS]]) {
    try {
      if (!fs.existsSync(file)) continue;
      const obj = readJson(file);
      if (!obj.hooks) continue;
      obj.hooks = strip(obj.hooks);
      if (Object.keys(obj.hooks).length === 0) delete obj.hooks;
      writeJson(file, obj);
      out.push(`${label}: removed agentwatch hooks from ${tildify(file)}.`);
    } catch (err) { out.push(`${label}: ${err.message}`); }
  }
  return out.join('\n') || 'Nothing to remove.';
}

export function status() {
  const check = (file) => {
    try { return Object.values(readJson(file).hooks || {}).flat().some(isOurs); } catch { return false; }
  };
  let size = 'no events yet';
  try { size = `${(fs.statSync(LOG).size / 1024).toFixed(0)} KB of events`; } catch {}
  return [
    `Claude Code  ${check(CLAUDE_SETTINGS) ? 'installed' : 'not installed'}  (${tildify(CLAUDE_SETTINGS)})`,
    `Codex        ${check(CODEX_HOOKS) ? 'installed' : 'not installed'}  (${tildify(CODEX_HOOKS)})`,
    `Log          ${tildify(LOG)}, ${size}`,
    `Hook runs    ${hookCommand('<agent>')}`,
  ].join('\n');
}
