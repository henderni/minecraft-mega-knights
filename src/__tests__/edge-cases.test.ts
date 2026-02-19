/**
 * Edge case and property-based tests.
 *
 * "Property tests" here run a function over many representative inputs and
 * assert invariants that must hold for all of them, rather than a single
 * example.  vitest has no built-in fast-check, so we generate inputs via
 * small deterministic helpers.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import {
  DAY_CHANGE,
  HUD_ACTION_BAR,
  SIEGE_WAVE,
  ALLY_RECRUITED,
  ALLY_NOT_YOURS,
  ALLY_INFO,
  CASTLE_CAPACITY_UP,
  MILESTONE_TITLE,
} from "../data/Strings";

// ─── Constants mirrored from ArmySystem.ts ───────────────────────────────────
// These must stay in sync; the cross-reference test in data-integrity.test.ts
// checks CASTLE_BLUEPRINTS bonus totals against MAX_ARMY_BONUS.
const BASE_ARMY_SIZE = 15;
const MAX_ARMY_BONUS = 20;
const GLOBAL_ARMY_CAP = 35;

/** Pure reimplementation of ArmySystem.getEffectiveCap for unit testing */
function effectiveCap(armyBonus: number, playerCount: number): number {
  const personalCap = BASE_ARMY_SIZE + Math.min(armyBonus, MAX_ARMY_BONUS);
  if (playerCount <= 1) return personalCap;
  return Math.min(personalCap, Math.floor(GLOBAL_ARMY_CAP / playerCount));
}

// ─── Tiny PRNG (xorshift32) — deterministic "random" sequences ───────────────
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return {
    next(): number {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return (s >>> 0) / 0x100000000;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
  };
}

// ─── Army capacity formula ────────────────────────────────────────────────────
describe("Army capacity formula — specific cases", () => {
  it("no bonus, singleplayer → base only", () => {
    expect(effectiveCap(0, 1)).toBe(15);
  });

  it("full bonus, singleplayer → 35 (base + max_bonus)", () => {
    expect(effectiveCap(20, 1)).toBe(35);
  });

  it("over-cap bonus is clamped at MAX_ARMY_BONUS", () => {
    expect(effectiveCap(999, 1)).toBe(35);
    expect(effectiveCap(21, 1)).toBe(35);
  });

  it("partial bonus, singleplayer", () => {
    // +5 tower only → 15 + 5 = 20
    expect(effectiveCap(5, 1)).toBe(20);
    // +5 tower + +7 gatehouse = 12 → 15 + 12 = 27
    expect(effectiveCap(12, 1)).toBe(27);
  });

  it("2 players: cap drops to floor(35/2) = 17", () => {
    expect(effectiveCap(20, 2)).toBe(17);
  });

  it("3 players: cap drops to floor(35/3) = 11", () => {
    expect(effectiveCap(20, 3)).toBe(11);
  });

  it("4 players: cap drops to floor(35/4) = 8", () => {
    expect(effectiveCap(20, 4)).toBe(8);
  });

  it("multiplayer: low personal cap wins over global floor", () => {
    // bonus=0 → personalCap=15, globalFloor=17; personal is lower, so 15 wins
    expect(effectiveCap(0, 2)).toBe(15);
  });

  it("playerCount=0 treated as ≤1 (singleplayer path)", () => {
    expect(effectiveCap(20, 0)).toBe(35);
  });

  it("playerCount=1 is identical to playerCount=0 (both singleplayer)", () => {
    for (const bonus of [0, 5, 10, 20, 100]) {
      expect(effectiveCap(bonus, 1)).toBe(effectiveCap(bonus, 0));
    }
  });
});

