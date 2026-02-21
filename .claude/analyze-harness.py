#!/usr/bin/env python3
"""
Harness Run Analyzer — Post-run metrics and recommendations.

Parses Claude Code session transcripts to extract token usage, efficiency
metrics, and improvement recommendations for the feature_list.json harness.

Usage:
    python3 .claude/analyze-harness.py                    # auto-detect latest run
    python3 .claude/analyze-harness.py --date 2026-02-20  # specific date
    python3 .claude/analyze-harness.py --sessions ID1 ID2 # specific sessions
    python3 .claude/analyze-harness.py --save              # write results to harness_runs/
"""

import json
import os
import sys
import argparse
from datetime import datetime, date
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

# ─── Paths ────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CLAUDE_DIR = PROJECT_ROOT / ".claude"
FEATURE_LIST = CLAUDE_DIR / "feature_list.json"
PROGRESS_FILE = CLAUDE_DIR / "progress.txt"
RUNS_DIR = CLAUDE_DIR / "harness_runs"


def get_sessions_dir() -> Path:
    """Derive the Claude sessions directory from the project root path."""
    # Claude Code stores sessions under ~/.claude/projects/<mangled-path>/
    # where the mangled path replaces / with - and prepends -
    mangled = "-" + str(PROJECT_ROOT).replace("/", "-")
    return Path.home() / ".claude" / "projects" / mangled

# ─── Pricing (per million tokens) ─────────────────────────────────────────────

MODEL_PRICING = {
    "opus": {"input": 15.00, "output": 75.00, "cache_write": 18.75, "cache_read": 1.50},
    "sonnet": {"input": 3.00, "output": 15.00, "cache_write": 3.75, "cache_read": 0.30},
    "haiku": {"input": 0.80, "output": 4.00, "cache_write": 1.00, "cache_read": 0.08},
}

# Default — overridden by --model flag
PRICING = MODEL_PRICING["opus"]


@dataclass
class SessionMetrics:
    session_id: str
    timestamp: str
    file_size_kb: float
    api_calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    tool_calls: int = 0
    tool_types: dict = field(default_factory=dict)
    duration_minutes: float = 0.0
    tasks_completed: list = field(default_factory=list)

    @property
    def total_input_tokens(self) -> int:
        return self.input_tokens + self.cache_write_tokens + self.cache_read_tokens

    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_write_tokens + self.cache_read_tokens
        if total == 0:
            return 0.0
        return self.cache_read_tokens / total

    @property
    def cost_usd(self) -> float:
        return (
            (self.input_tokens / 1_000_000) * PRICING["input"]
            + (self.output_tokens / 1_000_000) * PRICING["output"]
            + (self.cache_write_tokens / 1_000_000) * PRICING["cache_write"]
            + (self.cache_read_tokens / 1_000_000) * PRICING["cache_read"]
        )


@dataclass
class HarnessRunReport:
    run_date: str
    sessions: list
    total_tasks: int = 0
    tasks_completed: int = 0
    total_api_calls: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cache_write_tokens: int = 0
    total_cache_read_tokens: int = 0
    total_cost_usd: float = 0.0
    total_tool_calls: int = 0
    recommendations: list = field(default_factory=list)


