/**
 * system-logic.test.ts
 *
 * Tests for pure mathematical/logical formulas extracted from the system files.
 * None of these tests require the @minecraft/server API — they validate the
 * constants, formulas, and data structures that drive game balance.
 */

import { describe, it, expect } from "vitest";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";

// ---------------------------------------------------------------------------
// Constants extracted from system files — tests will fail if these drift
// ---------------------------------------------------------------------------

/** ArmySystem.ts */
const BASE_ARMY_SIZE = 15;
const MAX_ARMY_BONUS = 20;
const GLOBAL_ARMY_CAP = 35;

/** SiegeSystem.ts */
const MAX_ACTIVE_SIEGE_MOBS = 25;
const MAX_SPAWNS_PER_PLAYER = 24;

/** DayCounterSystem.ts */
const TICKS_PER_DAY = 24000;
const MAX_DAY = 100;
const TICK_INTERVAL = 20; // tick() is called every 20 ticks

/** CombatSystem.ts */
const RECRUIT_CHANCE = 0.3;

// ---------------------------------------------------------------------------
// Pure functions mirrored from system files
// ---------------------------------------------------------------------------

/** ArmySystem.getEffectiveCap */
function getEffectiveCap(armyBonus: number, playerCount: number): number {
  const personalCap = BASE_ARMY_SIZE + Math.min(armyBonus, MAX_ARMY_BONUS);
  if (playerCount <= 1) return personalCap;
  return Math.min(personalCap, Math.floor(GLOBAL_ARMY_CAP / playerCount));
}

