import { world, system, Player } from "@minecraft/server";
import { ArmorTierSystem } from "../systems/ArmorTierSystem";

export interface Milestone {
  day: number;
  title: string;
  message?: string;
  execute: () => void;
}

/** How many entities to spawn per tick during staggered milestone spawning */
const SPAWNS_PER_TICK = 2;

/**
 * Stagger-spawns enemies near all players using system.runJob.
 * Re-fetches players by name inside the generator to handle disconnects safely.
 */
function spawnEnemiesNearPlayers(entityId: string, count: number): void {
  // Capture player names at call time — generator re-fetches live player refs
  const playerNames = world.getAllPlayers().map((p) => p.name);

  system.runJob(
    (function* () {
      let spawned = 0;
      for (const name of playerNames) {
        for (let i = 0; i < count; i++) {
          // Re-fetch player each iteration — safe if they disconnect mid-spawn
          let player: Player | undefined;
          for (const p of world.getAllPlayers()) {
            if (p.name === name && p.isValid) {
              player = p;
              break;
            }
          }
          if (!player) break; // Player gone, skip remaining spawns for them

          try {
            const loc = player.location;
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 20;
            const spawnLoc = {
              x: loc.x + Math.cos(angle) * dist,
              y: loc.y,
              z: loc.z + Math.sin(angle) * dist,
            };
            player.dimension.spawnEntity(entityId, spawnLoc);
          } catch {
            // Chunk not loaded or entity limit reached
          }

          spawned++;
          if (spawned % SPAWNS_PER_TICK === 0) {
            yield;
          }
        }
      }
    })()
  );
}

function giveBlueprintToPlayers(blueprintItem: string): void {
  for (const player of world.getAllPlayers()) {
    if (!player.isValid) continue;
    try {
      player.dimension.runCommand(`give "${player.name}" ${blueprintItem}`);
    } catch {
      // Player may have disconnected
    }
  }
}

export const MILESTONES: Record<number, Milestone> = {
  1: {
    day: 1,
    title: "The Journey Begins",
    message: "Build your strength, gather allies, and prepare for what is to come...",
    execute: () => {},
  },
  5: {
    day: 5,
    title: "Small Tower Blueprint Unlocked!",
    message: "Use the blueprint to place a small watchtower.",
    execute: () => {
      giveBlueprintToPlayers("mk:mk_blueprint_small_tower");
    },
  },
  10: {
    day: 10,
    title: "Enemy Scouts Spotted!",
    message: "A scouting party approaches! Defeat them to recruit soldiers.",
    execute: () => {
      spawnEnemiesNearPlayers("mk:mk_enemy_knight", 3);
      spawnEnemiesNearPlayers("mk:mk_enemy_archer", 2);
    },
  },
  20: {
    day: 20,
    title: "Squire Promotion!",
    message: "You've proven yourself. Squire armor is now available!",
    execute: () => {
      ArmorTierSystem.unlockTier(1);
    },
  },
  25: {
    day: 25,
    title: "Raiders at the Gates!",
    message: "A raiding party attacks!",
    execute: () => {
      spawnEnemiesNearPlayers("mk:mk_enemy_knight", 6);
      spawnEnemiesNearPlayers("mk:mk_enemy_archer", 4);
    },
  },
  35: {
    day: 35,
    title: "Gatehouse Blueprint Unlocked!",
    message: "Fortify your position with a proper gatehouse.",
    execute: () => {
      giveBlueprintToPlayers("mk:mk_blueprint_gatehouse");
    },
  },
  40: {
    day: 40,
    title: "Knight's Oath!",
    message: "Your valor is recognized. Knight armor is now available!",
    execute: () => {
      ArmorTierSystem.unlockTier(2);
    },
  },
  50: {
    day: 50,
    title: "A Dark Force Gathers...",
    message: "Dark wizards have joined the enemy ranks!",
    execute: () => {
      spawnEnemiesNearPlayers("mk:mk_enemy_knight", 8);
      spawnEnemiesNearPlayers("mk:mk_enemy_archer", 5);
      spawnEnemiesNearPlayers("mk:mk_enemy_wizard", 2);
      giveBlueprintToPlayers("mk:mk_blueprint_great_hall");
    },
  },
  60: {
    day: 60,
    title: "Champion's Trial!",
    message: "Only the strongest earn the Champion's armor!",
    execute: () => {
      ArmorTierSystem.unlockTier(3);
    },
  },
  70: {
    day: 70,
    title: "The Enemy Army Marches!",
    message: "A massive force approaches your position!",
    execute: () => {
      spawnEnemiesNearPlayers("mk:mk_enemy_knight", 10);
      spawnEnemiesNearPlayers("mk:mk_enemy_archer", 8);
      spawnEnemiesNearPlayers("mk:mk_enemy_wizard", 3);
      spawnEnemiesNearPlayers("mk:mk_enemy_dark_knight", 2);
    },
  },
  85: {
    day: 85,
    title: "Mega Knight Ascension!",
    message: "The ultimate armor is now within your grasp. Prepare for the siege!",
    execute: () => {
      ArmorTierSystem.unlockTier(4);
    },
  },
  90: {
    day: 90,
    title: "The Siege Lord's Vanguard!",
    message: "The Siege Lord sends his elite forces to test you!",
    execute: () => {
      spawnEnemiesNearPlayers("mk:mk_enemy_dark_knight", 5);
      spawnEnemiesNearPlayers("mk:mk_enemy_wizard", 5);
      spawnEnemiesNearPlayers("mk:mk_enemy_knight", 10);
      spawnEnemiesNearPlayers("mk:mk_enemy_archer", 5);
    },
  },
};
// Day 100 siege is triggered directly by DayCounterSystem -> SiegeSystem
