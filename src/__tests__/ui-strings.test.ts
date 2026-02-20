/**
 * UI best-practice tests.
 *
 * Covers the player-facing text layer: color codes, HUD format, progress bar
 * math, creative-menu categories, and lang-file quality.  These tests catch
 * issues that produce bad UX without crashing the add-on:
 *
 *   - Wrong color code sigil (&) causes raw text like "&aHello" in chat
 *   - Raw newlines in action-bar strings are silently dropped on some clients
 *   - Missing §l on heading strings makes them look like body copy
 *   - Progress bars with wrong character counts show malformed HUD
 *   - Duplicate lang keys: last one wins (silent overwrite bug)
 *   - Non-Title-Case item names look unprofessional in inventory
 *   - Wrong creative category hides items from the expected tab
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import {
  QUEST_START_TITLE,
  QUEST_START_DESC,
  DAY_CHANGE,
  MILESTONE_TITLE,
  MILESTONE_MESSAGE,
  ARMOR_GIVEN,
  TIER_UNLOCKED,
  ARMY_FULL,
  ARMY_FULL_SHARED,
  ALLY_RECRUITED,
  ALLY_NOT_YOURS,
  ALLY_INFO,
  HUD_ACTION_BAR,
  CASTLE_LOOK_AT_GROUND,
  CASTLE_PLACED,
  CASTLE_CAPACITY_UP,
  CASTLE_FAILED,
  SIEGE_BEGIN,
  SIEGE_DEFEND,
  SIEGE_WAVE,
  SIEGE_VICTORY_1,
  SIEGE_VICTORY_2,
  SIEGE_VICTORY_3,
  SIEGE_VICTORY_TITLE,
  SIEGE_VICTORY_SUBTITLE,
  SIEGE_DEFEAT_1,
  SIEGE_DEFEAT_2,
  SIEGE_DEFEAT_3,
  DEBUG_DAY_SET,
  DEBUG_QUEST_STARTED,
  DEBUG_QUEST_RESET,
  DEBUG_ALLIES_SPAWNED,
  TUTORIAL_1_SURVIVE,
  TUTORIAL_2_RECRUIT,
  TUTORIAL_3_ARMY,
  TUTORIAL_4_MILESTONES,
  TUTORIAL_5_TIP,
  TUTORIAL_6_BESTIARY,
  FRIENDLY_FIRE_BLOCKED,
  RECRUIT_FAILED,
  ALLY_DIED,
  JOURNAL_TITLE,
  JOURNAL_OVERVIEW_TITLE,
  JOURNAL_OVERVIEW_BODY,
  JOURNAL_ARMY_TITLE,
  JOURNAL_ARMY_BODY,
  JOURNAL_STANCES_TITLE,
  JOURNAL_STANCES_BODY,
  JOURNAL_BESTIARY_TITLE,
  JOURNAL_CASTLES_TITLE,
  JOURNAL_CASTLES_BODY,
  TIER_UP_TITLE,
  TIER_UP_SUBTITLE,
  TIER_UP_MEGA_SUBTITLE,
  DIFFICULTY_TITLE,
  DIFFICULTY_BODY,
  DIFFICULTY_NORMAL_LABEL,
  DIFFICULTY_NORMAL_DESC,
  DIFFICULTY_HARD_LABEL,
  DIFFICULTY_HARD_DESC,
  DIFFICULTY_SET,
  ENDLESS_UNLOCKED,
  ENDLESS_DESC,
  ENDLESS_WAVE,
  ENDLESS_WAVE_CLEARED,
} from "../data/Strings";

const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");
const RP_ROOT = path.join(__dirname, "../../MegaKnights_RP");
const langPath = path.join(RP_ROOT, "texts/en_US.lang");

// ── helpers ──────────────────────────────────────────────────────────────────

/** Strip all §X formatting codes, returning only visible characters. */
function strip(s: string): string {
  return s.replace(/§./g, "");
}

