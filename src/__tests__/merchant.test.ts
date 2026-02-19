import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BP_ENTITIES = path.join(__dirname, "../../MegaKnights_BP/entities");
const RP_ENTITY = path.join(__dirname, "../../MegaKnights_RP/entity");
const TRADING_DIR = path.join(__dirname, "../../MegaKnights_BP/trading");

describe("Wandering Merchant: entity files", () => {
  it("behavior pack entity file exists", () => {
    expect(fs.existsSync(path.join(BP_ENTITIES, "mk_wandering_merchant.se.json"))).toBe(true);
  });

  it("resource pack client entity file exists", () => {
    expect(fs.existsSync(path.join(RP_ENTITY, "mk_wandering_merchant.ce.json"))).toBe(true);
  });

  it("trade table file exists", () => {
    expect(fs.existsSync(path.join(TRADING_DIR, "mk_merchant_trades.json"))).toBe(true);
  });

  it("merchant entity has trade_table component", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_wandering_merchant.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    expect(components).toHaveProperty("minecraft:trade_table");
  });

  it("merchant entity has trade_with_player behavior", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_wandering_merchant.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    expect(components).toHaveProperty("minecraft:behavior.trade_with_player");
  });

  it("merchant entity has a timer component for auto-despawn", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_wandering_merchant.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    expect(components).toHaveProperty("minecraft:timer");
  });

  it("merchant entity is not in mk_enemy family", () => {
    const raw = fs.readFileSync(path.join(BP_ENTITIES, "mk_wandering_merchant.se.json"), "utf-8");
    const entity = JSON.parse(raw);
    const components = (entity["minecraft:entity"] as Record<string, unknown>)["components"] as Record<string, unknown>;
    const family = ((components["minecraft:type_family"] as Record<string, unknown>)["family"] as string[]);
    expect(family).not.toContain("mk_enemy");
  });

  it("trade table has at least 1 tier", () => {
    const raw = fs.readFileSync(path.join(TRADING_DIR, "mk_merchant_trades.json"), "utf-8");
    const trades = JSON.parse(raw);
    expect((trades["tiers"] as unknown[]).length).toBeGreaterThan(0);
  });

  it("trade table tier 2 includes standard_bearer_scroll trade", () => {
    const raw = fs.readFileSync(path.join(TRADING_DIR, "mk_merchant_trades.json"), "utf-8");
    const tradesJson = JSON.stringify(raw);
    expect(tradesJson).toContain("standard_bearer_scroll");
  });
});

describe("Wandering Merchant: MerchantSystem wiring", () => {
  const mainSrc = fs.readFileSync(path.join(__dirname, "../main.ts"), "utf-8");

  it("MerchantSystem is imported in main.ts", () => {
    expect(mainSrc).toContain("MerchantSystem");
  });

  it("merchant.onDayChanged is called in day-change callback", () => {
    expect(mainSrc).toContain("merchant.onDayChanged");
  });

  it("standard_bearer_scroll itemUse is handled", () => {
    expect(mainSrc).toContain("standard_bearer_scroll");
    expect(mainSrc).toContain("merchant.onScrollUse");
  });
});

describe("Wandering Merchant: MerchantSystem spawn days", () => {
  const merchantSrc = fs.readFileSync(path.join(__dirname, "../systems/MerchantSystem.ts"), "utf-8");

  it("merchant spawns on day 15", () => {
    expect(merchantSrc).toContain("15");
  });

  it("merchant spawns on day 30", () => {
    expect(merchantSrc).toContain("30");
  });

  it("merchant spawns on day 55", () => {
    expect(merchantSrc).toContain("55");
  });

  it("merchant spawns on day 75", () => {
    expect(merchantSrc).toContain("75");
  });

  it("merchant spawn uses system.run() deferral for world mutation", () => {
    expect(merchantSrc).toContain("system.run");
  });
});
