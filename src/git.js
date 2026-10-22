import fs from 'node:fs';
import path from 'node:path';

const cache = new Map();

// Repo name and current branch for a session's cwd, read straight from .git so it
// costs a couple of tiny file reads rather than a git subprocess. Cached briefly.
export function repoInfo(cwd) {
  if (!cwd) return { name: '?', branch: null };
  const now = Date.now();
  const hit = cache.get(cwd);
  if (hit && now - hit.at < 10_000) return hit.v;
  let v = { name: path.basename(cwd) || cwd, branch: null };
  try {
    let dir = cwd;
    for (let i = 0; i < 40; i++) {
      const dotgit = path.join(dir, '.git');
      if (fs.existsSync(dotgit)) {
        let gitdir = dotgit;
        if (fs.statSync(dotgit).isFile()) {
          const m = fs.readFileSync(dotgit, 'utf8').match(/gitdir:\s*(.+)/);
          if (m) gitdir = path.resolve(dir, m[1].trim());
        }
        const head = fs.readFileSync(path.join(gitdir, 'HEAD'), 'utf8').trim();
        const ref = head.match(/^ref: refs\/heads\/(.+)$/);
        const rel = path.relative(dir, cwd);
        v = { name: path.basename(dir) + (rel ? `/${rel}` : ''), branch: ref ? ref[1] : head.slice(0, 7) };
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* not a repo, or unreadable */ }
  cache.set(cwd, { at: now, v });
  return v;
}
