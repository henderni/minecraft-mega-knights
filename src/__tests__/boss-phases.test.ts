import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BOSS_JSON = path.join(__dirname, "../../MegaKnights_BP/entities/mk_boss_siege_lord.se.json");

function readBoss(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(BOSS_JSON, "utf-8"));
}

describe("Siege Lord: phase component groups", () => {
  it("has mk:phase_2 component group", () => {
    const boss = readBoss();
    const groups = (boss["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
    expect(groups).toHaveProperty("mk:phase_2");
  });

  it("has mk:phase_3 component group", () => {
    const boss = readBoss();
    const groups = (boss["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
    expect(groups).toHaveProperty("mk:phase_3");
  });

  it("phase_2 increases attack damage above base (12)", () => {
    const boss = readBoss();
    const groups = (boss["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
    const phase2 = groups["mk:phase_2"] as Record<string, unknown>;
    const attack = phase2["minecraft:attack"] as Record<string, unknown>;
    expect((attack["damage"] as number)).toBeGreaterThan(12);
  });

  it("phase_3 increases attack damage more than phase_2", () => {
    const boss = readBoss();
    const groups = (boss["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
    const phase2 = groups["mk:phase_2"] as Record<string, unknown>;
    const phase3 = groups["mk:phase_3"] as Record<string, unknown>;
    const dmg2 = (phase2["minecraft:attack"] as Record<string, unknown>)["damage"] as number;
    const dmg3 = (phase3["minecraft:attack"] as Record<string, unknown>)["damage"] as number;
    expect(dmg3).toBeGreaterThan(dmg2);
  });

  it("phase_3 movement speed is faster than phase_2", () => {
    const boss = readBoss();
    const groups = (boss["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
    const spd2 = ((groups["mk:phase_2"] as Record<string, unknown>)["minecraft:movement"] as Record<string, unknown>)["value"] as number;
    const spd3 = ((groups["mk:phase_3"] as Record<string, unknown>)["minecraft:movement"] as Record<string, unknown>)["value"] as number;
    expect(spd3).toBeGreaterThan(spd2);
  });

  it("has mk:enter_phase_2 event", () => {
    const boss = readBoss();
    const events = (boss["minecraft:entity"] as Record<string, unknown>)["events"] as Record<string, unknown>;
    expect(events).toHaveProperty("mk:enter_phase_2");
  });

  it("has mk:enter_phase_3 event", () => {
    const boss = readBoss();
    const events = (boss["minecraft:entity"] as Record<string, unknown>)["events"] as Record<string, unknown>;
    expect(events).toHaveProperty("mk:enter_phase_3");
  });

  it("mk:enter_phase_2 removes mk:phase_3 and adds mk:phase_2", () => {
    const boss = readBoss();
    const events = (boss["minecraft:entity"] as Record<string, unknown>)["events"] as Record<string, unknown>;
    const e = events["mk:enter_phase_2"] as Record<string, unknown>;
    const remove = (e["remove"] as Record<string, unknown>)["component_groups"] as string[];
    const add = (e["add"] as Record<string, unknown>)["component_groups"] as string[];
    expect(remove).toContain("mk:phase_3");
    expect(add).toContain("mk:phase_2");
  });

  it("mk:enter_phase_3 removes mk:phase_2 and adds mk:phase_3", () => {
    const boss = readBoss();
    const events = (boss["minecraft:entity"] as Record<string, unknown>)["events"] as Record<string, unknown>;
    const e = events["mk:enter_phase_3"] as Record<string, unknown>;
    const remove = (e["remove"] as Record<string, unknown>)["component_groups"] as string[];
    const add = (e["add"] as Record<string, unknown>)["component_groups"] as string[];
    expect(remove).toContain("mk:phase_2");
    expect(add).toContain("mk:phase_3");
  });
});

describe("Siege Lord: SiegeSystem phase transition wiring", () => {
  const siegeSrc = fs.readFileSync(path.join(__dirname, "../systems/SiegeSystem.ts"), "utf-8");

  it("SiegeSystem tracks bossEntity", () => {
    expect(siegeSrc).toContain("bossEntity");
  });

  it("SiegeSystem tracks siegePhase", () => {
    expect(siegeSrc).toContain("siegePhase");
  });

  it("SiegeSystem captures boss entity on spawn", () => {
    expect(siegeSrc).toContain("mk_boss_siege_lord");
    expect(siegeSrc).toContain("siegeRef.bossEntity = entity");
  });

  it("SiegeSystem triggers mk:enter_phase_2 at 66% HP", () => {
    expect(siegeSrc).toContain("mk:enter_phase_2");
    expect(siegeSrc).toContain("0.66");
  });

  it("SiegeSystem triggers mk:enter_phase_3 at 33% HP", () => {
    expect(siegeSrc).toContain("mk:enter_phase_3");
    expect(siegeSrc).toContain("0.33");
  });

  it("phase transitions are one-way (siegePhase < check prevents repeat triggers)", () => {
    expect(siegeSrc).toContain("this.siegePhase < 2");
    expect(siegeSrc).toContain("this.siegePhase < 1");
  });
});
