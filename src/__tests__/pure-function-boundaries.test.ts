/**
 * pure-function-boundaries.test.ts
 *
 * Boundary value testing for pure functions, data mappings, and
 * deterministic reimplementations of game logic.
 *
 * Covers gaps not addressed by other test files:
 * - Compass direction: exact boundaries for all 8 direction bins
 * - sanitizePlayerTag: edge cases (empty, unicode, special chars)
 * - getOwnerTag: cache construction
 * - Wave scale factors: boundary values for player counts
 * - Siege spawn scaling: exact entity counts at boundaries
 * - Ally display name: fallback formatting for unknown types
 * - Merchant days: boundary with camp cooldown system
 * - DayCounter setDay: milestone stagger ordering
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import {
  CAMP_TIERS,
  getCampTierForDay,
  CAMP_COOLDOWN_DAYS,
  CAMP_START_DAY,
} from "../data/CampDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import { ARMOR_TIERS } from "../data/ArmorTiers";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

// ─── 1. Compass direction exact boundaries ──────────────────────────────────

describe("Compass direction: exact boundary values", () => {
  /**
   * Reimplementation of EnemyCampSystem.getCompassDirection(angle).
   * cos(angle)=X, sin(angle)=Z, +Z=South in Bedrock.
   * 0°=East, 90°=South, 180°=West, 270°=North.
   */
  function getCompassDirection(angle: number): string {
    const deg = (((angle * 180) / Math.PI) % 360 + 360) % 360;
    if (deg < 22.5 || deg >= 337.5) return "East";
    if (deg < 67.5) return "Southeast";
    if (deg < 112.5) return "South";
    if (deg < 157.5) return "Southwest";
    if (deg < 202.5) return "West";
    if (deg < 247.5) return "Northwest";
    if (deg < 292.5) return "North";
    return "Northeast";
  }

  // Convert degrees to radians for test inputs
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  it("0° → East", () => {
    expect(getCompassDirection(0)).toBe("East");
  });

  it("360° wraps to East", () => {
    expect(getCompassDirection(toRad(360))).toBe("East");
  });

  it("negative angle -45° wraps to Northeast", () => {
    expect(getCompassDirection(toRad(-45))).toBe("Northeast");
  });

  it("negative angle -90° wraps to North", () => {
    expect(getCompassDirection(toRad(-90))).toBe("North");
  });

  it("large angle 720° wraps to East", () => {
    expect(getCompassDirection(toRad(720))).toBe("East");
  });

  // Test exact bin boundaries (both sides)
  const binBoundaries: [number, string, string][] = [
    [22.4, "East", "just below 22.5°"],
    [22.5, "Southeast", "exactly 22.5°"],
    [67.4, "Southeast", "just below 67.5°"],
    [67.5, "South", "exactly 67.5°"],
    [112.4, "South", "just below 112.5°"],
    [112.5, "Southwest", "exactly 112.5°"],
    [157.4, "Southwest", "just below 157.5°"],
    [157.5, "West", "exactly 157.5°"],
    [202.4, "West", "just below 202.5°"],
    [202.5, "Northwest", "exactly 202.5°"],
    [247.4, "Northwest", "just below 247.5°"],
    [247.5, "North", "exactly 247.5°"],
    [292.4, "North", "just below 292.5°"],
    [292.5, "Northeast", "exactly 292.5°"],
    [337.4, "Northeast", "just below 337.5°"],
    [337.5, "East", "exactly 337.5° wraps to East"],
  ];

  for (const [deg, expected, desc] of binBoundaries) {
    it(`${deg}° (${desc}) → ${expected}`, () => {
      expect(getCompassDirection(toRad(deg))).toBe(expected);
    });
  }

  // Center of each 45° bin
  const binCenters: [number, string][] = [
    [0, "East"],
    [45, "Southeast"],
    [90, "South"],
    [135, "Southwest"],
    [180, "West"],
    [225, "Northwest"],
    [270, "North"],
    [315, "Northeast"],
  ];

  for (const [deg, expected] of binCenters) {
    it(`${deg}° (center) → ${expected}`, () => {
      expect(getCompassDirection(toRad(deg))).toBe(expected);
    });
  }

  it("all 8 directions are reachable", () => {
    const directions = new Set(binCenters.map(([, d]) => d));
    expect(directions.size).toBe(8);
  });

  it("matches source implementation", () => {
    const campSrc = readSource("systems/EnemyCampSystem.ts");
    // Verify boundary values in source match our reimplementation
    expect(campSrc).toContain("deg < 22.5");
    expect(campSrc).toContain("deg >= 337.5");
    expect(campSrc).toContain("deg < 67.5");
    expect(campSrc).toContain("deg < 112.5");
    expect(campSrc).toContain("deg < 157.5");
    expect(campSrc).toContain("deg < 202.5");
    expect(campSrc).toContain("deg < 247.5");
    expect(campSrc).toContain("deg < 292.5");
  });
});

