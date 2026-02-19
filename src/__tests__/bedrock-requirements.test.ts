/**
 * Bedrock pack requirements tests.
 *
 * Verifies structural constraints that the Bedrock Edition engine enforces
 * at pack loading and runtime. These tests catch silent failures, broken UI,
 * and crashes that would otherwise only appear in-game:
 *
 *   - Manifest UUID integrity (BP → RP dependency cross-reference)
 *   - Script module compliance (language, entry point, API version)
 *   - Item component schema (wearable, durability, icon, localization keys)
 *   - Attachable definitions (armor visual layer in RP)
 *   - Entity BP required fields (is_summonable, physics, despawn lifecycle)
 *   - Client entity required structure (materials, geometry, render_controllers)
 *   - Spawn rule compliance (population_control, density_limit, biome_filter)
 *   - Recipe format compliance (version, tags, key completeness)
 *   - Item texture atlas cross-reference (icon → atlas entry → texture path)
 *   - Localization coverage (en_US.lang must define all display_name keys)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");
const RP_ROOT = path.join(__dirname, "../../MegaKnights_RP");

const entitiesDir     = path.join(BP_ROOT, "entities");
const clientEntityDir = path.join(RP_ROOT, "entity");
const attachablesDir  = path.join(RP_ROOT, "attachables");
const itemsArmorDir   = path.join(BP_ROOT, "items/armor");
const itemsToolsDir   = path.join(BP_ROOT, "items/tools");
const spawnRulesDir   = path.join(BP_ROOT, "spawn_rules");
const recipesDir      = path.join(BP_ROOT, "recipes");
const langPath        = path.join(RP_ROOT, "texts/en_US.lang");
const itemTexturePath = path.join(RP_ROOT, "textures/item_texture.json");

// ── helpers ──────────────────────────────────────────────────────────────────

function readJsonDir(dir: string): Array<{ file: string; data: any }> {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => ({
      file,
      data: JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")),
    }));
}

/** Returns all item JSON entries across armor/ and tools/ subdirectories. */
function allItems(): Array<{ file: string; data: any }> {
  return [...readJsonDir(itemsArmorDir), ...readJsonDir(itemsToolsDir)];
}

/**
 * Parses en_US.lang into a key→value map.
 * Skips blank lines and lines starting with '#'.
 */
function parseLang(): Map<string, string> {
  const result = new Map<string, string>();
  if (!fs.existsSync(langPath)) return result;
  for (const line of fs.readFileSync(langPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) result.set(trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1));
  }
  return result;
}

const bpManifest = JSON.parse(
  fs.readFileSync(path.join(BP_ROOT, "manifest.json"), "utf-8"),
);
const rpManifest = JSON.parse(
  fs.readFileSync(path.join(RP_ROOT, "manifest.json"), "utf-8"),
);