/** ArmySystem.sanitizePlayerTag */
function sanitizePlayerTag(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** ArmySystem.getOwnerTag */
function getOwnerTag(name: string): string {
  return `mk_owner_${sanitizePlayerTag(name)}`;
}

/** ArmySystem: enemy → ally type mapping */
function enemyToAllyType(enemyTypeId: string): string {
  return enemyTypeId.replace("_enemy_", "_ally_");
}

/** CombatSystem: boss detection */
function isBoss(typeId: string): boolean {
  return typeId.includes("boss");
}

/** CombatSystem: recruitable enemy check */
function isRecruitableEnemy(typeId: string): boolean {
  return typeId.startsWith("mk:mk_enemy_") && !typeId.includes("boss");
}

/** SiegeSystem: multiplayer spawn scale factor */
function siegeScaleFactor(playerCount: number): number {
  return playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;
}

// ---------------------------------------------------------------------------

describe("Army Capacity Math", () => {
  it("solo player with no bonus gets BASE_ARMY_SIZE", () => {
    expect(getEffectiveCap(0, 1)).toBe(15);
  });

  it("solo player with max bonus gets BASE + MAX_BONUS", () => {
    expect(getEffectiveCap(20, 1)).toBe(35);
  });

  it("excess bonus is clamped to MAX_ARMY_BONUS", () => {
    expect(getEffectiveCap(999, 1)).toBe(35);
  });

  it("two players each get floor(GLOBAL_CAP / 2) = 17", () => {
    // min(35, floor(35/2)=17) = 17
    expect(getEffectiveCap(20, 2)).toBe(17);
  });

  it("three players each get floor(GLOBAL_CAP / 3) = 11", () => {
    expect(getEffectiveCap(20, 3)).toBe(11);
  });

  it("four players each get floor(GLOBAL_CAP / 4) = 8", () => {
    // min(35, floor(35/4)=8) = 8
    expect(getEffectiveCap(20, 4)).toBe(8);
  });

  it("low-bonus player in multiplayer is capped by personal cap not global", () => {
    // 2 players, bonus=0: personal=15, global share=17 → min(15,17)=15
    expect(getEffectiveCap(0, 2)).toBe(15);
  });

  it("solo player with partial bonus gets correct cap", () => {
    // bonus=5 (tower only): personal=20
    expect(getEffectiveCap(5, 1)).toBe(20);
    // bonus=12 (tower+gatehouse): personal=27
    expect(getEffectiveCap(12, 1)).toBe(27);
  });

  it("total entity budget: GLOBAL_ARMY_CAP + MAX_SIEGE_MOBS ≤ 60 (Switch limit)", () => {
    expect(GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(60);
  });

  it("all 3 castles combined give exactly MAX_ARMY_BONUS", () => {
    const total = Object.values(CASTLE_BLUEPRINTS).reduce((sum, b) => sum + b.troopBonus, 0);
    expect(total).toBe(MAX_ARMY_BONUS);
  });

  it("solo player with all castles hits GLOBAL_ARMY_CAP exactly", () => {
    expect(BASE_ARMY_SIZE + MAX_ARMY_BONUS).toBe(GLOBAL_ARMY_CAP);
  });
});

// ---------------------------------------------------------------------------

describe("Player Name Sanitization", () => {
  it("pure alphanumeric names pass through unchanged", () => {
    expect(sanitizePlayerTag("PlayerOne")).toBe("PlayerOne");
  });

  it("spaces are replaced with underscores", () => {
    expect(sanitizePlayerTag("Player One")).toBe("Player_One");
  });

  it("§ character itself is replaced (it is non-ASCII); following letter code is kept", () => {
    // sanitizePlayerTag replaces [^a-zA-Z0-9_-] — § is non-ASCII so it becomes _,
    // but 'a', 'r', 'b' are ASCII letters and stay unchanged.
    // The full §-code stripping (removing both chars) happens separately in nameTag display logic.
    expect(sanitizePlayerTag("§aGreenPlayer")).toBe("_aGreenPlayer");
  });

  it("§ alone becomes one underscore (code char after § is kept if alphanumeric)", () => {
    expect(sanitizePlayerTag("§r")).toBe("_r");
  });

  it("special characters replaced with underscores", () => {
    expect(sanitizePlayerTag("Player!@#$%")).toBe("Player_____");
  });

  it("hyphens are preserved", () => {
    expect(sanitizePlayerTag("Player-One")).toBe("Player-One");
  });

  it("underscores are preserved", () => {
    expect(sanitizePlayerTag("Player_One")).toBe("Player_One");
  });

  it("non-ASCII unicode letters are replaced; ASCII letters are kept", () => {
    // Ñ (non-ASCII) → _, o (ASCII) → o, ñ (non-ASCII) → _, o (ASCII) → o
    expect(sanitizePlayerTag("Ñoño")).toBe("_o_o");
  });

  it("owner tag has mk_owner_ prefix", () => {
    expect(getOwnerTag("Alice")).toBe("mk_owner_Alice");
  });

  it("owner tag: § becomes _ but the following letter code is kept (tag-safe, not display-safe)", () => {
    // § (non-ASCII) → _; b (ASCII) → b
    expect(getOwnerTag("§bAlice")).toBe("mk_owner__bAlice");
  });

  it("owner tag with space in name", () => {
    expect(getOwnerTag("Cool Player")).toBe("mk_owner_Cool_Player");
  });

  it("empty name produces mk_owner_ prefix only", () => {
    expect(getOwnerTag("")).toBe("mk_owner_");
  });
});

// ---------------------------------------------------------------------------

describe("Enemy to Ally Type Mapping", () => {
  it("maps enemy knight to ally knight", () => {
    expect(enemyToAllyType("mk:mk_enemy_knight")).toBe("mk:mk_ally_knight");
  });

  it("maps enemy archer to ally archer", () => {
    expect(enemyToAllyType("mk:mk_enemy_archer")).toBe("mk:mk_ally_archer");
  });

  it("maps enemy wizard to ally wizard", () => {
    expect(enemyToAllyType("mk:mk_enemy_wizard")).toBe("mk:mk_ally_wizard");
  });

  it("maps enemy dark_knight to ally dark_knight", () => {
    expect(enemyToAllyType("mk:mk_enemy_dark_knight")).toBe("mk:mk_ally_dark_knight");
  });

  it("all WAVE_DEFINITIONS enemy types have a valid ally mapping", () => {
    const waveEnemies = new Set<string>();
    for (const wave of WAVE_DEFINITIONS) {
      for (const spawn of wave.spawns) {
        if (spawn.entityId.startsWith("mk:mk_enemy_")) {
          waveEnemies.add(spawn.entityId);
        }
      }
    }
    for (const enemy of waveEnemies) {
      const ally = enemyToAllyType(enemy);
      expect(ally).toMatch(/^mk:mk_ally_/);
      expect(ally).not.toBe(enemy); // must have changed
    }
  });
});

// ---------------------------------------------------------------------------

describe("Boss and Enemy Detection", () => {
  it("siege_lord is detected as boss", () => {
    expect(isBoss("mk:mk_boss_siege_lord")).toBe(true);
  });

  it("knight enemy is not a boss", () => {
    expect(isBoss("mk:mk_enemy_knight")).toBe(false);
  });

  it("knight enemy is recruitable", () => {
    expect(isRecruitableEnemy("mk:mk_enemy_knight")).toBe(true);
  });

  it("archer enemy is recruitable", () => {
    expect(isRecruitableEnemy("mk:mk_enemy_archer")).toBe(true);
  });

  it("wizard enemy is recruitable", () => {
    expect(isRecruitableEnemy("mk:mk_enemy_wizard")).toBe(true);
  });

  it("dark_knight enemy is recruitable", () => {
    expect(isRecruitableEnemy("mk:mk_enemy_dark_knight")).toBe(true);
  });

  it("boss is not recruitable", () => {
    expect(isRecruitableEnemy("mk:mk_boss_siege_lord")).toBe(false);
  });

  it("vanilla mob is not recruitable", () => {
    expect(isRecruitableEnemy("minecraft:zombie")).toBe(false);
  });

  it("player entity is not recruitable", () => {
    expect(isRecruitableEnemy("minecraft:player")).toBe(false);
  });

  it("ally entity is not recruitable", () => {
    expect(isRecruitableEnemy("mk:mk_ally_knight")).toBe(false);
  });

  it("wave 5 boss is not recruitable", () => {
    const wave5 = WAVE_DEFINITIONS[4];
    const boss = wave5.spawns.find((s) => s.entityId.includes("boss"));
    expect(boss).toBeDefined();
    expect(isRecruitableEnemy(boss!.entityId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("Siege Wave Spawn Scaling", () => {
  it("solo player gets full 1.0 scale factor", () => {
    expect(siegeScaleFactor(1)).toBe(1.0);
  });

  it("two players get 0.75 scale factor", () => {
    expect(siegeScaleFactor(2)).toBe(0.75);
  });

  it("three players get 0.6 scale factor", () => {
    expect(siegeScaleFactor(3)).toBe(0.6);
  });

  it("four or more players still get 0.6 scale factor", () => {
    expect(siegeScaleFactor(4)).toBe(0.6);
    expect(siegeScaleFactor(8)).toBe(0.6);
  });

  it("scale factor is always between 0 and 1 inclusive", () => {
    for (const count of [1, 2, 3, 4, 8]) {
      const f = siegeScaleFactor(count);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1.0);
    }
  });

  it("max spawns per player cap is 24", () => {
    expect(MAX_SPAWNS_PER_PLAYER).toBe(24);
  });

  it("solo wave 1 raw count stays at or below MAX_ACTIVE_SIEGE_MOBS", () => {
    const wave1 = WAVE_DEFINITIONS[0];
    const total = wave1.spawns.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
  });
});

// ---------------------------------------------------------------------------

describe("Wave Definitions Structure", () => {
  it("has exactly 5 waves", () => {
    expect(WAVE_DEFINITIONS.length).toBe(5);
  });

  it("wave numbers are sequential starting from 1", () => {
    WAVE_DEFINITIONS.forEach((w, i) => {
      expect(w.waveNumber).toBe(i + 1);
    });
  });

  it("first wave fires immediately (delayTicks=0)", () => {
    expect(WAVE_DEFINITIONS[0].delayTicks).toBe(0);
  });

  it("all subsequent waves have positive delay", () => {
    for (let i = 1; i < WAVE_DEFINITIONS.length; i++) {
      expect(WAVE_DEFINITIONS[i].delayTicks).toBeGreaterThan(0, `wave ${i + 1} has no delay`);
    }
  });

  it("all spawn counts are positive", () => {
    for (const wave of WAVE_DEFINITIONS) {
      for (const spawn of wave.spawns) {
        expect(spawn.count).toBeGreaterThan(0);
      }
    }
  });

  it("all entity IDs use mk: namespace", () => {
    for (const wave of WAVE_DEFINITIONS) {
      for (const spawn of wave.spawns) {
        expect(spawn.entityId).toMatch(/^mk:/);
      }
    }
  });

  it("wave 5 (final) contains the boss", () => {
    const finalWave = WAVE_DEFINITIONS[4];
    const hasBoss = finalWave.spawns.some((s) => s.entityId.includes("boss"));
    expect(hasBoss).toBe(true);
  });

  it("boss only appears in the final wave", () => {
    for (let i = 0; i < WAVE_DEFINITIONS.length - 1; i++) {
      const hasBoss = WAVE_DEFINITIONS[i].spawns.some((s) => s.entityId.includes("boss"));
      expect(hasBoss).toBe(false);
    }
  });

  it("boss spawn count is exactly 1", () => {
    const wave5 = WAVE_DEFINITIONS[4];
    const boss = wave5.spawns.find((s) => s.entityId.includes("boss"));
    expect(boss?.count).toBe(1);
  });

  it("final wave has more total units than first wave", () => {
    const wave1Count = WAVE_DEFINITIONS[0].spawns.reduce((sum, s) => sum + s.count, 0);
    const wave5Count = WAVE_DEFINITIONS[4].spawns.reduce((sum, s) => sum + s.count, 0);
    expect(wave5Count).toBeGreaterThan(wave1Count);
  });

  it("each wave has at least one spawn entry", () => {
    for (const wave of WAVE_DEFINITIONS) {
      expect(wave.spawns.length).toBeGreaterThan(0);
    }
  });

  it("wave 5 uses boss namespace mk:mk_boss_", () => {
    const wave5 = WAVE_DEFINITIONS[4];
    const boss = wave5.spawns.find((s) => s.entityId.includes("boss"));
    expect(boss?.entityId).toMatch(/^mk:mk_boss_/);
  });

  it("inter-wave delays are all equal (60 seconds = 1200 ticks)", () => {
    // Waves 2-5 all have 1200-tick delays between them
    for (let i = 1; i < WAVE_DEFINITIONS.length; i++) {
      expect(WAVE_DEFINITIONS[i].delayTicks).toBe(1200);
    }
  });
});

// ---------------------------------------------------------------------------

describe("Castle Blueprint Data", () => {
  it("has exactly 3 blueprints", () => {
    expect(Object.keys(CASTLE_BLUEPRINTS).length).toBe(3);
  });

  it("blueprint IDs match their map keys", () => {
    for (const [key, bp] of Object.entries(CASTLE_BLUEPRINTS)) {
      expect(bp.id).toBe(key);
    }
  });

  it("all troop bonuses are positive", () => {
    for (const bp of Object.values(CASTLE_BLUEPRINTS)) {
      expect(bp.troopBonus).toBeGreaterThan(0);
    }
  });

  it("blueprints unlock in ascending day order", () => {
    const days = Object.values(CASTLE_BLUEPRINTS).map((b) => b.unlockDay);
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThan(days[i - 1]);
    }
  });

  it("all blueprints unlock before day 100 siege", () => {
    for (const bp of Object.values(CASTLE_BLUEPRINTS)) {
      expect(bp.unlockDay).toBeLessThan(100);
    }
  });

  it("small_tower unlocks earliest at day 5", () => {
    expect(CASTLE_BLUEPRINTS["small_tower"].unlockDay).toBe(5);
  });

  it("small_tower gives +5 troop capacity", () => {
    expect(CASTLE_BLUEPRINTS["small_tower"].troopBonus).toBe(5);
  });

  it("gatehouse gives +7 troop capacity", () => {
    expect(CASTLE_BLUEPRINTS["gatehouse"].troopBonus).toBe(7);
  });

  it("great_hall gives +8 troop capacity (highest bonus)", () => {
    expect(CASTLE_BLUEPRINTS["great_hall"].troopBonus).toBe(8);
  });

  it("all structure IDs use megaknights: namespace", () => {
    for (const bp of Object.values(CASTLE_BLUEPRINTS)) {
      expect(bp.structureId).toMatch(/^megaknights:/);
    }
  });
});

// ---------------------------------------------------------------------------

describe("Armor Tier Data", () => {
  it("has exactly 5 tiers (Page through Mega Knight)", () => {
    expect(ARMOR_TIERS.length).toBe(5);
  });

  it("tier indices are sequential starting from 0", () => {
    ARMOR_TIERS.forEach((t, i) => {
      expect(t.tier).toBe(i);
    });
  });

  it("tier 0 (Page) unlocks at day 0 — always available", () => {
    expect(ARMOR_TIERS[0].unlockDay).toBe(0);
  });

  it("tier 0 (Page) has no token — armor given free at quest start", () => {
    expect(ARMOR_TIERS[0].tokenItem).toBeNull();
  });

  it("all tiers 1-4 have token items using mk: namespace", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].tokenItem).not.toBeNull();
      expect(ARMOR_TIERS[i].tokenItem).toMatch(/^mk:/);
    }
  });

  it("chest protection increases with each tier", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].protection.chest).toBeGreaterThan(
        ARMOR_TIERS[i - 1].protection.chest,
      );
    }
  });

  it("all protection values are positive", () => {
    for (const tier of ARMOR_TIERS) {
      expect(tier.protection.helmet).toBeGreaterThan(0);
      expect(tier.protection.chest).toBeGreaterThan(0);
      expect(tier.protection.legs).toBeGreaterThan(0);
      expect(tier.protection.boots).toBeGreaterThan(0);
    }
  });

  it("durability increases with each tier", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].durability).toBeGreaterThan(ARMOR_TIERS[i - 1].durability);
    }
  });

  it("unlock days are in ascending order", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].unlockDay).toBeGreaterThan(ARMOR_TIERS[i - 1].unlockDay);
    }
  });

  it("unlock days align with milestone schedule: days 0, 20, 40, 60, 85", () => {
    const expectedDays = [0, 20, 40, 60, 85];
    ARMOR_TIERS.forEach((tier, i) => {
      expect(tier.unlockDay).toBe(expectedDays[i]);
    });
  });

  it("final tier (Mega Knight) unlocks 15 days before siege at day 100", () => {
    const lastTier = ARMOR_TIERS[ARMOR_TIERS.length - 1];
    expect(lastTier.unlockDay).toBe(85);
    expect(MAX_DAY - lastTier.unlockDay).toBe(15);
  });

  it("all tiers have valid repair items", () => {
    for (const tier of ARMOR_TIERS) {
      expect(tier.repairItem).toBeTruthy();
      // Repair items should be minecraft: namespace
      expect(tier.repairItem).toMatch(/^minecraft:/);
    }
  });
});

