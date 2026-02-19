import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ENTITIES_DIR = path.join(__dirname, "../../MegaKnights_BP/entities");
const ALLY_FILES = [
  "mk_ally_knight.se.json",
  "mk_ally_archer.se.json",
  "mk_ally_wizard.se.json",
  "mk_ally_dark_knight.se.json",
  "mk_ally_standard_bearer.se.json",
];

function readEntity(filename: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(ENTITIES_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

describe("Unit Stance System: entity component groups", () => {
  for (const file of ALLY_FILES) {
    it(`${file} has mk:mode_guard component group`, () => {
      const entity = readEntity(file);
      const groups = (entity["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
      expect(groups).toHaveProperty("mk:mode_guard");
    });

    it(`${file} has mk:mode_hold component group`, () => {
      const entity = readEntity(file);
      const groups = (entity["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
      expect(groups).toHaveProperty("mk:mode_hold");
    });

    it(`${file} mk:mode_guard disables follow_owner via extreme start_distance`, () => {
      const entity = readEntity(file);
      const groups = (entity["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
      const guard = groups["mk:mode_guard"] as Record<string, unknown>;
      const follow = guard["minecraft:behavior.follow_owner"] as Record<string, unknown>;
      expect(follow).toBeDefined();
      expect((follow["start_distance"] as number)).toBeGreaterThan(100);
    });

    it(`${file} mk:mode_hold disables both follow_owner and random_stroll`, () => {
      const entity = readEntity(file);
      const groups = (entity["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
      const hold = groups["mk:mode_hold"] as Record<string, unknown>;
      expect(hold["minecraft:behavior.follow_owner"]).toBeDefined();
      expect(hold["minecraft:behavior.random_stroll"]).toBeDefined();
      const stroll = hold["minecraft:behavior.random_stroll"] as Record<string, unknown>;
      expect((stroll["speed_multiplier"] as number)).toBe(0.0);
    });

    it(`${file} has mk:set_mode_follow event`, () => {
      const entity = readEntity(file);
      const events = (entity["minecraft:entity"] as Record<string, unknown>)["events"] as Record<string, unknown>;
      expect(events).toHaveProperty("mk:set_mode_follow");
    });

    it(`${file} has mk:set_mode_guard event`, () => {
      const entity = readEntity(file);
      const events = (entity["minecraft:entity"] as Record<string, unknown>)["events"] as Record<string, unknown>;
      expect(events).toHaveProperty("mk:set_mode_guard");
    });

    it(`${file} has mk:set_mode_hold event`, () => {
      const entity = readEntity(file);
      const events = (entity["minecraft:entity"] as Record<string, unknown>)["events"] as Record<string, unknown>;
      expect(events).toHaveProperty("mk:set_mode_hold");
    });
  }
});

describe("Unit Stance System: ArmySystem wiring", () => {
  const armySrc = fs.readFileSync(path.join(__dirname, "../systems/ArmySystem.ts"), "utf-8");

  it("ArmySystem imports ALLY_MODE_SET", () => {
    expect(armySrc).toContain("ALLY_MODE_SET");
  });

  it("ArmySystem cycles stance on sneak+interact", () => {
    expect(armySrc).toContain("isSneaking");
    expect(armySrc).toContain("mk:stance");
  });

  it("ArmySystem triggers mk:set_mode_follow event", () => {
    expect(armySrc).toContain("mk:set_mode_follow");
  });

  it("ArmySystem triggers mk:set_mode_guard event", () => {
    expect(armySrc).toContain("mk:set_mode_guard");
  });

  it("ArmySystem triggers mk:set_mode_hold event", () => {
    expect(armySrc).toContain("mk:set_mode_hold");
  });

  it("ArmySystem applies Standard Bearer aura in tick()", () => {
    expect(armySrc).toContain("mk_ally_standard_bearer");
    expect(armySrc).toContain("addEffect");
    expect(armySrc).toContain("strength");
  });

  it("Aura is within 8 blocks (distance² check ≤ 64)", () => {
    expect(armySrc).toContain("<= 64");
  });
});
