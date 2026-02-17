import { world, system, Player } from "@minecraft/server";
import { DayCounterSystem } from "./DayCounterSystem";
import { ArmySystem } from "./ArmySystem";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";

export class SiegeSystem {
  private dayCounter: DayCounterSystem;
  private army: ArmySystem;
  private siegeActive = false;
  private currentWave = 0;
  private ticksSinceWave = 0;
  private bossDefeated = false;

  constructor(dayCounter: DayCounterSystem, army: ArmySystem) {
    this.dayCounter = dayCounter;
    this.army = army;
  }

  startSiege(): void {
    if (this.siegeActive) return;

    this.siegeActive = true;
    this.currentWave = 0;
    this.ticksSinceWave = 0;
    this.bossDefeated = false;

    world.sendMessage("§4§l=== THE SIEGE HAS BEGUN! ===");
    world.sendMessage("§cDefend your castle! Waves of enemies approach!");

    this.spawnWave();
  }

  tick(): void {
    if (!this.siegeActive) return;

    this.ticksSinceWave += 20; // called every 20 ticks

    // Check if it's time for the next wave
    if (this.currentWave < WAVE_DEFINITIONS.length) {
      const wave = WAVE_DEFINITIONS[this.currentWave];
      if (this.ticksSinceWave >= wave.delayTicks) {
        this.spawnWave();
        this.ticksSinceWave = 0;
      }
    }

    // Check victory condition: all siege mobs dead after all waves spawned
    if (this.currentWave >= WAVE_DEFINITIONS.length) {
      this.checkVictory();
    }
  }

  private spawnWave(): void {
    if (this.currentWave >= WAVE_DEFINITIONS.length) return;

    const wave = WAVE_DEFINITIONS[this.currentWave];
    world.sendMessage(
      `§c--- Wave ${wave.waveNumber}/${WAVE_DEFINITIONS.length} ---`
    );

    for (const player of world.getAllPlayers()) {
      for (const spawn of wave.spawns) {
        for (let i = 0; i < spawn.count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 20 + Math.random() * 15;
          const spawnLoc = {
            x: player.location.x + Math.cos(angle) * dist,
            y: player.location.y,
            z: player.location.z + Math.sin(angle) * dist,
          };

          try {
            const entity = player.dimension.spawnEntity(
              spawn.entityId,
              spawnLoc
            );
            entity.addTag("mk_siege_mob");
          } catch {
            // Chunk might not be loaded
          }
        }
      }
    }

    this.currentWave++;
  }

  private checkVictory(): void {
    // Count remaining siege mobs
    for (const player of world.getAllPlayers()) {
      try {
        const siegeMobs = player.dimension.getEntities({
          tags: ["mk_siege_mob"],
        });
        if (siegeMobs.length === 0) {
          this.endSiege(true);
          return;
        }
      } catch {
        // Skip if dimension query fails
      }
    }
  }

  private endSiege(victory: boolean): void {
    this.siegeActive = false;

    if (victory) {
      world.sendMessage("§a§l=== VICTORY! ===");
      world.sendMessage("§6The Siege Lord has been defeated!");
      world.sendMessage("§dYou are a TRUE Mega Knight!");

      for (const player of world.getAllPlayers()) {
        // Title display
        player.onScreenDisplay.setTitle("§6§lVICTORY!", {
          subtitle: "§eThe kingdom is saved!",
          fadeInDuration: 20,
          stayDuration: 100,
          fadeOutDuration: 20,
        });
      }
    } else {
      world.sendMessage("§4§l=== DEFEAT ===");
      world.sendMessage("§cThe siege has overwhelmed your defenses...");
      world.sendMessage('§7Use "/scriptevent mk:reset" to try again.');
    }
  }
}
