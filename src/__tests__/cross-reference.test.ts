import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";

const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");
const entitiesDir = path.join(BP_ROOT, "entities");
const recipesDir = path.join(BP_ROOT, "recipes");
const itemsArmorDir = path.join(BP_ROOT, "items/armor");
const itemsToolsDir = path.join(BP_ROOT, "items/tools");

// Build a set of all item identifiers defined in BP items/
function getAllDefinedItemIds(): Set<string> {
  const ids = new Set<string>();
  [itemsArmorDir, itemsToolsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .forEach((file) => {
        const item = JSON.parse(
          fs.readFileSync(path.join(dir, file), "utf-8"),
        );
        const id = item["minecraft:item"]?.description?.identifier;
        if (id) ids.add(id);
      });
  });
  return ids;
}

describe("Entity loot table cross-reference", () => {
  it("loot table paths in entities should point to existing files", () => {
    const entityFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    entityFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const lootPath =
        entityJson["minecraft:entity"]?.components?.["minecraft:loot"]?.table;

      if (lootPath) {
        const fullPath = path.join(BP_ROOT, lootPath);
        expect(
          fs.existsSync(fullPath),
          `${file} references loot table "${lootPath}" which does not exist`,
        ).toBe(true);
      }
    });
  });

  it("every enemy entity should have a loot table", () => {
    const enemyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("enemy") && f.endsWith(".json"));

    enemyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const lootPath =
        entityJson["minecraft:entity"]?.components?.["minecraft:loot"]?.table;

      expect(
        lootPath,
        `Enemy entity ${file} should have a loot table`,
      ).toBeDefined();
    });
  });
});

describe("Wave definition entity cross-reference", () => {
  it("all entity IDs in wave definitions should have entity files on disk", () => {
    const entityFileNames = new Set(
      fs.readdirSync(entitiesDir).filter((f) => f.endsWith(".json")),
    );

    WAVE_DEFINITIONS.forEach((wave) => {
      wave.spawns.forEach((spawn) => {
        // mk:mk_enemy_knight -> mk_enemy_knight.se.json
        const idPart = spawn.entityId.replace(/^mk:/, "");
        const expectedFile = `${idPart}.se.json`;
        expect(
          entityFileNames.has(expectedFile),
          `Wave ${wave.waveNumber} references "${spawn.entityId}" but "${expectedFile}" does not exist`,
        ).toBe(true);
      });
    });
  });
});

describe("Shaped recipe key completeness", () => {
  it("every pattern character should have a corresponding key entry", () => {
    const recipeFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    recipeFiles.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );
      const shaped = recipeJson["minecraft:recipe_shaped"];
      if (!shaped?.pattern || !shaped?.key) return;

      const usedChars = new Set<string>();
      shaped.pattern.forEach((row: string) => {
        row.split("").forEach((ch: string) => {
          if (ch !== " ") usedChars.add(ch);
        });
      });

      usedChars.forEach((ch) => {
        expect(
          shaped.key[ch],
          `Recipe ${file}: pattern uses key "${ch}" but it is not defined in the key map`,
        ).toBeDefined();
      });
    });
  });

  it("no unused keys should be defined in shaped recipes", () => {
    const recipeFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    recipeFiles.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );
      const shaped = recipeJson["minecraft:recipe_shaped"];
      if (!shaped?.pattern || !shaped?.key) return;

      const usedChars = new Set<string>();
      shaped.pattern.forEach((row: string) => {
        row.split("").forEach((ch: string) => {
          if (ch !== " ") usedChars.add(ch);
        });
      });

      Object.keys(shaped.key).forEach((definedKey) => {
        expect(
          usedChars.has(definedKey),
          `Recipe ${file}: key "${definedKey}" is defined but never used in the pattern`,
        ).toBe(true);
      });
    });
  });
});

