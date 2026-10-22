import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const home = os.homedir();

export const AW_HOME = process.env.AGENTWATCH_HOME || path.join(home, '.agentwatch');
export const LOG = path.join(AW_HOME, 'events.jsonl');
export const LOG_ROTATE_BYTES = 50 * 1024 * 1024;

export const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
export const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');

export const CODEX_HOME = process.env.CODEX_HOME || path.join(home, '.codex');
export const CODEX_HOOKS = path.join(CODEX_HOME, 'hooks.json');
export const CODEX_CONFIG = path.join(CODEX_HOME, 'config.toml');

// Absolute path to the CLI entry point, resolved through any npm-link symlinks,
// so the hook command keeps working no matter where `agentwatch` is invoked from.
export const SCRIPT = (() => {
  const p = fileURLToPath(new URL('../bin/agentwatch.js', import.meta.url));
  try { return fs.realpathSync(p); } catch { return p; }
})();

export const tildify = (p) => (p && p.startsWith(home) ? '~' + p.slice(home.length) : p);
