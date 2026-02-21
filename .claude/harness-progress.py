#!/usr/bin/env python3
"""
Stream filter for Claude Code's stream-json output.
Reads JSONL from stdin, prints concise progress lines to stderr.
"""

import sys
import json

# ANSI colors (match harness.sh)
BLUE = "\033[0;34m"
GREEN = "\033[0;32m"
DIM = "\033[2m"
NC = "\033[0m"

tool_count = 0

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        continue

    msg_type = obj.get("type")

    if msg_type == "assistant":
        for block in obj.get("message", {}).get("content", []):
            if block.get("type") == "tool_use":
                tool_count += 1
                name = block.get("name", "?")
                inp = block.get("input", {})

                # Build a short description based on tool type
                detail = ""
                if name == "Read" and "file_path" in inp:
                    detail = inp["file_path"].split("/")[-1]
                elif name == "Edit" and "file_path" in inp:
                    detail = inp["file_path"].split("/")[-1]
                elif name == "Write" and "file_path" in inp:
                    detail = inp["file_path"].split("/")[-1]
                elif name == "Glob" and "pattern" in inp:
                    detail = inp["pattern"]
                elif name == "Grep" and "pattern" in inp:
                    detail = inp["pattern"][:40]
                elif name == "Bash" and "command" in inp:
                    detail = inp["command"][:50]
                elif name == "Task" and "description" in inp:
                    detail = inp["description"]

                if detail:
                    print(
                        f"  {DIM}[{tool_count}]{NC} {name} {DIM}{detail}{NC}",
                        file=sys.stderr,
                        flush=True,
                    )
                else:
                    print(
                        f"  {DIM}[{tool_count}]{NC} {name}",
                        file=sys.stderr,
                        flush=True,
                    )

            elif block.get("type") == "text":
                text = block.get("text", "").strip()
                if text:
                    # Show short text snippets (task progress, summaries)
                    first_line = text.split("\n")[0][:100]
                    print(
                        f"  {BLUE}{first_line}{NC}",
                        file=sys.stderr,
                        flush=True,
                    )

    elif msg_type == "result":
        cost = obj.get("cost_usd", 0)
        duration_s = obj.get("duration_ms", 0) / 1000
        turns = obj.get("num_turns", 0)
        print(
            f"  {GREEN}Done: {turns} turns, ${cost:.2f}, {duration_s:.0f}s{NC}",
            file=sys.stderr,
            flush=True,
        )
