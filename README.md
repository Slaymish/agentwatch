# agentwatch

A terminal view of what your Claude Code and Codex sessions are doing, so you can see at a glance which one needs you, which ones are busy, and what each is busy with.

No dependencies. Node 18.17 or newer.

## Set up

```sh
cd agentwatch
npm link            # puts `agentwatch` on your PATH
agentwatch demo     # try it with simulated sessions first
agentwatch install  # add the hooks to Claude Code and Codex
agentwatch          # open the live view
```

After installing:

- **Claude Code** picks up the hooks in new sessions. Restart any that are already running.
- **Codex** skips new hooks until you trust them. Open `/hooks` in Codex once and trust the agentwatch entries.

`agentwatch status` shows what's installed. `agentwatch uninstall` removes only the agentwatch entries and leaves your other hooks alone. The first install keeps a `.agentwatch.bak` copy of each settings file.

The hook command points at this folder by absolute path, so if you move the folder, run `agentwatch install` again.

## Reading the view

Sessions are sorted by how much they need you:

| Status | Meaning |
|---|---|
| needs you | Blocked on an approval prompt. The terminal bell rings when this happens (`b` toggles it). |
| working | Mid-turn, calling tools or generating. |
| gone quiet | Still mid-turn, but nothing for 10 minutes. Usually a long command, sometimes a hang. |
| your turn | Finished its turn and is waiting for your next prompt. |
| idle | Your turn, untouched for 20 minutes. |
| ended | Session closed. Hidden after 30 minutes unless you press `a`. |

Each card is one session, and reads top to bottom:

- **Who and where** — status, agent and model, repo and branch, and how long since its last event.
- **What it is doing, and for how long** — `verifying  4m  npm test`. That duration is the age of the current step, so a number that keeps climbing is a long command, and one that stops moving while the status turns yellow is a hang. A session that has finished its turn shows how long the turn took instead, and a blocked one shows how long you have been the blocker.
- **The strip** — one block per tool call, newest on the right, coloured by phase. Reading it left to right tells you the shape of the turn: a run of blue is exploration, yellow is editing, green is tests or builds, red is something that failed.
- **Plan and files** — how far through its own plan (from `TodoWrite` in Claude Code or `update_plan` in Codex), and the files it has changed. The names need a wide terminal; the count is always in the line above.
- **Your last prompt.**

Press enter on a session for the detail view: the full plan, files changed, how the session's effort splits across phases, and a timestamped activity log.

Phases are a heuristic on tool names and shell commands, defined in `src/state.js` (`classify` and the regexes above it). If your projects use different test or build commands, add them to `VERIFY_CMD`.

## How it works

```
Claude Code hooks ─┐
                   ├─▶ agentwatch hook <agent> ─▶ ~/.agentwatch/events.jsonl ─▶ agentwatch (TUI)
Codex hooks ───────┘
```

Both agents run a command on lifecycle events and pass it a JSON payload on stdin. `agentwatch hook` normalises that payload into one small line and appends it to the log. It never writes to stdout (some events feed stdout back into the model's context), always exits 0, and takes about 40 ms, so it can't block or slow an agent in any way you'd notice.

The view tails the log and folds events into one record per session. Because the log is just a file, the view can be closed and reopened without losing anything, and sessions that started before you opened it still show up. The log rotates to `events.1.jsonl` at 50 MB.

## Privacy

Everything stays on your machine in `~/.agentwatch/`. The log holds prompts, shell commands and file paths, each cut to a few hundred characters. It doesn't store file contents or tool output. Delete the folder whenever you like.

## Options

- `--file <path>` reads a different log.
- `agentwatch snapshot --width 120 --height 40` prints one frame and exits, which is handy for checking layout or piping into something else.
- `AGENTWATCH_HOME`, `CLAUDE_CONFIG_DIR` and `CODEX_HOME` override the default locations.

## Keys

`↑ ↓` or `j k` select, `enter` details, `esc` back, `a` show or hide old sessions, `b` bell, `q` quit.
