import fs from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

// Polls a JSONL file and hands each parsed line to onEvent. Starts from the last
// `backlogBytes` of the file so a long history doesn't slow startup, and follows
// the file across rotation (a new inode means a fresh file to read from the top).
export function follow(file, onEvent, { backlogBytes = 4 * 1024 * 1024, intervalMs = 250 } = {}) {
  let fd = null;
  let ino = null;
  let pos = 0;
  let buf = '';
  let first = true;
  let skipPartial = false;
  let decoder = new StringDecoder('utf8');

  const reset = () => {
    if (fd !== null) { try { fs.closeSync(fd); } catch {} }
    fd = null; ino = null; pos = 0; buf = ''; decoder = new StringDecoder('utf8');
  };

  function poll() {
    if (fd === null) {
      try { fd = fs.openSync(file, 'r'); ino = fs.fstatSync(fd).ino; } catch { fd = null; return; }
    }
    try {
      const onDisk = fs.statSync(file);
      if (onDisk.ino !== ino) { reset(); first = false; return poll(); }
    } catch { /* rotated away and not yet recreated */ }

    let size;
    try { size = fs.fstatSync(fd).size; } catch { return; }
    if (first) {
      first = false;
      pos = Math.max(0, size - backlogBytes);
      skipPartial = pos > 0;
    }
    if (size < pos) { pos = 0; buf = ''; }
    if (size === pos) return;

    const chunk = Buffer.alloc(size - pos);
    const read = fs.readSync(fd, chunk, 0, chunk.length, pos);
    pos += read;
    buf += decoder.write(chunk.subarray(0, read));
    const lines = buf.split('\n');
    buf = lines.pop();
    if (skipPartial) { lines.shift(); skipPartial = false; }
    for (const line of lines) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      onEvent(e);
    }
  }

  poll();
  const timer = setInterval(poll, intervalMs);
  return () => { clearInterval(timer); reset(); };
}
