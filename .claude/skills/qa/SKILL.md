---
name: qa
description: >
  Write and run tests for changed or specified code. Use when the user says
  /qa, asks for tests, or wants to validate recent changes. Runs the QA agent
  in a forked context.
user-invocable: true
argument-hint: "[file or feature to test]"
context: fork
agent: qa
---

# Test Task

Write vitest tests for the Mega Knights project.

## What to test

$ARGUMENTS

## Steps

1. If a specific file or feature was given, read it and understand the logic
2. If no argument was given, check `git diff HEAD` to find recently changed files
3. Read existing test files in `src/__tests__/` to avoid duplicating coverage
4. Write focused, well-organized tests following the project patterns
5. Run tests with `npm run test:run` and fix any failures
6. Report what was tested, how many tests were added, and the pass/fail results
