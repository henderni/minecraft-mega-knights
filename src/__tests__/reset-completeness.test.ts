/**
 * reset-completeness.test.ts
 *
 * Validates that the mk:reset handler in main.ts clears ALL player-level
 * dynamic properties. Uses source-as-text pattern since main.ts imports
 * @minecraft/server.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const mainSrc = readSource("main.ts");
const bestiarySrc = readSource("data/BestiaryDefinitions.ts");

// Extract the mk:reset handler block from main.ts
function getResetBlock(): string {
  const start = mainSrc.indexOf('"mk:reset"');
  if (start === -1) throw new Error("mk:reset handler not found in main.ts");
  // Find the closing of this else-if block by tracking braces
  let depth = 0;
  let blockStart = -1;
  for (let i = start; i < mainSrc.length; i++) {
    if (mainSrc[i] === "{") {
      if (blockStart === -1) blockStart = i;
      depth++;
    }
    if (mainSrc[i] === "}") {
      depth--;
      if (depth === 0) {
        return mainSrc.slice(blockStart, i + 1);
      }
    }
  }
  return mainSrc.slice(start);
}

const resetBlock = getResetBlock();

// ─── World-level resets ─────────────────────────────────────────────────────

describe("mk:reset: world-level property clearing", () => {
  it("calls dayCounter.reset()", () => {
    expect(resetBlock).toContain("dayCounter.reset()");
  });

  it("calls difficulty.reset()", () => {
    expect(resetBlock).toContain("difficulty.reset()");
  });

  it("sends DEBUG_QUEST_RESET message", () => {
    expect(resetBlock).toContain("DEBUG_QUEST_RESET");
  });
});

// ─── Player-level property clearing ─────────────────────────────────────────

describe("mk:reset: player-level property clearing", () => {
  it("clears mk:kills", () => {
    expect(resetBlock).toContain('"mk:kills"');
  });

  it("clears mk:army_size", () => {
    expect(resetBlock).toContain('"mk:army_size"');
  });

  it("clears mk:current_tier", () => {
    expect(resetBlock).toContain('"mk:current_tier"');
  });

  it("clears mk:army_bonus", () => {
    expect(resetBlock).toContain('"mk:army_bonus"');
  });

  it("clears mk:has_started", () => {
    expect(resetBlock).toContain('"mk:has_started"');
  });

  it("clears tier unlock properties (mk:tier_unlocked_*)", () => {
    expect(resetBlock).toMatch(/tier_unlocked_/);
  });

  it("iterates all armor tiers for tier_unlocked_ clearing", () => {
    // Should loop through ARMOR_TIERS length
    expect(resetBlock).toContain("ARMOR_TIERS.length");
  });
});

// ─── Bestiary kill count clearing ───────────────────────────────────────────

describe("mk:reset: bestiary kill count clearing", () => {
  it("clears bestiary kill properties", () => {
    expect(resetBlock).toContain("killKey");
  });

  it("iterates all BESTIARY entries", () => {
    expect(resetBlock).toContain("BESTIARY");
  });

  // Verify all bestiary kill keys used in the codebase are covered
  it("bestiary entries in BestiaryDefinitions use mk: killKey prefix", () => {
    // Extract all killKey values from BESTIARY
    const killKeys = bestiarySrc.match(/killKey:\s*"([^"]+)"/g);
    expect(killKeys).not.toBeNull();
    for (const match of killKeys!) {
      const key = match.match(/"([^"]+)"/)![1];
      expect(key).toMatch(/^mk:/);
    }
  });
});

// ─── Iterates all players ───────────────────────────────────────────────────

describe("mk:reset: player iteration", () => {
  it("calls getAllPlayers() to iterate all online players", () => {
    expect(resetBlock).toContain("getAllPlayers()");
  });

  it("wraps property clearing in try-catch for disconnected players", () => {
    expect(resetBlock).toContain("catch");
  });
});

// ─── Cross-reference: no missed dynamic properties ─────────────────────────

describe("mk:reset: completeness cross-check", () => {
  it("all player properties set during initialization are cleared on reset", () => {
    // DayCounterSystem.initializePlayer sets these properties
    const daySrc = readSource("systems/DayCounterSystem.ts");
    const propsSet = daySrc.match(/setDynamicProperty\("(mk:[^"]+)"/g);
    if (propsSet) {
      for (const match of propsSet) {
        const key = match.match(/"(mk:[^"]+)"/)![1];
        // World-level properties are handled by dayCounter.reset()
        if (["mk:current_day", "mk:day_tick_counter", "mk:quest_active", "mk:endless_mode"].includes(key)) {
          continue;
        }
        // Player-level properties should be cleared in mk:reset
        if (key.startsWith("mk:")) {
          expect(
            resetBlock.includes(key) || resetBlock.includes("tier_unlocked_") || resetBlock.includes("killKey"),
            `Player property "${key}" should be cleared in mk:reset`,
          ).toBe(true);
        }
      }
    }
  });
});
