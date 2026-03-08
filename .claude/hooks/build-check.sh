#!/bin/bash

# Build verification hook for Mega Knights
# Runs on session stop to ensure TypeScript build and tests are valid

set -e

# Get script directory (where this file is)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

cd "$PROJECT_DIR"

echo "🔍 Verifying TypeScript build..."

if ! npm run build > /dev/null 2>&1; then
  echo "❌ TypeScript build failed"
  exit 1
fi

echo "✓ Build valid"

echo "🧪 Running tests..."

if ! npx vitest run > /dev/null 2>&1; then
  echo "❌ Tests failed"
  npx vitest run 2>&1 | tail -20
  exit 1
fi

echo "✓ Tests passed"
exit 0
