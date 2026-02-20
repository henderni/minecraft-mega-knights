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

/** Max milestone entities across all players — keeps total near 40 entity budget with allies */
const MAX_MILESTONE_ENTITIES = 20;

interface SpawnRequest {
  entityId: string;
  count: number;
}

/**
 * Queued spawn system: collects all spawn requests and runs them through a
 * single runJob generator. Avoids creating multiple parallel generators
 * (which previously caused 4-8 spawns/tick during busy milestones like day 90).
 * Caps total spawns at MAX_MILESTONE_ENTITIES to protect entity budget.
 */
function spawnEnemiesNearPlayersBatched(requests: SpawnRequest[]): void {
  // Capture players at call time — reuse for both name list and initial generator map
  const initialPlayers = world.getAllPlayers();
  const playerNames: string[] = [];
  for (const p of initialPlayers) {
    if (p.isValid) {
      playerNames.push(p.name);
    }
  }

  // Scale per-player counts in multiplayer to stay under entity cap
  const playerCount = playerNames.length;
  const totalRequested = requests.reduce((sum, r) => sum + r.count, 0) * playerCount;
  const scaleFactor =
    totalRequested > MAX_MILESTONE_ENTITIES ? MAX_MILESTONE_ENTITIES / totalRequested : 1.0;

  // Build flat spawn queue with scaled counts
  const queue: { entityId: string; playerName: string }[] = [];
  for (const name of playerNames) {
    for (const req of requests) {
      const scaledCount = Math.max(1, Math.round(req.count * scaleFactor));
      for (let i = 0; i < scaledCount; i++) {
        queue.push({ entityId: req.entityId, playerName: name });
      }
    }
  }

  system.runJob(
    (function* () {
      let spawned = 0;
      // Build player map from outer array — avoids double getAllPlayers() on same tick
      const playerMap = new Map<string, Player>();
      for (const p of initialPlayers) {
        if (p.isValid) {
          playerMap.set(p.name, p);
        }
      }

      for (const entry of queue) {
        const cachedPlayer = playerMap.get(entry.playerName);
        if (!cachedPlayer?.isValid) {
          continue;
        } // Player gone, skip

        try {
          const loc = cachedPlayer.location;
          const angle = Math.random() * Math.PI * 2;
          const dist = 15 + Math.random() * 20;
          const spawnLoc = {
            x: loc.x + Math.cos(angle) * dist,
            y: loc.y,
            z: loc.z + Math.sin(angle) * dist,
          };
          const entity = cachedPlayer.dimension.spawnEntity(entry.entityId, spawnLoc);
          entity.addTag("mk_script_spawned");
        } catch {
          // Chunk not loaded or entity limit reached
        }

        spawned++;
        if (spawned % SPAWNS_PER_TICK === 0) {
          yield;
          // Refresh player map every 5th yield — balances staleness vs bridge call cost
          if (spawned % 5 === 0) {
            playerMap.clear();
            for (const p of world.getAllPlayers()) {
              if (p.isValid) {
                playerMap.set(p.name, p);
              }
            }
          }
        }
      }
    })(),
  );
}

/** Allowlist of blueprint item IDs that may be given via command */
const VALID_BLUEPRINT_ITEMS = new Set([
  "mk:mk_blueprint_small_tower",
  "mk:mk_blueprint_gatehouse",
  "mk:mk_blueprint_great_hall",
]);

function giveBlueprintToPlayers(blueprintItem: string): void {
  if (!VALID_BLUEPRINT_ITEMS.has(blueprintItem)) {
    console.warn(`[MegaKnights] Invalid blueprint item: ${blueprintItem}`);
    return;
  }
  for (const player of world.getAllPlayers()) {
    if (!player.isValid) {
      continue;
    }
    try {
      player.runCommand(`give @s ${blueprintItem}`);
    } catch {
      // Player may have disconnected
    }
  }
}

export const MILESTONES: Record<number, Milestone> = {
  1: {
    day: 1,
    title: "The Journey Begins",
    message: "The land whispers of a coming darkness. Build your strength, gather allies, and prepare for what lies ahead...",
    execute: () => {},
  },
  5: {
    day: 5,
    title: "Small Tower Blueprint Unlocked!",
    message: "A weathered blueprint found among the ruins. Build a watchtower to see threats coming from afar.",
    execute: () => {
      giveBlueprintToPlayers("mk:mk_blueprint_small_tower");
    },
  },
  10: {
    day: 10,
    title: "Enemy Scouts Spotted!",
    message: "Scouts bearing the Siege Lord's banner emerge from the treeline. They're testing your defenses — defeat them, and some may pledge loyalty to you.",
    execute: () => {
      spawnEnemiesNearPlayersBatched([
        { entityId: "mk:mk_enemy_knight", count: 2 },
        { entityId: "mk:mk_enemy_archer", count: 1 },
      ]);
    },
  },
  20: {
    day: 20,
    title: "Squire Promotion!",
    message: "Your deeds have earned recognition among the remaining knights. The rank of Squire is yours — stronger armor awaits!",
    execute: () => {
      ArmorTierSystem.unlockTier(1);
    },
  },
  25: {
    day: 25,
    title: "Raiders at the Gates!",
    message: "A raiding party crashes through the countryside! The Siege Lord grows bolder. Stand and fight!",
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
    message: "Ancient fortification plans recovered from a fallen fortress. A gatehouse will channel enemies into killzones.",
    execute: () => {
      giveBlueprintToPlayers("mk:mk_blueprint_gatehouse");
    },
  },
  40: {
    day: 40,
    title: "Knight's Oath!",
    message: "You kneel before the fading banners of the old order and rise as a true Knight. The enemy will learn to fear your name.",
    execute: () => {
      ArmorTierSystem.unlockTier(2);
    },
  },
  50: {
    day: 50,
    title: "A Dark Force Gathers...",
    message: "The sky crackles with arcane energy. Dark wizards have joined the Siege Lord's army, bending magic to his will. Build the Great Hall to marshal your forces!",
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
    message: "The old Champions tested their mettle against impossible odds. Today, you join their legacy. Only the worthy may wear the Champion's plate.",
    execute: () => {
      ArmorTierSystem.unlockTier(3);
    },
  },
  70: {
    day: 70,
    title: "The Enemy Army Marches!",
    message: "The ground trembles beneath ten thousand boots. The Siege Lord's full army marches upon your position. The final battle draws near!",
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
    message: "The ancient armor of the Mega Knight responds to your will. Forged in dragonfire, quenched in starlight — this is the armor of legends. The siege is nigh!",
    execute: () => {
      ArmorTierSystem.unlockTier(4);
    },
  },
  90: {
    day: 90,
    title: "The Siege Lord's Vanguard!",
    message: "The Siege Lord sends his most feared warriors as a final test. Dark knights and battlemages pour through the breach — only 10 days remain!",
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

/**
 * Set of days that have milestone events. Derived from MILESTONES keys so
 * EnemyCampSystem stays in sync automatically when new milestones are added.
 */
export const MILESTONE_DAYS = new Set(Object.keys(MILESTONES).map(Number));
// Day 100 siege is triggered directly by DayCounterSystem -> SiegeSystem