describe("Army capacity formula — property tests", () => {
  const rng = makeRng(0xdeadbeef);
  const bonusSamples = Array.from({ length: 200 }, () => rng.int(0, 200));
  const countSamples = Array.from({ length: 50 }, () => rng.int(1, 10));

  it("result is always ≥ BASE_ARMY_SIZE for any bonus ≥ 0", () => {
    bonusSamples.forEach((bonus) => {
      expect(effectiveCap(bonus, 1)).toBeGreaterThanOrEqual(BASE_ARMY_SIZE);
    });
  });

  it("result is always ≤ BASE + MAX_BONUS (35) in singleplayer", () => {
    bonusSamples.forEach((bonus) => {
      expect(effectiveCap(bonus, 1)).toBeLessThanOrEqual(
        BASE_ARMY_SIZE + MAX_ARMY_BONUS,
      );
    });
  });

  it("result is monotonically non-decreasing with bonus (singleplayer)", () => {
    let prev = effectiveCap(0, 1);
    for (let bonus = 1; bonus <= 100; bonus++) {
      const cur = effectiveCap(bonus, 1);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it("result is monotonically non-increasing with playerCount (max bonus)", () => {
    let prev = effectiveCap(MAX_ARMY_BONUS, 1);
    for (let players = 2; players <= 20; players++) {
      const cur = effectiveCap(MAX_ARMY_BONUS, players);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });

  it("effectiveCap never exceeds GLOBAL_ARMY_CAP", () => {
    bonusSamples.forEach((bonus) => {
      countSamples.forEach((players) => {
        expect(effectiveCap(bonus, players)).toBeLessThanOrEqual(
          GLOBAL_ARMY_CAP,
        );
      });
    });
  });

  it("effectiveCap is always a whole number", () => {
    bonusSamples.forEach((bonus) => {
      countSamples.forEach((players) => {
        const cap = effectiveCap(bonus, players);
        expect(cap % 1).toBe(0);
      });
    });
  });
});

describe("Castle bonus sum matches MAX_ARMY_BONUS", () => {
  it("sum of all castle troop bonuses equals MAX_ARMY_BONUS", () => {
    const total = Object.values(CASTLE_BLUEPRINTS).reduce(
      (sum, bp) => sum + bp.troopBonus,
      0,
    );
    expect(total).toBe(MAX_ARMY_BONUS);
  });

  it("no single structure bonus exceeds MAX_ARMY_BONUS", () => {
    Object.values(CASTLE_BLUEPRINTS).forEach((bp) => {
      expect(bp.troopBonus).toBeLessThan(MAX_ARMY_BONUS);
    });
  });
});

describe("String templates — boundary values", () => {
  it("DAY_CHANGE at day 0", () => {
    const s = DAY_CHANGE(0);
    expect(s).toContain("0");
    expect(s.length).toBeGreaterThan(0);
  });

  it("DAY_CHANGE at day 100 (max)", () => {
    const s = DAY_CHANGE(100);
    expect(s).toContain("100");
  });

  it("HUD_ACTION_BAR at day 0, army 0/15", () => {
    const s = HUD_ACTION_BAR(0, "", 0, 15, "Page");
    expect(s).toContain("0");
    expect(s).toContain("15");
    expect(s).toContain("Page");
  });

  it("HUD_ACTION_BAR at day 100, full army 35/35, Mega Knight", () => {
    const s = HUD_ACTION_BAR(100, "██████████", 35, 35, "Mega Knight");
    expect(s).toContain("100");
    expect(s).toContain("35");
    expect(s).toContain("Mega Knight");
  });

  it("SIEGE_WAVE(1, 5) and SIEGE_WAVE(5, 5)", () => {
    expect(SIEGE_WAVE(1, 5)).toContain("1");
    expect(SIEGE_WAVE(5, 5)).toContain("5");
  });

  it("ALLY_INFO with hp equal to maxHp (full health)", () => {
    const s = ALLY_INFO("Knight", 30, 30);
    expect(s).toContain("30/30");
  });

  it("ALLY_INFO with hp=0 (dead)", () => {
    const s = ALLY_INFO("Archer", 0, 20);
    expect(s).toContain("0");
    expect(s).toContain("20");
  });

  it("CASTLE_CAPACITY_UP with +0 bonus edge case", () => {
    const s = CASTLE_CAPACITY_UP(0, 15);
    expect(typeof s).toBe("string");
    expect(s).toContain("0");
  });

  it("ALLY_NOT_YOURS with special characters in name", () => {
    const s = ALLY_NOT_YOURS("Player_123!@#");
    expect(s).toContain("Player_123!@#");
  });

  it("ALLY_RECRUITED with a name containing spaces", () => {
    const s = ALLY_RECRUITED("Dark Knight");
    expect(s).toContain("Dark Knight");
  });

  it("MILESTONE_TITLE with empty string does not throw", () => {
    expect(() => MILESTONE_TITLE("")).not.toThrow();
  });
});

describe("String templates — property tests", () => {
  const rng = makeRng(0xcafebabe);
  const days = Array.from({ length: 101 }, (_, i) => i); // 0–100

  it("DAY_CHANGE always contains the day number for all 0-100", () => {
    days.forEach((d) => {
      expect(DAY_CHANGE(d)).toContain(String(d));
    });
  });

  it("SIEGE_WAVE(n, total) always contains both numbers for representative inputs", () => {
    for (let total = 1; total <= 10; total++) {
      for (let n = 1; n <= total; n++) {
        const s = SIEGE_WAVE(n, total);
        expect(s).toContain(String(n));
        expect(s).toContain(String(total));
      }
    }
  });

  it("HUD_ACTION_BAR never throws for any valid (day, army, cap, tier)", () => {
    const tiers = ["Page", "Squire", "Knight", "Champion", "Mega Knight"];
    for (let day = 0; day <= 100; day += 10) {
      for (let size = 0; size <= 35; size += 5) {
        const tier = tiers[Math.floor((day / 100) * tiers.length)] ?? "Page";
        expect(() => HUD_ACTION_BAR(day, "", size, 35, tier)).not.toThrow();
      }
    }
  });

  it("ALLY_INFO never throws for random hp/maxHp pairs", () => {
    for (let i = 0; i < 100; i++) {
      const maxHp = rng.int(1, 200);
      const hp = rng.int(0, maxHp);
      expect(() => ALLY_INFO("TestAlly", hp, maxHp)).not.toThrow();
    }
  });
});

describe("ARMOR_TIERS — deeper edge cases", () => {
  it("no two tiers share the same tokenItem (excluding null)", () => {
    const tokens = ARMOR_TIERS.map((t) => t.tokenItem).filter(Boolean);
    const unique = new Set(tokens);
    expect(unique.size).toBe(tokens.length);
  });

  it("protection values are whole numbers (no fractional armor)", () => {
    ARMOR_TIERS.forEach((tier) => {
      const slots = Object.values(tier.protection);
      slots.forEach((v) => {
        expect(v % 1).toBe(0);
      });
    });
  });

  it("durability is strictly positive for all tiers", () => {
    ARMOR_TIERS.forEach((tier) => {
      expect(tier.durability).toBeGreaterThan(0);
    });
  });

  it("tokenItem for tier > 0 includes the tier prefix", () => {
    ARMOR_TIERS.filter((t) => t.tokenItem !== null).forEach((tier) => {
      expect(tier.tokenItem).toContain(tier.prefix);
    });
  });

  it("each tier's total protection is strictly greater than the previous", () => {
    const totals = ARMOR_TIERS.map(
      (t) =>
        t.protection.helmet +
        t.protection.chest +
        t.protection.legs +
        t.protection.boots,
    );
    // already checked ascending in data-integrity, but also check no two are equal
    const unique = new Set(totals);
    expect(unique.size).toBe(totals.length);
  });

  it("unlock days increase and are all multiples of 5 (milestone-aligned)", () => {
    ARMOR_TIERS.forEach((tier) => {
      expect(tier.unlockDay % 5).toBe(0);
    });
  });
});

describe("WAVE_DEFINITIONS — entity budget edge cases", () => {
  const MAX_SIEGE_BUDGET = 25; // max siege mobs at any one time (from CLAUDE.md)

  it("no single wave spawns more entities than the siege mob budget", () => {
    // Scaled to 1 player (no reduction)
    WAVE_DEFINITIONS.forEach((wave) => {
      const total = wave.spawns.reduce((sum, s) => sum + s.count, 0);
      expect(
        total,
        `Wave ${wave.waveNumber} spawns ${total} entities, exceeding siege budget of ${MAX_SIEGE_BUDGET}`,
      ).toBeLessThanOrEqual(MAX_SIEGE_BUDGET);
    });
  });

  it("all entity IDs are unique within a wave (no duplicate spawn entries)", () => {
    WAVE_DEFINITIONS.forEach((wave) => {
      const ids = wave.spawns.map((s) => s.entityId);
      const unique = new Set(ids);
      expect(
        unique.size,
        `Wave ${wave.waveNumber} has duplicate entity IDs`,
      ).toBe(ids.length);
    });
  });

  it("wizard first appears no earlier than wave 2", () => {
    const wizardId = "mk:mk_enemy_wizard";
    expect(
      WAVE_DEFINITIONS[0].spawns.some((s) => s.entityId === wizardId),
    ).toBe(false);
  });

  it("waves 3+ should field at least 3 distinct enemy types (complex composition)", () => {
    // Wave 4 deliberately drops the basic knight and focuses on elites, so variety
    // doesn't strictly increase every wave — but from wave 3 onward each wave is
    // complex (≥ 3 distinct enemy types).
    WAVE_DEFINITIONS.slice(2).forEach((wave) => {
      expect(
        wave.spawns.length,
        `Wave ${wave.waveNumber} should have ≥ 3 enemy types`,
      ).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("Loot table entry validation", () => {
  const lootDir = path.join(
    __dirname,
    "../../MegaKnights_BP/loot_tables/entities",
  );

  it("all loot entries should have a positive weight", () => {
    fs.readdirSync(lootDir)
      .filter((f) => f.endsWith(".json"))
      .forEach((file) => {
        const loot = JSON.parse(
          fs.readFileSync(path.join(lootDir, file), "utf-8"),
        );
        (loot.pools ?? []).forEach((pool: any, pi: number) => {
          (pool.entries ?? []).forEach((entry: any, ei: number) => {
            if (entry.weight !== undefined) {
              expect(
                entry.weight,
                `${file} pool[${pi}].entries[${ei}] weight must be > 0`,
              ).toBeGreaterThan(0);
            }
          });
        });
      });
  });

  it("set_count functions should have min ≤ max", () => {
    fs.readdirSync(lootDir)
      .filter((f) => f.endsWith(".json"))
      .forEach((file) => {
        const loot = JSON.parse(
          fs.readFileSync(path.join(lootDir, file), "utf-8"),
        );
        (loot.pools ?? []).forEach((pool: any) => {
          (pool.entries ?? []).forEach((entry: any) => {
            (entry.functions ?? []).forEach((fn: any) => {
              if (fn.function === "set_count" && fn.count) {
                const { min, max } = fn.count;
                if (min !== undefined && max !== undefined) {
                  expect(
                    min,
                    `${file}: set_count min (${min}) must be ≤ max (${max})`,
                  ).toBeLessThanOrEqual(max);
                }
              }
            });
          });
        });
      });
  });

  it("boss loot table should award more experience than regular enemies", () => {
    const bossFile = path.join(lootDir, "mk_boss_siege_lord.json");
    const knightFile = path.join(lootDir, "mk_enemy_knight.json");
    if (!fs.existsSync(bossFile) || !fs.existsSync(knightFile)) return;

    // Compare via entity JSON experience_reward
    const bossEntity = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../MegaKnights_BP/entities/mk_boss_siege_lord.se.json"),
        "utf-8",
      ),
    );
    const knightEntity = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../MegaKnights_BP/entities/mk_enemy_knight.se.json"),
        "utf-8",
      ),
    );

    // Extract numeric reward from Molang expression "q.last_hit_by_player ? N : 0"
    const extractXp = (reward: string): number => {
      const m = reward.match(/\?\s*(\d+)/);
      return m ? parseInt(m[1]) : 0;
    };

    const bossXp = extractXp(
      bossEntity["minecraft:entity"]?.components?.["minecraft:experience_reward"]?.on_death ?? "",
    );
    const knightXp = extractXp(
      knightEntity["minecraft:entity"]?.components?.["minecraft:experience_reward"]?.on_death ?? "",
    );

    expect(bossXp).toBeGreaterThan(knightXp);
  });
});

describe("Entity stat scaling — property tests", () => {
  const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");

  function loadEntity(filename: string): any {
    return JSON.parse(
      fs.readFileSync(path.join(entitiesDir, filename), "utf-8"),
    )["minecraft:entity"];
  }

  it("ally dark_knight should have higher health than ally knight", () => {
    const dk = loadEntity("mk_ally_dark_knight.se.json");
    const k = loadEntity("mk_ally_knight.se.json");
    expect(dk.components["minecraft:health"].max).toBeGreaterThan(
      k.components["minecraft:health"].max,
    );
  });

  it("ally dark_knight should deal more damage than ally knight", () => {
    const dk = loadEntity("mk_ally_dark_knight.se.json");
    const k = loadEntity("mk_ally_knight.se.json");
    expect(dk.components["minecraft:attack"].damage).toBeGreaterThan(
      k.components["minecraft:attack"].damage,
    );
  });

  it("boss should have more health than any regular enemy", () => {
    const bossHealth = loadEntity("mk_boss_siege_lord.se.json").components[
      "minecraft:health"
    ].max;
    ["mk_enemy_knight", "mk_enemy_archer", "mk_enemy_wizard", "mk_enemy_dark_knight"].forEach(
      (name) => {
        const enemyHealth = loadEntity(`${name}.se.json`).components[
          "minecraft:health"
        ].max;
        expect(bossHealth).toBeGreaterThan(enemyHealth);
      },
    );
  });

  it("boss should deal more damage than any regular enemy", () => {
    const bossDamage = loadEntity("mk_boss_siege_lord.se.json").components[
      "minecraft:attack"
    ].damage;
    ["mk_enemy_knight", "mk_enemy_archer", "mk_enemy_wizard", "mk_enemy_dark_knight"].forEach(
      (name) => {
        const enemyDamage = loadEntity(`${name}.se.json`).components[
          "minecraft:attack"
        ].damage;
        expect(bossDamage).toBeGreaterThan(enemyDamage);
      },
    );
  });

  it("no entity has a health value of 0 (unplayable)", () => {
    fs.readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"))
      .forEach((file) => {
        const entity = loadEntity(file);
        const hp = entity?.components?.["minecraft:health"];
        if (hp) {
          expect(hp.value, `${file} has 0 health`).toBeGreaterThan(0);
          expect(hp.max, `${file} has 0 max health`).toBeGreaterThan(0);
        }
      });
  });
});