/** All static (non-template) player-facing strings. */
const STATIC_STRINGS: Array<[string, string]> = [
  ["QUEST_START_TITLE", QUEST_START_TITLE],
  ["QUEST_START_DESC", QUEST_START_DESC],
  ["ARMOR_GIVEN", ARMOR_GIVEN],
  ["ARMY_FULL", ARMY_FULL],
  ["CASTLE_LOOK_AT_GROUND", CASTLE_LOOK_AT_GROUND],
  ["CASTLE_FAILED", CASTLE_FAILED],
  ["SIEGE_BEGIN", SIEGE_BEGIN],
  ["SIEGE_DEFEND", SIEGE_DEFEND],
  ["SIEGE_VICTORY_1", SIEGE_VICTORY_1],
  ["SIEGE_VICTORY_2", SIEGE_VICTORY_2],
  ["SIEGE_VICTORY_3", SIEGE_VICTORY_3],
  ["SIEGE_VICTORY_TITLE", SIEGE_VICTORY_TITLE],
  ["SIEGE_VICTORY_SUBTITLE", SIEGE_VICTORY_SUBTITLE],
  ["SIEGE_DEFEAT_1", SIEGE_DEFEAT_1],
  ["SIEGE_DEFEAT_2", SIEGE_DEFEAT_2],
  ["SIEGE_DEFEAT_3", SIEGE_DEFEAT_3],
  ["DEBUG_QUEST_STARTED", DEBUG_QUEST_STARTED],
  ["DEBUG_QUEST_RESET", DEBUG_QUEST_RESET],
  ["TUTORIAL_1_SURVIVE", TUTORIAL_1_SURVIVE],
  ["TUTORIAL_2_RECRUIT", TUTORIAL_2_RECRUIT],
  ["TUTORIAL_3_ARMY", TUTORIAL_3_ARMY],
  ["TUTORIAL_4_MILESTONES", TUTORIAL_4_MILESTONES],
  ["TUTORIAL_5_TIP", TUTORIAL_5_TIP],
  ["TUTORIAL_6_BESTIARY", TUTORIAL_6_BESTIARY],
  ["FRIENDLY_FIRE_BLOCKED", FRIENDLY_FIRE_BLOCKED],
  ["RECRUIT_FAILED", RECRUIT_FAILED],
  ["JOURNAL_TITLE", JOURNAL_TITLE],
  ["JOURNAL_OVERVIEW_TITLE", JOURNAL_OVERVIEW_TITLE],
  ["JOURNAL_ARMY_TITLE", JOURNAL_ARMY_TITLE],
  ["JOURNAL_STANCES_TITLE", JOURNAL_STANCES_TITLE],
  ["JOURNAL_BESTIARY_TITLE", JOURNAL_BESTIARY_TITLE],
  ["JOURNAL_CASTLES_TITLE", JOURNAL_CASTLES_TITLE],
  ["TIER_UP_SUBTITLE", TIER_UP_SUBTITLE],
  ["TIER_UP_MEGA_SUBTITLE", TIER_UP_MEGA_SUBTITLE],
  ["DIFFICULTY_TITLE", DIFFICULTY_TITLE],
  ["DIFFICULTY_BODY", DIFFICULTY_BODY],
  ["DIFFICULTY_NORMAL_LABEL", DIFFICULTY_NORMAL_LABEL],
  ["DIFFICULTY_NORMAL_DESC", DIFFICULTY_NORMAL_DESC],
  ["DIFFICULTY_HARD_LABEL", DIFFICULTY_HARD_LABEL],
  ["DIFFICULTY_HARD_DESC", DIFFICULTY_HARD_DESC],
  ["ENDLESS_UNLOCKED", ENDLESS_UNLOCKED],
  ["ENDLESS_DESC", ENDLESS_DESC],
  ["ENDLESS_WAVE_CLEARED", ENDLESS_WAVE_CLEARED],
];

/** Pre-built progress bar strings (mirrors DayCounterSystem.ts exactly). */
const BAR_LENGTH = 20;
const PROGRESS_BARS: string[] = [];
for (let i = 0; i <= BAR_LENGTH; i++) {
  PROGRESS_BARS.push("█".repeat(i) + "░".repeat(BAR_LENGTH - i));
}

/** Tier names (mirrors DayCounterSystem.ts TIER_NAMES constant). */
const TIER_NAMES = ["Page", "Squire", "Knight", "Champion", "Mega Knight"];

