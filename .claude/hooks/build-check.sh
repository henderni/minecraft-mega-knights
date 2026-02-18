#!/bin/bash
cd "$CLAUDE_PROJECT_DIR"
OUTPUT=$(npm run build 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "TypeScript build failed:" >&2
  echo "$OUTPUT" >&2
  exit 2
fi

exit 0
