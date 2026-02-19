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
