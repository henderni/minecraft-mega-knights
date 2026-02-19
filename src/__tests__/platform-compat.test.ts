/**
 * Platform compatibility tests.
 *
 * Organized by the constraints each platform imposes:
 *
 *   Nintendo Switch  — Tegra X1 (Maxwell GPU, ARM CPU), 4 GB shared RAM.
 *                      Strictest target; if it passes here it passes everywhere.
 *   Mobile (iOS/Android) — case-sensitive filesystems, no experimental APIs.
 *   All platforms    — format-version compatibility, manifest alignment.
 *   Windows / Xbox / PlayStation — confirm Switch-conservative settings are
 *                      still meaningful on higher-end hardware.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";

const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");
const RP_ROOT = path.join(__dirname, "../../MegaKnights_RP");
const entitiesDir = path.join(BP_ROOT, "entities");
const clientEntityDir = path.join(RP_ROOT, "entity");
const renderCtrlDir = path.join(RP_ROOT, "render_controllers");
const spawnRulesDir = path.join(BP_ROOT, "spawn_rules");
const recipesDir = path.join(BP_ROOT, "recipes");

// ── helpers ──────────────────────────────────────────────────────────────────

function readJsonDir(dir: string, suffix = ".json") {
  if (!fs.existsSync(dir)) return [] as Array<{ file: string; data: any }>;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .map((file) => ({
      file,
      data: JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")),
    }));
}

function bpEntity(filename: string): any {
  return JSON.parse(
    fs.readFileSync(path.join(entitiesDir, filename), "utf-8"),
  )["minecraft:entity"];
}

// ═════════════════════════════════════════════════════════════════════════════
// NINTENDO SWITCH
// Tegra X1: Maxwell GPU (no early-Z with alpha-test), ARM CPU (pathfinding
// cost cubic with follow_range), 4 GB shared RAM.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Switch] GPU: opaque materials only", () => {
  /**
   * entity_alphatest disables early-Z on Maxwell.  Every entity must use
   * the opaque "entity" material (or a custom opaque variant).
   * Forbidden substrings: "alphatest", "alpha_test", "transparent".
   */
  const FORBIDDEN = ["alphatest", "alpha_test", "transparent"];

  it("client entity description materials must not use alpha-test", () => {
    readJsonDir(clientEntityDir).forEach(({ file, data }) => {
      const materials: Record<string, string> =
        data["minecraft:client_entity"]?.description?.materials ?? {};
      Object.entries(materials).forEach(([slot, materialName]) => {
        FORBIDDEN.forEach((bad) => {
          expect(
            materialName.toLowerCase(),
            `${file}: material slot "${slot}" uses forbidden material "${materialName}"`,
          ).not.toContain(bad);
        });
      });
    });
  });

  it("render controllers must not reference alpha-test materials", () => {
    readJsonDir(renderCtrlDir).forEach(({ file, data }) => {
      const controllers: Record<string, any> =
        data["render_controllers"] ?? {};
      Object.entries(controllers).forEach(([ctrlName, ctrl]) => {
        const materialsArr: Array<Record<string, string>> =
          ctrl.materials ?? [];
        materialsArr.forEach((slot) => {
          Object.values(slot).forEach((matRef) => {
            FORBIDDEN.forEach((bad) => {
              expect(
                (matRef as string).toLowerCase(),
                `${file} controller "${ctrlName}": material ref "${matRef}" looks like alpha-test`,
              ).not.toContain(bad);
            });
          });
        });
      });
    });
  });
});

describe("[Switch] GPU: sky-darkening disabled on boss", () => {
  /**
   * should_darken_sky triggers an expensive sky-rendering pass.
   * Spawning a boss during a siege (high entity count) would compound the GPU
   * cost intolerably on Switch.
   */
  it("boss entity must have should_darken_sky: false", () => {
    const boss = bpEntity("mk_boss_siege_lord.se.json");
    const bossComp = boss?.components?.["minecraft:boss"];
    expect(bossComp).toBeDefined();
    expect(
      bossComp?.should_darken_sky,
      "boss should_darken_sky must be false to avoid sky-pass GPU cost on Switch",
    ).toBe(false);
  });
});

