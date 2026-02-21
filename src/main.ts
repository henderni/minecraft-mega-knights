import { world, system } from "@minecraft/server";
import { DayCounterSystem } from "./systems/DayCounterSystem";
import { ArmorTierSystem } from "./systems/ArmorTierSystem";
import { ArmySystem, GLOBAL_ARMY_CAP, getOwnerTag } from "./systems/ArmySystem";
import { CombatSystem } from "./systems/CombatSystem";
import { CastleSystem } from "./systems/CastleSystem";
import { SiegeSystem } from "./systems/SiegeSystem";
import { EnemyCampSystem } from "./systems/EnemyCampSystem";
import { BestiarySystem } from "./systems/BestiarySystem";
import { MerchantSystem } from "./systems/MerchantSystem";
import { QuestJournalSystem } from "./systems/QuestJournalSystem";
import { DifficultySystem } from "./systems/DifficultySystem";
import { DEBUG_DAY_SET, DEBUG_QUEST_STARTED, DEBUG_QUEST_RESET, FRIENDLY_FIRE_BLOCKED } from "./data/Strings";
import { ENEMY_SPAWN_DAY } from "./data/WaveDefinitions";
import { setEnemyMultiplierGetter } from "./data/MilestoneEvents";
import { BESTIARY } from "./data/BestiaryDefinitions";
import { ARMOR_TIERS } from "./data/ArmorTiers";

const dayCounter = new DayCounterSystem();
const armorTier = new ArmorTierSystem();
const army = new ArmySystem();
const bestiary = new BestiarySystem();
const difficulty = new DifficultySystem();
const combat = new CombatSystem(army, bestiary, difficulty);
const castle = new CastleSystem(army);
const siege = new SiegeSystem();
const campSystem = new EnemyCampSystem();
const merchant = new MerchantSystem(army);
const journal = new QuestJournalSystem(dayCounter, difficulty);

// Wire difficulty system to all systems that scale enemy spawns
dayCounter.setDifficultySystem(difficulty);
const getMultiplier = () => difficulty.getEnemyMultiplier();
siege.setEnemyMultiplierGetter(getMultiplier);
campSystem.setEnemyMultiplierGetter(getMultiplier);
setEnemyMultiplierGetter(getMultiplier);

// Wire up event-driven death tracking
army.setupDeathListener(); // Instant army recount on ally death
siege.setupDeathListener(); // Decrement siege mob counter on enemy death
campSystem.setupDeathListener(); // Decrement camp guard counter on kill

// Wire siege victory to enable endless mode
siege.onVictory(() => {
  dayCounter.enableEndlessMode();
});

// Auto-trigger siege on Day 100; spawn enemy camps on off-days
dayCounter.onDayChanged((day) => {
  if (day === 100) {
    siege.startSiege();
  } else if (day > 100 && dayCounter.isEndlessMode() && (day - 100) % 20 === 0) {
    // Endless mode: mini-siege every 20 days
    siege.startEndlessSiege(day);
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
// ENEMY_SPAWN_DAY imported from data/WaveDefinitions.ts — single source of truth.
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

/** Bounded LRU map for tick-based rate limiting — evicts oldest entries when over capacity */
class LRUTickCache {
  private map = new Map<string, number>();
  private order: string[] = [];
  private maxSize: number;
  constructor(maxSize: number) { this.maxSize = maxSize; }
  get(key: string): number | undefined { return this.map.get(key); }
  set(key: string, value: number): void {
    this.map.set(key, value);
    const idx = this.order.indexOf(key);
    if (idx >= 0) { this.order.splice(idx, 1); }
    this.order.push(key);
    while (this.map.size > this.maxSize) {
      const oldest = this.order.shift();
      if (oldest) { this.map.delete(oldest); }
    }
  }
}

// Friendly fire protection — prevent players from damaging their own allies
const friendlyFireCache = new LRUTickCache(200);

world.afterEvents.entityHurt.subscribe((event) => {
  const entity = event.hurtEntity;
  if (!entity.isValid || !entity.hasTag("mk_army")) {
    return;
  }
  const source = event.damageSource.damagingEntity;
  if (!source || source.typeId !== "minecraft:player") {
    return;
  }
  const player = source as import("@minecraft/server").Player;
  if (!entity.hasTag(getOwnerTag(player.name))) {
    return;
  }
  // Heal back the damage
  system.run(() => {
    try {
      if (!entity.isValid) { return; }
      const health = entity.getComponent("health") as import("@minecraft/server").EntityHealthComponent;
      if (health) {
        const newHp = Math.min(health.currentValue + event.damage, health.effectiveMax);
        health.setCurrentValue(newHp);
      }
    } catch {
      // Entity may have despawned
    }
  });
  // Throttled message — once per 3 seconds (60 ticks) per player
  const now = system.currentTick;
  const lastMsg = friendlyFireCache.get(player.name) ?? 0;
  if (now - lastMsg >= 60) {
    friendlyFireCache.set(player.name, now);
    try {
      player.sendMessage(FRIENDLY_FIRE_BLOCKED);
    } catch {
      // Player may have disconnected
    }
  }
});

// Player spawn
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    armorTier.initializePlayer(event.player); // Must run before dayCounter (which sets mk:has_started=true)
    dayCounter.initializePlayer(event.player);
    bestiary.onPlayerSpawn(event.player); // Reapply earned bestiary effects on join
  }
});

