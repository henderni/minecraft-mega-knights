/**
 * camp-expiration.test.ts
 *
 * Source-as-text tests for EnemyCampSystem stale camp expiration.
 * Validates that disconnected players' camp entries are cleaned up
 * after a configurable threshold of consecutive absences.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const campSrc = readSource("systems/EnemyCampSystem.ts");

// Extract tick() method for focused assertions
const tickMethod = campSrc.slice(
  campSrc.indexOf("tick(): void"),
  campSrc.indexOf("debugSpawnCamp"),
);

// ─── Stale Camp Detection ────────────────────────────────────────────────────

describe("EnemyCampSystem: stale camp expiration logic", () => {
  it("defines STALE_CAMP_THRESHOLD constant", () => {
    expect(campSrc).toMatch(/STALE_CAMP_THRESHOLD\s*=\s*\d+/);
  });

  it("STALE_CAMP_THRESHOLD is a reasonable value (2-10)", () => {
    const match = campSrc.match(/STALE_CAMP_THRESHOLD\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const value = parseInt(match![1], 10);
    expect(value).toBeGreaterThanOrEqual(2);
    expect(value).toBeLessThanOrEqual(10);
  });

  it("has staleCampCounter tracking Map", () => {
    expect(campSrc).toContain("staleCampCounter");
    expect(campSrc).toMatch(/staleCampCounter\s*=\s*new\s+Map/);
  });

  it("tick() refreshes cachedPlayerMap from getAllPlayers()", () => {
    expect(tickMethod).toContain("cachedPlayerMap.clear()");
    expect(tickMethod).toContain("getAllPlayers()");
  });
});

// ─── Expiration in tick() ────────────────────────────────────────────────────

describe("EnemyCampSystem: tick() camp expiration", () => {
  it("checks each active camp owner against cachedPlayerMap", () => {
    expect(tickMethod).toContain("cachedPlayerMap.has(playerName)");
  });

  it("resets stale counter for present players", () => {
    // When player is in cachedPlayerMap, their stale counter is deleted
    expect(tickMethod).toContain("staleCampCounter.delete(playerName)");
  });

  it("increments stale counter for absent players", () => {
    // staleCampCounter.get and +1 pattern
    expect(tickMethod).toMatch(/staleCampCounter\.get\s*\(\s*playerName\s*\)/);
    expect(tickMethod).toContain("+ 1");
  });

  it("removes camp entry when stale counter reaches threshold", () => {
    expect(tickMethod).toMatch(/count\s*>=\s*STALE_CAMP_THRESHOLD/);
    expect(tickMethod).toContain("activeCamps.delete(playerName)");
  });

  it("cleans up staleCampCounter when camp is expired", () => {
    // After deleting the camp, also delete the stale counter
    const expirationBlock = tickMethod.slice(
      tickMethod.indexOf("count >= STALE_CAMP_THRESHOLD"),
    );
    expect(expirationBlock).toContain("staleCampCounter.delete(playerName)");
  });
});

// ─── clearAllCamps Integration ───────────────────────────────────────────────

describe("EnemyCampSystem: clearAllCamps clears stale counters", () => {
  it("clearAllCamps() clears staleCampCounter", () => {
    const clearMethod = campSrc.slice(
      campSrc.indexOf("clearAllCamps(): void"),
      campSrc.indexOf("onDayChanged"),
    );
    expect(clearMethod).toContain("staleCampCounter.clear()");
  });

  it("clearAllCamps() still clears activeCamps", () => {
    const clearMethod = campSrc.slice(
      campSrc.indexOf("clearAllCamps(): void"),
      campSrc.indexOf("onDayChanged"),
    );
    expect(clearMethod).toContain("activeCamps.clear()");
  });

  it("clearAllCamps() still clears lastCampDay", () => {
    const clearMethod = campSrc.slice(
      campSrc.indexOf("clearAllCamps(): void"),
      campSrc.indexOf("onDayChanged"),
    );
    expect(clearMethod).toContain("lastCampDay.clear()");
  });

  it("clearAllCamps() still clears cachedPlayerMap", () => {
    const clearMethod = campSrc.slice(
      campSrc.indexOf("clearAllCamps(): void"),
      campSrc.indexOf("onDayChanged"),
    );
    expect(clearMethod).toContain("cachedPlayerMap.clear()");
  });
});

// ─── Guard Recount Safety ────────────────────────────────────────────────────

describe("EnemyCampSystem: tick() guard recount unaffected", () => {
  it("guard recount only runs for spawningComplete camps", () => {
    expect(tickMethod).toContain("camp.spawningComplete");
  });

  it("guard recount uses getDimension + getEntities", () => {
    expect(tickMethod).toContain("getDimension(camp.dimensionId)");
    expect(tickMethod).toContain("getEntities(");
  });

  it("guard recount wrapped in try-catch", () => {
    // The recount block has its own try-catch
    const recountBlock = tickMethod.slice(
      tickMethod.indexOf("for (const [playerName, camp] of this.activeCamps)"),
      tickMethod.indexOf("Expire stale"),
    );
    expect(recountBlock).toContain("try");
    expect(recountBlock).toContain("catch");
  });
});