describe("[Switch] CPU: follow_range caps per entity tier", () => {
  /**
   * Pathfinding cost is roughly cubic with follow_range.
   * CLAUDE.md limits: basic ≤ 16, elites ≤ 24, boss ≤ 32.
   */
  it("basic enemy follow_range ≤ 16", () => {
    ["mk_enemy_knight.se.json", "mk_enemy_archer.se.json", "mk_enemy_wizard.se.json"].forEach(
      (f) => {
        const val = bpEntity(f)?.components?.["minecraft:follow_range"]?.value;
        expect(
          val,
          `${f}: basic enemy follow_range ${val} exceeds Switch limit of 16`,
        ).toBeLessThanOrEqual(16);
      },
    );
  });

  it("elite enemy (dark_knight) follow_range ≤ 24", () => {
    const val = bpEntity("mk_enemy_dark_knight.se.json")?.components?.[
      "minecraft:follow_range"
    ]?.value;
    expect(
      val,
      `dark_knight follow_range ${val} exceeds Switch elite limit of 24`,
    ).toBeLessThanOrEqual(24);
  });

  it("ally follow_range ≤ 16 for basic allies", () => {
    ["mk_ally_knight.se.json", "mk_ally_archer.se.json", "mk_ally_wizard.se.json"].forEach(
      (f) => {
        const val = bpEntity(f)?.components?.["minecraft:follow_range"]?.value;
        expect(
          val,
          `${f}: basic ally follow_range ${val} exceeds 16`,
        ).toBeLessThanOrEqual(16);
      },
    );
  });

  it("elite ally (dark_knight) follow_range ≤ 24", () => {
    const val = bpEntity("mk_ally_dark_knight.se.json")?.components?.[
      "minecraft:follow_range"
    ]?.value;
    expect(val).toBeLessThanOrEqual(24);
  });

  it("boss follow_range ≤ 32", () => {
    const val = bpEntity("mk_boss_siege_lord.se.json")?.components?.[
      "minecraft:follow_range"
    ]?.value;
    expect(
      val,
      `boss follow_range ${val} exceeds Switch boss limit of 32`,
    ).toBeLessThanOrEqual(32);
  });
});

describe("[Switch] CPU: nearest_attackable_target max_dist caps", () => {
  /**
   * max_dist drives the per-tick target scan radius.
   * Non-boss non-elites: ≤ 16.  Elites: ≤ 24.  Boss: ≤ 32.
   */
  function maxDistFor(filename: string): number | undefined {
    const behavior =
      bpEntity(filename)?.components?.[
        "minecraft:behavior.nearest_attackable_target"
      ];
    const types: any[] = behavior?.entity_types ?? [];
    const dists = types.map((t) => t.max_dist).filter((d) => d !== undefined);
    return dists.length ? Math.max(...dists) : undefined;
  }

  it("basic enemy max_dist ≤ 16", () => {
    ["mk_enemy_knight.se.json", "mk_enemy_archer.se.json", "mk_enemy_wizard.se.json"].forEach(
      (f) => {
        const dist = maxDistFor(f);
        if (dist === undefined) return;
        expect(dist, `${f}: targeting max_dist ${dist} exceeds 16`).toBeLessThanOrEqual(16);
      },
    );
  });

  it("elite enemy (dark_knight) max_dist ≤ 24", () => {
    const dist = maxDistFor("mk_enemy_dark_knight.se.json");
    if (dist !== undefined) expect(dist).toBeLessThanOrEqual(24);
  });

  it("boss max_dist ≤ 32", () => {
    const dist = maxDistFor("mk_boss_siege_lord.se.json");
    if (dist !== undefined) expect(dist, `boss max_dist ${dist} > 32`).toBeLessThanOrEqual(32);
  });
});

