import { world, system, Player } from "@minecraft/server";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import {
  SIEGE_BEGIN,
  SIEGE_DEFEND,
  SIEGE_WAVE,
  SIEGE_VICTORY_1,
  SIEGE_VICTORY_2,
  SIEGE_VICTORY_3,
  SIEGE_VICTORY_TITLE,
  SIEGE_VICTORY_SUBTITLE,
  SIEGE_DEFEAT_1,
  SIEGE_DEFEAT_2,
  SIEGE_DEFEAT_3,
} from "../data/Strings";

/** How many entities to spawn per tick during staggered wave spawning */
const SPAWNS_PER_TICK = 3;

/**
 * Max spawns per wave per player — prevents entity count explosion in multiplayer.
 * With 4 players, each gets up to MAX_SPAWNS_PER_PLAYER entities per wave instead
 * of the full wave count per player.
 */
const MAX_SPAWNS_PER_PLAYER = 24;

/** Ticks between victory checks after all waves are spawned (every 3 seconds) */
const VICTORY_CHECK_INTERVAL = 60;

export class SiegeSystem {
  private siegeActive = false;
  private currentWave = 0;
  private ticksSinceWave = 0;
  private ticksSinceVictoryCheck = 0;

  startSiege(): void {
    if (this.siegeActive) return;

    this.siegeActive = true;
    this.currentWave = 0;
    this.ticksSinceWave = 0;
    this.ticksSinceVictoryCheck = 0;

    world.sendMessage(SIEGE_BEGIN);
    world.sendMessage(SIEGE_DEFEND);

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

    // Check victory condition — throttled to every VICTORY_CHECK_INTERVAL ticks
    if (this.currentWave >= WAVE_DEFINITIONS.length) {
      this.ticksSinceVictoryCheck += 20;
      if (this.ticksSinceVictoryCheck >= VICTORY_CHECK_INTERVAL) {
        this.ticksSinceVictoryCheck = 0;
        this.checkVictory();
      }
    }
  }

  private spawnWave(): void {
    if (this.currentWave >= WAVE_DEFINITIONS.length) return;

    const wave = WAVE_DEFINITIONS[this.currentWave];
    world.sendMessage(SIEGE_WAVE(wave.waveNumber, WAVE_DEFINITIONS.length));

    const players = world.getAllPlayers();
    const playerCount = players.length;

    // Scale spawn counts: in multiplayer, reduce per-player spawns to stay under entity limits
    // Solo: full wave. 2 players: 75% each. 3+: 60% each. Capped at MAX_SPAWNS_PER_PLAYER.
    const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;

    // Build a flat spawn queue with scaled counts per player
    const spawnQueue: { entityId: string; playerName: string }[] = [];

    for (const player of players) {
      if (!player.isValid) continue;
      let playerSpawns = 0;
      for (const spawn of wave.spawns) {
        const scaledCount = Math.max(1, Math.round(spawn.count * scaleFactor));
        for (let i = 0; i < scaledCount; i++) {
          if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) break;
          spawnQueue.push({ entityId: spawn.entityId, playerName: player.name });
          playerSpawns++;
        }
        if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) break;
      }
    }

    // Stagger spawns across ticks using system.runJob
    // Re-fetch player by name inside generator to handle disconnects safely
    system.runJob(
      (function* () {
        let spawned = 0;
        for (const entry of spawnQueue) {
          // Re-fetch the player each iteration — handles disconnect/rejoin
          let targetPlayer: Player | undefined;
          for (const p of world.getAllPlayers()) {
            if (p.name === entry.playerName && p.isValid) {
              targetPlayer = p;
              break;
            }
          }

          if (targetPlayer) {
            try {
              const loc = targetPlayer.location;
              const angle = Math.random() * Math.PI * 2;
              const dist = 20 + Math.random() * 15;
              const spawnLoc = {
                x: loc.x + Math.cos(angle) * dist,
                y: loc.y,
                z: loc.z + Math.sin(angle) * dist,
              };

              const entity = targetPlayer.dimension.spawnEntity(
                entry.entityId,
                spawnLoc
              );
              entity.addTag("mk_siege_mob");
            } catch {
              // Chunk not loaded or entity limit reached
            }
          }

          spawned++;
          if (spawned % SPAWNS_PER_TICK === 0) {
            yield;
          }
        }
      })()
    );

    this.currentWave++;
  }

  private checkVictory(): void {
    const checkedDimensions = new Set<string>();
    let totalSiegeMobs = 0;

    for (const player of world.getAllPlayers()) {
      if (!player.isValid) continue;
      const dimId = player.dimension.id;
      if (checkedDimensions.has(dimId)) continue;
      checkedDimensions.add(dimId);

      try {
        const siegeMobs = player.dimension.getEntities({
          tags: ["mk_siege_mob"],
        });
        totalSiegeMobs += siegeMobs.length;
      } catch {
        // Skip if dimension query fails
      }
    }

    if (totalSiegeMobs === 0) {
      this.endSiege(true);
    }
  }

  private endSiege(victory: boolean): void {
    this.siegeActive = false;

    if (victory) {
      world.sendMessage(SIEGE_VICTORY_1);
      world.sendMessage(SIEGE_VICTORY_2);
      world.sendMessage(SIEGE_VICTORY_3);

      for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;
        player.onScreenDisplay.setTitle(SIEGE_VICTORY_TITLE, {
          subtitle: SIEGE_VICTORY_SUBTITLE,
          fadeInDuration: 20,
          stayDuration: 100,
          fadeOutDuration: 20,
        });
      }
    } else {
      world.sendMessage(SIEGE_DEFEAT_1);
      world.sendMessage(SIEGE_DEFEAT_2);
      world.sendMessage(SIEGE_DEFEAT_3);
    }
  }
}
