import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { generateAllyName, ALL_TITLES } from "../data/AllyNames";

const BP_ENTITIES = path.join(__dirname, "../../MegaKnights_BP/entities");
const RP_ENTITY = path.join(__dirname, "../../MegaKnights_RP/entity");
const TEXTURES = path.join(__dirname, "../../MegaKnights_RP/textures/entity");

describe("Standard Bearer: entity files", () => {
  it("behavior pack entity file exists", () => {
    expect(fs.existsSync(path.join(BP_ENTITIES, "mk_ally_standard_bearer.se.json"))).toBe(true);
  });

  it("resource pack client entity file exists", () => {
    expect(fs.existsSync(path.join(RP_ENTITY, "mk_ally_standard_bearer.ce.json"))).toBe(true);
  });

  it("texture file exists", () => {
    expect(fs.existsSync(path.join(TEXTURES, "mk_ally_standard_bearer.png"))).toBe(true);
  });

  it("standard bearer is in mk_ally family", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_ally_standard_bearer.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    const family = ((components["minecraft:type_family"] as Record<string, unknown>)["family"] as string[]);
    expect(family).toContain("mk_ally");
  });

  it("standard bearer is in mk_standard_bearer family", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_ally_standard_bearer.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    const family = ((components["minecraft:type_family"] as Record<string, unknown>)["family"] as string[]);
    expect(family).toContain("mk_standard_bearer");
  });

  it("standard bearer has follow_owner behavior (part of army)", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_ally_standard_bearer.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    expect(components).toHaveProperty("minecraft:behavior.follow_owner");
  });

  it("standard bearer has stance component groups", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_ally_standard_bearer.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const groups = (entity["minecraft:entity"] as Record<string, unknown>)["component_groups"] as Record<string, unknown>;
    expect(groups).toHaveProperty("mk:mode_guard");
    expect(groups).toHaveProperty("mk:mode_hold");
  });

  it("standard bearer has despawn distance (not persistent)", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_ally_standard_bearer.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    expect(components).toHaveProperty("minecraft:despawn");
  });

  it("standard bearer uses opaque entity material (Switch GPU friendly)", () => {
    const raw = fs.readFileSync(path.join(RP_ENTITY, "mk_ally_standard_bearer.ce.json"), "utf-8");
    const entity = JSON.parse(raw);
    const desc = (entity["minecraft:client_entity"] as Record<string, unknown>)["description"] as Record<string, unknown>;
    const materials = desc["materials"] as Record<string, unknown>;
    expect(materials["default"]).toBe("entity");
  });
});

describe("Standard Bearer: naming consistency", () => {
  const merchantSrc = fs.readFileSync(path.join(__dirname, "../systems/MerchantSystem.ts"), "utf-8");

  it("MerchantSystem uses generateAllyName for Standard Bearer naming", () => {
    expect(merchantSrc).toContain("generateAllyName");
    expect(merchantSrc).toContain('generateAllyName("mk:mk_ally_standard_bearer")');
  });

  it("MerchantSystem does NOT use player name in Standard Bearer nameTag", () => {
    // Old pattern was: `${safeName}'s Standard Bearer`
    expect(merchantSrc).not.toContain("'s Standard Bearer");
  });

  it("AllyNames has title pool for standard bearer type", () => {
    const titles = ALL_TITLES["mk:mk_ally_standard_bearer"];
    expect(titles).toBeDefined();
    expect(titles.length).toBeGreaterThan(0);
  });

  it("generateAllyName produces 'Title Name' format for standard bearer", () => {
    const name = generateAllyName("mk:mk_ally_standard_bearer");
    expect(name).toMatch(/^\w+ \w+$/);
  });

  it("standard bearer name format matches other ally types", () => {
    // All ally types produce "Title Name" format
    const types = [
      "mk:mk_ally_knight",
      "mk:mk_ally_archer",
      "mk:mk_ally_wizard",
      "mk:mk_ally_standard_bearer",
    ];
    for (const typeId of types) {
      const name = generateAllyName(typeId);
      expect(name, `${typeId} should produce Title Name`).toMatch(/^\w+ \w+$/);
    }
  });
});

describe("Standard Bearer: aura system", () => {
  const armySrc = fs.readFileSync(path.join(__dirname, "../systems/ArmySystem.ts"), "utf-8");

  it("ArmySystem applies Strength aura for standard bearers", () => {
    expect(armySrc).toContain("mk_ally_standard_bearer");
    expect(armySrc).toContain("strength");
    expect(armySrc).toContain("addEffect");
  });

  it("Aura reuses existing allies array (no extra getEntities call for aura)", () => {
    // The aura loop iterates the same 'allies' array from the army recount.
    // tick() has exactly one getEntities() call (the army recount); the aura adds none.
    const tickMethod = armySrc.slice(armySrc.indexOf("tick(): void"), armySrc.indexOf("getArmyEntities"));
    expect(tickMethod).toContain("bearer.typeId");
    const count = (tickMethod.match(/[.]getEntities[(]/g) ?? []).length;
    expect(count).toBe(1); // Only the army recount call — aura reuses that result
  });

  it("Aura effect duration provides overlap (300 ticks > 200 tick reapply interval)", () => {
    expect(armySrc).toContain("300");
  });
});
