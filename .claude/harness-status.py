#!/usr/bin/env python3
"""Harness status renderer — prints ANSI-colored progress table to terminal."""
import json
import os
import sys

# ── ANSI palette ──────────────────────────────────────────────────────────────
R    = '\033[0m'          # reset
BOLD = '\033[1m'
DIM  = '\033[2m'

# Section headers
H1   = '\033[1;36m'       # bold cyan  (top header)
H2   = '\033[0;36m'       # cyan       (sub-labels)
RULE = '\033[38;5;239m'   # dark gray  (divider lines)

# Priority colors
PRI_HI = '\033[1;31m'     # bold red
PRI_MD = '\033[1;33m'     # bold yellow
PRI_LO = '\033[0;32m'     # green

# Size colors
SZ_S  = '\033[0;32m'      # green
SZ_M  = '\033[0;33m'      # yellow
SZ_L  = '\033[0;31m'      # red
SZ_XL = '\033[1;31m'      # bold red

# Status
DONE_C = '\033[1;32m'     # bold green
TODO_C = '\033[0;33m'     # yellow

# Progress bar chars
BAR_DONE = DONE_C + '█' + R
BAR_TODO = DIM    + '░' + R


# ── helpers ───────────────────────────────────────────────────────────────────

def pri_label(p, padded=True):
    """Colored priority label. padded=True pads text to 8 chars for table alignment."""
    if padded:
        texts  = {'high': 'High    ', 'medium': 'Medium  ', 'low': 'Low     '}
    else:
        texts  = {'high': 'High', 'medium': 'Medium', 'low': 'Low'}
    colors = {'high': PRI_HI, 'medium': PRI_MD, 'low': PRI_LO}
    color  = colors.get(p, R)
    text   = texts.get(p, (p[:8].ljust(8) if padded else p.capitalize()))
    return color + text + R


def sz_label(c, padded=True):
    """Colored size label. padded=True pads text to 5 chars for table alignment."""
    if padded:
        texts  = {'S': 'Small', 'M': 'Med  ', 'L': 'Large', 'XL': 'XL   '}
    else:
        texts  = {'S': 'Small', 'M': 'Med', 'L': 'Large', 'XL': 'XL'}
    colors = {'S': SZ_S, 'M': SZ_M, 'L': SZ_L, 'XL': SZ_XL}
    color  = colors.get(c, R)
    text   = texts.get(c, (c[:5].ljust(5) if padded else c))
    return color + text + R


def status_icon(passes):
    return (DONE_C + '✓' + R) if passes else (TODO_C + '○' + R)


def trunc(s, n):
    s = s.replace('\n', ' ').strip()
    return (s[:n - 1] + '…') if len(s) > n else s


def progress_bar(done, total, width=20):
    if total == 0:
        return DIM + '░' * width + R
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
        print('No feature_list.json found. Run ./harness.sh --init first.')
        sys.exit(1)

    with open(feature_list) as f:
        tasks = json.load(f)

    total = len(tasks)
    done  = sum(1 for t in tasks if t.get('passes'))
    todo  = total - done
    tw    = min(term_width(), 140)
    rule_w = min(tw - 2, 90)

    # ── header ──────────────────────────────────────────────────────────────
    rule = H1 + '  ' + '━' * rule_w + R
    print()
    print(rule)
    pct = round(done / total * 100) if total else 0
    print(H1 + BOLD + f'  Mega Knights Harness  ·  {done}/{total} tasks  ({pct}%)' + R)
    print(rule)

    # Overall progress bar
    print()
    overall = progress_bar(done, total, width=40)
    print(f'  {overall}  {DONE_C}{done}{R}/{total}')

    # ── breakdown by priority ────────────────────────────────────────────────
    print()
    print(H2 + '  Priority Breakdown' + R)
    order  = ['high', 'medium', 'low']
    by_pri = {p: [0, 0] for p in order}
    for t in tasks:
        p = t.get('priority', 'low')
        if p in by_pri:
            by_pri[p][0 if t.get('passes') else 1] += 1
    pri_words  = {'high': 'High  ', 'medium': 'Medium', 'low': 'Low   '}
    pri_colors = {'high': PRI_HI,   'medium': PRI_MD,   'low': PRI_LO}
    for p in order:
        d, r  = by_pri[p]
        bar   = progress_bar(d, d + r, width=16)
        color = pri_colors.get(p, R)
        word  = pri_words.get(p, p[:6].ljust(6))
        print(f'    {color}{word}{R}  {bar}  {d}/{d + r}')

    # ── breakdown by category ────────────────────────────────────────────────
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
        print(f'    {c:<12}  {bar}  {d}/{d + r}')

    # ── session estimate ─────────────────────────────────────────────────────
    if todo > 0:
        weights = {'S': 0.3, 'M': 0.5, 'L': 1.0, 'XL': 1.5}
        est = sum(weights.get(t.get('complexity', 'M'), 0.5)
                  for t in tasks if not t.get('passes'))
        print()
        print(f'  {DIM}Estimated remaining: ~{est:.1f} sessions{R}')

    # ── task table ───────────────────────────────────────────────────────────
    # Visible column widths (content only, not gaps):
    #   id=4  status=1  priority=8  size=5  category=12  title=remaining
    W_CAT   = 12
    # Gap layout:  2-lead  4-id  2  1-status  2  8-pri  2  5-sz  2  12-cat  2  title
    W_FIXED = 2 + 4 + 2 + 1 + 2 + 8 + 2 + 5 + 2 + W_CAT + 2
    W_TITLE = max(20, min(70, tw - W_FIXED))

    divider = RULE + '  ' + '─' * min(tw - 4, 90) + R
    print()
    print(divider)
    hdr = (f'  {"#":>4}  {"":1}  {"Priority":<8}  {"Size":<5}  '
           f'{"Category":<{W_CAT}}  {"Title":<{W_TITLE}}')
    print(DIM + hdr + R)
    print(divider)

    for t in tasks:
        passes = t.get('passes', False)
        icon   = status_icon(passes)
        p      = pri_label(t.get('priority', 'low'), padded=True)
        sz     = sz_label(t.get('complexity', 'M'), padded=True)
        cat    = trunc(t.get('category', 'other'), W_CAT)
        raw    = t.get('title') or t.get('description', '')
        title  = trunc(raw, W_TITLE)
        d      = DIM if passes else ''
        print(f'  {d}#{t["id"]:>3}{R}  {icon}  {p}  {sz}  {d}{cat:<{W_CAT}}{R}  {d}{title}{R}')

    print()
    print(divider)
    if todo == 0:
        print(DONE_C + BOLD + '  ✓ All tasks complete! Run ./harness.sh --init to find new work.' + R)
    else:
        pending = [t for t in tasks if not t.get('passes')]
        nxt     = pending[0]
        nxt_raw = nxt.get('title') or nxt.get('description', '')
        pri_str = pri_label(nxt['priority'], padded=False)
        sz_str  = sz_label(nxt.get('complexity', 'M'), padded=False)
        print(f'  Next: {BOLD}#{nxt["id"]}{R} [{pri_str} / {sz_str}]  {trunc(nxt_raw, 60)}')
    print()


if __name__ == '__main__':
    main()
