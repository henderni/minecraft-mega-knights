import { world, system, Player } from "@minecraft/server";
import { ArmorTierSystem } from "../systems/ArmorTierSystem";

export interface Milestone {
  day: number;
  title: string;
  message?: string;
  execute: () => void;
}

/** How many entities to spawn per tick during staggered milestone spawning — low for Switch */
const SPAWNS_PER_TICK = 1;

interface SpawnRequest {
  entityId: string;
  count: number;
}

/**
 * Queued spawn system: collects all spawn requests and runs them through a
 * single runJob generator. Avoids creating multiple parallel generators
 * (which previously caused 4-8 spawns/tick during busy milestones like day 90).
 */
function spawnEnemiesNearPlayersBatched(requests: SpawnRequest[]): void {
  // Capture player names at call time — generator re-fetches live player refs
  const playerNames: string[] = [];
  for (const p of world.getAllPlayers()) {
    if (p.isValid) playerNames.push(p.name);
  }

  // Build flat spawn queue
  const queue: { entityId: string; playerName: string }[] = [];
  for (const name of playerNames) {
    for (const req of requests) {
      for (let i = 0; i < req.count; i++) {
        queue.push({ entityId: req.entityId, playerName: name });
      }
    }
  }

  system.runJob(
    (function* () {
      let spawned = 0;
      let lastPlayerName = "";
      let cachedPlayer: Player | undefined;

      for (const entry of queue) {
        // Only re-fetch player when name changes or at yield boundaries
        if (entry.playerName !== lastPlayerName || !cachedPlayer) {
          lastPlayerName = entry.playerName;
          cachedPlayer = undefined;
          for (const p of world.getAllPlayers()) {
            if (p.name === entry.playerName && p.isValid) {
              cachedPlayer = p;
              break;
            }
          }
        }
        if (!cachedPlayer) continue; // Player gone, skip

        try {
          const loc = cachedPlayer.location;
          const angle = Math.random() * Math.PI * 2;
          const dist = 15 + Math.random() * 20;
          const spawnLoc = {
            x: loc.x + Math.cos(angle) * dist,
            y: loc.y,
            z: loc.z + Math.sin(angle) * dist,
          };
          cachedPlayer.dimension.spawnEntity(entry.entityId, spawnLoc);
        } catch {
          // Chunk not loaded or entity limit reached
        }

        spawned++;
        if (spawned % SPAWNS_PER_TICK === 0) {
          cachedPlayer = undefined; // Invalidate at yield boundary
          yield;
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
      spawnEnemiesNearPlayersBatched([
        { entityId: "mk:mk_enemy_knight", count: 3 },
        { entityId: "mk:mk_enemy_archer", count: 2 },
      ]);
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
      spawnEnemiesNearPlayersBatched([
        { entityId: "mk:mk_enemy_knight", count: 6 },
        { entityId: "mk:mk_enemy_archer", count: 4 },
      ]);
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
      spawnEnemiesNearPlayersBatched([
        { entityId: "mk:mk_enemy_knight", count: 8 },
        { entityId: "mk:mk_enemy_archer", count: 5 },
        { entityId: "mk:mk_enemy_wizard", count: 2 },
      ]);
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
      spawnEnemiesNearPlayersBatched([
        { entityId: "mk:mk_enemy_knight", count: 10 },
        { entityId: "mk:mk_enemy_archer", count: 8 },
        { entityId: "mk:mk_enemy_wizard", count: 3 },
        { entityId: "mk:mk_enemy_dark_knight", count: 2 },
      ]);
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
      spawnEnemiesNearPlayersBatched([
        { entityId: "mk:mk_enemy_dark_knight", count: 5 },
        { entityId: "mk:mk_enemy_wizard", count: 5 },
        { entityId: "mk:mk_enemy_knight", count: 10 },
        { entityId: "mk:mk_enemy_archer", count: 5 },
      ]);
    },
  },
};
// Day 100 siege is triggered directly by DayCounterSystem -> SiegeSystem