// Entity death (recruitment)
world.afterEvents.entityDie.subscribe((event) => {
  combat.onEntityDie(event);
});

// Item use (blueprints, standard bearer scroll, quest journal)
world.afterEvents.itemUse.subscribe((event) => {
  castle.onItemUse(event);
  if (event.itemStack?.typeId === "mk:mk_standard_bearer_scroll") {
    merchant.onScrollUse(event.source);
  }
  if (event.itemStack?.typeId === "mk:mk_quest_journal") {
    journal.onItemUse(event.source);
  }
});

// Player interact with entity (army management)
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  army.onPlayerInteract(event);
});

// Debug commands via /scriptevent (requires operator permissions)
const armySpawnCache = new LRUTickCache(200);

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "mk:setday") {
    const day = parseInt(event.message);
    if (!isNaN(day)) {
      dayCounter.setDay(day); // setDay() clamps internally
      world.sendMessage(DEBUG_DAY_SET(dayCounter.getCurrentDay()));
    }
  } else if (event.id === "mk:start") {
    dayCounter.startQuest();
    world.sendMessage(DEBUG_QUEST_STARTED);
  } else if (event.id === "mk:reset") {
    siege.reset();
    dayCounter.reset();
    difficulty.reset();
    campSystem.clearAllCamps();
    // Remove all custom entities (army, siege mobs, camp guards) across all dimensions
    for (const dimId of ["overworld", "nether", "the_end"]) {
      try {
        const dim = world.getDimension(dimId);
        for (const tag of ["mk_army", "mk_siege_mob", "mk_camp_guard"]) {
          for (const e of dim.getEntities({ tags: [tag] })) {
            try { e.remove(); } catch { /* already despawned */ }
          }
        }
      } catch { /* dimension not loaded */ }
    }
    // Clear all player-specific properties
    for (const player of world.getAllPlayers()) {
      try {
        player.setDynamicProperty("mk:kills", 0);
        player.setDynamicProperty("mk:army_size", 0);
        player.setDynamicProperty("mk:current_tier", 0);
        player.setDynamicProperty("mk:army_bonus", 0);
        player.setDynamicProperty("mk:has_started", false);
        for (let i = 0; i < ARMOR_TIERS.length; i++) {
          player.setDynamicProperty(`mk:tier_unlocked_${i}`, false);
        }
        for (const entry of BESTIARY) {
          player.setDynamicProperty(entry.killKey, 0);
        }
      } catch { /* player may have disconnected */ }
    }
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
      count <= GLOBAL_ARMY_CAP &&
      sourcePlayer &&
      sourcePlayer.typeId === "minecraft:player"
    ) {
      const playerName = (sourcePlayer as import("@minecraft/server").Player).name;
      const lastTick = armySpawnCache.get(playerName) ?? 0;
      // Rate limit: 5-second cooldown per operator to prevent entity exhaustion
      if (now - lastTick >= 100) {
        armySpawnCache.set(playerName, now);
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