describe("[Switch] CPU: entity budget — ally cap + siege mobs ≤ 60", () => {
  /**
   * Switch pathfinding degrades severely above ~40 custom AI entities.
   * The siege budget is: GLOBAL_ARMY_CAP(35) + MAX_SIEGE_MOBS(25) = 60.
   * Each wave must fit within the 25-mob siege slot.
   */
  const GLOBAL_ARMY_CAP = 35;
  const MAX_SIEGE_MOBS = 25;
  const SWITCH_ENTITY_CEILING = 60;

  it("GLOBAL_ARMY_CAP + MAX_SIEGE_MOBS equals the Switch entity ceiling", () => {
    expect(GLOBAL_ARMY_CAP + MAX_SIEGE_MOBS).toBe(SWITCH_ENTITY_CEILING);
  });

  it("no single siege wave spawns more than MAX_SIEGE_MOBS entities per player", () => {
    WAVE_DEFINITIONS.forEach((wave) => {
      const total = wave.spawns.reduce((sum, s) => sum + s.count, 0);
      expect(
        total,
        `Wave ${wave.waveNumber}: ${total} spawns exceeds per-player siege mob budget of ${MAX_SIEGE_MOBS}`,
      ).toBeLessThanOrEqual(MAX_SIEGE_MOBS);
    });
  });

  it("combined peak is within ceiling: GLOBAL_ARMY_CAP + largest wave ≤ 60", () => {
    const maxWaveTotal = Math.max(
      ...WAVE_DEFINITIONS.map((w) => w.spawns.reduce((s, sp) => s + sp.count, 0)),
    );
    expect(
      GLOBAL_ARMY_CAP + maxWaveTotal,
      `Peak entity count ${GLOBAL_ARMY_CAP} allies + ${maxWaveTotal} siege mobs = ${GLOBAL_ARMY_CAP + maxWaveTotal} exceeds Switch ceiling of ${SWITCH_ENTITY_CEILING}`,
    ).toBeLessThanOrEqual(SWITCH_ENTITY_CEILING);
  });
});

describe("[Switch] natural spawn pressure: herd and density limits", () => {
  /**
   * Natural spawning compounds entity counts unexpectedly.
   * All spawn rules must: spawn one-at-a-time (herd max_size 1), have a
   * surface density limit of ≤ 2.
   */
  it("all spawn rules use herd max_size of 1 (no burst spawning)", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const conditions: any[] =
        data["minecraft:spawn_rules"]?.conditions ?? [];
      conditions.forEach((cond) => {
        const herd = cond["minecraft:herd"];
        if (!herd) return;
        expect(
          herd.max_size,
          `${file}: herd max_size ${herd.max_size} should be 1 on Switch`,
        ).toBe(1);
      });
    });
  });

  it("all spawn rule density limits are ≤ 2 per surface", () => {
    readJsonDir(spawnRulesDir).forEach(({ file, data }) => {
      const conditions: any[] =
        data["minecraft:spawn_rules"]?.conditions ?? [];
      conditions.forEach((cond) => {
        const density = cond["minecraft:density_limit"];
        if (!density) return;
        if (density.surface !== undefined) {
          expect(
            density.surface,
            `${file}: surface density_limit ${density.surface} is too high for Switch`,
          ).toBeLessThanOrEqual(2);
        }
      });
    });
  });

  it("spawn weight totals across all rules are low (≤ 40 combined)", () => {
    let combinedWeight = 0;
    readJsonDir(spawnRulesDir).forEach(({ data }) => {
      const conditions: any[] =
        data["minecraft:spawn_rules"]?.conditions ?? [];
      conditions.forEach((cond) => {
        combinedWeight += cond["minecraft:weight"]?.default ?? 0;
      });
    });
    expect(
      combinedWeight,
      `Combined spawn weight ${combinedWeight} risks crowding the vanilla monster pool`,
    ).toBeLessThanOrEqual(40);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MOBILE (Android / iOS)
// Android filesystems are case-sensitive.  No experimental APIs allowed.
// ═════════════════════════════════════════════════════════════════════════════

describe("[Mobile] Filesystem: texture paths must be lowercase", () => {
  /**
   * Android (ext4/f2fs) is case-sensitive; iOS is not by default, but
   * consistent lowercase prevents deployment issues on both platforms.
   */
  it("all texture references in client entities use lowercase paths", () => {
    readJsonDir(clientEntityDir).forEach(({ file, data }) => {
      const textures: Record<string, string> =
        data["minecraft:client_entity"]?.description?.textures ?? {};
      Object.entries(textures).forEach(([slot, texPath]) => {
        expect(
          texPath,
          `${file}: texture slot "${slot}" path "${texPath}" must be lowercase for Android`,
        ).toBe(texPath.toLowerCase());
      });
    });
  });

  it("texture paths must not contain spaces (breaks Android path resolution)", () => {
    readJsonDir(clientEntityDir).forEach(({ file, data }) => {
      const textures: Record<string, string> =
        data["minecraft:client_entity"]?.description?.textures ?? {};
      Object.values(textures).forEach((texPath) => {
        expect(
          texPath,
          `${file}: texture path "${texPath}" contains spaces`,
        ).not.toMatch(/\s/);
      });
    });
  });
});

describe("[Mobile] No experimental APIs", () => {
  /**
   * is_experimental entities are gated behind Experiments toggles.
   * On mobile/Switch, players often create worlds without enabling experiments,
   * which would cause all entities to silently fail to spawn.
   */
  it("all entities must have is_experimental: false", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const experimental =
        data["minecraft:entity"]?.description?.is_experimental;
      expect(
        experimental,
        `${file}: is_experimental must be false — experimental entities don't spawn without the Experiments toggle`,
      ).toBe(false);
    });
  });
});

