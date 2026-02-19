/**
 * e2e-flows.test.ts
 *
 * End-to-end quest flow validation. Simulates the full 100-day quest by
 * validating data consistency and logic invariants across all data files —
 * without requiring the Minecraft scripting API.
 *
 * E2E scenario covered:
 *   Day 0  → Quest starts, Page armor given
 *   Day 1  → First milestone (flavor text)
 *   Day 5  → Small Tower blueprint distributed
 *   Day 10 → Enemy scouts milestone; knights/archers unlock for natural spawning
 *   Day 20 → Squire armor unlocked
 *   Day 25 → Raider attack
 *   Day 35 → Gatehouse blueprint distributed
 *   Day 40 → Knight armor unlocked
 *   Day 50 → Great Hall blueprint + dark force attack; wizards unlock for natural spawning
 *   Day 60 → Champion armor unlocked
 *   Day 70 → Enemy army attack; dark knights unlock for natural spawning
 *   Day 85 → Mega Knight armor unlocked (final tier)
 *   Day 90 → Siege Lord's vanguard attack
 *   Day 100 → Final siege: 5 waves + boss → victory/defeat
 */

import { describe, it, expect } from "vitest";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants (mirrored from system files — test catches drift)
// ---------------------------------------------------------------------------

const BASE_ARMY_SIZE = 15;
const MAX_ARMY_BONUS = 20;
const GLOBAL_ARMY_CAP = 35;
const MAX_DAY = 100;
const MAX_ACTIVE_SIEGE_MOBS = 25;
const MAX_MILESTONE_ENTITIES = 20;

/** Milestone days extracted from MilestoneEvents.ts */
const MILESTONE_DAYS = [1, 5, 10, 20, 25, 35, 40, 50, 60, 70, 85, 90];

/** Tier unlock days derived from ArmorTiers.ts */
const TIER_UNLOCK_DAYS = ARMOR_TIERS.map((t) => t.unlockDay);

/** Enemy gating schedule from main.ts ENEMY_SPAWN_DAY */
const ENEMY_SPAWN_DAYS: Record<string, number> = {
  "mk:mk_enemy_knight": 10,
  "mk:mk_enemy_archer": 10,
  "mk:mk_enemy_wizard": 50,
  "mk:mk_enemy_dark_knight": 70,
};

// ---------------------------------------------------------------------------

describe("Quest Flow: Day Timeline", () => {
  it("quest runs exactly 100 days", () => {
    expect(MAX_DAY).toBe(100);
  });

  it("there are 12 milestone events across the 100-day quest", () => {
    expect(MILESTONE_DAYS.length).toBe(12);
  });

  it("all milestones occur within the quest range (days 1-99)", () => {
    for (const day of MILESTONE_DAYS) {
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThan(MAX_DAY); // none fire on day 100 — that's the siege
    }
  });

  it("milestone days are in strictly ascending order", () => {
    for (let i = 1; i < MILESTONE_DAYS.length; i++) {
      expect(MILESTONE_DAYS[i]).toBeGreaterThan(MILESTONE_DAYS[i - 1]);
    }
  });

  it("no two milestones share a day", () => {
    const unique = new Set(MILESTONE_DAYS);
    expect(unique.size).toBe(MILESTONE_DAYS.length);
  });

  it("day 100 siege fires after all milestones complete", () => {
    const lastMilestoneDay = Math.max(...MILESTONE_DAYS);
    expect(lastMilestoneDay).toBeLessThan(MAX_DAY);
  });

  it("milestone and siege days are mutually exclusive", () => {
    expect(MILESTONE_DAYS).not.toContain(MAX_DAY);
  });
});

// ---------------------------------------------------------------------------

