/**
 * boss-phase-consistency.test.ts
 *
 * Validates that the Siege Lord boss entity JSON maintains consistent and
 * correctly escalating values across its three combat phases. All tests
 * read the JSON file directly — no @minecraft/server imports.
 *
 * Key values as of task #100 fix:
 *   Base:    follow_range=32, max_dist=32, damage=12, speed=0.28
 *   Phase 2: follow_range=32, max_dist=28, damage=16, speed=0.35
 *   Phase 3: follow_range=32, max_dist=32, damage=20, speed=0.42
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── Load and parse boss entity JSON ─────────────────────────────────────────

const BOSS_FILE = path.resolve(
  __dirname,
  "../../MegaKnights_BP/entities/mk_boss_siege_lord.se.json"
);

const raw: any = JSON.parse(fs.readFileSync(BOSS_FILE, "utf-8"));
const entity = raw["minecraft:entity"];
const components = entity.components;
const componentGroups = entity.component_groups;
const phase2 = componentGroups["mk:phase_2"];
const phase3 = componentGroups["mk:phase_3"];

// ─── Identity ─────────────────────────────────────────────────────────────────

describe("Boss: entity identity", () => {
  it("identifier is mk:mk_boss_siege_lord", () => {
    expect(entity.description.identifier).toBe("mk:mk_boss_siege_lord");
  });

  it("format_version is a valid semver string", () => {
    expect(raw.format_version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ─── Base component values ────────────────────────────────────────────────────

describe("Boss: base component values", () => {
  it("base follow_range is 32", () => {
    expect(components["minecraft:follow_range"].value).toBe(32);
  });

  it("base nearest_attackable_target max_dist is 32", () => {
    const nat = components["minecraft:behavior.nearest_attackable_target"];
    expect(nat.entity_types[0].max_dist).toBe(32);
  });

  it("base follow_range matches base nearest_attackable_target max_dist", () => {
    const followRange = components["minecraft:follow_range"].value;
    const maxDist =
      components["minecraft:behavior.nearest_attackable_target"]
        .entity_types[0].max_dist;
    expect(followRange).toBe(maxDist);
  });

  it("base attack damage is 12", () => {
    expect(components["minecraft:attack"].damage).toBe(12);
  });

  it("base movement value is 0.28", () => {
    expect(components["minecraft:movement"].value).toBe(0.28);
  });
});

// ─── Phase 2 component group ──────────────────────────────────────────────────

describe("Boss: mk:phase_2 component group", () => {
  it("mk:phase_2 component group exists", () => {
    expect(phase2).toBeDefined();
  });

  it("phase_2 follow_range is 32", () => {
    expect(phase2["minecraft:follow_range"].value).toBe(32);
  });

  it("phase_2 nearest_attackable_target max_dist is 28", () => {
    const nat = phase2["minecraft:behavior.nearest_attackable_target"];
    expect(nat.entity_types[0].max_dist).toBe(28);
  });

  it("phase_2 attack damage is 16", () => {
    expect(phase2["minecraft:attack"].damage).toBe(16);
  });

  it("phase_2 movement value is 0.35", () => {
    expect(phase2["minecraft:movement"].value).toBe(0.35);
  });

  it("phase_2 nearest_attackable_target has scan_interval >= 10", () => {
    const nat = phase2["minecraft:behavior.nearest_attackable_target"];
    expect(nat.scan_interval).toBeGreaterThanOrEqual(10);
  });

  it("phase_2 nearest_attackable_target has must_see: true", () => {
    const nat = phase2["minecraft:behavior.nearest_attackable_target"];
    expect(nat.must_see).toBe(true);
  });
});

// ─── Phase 3 component group ──────────────────────────────────────────────────

describe("Boss: mk:phase_3 component group", () => {
  it("mk:phase_3 component group exists", () => {
    expect(phase3).toBeDefined();
  });

  it("phase_3 follow_range is 32", () => {
    expect(phase3["minecraft:follow_range"].value).toBe(32);
  });

  it("phase_3 nearest_attackable_target max_dist is 32", () => {
    const nat = phase3["minecraft:behavior.nearest_attackable_target"];
    expect(nat.entity_types[0].max_dist).toBe(32);
  });

  it("phase_3 follow_range matches phase_3 nearest_attackable_target max_dist", () => {
    const followRange = phase3["minecraft:follow_range"].value;
    const maxDist =
      phase3["minecraft:behavior.nearest_attackable_target"].entity_types[0]
        .max_dist;
    expect(followRange).toBe(maxDist);
  });

  it("phase_3 attack damage is 20", () => {
    expect(phase3["minecraft:attack"].damage).toBe(20);
  });

  it("phase_3 movement value is 0.42", () => {
    expect(phase3["minecraft:movement"].value).toBe(0.42);
  });

  it("phase_3 nearest_attackable_target has scan_interval >= 10", () => {
    const nat = phase3["minecraft:behavior.nearest_attackable_target"];
    expect(nat.scan_interval).toBeGreaterThanOrEqual(10);
  });

  it("phase_3 nearest_attackable_target has must_see: true", () => {
    const nat = phase3["minecraft:behavior.nearest_attackable_target"];
    expect(nat.must_see).toBe(true);
  });
});

// ─── Monotonic escalation across phases ──────────────────────────────────────

describe("Boss: damage escalates monotonically across phases", () => {
  const baseDamage = components["minecraft:attack"].damage as number;
  const phase2Damage = phase2["minecraft:attack"].damage as number;
  const phase3Damage = phase3["minecraft:attack"].damage as number;

  it("phase_2 damage > base damage", () => {
    expect(phase2Damage).toBeGreaterThan(baseDamage);
  });

  it("phase_3 damage > phase_2 damage", () => {
    expect(phase3Damage).toBeGreaterThan(phase2Damage);
  });

  it("phase_3 damage > base damage", () => {
    expect(phase3Damage).toBeGreaterThan(baseDamage);
  });
});

describe("Boss: movement speed escalates monotonically across phases", () => {
  const baseSpeed = components["minecraft:movement"].value as number;
  const phase2Speed = phase2["minecraft:movement"].value as number;
  const phase3Speed = phase3["minecraft:movement"].value as number;

  it("phase_2 speed > base speed", () => {
    expect(phase2Speed).toBeGreaterThan(baseSpeed);
  });

  it("phase_3 speed > phase_2 speed", () => {
    expect(phase3Speed).toBeGreaterThan(phase2Speed);
  });

  it("phase_3 speed > base speed", () => {
    expect(phase3Speed).toBeGreaterThan(baseSpeed);
  });
});

// ─── Base targeting behavior: scan_interval and must_see ─────────────────────

describe("Boss: base nearest_attackable_target safety constraints", () => {
  it("base targeting has scan_interval >= 10", () => {
    const nat = components["minecraft:behavior.nearest_attackable_target"];
    expect(nat.scan_interval).toBeGreaterThanOrEqual(10);
  });

  it("base targeting has must_see: true", () => {
    const nat = components["minecraft:behavior.nearest_attackable_target"];
    expect(nat.must_see).toBe(true);
  });
});

// ─── Persistence: boss must not despawn ──────────────────────────────────────

describe("Boss: persistence and despawn", () => {
  it("has minecraft:persistent component", () => {
    expect(components["minecraft:persistent"]).toBeDefined();
  });

  it("base components do NOT include minecraft:despawn", () => {
    expect(components["minecraft:despawn"]).toBeUndefined();
  });

  it("mk:despawn component group uses instant_despawn (not natural despawn)", () => {
    const despawnGroup = componentGroups["mk:despawn"];
    expect(despawnGroup).toBeDefined();
    expect(despawnGroup["minecraft:instant_despawn"]).toBeDefined();
  });
});

// ─── Follow range within Switch performance budget ───────────────────────────

describe("Boss: follow_range within Switch performance budget", () => {
  it("base follow_range <= 32 (boss budget)", () => {
    expect(components["minecraft:follow_range"].value).toBeLessThanOrEqual(32);
  });

  it("phase_2 follow_range <= 32 (boss budget)", () => {
    expect(phase2["minecraft:follow_range"].value).toBeLessThanOrEqual(32);
  });

  it("phase_3 follow_range <= 32 (boss budget)", () => {
    expect(phase3["minecraft:follow_range"].value).toBeLessThanOrEqual(32);
  });
});

// ─── Phase transition events ──────────────────────────────────────────────────

describe("Boss: phase transition events are correctly wired", () => {
  const events = entity.events;

  it("mk:enter_phase_2 event exists", () => {
    expect(events["mk:enter_phase_2"]).toBeDefined();
  });

  it("mk:enter_phase_2 adds mk:phase_2", () => {
    const add = events["mk:enter_phase_2"].add?.component_groups ?? [];
    expect(add).toContain("mk:phase_2");
  });

  it("mk:enter_phase_2 removes mk:phase_3 to prevent stacking", () => {
    const remove = events["mk:enter_phase_2"].remove?.component_groups ?? [];
    expect(remove).toContain("mk:phase_3");
  });

  it("mk:enter_phase_3 event exists", () => {
    expect(events["mk:enter_phase_3"]).toBeDefined();
  });

  it("mk:enter_phase_3 adds mk:phase_3", () => {
    const add = events["mk:enter_phase_3"].add?.component_groups ?? [];
    expect(add).toContain("mk:phase_3");
  });

  it("mk:enter_phase_3 removes mk:phase_2 to prevent stacking", () => {
    const remove = events["mk:enter_phase_3"].remove?.component_groups ?? [];
    expect(remove).toContain("mk:phase_2");
  });
});

// ─── Boss-specific flavor components ─────────────────────────────────────────

describe("Boss: required boss-specific components", () => {
  it("has minecraft:boss component with should_darken_sky: false", () => {
    const boss = components["minecraft:boss"];
    expect(boss).toBeDefined();
    // should_darken_sky: false preserves GPU budget during siege peak load
    expect(boss.should_darken_sky).toBe(false);
  });

  it("boss hud_range is defined and reasonable (20–50 blocks)", () => {
    const hudRange = components["minecraft:boss"].hud_range;
    expect(hudRange).toBeGreaterThanOrEqual(20);
    expect(hudRange).toBeLessThanOrEqual(50);
  });

  it("has minecraft:knockback_resistance >= 0.5 (boss should resist knockback)", () => {
    const resistance = components["minecraft:knockback_resistance"]?.value;
    expect(resistance).toBeGreaterThanOrEqual(0.5);
  });

  it("has minecraft:fire_immune: true", () => {
    expect(components["minecraft:fire_immune"]).toBe(true);
  });

  it("has mk_boss in type family", () => {
    const family: string[] = components["minecraft:type_family"].family;
    expect(family).toContain("mk_boss");
  });
});
