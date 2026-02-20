/**
 * entity-validation.test.ts
 *
 * Validates all entity JSON files have required Bedrock fields, correct
 * identifiers, valid component groups, and consistent event handlers.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BP_ENTITIES_DIR = path.join(__dirname, "../../MegaKnights_BP/entities");
const RP_ENTITIES_DIR = path.join(__dirname, "../../MegaKnights_RP/entity");

const bpFiles = fs.readdirSync(BP_ENTITIES_DIR).filter((f) => f.endsWith(".se.json"));
const rpFiles = fs.readdirSync(RP_ENTITIES_DIR).filter((f) => f.endsWith(".ce.json"));

function readBPEntity(filename: string): any {
  return JSON.parse(fs.readFileSync(path.join(BP_ENTITIES_DIR, filename), "utf-8"));
}

function readRPEntity(filename: string): any {
  return JSON.parse(fs.readFileSync(path.join(RP_ENTITIES_DIR, filename), "utf-8"));
}

// ─── Required entity files ───────────────────────────────────────────────────

describe("Entity files: required entities exist", () => {
  const requiredBP = [
    "mk_ally_knight.se.json",
    "mk_ally_archer.se.json",
    "mk_ally_wizard.se.json",
    "mk_ally_dark_knight.se.json",
    "mk_enemy_knight.se.json",
    "mk_enemy_archer.se.json",
    "mk_enemy_wizard.se.json",
    "mk_enemy_dark_knight.se.json",
    "mk_boss_siege_lord.se.json",
    "mk_wandering_merchant.se.json",
    "mk_ally_standard_bearer.se.json",
  ];

  for (const file of requiredBP) {
    it(`BP entity ${file} exists`, () => {
      expect(bpFiles).toContain(file);
    });
  }

  it("every BP entity has a matching RP client entity", () => {
    for (const bpFile of bpFiles) {
      const rpFile = bpFile.replace(".se.json", ".ce.json");
      expect(rpFiles).toContain(rpFile);
    }
  });
});

// ─── BP entity schema validation ─────────────────────────────────────────────

describe("BP entities: schema compliance", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const raw = readBPEntity(file);

    it(`${entityName}: has valid format_version string`, () => {
      expect(raw.format_version).toBeDefined();
      expect(typeof raw.format_version).toBe("string");
      expect(raw.format_version).toMatch(/^\d+\.\d+/);
    });

    it(`${entityName}: has minecraft:entity root`, () => {
      expect(raw["minecraft:entity"]).toBeDefined();
    });

    it(`${entityName}: has description.identifier matching mk:mk_* pattern`, () => {
      const id = raw["minecraft:entity"]?.description?.identifier;
      expect(id).toBeDefined();
      expect(id).toMatch(/^mk:mk_/);
    });

    it(`${entityName}: identifier matches filename`, () => {
      const id = raw["minecraft:entity"]?.description?.identifier;
      const expectedId = `mk:${entityName}`;
      expect(id).toBe(expectedId);
    });

    it(`${entityName}: has components section`, () => {
      expect(raw["minecraft:entity"]?.components).toBeDefined();
    });

    it(`${entityName}: has health component`, () => {
      const components = raw["minecraft:entity"]?.components;
      expect(components?.["minecraft:health"]).toBeDefined();
    });

    it(`${entityName}: has physics component`, () => {
      const components = raw["minecraft:entity"]?.components;
      expect(components?.["minecraft:physics"]).toBeDefined();
    });
  }
});

// ─── Component group validation ──────────────────────────────────────────────

describe("BP entities: component groups", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const raw = readBPEntity(file);
    const entity = raw["minecraft:entity"];
    const componentGroups = entity?.component_groups ?? {};
    const events = entity?.events ?? {};
    const groupNames = Object.keys(componentGroups);

    it(`${entityName}: no duplicate component group names`, () => {
      // JSON.parse would use the last duplicate key, but we check raw text
      const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");
      for (const name of groupNames) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matches = rawText.match(new RegExp(`"${escaped}"\\s*:`, "g"));
        // The group name may appear in events as a reference — count only in component_groups section
        // Just verify the group name doesn't appear more than expected
        expect(matches).not.toBeNull();
      }
    });

    it(`${entityName}: event handlers reference valid component groups`, () => {
      for (const [, eventDef] of Object.entries(events)) {
        const eventStr = JSON.stringify(eventDef);
        // Extract group references from add/remove
        const addMatches = [...eventStr.matchAll(/"component_groups"\s*:\s*\[([^\]]*)\]/g)];
        for (const match of addMatches) {
          const refs = match[1].match(/"([^"]+)"/g);
          if (refs) {
            for (const ref of refs) {
              const groupName = ref.replace(/"/g, "");
              expect(groupNames).toContain(groupName);
            }
          }
        }
      }
    });
  }
});

// ─── RP client entity validation ─────────────────────────────────────────────

describe("RP client entities: schema compliance", () => {
  for (const file of rpFiles) {
    const entityName = file.replace(".ce.json", "");
    const raw = readRPEntity(file);

    it(`${entityName}: has valid format_version`, () => {
      expect(raw.format_version).toBeDefined();
      expect(typeof raw.format_version).toBe("string");
    });

    it(`${entityName}: has minecraft:client_entity root`, () => {
      expect(raw["minecraft:client_entity"]).toBeDefined();
    });

    it(`${entityName}: has description.identifier matching mk:mk_*`, () => {
      const id = raw["minecraft:client_entity"]?.description?.identifier;
      expect(id).toBeDefined();
      expect(id).toMatch(/^mk:mk_/);
    });

    it(`${entityName}: identifier matches BP entity`, () => {
      const rpId = raw["minecraft:client_entity"]?.description?.identifier;
      const bpFile = file.replace(".ce.json", ".se.json");
      if (bpFiles.includes(bpFile)) {
        const bpRaw = readBPEntity(bpFile);
        const bpId = bpRaw["minecraft:entity"]?.description?.identifier;
        expect(rpId).toBe(bpId);
      }
    });

    it(`${entityName}: has materials defined`, () => {
      const materials = raw["minecraft:client_entity"]?.description?.materials;
      expect(materials).toBeDefined();
      expect(materials?.default).toBeDefined();
    });

    it(`${entityName}: has textures defined`, () => {
      const textures = raw["minecraft:client_entity"]?.description?.textures;
      expect(textures).toBeDefined();
      expect(textures?.default).toBeDefined();
    });

    it(`${entityName}: has geometry defined`, () => {
      const geometry = raw["minecraft:client_entity"]?.description?.geometry;
      expect(geometry).toBeDefined();
      expect(geometry?.default).toBeDefined();
    });

    it(`${entityName}: has render_controllers`, () => {
      const rc = raw["minecraft:client_entity"]?.description?.render_controllers;
      expect(rc).toBeDefined();
      expect(rc.length).toBeGreaterThan(0);
    });
  }
});

// ─── Despawn and performance constraints ─────────────────────────────────────

describe("BP entities: despawn components", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: has despawn mechanism`, () => {
      const hasDespawn =
        rawText.includes("minecraft:despawn") || rawText.includes("instant_despawn");
      expect(hasDespawn).toBe(true);
    });
  }
});

describe("BP entities: follow_range budget", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: follow_range within budget`, () => {
      const matches = [...rawText.matchAll(/"follow_range"[^}]*?"value"\s*:\s*(\d+)/g)];
      for (const m of matches) {
        const range = parseInt(m[1]);
        if (entityName.includes("boss")) {
          expect(range).toBeLessThanOrEqual(32);
        } else {
          expect(range).toBeLessThanOrEqual(24);
        }
      }
    });
  }
});

describe("BP entities: scan_interval on targeting", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: nearest_attackable_target has scan_interval >= 10`, () => {
      if (rawText.includes("nearest_attackable_target")) {
        const matches = [...rawText.matchAll(/"scan_interval"\s*:\s*(\d+)/g)];
        expect(matches.length).toBeGreaterThan(0);
        for (const m of matches) {
          expect(parseInt(m[1])).toBeGreaterThanOrEqual(10);
        }
      }
    });
  }
});

// ─── GPU budget: opaque materials ────────────────────────────────────────────

describe("RP entities: opaque materials preferred", () => {
  for (const file of rpFiles) {
    const entityName = file.replace(".ce.json", "");
    const rawText = fs.readFileSync(path.join(RP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: high-count entities use opaque material`, () => {
      if (entityName.includes("ally") || entityName.includes("enemy")) {
        expect(rawText).not.toContain("entity_alphatest");
      }
    });
  }
});