// ─── 2. sanitizePlayerTag edge cases ────────────────────────────────────────

describe("sanitizePlayerTag: edge cases", () => {
  /**
   * Reimplementation of ArmySystem.sanitizePlayerTag(name).
   */
  function sanitizePlayerTag(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  it("alphanumeric passes through unchanged", () => {
    expect(sanitizePlayerTag("Steve123")).toBe("Steve123");
  });

  it("underscores and hyphens pass through", () => {
    expect(sanitizePlayerTag("Player_1-test")).toBe("Player_1-test");
  });

  it("spaces replaced with underscores", () => {
    expect(sanitizePlayerTag("Player Name")).toBe("Player_Name");
  });

  it("special characters replaced", () => {
    expect(sanitizePlayerTag("Player@#$%^&*()")).toBe("Player_________");
  });

  it("Minecraft § color codes replaced", () => {
    expect(sanitizePlayerTag("§4EvilPlayer")).toBe("_4EvilPlayer");
  });

  it("Unicode characters replaced", () => {
    expect(sanitizePlayerTag("日本語プレイヤー")).toBe("________");
  });

  it("empty string returns empty", () => {
    expect(sanitizePlayerTag("")).toBe("");
  });

  it("single character", () => {
    expect(sanitizePlayerTag("A")).toBe("A");
    expect(sanitizePlayerTag("!")).toBe("_");
  });

  it("long name with mixed characters", () => {
    const input = "Player 1 (Admin) [VIP] {Owner}";
    const result = sanitizePlayerTag(input);
    expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(result).toHaveLength(input.length);
  });

  it("getOwnerTag wraps with mk_owner_ prefix", () => {
    function getOwnerTag(name: string): string {
      return `mk_owner_${sanitizePlayerTag(name)}`;
    }
    expect(getOwnerTag("Steve")).toBe("mk_owner_Steve");
    expect(getOwnerTag("Player 1")).toBe("mk_owner_Player_1");
  });

  it("source sanitization regex matches our reimplementation", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    expect(armySrc).toContain('name.replace(/[^a-zA-Z0-9_-]/g, "_")');
  });
});

// ─── 3. Ally display name formatting ────────────────────────────────────────