describe("Recipe result item cross-reference", () => {
  it("mk: result items should have corresponding item definition files", () => {
    const definedIds = getAllDefinedItemIds();

    const recipeFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    recipeFiles.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );

      const result =
        recipeJson["minecraft:recipe_shaped"]?.result ||
        recipeJson["minecraft:recipe_shapeless"]?.result;

      if (!result) return;

      const resultId: string =
        typeof result === "string" ? result : result.item;
      if (!resultId?.startsWith("mk:")) return;

      expect(
        definedIds.has(resultId),
        `Recipe ${file} produces "${resultId}" but no item definition file found for it`,
      ).toBe(true);
    });
  });

  it("shaped recipe key items should be valid namespace items", () => {
    const recipeFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    recipeFiles.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );
      const shaped = recipeJson["minecraft:recipe_shaped"];
      if (!shaped?.key) return;

      Object.entries(shaped.key).forEach(([keyChar, entry]: [string, any]) => {
        const itemId: string | undefined = entry?.item || entry?.tag;
        expect(
          itemId,
          `Recipe ${file}: key "${keyChar}" has no item or tag field`,
        ).toBeDefined();
        if (itemId) {
          expect(
            itemId,
            `Recipe ${file}: key "${keyChar}" item "${itemId}" has no namespace`,
          ).toMatch(/^[a-z_]+:/);
        }
      });
    });
  });
});

describe("Recipe crafting table tag", () => {
  it("all recipes should specify a crafting station tag", () => {
    const recipeFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    recipeFiles.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );
      const recipe =
        recipeJson["minecraft:recipe_shaped"] ||
        recipeJson["minecraft:recipe_shapeless"];

      if (!recipe) return;

      expect(
        recipe.tags,
        `Recipe ${file} should have a tags array`,
      ).toBeDefined();
      expect(
        Array.isArray(recipe.tags) && recipe.tags.length > 0,
        `Recipe ${file} should have at least one tag`,
      ).toBe(true);
    });
  });

  it("all recipes should be craftable at the crafting_table", () => {
    const recipeFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    recipeFiles.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );
      const recipe =
        recipeJson["minecraft:recipe_shaped"] ||
        recipeJson["minecraft:recipe_shapeless"];

      if (!recipe?.tags) return;

      expect(
        recipe.tags,
        `Recipe ${file} should include "crafting_table" tag`,
      ).toContain("crafting_table");
    });
  });
});

describe("Item texture atlas cross-reference", () => {
  const atlasPath = path.join(__dirname, "../../MegaKnights_RP/textures/item_texture.json");
  const texturesDir = path.join(__dirname, "../../MegaKnights_RP/textures/items");

  it("item_texture.json exists", () => {
    expect(fs.existsSync(atlasPath)).toBe(true);
  });

  it("every icon key in item_texture.json points to an existing PNG", () => {
    const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf-8"));
    const entries = atlas["texture_data"] as Record<string, { textures: string }>;
    Object.entries(entries).forEach(([key, entry]) => {
      const texPath = entry.textures;
      // textures value is e.g. "textures/items/mk_page_helmet" — PNG exists in RP
      const pngPath = path.join(__dirname, "../../MegaKnights_RP", `${texPath}.png`);
      expect(
        fs.existsSync(pngPath),
        `Atlas key "${key}" references "${texPath}" but "${texPath}.png" not found`,
      ).toBe(true);
    });
  });

  it("every mk: item's icon component is registered in item_texture.json", () => {
    const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf-8"));
    const atlasKeys = new Set(Object.keys(atlas["texture_data"]));
    const dirs = [itemsArmorDir, itemsToolsDir];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).filter((f) => f.endsWith(".json")).forEach((file) => {
        const item = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
        const iconKey: string | undefined = item["minecraft:item"]?.components?.["minecraft:icon"];
        if (!iconKey) return;
        expect(
          atlasKeys.has(iconKey),
          `Item ${file} uses icon "${iconKey}" which is not in item_texture.json`,
        ).toBe(true);
      });
    });
  });
});
