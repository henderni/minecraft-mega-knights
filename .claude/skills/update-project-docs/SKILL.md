---
name: update-project-docs
description: >
  Capture learnings from the current session and update CLAUDE.md and MEMORY.md.
  Use after significant work sessions, architectural decisions, or when new
  patterns/conventions are established.
user-invocable: true
argument-hint: "[specific topic to document]"
---

# Update Project Documentation

Review the current session and update project docs with new learnings.

## Files to update

- **`CLAUDE.md`** (project root) — Committed project instructions for all contributors
- **`~/.claude/projects/-Users-nick-Repos-minecraft-mega-knights/memory/MEMORY.md`** — Private session memory

## Process

1. **Review session changes**: Run `git diff` and `git status` to see what was modified
2. **Identify learnings**: Look for:
   - New architectural patterns or conventions
   - New files/directories that should be documented
   - Performance findings or constraints discovered
   - Bug fixes that reveal gotchas worth documenting
   - New debug commands or workflows
   - Changes to entity/item checklists
   - New data exports or system interactions
3. **Check current docs**: Read both CLAUDE.md and MEMORY.md to understand what's already documented
4. **Update CLAUDE.md** if the learning is:
   - Relevant to any contributor (not just you)
   - A stable pattern (not experimental)
   - Related to build/test/deploy workflows
   - A new naming convention or checklist item
5. **Update MEMORY.md** if the learning is:
   - Session-specific debugging insights
   - Tooling preferences
   - Temporary workarounds
   - Dev environment setup notes
6. **Keep MEMORY.md under 200 lines** — it's loaded into the system prompt. Move detailed notes to separate topic files in the memory directory.

$ARGUMENTS

## Rules

- Don't duplicate info that's already in the docs
- Don't add speculative or unverified conclusions
- Keep entries concise — bullet points preferred
- Use the Edit tool for surgical updates, not full rewrites
- If MEMORY.md exceeds 200 lines, extract detailed sections into topic files (e.g., `memory/debugging.md`, `memory/patterns.md`)