describe("Ally display name formatting", () => {
  /**
   * Reimplementation of ArmySystem.allyDisplayName(allyTypeId).
   */
  const ALLY_DISPLAY_NAMES = new Map<string, string>([
    ["mk:mk_ally_knight", "Knight"],
    ["mk:mk_ally_archer", "Archer"],
    ["mk:mk_ally_wizard", "Wizard"],
    ["mk:mk_ally_dark_knight", "Dark Knight"],
  ]);

  function allyDisplayName(allyTypeId: string): string {
    const cached = ALLY_DISPLAY_NAMES.get(allyTypeId);
    if (cached) return cached;
    const raw = allyTypeId.replace("mk:mk_ally_", "").replace(/_/g, " ");
    return raw
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  it("known types return exact cached names", () => {
    expect(allyDisplayName("mk:mk_ally_knight")).toBe("Knight");
    expect(allyDisplayName("mk:mk_ally_archer")).toBe("Archer");
    expect(allyDisplayName("mk:mk_ally_wizard")).toBe("Wizard");
    expect(allyDisplayName("mk:mk_ally_dark_knight")).toBe("Dark Knight");
  });

  it("standard bearer uses fallback formatting", () => {
    expect(allyDisplayName("mk:mk_ally_standard_bearer")).toBe("Standard Bearer");
  });

  it("unknown type generates title-case name", () => {
    expect(allyDisplayName("mk:mk_ally_mega_warrior")).toBe("Mega Warrior");
  });

  it("enemy-to-ally type mapping works (replace _enemy_ with _ally_)", () => {
    const enemyTypeId = "mk:mk_enemy_dark_knight";
    const allyTypeId = enemyTypeId.replace("_enemy_", "_ally_");
    expect(allyTypeId).toBe("mk:mk_ally_dark_knight");
    expect(allyDisplayName(allyTypeId)).toBe("Dark Knight");
  });
});

// ─── 4. Wave scale factor boundary values ───────────────────────────────────

describe("Wave scale factor boundaries", () => {
  const MAX_SPAWNS_PER_PLAYER = 24;

  /**
   * Reimplementation of SiegeSystem.spawnWave() scaling logic.
   */
  function computeSpawnCount(
    waveIndex: number,
    playerCount: number,
  ): { total: number; perPlayer: number[] } {
    const wave = WAVE_DEFINITIONS[waveIndex];
    const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;
    const perPlayer: number[] = [];

    for (let p = 0; p < playerCount; p++) {
      let playerSpawns = 0;
      for (const spawn of wave.spawns) {
        const scaled = Math.max(1, Math.round(spawn.count * scaleFactor));
        const actual = Math.min(scaled, MAX_SPAWNS_PER_PLAYER - playerSpawns);
        if (actual <= 0) break;
        playerSpawns += actual;
        if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) break;
      }
      perPlayer.push(playerSpawns);
    }

    return { total: perPlayer.reduce((a, b) => a + b, 0), perPlayer };
  }

  it("1 player: no scaling (factor = 1.0)", () => {
    const { total } = computeSpawnCount(0, 1); // Wave 1: 5+3 = 8
    expect(total).toBe(8);
  });

  it("2 players: 0.75x scaling", () => {
    const { total } = computeSpawnCount(0, 2);
    // Wave 1: 5*0.75=4(round), 3*0.75=2(round) = 6 per player, * 2 = 12
    expect(total).toBe(12);
  });

  it("3 players: 0.6x scaling", () => {
    const { total } = computeSpawnCount(0, 3);
    // Wave 1: 5*0.6=3(round), 3*0.6=2(round) = 5 per player, * 3 = 15
    expect(total).toBe(15);
  });

  it("scale factor boundary: playerCount=2 is exactly 0.75", () => {
    const siegeSrc = readSource("systems/SiegeSystem.ts");
    expect(siegeSrc).toMatch(/playerCount\s*<=\s*2\s*\?\s*0\.75/);
  });

  it("scale factor boundary: playerCount=3+ is exactly 0.6", () => {
    const siegeSrc = readSource("systems/SiegeSystem.ts");
    expect(siegeSrc).toContain(": 0.6");
  });

  it("per-player spawn count never exceeds MAX_SPAWNS_PER_PLAYER", () => {
    for (let wi = 0; wi < WAVE_DEFINITIONS.length; wi++) {
      for (let pc = 1; pc <= 4; pc++) {
        const { perPlayer } = computeSpawnCount(wi, pc);
        for (const pp of perPlayer) {
          expect(pp).toBeLessThanOrEqual(MAX_SPAWNS_PER_PLAYER);
        }
      }
    }
  });

  it("Math.max(1, ...) guarantees minimum 1 per spawn entry", () => {
    // Even with aggressive scaling, each spawn type gets at least 1
    const siegeSrc = readSource("systems/SiegeSystem.ts");
    expect(siegeSrc).toMatch(/Math\.max\(\s*1\s*,\s*Math\.round\(\s*spawn\.count\s*\*\s*this\.enemyMultiplier\s*\*\s*mpScale\s*\)/);
  });
});

// ─── 5. Merchant day / camp cooldown interaction ────────────────────────────

describe("Merchant day / camp cooldown interaction", () => {
  const MERCHANT_DAYS = new Set([15, 30, 55, 75, 95]);
  const milestoneSrc = readSource("data/MilestoneEvents.ts");
  const MILESTONE_DAYS = new Set(
    [...milestoneSrc.matchAll(/^\s*(\d+)\s*:\s*\{/gm)].map((m) => Number(m[1])),
  );

  it("no merchant day falls on a milestone day", () => {
    for (const md of MERCHANT_DAYS) {
      expect(MILESTONE_DAYS.has(md), `Merchant day ${md} collides with milestone`).toBe(
        false,
      );
    }
  });

  it("merchant days are spaced ≥ CAMP_COOLDOWN_DAYS apart", () => {
    const sorted = [...MERCHANT_DAYS].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(CAMP_COOLDOWN_DAYS);
    }
  });

  it("merchant days occur in all 5 camp tiers", () => {
    const merchantTiers = new Set<string>();
    for (const day of MERCHANT_DAYS) {
      const tier = getCampTierForDay(day);
      if (tier) merchantTiers.add(tier.name);
    }
    expect(merchantTiers.size).toBe(CAMP_TIERS.length);
  });

  it("camps are allowed on merchant days (only MILESTONE_DAYS are skipped)", () => {
    const campSrc = readSource("systems/EnemyCampSystem.ts");
    // Camp system checks MILESTONE_DAYS.has(day) but NOT merchant days
    expect(campSrc).toContain("MILESTONE_DAYS.has(day)");
    expect(campSrc).not.toContain("MERCHANT_DAYS");
  });

  it("last merchant (day 95) gives players time to buy before siege (day 100)", () => {
    const lastMerchant = Math.max(...MERCHANT_DAYS);
    expect(100 - lastMerchant).toBeGreaterThanOrEqual(5);
  });
});

// ─── 6. Castle blueprint unlock timing ──────────────────────────────────────

describe("Castle blueprint unlock timing", () => {
  const blueprints = Object.values(CASTLE_BLUEPRINTS);

  it("blueprints unlock on milestone days", () => {
    const milestoneSrc = readSource("data/MilestoneEvents.ts");
    for (const bp of blueprints) {
      const pattern = new RegExp(`${bp.unlockDay}\\s*:\\s*\\{`);
      expect(milestoneSrc).toMatch(pattern);
    }
  });

  it("blueprint unlock days are strictly ascending", () => {
    for (let i = 1; i < blueprints.length; i++) {
      expect(blueprints[i].unlockDay).toBeGreaterThan(blueprints[i - 1].unlockDay);
    }
  });

  it("cumulative troop bonuses: 5 → 12 → 20", () => {
    let cumulative = 0;
    const expected = [5, 12, 20];
    for (let i = 0; i < blueprints.length; i++) {
      cumulative += blueprints[i].troopBonus;
      expect(cumulative).toBe(expected[i]);
    }
  });

  it("all blueprints unlock before the siege (day < 100)", () => {
    for (const bp of blueprints) {
      expect(bp.unlockDay).toBeLessThan(100);
    }
  });

  it("first blueprint (tower) unlocks before first enemy encounter (day 10)", () => {
    expect(blueprints[0].unlockDay).toBeLessThan(10);
  });

  it("great hall unlocks at or before day 50 (mid-game power spike)", () => {
    const greatHall = CASTLE_BLUEPRINTS.great_hall;
    expect(greatHall.unlockDay).toBeLessThanOrEqual(50);
  });
});

// ─── 7. Armor tier unlock timing ────────────────────────────────────────────

describe("Armor tier unlock timing", () => {
  it("tier unlock days align with milestone days", () => {
    const milestoneSrc = readSource("data/MilestoneEvents.ts");
    for (const tier of ARMOR_TIERS) {
      if (tier.unlockDay === 0) continue; // Page is unlocked by default
      const pattern = new RegExp(`${tier.unlockDay}\\s*:\\s*\\{`);
      expect(
        milestoneSrc,
        `Tier ${tier.name} unlock day ${tier.unlockDay} is not a milestone`,
      ).toMatch(pattern);
    }
  });

  it("unlock days are multiples of 5", () => {
    for (const tier of ARMOR_TIERS) {
      expect(tier.unlockDay % 5).toBe(0);
    }
  });

  it("spacing between tier unlocks increases (longer grind at higher tiers)", () => {
    const gaps: number[] = [];
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      gaps.push(ARMOR_TIERS[i].unlockDay - ARMOR_TIERS[i - 1].unlockDay);
    }
    // 20, 20, 20, 25 — non-decreasing
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]);
    }
  });

  it("Mega Knight unlocks at day 85, giving 15 days to prepare for siege", () => {
    const megaKnight = ARMOR_TIERS[ARMOR_TIERS.length - 1];
    expect(megaKnight.unlockDay).toBe(85);
    expect(100 - megaKnight.unlockDay).toBe(15);
  });
});

