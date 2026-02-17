import { world, system } from "@minecraft/server";
import { DayCounterSystem } from "./systems/DayCounterSystem";
import { ArmorTierSystem } from "./systems/ArmorTierSystem";
import { ArmySystem } from "./systems/ArmySystem";
import { CombatSystem } from "./systems/CombatSystem";
import { CastleSystem } from "./systems/CastleSystem";
import { SiegeSystem } from "./systems/SiegeSystem";

const dayCounter = new DayCounterSystem();
const armorTier = new ArmorTierSystem();
const army = new ArmySystem();
const combat = new CombatSystem(army);
const castle = new CastleSystem(army);
const siege = new SiegeSystem();

// Auto-trigger siege on Day 100
dayCounter.onDayChanged((day) => {
  if (day >= 100) {
    siege.startSiege();
  }
});

// Main game tick (every 20 ticks = 1 second)
system.runInterval(() => {
  dayCounter.tick();
  army.tick();
  siege.tick();
}, 20);

// HUD update (every 2 ticks for smooth display)
system.runInterval(() => {
  dayCounter.updateHUD();
}, 2);

// Player spawn
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    dayCounter.initializePlayer(event.player);
    armorTier.initializePlayer(event.player);
  }
});

// Entity death (recruitment)
world.afterEvents.entityDie.subscribe((event) => {
  combat.onEntityDie(event);
});

// Item use (blueprints)
world.afterEvents.itemUse.subscribe((event) => {
  castle.onItemUse(event);
});

// Player interact with entity (army management)
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  army.onPlayerInteract(event);
});

// Debug commands via /scriptevent
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "mk:setday") {
    const day = parseInt(event.message);
    if (!isNaN(day) && day >= 0 && day <= 100) {
      dayCounter.setDay(day);
      world.sendMessage(`§e[Debug] Day set to ${day}`);
    }
  } else if (event.id === "mk:start") {
    dayCounter.startQuest();
    world.sendMessage("§a[Debug] Quest started!");
  } else if (event.id === "mk:reset") {
    dayCounter.reset();
    world.sendMessage("§c[Debug] Quest reset!");
  } else if (event.id === "mk:siege") {
    siege.startSiege();
  } else if (event.id === "mk:army") {
    const count = parseInt(event.message);
    if (!isNaN(count) && event.sourceEntity && event.sourceEntity.typeId === "minecraft:player") {
      army.debugSpawnAllies(event.sourceEntity as import("@minecraft/server").Player, count);
    }
  }
});

console.warn("[MegaKnights] Add-on loaded successfully!");
