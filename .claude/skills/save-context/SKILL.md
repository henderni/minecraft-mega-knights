---
name: save-context
description: >
  Save a snapshot of the current working context (what you're doing, key decisions,
  open questions) to a file that can be loaded in a future session. Use before
  long breaks, when context is getting large, or before /clear.
user-invocable: true
argument-hint: "[label for this context snapshot]"
---

# Save Working Context

Create a context snapshot that can be loaded in a future session.

## What to capture

Write a structured summary to `~/.claude/projects/-Users-nick-Repos-minecraft-mega-knights/memory/contexts/<timestamp>-<label>.md`:

### Structure

```markdown
# Context: <label>
**Saved:** <date and time>
**Branch:** <current git branch>
**Last commit:** <short hash and message>

## What I was working on
<1-3 sentence summary of the active task>

## Key decisions made
- <decision 1>
- <decision 2>

## Files modified (this session)
- <file path> — <what changed>

## Open questions / next steps
- [ ] <thing that still needs doing>
- [ ] <unresolved question>

## Important context
<Any critical details that would be lost — error messages, workarounds found,
API quirks discovered, things that were tried and didn't work>
```

## Steps

1. Gather context:
   - Run `git status` and `git log --oneline -5` for recent state
   - Run `git diff --stat` to see modified files
   - Summarize the conversation's key decisions and findings
2. Generate the label from `$ARGUMENTS` or auto-generate from the task
3. Create the directory if needed: `mkdir -p ~/.claude/projects/-Users-nick-Repos-minecraft-mega-knights/memory/contexts/`
4. Write the context file with timestamp prefix (e.g., `2026-02-20-siege-refactor.md`)
5. Confirm to the user what was saved and how to load it later (`/load-context`)