// ─── 8. setDay milestone stagger verification ───────────────────────────────

describe("setDay milestone stagger", () => {
  const daySrc = readSource("systems/DayCounterSystem.ts");

  it("setDay collects days to fire in a loop", () => {
    const setDay = daySrc.slice(
      daySrc.indexOf("setDay(day: number)"),
      daySrc.indexOf("reset(): void"),
    );
    expect(setDay).toMatch(/for\s*\(\s*let\s+d\s*=\s*previousDay\s*\+\s*1;\s*d\s*<=\s*day;\s*d\+\+\)/);
  });

  it("stagger uses system.runJob with yield per day", () => {
    const setDay = daySrc.slice(
      daySrc.indexOf("setDay(day: number)"),
      daySrc.indexOf("reset(): void"),
    );
    expect(setDay).toContain("system.runJob(");
    expect(setDay).toContain("yield; // One day per tick");
  });

  it("setDay fires callbacks for each intermediate day", () => {
    const setDay = daySrc.slice(
      daySrc.indexOf("setDay(day: number)"),
      daySrc.indexOf("reset(): void"),
    );
    expect(setDay).toContain("for (const cb of callbacks)");
    expect(setDay).toContain("cb(d)");
  });

  it("setDay clamps to [0, maxDay] before processing (endless-aware)", () => {
    expect(daySrc).toMatch(/maxDay\s*=\s*this\.cachedEndless\s*\?\s*999\s*:\s*DayCounterSystem\.MAX_DAY/);
    expect(daySrc).toMatch(
      /day\s*=\s*Math\.max\(\s*0\s*,\s*Math\.min\(\s*maxDay\s*,\s*day\s*\)/,
    );
  });

  it("setDay auto-activates quest if not active", () => {
    const setDay = daySrc.slice(
      daySrc.indexOf("setDay(day: number)"),
      daySrc.indexOf("reset(): void"),
    );
    expect(setDay).toContain("!this.cachedActive");
    expect(setDay).toContain("this.cachedActive = true");
  });
});

// ─── 9. Camp exclusion logic completeness ───────────────────────────────────

describe("Camp exclusion logic completeness", () => {
  const campSrc = readSource("systems/EnemyCampSystem.ts");

  it("camps blocked below CAMP_START_DAY", () => {
    expect(campSrc).toContain("day < CAMP_START_DAY");
  });

  it("camps continue in endless mode (no day >= 100 guard)", () => {
    // Camp system no longer blocks at day 100 — endless mode uses the last camp tier
    expect(campSrc).not.toContain("day >= 100");
  });

  it("camps blocked during siege", () => {
    expect(campSrc).toMatch(/if\s*\(\s*siegeActive\s*\)\s*\{?\s*return/);
  });

  it("camps blocked on milestone days", () => {
    expect(campSrc).toContain("MILESTONE_DAYS.has(day)");
  });

  it("camps blocked if player already has active camp", () => {
    expect(campSrc).toContain("this.activeCamps.has(name)");
  });

  it("camps blocked during cooldown", () => {
    expect(campSrc).toContain("day - lastDay < CAMP_COOLDOWN_DAYS");
  });

  it("all 6 exclusion conditions come before spawn call", () => {
    const onDayChanged = campSrc.slice(
      campSrc.indexOf("onDayChanged("),
      campSrc.indexOf("setupDeathListener"),
    );
    const spawnIdx = onDayChanged.indexOf("this.spawnCamp(");
    const conditions = [
      "day < CAMP_START_DAY",
      "day >= 100",
      "siegeActive",
      "MILESTONE_DAYS.has(day)",
      "this.activeCamps.has(name)",
      "day - lastDay < CAMP_COOLDOWN_DAYS",
    ];
    for (const cond of conditions) {
      const condIdx = onDayChanged.indexOf(cond);
      expect(condIdx, `Condition "${cond}" should appear before spawnCamp`).toBeLessThan(
        spawnIdx,
      );
    }
  });
});

// ─── 10. Nameplate formatting safety ────────────────────────────────────────

describe("Nameplate formatting safety", () => {
  it("ally nametag uses procedural name with green color §a", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    // Recruited allies get procedural names: "§aSir Marcus §7(Knight)"
    expect(armySrc).toContain("generateAllyName");
    expect(armySrc).toContain("`§a${allyName}");
  });

  it("merchant nametag uses gold color §6", () => {
    const merchantSrc = readSource("systems/MerchantSystem.ts");
    expect(merchantSrc).toContain('§6Wandering Merchant');
  });

  it("debug spawn also strips § codes", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    const debugSection = armySrc.slice(armySrc.indexOf("debugSpawnAllies"));
    expect(debugSection).toContain('playerName.replace(/§./g, "")');
  });
});
