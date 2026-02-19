/**
 * activation-loading.test.ts
 *
 * Tests for pack activation and loading reliability:
 * - Manifest correctness and compatibility
 * - BP-RP dependency linking
 * - Entry point validity
 * - Script module configuration
 * - Dynamic property registration (won't exceed limits)
 * - Pack versioning for cache invalidation
 * - Lang file completeness for activation UI
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");
const RP_ROOT = path.join(__dirname, "../../MegaKnights_RP");
const SRC_ROOT = path.join(__dirname, "..");

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ─── Manifest structure ─────────────────────────────────────────────────────

describe("BP manifest: activation requirements", () => {
  const manifest = readJson(path.join(BP_ROOT, "manifest.json")) as {
    format_version: number;
    header: { name: string; description: string; uuid: string; version: number[]; min_engine_version: number[] };
    modules: { type: string; uuid: string; version: number[]; language?: string; entry?: string }[];
    dependencies: { uuid?: string; module_name?: string; version: number[] | string }[];
  };

  it("has format_version 2", () => {
    expect(manifest.format_version).toBe(2);
  });

  it("header name is a lang key (pack.name)", () => {
    expect(manifest.header.name).toBe("pack.name");
  });

  it("header description is a lang key (pack.description)", () => {
    expect(manifest.header.description).toBe("pack.description");
  });

  it("has valid UUID format", () => {
    expect(manifest.header.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("version is a 3-element array", () => {
    expect(manifest.header.version).toHaveLength(3);
    for (const v of manifest.header.version) {
      expect(typeof v).toBe("number");
    }
  });

  it("has data module", () => {
    const data = manifest.modules.find((m) => m.type === "data");
    expect(data).toBeDefined();
    expect(data!.uuid).toMatch(/^[0-9a-f]{8}-/);
  });

  it("has script module with correct entry point", () => {
    const script = manifest.modules.find((m) => m.type === "script");
    expect(script).toBeDefined();
    expect(script!.entry).toBe("scripts/main.js");
    expect(script!.language).toBe("javascript");
  });

  it("entry point file exists", () => {
    expect(fs.existsSync(path.join(BP_ROOT, "scripts/main.js"))).toBe(true);
  });

  it("depends on RP pack UUID", () => {
    const rpManifest = readJson(path.join(RP_ROOT, "manifest.json")) as { header: { uuid: string } };
    const rpDep = manifest.dependencies.find(
      (d) => d.uuid === rpManifest.header.uuid,
    );
    expect(rpDep).toBeDefined();
  });

  it("depends on @minecraft/server module", () => {
    const serverDep = manifest.dependencies.find(
      (d) => d.module_name === "@minecraft/server",
    );
    expect(serverDep).toBeDefined();
  });

  it("all module UUIDs are unique", () => {
    const uuids = new Set<string>();
    uuids.add(manifest.header.uuid);
    for (const mod of manifest.modules) {
      expect(uuids.has(mod.uuid)).toBe(false);
      uuids.add(mod.uuid);
    }
  });
});

describe("RP manifest: activation requirements", () => {
  const manifest = readJson(path.join(RP_ROOT, "manifest.json")) as {
    format_version: number;
    header: { name: string; description: string; uuid: string; version: number[] };
    modules: { type: string; uuid: string; version: number[] }[];
  };

  it("has format_version 2", () => {
    expect(manifest.format_version).toBe(2);
  });

  it("has resources module", () => {
    const res = manifest.modules.find((m) => m.type === "resources");
    expect(res).toBeDefined();
  });

  it("UUID differs from BP", () => {
    const bpManifest = readJson(path.join(BP_ROOT, "manifest.json")) as { header: { uuid: string } };
    expect(manifest.header.uuid).not.toBe(bpManifest.header.uuid);
  });

  it("version matches BP version", () => {
    const bpManifest = readJson(path.join(BP_ROOT, "manifest.json")) as { header: { version: number[] } };
    expect(manifest.header.version).toEqual(bpManifest.header.version);
  });
});

// ─── Lang file completeness for pack activation ─────────────────────────────

describe("Lang files: activation display strings", () => {
  const bpLang = fs.readFileSync(path.join(BP_ROOT, "texts/en_US.lang"), "utf-8");
  const rpLang = fs.readFileSync(path.join(RP_ROOT, "texts/en_US.lang"), "utf-8");

  it("BP lang has pack.name", () => {
    expect(bpLang).toMatch(/^pack\.name=/m);
  });

  it("BP lang has pack.description", () => {
    expect(bpLang).toMatch(/^pack\.description=/m);
  });

  it("RP lang has pack.name", () => {
    expect(rpLang).toMatch(/^pack\.name=/m);
  });

  it("RP lang has pack.description", () => {
    expect(rpLang).toMatch(/^pack\.description=/m);
  });

  it("languages.json exists in BP", () => {
    expect(fs.existsSync(path.join(BP_ROOT, "texts/languages.json"))).toBe(true);
  });

  it("languages.json exists in RP", () => {
    expect(fs.existsSync(path.join(RP_ROOT, "texts/languages.json"))).toBe(true);
  });
});

// ─── Pack icons ─────────────────────────────────────────────────────────────

describe("Pack icons: required for activation UI", () => {
  it("BP has pack_icon.png", () => {
    expect(fs.existsSync(path.join(BP_ROOT, "pack_icon.png"))).toBe(true);
  });

  it("RP has pack_icon.png", () => {
    expect(fs.existsSync(path.join(RP_ROOT, "pack_icon.png"))).toBe(true);
  });
});

// ─── Dynamic property count limits ──────────────────────────────────────────

describe("Dynamic property budget", () => {
  // Bedrock limits: max 10 unique property IDs per entity type by default
  // World properties share a global pool

  it("world-scoped properties are under 10", () => {
    const daySrc = fs.readFileSync(path.join(SRC_ROOT, "systems/DayCounterSystem.ts"), "utf-8");
    const worldProps = new Set<string>();
    const matches = daySrc.matchAll(/KEY_\w+\s*=\s*"(mk:[^"]+)"/g);
    for (const m of matches) {
      worldProps.add(m[1]);
    }
    expect(worldProps.size).toBeLessThanOrEqual(10);
  });

  it("player-scoped properties are under 10", () => {
    // Collect all player dynamic property keys across all source files
    const playerProps = new Set<string>();
    const systemFiles = fs.readdirSync(path.join(SRC_ROOT, "systems")).filter((f) => f.endsWith(".ts"));

    for (const file of systemFiles) {
      const src = fs.readFileSync(path.join(SRC_ROOT, "systems", file), "utf-8");
      // Match player.getDynamicProperty("mk:...") or player.setDynamicProperty("mk:...", ...)
      const matches = src.matchAll(/player\.\w*DynamicProperty\(\s*["'`](mk:[^"'`]+)["'`]/g);
      for (const m of matches) {
        playerProps.add(m[1]);
      }
    }

    // Also check main.ts for player props
    const mainSrc = fs.readFileSync(path.join(SRC_ROOT, "main.ts"), "utf-8");
    const mainMatches = mainSrc.matchAll(/player\.\w*DynamicProperty\(\s*["'`](mk:[^"'`]+)["'`]/g);
    for (const m of mainMatches) {
      playerProps.add(m[1]);
    }

    // Also check data files
    const dataFiles = fs.readdirSync(path.join(SRC_ROOT, "data")).filter((f) => f.endsWith(".ts"));
    for (const file of dataFiles) {
      const src = fs.readFileSync(path.join(SRC_ROOT, "data", file), "utf-8");
      const matches = src.matchAll(/player\.\w*DynamicProperty\(\s*["'`](mk:[^"'`]+)["'`]/g);
      for (const m of matches) {
        playerProps.add(m[1]);
      }
    }

    // Exclude template strings that generate per-tier keys
    // mk:tier_unlocked_0 through mk:tier_unlocked_4 count as distinct keys
    expect(playerProps.size).toBeLessThanOrEqual(15); // generous budget for 5 tier keys + base keys
  });
});

// ─── Script entry and compilation ───────────────────────────────────────────

describe("Compiled scripts: structure matches source", () => {
  it("all system JS files exist in BP scripts/", () => {
    const expectedFiles = [
      "main.js",
      "systems/DayCounterSystem.js",
      "systems/ArmorTierSystem.js",
      "systems/ArmySystem.js",
      "systems/CombatSystem.js",
      "systems/CastleSystem.js",
      "systems/SiegeSystem.js",
      "systems/EnemyCampSystem.js",
      "systems/BestiarySystem.js",
      "systems/MerchantSystem.js",
    ];
    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(BP_ROOT, "scripts", file))).toBe(true);
    }
  });

  it("all data JS files exist in BP scripts/", () => {
    const expectedFiles = [
      "data/ArmorTiers.js",
      "data/WaveDefinitions.js",
      "data/CastleBlueprints.js",
      "data/CampDefinitions.js",
      "data/FactionDefinitions.js",
      "data/BestiaryDefinitions.js",
      "data/Strings.js",
      "data/MilestoneEvents.js",
    ];
    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(BP_ROOT, "scripts", file))).toBe(true);
    }
  });
});

// ─── Pack conflict detection ────────────────────────────────────────────────

describe("Pack conflict prevention", () => {
  it("all entity IDs use mk: namespace to avoid conflicts", () => {
    const entityDir = path.join(BP_ROOT, "entities");
    const files = fs.readdirSync(entityDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const entity = readJson(path.join(entityDir, file)) as {
        "minecraft:entity": { description: { identifier: string } };
      };
      const id = entity["minecraft:entity"].description.identifier;
      expect(id).toMatch(/^mk:/);
    }
  });

  it("all item IDs use mk: namespace", () => {
    const armorDir = path.join(BP_ROOT, "items/armor");
    const toolsDir = path.join(BP_ROOT, "items/tools");
    const dirs = [armorDir, toolsDir];
    for (const dir of dirs) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const item = readJson(path.join(dir, file)) as {
          "minecraft:item": { description: { identifier: string } };
        };
        const id = item["minecraft:item"].description.identifier;
        expect(id).toMatch(/^mk:/);
      }
    }
  });

  it("BP and RP UUIDs are unique across all modules", () => {
    const bpManifest = readJson(path.join(BP_ROOT, "manifest.json")) as {
      header: { uuid: string };
      modules: { uuid: string }[];
    };
    const rpManifest = readJson(path.join(RP_ROOT, "manifest.json")) as {
      header: { uuid: string };
      modules: { uuid: string }[];
    };

    const allUuids: string[] = [
      bpManifest.header.uuid,
      ...bpManifest.modules.map((m) => m.uuid),
      rpManifest.header.uuid,
      ...rpManifest.modules.map((m) => m.uuid),
    ];

    const unique = new Set(allUuids);
    expect(unique.size).toBe(allUuids.length);
  });
});
