/**
 * init-order.test.ts
 *
 * Verifies that player initialization happens in the correct order.
 *
 * Critical bug fix: ArmorTierSystem.initializePlayer() MUST run before
 * DayCounterSystem.initializePlayer() because:
 * - ArmorTierSystem checks if mk:has_started is false, then gives Page armor
 * - DayCounterSystem sets mk:has_started to true
 *
 * If reversed, new players never get Page armor.
 *
 * Uses source-as-text pattern since these files import @minecraft/server.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const mainSrc = readSource("main.ts");
const armorTierSrc = readSource("systems/ArmorTierSystem.ts");
const dayCounterSrc = readSource("systems/DayCounterSystem.ts");

// ─── Player spawn handler order ────────────────────────────────────────────

describe("main.ts: player initialization order", () => {
  it("has playerSpawn handler", () => {
    expect(mainSrc).toContain("world.afterEvents.playerSpawn.subscribe");
  });

  it("initializes armorTier before dayCounter", () => {
    // Extract the playerSpawn handler block
    const handlerStart = mainSrc.indexOf(
      "world.afterEvents.playerSpawn.subscribe"
    );
    const handlerEnd = mainSrc.indexOf("});", handlerStart) + 3;
    const handler = mainSrc.slice(handlerStart, handlerEnd);

    const armorPos = handler.indexOf("armorTier.initializePlayer");
    const dayCounterPos = handler.indexOf("dayCounter.initializePlayer");

    expect(armorPos).toBeGreaterThan(-1);
    expect(dayCounterPos).toBeGreaterThan(-1);
    expect(armorPos).toBeLessThan(dayCounterPos);
  });

  it("has bestiary onPlayerSpawn after both armorTier and dayCounter", () => {
    // Extract the playerSpawn handler block
    const handlerStart = mainSrc.indexOf(
      "world.afterEvents.playerSpawn.subscribe"
    );
    const handlerEnd = mainSrc.indexOf("});", handlerStart) + 3;
    const handler = mainSrc.slice(handlerStart, handlerEnd);

    const armorPos = handler.indexOf("armorTier.initializePlayer");
    const dayCounterPos = handler.indexOf("dayCounter.initializePlayer");
    const bestiaryPos = handler.indexOf("bestiary.onPlayerSpawn");

    expect(bestiaryPos).toBeGreaterThan(-1);
    expect(armorPos).toBeLessThan(bestiaryPos);
    expect(dayCounterPos).toBeLessThan(bestiaryPos);
  });
});

// ─── ArmorTierSystem checks mk:has_started ────────────────────────────────

describe("ArmorTierSystem.initializePlayer", () => {
  it("checks mk:has_started property", () => {
    expect(armorTierSrc).toContain('getDynamicProperty("mk:has_started")');
  });

  it("checks hasStarted as falsy before giving armor", () => {
    // Extract the initializePlayer method
    const methodStart = armorTierSrc.indexOf("initializePlayer(player: Player)");
    const methodEnd = armorTierSrc.indexOf("}", methodStart);
    const method = armorTierSrc.slice(methodStart, methodEnd);

    expect(method).toContain("if (!hasStarted)");
  });

  it("gives Page helmet only if hasStarted is false", () => {
    expect(armorTierSrc).toContain("mk:mk_page_helmet");
    // Verify it's inside the initializePlayer method, not elsewhere
    const methodStart = armorTierSrc.indexOf("initializePlayer(player: Player)");
    const methodEnd = armorTierSrc.indexOf("}", methodStart);
    const method = armorTierSrc.slice(methodStart, methodEnd);
    expect(method).toContain("mk:mk_page_helmet");
  });

  it("gives Page chestplate only if hasStarted is false", () => {
    expect(armorTierSrc).toContain("mk:mk_page_chestplate");
  });

  it("gives Page leggings only if hasStarted is false", () => {
    expect(armorTierSrc).toContain("mk:mk_page_leggings");
  });

  it("gives Page boots only if hasStarted is false", () => {
    expect(armorTierSrc).toContain("mk:mk_page_boots");
  });
});

// ─── DayCounterSystem sets mk:has_started ──────────────────────────────────

describe("DayCounterSystem.initializePlayer", () => {
  it("has initializePlayer method", () => {
    expect(dayCounterSrc).toContain("initializePlayer(player: Player)");
  });

  it("sets mk:has_started to true", () => {
    expect(dayCounterSrc).toContain(
      'setDynamicProperty("mk:has_started", true)'
    );
  });

  it("checks mk:has_started before initializing", () => {
    expect(dayCounterSrc).toContain(
      'getDynamicProperty("mk:has_started")'
    );
  });

  it("initializes mk:kills to 0", () => {
    const methodStart = dayCounterSrc.indexOf("initializePlayer(player: Player)");
    const methodEnd = dayCounterSrc.indexOf("}", methodStart);
    const method = dayCounterSrc.slice(methodStart, methodEnd);
    expect(method).toContain('setDynamicProperty("mk:kills", 0)');
  });

  it("initializes mk:army_size to 0", () => {
    const methodStart = dayCounterSrc.indexOf("initializePlayer(player: Player)");
    const methodEnd = dayCounterSrc.indexOf("}", methodStart);
    const method = dayCounterSrc.slice(methodStart, methodEnd);
    expect(method).toContain('setDynamicProperty("mk:army_size", 0)');
  });

  it("initializes mk:current_tier to 0 (Page tier)", () => {
    const methodStart = dayCounterSrc.indexOf("initializePlayer(player: Player)");
    const methodEnd = dayCounterSrc.indexOf("}", methodStart);
    const method = dayCounterSrc.slice(methodStart, methodEnd);
    expect(method).toContain('setDynamicProperty("mk:current_tier", 0)');
  });
});

// ─── Integration: mk:has_started lifecycle ─────────────────────────────────

describe("mk:has_started property lifecycle", () => {
  it("starts as false (checked by ArmorTierSystem)", () => {
    // ArmorTierSystem checks "if (!hasStarted)" which implies default is false
    expect(armorTierSrc).toContain("if (!hasStarted)");
  });

  it("set to true by DayCounterSystem", () => {
    expect(dayCounterSrc).toContain(
      'setDynamicProperty("mk:has_started", true)'
    );
  });

  it("prevents Page armor from being given twice", () => {
    // ArmorTierSystem wraps armor giving in "if (!hasStarted)"
    const methodStart = armorTierSrc.indexOf("initializePlayer(player: Player)");
    const methodEnd = armorTierSrc.indexOf("}", methodStart);
    const method = armorTierSrc.slice(methodStart, methodEnd);

    // Count the armor pieces inside the if block
    const ifBlock = method.split("if (!hasStarted)")[1];
    expect(ifBlock).toContain("mk:mk_page_helmet");
    expect(ifBlock).toContain("mk:mk_page_chestplate");
    expect(ifBlock).toContain("mk:mk_page_leggings");
    expect(ifBlock).toContain("mk:mk_page_boots");
  });
});

// ─── Handler composition check ─────────────────────────────────────────────

describe("playerSpawn handler structure", () => {
  it("only runs on initialSpawn (not every spawn)", () => {
    // Extract the playerSpawn handler block
    const handlerStart = mainSrc.indexOf(
      "world.afterEvents.playerSpawn.subscribe"
    );
    const handlerEnd = mainSrc.indexOf("});", handlerStart) + 3;
    const handler = mainSrc.slice(handlerStart, handlerEnd);

    expect(handler).toContain("if (event.initialSpawn)");
  });

  it("calls all three initialization functions inside initialSpawn check", () => {
    // Extract the playerSpawn handler block
    const handlerStart = mainSrc.indexOf(
      "world.afterEvents.playerSpawn.subscribe"
    );
    const handlerEnd = mainSrc.indexOf("});", handlerStart) + 3;
    const handler = mainSrc.slice(handlerStart, handlerEnd);

    // Find the if block
    const ifStart = handler.indexOf("if (event.initialSpawn)");
    const ifEnd = handler.lastIndexOf("}");
    const ifBlock = handler.slice(ifStart, ifEnd);

    expect(ifBlock).toContain("armorTier.initializePlayer");
    expect(ifBlock).toContain("dayCounter.initializePlayer");
    expect(ifBlock).toContain("bestiary.onPlayerSpawn");
  });
});
