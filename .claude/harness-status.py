#!/usr/bin/env python3
"""Harness status renderer — prints ANSI-colored progress table to terminal."""
import json
import os
import sys

# ── ANSI palette ──────────────────────────────────────────────────────────────
R    = '\033[0m'       # reset
BOLD = '\033[1m'
DIM  = '\033[2m'

# Headers
H1   = '\033[1;36m'   # bold cyan  (section titles)
H2   = '\033[0;36m'   # cyan       (sub-labels)
BAR  = '\033[38;5;239m'  # dark gray (dividers)

# Priority
PRI_HI = '\033[1;31m'   # bold red
PRI_MD = '\033[1;33m'   # bold yellow
PRI_LO = '\033[0;32m'   # green

# Complexity
CPX_S  = '\033[0;32m'   # green
CPX_M  = '\033[0;33m'   # yellow
CPX_L  = '\033[0;31m'   # red
CPX_XL = '\033[1;31m'   # bold red

# Status
DONE_C = '\033[1;32m'   # bold green
TODO_C = '\033[0;33m'   # yellow

# Progress bar chars
BAR_DONE = DONE_C + '█' + R
BAR_TODO = DIM    + '░' + R

# ── helpers ───────────────────────────────────────────────────────────────────
def pri_label(p):
    m = {'high': (PRI_HI, 'Hi'), 'medium': (PRI_MD, 'Md'), 'low': (PRI_LO, 'Lo')}
    c, t = m.get(p, (R, p[:2]))
    return c + t + R

def cpx_label(c):
    m = {'S': CPX_S, 'M': CPX_M, 'L': CPX_L, 'XL': CPX_XL}
    return m.get(c, R) + c + R

def cat_abbr(c):
    return {'functional': 'func', 'test': 'test', 'performance': 'perf',
            'content': 'cont', 'polish': 'pol'}.get(c, c[:4])

def status_icon(passes):
    return (DONE_C + '✓' + R) if passes else (TODO_C + '○' + R)

def trunc(s, n):
    return s[:n - 1] + '…' if len(s) > n else s

def progress_bar(done, total, width=20):
    if total == 0:
        return ''
    filled = round(done / total * width)
    return ''.join([BAR_DONE] * filled + [BAR_TODO] * (width - filled))

def term_width():
    try:
        return os.get_terminal_size().columns
    except Exception:
        return 120

# ── main ──────────────────────────────────────────────────────────────────────
def main():
    feature_list = os.path.join(os.path.dirname(__file__), 'feature_list.json')
    if not os.path.exists(feature_list):
        print('No feature_list.json found. Run /harness init first.')
        sys.exit(1)

    with open(feature_list) as f:
        tasks = json.load(f)

    total = len(tasks)
    done  = sum(1 for t in tasks if t.get('passes'))
    todo  = total - done
    tw    = term_width()

    # ── header ─────────────────────────────────────────────────────────────
    rule = H1 + '━' * min(tw, 90) + R
    print()
    print(rule)
    pct = round(done / total * 100) if total else 0
    print(H1 + f'  Mega Knights Harness  ·  {done}/{total} tasks  ({pct}%)' + R)
    print(rule)

    # overall bar
    print()
    overall = progress_bar(done, total, width=40)
    print(f'  {overall}  {DONE_C}{done}{R}/{total}')

    # ── breakdown by priority ───────────────────────────────────────────────
    print()
    print(H2 + '  Priority Breakdown' + R)
    order = ['high', 'medium', 'low']
    by_pri = {p: [0, 0] for p in order}
    for t in tasks:
        p = t.get('priority', 'low')
        if p in by_pri:
            by_pri[p][0 if t.get('passes') else 1] += 1
    for p in order:
        d, r = by_pri[p]
        bar  = progress_bar(d, d + r, width=16)
        lbl  = pri_label(p)
        print(f'    {lbl}  {bar}  {d}/{d + r}')

    # ── breakdown by category ───────────────────────────────────────────────
    print()
    print(H2 + '  Category Breakdown' + R)
    by_cat = {}
    for t in tasks:
        c = t.get('category', 'other')
        if c not in by_cat:
            by_cat[c] = [0, 0]
        by_cat[c][0 if t.get('passes') else 1] += 1
    for c, (d, r) in sorted(by_cat.items(), key=lambda x: -(x[1][0] + x[1][1])):
        bar = progress_bar(d, d + r, width=16)
        print(f'    {cat_abbr(c):6s}  {bar}  {d}/{d + r}')

    # ── session estimate ────────────────────────────────────────────────────
    if todo > 0:
        cplx_counts = {'S': 0, 'M': 0, 'L': 0, 'XL': 0}
        for t in tasks:
            if not t.get('passes'):
                cplx_counts[t.get('complexity', 'M')] = cplx_counts.get(t.get('complexity', 'M'), 0) + 1
        est = (cplx_counts.get('S', 0) * 0.3 +
               cplx_counts.get('M', 0) * 0.5 +
               cplx_counts.get('L', 0) * 1.0 +
               cplx_counts.get('XL', 0) * 1.5)
        print()
        print(f'  {DIM}Estimated remaining: ~{est:.1f} sessions{R}')

    # ── task table ──────────────────────────────────────────────────────────
    # Column widths: #4  status1  pri2  sz2  cat6  desc(rest)
    fixed_cols = 4 + 2 + 1 + 2 + 2 + 2 + 6 + 2  # col content + gaps
    # rough ANSI overhead per row ≈ 0; we calc visible width only
    W_DESC = max(20, min(55, tw - 30))

    print()
    print(BAR + '  ' + '─' * min(tw - 4, 86) + R)
    hdr = (f'  {"#":>4}  {"":1}  {"Pri":3}  {"Sz":2}  {"Cat":6}  '
           f'{"Description":<{W_DESC}}')
    print(DIM + hdr + R)
    print(BAR + '  ' + '─' * min(tw - 4, 86) + R)

    for t in tasks:
        passes  = t.get('passes', False)
        icon    = status_icon(passes)
        p       = pri_label(t.get('priority', 'low'))
        sz      = cpx_label(t.get('complexity', 'M'))
        cat     = cat_abbr(t.get('category', 'other'))
        desc    = trunc(t['description'].replace('\n', ' '), W_DESC)
        row_dim = DIM if passes else ''
        print(f'  {row_dim}#{t["id"]:>3}{R}  {icon}  {p}   {sz}  {row_dim}{cat:6}{R}  {row_dim}{desc}{R}')

    print()
    print(BAR + '  ' + '─' * min(tw - 4, 86) + R)
    if todo == 0:
        print(DONE_C + BOLD + '  All tasks complete! Run /harness init to find new work.' + R)
    else:
        pending = [t for t in tasks if not t.get('passes')]
        nxt = pending[0]
        print(f'  Next: {BOLD}#{nxt["id"]}{R} [{pri_label(nxt["priority"])} / {cpx_label(nxt["complexity"])}] '
              f'{trunc(nxt["description"], 60)}')
    print()

if __name__ == '__main__':
    main()
