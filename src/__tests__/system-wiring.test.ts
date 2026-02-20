/**
 * system-wiring.test.ts
 *
 * Validates that main.ts correctly wires all systems together,
 * event handlers are registered, and tick intervals are correct.
 * Uses source-as-text since main.ts imports @minecraft/server.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const mainSrc = readSource("main.ts");

// ─── System instantiation ───────────────────────────────────────────────────

describe("main.ts: system instantiation", () => {
  const expectedSystems = [
    "DayCounterSystem",
    "ArmorTierSystem",
    "ArmySystem",
    "CombatSystem",
    "CastleSystem",
    "SiegeSystem",
    "EnemyCampSystem",
    "BestiarySystem",
    "MerchantSystem",
    "QuestJournalSystem",
    "DifficultySystem",
  ];

  for (const sys of expectedSystems) {
    it(`instantiates ${sys}`, () => {
      expect(mainSrc).toContain(`new ${sys}(`);
    });
  }

  it("passes army to CombatSystem", () => {
    expect(mainSrc).toMatch(/new CombatSystem\(\s*army/);
  });

  it("passes army to CastleSystem", () => {
    expect(mainSrc).toMatch(/new CastleSystem\(\s*army/);
  });

  it("passes army to MerchantSystem", () => {
    expect(mainSrc).toMatch(/new MerchantSystem\(\s*army/);
  });

  it("passes bestiary to CombatSystem", () => {
    expect(mainSrc).toMatch(/new CombatSystem\(\s*army\s*,\s*bestiary/);
  });

  it("passes difficulty to CombatSystem", () => {
    expect(mainSrc).toMatch(/new CombatSystem\(\s*army\s*,\s*bestiary\s*,\s*difficulty/);
  });

  it("passes dayCounter to QuestJournalSystem", () => {
    expect(mainSrc).toMatch(/new QuestJournalSystem\(\s*dayCounter/);
  });

  it("wires difficulty system to day counter", () => {
    expect(mainSrc).toContain("dayCounter.setDifficultySystem(difficulty)");
  });

  it("wires siege victory callback for endless mode", () => {
    expect(mainSrc).toContain("siege.onVictory(");
    expect(mainSrc).toContain("dayCounter.enableEndlessMode()");
  });

  it("resets difficulty on mk:reset", () => {
    expect(mainSrc).toContain("difficulty.reset()");
  });

  it("wires enemy multiplier getter to siege system", () => {
    expect(mainSrc).toContain("siege.setEnemyMultiplierGetter(");
  });

  it("wires enemy multiplier getter to camp system", () => {
    expect(mainSrc).toContain("campSystem.setEnemyMultiplierGetter(");
  });

  it("wires enemy multiplier getter to milestone events", () => {
    expect(mainSrc).toContain("setEnemyMultiplierGetter(");
    expect(mainSrc).toContain('import { setEnemyMultiplierGetter }');
  });
});

// ─── Event subscriptions ────────────────────────────────────────────────────

describe("main.ts: event subscriptions", () => {
  it("subscribes to entitySpawn for spawn gating", () => {
    expect(mainSrc).toContain("world.afterEvents.entitySpawn.subscribe");
  });

  it("subscribes to playerSpawn for initialization", () => {
    expect(mainSrc).toContain("world.afterEvents.playerSpawn.subscribe");
  });

  it("subscribes to entityDie for combat", () => {
    expect(mainSrc).toContain("world.afterEvents.entityDie.subscribe");
  });

  it("subscribes to itemUse for blueprints and scrolls", () => {
    expect(mainSrc).toContain("world.afterEvents.itemUse.subscribe");
  });

  it("subscribes to playerInteractWithEntity for army management", () => {
    expect(mainSrc).toContain("world.afterEvents.playerInteractWithEntity.subscribe");
  });

  it("subscribes to scriptEventReceive for debug commands", () => {
    expect(mainSrc).toContain("system.afterEvents.scriptEventReceive.subscribe");
  });

  it("subscribes to entityHurt for friendly fire protection", () => {
    expect(mainSrc).toContain("world.afterEvents.entityHurt.subscribe");
  });
});

// ─── Death listener setup ───────────────────────────────────────────────────

describe("main.ts: death listeners", () => {
  it("sets up army death listener", () => {
    expect(mainSrc).toContain("army.setupDeathListener()");
  });

  it("sets up siege death listener", () => {
    expect(mainSrc).toContain("siege.setupDeathListener()");
  });

  it("sets up camp death listener", () => {
    expect(mainSrc).toContain("campSystem.setupDeathListener()");
  });
});

// ─── Tick intervals ─────────────────────────────────────────────────────────

describe("main.ts: tick intervals", () => {
  it("main tick runs every 20 ticks (1 second)", () => {
    // system.runInterval(() => { dayCounter.tick(); siege.tick(); }, 20)
    expect(mainSrc).toMatch(/runInterval\(\s*\(\)\s*=>\s*\{[^}]*dayCounter\.tick\(\)[^}]*\}\s*,\s*20\s*\)/s);
  });

  it("HUD update runs every 10 ticks (0.5 seconds)", () => {
    expect(mainSrc).toMatch(/runInterval\(\s*\(\)\s*=>\s*\{[^}]*updateHUD\(\)[^}]*\}\s*,\s*10\s*\)/s);
  });

  it("safety-net recount runs every 200 ticks (10 seconds)", () => {
    expect(mainSrc).toMatch(/runInterval\(\s*\(\)\s*=>\s*\{[^}]*army\.tick\(\)[^}]*\}\s*,\s*200\s*\)/s);
  });
});

// ─── Spawn gating ───────────────────────────────────────────────────────────

describe("main.ts: enemy spawn gating", () => {
  const waveSrc = readSource("data/WaveDefinitions.ts");

  it("imports ENEMY_SPAWN_DAY from data", () => {
    expect(mainSrc).toContain("ENEMY_SPAWN_DAY");
  });

  it("gates mk_enemy_knight at day 10", () => {
    expect(waveSrc).toContain('"mk:mk_enemy_knight": 10');
  });

  it("gates mk_enemy_wizard at day 50", () => {
    expect(waveSrc).toContain('"mk:mk_enemy_wizard": 50');
  });

  it("gates mk_enemy_dark_knight at day 70", () => {
    expect(waveSrc).toContain('"mk:mk_enemy_dark_knight": 70');
  });

  it("respects mk_script_spawned tag (does not despawn milestone spawns)", () => {
    expect(mainSrc).toContain("mk_script_spawned");
  });

  it("respects mk_siege_mob tag (does not despawn siege entities)", () => {
    expect(mainSrc).toContain("mk_siege_mob");
  });

  it("respects mk_camp_guard tag (does not despawn camp guards)", () => {
    expect(mainSrc).toContain("mk_camp_guard");
  });

  it("defers entity removal via system.run()", () => {
    // entity.remove() must be inside system.run() to avoid mutation during afterEvents
    const spawnHandler = mainSrc.slice(
      mainSrc.indexOf("world.afterEvents.entitySpawn"),
      mainSrc.indexOf("// Player spawn"),
    );
    expect(spawnHandler).toContain("system.run(");
    expect(spawnHandler).toContain("entity.remove()");
  });
});

// ─── Debug commands ─────────────────────────────────────────────────────────

describe("main.ts: debug commands", () => {
  const debugCommands = ["mk:setday", "mk:start", "mk:reset", "mk:siege", "mk:army", "mk:camp"];

  for (const cmd of debugCommands) {
    it(`handles ${cmd} script event`, () => {
      expect(mainSrc).toContain(`"${cmd}"`);
    });
  }

  it("rate limits mk:army command (100 tick cooldown)", () => {
    expect(mainSrc).toContain("now - lastTick >= 100");
  });

  it("caps mk:army spawn count to GLOBAL_ARMY_CAP", () => {
    expect(mainSrc).toContain("count <= GLOBAL_ARMY_CAP");
  });

  it("validates player type before debug spawn", () => {
    expect(mainSrc).toContain('sourcePlayer.typeId === "minecraft:player"');
  });

  it("LRU eviction prevents unbounded rate limit cache", () => {
    expect(mainSrc).toContain("MAX_RATE_LIMIT_CACHE");
    expect(mainSrc).toContain("playerNameInsertionOrder");
  });
});

// ─── Scroll handler in itemUse ──────────────────────────────────────────────

describe("main.ts: scroll use wiring", () => {
  it("checks for standard_bearer_scroll typeId in itemUse handler", () => {
    expect(mainSrc).toContain("mk:mk_standard_bearer_scroll");
  });

  it("calls merchant.onScrollUse for scroll items", () => {
    expect(mainSrc).toContain("merchant.onScrollUse(");
  });

  it("checks for quest_journal typeId in itemUse handler", () => {
    expect(mainSrc).toContain("mk:mk_quest_journal");
  });

  it("calls journal.onItemUse for quest journal", () => {
    expect(mainSrc).toContain("journal.onItemUse(");
  });
});

// ─── Day change callback ───────────────────────────────────────────────────

describe("main.ts: day change callbacks", () => {
  it("triggers siege on day 100", () => {
    expect(mainSrc).toContain("day === 100");
    expect(mainSrc).toContain("siege.startSiege()");
  });

  it("triggers endless mini-siege every 20 days past 100", () => {
    expect(mainSrc).toContain("siege.startEndlessSiege(");
    expect(mainSrc).toContain("dayCounter.isEndlessMode()");
    expect(mainSrc).toContain("(day - 100) % 20 === 0");
  });

  it("notifies camp system on day change", () => {
    expect(mainSrc).toContain("campSystem.onDayChanged(");
  });

  it("notifies merchant system on day change", () => {
    expect(mainSrc).toContain("merchant.onDayChanged(");
  });

  it("passes siege active state to camp system", () => {
    expect(mainSrc).toContain("siege.isActive()");
  });
});
