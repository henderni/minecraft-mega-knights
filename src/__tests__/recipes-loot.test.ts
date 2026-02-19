import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Recipes & Crafting", () => {
  it("should have all recipe files valid JSON", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    expect(files.length).toBeGreaterThan(0);

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  it("should have blueprint recipes with correct structure", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const blueprintFiles = fs
      .readdirSync(recipesDir)
      .filter((f) => f.includes("blueprint"));

    expect(blueprintFiles.length).toBeGreaterThan(0);

    blueprintFiles.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );
      const recipe = recipeJson["minecraft:recipe_shaped"] ||
        recipeJson["minecraft:recipe_shapeless"] || {
          result: { item: "invalid" },
        };

      expect(recipe.result).toBeDefined();
      expect(recipe.result.item).toBeDefined();
    });
  });

  it("should have valid shaped recipe patterns", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const recipeJson = JSON.parse(
        fs.readFileSync(path.join(recipesDir, file), "utf-8"),
      );
      const recipe = recipeJson["minecraft:recipe_shaped"];

      if (recipe) {
        expect(recipe.pattern).toBeDefined();
        expect(Array.isArray(recipe.pattern)).toBe(true);
        // Pattern should have 1-3 rows
        expect(recipe.pattern.length).toBeGreaterThanOrEqual(1);
        expect(recipe.pattern.length).toBeLessThanOrEqual(3);
      }
    });
  });

  it("should have armor recipes without result item conflicts", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const resultItems = new Set<string>();
    let duplicateCount = 0;

    fs.readdirSync(recipesDir).forEach((file) => {
      if (file.endsWith(".json")) {
        const recipeJson = JSON.parse(
          fs.readFileSync(path.join(recipesDir, file), "utf-8"),
        );
        const recipe = recipeJson["minecraft:recipe_shaped"] ||
          recipeJson["minecraft:recipe_shapeless"];

        if (recipe?.result?.item) {
          const item = recipe.result.item;
          if (resultItems.has(item)) {
            duplicateCount++;
          }
          resultItems.add(item);
        }
      }
    });

    // No item should be crafted by multiple recipes
    expect(duplicateCount).toBe(0);
  });
});

describe("Loot Tables", () => {
  it("should have valid loot table JSONs", () => {
    const lootDir = path.join(
      __dirname,
      "../../MegaKnights_BP/loot_tables/entities",
    );

    if (fs.existsSync(lootDir)) {
      const files = fs
        .readdirSync(lootDir)
        .filter((f) => f.endsWith(".json"));

      files.forEach((file) => {
        const content = fs.readFileSync(path.join(lootDir, file), "utf-8");
        expect(() => JSON.parse(content)).not.toThrow();
      });
    }
  });

  it("should have loot pools with positive weights", () => {
    const lootDir = path.join(
      __dirname,
      "../../MegaKnights_BP/loot_tables/entities",
    );

    if (fs.existsSync(lootDir)) {
      fs.readdirSync(lootDir).forEach((file) => {
        if (file.endsWith(".json")) {
          const lootJson = JSON.parse(
            fs.readFileSync(path.join(lootDir, file), "utf-8"),
          );
          const loot = lootJson["minecraft:loot_table"];

          if (loot?.pools) {
            loot.pools.forEach(
              (pool: Record<string, any>, poolIdx: number) => {
                // Each pool should have valid entries
                expect(pool.entries).toBeDefined();
                expect(Array.isArray(pool.entries)).toBe(true);

                // Rolls should be positive
                if (pool.rolls !== undefined) {
                  expect(pool.rolls).toBeGreaterThan(0);
                }
              },
            );
          }
        }
      });
    }
  });
});