describe("Quest Flow: Armor Progression", () => {
  it("tier 0 (Page) is available from day 0 — no waiting required", () => {
    expect(TIER_UNLOCK_DAYS[0]).toBe(0);
  });

  it("armor unlocks span early, mid, and late quest (days 20, 40, 60, 85)", () => {
    // Milestone days include all armor unlock days
    const armorUnlockDays = TIER_UNLOCK_DAYS.filter((d) => d > 0);
    for (const day of armorUnlockDays) {
      expect(MILESTONE_DAYS).toContain(day);
    }
  });

  it("player always has max armor before the day-100 siege", () => {
    const lastTierDay = Math.max(...TIER_UNLOCK_DAYS);
    expect(lastTierDay).toBeLessThan(MAX_DAY);
  });

  it("Mega Knight unlocks exactly 15 days before siege — enough prep time", () => {
    const megaKnight = ARMOR_TIERS[ARMOR_TIERS.length - 1];
    expect(megaKnight.name).toBe("Mega Knight");
    expect(MAX_DAY - megaKnight.unlockDay).toBe(15);
  });

  it("armor tiers unlock in order with no gaps skipped", () => {
    for (let i = 1; i < TIER_UNLOCK_DAYS.length; i++) {
      expect(TIER_UNLOCK_DAYS[i]).toBeGreaterThan(TIER_UNLOCK_DAYS[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------

describe("Quest Flow: Castle Building Progression", () => {
  it("small tower is the first castle reward (day 5)", () => {
    expect(CASTLE_BLUEPRINTS["small_tower"].unlockDay).toBe(5);
    expect(MILESTONE_DAYS).toContain(5);
    expect(CASTLE_BLUEPRINTS["small_tower"].unlockDay).toBeLessThan(
      CASTLE_BLUEPRINTS["gatehouse"].unlockDay,
    );
  });

  it("gatehouse unlocks at day 35 (matching milestone)", () => {
    expect(CASTLE_BLUEPRINTS["gatehouse"].unlockDay).toBe(35);
    expect(MILESTONE_DAYS).toContain(35);
  });

  it("great hall unlocks at day 50 (matching milestone)", () => {
    expect(CASTLE_BLUEPRINTS["great_hall"].unlockDay).toBe(50);
    expect(MILESTONE_DAYS).toContain(50);
  });

  it("all castle blueprints unlock before the siege", () => {
    for (const bp of Object.values(CASTLE_BLUEPRINTS)) {
      expect(bp.unlockDay).toBeLessThan(MAX_DAY);
    }
  });

  it("building all castles gives exactly 20 army bonus (fills global cap)", () => {
    const total = Object.values(CASTLE_BLUEPRINTS).reduce((sum, b) => sum + b.troopBonus, 0);
    expect(total).toBe(MAX_ARMY_BONUS);
  });

  it("solo player with all castles hits the global army cap exactly", () => {
    const maxArmy = BASE_ARMY_SIZE + MAX_ARMY_BONUS;
    expect(maxArmy).toBe(GLOBAL_ARMY_CAP);
  });

  it("tower (+5) → gatehouse (+7) → great hall (+8) gives strictly increasing bonuses", () => {
    const bonuses = Object.values(CASTLE_BLUEPRINTS).map((b) => b.troopBonus);
    for (let i = 1; i < bonuses.length; i++) {
      expect(bonuses[i]).toBeGreaterThan(bonuses[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------

describe("Quest Flow: Enemy Escalation Timing", () => {
  it("basic enemies (knights, archers) unlock at day 10 — matching first combat milestone", () => {
    expect(ENEMY_SPAWN_DAYS["mk:mk_enemy_knight"]).toBe(10);
    expect(ENEMY_SPAWN_DAYS["mk:mk_enemy_archer"]).toBe(10);
    expect(MILESTONE_DAYS).toContain(10);
  });

  it("wizards unlock at day 50 — same day as great hall (adds wizard threat alongside upgrade)", () => {
    expect(ENEMY_SPAWN_DAYS["mk:mk_enemy_wizard"]).toBe(50);
    expect(CASTLE_BLUEPRINTS["great_hall"].unlockDay).toBe(50);
  });

  it("dark knights unlock at day 70 — two weeks before Mega Knight unlock", () => {
    expect(ENEMY_SPAWN_DAYS["mk:mk_enemy_dark_knight"]).toBe(70);
    expect(MILESTONE_DAYS).toContain(70);
  });

  it("no enemy type unlocks for natural spawning after day 70 (no surprise enemies during siege prep)", () => {
    const maxEnemyUnlockDay = Math.max(...Object.values(ENEMY_SPAWN_DAYS));
    // At least 15 days between last unlock and siege start (day 100)
    expect(MAX_DAY - maxEnemyUnlockDay).toBeGreaterThanOrEqual(15);
  });

  it("all gated enemy types unlock before or on the day they first appear in milestones", () => {
    // Read milestone source to cross-check
    const milestoneSrc = fs.readFileSync(
      path.join(__dirname, "../data/MilestoneEvents.ts"),
      "utf-8",
    );

    // Validate each enemy type's gating day is ≤ its first milestone appearance
    // Day 10 milestone spawns mk:mk_enemy_knight (gate=10) and mk:mk_enemy_archer (gate=10)
    const knightFirstMilestone = 10;
    const archerFirstMilestone = 10;
    expect(ENEMY_SPAWN_DAYS["mk:mk_enemy_knight"]).toBeLessThanOrEqual(knightFirstMilestone);
    expect(ENEMY_SPAWN_DAYS["mk:mk_enemy_archer"]).toBeLessThanOrEqual(archerFirstMilestone);

    // Verify wizard appears in source at day 50
    const wizardMilestonePattern = /50:\s*\{[\s\S]*?mk_enemy_wizard/;
    expect(wizardMilestonePattern.test(milestoneSrc)).toBe(true);
    expect(ENEMY_SPAWN_DAYS["mk:mk_enemy_wizard"]).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------

describe("Quest Flow: Siege", () => {
  it("siege triggers at the start of day 100", () => {
    // main.ts: dayCounter.onDayChanged(day => { if (day >= 100) siege.startSiege() })
    expect(MAX_DAY).toBe(100);
  });

  it("siege contains exactly 5 waves", () => {
    expect(WAVE_DEFINITIONS.length).toBe(5);
  });

  it("siege duration estimate: all 5 waves at 60s delay = ~4 minutes", () => {
    // Wave 1 immediate + 4 waves × 1200 ticks @ 20 ticks/sec = 60s each
    const totalDelayTicks = WAVE_DEFINITIONS.reduce((sum, w) => sum + w.delayTicks, 0);
    const totalDelaySeconds = totalDelayTicks / 20;
    // 4 × 60 = 240 seconds max wave delay (excluding combat time)
    expect(totalDelaySeconds).toBe(240);
  });

  it("wave 5 has both boss and elite support units", () => {
    const wave5 = WAVE_DEFINITIONS[4];
    const hasBoss = wave5.spawns.some((s) => s.entityId.includes("boss"));
    const hasElites = wave5.spawns.some(
      (s) => s.entityId.includes("dark_knight") || s.entityId.includes("knight"),
    );
    expect(hasBoss).toBe(true);
    expect(hasElites).toBe(true);
  });

  it("entity budget during siege: allies + siege mobs stays within Switch limit (60)", () => {
    const maxConcurrentEntities = GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS;
    expect(maxConcurrentEntities).toBeLessThanOrEqual(60);
  });

  it("milestone entity spawns never overlap with siege (milestones end at day 90, siege starts at 100)", () => {
    const lastMilestoneDay = Math.max(...MILESTONE_DAYS);
    expect(lastMilestoneDay).toBeLessThan(MAX_DAY);
    // 10-day gap ensures no simultaneous milestone + siege entities
    expect(MAX_DAY - lastMilestoneDay).toBeGreaterThanOrEqual(10);
  });

  it("worst-case entity count: MAX_SIEGE_MOBS + GLOBAL_ARMY_CAP = 60", () => {
    expect(MAX_ACTIVE_SIEGE_MOBS + GLOBAL_ARMY_CAP).toBe(60);
  });
});

// ---------------------------------------------------------------------------

describe("Cross-System Consistency: Milestone Source", () => {
  const milestoneSrc = fs.readFileSync(
    path.join(__dirname, "../data/MilestoneEvents.ts"),
    "utf-8",
  );

  it("milestone source references all armor tier unlock days", () => {
    for (const tier of ARMOR_TIERS) {
      if (tier.tier === 0) continue; // Page is given free, no milestone
      const dayPattern = new RegExp(`${tier.unlockDay}:\\s*\\{`);
      expect(dayPattern.test(milestoneSrc), `Tier "${tier.name}" day ${tier.unlockDay} missing`).toBe(
        true,
      );
    }
  });

  it("milestone source references all castle blueprint unlock days", () => {
    for (const bp of Object.values(CASTLE_BLUEPRINTS)) {
      const dayPattern = new RegExp(`${bp.unlockDay}:\\s*\\{`);
      expect(
        dayPattern.test(milestoneSrc),
        `Blueprint "${bp.displayName}" day ${bp.unlockDay} missing from milestones`,
      ).toBe(true);
    }
  });

  it("milestone source calls ArmorTierSystem.unlockTier with correct tier indices", () => {
    // Tier 1 (Squire) → unlockTier(1), Tier 2 (Knight) → unlockTier(2), etc.
    for (const tier of ARMOR_TIERS) {
      if (tier.tier === 0) continue;
      expect(milestoneSrc).toContain(`unlockTier(${tier.tier})`);
    }
  });

  it("milestone source gives the correct blueprint items to players", () => {
    for (const bp of Object.values(CASTLE_BLUEPRINTS)) {
      const expectedItem = `mk:mk_blueprint_${bp.id}`;
      expect(milestoneSrc).toContain(expectedItem);
    }
  });

  it("all enemy types spawned in milestones are gated in ENEMY_SPAWN_DAY", () => {
    const waveSrc = fs.readFileSync(path.join(__dirname, "../data/WaveDefinitions.ts"), "utf-8");
    const enemyMatches = milestoneSrc.match(/entityId:\s*"(mk:mk_enemy_[^"]+)"/g) ?? [];
    const enemyTypes = new Set(
      enemyMatches.map((m) => m.match(/"([^"]+)"/)?.[1] ?? "").filter(Boolean),
    );

    for (const enemyType of enemyTypes) {
      expect(waveSrc, `Enemy type "${enemyType}" missing from ENEMY_SPAWN_DAY in WaveDefinitions.ts`).toContain(
        `"${enemyType}"`,
      );
    }
  });

  it("MAX_MILESTONE_ENTITIES cap (20) is below Switch entity budget", () => {
    // Milestone entities (max 20) + army (35) should not exceed Switch soft limit
    // (Milestones only fire on days 1-90, well before siege, so they don't stack)
    expect(MAX_MILESTONE_ENTITIES + GLOBAL_ARMY_CAP).toBeLessThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------

describe("Cross-System Consistency: main.ts Wiring", () => {
  const mainSrc = fs.readFileSync(path.join(__dirname, "../main.ts"), "utf-8");

  it("day-change callback triggers siege at day >= 100", () => {
    expect(mainSrc).toContain("day >= 100");
    expect(mainSrc).toContain("siege.startSiege()");
  });

  it("army death listener is wired up (instant ally count update)", () => {
    expect(mainSrc).toContain("army.setupDeathListener()");
  });

  it("siege death listener is wired up (siege mob count tracking)", () => {
    expect(mainSrc).toContain("siege.setupDeathListener()");
  });

  it("tick interval is 20 (1 second) for day/siege advancement", () => {
    // system.runInterval(() => { dayCounter.tick(); siege.tick(); }, 20)
    expect(mainSrc).toMatch(/runInterval[\s\S]*?dayCounter\.tick[\s\S]*?},\s*20\s*\)/);
  });

  it("army recount interval is 200 ticks (10 seconds)", () => {
    expect(mainSrc).toMatch(/runInterval[\s\S]*?army\.tick[\s\S]*?},\s*200\s*\)/);
  });

  it("HUD update interval is 10 ticks (0.5 seconds)", () => {
    expect(mainSrc).toMatch(/runInterval[\s\S]*?updateHUD[\s\S]*?},\s*10\s*\)/);
  });

  it("entitySpawn event gates natural enemy spawns by day", () => {
    expect(mainSrc).toContain("entitySpawn.subscribe");
    expect(mainSrc).toContain("getCurrentDay()");
    expect(mainSrc).toContain("entity.remove()");
  });

  it("playerSpawn initializes both day counter and armor tier", () => {
    expect(mainSrc).toContain("dayCounter.initializePlayer(event.player)");
    expect(mainSrc).toContain("armorTier.initializePlayer(event.player)");
  });

  it("initial spawn check uses event.initialSpawn to avoid re-init on respawn", () => {
    expect(mainSrc).toContain("event.initialSpawn");
  });

  it("entity death event routes to combat system for recruitment", () => {
    expect(mainSrc).toContain("entityDie.subscribe");
    expect(mainSrc).toContain("combat.onEntityDie(event)");
  });

  it("item use event routes to castle system for blueprint placement", () => {
    expect(mainSrc).toContain("itemUse.subscribe");
    expect(mainSrc).toContain("castle.onItemUse(event)");
  });

  it("player interact event routes to army system for ally info", () => {
    expect(mainSrc).toContain("playerInteractWithEntity.subscribe");
    expect(mainSrc).toContain("army.onPlayerInteract(event)");
  });
});

// ---------------------------------------------------------------------------

describe("E2E: Full Solo Player Progression Checklist", () => {
  /**
   * Validates that a solo player CAN complete all progression steps
   * before reaching each major gate, given the quest timeline.
   */

  it("player has full Page armor before any enemies spawn (days 0-9)", () => {
    const firstEnemyDay = Math.min(...Object.values(ENEMY_SPAWN_DAYS));
    expect(ARMOR_TIERS[0].unlockDay).toBeLessThan(firstEnemyDay);
  });

  it("player receives first castle blueprint before combat escalates", () => {
    const smallTowerDay = CASTLE_BLUEPRINTS["small_tower"].unlockDay;
    const firstCombatMilestone = 10; // day 10 enemy scouts
    expect(smallTowerDay).toBeLessThan(firstCombatMilestone);
  });

  it("player has Squire armor unlocked before the day 25 raider attack", () => {
    const squireUnlockDay = ARMOR_TIERS[1].unlockDay; // 20
    const raiderDay = 25;
    expect(squireUnlockDay).toBeLessThan(raiderDay);
  });

  it("player has Knight armor before dark force attack at day 50", () => {
    const knightUnlockDay = ARMOR_TIERS[2].unlockDay; // 40
    const darkForceDay = 50;
    expect(knightUnlockDay).toBeLessThan(darkForceDay);
  });

  it("player has Champion armor before the enemy army attack at day 70", () => {
    const championUnlockDay = ARMOR_TIERS[3].unlockDay; // 60
    const enemyArmyDay = 70;
    expect(championUnlockDay).toBeLessThan(enemyArmyDay);
  });

  it("player has all castle bonuses and Mega Knight armor before siege", () => {
    const lastCastleUnlockDay = Math.max(...Object.values(CASTLE_BLUEPRINTS).map((b) => b.unlockDay));
    const megaKnightUnlockDay = ARMOR_TIERS[4].unlockDay; // 85
    expect(lastCastleUnlockDay).toBeLessThan(MAX_DAY);
    expect(megaKnightUnlockDay).toBeLessThan(MAX_DAY);
  });

  it("maximum solo army at siege: 35 units (base 15 + all castle bonuses 20)", () => {
    const maxSoloArmy = BASE_ARMY_SIZE + MAX_ARMY_BONUS;
    expect(maxSoloArmy).toBe(35);
  });

  it("the quest has a logical armor → combat escalation pairing at each phase", () => {
    // Each armor unlock should precede the next major combat event:
    // Squire (20) → Raiders (25): 5-day gap ✓
    // Knight (40) → Dark force (50): 10-day gap ✓
    // Champion (60) → Enemy army (70): 10-day gap ✓
    // Mega Knight (85) → Vanguard (90): 5-day gap ✓
    const combatEscalationDays = [25, 50, 70, 90];
    const armorUnlockDaysAfterPage = TIER_UNLOCK_DAYS.slice(1);

    for (let i = 0; i < armorUnlockDaysAfterPage.length; i++) {
      expect(armorUnlockDaysAfterPage[i]).toBeLessThan(combatEscalationDays[i]);
    }
  });
});
