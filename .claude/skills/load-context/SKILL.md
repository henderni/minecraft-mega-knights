---
name: load-context
description: >
  List and load saved context snapshots from previous sessions. Use at the start
  of a session to pick up where you left off, or to review what was happening
  in a past session.
user-invocable: true
argument-hint: "[context file name or 'list']"
---

# Load Working Context

Restore context from a previous session.

## Steps

1. **List available contexts**: Read the `contexts/` subdirectory inside your auto memory directory
   - Show each file's name (which includes date and label)
   - Show the first 3 lines of each for a quick preview

2. **If `$ARGUMENTS` is empty or "list"**: Just show the list and ask the user which one to load

3. **If a specific context was named**: Read that file and present its contents as a briefing:
   - Summarize what was being worked on
   - List the open questions / next steps
   - Check if the referenced files still exist and note any that were deleted/moved
   - Check if the branch still exists
   - Suggest what to do first based on the open items

4. **After loading**: Offer to delete old context files (keep last 10 max) to prevent clutter