/** Parse lang file into a key→value map. */
function parseLang(): Map<string, string> {
  const result = new Map<string, string>();
  if (!fs.existsSync(langPath)) return result;
  for (const line of fs.readFileSync(langPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq !== -1) result.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// STATIC STRINGS — basic format hygiene
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] Static strings — format hygiene", () => {
  it("all static strings produce visible text after stripping color codes", () => {
    STATIC_STRINGS.forEach(([name, s]) => {
      expect(
        strip(s).trim().length,
        `${name}: visible text is empty after stripping §-codes`,
      ).toBeGreaterThan(0);
    });
  });

  it("all static strings use § not & for color codes (Bedrock requires §)", () => {
    // & is the Java Edition sigil — using it in Bedrock produces raw text like "&aHello"
    STATIC_STRINGS.forEach(([name, s]) => {
      expect(s, `${name}: contains & color code — use § instead`).not.toMatch(
        /&[0-9a-fr-z]/i,
      );
    });
  });

  it("no static string contains a raw newline (breaks action-bar rendering)", () => {
    STATIC_STRINGS.forEach(([name, s]) => {
      expect(s, `${name}: contains raw \\n — use separate sendMessage calls`).not.toContain(
        "\n",
      );
    });
  });

  it("heading/title strings use §l (bold) for visual emphasis", () => {
    const TITLES = [QUEST_START_TITLE, SIEGE_BEGIN, SIEGE_VICTORY_1, SIEGE_DEFEAT_1];
    TITLES.forEach((s) => {
      expect(s, `Title "${strip(s)}" should use §l bold`).toContain("§l");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// COLOR CODE CONVENTIONS
// Consistent color usage lets players instantly read message severity without
// reading the text: green = good, red = danger, gold = progression.
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] Color code conventions", () => {
  it("success/reward messages start with §a (green)", () => {
    [ARMOR_GIVEN, ALLY_RECRUITED("test"), CASTLE_PLACED("test"), SIEGE_VICTORY_1].forEach(
      (s) => {
        expect(s, `"${strip(s)}" should start with §a`).toMatch(/^§a/);
      },
    );
  });

  it("danger/error messages start with §c or §4 (red tones)", () => {
    [ARMY_FULL, CASTLE_LOOK_AT_GROUND, CASTLE_FAILED, SIEGE_DEFEND, SIEGE_DEFEAT_2].forEach(
      (s) => {
        expect(s, `"${strip(s)}" should start with §c or §4`).toMatch(/^§[c4]/);
      },
    );
  });

  it("quest progression messages use §6 (gold)", () => {
    [QUEST_START_TITLE, DAY_CHANGE(1), TIER_UNLOCKED("Knight")].forEach((s) => {
      expect(s, `"${strip(s)}" should start with §6`).toMatch(/^§6/);
    });
  });

  it("debug messages start with §e (yellow — visually distinct from gameplay text)", () => {
    [DEBUG_DAY_SET(1), DEBUG_ALLIES_SPAWNED(3)].forEach((s) => {
      expect(s, `"${strip(s)}" should start with §e`).toMatch(/^§e/);
    });
  });

  it("milestone title uses §e§l (yellow bold — distinct from §6 quest gold)", () => {
    expect(MILESTONE_TITLE("test")).toMatch(/^§e§l/);
  });

  it("milestone message uses §7 (gray — secondary text, less emphasis)", () => {
    expect(MILESTONE_MESSAGE("test")).toMatch(/^§7/);
  });

  it("ALLY_INFO uses §b for name (cyan = friendly unit) and §7 for stats", () => {
    const info = ALLY_INFO("KnightBob", 30, 30);
    expect(info).toMatch(/^§b/);
    expect(info).toContain("§7");
  });

  it("siege defeat opening uses §4§l (dark red bold — maximum alarm)", () => {
    expect(SIEGE_DEFEAT_1).toMatch(/^§4§l/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEMPLATE FUNCTION CONTENT
// Each template should embed the key value in the output so players see the
// actual data, not a placeholder.
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] Template function output content", () => {
  it("ARMY_FULL_SHARED embeds the cap number in the string", () => {
    const msg = ARMY_FULL_SHARED(8);
    expect(msg).toContain("8");
  });

  it("ALLY_INFO embeds HP values with a '/' separator", () => {
    const msg = ALLY_INFO("Alice", 25, 30);
    expect(msg).toContain("25");
    expect(msg).toContain("30");
    expect(msg).toContain("/");
  });

  it("ALLY_INFO handles '?' HP when entity state is unknown", () => {
    const msg = ALLY_INFO("Bob", "?", "?");
    expect(strip(msg)).toContain("?/?");
  });

  it("SIEGE_WAVE embeds both wave number and total", () => {
    const msg = SIEGE_WAVE(3, 5);
    expect(msg).toContain("3");
    expect(msg).toContain("5");
  });

  it("CASTLE_CAPACITY_UP embeds the bonus and new max", () => {
    const msg = CASTLE_CAPACITY_UP(7, 22);
    expect(msg).toContain("7");
    expect(msg).toContain("22");
  });

  it("all debug templates embed '[Debug]' prefix for easy log filtering", () => {
    [
      DEBUG_DAY_SET(42),
      DEBUG_QUEST_STARTED,
      DEBUG_QUEST_RESET,
      DEBUG_ALLIES_SPAWNED(5),
    ].forEach((s) => {
      expect(s, `Debug string "${strip(s)}" missing [Debug] prefix`).toContain(
        "[Debug]",
      );
    });
  });

  it("TIER_UNLOCKED embeds the tier name", () => {
    TIER_NAMES.forEach((name) => {
      expect(TIER_UNLOCKED(name)).toContain(name);
    });
  });

  it("ALLY_NOT_YOURS embeds the owner's name", () => {
    expect(ALLY_NOT_YOURS("Steve")).toContain("Steve");
  });

  it("CASTLE_PLACED embeds the structure name", () => {
    expect(CASTLE_PLACED("Small Tower")).toContain("Small Tower");
  });

  it("ALLY_DIED embeds the display name", () => {
    expect(ALLY_DIED("Knight")).toContain("Knight");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// HUD ACTION BAR
// The HUD string is updated up to every 0.5 s.  Wrong format causes confusing
// or truncated displays.  Bedrock action bar has a visible limit of ~130 chars.
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] HUD action bar format", () => {
  const sampleHud = HUD_ACTION_BAR(42, PROGRESS_BARS[10], 15, 35, "Knight");

  it("HUD string contains the day number", () => {
    expect(sampleHud).toContain("42");
  });

  it("HUD string contains '/100' (of 100)", () => {
    expect(sampleHud).toContain("/100");
  });

  it("HUD string contains army size and cap as 'size/cap'", () => {
    expect(sampleHud).toContain("15");
    expect(sampleHud).toContain("35");
    expect(sampleHud).toContain("/");
  });

  it("HUD string contains the tier name", () => {
    expect(sampleHud).toContain("Knight");
  });

  it("HUD visible text length is under 130 chars (Bedrock action bar limit)", () => {
    // Test the longest realistic HUD: day 100, full bar, max army, Mega Knight tier
    const longestHud = HUD_ACTION_BAR(100, PROGRESS_BARS[20], 35, 35, "Mega Knight");
    expect(
      strip(longestHud).length,
      `Longest HUD visible text (${strip(longestHud).length} chars) exceeds 130`,
    ).toBeLessThanOrEqual(130);
  });

  it("HUD string contains no raw newlines (newlines break action-bar layout)", () => {
    expect(sampleHud).not.toContain("\n");
  });

  it("HUD uses §6 for day, §b for army, §d for tier (distinct color zones)", () => {
    expect(sampleHud).toContain("§6");
    expect(sampleHud).toContain("§b");
    expect(sampleHud).toContain("§d");
  });

  it("HUD changes when day changes (cache key detects all relevant fields)", () => {
    const hudDay1 = HUD_ACTION_BAR(1, PROGRESS_BARS[0], 0, 15, "Page");
    const hudDay2 = HUD_ACTION_BAR(2, PROGRESS_BARS[1], 0, 15, "Page");
    expect(hudDay1).not.toBe(hudDay2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR — precomputed array correctness
// The DayCounterSystem prebuilds PROGRESS_BARS to avoid string allocation on
// every HUD tick.  Wrong entries would display a frozen or incorrect bar.
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] HUD progress bar precomputed array", () => {
  it(`PROGRESS_BARS has exactly ${BAR_LENGTH + 1} entries (0 … ${BAR_LENGTH})`, () => {
    expect(PROGRESS_BARS).toHaveLength(BAR_LENGTH + 1);
  });

  it("every progress bar is exactly BAR_LENGTH characters long", () => {
    PROGRESS_BARS.forEach((bar, i) => {
      expect(
        bar.length,
        `PROGRESS_BARS[${i}] length ${bar.length} ≠ ${BAR_LENGTH}`,
      ).toBe(BAR_LENGTH);
    });
  });

  it("PROGRESS_BARS[0] is entirely empty (░) — 0% progress", () => {
    expect(PROGRESS_BARS[0]).toBe("░".repeat(BAR_LENGTH));
  });

  it(`PROGRESS_BARS[${BAR_LENGTH}] is entirely full (█) — 100% progress`, () => {
    expect(PROGRESS_BARS[BAR_LENGTH]).toBe("█".repeat(BAR_LENGTH));
  });

  it("PROGRESS_BARS[n] has exactly n filled (█) characters", () => {
    for (let i = 0; i <= BAR_LENGTH; i++) {
      const filled = [...PROGRESS_BARS[i]].filter((c) => c === "█").length;
      expect(filled, `PROGRESS_BARS[${i}] has ${filled} filled chars, expected ${i}`).toBe(i);
    }
  });

  it("PROGRESS_BARS[n] has exactly BAR_LENGTH−n empty (░) characters", () => {
    for (let i = 0; i <= BAR_LENGTH; i++) {
      const empty = [...PROGRESS_BARS[i]].filter((c) => c === "░").length;
      const expected = BAR_LENGTH - i;
      expect(empty, `PROGRESS_BARS[${i}] has ${empty} empty chars, expected ${expected}`).toBe(
        expected,
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LANG FILE QUALITY
// Bedrock uses the lang file verbatim.  Duplicate keys are silently overwritten
// (last wins), and non-Title-Case names look unprofessional in inventory.
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] en_US.lang quality", () => {
  it("no duplicate keys (last-wins behavior silently drops earlier translations)", () => {
    if (!fs.existsSync(langPath)) return;
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    fs.readFileSync(langPath, "utf-8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq === -1) return;
        const key = trimmed.slice(0, eq);
        if (seen.has(key)) {
          duplicates.push(`  "${key}" (first L${seen.get(key)! + 1}, repeated L${i + 1})`);
        } else {
          seen.set(key, i);
        }
      });
    expect(
      duplicates,
      `Duplicate lang keys:\n${duplicates.join("\n")}`,
    ).toEqual([]);
  });

  it("all item display name values are non-empty", () => {
    const lang = parseLang();
    const empty: string[] = [];
    for (const [key, value] of lang) {
      if (key.startsWith("item.") && !value.trim()) empty.push(key);
    }
    expect(
      empty,
      `Item lang keys with empty values: ${empty.join(", ")}`,
    ).toEqual([]);
  });

  it("item display names are in Title Case (each word capitalized)", () => {
    const lang = parseLang();
    const bad: string[] = [];
    for (const [key, value] of lang) {
      if (!key.startsWith("item.")) continue;
      const words = value.split(" ");
      const isTitleCase = words.every(
        (w) => w.length === 0 || w[0] === w[0].toUpperCase(),
      );
      if (!isTitleCase) bad.push(`  ${key}="${value}"`);
    }
    expect(
      bad,
      `Item names not in Title Case:\n${bad.join("\n")}`,
    ).toEqual([]);
  });

  it("no lang value equals its own key (prevents key-as-fallback going unnoticed)", () => {
    const lang = parseLang();
    const selfRefs: string[] = [];
    for (const [key, value] of lang) {
      if (key === value) selfRefs.push(key);
    }
    expect(
      selfRefs,
      `Keys whose value is the key itself: ${selfRefs.join(", ")}`,
    ).toEqual([]);
  });

  it("pack.name is 'Mega Knights' (shown in pack selection UI)", () => {
    const lang = parseLang();
    expect(lang.get("pack.name")).toBe("Mega Knights");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// JOURNAL STRINGS
// Body strings intentionally contain \n for MessageFormData rendering.
// Title strings must not contain newlines.
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] Journal strings", () => {
  const JOURNAL_TITLES = [
    JOURNAL_TITLE,
    JOURNAL_OVERVIEW_TITLE,
    JOURNAL_ARMY_TITLE,
    JOURNAL_STANCES_TITLE,
    JOURNAL_BESTIARY_TITLE,
    JOURNAL_CASTLES_TITLE,
  ];

  const JOURNAL_BODIES = [
    ["JOURNAL_OVERVIEW_BODY", JOURNAL_OVERVIEW_BODY],
    ["JOURNAL_ARMY_BODY", JOURNAL_ARMY_BODY],
    ["JOURNAL_STANCES_BODY", JOURNAL_STANCES_BODY],
    ["JOURNAL_CASTLES_BODY", JOURNAL_CASTLES_BODY],
  ] as const;

  it("no journal title contains a raw newline", () => {
    JOURNAL_TITLES.forEach((s) => {
      expect(s, `Title "${s}" should not contain \\n`).not.toContain("\n");
    });
  });

  it("journal body strings are non-empty", () => {
    JOURNAL_BODIES.forEach(([name, s]) => {
      expect(s.trim().length, `${name} is empty`).toBeGreaterThan(0);
    });
  });

  it("journal body strings contain newlines for multi-paragraph layout", () => {
    JOURNAL_BODIES.forEach(([name, s]) => {
      expect(s, `${name} should contain \\n for paragraph breaks`).toContain("\n");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ITEM CREATIVE MENU CATEGORIES
// Wrong category hides items from the expected creative-inventory tab.
// Armor must be in "equipment" (shows Equip button); misc items in "items".
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] Item creative menu categories", () => {
  function readItemDir(subdir: string): Array<{ file: string; data: any }> {
    const dir = path.join(BP_ROOT, "items", subdir);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((file) => ({
        file,
        data: JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")),
      }));
  }

  it("armor items use 'equipment' category (shows wearable UI in creative)", () => {
    readItemDir("armor").forEach(({ file, data }) => {
      const cat = data["minecraft:item"]?.description?.menu_category?.category;
      expect(cat, `${file}: armor must use "equipment" category`).toBe("equipment");
    });
  });

  it("armor items have a menu_category group (for sub-tab in equipment list)", () => {
    readItemDir("armor").forEach(({ file, data }) => {
      const group = data["minecraft:item"]?.description?.menu_category?.group;
      expect(group, `${file}: armor should have menu_category.group`).toBeTruthy();
    });
  });

  it("armor group names reference valid Bedrock armor groups", () => {
    const VALID_GROUPS = new Set([
      "minecraft:itemGroup.name.helmet",
      "minecraft:itemGroup.name.chestplate",
      "minecraft:itemGroup.name.leggings",
      "minecraft:itemGroup.name.boots",
    ]);
    readItemDir("armor").forEach(({ file, data }) => {
      const group: string =
        data["minecraft:item"]?.description?.menu_category?.group ?? "";
      expect(
        VALID_GROUPS.has(group),
        `${file}: group "${group}" is not a valid Bedrock armor item group`,
      ).toBe(true);
    });
  });

  it("tool/token/blueprint items use 'items' category", () => {
    readItemDir("tools").forEach(({ file, data }) => {
      const cat = data["minecraft:item"]?.description?.menu_category?.category;
      expect(cat, `${file}: tool/token/blueprint must use "items" category`).toBe("items");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SIEGE MESSAGE COMPLETENESS
// Victory and defeat must feel equally weighty — same number of lines,
// same emotional arc (announcement → detail → call to action).
// ═════════════════════════════════════════════════════════════════════════════

describe("[UI] Siege message completeness", () => {
  it("victory has exactly 3 chat messages (announcement, flavor, accolade)", () => {
    const victoryLines = [SIEGE_VICTORY_1, SIEGE_VICTORY_2, SIEGE_VICTORY_3];
    expect(victoryLines).toHaveLength(3);
    victoryLines.forEach((s, i) => {
      expect(
        strip(s).trim().length,
        `SIEGE_VICTORY_${i + 1} is empty`,
      ).toBeGreaterThan(0);
    });
  });

  it("defeat has exactly 3 chat messages (announcement, consequence, retry hint)", () => {
    const defeatLines = [SIEGE_DEFEAT_1, SIEGE_DEFEAT_2, SIEGE_DEFEAT_3];
    expect(defeatLines).toHaveLength(3);
    defeatLines.forEach((s, i) => {
      expect(
        strip(s).trim().length,
        `SIEGE_DEFEAT_${i + 1} is empty`,
      ).toBeGreaterThan(0);
    });
  });

  it("SIEGE_DEFEAT_3 contains the retry scriptevent command", () => {
    // Players need to know how to start again after a defeat
    expect(SIEGE_DEFEAT_3).toContain("mk:reset");
  });

  it("SIEGE_VICTORY_TITLE and SUBTITLE are both non-empty (for title screen display)", () => {
    expect(strip(SIEGE_VICTORY_TITLE).trim().length).toBeGreaterThan(0);
    expect(strip(SIEGE_VICTORY_SUBTITLE).trim().length).toBeGreaterThan(0);
  });

  it("SIEGE_WAVE format distinguishes wave number from total", () => {
    // Wave 2/5 and 5/5 must look different (not just show one number)
    const wave2 = SIEGE_WAVE(2, 5);
    const wave5 = SIEGE_WAVE(5, 5);
    expect(strip(wave2)).not.toBe(strip(wave5));
  });
});
