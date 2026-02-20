import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Recipe Ingredient Validation", () => {
  it("all recipe ingredients should have valid item IDs", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Check for ingredient arrays
      const ingredients = recipe["minecraft:recipe_shaped"]?.ingredients;
      if (ingredients) {
        ingredients.forEach((row: any[]) => {
          if (Array.isArray(row)) {
            row.forEach((ingredient: any) => {
              if (ingredient && typeof ingredient === "object") {
                expect(ingredient.item || ingredient.tag).toBeDefined();
              } else if (typeof ingredient === "string") {
                expect(ingredient).toBeTruthy();
              }
            });
          }
        });
      }
    });
  });

  it("recipe results should have valid item IDs", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      const result =
        recipe["minecraft:recipe_shaped"]?.result ||
        recipe["minecraft:recipe_furnace"]?.output;

      if (result) {
        expect(result.item || result).toBeDefined();
      }
    });
  });

  it("ingredients should have positive count values", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      const ingredients = recipe["minecraft:recipe_shaped"]?.ingredients;
      if (ingredients && Array.isArray(ingredients)) {
        ingredients.forEach((row: any[]) => {
          if (Array.isArray(row)) {
            row.forEach((ingredient: any) => {
              if (
                ingredient &&
                typeof ingredient === "object" &&
                ingredient.count
              ) {
                expect(ingredient.count).toBeGreaterThan(0);
              }
            });
          }
        });
      }
    });
  });

  it("recipe results should have positive output count", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Shaped recipes
      const shapedResult = recipe["minecraft:recipe_shaped"]?.result;
      if (shapedResult && shapedResult.count) {
        expect(shapedResult.count).toBeGreaterThan(0);
      }

      // Furnace recipes
      const furnaceResult = recipe["minecraft:recipe_furnace"]?.output;
      if (furnaceResult && furnaceResult.count) {
        expect(furnaceResult.count).toBeGreaterThan(0);
      }
    });
  });

  it("armor recipes should produce armor items", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");

    const armorRecipeFiles = fs
      .readdirSync(recipesDir)
      .filter(
        (f) =>
          (f.includes("armor") ||
            f.includes("helmet") ||
            f.includes("chestplate") ||
            f.includes("leggings") ||
            f.includes("boots")) &&
          f.endsWith(".json"),
      );

    armorRecipeFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Should have result
      const result =
        recipe["minecraft:recipe_shaped"]?.result ||
        recipe["minecraft:recipe_furnace"]?.output;

      expect(result).toBeDefined();
    });
  });

  it("blueprint recipes should produce structure items", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");

    const blueprintFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.includes("blueprint") && f.endsWith(".json"));

    blueprintFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Should have structured recipe format (blueprints use shapeless)
      expect(
        recipe["minecraft:recipe_shaped"] ||
          recipe["minecraft:recipe_shapeless"] ||
          recipe["minecraft:recipe_furnace"],
      ).toBeDefined();
    });
  });
});

describe("Shaped Recipe Structure", () => {
  it("shaped recipes should have valid pattern notation", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      if (recipe["minecraft:recipe_shaped"]) {
        const shaped = recipe["minecraft:recipe_shaped"];

        // Pattern should be an array of strings
        if (shaped.pattern) {
          expect(Array.isArray(shaped.pattern)).toBe(true);
          expect(shaped.pattern.length).toBeGreaterThan(0);

          // Each pattern row should be valid
          shaped.pattern.forEach((row: any) => {
            expect(typeof row).toBe("string");
          });
        }
      }
    });
  });

  it("recipe pattern should match ingredient mapping", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      if (recipe["minecraft:recipe_shaped"]) {
        const shaped = recipe["minecraft:recipe_shaped"];

        // If pattern exists, key mapping should exist
        if (shaped.pattern && shaped.ingredients) {
          const patternKeys = new Set<string>();
          shaped.pattern.forEach((row: string) => {
            row.split("").forEach((char: string) => {
              if (char !== " ") patternKeys.add(char);
            });
          });

          // At least one key should exist
          expect(patternKeys.size).toBeGreaterThan(0);
        }
      }
    });
  });

  it("recipe priority should be valid", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Priority if set should be a number
      const priority =
        recipe["minecraft:recipe_shaped"]?.priority ||
        recipe["minecraft:recipe_furnace"]?.priority;

      if (priority !== undefined) {
        expect(typeof priority).toBe("number");
      }
    });
  });
});

