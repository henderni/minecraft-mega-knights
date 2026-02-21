import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const readSource = (relPath: string) =>
  readFileSync(join(__dirname, "..", relPath), "utf-8");

const armySrc = readSource("systems/ArmySystem.ts");

// ─── Exported constants & functions (source-as-text) ────────────────────────

describe("ArmySystem: sanitizePlayerTag", () => {
  it("is exported as a function", () => {
    expect(armySrc).toMatch(/export\s+function\s+sanitizePlayerTag/);
  });

  it("replaces non-alphanumeric characters (except underscore/hyphen) with underscores", () => {
    expect(armySrc).toContain('replace(/[^a-zA-Z0-9_-]/g, "_")');
  });

  it("uses tagCache for memoization", () => {
    expect(armySrc).toContain("tagCache.get(name)");
    expect(armySrc).toContain("tagCache.set(name,");
  });
});

describe("ArmySystem: getOwnerTag", () => {
  it("is exported as a function", () => {
    expect(armySrc).toMatch(/export\s+function\s+getOwnerTag/);
  });

  it("prefixes with mk_owner_", () => {
    expect(armySrc).toContain("`mk_owner_${");
  });

  it("uses ownerTagCache for memoization", () => {
    expect(armySrc).toContain("ownerTagCache.get(name)");
    expect(armySrc).toContain("ownerTagCache.set(name,");
  });
});

describe("ArmySystem: GLOBAL_ARMY_CAP", () => {
  it("is 35 (budget: 35 allies + 25 siege = 60)", () => {
    expect(armySrc).toMatch(/export\s+const\s+GLOBAL_ARMY_CAP\s*=\s*35/);
  });
});

// ─── Source-as-text behavioral tests ────────────────────────────────────────

describe("ArmySystem: recruitAlly behavior", () => {
  it("checks player.isValid before recruitment", () => {
    expect(armySrc).toContain("if (!player.isValid)");
  });

  it("maps enemy type to ally type via string replace", () => {
    expect(armySrc).toMatch(/replace\(["']_enemy_["'],\s*["']_ally_["']\)/);
  });

  it("checks army cap before spawning", () => {
    const recruitIdx = armySrc.indexOf("recruitAlly(");
    const capCheckIdx = armySrc.indexOf("if (actualCount >= effectiveCap)", recruitIdx);
    expect(capCheckIdx).toBeGreaterThan(recruitIdx);
  });

  it("sends ARMY_FULL when at capacity", () => {
    expect(armySrc).toContain("ARMY_FULL");
  });

  it("sends ARMY_FULL_SHARED in multiplayer when global cap limits", () => {
    expect(armySrc).toContain("ARMY_FULL_SHARED");
  });

  it("computes effectiveCap with multiplayer scaling", () => {
    expect(armySrc).toMatch(/Math\.floor\(GLOBAL_ARMY_CAP\s*\/\s*playerCount\)/);
  });

  it("spawns ally and sets mk_army tag + owner tag", () => {
    expect(armySrc).toContain('ally.addTag("mk_army")');
    expect(armySrc).toContain("ally.addTag(ownerTag)");
  });

  it("sets mk:owner_name dynamic property on spawned ally", () => {
    expect(armySrc).toContain('ally.setDynamicProperty("mk:owner_name"');
  });

  it("generates procedural name via generateAllyName", () => {
    expect(armySrc).toContain("generateAllyName(allyTypeId)");
  });

  it("uses numProp guard for dynamic property reads", () => {
    expect(armySrc).toMatch(/numProp\(.*getDynamicProperty/);
  });
});

describe("ArmySystem: getMaxArmySize", () => {
  it("computes base + min(bonus, MAX_ARMY_BONUS)", () => {
    expect(armySrc).toMatch(/BASE_ARMY_SIZE\s*\+\s*Math\.min\(bonus,\s*MAX_ARMY_BONUS\)/);
  });

  it("BASE_ARMY_SIZE is 15", () => {
    expect(armySrc).toMatch(/BASE_ARMY_SIZE\s*=\s*15/);
  });

  it("MAX_ARMY_BONUS is 20", () => {
    expect(armySrc).toMatch(/MAX_ARMY_BONUS\s*=\s*20/);
  });
});

describe("ArmySystem: ALLY_DISPLAY_NAMES", () => {
  const expectedTypes = [
    "mk:mk_ally_knight",
    "mk:mk_ally_archer",
    "mk:mk_ally_wizard",
    "mk:mk_ally_dark_knight",
    "mk:mk_ally_standard_bearer",
  ];

  for (const typeId of expectedTypes) {
    it(`includes ${typeId}`, () => {
      expect(armySrc).toContain(`"${typeId}"`);
    });
  }
});

describe("ArmySystem: death listener", () => {
  it("subscribes to entityDie event", () => {
    expect(armySrc).toContain("entityDie.subscribe");
  });

  it("checks mk_army tag on dead entity", () => {
    expect(armySrc).toContain('dead.hasTag("mk_army")');
  });

  it("decrements mk:army_size on owner player", () => {
    expect(armySrc).toContain('player.setDynamicProperty("mk:army_size", current - 1)');
  });

  it("sends ALLY_DIED message to owner", () => {
    expect(armySrc).toContain("ALLY_DIED");
  });
});

describe("ArmySystem: tick recount", () => {
  it("refreshes cachedPlayerMap from getAllPlayers", () => {
    expect(armySrc).toContain("cachedPlayerMap.clear()");
    expect(armySrc).toContain("world.getAllPlayers()");
  });

  it("applies Standard Bearer aura within 8 blocks (64 squared dist)", () => {
    expect(armySrc).toContain("mk:mk_ally_standard_bearer");
    expect(armySrc).toContain("<= 64");
  });

  it("wraps entity dimension query in try-catch", () => {
    const tickIdx = armySrc.indexOf("tick(): void");
    const tryCatchIdx = armySrc.indexOf("try {", tickIdx + 50);
    expect(tryCatchIdx).toBeGreaterThan(tickIdx);
  });
});

describe("ArmySystem: addTroopBonus", () => {
  it("clamps accumulated bonus to MAX_ARMY_BONUS", () => {
    expect(armySrc).toMatch(/Math\.min\(current\s*\+\s*bonus,\s*MAX_ARMY_BONUS\)/);
  });

  it("persists to mk:army_bonus dynamic property", () => {
    expect(armySrc).toContain('player.setDynamicProperty("mk:army_bonus"');
  });
});

describe("ArmySystem: tag cache", () => {
  it("limits tag cache size to MAX_TAG_CACHE", () => {
    expect(armySrc).toMatch(/MAX_TAG_CACHE\s*=\s*100/);
  });

  it("clears cache when size exceeds limit", () => {
    expect(armySrc).toContain("tagCache.clear()");
  });
});