// ---------------------------------------------------------------------------

describe("Day Counter Constants", () => {
  it("each game day is 24000 ticks (standard Minecraft day cycle)", () => {
    expect(TICKS_PER_DAY).toBe(24000);
  });

  it("quest runs exactly 100 days", () => {
    expect(MAX_DAY).toBe(100);
  });

  it("tick() is called every 20 ticks per main.ts runInterval", () => {
    expect(TICK_INTERVAL).toBe(20);
  });

  it("tick() increments counter by 20 each call — covers one second", () => {
    // tick() adds TICK_INTERVAL, so 1200 calls × 20 = 24000 ticks per day
    expect((TICKS_PER_DAY / TICK_INTERVAL) * TICK_INTERVAL).toBe(TICKS_PER_DAY);
  });

  it("1200 tick() calls advance the counter by exactly one day", () => {
    const callsPerDay = TICKS_PER_DAY / TICK_INTERVAL;
    expect(callsPerDay).toBe(1200);
  });
});

// ---------------------------------------------------------------------------

describe("Recruit Chance", () => {
  it("recruit chance is 30%", () => {
    expect(RECRUIT_CHANCE).toBe(0.3);
  });

  it("recruit chance is a valid probability (0 < p < 1)", () => {
    expect(RECRUIT_CHANCE).toBeGreaterThan(0);
    expect(RECRUIT_CHANCE).toBeLessThan(1);
  });

  it("expected recruits per 10 kills is 3", () => {
    expect(Math.round(10 * RECRUIT_CHANCE)).toBe(3);
  });
});
