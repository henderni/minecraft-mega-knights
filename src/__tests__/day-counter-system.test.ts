/**
 * day-counter-system.test.ts
 *
 * Source-as-text behavioral tests for DayCounterSystem.ts.
 * Validates tick math, HUD formatting, starter kit, crash recovery,
 * throttled HUD updates, and late-joiner kit logic.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ARMOR_TIERS } from "../data/ArmorTiers";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const daySrc = readSource("systems/DayCounterSystem.ts");
const mainSrc = readSource("main.ts");

// ─── Day Transition Math ─────────────────────────────────────────────────────

describe("DayCounterSystem: day transition math", () => {
  it("TICKS_PER_DAY is 24000 (Minecraft day length)", () => {
    expect(daySrc).toMatch(/TICKS_PER_DAY\s*=\s*24000/);
  });

  it("MAX_DAY is 100", () => {
    expect(daySrc).toMatch(/MAX_DAY\s*=\s*100/);
  });

  it("tick() increments cachedTickCounter by 20 (called every 20 ticks)", () => {
    const tickMethod = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    expect(tickMethod).toContain("cachedTickCounter += 20");
  });

  it("day increments when cachedTickCounter >= TICKS_PER_DAY", () => {
    const tickMethod = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    expect(tickMethod).toMatch(/cachedTickCounter\s*>=\s*DayCounterSystem\.TICKS_PER_DAY/);
    expect(tickMethod).toContain("cachedDay += 1");
  });

  it("cachedTickCounter resets to 0 on day transition", () => {
    const tickMethod = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    // After day transition, tick counter is reset
    expect(tickMethod).toContain("this.cachedTickCounter = 0");
  });

  it("stops at day 100 unless endless mode is active", () => {
    const tickMethod = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    expect(tickMethod).toMatch(/cachedDay\s*>=\s*DayCounterSystem\.MAX_DAY\s*&&\s*!this\.cachedEndless/);
  });

  it("persists day to dynamic property KEY_DAY on increment", () => {
    const tickMethod = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    expect(tickMethod).toContain("world.setDynamicProperty(DayCounterSystem.KEY_DAY, this.cachedDay)");
  });
});

// ─── HUD Formatting ──────────────────────────────────────────────────────────

describe("DayCounterSystem: HUD formatting", () => {
  it("pre-builds PROGRESS_BARS array for zero allocation", () => {
    expect(daySrc).toContain("PROGRESS_BARS");
    expect(daySrc).toMatch(/BAR_LENGTH\s*=\s*20/);
  });

  it("uses HUD_ACTION_BAR for normal mode", () => {
    expect(daySrc).toContain("HUD_ACTION_BAR(");
  });

  it("uses HUD_ACTION_BAR_ENDLESS for endless mode past day 100", () => {
    expect(daySrc).toContain("HUD_ACTION_BAR_ENDLESS(");
    expect(daySrc).toMatch(/cachedEndless\s*&&\s*currentDay\s*>\s*100/);
  });

  it("uses numeric composite key to detect HUD changes without string allocation", () => {
    const hudMethod = daySrc.slice(
      daySrc.indexOf("updateHUD(): void"),
      daySrc.indexOf("private onDayChange("),
    );
    // Bitpacking for change detection
    expect(hudMethod).toMatch(/<<\s*20/);
    expect(hudMethod).toContain("lastHudKeys");
  });

  it("skips setActionBar when HUD key unchanged", () => {
    const hudMethod = daySrc.slice(
      daySrc.indexOf("updateHUD(): void"),
      daySrc.indexOf("private onDayChange("),
    );
    expect(hudMethod).toContain("key !== lastKey");
  });
});

// ─── Starter Kit ─────────────────────────────────────────────────────────────

describe("DayCounterSystem: starter kit", () => {
  it("gives iron_sword in startQuest()", () => {
    const startMethod = daySrc.slice(
      daySrc.indexOf("startQuest(): void"),
      daySrc.indexOf("setDay("),
    );
    expect(startMethod).toContain("give @s iron_sword");
  });

  it("gives shield in startQuest()", () => {
    const startMethod = daySrc.slice(
      daySrc.indexOf("startQuest(): void"),
      daySrc.indexOf("setDay("),
    );
    expect(startMethod).toContain("give @s shield");
  });

  it("gives 8 bread (not 1)", () => {
    const startMethod = daySrc.slice(
      daySrc.indexOf("startQuest(): void"),
      daySrc.indexOf("setDay("),
    );
    expect(startMethod).toContain("give @s bread 8");
  });

  it("gives bed", () => {
    const startMethod = daySrc.slice(
      daySrc.indexOf("startQuest(): void"),
      daySrc.indexOf("setDay("),
    );
    expect(startMethod).toContain("give @s bed");
  });

  it("gives quest journal", () => {
    const startMethod = daySrc.slice(
      daySrc.indexOf("startQuest(): void"),
      daySrc.indexOf("setDay("),
    );
    expect(startMethod).toContain("give @s mk:mk_quest_journal");
  });

  it("wraps give commands in try-catch", () => {
    const startMethod = daySrc.slice(
      daySrc.indexOf("startQuest(): void"),
      daySrc.indexOf("setDay("),
    );
    expect(startMethod).toContain("try");
    expect(startMethod).toContain("catch");
  });
});

// ─── Crash Recovery ──────────────────────────────────────────────────────────

describe("DayCounterSystem: crash recovery", () => {
  it("persists tick counter periodically for crash recovery", () => {
    const tickMethod = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    // Persistence interval — writes tick counter every N calls
    expect(tickMethod).toContain("tickWriteCounter");
    expect(tickMethod).toContain("world.setDynamicProperty(DayCounterSystem.KEY_TICK");
  });

  it("tick persistence interval is 60 (once per ~60 seconds)", () => {
    const tickMethod = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    expect(tickMethod).toMatch(/tickWriteCounter\s*>=\s*60/);
  });

  it("loads cached values from dynamic properties on first use", () => {
    expect(daySrc).toContain("ensureInitialized");
    const initMethod = daySrc.slice(
      daySrc.indexOf("private ensureInitialized"),
      daySrc.indexOf("getCurrentDay"),
    );
    expect(initMethod).toContain("world.getDynamicProperty");
    expect(initMethod).toContain("this.initialized = true");
  });
});

// ─── Throttled HUD Update ────────────────────────────────────────────────────

describe("DayCounterSystem: throttled HUD updates", () => {
  it("refreshes player list every 4th HUD call (~2s)", () => {
    const hudMethod = daySrc.slice(
      daySrc.indexOf("updateHUD(): void"),
      daySrc.indexOf("private onDayChange("),
    );
    expect(hudMethod).toContain("hudPlayerRefreshCounter");
    expect(hudMethod).toMatch(/hudPlayerRefreshCounter\s*>=\s*4/);
  });

  it("reads per-player dynamic properties every 8th HUD call (~4s)", () => {
    const hudMethod = daySrc.slice(
      daySrc.indexOf("updateHUD(): void"),
      daySrc.indexOf("private onDayChange("),
    );
    expect(hudMethod).toContain("hudPropertyReadCounter");
    expect(hudMethod).toMatch(/hudPropertyReadCounter\s*>=\s*8/);
  });

  it("prunes disconnected players from HUD caches", () => {
    const hudMethod = daySrc.slice(
      daySrc.indexOf("updateHUD(): void"),
      daySrc.indexOf("private onDayChange("),
    );
    expect(hudMethod).toContain("activeNames");
    expect(hudMethod).toContain("lastHudKeys.delete");
    expect(hudMethod).toContain("cachedPlayerArmySize.delete");
  });

  it("uses numProp() for safe dynamic property reads in HUD", () => {
    const hudMethod = daySrc.slice(
      daySrc.indexOf("updateHUD(): void"),
      daySrc.indexOf("private onDayChange("),
    );
    expect(hudMethod).toContain("numProp(");
  });
});

// ─── Late-Joiner Kit ─────────────────────────────────────────────────────────

describe("DayCounterSystem: late-joiner kit", () => {
  it("initializePlayer checks if quest is already active for late joiners", () => {
    const initMethod = daySrc.slice(
      daySrc.indexOf("initializePlayer(player"),
      daySrc.indexOf("enableEndlessMode"),
    );
    expect(initMethod).toContain("this.isActive()");
  });

  it("gives starter kit to late joiners when quest is running", () => {
    const initMethod = daySrc.slice(
      daySrc.indexOf("initializePlayer(player"),
      daySrc.indexOf("enableEndlessMode"),
    );
    expect(initMethod).toContain("give @s iron_sword");
    expect(initMethod).toContain("give @s shield");
    expect(initMethod).toContain("give @s bread 8");
    expect(initMethod).toContain("give @s bed");
    expect(initMethod).toContain("give @s mk:mk_quest_journal");
  });

  it("sets mk:has_started before giving late-joiner kit", () => {
    const initMethod = daySrc.slice(
      daySrc.indexOf("initializePlayer(player"),
      daySrc.indexOf("enableEndlessMode"),
    );
    // mk:has_started is set before the isActive() check
    const hasStartedIdx = initMethod.indexOf("mk:has_started\", true");
    const isActiveIdx = initMethod.indexOf("this.isActive()");
    expect(hasStartedIdx).toBeGreaterThan(-1);
    expect(isActiveIdx).toBeGreaterThan(-1);
    expect(hasStartedIdx).toBeLessThan(isActiveIdx);
  });

  it("auto-starts quest if not active on first player join", () => {
    const initMethod = daySrc.slice(
      daySrc.indexOf("initializePlayer(player"),
      daySrc.indexOf("enableEndlessMode"),
    );
    expect(initMethod).toContain("this.startQuest()");
  });
});

// ─── Main.ts wiring ──────────────────────────────────────────────────────────

describe("DayCounterSystem: main.ts wiring", () => {
  it("armorTier.initializePlayer runs BEFORE dayCounter.initializePlayer", () => {
    const spawnBlock = mainSrc.slice(
      mainSrc.indexOf("playerSpawn.subscribe"),
      mainSrc.indexOf("entityDie.subscribe"),
    );
    const armorIdx = spawnBlock.indexOf("armorTier.initializePlayer");
    const dayIdx = spawnBlock.indexOf("dayCounter.initializePlayer");
    expect(armorIdx).toBeGreaterThan(-1);
    expect(dayIdx).toBeGreaterThan(-1);
    expect(armorIdx).toBeLessThan(dayIdx);
  });

  it("dayCounter.tick() is called in the 20-tick interval", () => {
    expect(mainSrc).toContain("dayCounter.tick()");
  });

  it("dayCounter.updateHUD() is called in the 10-tick interval", () => {
    expect(mainSrc).toContain("dayCounter.updateHUD()");
  });
});