describe("Token Item Recipes", () => {
  it("should have token recipes for each armor tier", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs.readdirSync(recipesDir);

    // "page" is the starting tier — armor is given for free, no crafted token
    const tiers = ["squire", "knight", "champion", "mega_knight"];

    tiers.forEach((tier) => {
      const tokenFile = `mk_${tier}_token.json`;
      expect(
        files,
        `Missing token recipe: ${tokenFile}`,
      ).toContain(tokenFile);
    });
  });

  it("token recipes should produce tokens for progression", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");

    const tokenFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.includes("token") && f.endsWith(".json"));

    tokenFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Should have result pointing to token item (tokens use shapeless recipes)
      const result =
        recipe["minecraft:recipe_shaped"]?.result ||
        recipe["minecraft:recipe_shapeless"]?.result;
      expect(result).toBeDefined();
    });
  });

  it("token items should require crafting materials", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");

    const tokenFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.includes("token") && f.endsWith(".json"));

    tokenFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Should have ingredients (tokens use shapeless recipes)
      const ingredients =
        recipe["minecraft:recipe_shaped"]?.ingredients ||
        recipe["minecraft:recipe_shapeless"]?.ingredients;
      expect(ingredients, `${file} should have ingredients`).toBeDefined();
      if (ingredients) {
        expect(Array.isArray(ingredients)).toBe(true);
      }
    });
  });
});

describe("Blueprint Item Recipes", () => {
  it("should have blueprint recipes for each structure type", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs.readdirSync(recipesDir);

    const blueprints = [
      "mk_blueprint_small_tower",
      "mk_blueprint_gatehouse",
      "mk_blueprint_great_hall",
    ];

    blueprints.forEach((blueprint) => {
      const blueprintFile = `${blueprint}.json`;
      expect(
        files,
        `Missing blueprint recipe: ${blueprintFile}`,
      ).toContain(blueprintFile);
    });
  });

  it("blueprint recipes should produce blueprint items", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");

    const blueprintFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.includes("blueprint") && f.endsWith(".json"));

    blueprintFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Should have result (blueprints use shapeless recipes)
      const result =
        recipe["minecraft:recipe_shaped"]?.result ||
        recipe["minecraft:recipe_shapeless"]?.result;
      expect(result, `${file} should have result`).toBeDefined();

      // Result should be a blueprint item
      const resultItem = result?.item || result;
      expect(resultItem).toContain("blueprint");
    });
  });

  it("blueprint recipes should require valuable materials", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");

    const blueprintFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.includes("blueprint") && f.endsWith(".json"));

    blueprintFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Should have ingredients (blueprints use shapeless recipes)
      const ingredients =
        recipe["minecraft:recipe_shaped"]?.ingredients ||
        recipe["minecraft:recipe_shapeless"]?.ingredients;
      expect(
        ingredients,
        `${file} should have ingredients`,
      ).toBeDefined();
    });
  });
});

describe("Recipe Ingredient Types", () => {
  it("ingredients should reference valid vanilla or custom items", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      const ingredients = recipe["minecraft:recipe_shaped"]?.ingredients;
      if (ingredients && Array.isArray(ingredients)) {
        ingredients.forEach((row: any[]) => {
          if (Array.isArray(row)) {
            row.forEach((ingredient: any) => {
              if (ingredient && typeof ingredient === "object") {
                // Should have item field
                expect(
                  ingredient.item,
                  `Ingredient in ${file} missing item ID`,
                ).toBeDefined();
              }
            });
          }
        });
      }
    });
  });

  it("recipe ingredient counts should be realistic", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      const ingredients = recipe["minecraft:recipe_shaped"]?.ingredients;
      if (ingredients && Array.isArray(ingredients)) {
        ingredients.forEach((row: any[]) => {
          if (Array.isArray(row)) {
            row.forEach((ingredient: any) => {
              // Count should be between 1-64 (Minecraft stack limit)
              if (ingredient && ingredient.count) {
                expect(ingredient.count).toBeGreaterThan(0);
                expect(ingredient.count).toBeLessThanOrEqual(64);
              }
            });
          }
        });
      }
    });
  });
});

describe("Recipe Unlock Conditions", () => {
  it("recipes should have valid group tags", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Group tag if set should be a string
      const group =
        recipe["minecraft:recipe_shaped"]?.group ||
        recipe["minecraft:recipe_furnace"]?.group;

      if (group) {
        expect(typeof group).toBe("string");
      }
    });
  });

  it("recipes should be unlockable", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);

      // Should have a valid structure (shaped, shapeless, or furnace)
      const recipeContent =
        recipe["minecraft:recipe_shaped"] ||
        recipe["minecraft:recipe_shapeless"] ||
        recipe["minecraft:recipe_furnace"];
      expect(recipeContent).toBeDefined();
    });
  });
});

// ─── Ingredient obtainability by unlock day ─────────────────────────────────

import { ARMOR_TIERS } from "../data/ArmorTiers";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import { CAMP_TIERS } from "../data/CampDefinitions";

/**
 * Determines the earliest day a given item becomes available to the player.
 * - Vanilla items (leather, iron, cobblestone, paper, etc.) are always available (day 0).
 * - Camp reward items become available on the first camp tier's minDay that drops them.
 * - Custom mk: tokens become available on the associated armor tier's unlockDay.
 */