// ═════════════════════════════════════════════════════════════════════════════
// MANIFEST — UUID integrity
// Bedrock matches packs by UUID+version.  A stale or mismatched RP UUID in
// the BP dependencies array means the resource pack is never linked, breaking
// textures, geometry, and animations for all custom entities.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Manifest] UUID cross-references", () => {
  it("BP dependencies include the RP header UUID", () => {
    const rpHeaderUuid: string = rpManifest.header.uuid;
    const bpDeps: any[] = bpManifest.dependencies ?? [];
    const found = bpDeps.some(
      (d: any) => typeof d.uuid === "string" && d.uuid === rpHeaderUuid,
    );
    expect(
      found,
      `BP dependencies must include RP header UUID "${rpHeaderUuid}"`,
    ).toBe(true);
  });

  it("BP header UUID and RP header UUID are different (packs must have distinct identities)", () => {
    expect(bpManifest.header.uuid).not.toBe(rpManifest.header.uuid);
  });

  it("all UUIDs within the BP manifest are distinct", () => {
    const uuids: string[] = [bpManifest.header.uuid];
    for (const m of bpManifest.modules ?? []) uuids.push(m.uuid);
    for (const d of bpManifest.dependencies ?? []) {
      if (typeof d.uuid === "string") uuids.push(d.uuid);
    }
    expect(new Set(uuids).size, "BP manifest contains duplicate UUIDs").toBe(uuids.length);
  });

  it("all UUIDs within the RP manifest are distinct", () => {
    const uuids: string[] = [rpManifest.header.uuid];
    for (const m of rpManifest.modules ?? []) uuids.push(m.uuid);
    expect(new Set(uuids).size, "RP manifest contains duplicate UUIDs").toBe(uuids.length);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MANIFEST — Script module
// The script module wires TypeScript-compiled output into the Bedrock engine.
// Wrong language, entry, or API version causes the entire script system to
// fail to load, breaking all game logic.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Manifest] Script module compliance", () => {
  const scriptModule = (bpManifest.modules as any[]).find(
    (m: any) => m.type === "script",
  );

  it("BP manifest has a script module", () => {
    expect(scriptModule, "No module with type 'script' found in BP manifest").toBeDefined();
  });

  it("script module language is 'javascript' (TypeScript is compiled before deploy)", () => {
    expect(scriptModule?.language).toBe("javascript");
  });

  it("script entry point is 'scripts/main.js' (matches tsc outDir + main.ts)", () => {
    expect(scriptModule?.entry).toBe("scripts/main.js");
  });

  it("@minecraft/server version is a stable semver (no -beta or -preview suffix)", () => {
    const deps: any[] = bpManifest.dependencies ?? [];
    const serverDep = deps.find((d: any) => d.module_name === "@minecraft/server");
    expect(serverDep, "@minecraft/server dependency missing from BP manifest").toBeDefined();
    const ver: string = serverDep?.version ?? "";
    // Pre-release builds have stability issues and may not be available on all platforms
    expect(ver, `@minecraft/server "${ver}" must not be a pre-release`).not.toMatch(
      /-beta|-preview|-rc/i,
    );
    expect(ver, `@minecraft/server "${ver}" must be a plain semver (X.Y.Z)`).toMatch(
      /^\d+\.\d+\.\d+$/,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ITEMS — Required Bedrock fields
// Missing fields produce invisible items, wrong menu placement, or broken
// crafting.  All checks apply to both armor (items/armor/) and tools
// (items/tools/).
// ═════════════════════════════════════════════════════════════════════════════

describe("[Items] Required Bedrock item schema fields", () => {
  it("all items have format_version", () => {
    allItems().forEach(({ file, data }) => {
      expect(data.format_version, `${file}: missing format_version`).toBeDefined();
    });
  });

  it("all item identifiers use the mk: namespace", () => {
    allItems().forEach(({ file, data }) => {
      const id: string = data["minecraft:item"]?.description?.identifier ?? "";
      expect(id, `${file}: identifier must start with "mk:"`).toMatch(/^mk:/);
    });
  });

  it("item identifier matches its filename (prevents stale identifier drift)", () => {
    allItems().forEach(({ file, data }) => {
      const id: string = data["minecraft:item"]?.description?.identifier ?? "";
      const baseName = file.replace(/\.json$/, "");
      expect(
        id,
        `${file}: identifier "${id}" must be "mk:${baseName}"`,
      ).toBe(`mk:${baseName}`);
    });
  });

  it("all items have menu_category.category (required for creative inventory placement)", () => {
    allItems().forEach(({ file, data }) => {
      const cat = data["minecraft:item"]?.description?.menu_category?.category;
      expect(cat, `${file}: missing menu_category.category`).toBeTruthy();
    });
  });

  it("all items have minecraft:icon (no icon → invisible in inventory)", () => {
    allItems().forEach(({ file, data }) => {
      const icon = data["minecraft:item"]?.components?.["minecraft:icon"];
      expect(icon, `${file}: missing minecraft:icon component`).toBeDefined();
    });
  });

  it("all items have minecraft:display_name.value", () => {
    allItems().forEach(({ file, data }) => {
      const dn = data["minecraft:item"]?.components?.["minecraft:display_name"]?.value;
      expect(dn, `${file}: missing minecraft:display_name.value`).toBeTruthy();
    });
  });

  it("display_name.value is a localization key matching 'item.{identifier}.name'", () => {
    // Bedrock looks up this key in en_US.lang; absent key → raw key string shown to player.
    allItems().forEach(({ file, data }) => {
      const id: string = data["minecraft:item"]?.description?.identifier ?? "";
      const dn: string =
        data["minecraft:item"]?.components?.["minecraft:display_name"]?.value ?? "";
      expect(
        dn,
        `${file}: display_name.value "${dn}" must be localization key "item.${id}.name"`,
      ).toBe(`item.${id}.name`);
    });
  });

  it("all items have max_stack_size: 1 (armor and tokens are non-stackable)", () => {
    allItems().forEach(({ file, data }) => {
      const sz = data["minecraft:item"]?.components?.["minecraft:max_stack_size"];
      expect(sz, `${file}: minecraft:max_stack_size must be 1`).toBe(1);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ITEMS — Armor-specific components
// Bedrock requires minecraft:wearable for slot placement and equip behavior.
// Without durability, armor has infinite health.  Without repairable, an
// anvil repair destroys the item.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Items] Armor-specific Bedrock components", () => {
  const VALID_SLOTS = new Set([
    "slot.armor.head",
    "slot.armor.chest",
    "slot.armor.legs",
    "slot.armor.feet",
  ]);

  it("armor items have minecraft:wearable with a valid Bedrock armor slot", () => {
    readJsonDir(itemsArmorDir).forEach(({ file, data }) => {
      const slot: string =
        data["minecraft:item"]?.components?.["minecraft:wearable"]?.slot ?? "";
      expect(
        VALID_SLOTS.has(slot),
        `${file}: wearable.slot "${slot}" is not a valid Bedrock armor slot`,
      ).toBe(true);
    });
  });

  it("armor items have minecraft:durability.max_durability > 0", () => {
    readJsonDir(itemsArmorDir).forEach(({ file, data }) => {
      const maxDur: number =
        data["minecraft:item"]?.components?.["minecraft:durability"]?.max_durability ?? 0;
      expect(maxDur, `${file}: max_durability must be > 0`).toBeGreaterThan(0);
    });
  });

  it("armor items have minecraft:wearable.protection > 0", () => {
    readJsonDir(itemsArmorDir).forEach(({ file, data }) => {
      const prot: number =
        data["minecraft:item"]?.components?.["minecraft:wearable"]?.protection ?? 0;
      expect(prot, `${file}: wearable.protection must be > 0`).toBeGreaterThan(0);
    });
  });

  it("armor items have minecraft:enchantable (required for enchanting table support)", () => {
    readJsonDir(itemsArmorDir).forEach(({ file, data }) => {
      const enc = data["minecraft:item"]?.components?.["minecraft:enchantable"];
      expect(enc, `${file}: armor must define minecraft:enchantable`).toBeDefined();
    });
  });

  it("armor items have minecraft:repairable with at least one repair entry", () => {
    readJsonDir(itemsArmorDir).forEach(({ file, data }) => {
      const repairItems: any[] =
        data["minecraft:item"]?.components?.["minecraft:repairable"]?.repair_items ?? [];
      expect(
        repairItems.length,
        `${file}: repairable.repair_items must be non-empty`,
      ).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCALIZATION — en_US.lang coverage
// If a translation key referenced by display_name.value is absent from the
// lang file, Bedrock shows the raw key string to the player instead of the
// item name (e.g. "item.mk:mk_knight_chestplate.name" as the display text).
// ═════════════════════════════════════════════════════════════════════════════

describe("[Localization] en_US.lang coverage", () => {
  it("en_US.lang exists", () => {
    expect(fs.existsSync(langPath), `Missing lang file: ${langPath}`).toBe(true);
  });

  it("pack.name and pack.description are defined", () => {
    const lang = parseLang();
    expect(lang.has("pack.name"), "pack.name missing from en_US.lang").toBe(true);
    expect(lang.has("pack.description"), "pack.description missing from en_US.lang").toBe(true);
  });

  it("all lang lines are empty, comments, or key=value (no malformed lines)", () => {
    if (!fs.existsSync(langPath)) return;
    const malformed: string[] = [];
    fs.readFileSync(langPath, "utf-8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        if (!trimmed.includes("=")) malformed.push(`  L${i + 1}: "${line}"`);
      });
    expect(
      malformed,
      `Malformed lang lines (no '='):\n${malformed.join("\n")}`,
    ).toEqual([]);
  });

  it("all item display_name localization keys are defined in en_US.lang", () => {
    // NOTE: This test documents a real gap — items will show raw key strings
    // in-game until these keys are added to en_US.lang.
    const lang = parseLang();
    const missing: string[] = [];
    allItems().forEach(({ data }) => {
      const key: string =
        data["minecraft:item"]?.components?.["minecraft:display_name"]?.value ?? "";
      if (key && !lang.has(key)) missing.push(`  ${key}`);
    });
    expect(
      missing,
      `${missing.length} display_name keys missing from en_US.lang (items will show raw key strings in-game):\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ATTACHABLES — Armor visual layer (RP)
// Attachables wire armor items to the visual layer shown on the player model.
// A missing or mismatched attachable means the armor renders invisibly or with
// the wrong texture while still providing gameplay stats.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Attachables] Armor RP attachable definitions", () => {
  it("every armor item has a corresponding attachable in RP/attachables/", () => {
    const attachableNames = new Set(
      fs.readdirSync(attachablesDir).map((f) => f.replace(/\.json$/, "")),
    );
    const missing: string[] = [];
    readJsonDir(itemsArmorDir).forEach(({ file }) => {
      const base = file.replace(/\.json$/, "");
      if (!attachableNames.has(base)) missing.push(base);
    });
    expect(
      missing,
      `Armor items missing an attachable definition: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("attachable identifier matches the corresponding item identifier", () => {
    readJsonDir(attachablesDir).forEach(({ file, data }) => {
      const id: string =
        data["minecraft:attachable"]?.description?.identifier ?? "";
      const expected = `mk:${file.replace(/\.json$/, "")}`;
      expect(id, `${file}: identifier "${id}" must be "${expected}"`).toBe(expected);
    });
  });

  it("attachable materials do not use alpha-test (opaque armor rendering on Maxwell GPU)", () => {
    const FORBIDDEN = ["alphatest", "alpha_test", "transparent"];
    readJsonDir(attachablesDir).forEach(({ file, data }) => {
      const mats: Record<string, string> =
        data["minecraft:attachable"]?.description?.materials ?? {};
      Object.entries(mats).forEach(([slot, mat]) => {
        if (slot === "enchanted") return; // vanilla glint uses its own material
        FORBIDDEN.forEach((bad) => {
          expect(
            mat.toLowerCase(),
            `${file}: material slot "${slot}" uses forbidden material "${mat}"`,
          ).not.toContain(bad);
        });
      });
    });
  });

  it("attachables use controller.render.armor render controller", () => {
    readJsonDir(attachablesDir).forEach(({ file, data }) => {
      const rcs: string[] =
        data["minecraft:attachable"]?.description?.render_controllers ?? [];
      expect(
        rcs,
        `${file}: render_controllers must include "controller.render.armor"`,
      ).toContain("controller.render.armor");
    });
  });

  it("attachable default texture paths are lowercase (Android case-sensitive filesystem)", () => {
    readJsonDir(attachablesDir).forEach(({ file, data }) => {
      const textures: Record<string, string> =
        data["minecraft:attachable"]?.description?.textures ?? {};
      const defaultTex: string = textures["default"] ?? "";
      if (defaultTex) {
        expect(
          defaultTex,
          `${file}: textures.default "${defaultTex}" must be lowercase`,
        ).toBe(defaultTex.toLowerCase());
      }
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ENTITIES (BP) — Required Bedrock behavior fields
// These fields are checked at entity registration.  Missing is_summonable
// breaks spawnEntity(); missing physics causes entities to float; missing
// mk:despawn leaks entities that the script can never clean up.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Entities BP] Required Bedrock entity description fields", () => {
  it("all entities have is_summonable: true (required for spawnEntity() in script)", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const desc = data["minecraft:entity"]?.description;
      expect(desc?.is_summonable, `${file}: is_summonable must be true`).toBe(true);
    });
  });

  it("all entities have is_spawnable: false (no spawn egg; spawn via rules or script)", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const desc = data["minecraft:entity"]?.description;
      expect(desc?.is_spawnable, `${file}: is_spawnable must be false`).toBe(false);
    });
  });

  it("all entities have is_experimental: false (no experimental toggle required to play)", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const desc = data["minecraft:entity"]?.description;
      expect(
        desc?.is_experimental,
        `${file}: is_experimental must be false`,
      ).toBe(false);
    });
  });

  it("all entities have mk:despawn component group containing minecraft:instant_despawn", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const group = data["minecraft:entity"]?.component_groups?.["mk:despawn"];
      expect(group, `${file}: missing component_groups.mk:despawn`).toBeDefined();
      expect(
        group?.["minecraft:instant_despawn"],
        `${file}: mk:despawn group must contain minecraft:instant_despawn`,
      ).toBeDefined();
    });
  });

  it("all entities define events.mk:despawn (script lifecycle hook)", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const evt = data["minecraft:entity"]?.events?.["mk:despawn"];
      expect(evt, `${file}: missing events.mk:despawn`).toBeDefined();
    });
  });

  it("all entities have minecraft:physics (gravity and ground detection)", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const physics = data["minecraft:entity"]?.components?.["minecraft:physics"];
      expect(physics, `${file}: missing minecraft:physics`).toBeDefined();
    });
  });

  it("all entities have minecraft:collision_box with numeric width and height", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const box = data["minecraft:entity"]?.components?.["minecraft:collision_box"];
      expect(box, `${file}: missing minecraft:collision_box`).toBeDefined();
      expect(typeof box?.width, `${file}: collision_box.width must be a number`).toBe(
        "number",
      );
      expect(typeof box?.height, `${file}: collision_box.height must be a number`).toBe(
        "number",
      );
    });
  });

  it("entities with minecraft:nameable must have always_show: false (avoids persistent nametag render cost)", () => {
    // Enemies omit minecraft:nameable entirely (no nametag at all — even better).
    // Allies and the boss include it but must keep always_show: false so the
    // nametag only renders on mouse-over, not every frame.
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const nameable =
        data["minecraft:entity"]?.components?.["minecraft:nameable"];
      if (!nameable) return; // entity has no nametag support — OK
      expect(
        nameable.always_show,
        `${file}: nameable.always_show must be false`,
      ).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ENTITIES (RP) — Client entity structure
// Bedrock requires all five description fields.  A missing render_controllers
// entry causes the entity to render as invisible.  A mismatched identifier
// between BP and RP produces a T-pose with default Steve texture.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Entities RP] Client entity structure", () => {
  const REQUIRED_FIELDS = [
    "identifier",
    "materials",
    "textures",
    "geometry",
    "render_controllers",
  ];

  it("all client entities have the five required description fields", () => {
    readJsonDir(clientEntityDir).forEach(({ file, data }) => {
      const desc = data["minecraft:client_entity"]?.description ?? {};
      REQUIRED_FIELDS.forEach((field) => {
        expect(
          desc[field],
          `${file}: client entity description missing required field "${field}"`,
        ).toBeDefined();
      });
    });
  });

  it("all client entities reference controller.render.mk_entity", () => {
    readJsonDir(clientEntityDir).forEach(({ file, data }) => {
      const rcs: string[] =
        data["minecraft:client_entity"]?.description?.render_controllers ?? [];
      expect(
        rcs,
        `${file}: render_controllers must include "controller.render.mk_entity"`,
      ).toContain("controller.render.mk_entity");
    });
  });

  it("every BP entity identifier has a matching RP client entity", () => {
    const rpIds = new Set(
      readJsonDir(clientEntityDir).map(
        ({ data }) =>
          data["minecraft:client_entity"]?.description?.identifier as string,
      ),
    );
    const missing: string[] = [];
    readJsonDir(entitiesDir).forEach(({ data }) => {
      const id: string =
        data["minecraft:entity"]?.description?.identifier ?? "";
      if (id && !rpIds.has(id)) missing.push(id);
    });
    expect(
      missing,
      `BP entities with no matching RP client entity: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("no orphaned RP client entities without a BP counterpart", () => {
    const bpIds = new Set(
      readJsonDir(entitiesDir).map(
        ({ data }) =>
          data["minecraft:entity"]?.description?.identifier as string,
      ),
    );
    const orphans: string[] = [];
    readJsonDir(clientEntityDir).forEach(({ file, data }) => {
      const id: string =
        data["minecraft:client_entity"]?.description?.identifier ?? "";
      if (id && !bpIds.has(id)) orphans.push(`${file} (${id})`);
    });
    expect(
      orphans,
      `Orphaned RP client entities (no matching BP entity): ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("client entity default texture paths are lowercase (Android case-sensitive filesystem)", () => {
    readJsonDir(clientEntityDir).forEach(({ file, data }) => {
      const textures: Record<string, string> =
        data["minecraft:client_entity"]?.description?.textures ?? {};
      Object.entries(textures).forEach(([slot, tex]) => {
        expect(
          tex,
          `${file}: texture slot "${slot}" path "${tex}" must be lowercase`,
        ).toBe(tex.toLowerCase());
      });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SPAWN RULES — Bedrock population control compliance
// population_control: "monster" keeps custom enemies inside the vanilla mob
// cap.  Omitting density_limit allows unbounded accumulation in loaded chunks.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Spawn rules] Bedrock population control compliance", () => {
  it("all spawn rules use population_control: 'monster' (participates in vanilla mob cap)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const pop =
        data["minecraft:spawn_rules"]?.description?.population_control;
      expect(
        pop,
        `${file}: population_control must be "monster"`,
      ).toBe("monster");
    });
  });

  it("all spawn rules have minecraft:spawns_on_surface (melee units spawn on solid ground)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const conditions: any[] = data["minecraft:spawn_rules"]?.conditions ?? [];
      expect(conditions.length, `${file}: no spawn conditions defined`).toBeGreaterThan(0);
      const has = conditions.some(
        (c) => c["minecraft:spawns_on_surface"] !== undefined,
      );
      expect(has, `${file}: missing minecraft:spawns_on_surface`).toBe(true);
    });
  });

  it("all spawn rules have minecraft:brightness_filter (night or low-light spawning)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const conditions: any[] = data["minecraft:spawn_rules"]?.conditions ?? [];
      const has = conditions.some(
        (c) => c["minecraft:brightness_filter"] !== undefined,
      );
      expect(has, `${file}: missing minecraft:brightness_filter`).toBe(true);
    });
  });

  it("all spawn rules have minecraft:biome_filter (restricts to intended biomes)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const conditions: any[] = data["minecraft:spawn_rules"]?.conditions ?? [];
      const has = conditions.some(
        (c) => c["minecraft:biome_filter"] !== undefined,
      );
      expect(has, `${file}: missing minecraft:biome_filter`).toBe(true);
    });
  });

  it("all spawn rules have minecraft:density_limit (prevents unbounded mob accumulation)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const conditions: any[] = data["minecraft:spawn_rules"]?.conditions ?? [];
      const has = conditions.some(
        (c) => c["minecraft:density_limit"] !== undefined,
      );
      expect(has, `${file}: missing minecraft:density_limit`).toBe(true);
    });
  });

  it("all spawn rules have minecraft:herd (controls group size per spawn attempt)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const conditions: any[] = data["minecraft:spawn_rules"]?.conditions ?? [];
      const has = conditions.some((c) => c["minecraft:herd"] !== undefined);
      expect(has, `${file}: missing minecraft:herd`).toBe(true);
    });
  });

  it("no ally entities have spawn rules (allies spawn via script only, not naturally)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const id: string =
        data["minecraft:spawn_rules"]?.description?.identifier ?? "";
      expect(
        id,
        `${file}: ally entities must not have natural spawn rules`,
      ).not.toContain("mk_ally");
    });
  });

  it("spawn rule identifier matches its filename (no stale copied identifiers)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const id: string =
        data["minecraft:spawn_rules"]?.description?.identifier ?? "";
      const expected = `mk:${file.replace(/\.json$/, "")}`;
      expect(
        id,
        `${file}: identifier "${id}" must be "${expected}"`,
      ).toBe(expected);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RECIPES — Format and crafting compliance
// Bedrock 1.12 is the last stable recipe format version.  Missing crafting_table
// tag makes the recipe uncraftable.  Orphaned pattern keys or missing key
// entries crash the recipe loader.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Recipes] Bedrock recipe format compliance", () => {
  it("all recipes use format_version '1.12'", () => {
    readJsonDir(recipesDir).forEach(({ file, data }) => {
      expect(
        data.format_version,
        `${file}: format_version must be "1.12"`,
      ).toBe("1.12");
    });
  });

  it("each recipe defines exactly one recipe type (shaped, shapeless, or furnace)", () => {
    readJsonDir(recipesDir).forEach(({ file, data }) => {
      const types = [
        "minecraft:recipe_shaped",
        "minecraft:recipe_shapeless",
        "minecraft:recipe_furnace",
      ].filter((t) => t in data);
      expect(
        types.length,
        `${file}: must define exactly one recipe type, found ${types.length}: ${types.join(", ")}`,
      ).toBe(1);
    });
  });

  it("all recipes specify the crafting_table tag (makes recipe appear at crafting table)", () => {
    readJsonDir(recipesDir).forEach(({ file, data }) => {
      const recipe =
        data["minecraft:recipe_shaped"] ??
        data["minecraft:recipe_shapeless"] ??
        data["minecraft:recipe_furnace"] ??
        {};
      const tags: string[] = recipe.tags ?? [];
      expect(
        tags,
        `${file}: tags must include "crafting_table"`,
      ).toContain("crafting_table");
    });
  });

  it("mk: result items have a corresponding item definition file", () => {
    const armorNames = new Set(
      fs.readdirSync(itemsArmorDir).map((f) => f.replace(/\.json$/, "")),
    );
    const toolNames = new Set(
      fs.readdirSync(itemsToolsDir).map((f) => f.replace(/\.json$/, "")),
    );
    const allItemNames = new Set([...armorNames, ...toolNames]);

    readJsonDir(recipesDir).forEach(({ file, data }) => {
      const recipe =
        data["minecraft:recipe_shaped"] ??
        data["minecraft:recipe_shapeless"] ??
        {};
      const resultItem: string = recipe.result?.item ?? "";
      if (!resultItem.startsWith("mk:")) return;
      const itemName = resultItem.replace(/^mk:/, "");
      expect(
        allItemNames.has(itemName),
        `${file}: result item "${resultItem}" has no item definition in items/`,
      ).toBe(true);
    });
  });

  it("shaped recipe pattern characters are all covered by key entries", () => {
    readJsonDir(recipesDir).forEach(({ file, data }) => {
      const shaped = data["minecraft:recipe_shaped"];
      if (!shaped) return;
      const pattern: string[] = shaped.pattern ?? [];
      const keys: Record<string, any> = shaped.key ?? {};
      const usedChars = new Set(
        pattern
          .join("")
          .split("")
          .filter((c) => c !== " "),
      );
      usedChars.forEach((ch) => {
        expect(
          keys[ch],
          `${file}: pattern uses "${ch}" but no key entry exists for it`,
        ).toBeDefined();
      });
    });
  });

  it("shaped recipe key entries are all used in the pattern (no orphaned key definitions)", () => {
    readJsonDir(recipesDir).forEach(({ file, data }) => {
      const shaped = data["minecraft:recipe_shaped"];
      if (!shaped) return;
      const pattern: string[] = shaped.pattern ?? [];
      const keys: Record<string, any> = shaped.key ?? {};
      const usedChars = new Set(
        pattern
          .join("")
          .split("")
          .filter((c) => c !== " "),
      );
      Object.keys(keys).forEach((ch) => {
        expect(
          usedChars.has(ch),
          `${file}: key entry "${ch}" is defined but never appears in pattern`,
        ).toBe(true);
      });
    });
  });

  it("shapeless recipes have a non-empty ingredients array", () => {
    readJsonDir(recipesDir).forEach(({ file, data }) => {
      const shapeless = data["minecraft:recipe_shapeless"];
      if (!shapeless) return;
      const ingredients: any[] = shapeless.ingredients ?? [];
      expect(
        ingredients.length,
        `${file}: shapeless recipe ingredients array is empty`,
      ).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ITEM TEXTURE ATLAS — Icon cross-reference
// Bedrock resolves item icons via item_texture.json.  A missing atlas entry
// renders items with a purple-and-black missing-texture quad.  Orphaned entries
// are dead weight but harmless; they're still flagged to catch copy-paste drift.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Item textures] item_texture.json atlas cross-reference", () => {
  const atlas = JSON.parse(fs.readFileSync(itemTexturePath, "utf-8"));
  const atlasData: Record<string, any> = atlas.texture_data ?? {};

  it("item_texture.json declares texture_name: 'atlas.items'", () => {
    expect(atlas.texture_name).toBe("atlas.items");
  });

  it("all item minecraft:icon values are registered in item_texture.json", () => {
    const missing: string[] = [];
    allItems().forEach(({ file, data }) => {
      const iconName: string =
        data["minecraft:item"]?.components?.["minecraft:icon"] ?? "";
      if (iconName && !atlasData[iconName]) {
        missing.push(`  ${file}: icon "${iconName}"`);
      }
    });
    expect(
      missing,
      `Icons not registered in item_texture.json:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("all atlas texture paths are lowercase (Android case-sensitive filesystem)", () => {
    const badPaths: string[] = [];
    Object.entries(atlasData).forEach(([key, entry]: [string, any]) => {
      const texPath: string = entry.textures ?? "";
      if (texPath !== texPath.toLowerCase()) {
        badPaths.push(`  atlas["${key}"].textures = "${texPath}"`);
      }
    });
    expect(
      badPaths,
      `Uppercase paths in item_texture.json:\n${badPaths.join("\n")}`,
    ).toEqual([]);
  });

  it("no orphaned atlas entries (every entry is referenced by some item icon)", () => {
    const usedIcons = new Set(
      allItems()
        .map(
          ({ data }) =>
            data["minecraft:item"]?.components?.["minecraft:icon"] as string,
        )
        .filter(Boolean),
    );
    const orphans = Object.keys(atlasData).filter((key) => !usedIcons.has(key));
    expect(
      orphans,
      `Orphaned atlas entries not referenced by any item: ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});