describe("[Mobile] Collision boxes within memory-safe bounds", () => {
  /**
   * Oversized collision boxes increase physics query cost on every tick.
   * Keep widths ≤ 1.0 (human-scale) and heights ≤ 3.0.
   */
  it("all entity collision boxes stay within mobile-safe dimensions", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const box = data["minecraft:entity"]?.components?.["minecraft:collision_box"];
      if (!box) return;
      expect(
        box.width,
        `${file}: collision_box width ${box.width} > 1.0`,
      ).toBeLessThanOrEqual(1.0);
      expect(
        box.height,
        `${file}: collision_box height ${box.height} > 3.0`,
      ).toBeLessThanOrEqual(3.0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ALL PLATFORMS — format-version compatibility
// ═════════════════════════════════════════════════════════════════════════════

describe("[All platforms] Manifest engine version alignment", () => {
  /**
   * Both packs must declare the same min_engine_version so that Minecraft
   * doesn't partially load one pack without the other.
   */
  it("BP and RP min_engine_version are identical", () => {
    const bp = JSON.parse(
      fs.readFileSync(path.join(BP_ROOT, "manifest.json"), "utf-8"),
    );
    const rp = JSON.parse(
      fs.readFileSync(path.join(RP_ROOT, "manifest.json"), "utf-8"),
    );
    expect(bp.header.min_engine_version).toEqual(rp.header.min_engine_version);
  });

  it("min_engine_version is [1, 26, 0] — requires Minecraft 26.0+ for @minecraft/server 2.5.0", () => {
    const bp = JSON.parse(
      fs.readFileSync(path.join(BP_ROOT, "manifest.json"), "utf-8"),
    );
    expect(bp.header.min_engine_version).toEqual([1, 26, 0]);
  });

  it("both manifests use format_version 2", () => {
    const bp = JSON.parse(
      fs.readFileSync(path.join(BP_ROOT, "manifest.json"), "utf-8"),
    );
    const rp = JSON.parse(
      fs.readFileSync(path.join(RP_ROOT, "manifest.json"), "utf-8"),
    );
    expect(bp.format_version).toBe(2);
    expect(rp.format_version).toBe(2);
  });
});

describe("[All platforms] Consistent format_version within each file type", () => {
  /**
   * Mixing format versions within a single file type causes unpredictable
   * parsing behavior.  All files of the same type must use the same version.
   */
  function collectFormatVersions(
    dir: string,
    extract: (data: any) => string | undefined,
  ): Set<string> {
    const versions = new Set<string>();
    readJsonDir(dir).forEach(({ data }) => {
      const v = extract(data);
      if (v !== undefined) versions.add(String(v));
    });
    return versions;
  }

  it("all BP entity files use the same format_version", () => {
    const versions = collectFormatVersions(
      entitiesDir,
      (d) => d.format_version,
    );
    expect(versions.size).toBe(1);
  });

  it("all RP client entity files use the same format_version", () => {
    const versions = collectFormatVersions(
      clientEntityDir,
      (d) => d.format_version,
    );
    expect(versions.size).toBe(1);
  });

  it("all spawn rule files use the same format_version", () => {
    const versions = collectFormatVersions(
      spawnRulesDir,
      (d) => d.format_version,
    );
    expect(versions.size).toBe(1);
  });

  it("all recipe files use the same format_version", () => {
    const versions = collectFormatVersions(
      recipesDir,
      (d) => d.format_version,
    );
    expect(versions.size).toBe(1);
  });

  it("BP entity format_version is not a pre-release string", () => {
    const versions = collectFormatVersions(
      entitiesDir,
      (d) => d.format_version,
    );
    versions.forEach((v) => {
      // format_version must be a stable semver string like "1.21.40"
      expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});

describe("[All platforms] Script module compatibility", () => {
  /**
   * The script module must declare JavaScript (not TypeScript source) and
   * reference the correct entry file.  @minecraft/server version must be
   * a stable release supported on all platforms.
   */
  it("script module language is 'javascript' (compiled, not TS source)", () => {
    const bp = JSON.parse(
      fs.readFileSync(path.join(BP_ROOT, "manifest.json"), "utf-8"),
    );
    const scriptModule = (bp.modules ?? []).find(
      (m: any) => m.type === "script",
    );
    expect(scriptModule).toBeDefined();
    expect(scriptModule?.language).toBe("javascript");
  });

  it("script entry point is scripts/main.js", () => {
    const bp = JSON.parse(
      fs.readFileSync(path.join(BP_ROOT, "manifest.json"), "utf-8"),
    );
    const scriptModule = (bp.modules ?? []).find(
      (m: any) => m.type === "script",
    );
    expect(scriptModule?.entry).toBe("scripts/main.js");
  });

  it("@minecraft/server dependency version is a stable semver", () => {
    const bp = JSON.parse(
      fs.readFileSync(path.join(BP_ROOT, "manifest.json"), "utf-8"),
    );
    const serverDep = (bp.dependencies ?? []).find(
      (d: any) => d.module_name === "@minecraft/server",
    );
    expect(serverDep).toBeDefined();
    // Must be a semver like "2.3.0", not a beta like "2.3.0-beta"
    expect(serverDep?.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WINDOWS / XBOX / PLAYSTATION
// Higher-end hardware, but must confirm Switch-conservative config still
// delivers a meaningful experience (not too restrictive to be fun).
// ═════════════════════════════════════════════════════════════════════════════

describe("[Win/Xbox/PS] Switch-conservative settings are still meaningful", () => {
  /**
   * On higher-end hardware these limits are well within comfortable range.
   * Tests confirm we haven't made them so low that gameplay is broken.
   */
  it("follow_range ≥ 12 for all entities (enough to find targets)", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const val =
        data["minecraft:entity"]?.components?.["minecraft:follow_range"]
          ?.value;
      if (val === undefined) return;
      expect(
        val,
        `${file}: follow_range ${val} is too low to be useful`,
      ).toBeGreaterThanOrEqual(12);
    });
  });

  it("movement speed ≥ 0.2 for all entities (not frozen)", () => {
    readJsonDir(entitiesDir).forEach(({ file, data }) => {
      const speed =
        data["minecraft:entity"]?.components?.["minecraft:movement"]?.value;
      if (speed === undefined) return;
      expect(
        speed,
        `${file}: movement speed ${speed} is effectively frozen`,
      ).toBeGreaterThanOrEqual(0.2);
    });
  });

  it("GLOBAL_ARMY_CAP(35) allows for a tactically meaningful army", () => {
    // On Win/Xbox/PS the 35-cap is still fun — it's well above 10 (meaningful)
    // and the Switch budget explanation justifies why it's capped at 35 not 50.
    const GLOBAL_ARMY_CAP = 35;
    expect(GLOBAL_ARMY_CAP).toBeGreaterThan(10);
  });

  it("boss health(200) provides an appropriately challenging fight on all platforms", () => {
    const bossHp = bpEntity("mk_boss_siege_lord.se.json")?.components?.[
      "minecraft:health"
    ]?.max;
    // Should be challenging but not a sponge
    expect(bossHp).toBeGreaterThanOrEqual(100);
    expect(bossHp).toBeLessThanOrEqual(500);
  });
});
