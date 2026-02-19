import { world, system } from "@minecraft/server";
import { DayCounterSystem } from "./systems/DayCounterSystem";
import { ArmorTierSystem } from "./systems/ArmorTierSystem";
import { ArmySystem } from "./systems/ArmySystem";
import { CombatSystem } from "./systems/CombatSystem";
import { CastleSystem } from "./systems/CastleSystem";
import { SiegeSystem } from "./systems/SiegeSystem";
import { EnemyCampSystem } from "./systems/EnemyCampSystem";
import { BestiarySystem } from "./systems/BestiarySystem";
import { MerchantSystem } from "./systems/MerchantSystem";
import { DEBUG_DAY_SET, DEBUG_QUEST_STARTED, DEBUG_QUEST_RESET } from "./data/Strings";

const dayCounter = new DayCounterSystem();
const armorTier = new ArmorTierSystem();
const army = new ArmySystem();
const bestiary = new BestiarySystem();
const combat = new CombatSystem(army, bestiary);
const castle = new CastleSystem(army);
const siege = new SiegeSystem();
const campSystem = new EnemyCampSystem();
const merchant = new MerchantSystem();

// Wire up event-driven death tracking
army.setupDeathListener(); // Instant army recount on ally death
siege.setupDeathListener(); // Decrement siege mob counter on enemy death
campSystem.setupDeathListener(); // Decrement camp guard counter on kill

// Auto-trigger siege on Day 100; spawn enemy camps on off-days
dayCounter.onDayChanged((day) => {
  if (day >= 100) {
    siege.startSiege();
  }
  campSystem.onDayChanged(day, siege.isActive());
  merchant.onDayChanged(day);
});

// Main game tick (every 20 ticks = 1 second)
system.runInterval(() => {
  dayCounter.tick();
  siege.tick();
}, 20);

// Army recount correction pass (every 200 ticks = 10 seconds)
// Death events handle most updates; this is a safety net for edge cases
system.runInterval(() => {
  army.tick();
  campSystem.tick(); // Camp guard recount safety net (same cadence)
  bestiary.tick();  // Reapply earned bestiary effects to all players
}, 200);

// HUD update (every 10 ticks = 0.5 seconds — action bar text persists ~2s so no flicker)
system.runInterval(() => {
  dayCounter.updateHUD();
}, 10);

// Gate natural enemy spawns behind quest progress
// Enemies spawned by milestones have "mk_script_spawned" tag; siege mobs have "mk_siege_mob".
// Naturally-spawned enemies (via spawn rules) are despawned if the quest hasn't progressed enough.
const ENEMY_SPAWN_DAY: Record<string, number> = {
  "mk:mk_enemy_knight": 10,
  "mk:mk_enemy_archer": 10,
  "mk:mk_enemy_wizard": 50,
  "mk:mk_enemy_dark_knight": 70,
};

world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  if (!entity.isValid) {
    return;
  }

  const minDay = ENEMY_SPAWN_DAY[entity.typeId];
  if (minDay === undefined) {
    return;
  } // Not one of our enemies

  // Script-spawned entities are tagged before afterEvents fire — don't touch them
  if (entity.hasTag("mk_script_spawned") || entity.hasTag("mk_siege_mob") || entity.hasTag("mk_camp_guard")) {
    return;
  }

  // Despawn if quest not active or day too early.
  // Deferred via system.run() — must not mutate entities during afterEvents processing.
  if (!dayCounter.isActive() || dayCounter.getCurrentDay() < minDay) {
    system.run(() => {
      try {
        if (entity.isValid) {
          entity.remove();
        }
      } catch {
        // Entity may already be invalid
      }
    });
  }
});

// Player spawn
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    dayCounter.initializePlayer(event.player);
    armorTier.initializePlayer(event.player);
    bestiary.onPlayerSpawn(event.player); // Reapply earned bestiary effects on join
  }
});

// Entity death (recruitment)
world.afterEvents.entityDie.subscribe((event) => {
  combat.onEntityDie(event);
});

// Item use (blueprints + standard bearer scroll)
world.afterEvents.itemUse.subscribe((event) => {
  castle.onItemUse(event);
  if (event.itemStack?.typeId === "mk:mk_standard_bearer_scroll") {
    merchant.onScrollUse(event.source);
  }
});

// Player interact with entity (army management)
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  army.onPlayerInteract(event);
});

// Debug commands via /scriptevent (requires operator permissions)
// Per-player rate limit map — prevents each operator from spamming mk:army independently
const lastArmySpawnTickByPlayer = new Map<string, number>();
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "mk:setday") {
    const day = parseInt(event.message);
    if (!isNaN(day)) {
      dayCounter.setDay(day); // setDay() clamps internally to [0, MAX_DAY]
      world.sendMessage(DEBUG_DAY_SET(Math.max(0, Math.min(100, day))));
    }
  } else if (event.id === "mk:start") {
    dayCounter.startQuest();
    world.sendMessage(DEBUG_QUEST_STARTED);
  } else if (event.id === "mk:reset") {
    dayCounter.reset();
    world.sendMessage(DEBUG_QUEST_RESET);
  } else if (event.id === "mk:siege") {
    siege.startSiege();
  } else if (event.id === "mk:army") {
    const count = parseInt(event.message);
    const now = system.currentTick;
    const sourcePlayer = event.sourceEntity;
    if (
      !isNaN(count) &&
      count > 0 &&
      count <= 50 &&
      sourcePlayer &&
      sourcePlayer.typeId === "minecraft:player"
    ) {
      const playerName = (sourcePlayer as import("@minecraft/server").Player).name;
      const lastTick = lastArmySpawnTickByPlayer.get(playerName) ?? 0;
      // Rate limit: 5-second cooldown per operator to prevent entity exhaustion
      if (now - lastTick >= 100) {
        lastArmySpawnTickByPlayer.set(playerName, now);
        army.debugSpawnAllies(sourcePlayer as import("@minecraft/server").Player, count);
      }
    }
  } else if (event.id === "mk:camp") {
    const sourcePlayer = event.sourceEntity;
    if (sourcePlayer && sourcePlayer.typeId === "minecraft:player") {
      campSystem.debugSpawnCamp(
        sourcePlayer as import("@minecraft/server").Player,
        dayCounter.getCurrentDay(),
      );
    }
  }
});

console.warn("[MegaKnights] Add-on loaded successfully!");