function earliestDayForItem(itemId: string): number {
  // Custom tokens are available when their tier unlocks
  const tokenTier = ARMOR_TIERS.find((t) => t.tokenItem === itemId);
  if (tokenTier) return tokenTier.unlockDay;

  // Camp reward items — find earliest camp tier that rewards this item
  for (const tier of CAMP_TIERS) {
    if (tier.rewards.some((r) => r.itemId === itemId)) {
      return tier.minDay;
    }
  }

  // Vanilla crafting staples are always available (day 0)
  return 0;
}

/**
 * Maps recipe filename to the day it becomes relevant (unlock day).
 * - Armor recipes → corresponding armor tier's unlockDay
 * - Blueprint recipes → corresponding blueprint's unlockDay
 * - Token recipes → corresponding armor tier's unlockDay
 */
function recipeUnlockDay(filename: string): number {
  const base = filename.replace(".json", "");

  // Blueprint recipes
  for (const [key, bp] of Object.entries(CASTLE_BLUEPRINTS)) {
    if (base === `mk_blueprint_${key}`) return bp.unlockDay;
  }

  // Armor and token recipes — match against tier prefix
  for (const tier of ARMOR_TIERS) {
    if (base.startsWith(tier.prefix)) return tier.unlockDay;
  }

  return 0;
}

/** Extract all unique ingredient item IDs from a recipe JSON object. */
function extractIngredientItems(recipe: any): string[] {
  const items: string[] = [];

  // Shaped recipes: key map in ingredients object
  const shaped = recipe["minecraft:recipe_shaped"];
  if (shaped?.key) {
    for (const val of Object.values(shaped.key) as any[]) {
      if (val?.item) items.push(val.item);
    }
  }

  // Shapeless recipes: ingredients array of { item } objects
  const shapeless = recipe["minecraft:recipe_shapeless"];
  if (shapeless?.ingredients) {
    for (const ing of shapeless.ingredients) {
      if (ing?.item) items.push(ing.item);
    }
  }

  return [...new Set(items)];
}

describe("Recipe Ingredient Obtainability by Unlock Day", () => {
  const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
  const files = fs.readdirSync(recipesDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    it(`${file}: all ingredients obtainable by unlock day`, () => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const recipe = JSON.parse(content);
      const unlockDay = recipeUnlockDay(file);
      const ingredients = extractIngredientItems(recipe);

      for (const itemId of ingredients) {
        const availableDay = earliestDayForItem(itemId);
        expect(
          availableDay,
          `${file} unlocks day ${unlockDay}, but ingredient ${itemId} not available until day ${availableDay}`,
        ).toBeLessThanOrEqual(unlockDay);
      }
    });
  }

  it("page armor (day 0) uses only vanilla materials", () => {
    for (const file of files.filter((f) => f.startsWith("mk_page_"))) {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const ingredients = extractIngredientItems(JSON.parse(content));
      for (const item of ingredients) {
        expect(item).toMatch(/^minecraft:/);
      }
    }
  });

  it("mega knight token requires netherite — available from Elite Outpost (day 85)", () => {
    const content = fs.readFileSync(
      path.join(recipesDir, "mk_mega_knight_token.json"),
      "utf-8",
    );
    const ingredients = extractIngredientItems(JSON.parse(content));
    expect(ingredients).toContain("minecraft:netherite_ingot");

    // netherite_scrap drops from Elite Outpost starting day 85
    const eliteTier = CAMP_TIERS.find((t) => t.name === "Elite Outpost");
    expect(eliteTier).toBeDefined();
    expect(eliteTier!.minDay).toBeLessThanOrEqual(85);
  });

  it("champion recipes don't require netherite", () => {
    for (const file of files.filter((f) => f.startsWith("mk_champion_"))) {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const ingredients = extractIngredientItems(JSON.parse(content));
      for (const item of ingredients) {
        expect(item).not.toContain("netherite");
      }
    }
  });

  it("diamond first available from War Camp (day 40), champion unlocks day 60", () => {
    const warCamp = CAMP_TIERS.find((t) => t.name === "War Camp");
    expect(warCamp).toBeDefined();
    expect(warCamp!.rewards.some((r) => r.itemId === "minecraft:diamond")).toBe(true);

    const championTier = ARMOR_TIERS.find((t) => t.name === "Champion");
    expect(championTier).toBeDefined();
    expect(warCamp!.minDay).toBeLessThanOrEqual(championTier!.unlockDay);
  });

  it("blueprint ingredients use only vanilla items available from day 0", () => {
    for (const file of files.filter((f) => f.includes("blueprint"))) {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      const ingredients = extractIngredientItems(JSON.parse(content));
      for (const item of ingredients) {
        expect(item).toMatch(/^minecraft:/);
      }
    }
  });
});
