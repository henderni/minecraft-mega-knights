/**
 * quest-journal.test.ts
 *
 * Validates QuestJournalSystem wiring and structure using source-as-text pattern.
 * QuestJournalSystem imports @minecraft/server, so we read it as text.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const journalSrc = readSource("systems/QuestJournalSystem.ts");
const stringsSrc = readSource("data/Strings.ts");

// ─── String constant references ─────────────────────────────────────────────

describe("QuestJournalSystem: references all JOURNAL_* strings", () => {
  const journalConstants = [
    "JOURNAL_TITLE",
    "JOURNAL_OVERVIEW_TITLE",
    "JOURNAL_OVERVIEW_BODY",
    "JOURNAL_ARMY_TITLE",
    "JOURNAL_ARMY_BODY",
    "JOURNAL_STANCES_TITLE",
    "JOURNAL_STANCES_BODY",
    "JOURNAL_BESTIARY_TITLE",
    "JOURNAL_CASTLES_TITLE",
    "JOURNAL_CASTLES_BODY",
    "JOURNAL_ENDLESS_TITLE",
    "JOURNAL_ENDLESS_BODY",
  ];

  for (const name of journalConstants) {
    it(`references ${name}`, () => {
      expect(journalSrc).toContain(name);
    });
  }

  it("imports all journal strings from Strings.ts", () => {
    // Verify the import statement pulls from data/Strings
    expect(journalSrc).toContain('from "../data/Strings"');
  });
});

// ─── Endless mode conditional ───────────────────────────────────────────────

describe("QuestJournalSystem: endless mode support", () => {
  it("checks isEndlessMode for conditional button", () => {
    expect(journalSrc).toContain("isEndlessMode()");
  });

  it("adds endless button conditionally", () => {
    expect(journalSrc).toContain("JOURNAL_ENDLESS_TITLE");
  });

  it("shows endless page on button press", () => {
    expect(journalSrc).toContain("JOURNAL_ENDLESS_BODY");
  });
});

// ─── Bestiary display ───────────────────────────────────────────────────────

describe("QuestJournalSystem: bestiary display", () => {
  it("imports BESTIARY from data", () => {
    expect(journalSrc).toContain("BESTIARY");
    expect(journalSrc).toContain("BestiaryDefinitions");
  });

  it("iterates all BESTIARY entries", () => {
    expect(journalSrc).toMatch(/for\s*\(\s*const\s+entry\s+of\s+BESTIARY\s*\)/);
  });

  it("reads kill count from player dynamic property", () => {
    expect(journalSrc).toContain("entry.killKey");
    expect(journalSrc).toContain("getDynamicProperty");
  });
});

// ─── TOC button count matches switch cases ──────────────────────────────────

describe("QuestJournalSystem: TOC and switch case alignment", () => {
  it("has 5 base buttons (overview, army, stances, bestiary, castles)", () => {
    // Count .button() calls in showTOC
    const buttonMatches = journalSrc.match(/\.button\(/g);
    expect(buttonMatches).not.toBeNull();
    // 5 base + 1 conditional endless = 6 total .button calls
    expect(buttonMatches!.length).toBe(6);
  });

  it("has switch cases 0 through 5", () => {
    for (let i = 0; i <= 5; i++) {
      expect(journalSrc).toContain(`case ${i}:`);
    }
  });
});

// ─── DayCounterSystem integration ───────────────────────────────────────────

describe("QuestJournalSystem: uses DayCounterSystem", () => {
  it("receives DayCounterSystem in constructor", () => {
    expect(journalSrc).toContain("DayCounterSystem");
    expect(journalSrc).toMatch(/constructor\s*\(\s*dayCounter/);
  });

  it("uses getCurrentDay() for day display", () => {
    expect(journalSrc).toContain("getCurrentDay()");
  });

  it("does not use getDynamicProperty for day value", () => {
    // Should NOT read mk:current_day directly
    expect(journalSrc).not.toContain('"mk:current_day"');
  });
});

// ─── DifficultySystem integration ───────────────────────────────────────────

describe("QuestJournalSystem: uses DifficultySystem for recruit chance", () => {
  it("imports DifficultySystem", () => {
    expect(journalSrc).toContain("DifficultySystem");
  });

  it("receives DifficultySystem in constructor", () => {
    expect(journalSrc).toMatch(/constructor\s*\(\s*dayCounter.*difficulty/s);
  });

  it("calls getRecruitChance()", () => {
    expect(journalSrc).toContain("getRecruitChance()");
  });

  it("passes recruit percentage to JOURNAL_OVERVIEW_BODY", () => {
    expect(journalSrc).toContain("JOURNAL_OVERVIEW_BODY(pct)");
  });

  it("passes recruit percentage to JOURNAL_ARMY_BODY", () => {
    expect(journalSrc).toContain("JOURNAL_ARMY_BODY(pct)");
  });
});

// ─── Strings.ts: JOURNAL_OVERVIEW_BODY and JOURNAL_ARMY_BODY are functions ─

describe("Strings.ts: journal body strings accept recruitPct", () => {
  it("JOURNAL_OVERVIEW_BODY is a function taking recruitPct", () => {
    expect(stringsSrc).toMatch(/JOURNAL_OVERVIEW_BODY\s*=\s*\(\s*recruitPct/);
  });

  it("JOURNAL_ARMY_BODY is a function taking recruitPct", () => {
    expect(stringsSrc).toMatch(/JOURNAL_ARMY_BODY\s*=\s*\(\s*recruitPct/);
  });

  it("JOURNAL_OVERVIEW_BODY interpolates the percentage", () => {
    expect(stringsSrc).toMatch(/recruitPct.*%.*recruit/s);
  });
});
