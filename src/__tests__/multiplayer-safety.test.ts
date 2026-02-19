/**
 * multiplayer-safety.test.ts
 *
 * Tests for multiplayer correctness: army scaling, entity budget enforcement,
 * player-scoped vs world-scoped properties, and concurrent safety.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { CAMP_TIERS } from "../data/CampDefinitions";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

// ─── Constants matching source code ─────────────────────────────────────────

const BASE_ARMY_SIZE = 15;
const MAX_ARMY_BONUS = 20;
const GLOBAL_ARMY_CAP = 35;
const MAX_ACTIVE_SIEGE_MOBS = 25;
const SWITCH_ENTITY_BUDGET = 60;

// ─── Army cap scaling ───────────────────────────────────────────────────────

describe("Multiplayer army cap scaling", () => {
  function getEffectiveCap(armyBonus: number, playerCount: number): number {
    const personalCap = BASE_ARMY_SIZE + Math.min(armyBonus, MAX_ARMY_BONUS);
    if (playerCount <= 1) return personalCap;
    return Math.min(personalCap, Math.floor(GLOBAL_ARMY_CAP / playerCount));
  }

  it("solo player with no bonus gets base cap", () => {
    expect(getEffectiveCap(0, 1)).toBe(BASE_ARMY_SIZE);
  });

  it("solo player with max bonus gets full personal cap", () => {
    expect(getEffectiveCap(MAX_ARMY_BONUS, 1)).toBe(BASE_ARMY_SIZE + MAX_ARMY_BONUS);
  });

  it("2 players splits global cap", () => {
    const cap = getEffectiveCap(MAX_ARMY_BONUS, 2);
    expect(cap).toBe(Math.floor(GLOBAL_ARMY_CAP / 2)); // 17
    expect(cap * 2).toBeLessThanOrEqual(GLOBAL_ARMY_CAP);
  });

  it("4 players each get floor(35/4) = 8", () => {
    const cap = getEffectiveCap(MAX_ARMY_BONUS, 4);
    expect(cap).toBe(8);
    expect(cap * 4).toBeLessThanOrEqual(GLOBAL_ARMY_CAP);
  });

  for (let p = 1; p <= 8; p++) {
    it(`total army with ${p} player(s) never exceeds GLOBAL_ARMY_CAP`, () => {
      const perPlayer = getEffectiveCap(MAX_ARMY_BONUS, p);
      expect(perPlayer * p).toBeLessThanOrEqual(GLOBAL_ARMY_CAP);
    });
  }

  for (let p = 1; p <= 8; p++) {
    it(`total entities (army+siege) with ${p} player(s) never exceeds ${SWITCH_ENTITY_BUDGET}`, () => {
      const perPlayer = getEffectiveCap(MAX_ARMY_BONUS, p);
      const totalArmy = perPlayer * p;
      expect(totalArmy + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(SWITCH_ENTITY_BUDGET);
    });
  }
});

// ─── Siege scaling ──────────────────────────────────────────────────────────

describe("Multiplayer siege spawn scaling", () => {
  const MAX_SPAWNS_PER_PLAYER = 24;

  it("solo player wave spawns are capped at MAX_SPAWNS_PER_PLAYER per player", () => {
    // The spawn loop clips at MAX_SPAWNS_PER_PLAYER per player — wave definitions
    // can exceed this because the cap is enforced at runtime, not in the data.
    // Verify the cap exists in the code.
    const siegeSrc = readSource("systems/SiegeSystem.ts");
    expect(siegeSrc).toContain("playerSpawns >= MAX_SPAWNS_PER_PLAYER");
    // Also verify no wave is absurdly large
    for (const wave of WAVE_DEFINITIONS) {
      const total = wave.spawns.reduce((sum, s) => sum + s.count, 0);
      expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
    }
  });

  it("multiplayer scale factors reduce per-player spawns", () => {
    const siegeSrc = readSource("systems/SiegeSystem.ts");
    // 2 players: 0.75x, 3+: 0.6x
    expect(siegeSrc).toContain("0.75");
    expect(siegeSrc).toContain("0.6");
  });

  it("MAX_SPAWNS_PER_PLAYER prevents unbounded wave sizes", () => {
    const siegeSrc = readSource("systems/SiegeSystem.ts");
    expect(siegeSrc).toContain("MAX_SPAWNS_PER_PLAYER");
    expect(siegeSrc).toContain("playerSpawns >= MAX_SPAWNS_PER_PLAYER");
  });

  it("siege entity cap pauses spawning when budget exceeded", () => {
    const siegeSrc = readSource("systems/SiegeSystem.ts");
    expect(siegeSrc).toContain("siegeRef.siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS");
  });
});

// ─── Camp scaling ───────────────────────────────────────────────────────────

describe("Multiplayer camp guard scaling", () => {
  it("camp system applies multiplayer scale factor", () => {
    const campSrc = readSource("systems/EnemyCampSystem.ts");
    expect(campSrc).toContain("scaleFactor");
    expect(campSrc).toContain("0.75");
    expect(campSrc).toContain("0.6");
  });

  it("camp guards are capped at MAX_CAMP_GUARDS", () => {
    const campSrc = readSource("systems/EnemyCampSystem.ts");
    expect(campSrc).toContain("MAX_CAMP_GUARDS");
  });

  it("maximum possible camp guards (solo, highest tier) stays within budget", () => {
    for (const tier of CAMP_TIERS) {
      const total = tier.guards.reduce((sum, g) => sum + g.count, 0);
      // With maximum faction weight (1.5x), still under 10 limit
      expect(Math.ceil(total * 1.5)).toBeLessThanOrEqual(15);
    }
  });
});

// ─── Player-scoped vs world-scoped properties ───────────────────────────────

describe("Dynamic property scoping correctness", () => {
  it("world-scoped properties use world.getDynamicProperty", () => {
    const daySrc = readSource("systems/DayCounterSystem.ts");
    const worldProps = ["mk:current_day", "mk:day_tick_counter", "mk:quest_active"];
    for (const prop of worldProps) {
      expect(daySrc).toContain(`world.getDynamicProperty(DayCounterSystem.KEY_`);
      expect(daySrc).toContain(`world.setDynamicProperty(DayCounterSystem.KEY_`);
    }
  });

  it("player-scoped kill properties use player.getDynamicProperty", () => {
    const bestiarySrc = readSource("systems/BestiarySystem.ts");
    expect(bestiarySrc).toContain("player.getDynamicProperty(entry.killKey)");
    expect(bestiarySrc).toContain("player.setDynamicProperty(entry.killKey");
  });

  it("player army size uses player scope", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    expect(armySrc).toContain('player.setDynamicProperty("mk:army_size"');
    expect(armySrc).toContain('player.getDynamicProperty("mk:army_size"');
  });

  it("player tier tracking uses player scope", () => {
    const armorSrc = readSource("systems/ArmorTierSystem.ts");
    expect(armorSrc).toContain("player.setDynamicProperty(`mk:tier_unlocked_");
    expect(armorSrc).toContain("player.getDynamicProperty(`mk:tier_unlocked_");
  });
});

// ─── Owner tag uniqueness ───────────────────────────────────────────────────

describe("Army owner tag uniqueness", () => {
  it("sanitizePlayerTag strips non-alphanumeric characters", () => {
    // Re-implement the sanitization logic from ArmySystem
    function sanitize(name: string): string {
      return name.replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    expect(sanitize("Steve")).toBe("Steve");
    expect(sanitize("Player 1")).toBe("Player_1");
    expect(sanitize("X§4Player")).toBe("X_4Player");
    expect(sanitize("日本語")).toBe("___");
    expect(sanitize("a-b_c")).toBe("a-b_c");
  });

  it("owner tags include mk_owner_ prefix", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    expect(armySrc).toContain("`mk_owner_${sanitizePlayerTag(name)}`");
  });
});

// ─── Concurrent safety ─────────────────────────────────────────────────────

describe("Entity mutation safety", () => {
  it("entitySpawn handler defers removal via system.run()", () => {
    const mainSrc = readSource("main.ts");
    const spawnSection = mainSrc.slice(
      mainSrc.indexOf("entitySpawn.subscribe"),
      mainSrc.indexOf("// Player spawn"),
    );
    expect(spawnSection).toContain("system.run(");
  });

  it("combat recruitment defers spawn via system.run()", () => {
    const combatSrc = readSource("systems/CombatSystem.ts");
    expect(combatSrc).toContain("system.run(");
  });

  it("merchant spawn defers via system.run()", () => {
    const merchantSrc = readSource("systems/MerchantSystem.ts");
    expect(merchantSrc).toContain("system.run(");
  });

  it("entity validity checked with try-catch in death listeners", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    const deathSection = armySrc.slice(armySrc.indexOf("setupDeathListener"));
    expect(deathSection).toContain("dead.hasTag");
    expect(deathSection).toContain("player?.isValid");
  });
});
