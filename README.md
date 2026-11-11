# context-agents-pane

A Claude Code mod that adds a **Context & agents** pane beside the chat. It shows how full the context window is, what fills it, and which agents are running in the session.

```
── Context ───────────────────────────
42.1k / 200k                    21%
████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
auto-compact window · /autocompact
  System prompt                 2.9k
  Messages                      3.6k
  Free space                  441.2k
── Agents · 3 ────────────────────────
◆ session  this conversation
● running  Explore
  find auth middleware
○ idle     general-purpose
  write tests
updated 14:02:31
```

## What it shows

- **Context:** tokens used against the window that compaction actually runs at. If `/autocompact` or an environment variable sets a smaller window, the pane uses that window and says so.
- **Bar:** green below 70%, yellow from 70%, red from 90%. The words "high" and "near limit" repeat the state, so color is never the only cue.
- **Breakdown:** the used categories by size, then the autocompact buffer and free space, dimmed.
- **Agents:** the main conversation first, then each subagent or teammate with its status, glyph, type and label. The main conversation's own status isn't exposed by the engine, so it shows no status.
- **Footer:** the time of the last sample, or the error if sampling failed.

The pane refreshes every 2 seconds.

## Install

You need Claude Code with plugin support and [Git](https://git-scm.com/).

1. Clone the repository:

   ```sh
   git clone https://github.com/<your-account>/context-agents-pane.git
   ```

2. Start Claude Code with the mod loaded:

   ```sh
   claude --plugin-dir /path/to/context-agents-pane
   ```

   On Windows, use the full path, for example `C:\Users\you\Repos\context-agents-pane`.

3. Open the pane with `/context-agents`. If it closes, reopen it with the same command. `/context-agents-reload` closes and reopens it.

## Commands

| Command | Effect |
| --- | --- |
| `/context-agents` | Opens the pane. |
| `/context-agents-reload` | Closes the pane and opens it again. |

## Notes

- The mod doesn't store anything outside the session. Its state is kept in the engine's per-session store.
- The sampler calls `session.usage` with the `summary` breakdown. That estimates locally and sends no model requests, so it's cheap to run every 2 seconds.
- Tested on Windows 11 with Claude Code 2.1.318. Other platforms are untested.

## Project layout

```
.claude-plugin/plugin.json   manifest
hooks/hooks.json             points at the hooks module
hooks/register.tsx           session start, commands, sampler, pane drawing
types/index.d.ts             contract for the stored state
tsconfig.json                type-checking configuration
```

## License

No license is set yet. Until one is added, the code is all rights reserved.
