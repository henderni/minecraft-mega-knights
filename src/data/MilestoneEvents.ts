import { world } from "@minecraft/server";
import { ArmorTierSystem } from "../systems/ArmorTierSystem";

export interface Milestone {
  day: number;
  title: string;
  message?: string;
  execute: () => void;
}

function spawnEnemiesNearPlayers(entityId: string, count: number): void {
  for (const player of world.getAllPlayers()) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 20;
      const loc = {
        x: player.location.x + Math.cos(angle) * dist,
        y: player.location.y,
        z: player.location.z + Math.sin(angle) * dist,
      };
      try {
        player.dimension.spawnEntity(entityId, loc);
      } catch {
        // Chunk may not be loaded
      }
    }
  }
}

function giveBlueprintToPlayers(blueprintItem: string): void {
  for (const player of world.getAllPlayers()) {
    player.dimension.runCommand(`give "${player.name}" ${blueprintItem}`);
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