def parse_session(session_path: Path) -> SessionMetrics:
    """Parse a single session JSONL file for token and tool usage."""
    session_id = session_path.stem
    stat = session_path.stat()
    file_size_kb = stat.st_size / 1024

    metrics = SessionMetrics(
        session_id=session_id,
        timestamp=datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        file_size_kb=round(file_size_kb, 1),
    )

    first_ts = None
    last_ts = None

    with open(session_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            # Track timestamps for duration
            ts = obj.get("timestamp")
            if ts:
                if first_ts is None:
                    first_ts = ts
                last_ts = ts

            # Assistant messages have token usage
            if obj.get("type") == "assistant" and "message" in obj:
                msg = obj["message"]
                usage = msg.get("usage", {})
                if usage:
                    metrics.api_calls += 1
                    metrics.input_tokens += usage.get("input_tokens", 0)
                    metrics.output_tokens += usage.get("output_tokens", 0)
                    metrics.cache_write_tokens += usage.get(
                        "cache_creation_input_tokens", 0
                    )
                    metrics.cache_read_tokens += usage.get(
                        "cache_read_input_tokens", 0
                    )

                # Count tool calls
                content = msg.get("content", [])
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            metrics.tool_calls += 1
                            tool_name = block.get("name", "unknown")
                            metrics.tool_types[tool_name] = (
                                metrics.tool_types.get(tool_name, 0) + 1
                            )

    # Calculate duration
    if first_ts and last_ts:
        try:
            t1 = datetime.fromisoformat(first_ts.replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
            metrics.duration_minutes = round((t2 - t1).total_seconds() / 60, 1)
        except (ValueError, TypeError):
            pass

    return metrics


def find_sessions_by_date(target_date: date) -> list[Path]:
    """Find all non-empty session files modified on a given date."""
    sessions = []
    sessions_dir = get_sessions_dir()
    if not sessions_dir.exists():
        return sessions
    for f in sessions_dir.glob("*.jsonl"):
        if f.stat().st_size == 0:
            continue
        mtime = datetime.fromtimestamp(f.stat().st_mtime)
        if mtime.date() == target_date:
            sessions.append(f)
    return sorted(sessions, key=lambda p: p.stat().st_mtime)


def find_sessions_by_ids(ids: list[str]) -> list[Path]:
    """Find session files by partial or full session ID."""
    sessions_dir = get_sessions_dir()
    sessions = []
    for sid in ids:
        matches = list(sessions_dir.glob(f"{sid}*.jsonl"))
        sessions.extend(matches)
    return sorted(sessions, key=lambda p: p.stat().st_mtime)


def load_feature_list() -> list[dict]:
    """Load the feature_list.json task definitions."""
    if FEATURE_LIST.exists():
        with open(FEATURE_LIST) as f:
            return json.load(f)
    return []


def map_tasks_to_sessions(progress_text: str) -> dict[str, list[int]]:
    """Parse progress.txt to map session timestamps to completed task IDs."""
    session_tasks = {}
    current_session = None
    import re

    for line in progress_text.split("\n"):
        # Match session headers like "=== Session 2026-02-20 08:29 ==="
        session_match = re.match(r"=== Session (\S+ \S+)", line)
        if session_match:
            current_session = session_match.group(1)
            session_tasks[current_session] = []

        # Match task completions
        task_match = re.match(r"Task #(\d+):", line)
        if task_match and current_session:
            task_id = int(task_match.group(1))
            session_tasks[current_session].append(task_id)

    return session_tasks


def generate_recommendations(
    report: HarnessRunReport, sessions: list[SessionMetrics], tasks: list[dict]
) -> list[str]:
    """Generate actionable recommendations based on metrics."""
    recs = []

    # 1. Cache efficiency
    total_cache = report.total_cache_write_tokens + report.total_cache_read_tokens
    if total_cache > 0:
        hit_rate = report.total_cache_read_tokens / total_cache
        if hit_rate < 0.5:
            recs.append(
                f"LOW CACHE HIT RATE ({hit_rate:.0%}): Sessions are rebuilding context too often. "
                "Consider continuing sessions (--continue) instead of starting fresh, or batch "
                "related tasks in the same session to reuse cached context."
            )
        elif hit_rate > 0.8:
            recs.append(
                f"GOOD CACHE HIT RATE ({hit_rate:.0%}): Context reuse is efficient."
            )

    # 2. Output token ratio
    if report.total_input_tokens > 0:
        output_ratio = report.total_output_tokens / (
            report.total_input_tokens + report.total_output_tokens
        )
        if output_ratio < 0.05:
            recs.append(
                f"LOW OUTPUT RATIO ({output_ratio:.1%}): Most tokens are input/context, not generation. "
                "Consider trimming CLAUDE.md, reducing system prompt size, or using more targeted "
                "task descriptions."
            )

    # 3. Session count vs task count
    active_sessions = [s for s in sessions if s.api_calls > 5]
    if len(active_sessions) > 0:
        tasks_per_session = report.tasks_completed / len(active_sessions)
        if tasks_per_session < 2:
            recs.append(
                f"LOW TASKS/SESSION ({tasks_per_session:.1f}): Each session completes few tasks. "
                "Batch more S/M complexity tasks per session, or combine related_to tasks."
            )
        elif tasks_per_session > 5:
            recs.append(
                f"HIGH TASKS/SESSION ({tasks_per_session:.1f}): Risk of context overflow. "
                "Consider capping at 4-5 tasks per session to avoid compaction."
            )

    # 4. Cost per task
    if report.tasks_completed > 0:
        cost_per_task = report.total_cost_usd / report.tasks_completed
        recs.append(f"COST PER TASK: ${cost_per_task:.2f} average.")
        if cost_per_task > 2.00:
            recs.append(
                "Consider using Sonnet for S-complexity tasks (test-only, simple edits) "
                "to reduce cost. Reserve Opus for L-complexity and functional tasks."
            )

    # 5. Task complexity distribution
    complexity_counts = {"S": 0, "M": 0, "L": 0}
    for t in tasks:
        c = t.get("complexity", "M")
        complexity_counts[c] = complexity_counts.get(c, 0) + 1
    if complexity_counts.get("L", 0) > 3:
        recs.append(
            f"HIGH L-COMPLEXITY COUNT ({complexity_counts['L']}): Break large tasks into "
            "smaller pieces to reduce risk of context overflow and cascading failures."
        )

    # 6. Tool usage patterns
    all_tools = {}
    for s in sessions:
        for tool, count in s.tool_types.items():
            all_tools[tool] = all_tools.get(tool, 0) + count
    bash_calls = all_tools.get("Bash", 0)
    read_calls = all_tools.get("Read", 0)
    edit_calls = all_tools.get("Edit", 0) + all_tools.get("Write", 0)
    if read_calls > 0 and edit_calls > 0:
        read_edit_ratio = read_calls / edit_calls
        if read_edit_ratio > 10:
            recs.append(
                f"HIGH READ/EDIT RATIO ({read_edit_ratio:.0f}:1): Lots of exploration relative to "
                "changes. Add more target_files hints to tasks to reduce exploration overhead."
            )

    # 7. Related task consolidation
    related_tasks = [t for t in tasks if t.get("related_to")]
    if related_tasks:
        # Check if related tasks were done in separate sessions
        recs.append(
            f"RELATED TASKS: {len(related_tasks)} tasks have cross-references. "
            "Schedule related_to tasks in the same session for better context reuse."
        )

    return recs


def format_report(report: HarnessRunReport, sessions: list[SessionMetrics]) -> str:
    """Format the report as human-readable text."""
    lines = []
    lines.append("=" * 70)
    lines.append(f"  HARNESS RUN REPORT — {report.run_date}")
    lines.append("=" * 70)
    lines.append("")

    # Summary
    lines.append("## Summary")
    lines.append(f"  Sessions:         {len(sessions)}")
    lines.append(
        f"  Tasks:            {report.tasks_completed}/{report.total_tasks} completed"
    )
    lines.append(f"  Total API calls:  {report.total_api_calls}")
    lines.append(f"  Total cost:       ${report.total_cost_usd:.2f}")
    lines.append("")

    # Token breakdown
    lines.append("## Token Usage")
    total_cache = report.total_cache_write_tokens + report.total_cache_read_tokens
    cache_hit = (
        report.total_cache_read_tokens / total_cache if total_cache > 0 else 0
    )
    lines.append(f"  Input (uncached):   {report.total_input_tokens:>12,}")
    lines.append(f"  Cache write:        {report.total_cache_write_tokens:>12,}")
    lines.append(f"  Cache read:         {report.total_cache_read_tokens:>12,}")
    lines.append(f"  Output:             {report.total_output_tokens:>12,}")
    lines.append(
        f"  Total:              {report.total_input_tokens + report.total_cache_write_tokens + report.total_cache_read_tokens + report.total_output_tokens:>12,}"
    )
    lines.append(f"  Cache hit rate:     {cache_hit:>11.1%}")
    lines.append("")

    # Cost breakdown
    lines.append("## Cost Breakdown")
    input_cost = (report.total_input_tokens / 1_000_000) * PRICING["input"]
    output_cost = (report.total_output_tokens / 1_000_000) * PRICING["output"]
    cache_w_cost = (report.total_cache_write_tokens / 1_000_000) * PRICING["cache_write"]
    cache_r_cost = (report.total_cache_read_tokens / 1_000_000) * PRICING["cache_read"]
    lines.append(f"  Input:        ${input_cost:>8.2f}  ({input_cost/report.total_cost_usd*100 if report.total_cost_usd else 0:>4.0f}%)")
    lines.append(f"  Output:       ${output_cost:>8.2f}  ({output_cost/report.total_cost_usd*100 if report.total_cost_usd else 0:>4.0f}%)")
    lines.append(f"  Cache write:  ${cache_w_cost:>8.2f}  ({cache_w_cost/report.total_cost_usd*100 if report.total_cost_usd else 0:>4.0f}%)")
    lines.append(f"  Cache read:   ${cache_r_cost:>8.2f}  ({cache_r_cost/report.total_cost_usd*100 if report.total_cost_usd else 0:>4.0f}%)")
    lines.append(f"  TOTAL:        ${report.total_cost_usd:>8.2f}")
    lines.append("")

    # Per-session breakdown
    lines.append("## Per-Session Breakdown")
    lines.append(
        f"  {'Session ID':<12} {'API Calls':>9} {'In Tok':>10} {'Out Tok':>10} {'Cache%':>7} {'Cost':>8} {'Dur':>6}"
    )
    lines.append("  " + "-" * 66)
    for s in sessions:
        lines.append(
            f"  {s.session_id[:12]:<12} {s.api_calls:>9} "
            f"{s.total_input_tokens:>10,} {s.output_tokens:>10,} "
            f"{s.cache_hit_rate:>6.0%} ${s.cost_usd:>7.2f} {s.duration_minutes:>5.1f}m"
        )
    lines.append("")

    # Tool usage
    lines.append("## Tool Usage (aggregate)")
    all_tools = {}
    for s in sessions:
        for tool, count in s.tool_types.items():
            all_tools[tool] = all_tools.get(tool, 0) + count
    lines.append(f"  Total tool calls: {report.total_tool_calls}")
    for tool, count in sorted(all_tools.items(), key=lambda x: -x[1])[:15]:
        lines.append(f"  {tool:<30} {count:>5}")
    lines.append("")

    # Efficiency metrics
    lines.append("## Efficiency Metrics")
    if report.tasks_completed > 0:
        lines.append(
            f"  Cost per task:        ${report.total_cost_usd / report.tasks_completed:.2f}"
        )
        lines.append(
            f"  API calls per task:   {report.total_api_calls / report.tasks_completed:.1f}"
        )
        lines.append(
            f"  Output tok per task:  {report.total_output_tokens / report.tasks_completed:,.0f}"
        )
    active = [s for s in sessions if s.api_calls > 5]
    if active:
        lines.append(
            f"  Tasks per session:    {report.tasks_completed / len(active):.1f} (across {len(active)} active sessions)"
        )
    lines.append("")

    # Recommendations
    if report.recommendations:
        lines.append("## Recommendations")
        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"  {i}. {rec}")
        lines.append("")

    lines.append("=" * 70)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Analyze harness run metrics")
    parser.add_argument("--date", help="Date to analyze (YYYY-MM-DD)", default=None)
    parser.add_argument("--sessions", nargs="+", help="Specific session IDs")
    parser.add_argument(
        "--save", action="store_true", help="Save report to harness_runs/"
    )
    parser.add_argument(
        "--json", action="store_true", help="Output raw JSON instead of text"
    )
    parser.add_argument(
        "--model",
        choices=["opus", "sonnet", "haiku"],
        default="opus",
        help="Model used for cost estimation (default: opus)",
    )
    args = parser.parse_args()

    # Apply model pricing
    global PRICING
    PRICING = MODEL_PRICING[args.model]

    # Find session files
    if args.sessions:
        session_paths = find_sessions_by_ids(args.sessions)
    elif args.date:
        target = date.fromisoformat(args.date)
        session_paths = find_sessions_by_date(target)
    else:
        # Auto-detect: find most recent date with sessions
        sessions_dir = get_sessions_dir()
        all_dates = set()
        if sessions_dir.exists():
            for f in sessions_dir.glob("*.jsonl"):
                if f.stat().st_size > 0:
                    mtime = datetime.fromtimestamp(f.stat().st_mtime)
                    all_dates.add(mtime.date())
        if not all_dates:
            print("No session files found.", file=sys.stderr)
            sys.exit(1)
        latest = max(all_dates)
        session_paths = find_sessions_by_date(latest)
        print(f"Auto-detected date: {latest}", file=sys.stderr)

    if not session_paths:
        print("No matching session files found.", file=sys.stderr)
        sys.exit(1)

    print(f"Analyzing {len(session_paths)} sessions...", file=sys.stderr)

    # Parse sessions
    sessions = []
    for path in session_paths:
        metrics = parse_session(path)
        sessions.append(metrics)

    # Load task data
    tasks = load_feature_list()
    tasks_completed = sum(1 for t in tasks if t.get("passes", False))

    # Build report
    run_date = args.date or str(max(
        datetime.fromtimestamp(p.stat().st_mtime).date() for p in session_paths
    ))

    report = HarnessRunReport(
        run_date=run_date,
        sessions=[s.session_id for s in sessions],
        total_tasks=len(tasks),
        tasks_completed=tasks_completed,
        total_api_calls=sum(s.api_calls for s in sessions),
        total_input_tokens=sum(s.input_tokens for s in sessions),
        total_output_tokens=sum(s.output_tokens for s in sessions),
        total_cache_write_tokens=sum(s.cache_write_tokens for s in sessions),
        total_cache_read_tokens=sum(s.cache_read_tokens for s in sessions),
        total_cost_usd=sum(s.cost_usd for s in sessions),
        total_tool_calls=sum(s.tool_calls for s in sessions),
    )

    # Generate recommendations
    report.recommendations = generate_recommendations(report, sessions, tasks)

    if args.json:
        output = json.dumps(asdict(report), indent=2)
    else:
        output = format_report(report, sessions)

    print(output)

    # Save if requested
    if args.save:
        RUNS_DIR.mkdir(parents=True, exist_ok=True)
        ext = "json" if args.json else "txt"
        save_path = RUNS_DIR / f"run_{run_date}.{ext}"
        with open(save_path, "w") as f:
            f.write(output)
        print(f"\nSaved to {save_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
