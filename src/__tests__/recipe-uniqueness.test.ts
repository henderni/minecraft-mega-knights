/**
 * recipe-uniqueness.test.ts
 *
 * Validates all recipe JSON files in MegaKnights_BP/recipes/:
 * - All files parse as valid JSON
 * - All recipes have required format_version and type fields
 * - No two shapeless recipes share identical sorted ingredient lists
 *   (duplicate ingredients cause one recipe to silently shadow the other in Bedrock)
 * - Regression: blueprint_gatehouse uses cobblestone (not iron_ingot) after the
 *   deduplication fix that separated it from mk_blueprint_small_tower
 * - knight_token still uses iron_ingot (ingredient identity check)
 *
 * Uses JSON validation pattern — no @minecraft/server imports.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

const RECIPES_DIR = resolve(__dirname, "../../MegaKnights_BP/recipes");
const recipeFiles = readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".json"));

// Helper: collect sorted ingredient item list for a shapeless recipe
function getSortedIngredients(recipe: any): string[] {
  const shapeless = recipe["minecraft:recipe_shapeless"];
  if (!shapeless) return [];
  const ingredients: string[] = (shapeless.ingredients ?? []).map(
    (ing: any) => ing.item as string,
  );
  return ingredients.slice().sort();
}

// Helper: return a human-readable key for ingredient list deduplication
function ingredientKey(sortedList: string[]): string {
  return sortedList.join("|");
}

// ─── JSON validity ────────────────────────────────────────────────────────────

describe("Recipe files: JSON validity", () => {
  it("recipe directory is non-empty", () => {
    expect(recipeFiles.length).toBeGreaterThan(0);
  });

  for (const file of recipeFiles) {
    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(resolve(RECIPES_DIR, file), "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── Recipe format fields ─────────────────────────────────────────────────────

describe("Recipe files: required fields", () => {
  for (const file of recipeFiles) {
    const json = JSON.parse(readFileSync(resolve(RECIPES_DIR, file), "utf-8"));

    it(`${file}: has format_version`, () => {
      expect(json.format_version).toBeDefined();
      expect(typeof json.format_version).toBe("string");
    });

    it(`${file}: has exactly one recipe type key`, () => {
      const recipeTypeKeys = Object.keys(json).filter((k) =>
        k.startsWith("minecraft:recipe_"),
      );
      expect(recipeTypeKeys.length).toBe(1);
    });
  }
});

// ─── Shapeless recipe uniqueness ──────────────────────────────────────────────

describe("Recipe files: no duplicate shapeless ingredient lists", () => {
  // Collect all shapeless recipes and their sorted ingredient fingerprints
  const shapelessRecipes: Array<{
    file: string;
    identifier: string;
    key: string;
    ingredients: string[];
  }> = [];

  for (const file of recipeFiles) {
    const json = JSON.parse(readFileSync(resolve(RECIPES_DIR, file), "utf-8"));
    const shapeless = json["minecraft:recipe_shapeless"];
    if (!shapeless) continue;
    const sorted = getSortedIngredients(json);
    shapelessRecipes.push({
      file,
      identifier: shapeless.description?.identifier ?? file,
      key: ingredientKey(sorted),
      ingredients: sorted,
    });
  }

  it("at least one shapeless recipe is found", () => {
    expect(shapelessRecipes.length).toBeGreaterThan(0);
  });

  it("no two shapeless recipes share an identical sorted ingredient list", () => {
    const seen = new Map<string, string>();
    for (const recipe of shapelessRecipes) {
      if (seen.has(recipe.key)) {
        const conflict = seen.get(recipe.key)!;
        throw new Error(
          `Duplicate shapeless ingredients: "${recipe.identifier}" and "${conflict}" both use [${recipe.key}]`,
        );
      }
      seen.set(recipe.key, recipe.identifier);
    }
    // If we got here, all ingredient lists are unique
    expect(seen.size).toBe(shapelessRecipes.length);
  });
});

// ─── Regression: blueprint_gatehouse uses cobblestone ─────────────────────────

describe("Recipe regressions: specific ingredient checks", () => {
  it("mk_blueprint_gatehouse uses cobblestone (not iron_ingot) — deduplication regression guard", () => {
    const json = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_gatehouse.json"), "utf-8"),
    );
    const sorted = getSortedIngredients(json);
    // Must contain cobblestone
    expect(sorted).toContain("minecraft:cobblestone");
    // Must NOT contain iron_ingot (the old duplicate ingredient list)
    expect(sorted).not.toContain("minecraft:iron_ingot");
  });

  it("mk_blueprint_gatehouse has 4 ingredients total (3x cobblestone + 1x paper)", () => {
    const json = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_gatehouse.json"), "utf-8"),
    );
    const sorted = getSortedIngredients(json);
    expect(sorted).toHaveLength(4);
    // 3 cobblestone entries
    expect(sorted.filter((i) => i === "minecraft:cobblestone")).toHaveLength(3);
    // 1 paper entry
    expect(sorted.filter((i) => i === "minecraft:paper")).toHaveLength(1);
  });

  it("mk_blueprint_gatehouse and mk_blueprint_small_tower do NOT share the same ingredient list", () => {
    const gatehouse = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_gatehouse.json"), "utf-8"),
    );
    const smallTower = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_small_tower.json"), "utf-8"),
    );
    const gatehouseKey = ingredientKey(getSortedIngredients(gatehouse));
    const smallTowerKey = ingredientKey(getSortedIngredients(smallTower));
    expect(gatehouseKey).not.toBe(smallTowerKey);
  });

  it("mk_blueprint_small_tower uses stone (3x stone + 1x paper) — cheapest blueprint tier", () => {
    const json = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_small_tower.json"), "utf-8"),
    );
    const sorted = getSortedIngredients(json);
    expect(sorted).toContain("minecraft:stone");
    expect(sorted).not.toContain("minecraft:cobblestone");
    expect(sorted.filter((i) => i === "minecraft:stone")).toHaveLength(3);
    expect(sorted.filter((i) => i === "minecraft:paper")).toHaveLength(1);
  });

  it("blueprint ingredient progression is distinct per tier (stone < cobblestone < gold)", () => {
    // small_tower = 3x stone, gatehouse = 3x cobblestone, great_hall = 3x gold
    const smallTower = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_small_tower.json"), "utf-8"),
    );
    const gatehouse = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_gatehouse.json"), "utf-8"),
    );
    const greatHall = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_blueprint_great_hall.json"), "utf-8"),
    );
    expect(getSortedIngredients(smallTower)).toContain("minecraft:stone");
    expect(getSortedIngredients(gatehouse)).toContain("minecraft:cobblestone");
    expect(getSortedIngredients(greatHall)).toContain("minecraft:gold_ingot");
  });

  it("mk_knight_token still uses iron_ingot", () => {
    const json = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_knight_token.json"), "utf-8"),
    );
    const sorted = getSortedIngredients(json);
    expect(sorted).toContain("minecraft:iron_ingot");
    expect(sorted).not.toContain("minecraft:cobblestone");
  });

  it("mk_knight_token has 4 ingredients total (3x iron_ingot + 1x paper)", () => {
    const json = JSON.parse(
      readFileSync(resolve(RECIPES_DIR, "mk_knight_token.json"), "utf-8"),
    );
    const sorted = getSortedIngredients(json);
    expect(sorted).toHaveLength(4);
    expect(sorted.filter((i) => i === "minecraft:iron_ingot")).toHaveLength(3);
    expect(sorted.filter((i) => i === "minecraft:paper")).toHaveLength(1);
  });
});
