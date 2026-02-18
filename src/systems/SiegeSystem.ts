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

/** How many entities to spawn per tick during staggered wave spawning — kept low for Switch */
const SPAWNS_PER_TICK = 1;

/**
 * Max spawns per wave per player — prevents entity count explosion in multiplayer.
 * With 4 players, each gets up to MAX_SPAWNS_PER_PLAYER entities per wave instead
 * of the full wave count per player.
 */
const MAX_SPAWNS_PER_PLAYER = 24;

/** Ticks between victory checks after all waves are spawned (every 3 seconds) */
const VICTORY_CHECK_INTERVAL = 60;

/** Maximum active siege mobs before delaying next wave — prevents Switch frame drops */
const MAX_ACTIVE_SIEGE_MOBS = 30;

export class SiegeSystem {
  private siegeActive = false;
  private currentWave = 0;
  private ticksSinceWave = 0;
  private ticksSinceVictoryCheck = 0;

  /** Throttle mob count checks — only recount every 3 seconds (60 ticks) */
  private ticksSinceMobCount = 0;
  private lastMobCount = 0;

  /** Reusable Set for dimension deduplication in victory checks — avoids allocation */
  private checkedDimensions = new Set<string>();

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
        // Throttle mob count checks to every 3 seconds (60 ticks) during siege
        this.ticksSinceMobCount += 20;
        if (this.ticksSinceMobCount >= 60) {
          this.ticksSinceMobCount = 0;
          this.lastMobCount = this.countActiveSiegeMobs();
        }
        if (this.lastMobCount < MAX_ACTIVE_SIEGE_MOBS) {
          this.spawnWave();
          this.ticksSinceWave = 0;
          this.ticksSinceMobCount = 0; // Reset so next wave gets a fresh count
          this.lastMobCount = MAX_ACTIVE_SIEGE_MOBS; // Assume full until next recount
        }
        // If over cap, ticksSinceWave stays high so we re-check after throttle
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

  /** Count active siege mobs across all dimensions players are in */
  private countActiveSiegeMobs(): number {
    this.checkedDimensions.clear();
    let total = 0;

    for (const player of world.getAllPlayers()) {
      if (!player.isValid) continue;
      const dimId = player.dimension.id;
      if (this.checkedDimensions.has(dimId)) continue;
      this.checkedDimensions.add(dimId);

      try {
        const siegeMobs = player.dimension.getEntities({
          tags: ["mk_siege_mob"],
          location: player.location,
          maxDistance: 128,
        });
        total += siegeMobs.length;
      } catch {
        // Skip if dimension query fails
      }
    }

    return total;
  }

  private spawnWave(): void {
    if (this.currentWave >= WAVE_DEFINITIONS.length) return;

    const wave = WAVE_DEFINITIONS[this.currentWave];
    world.sendMessage(SIEGE_WAVE(wave.waveNumber, WAVE_DEFINITIONS.length));

    const players = world.getAllPlayers();
    const playerCount = players.length;

    // Scale spawn counts: solo gets full wave, multiplayer reduces per-player to stay under entity limits
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
    // Re-fetch player only when name changes or isValid fails (not every yield)
    const siegeRef = this;
    system.runJob(
      (function* () {
        let spawned = 0;
        let lastPlayerName = "";
        let cachedPlayer: Player | undefined;

        for (const entry of spawnQueue) {
          // Re-fetch player when name changes or when cached ref is stale
          if (entry.playerName !== lastPlayerName || !cachedPlayer?.isValid) {
            lastPlayerName = entry.playerName;
            cachedPlayer = undefined;
            for (const p of world.getAllPlayers()) {
              if (p.name === entry.playerName && p.isValid) {
                cachedPlayer = p;
                break;
              }
            }
          }

          if (cachedPlayer) {
            try {
              const loc = cachedPlayer.location;
              const angle = Math.random() * Math.PI * 2;
              const dist = 20 + Math.random() * 15;
              const spawnLoc = {
                x: loc.x + Math.cos(angle) * dist,
                y: loc.y,
                z: loc.z + Math.sin(angle) * dist,
              };

              const entity = cachedPlayer.dimension.spawnEntity(
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
            // Mid-wave entity cap check: pause spawning if over budget
            if (spawned % 5 === 0) {
              const currentCount = siegeRef.countActiveSiegeMobs();
              if (currentCount >= MAX_ACTIVE_SIEGE_MOBS) {
                // Wait until mobs die before continuing to spawn
                while (siegeRef.countActiveSiegeMobs() >= MAX_ACTIVE_SIEGE_MOBS) {
                  // Yield 60 times (~3 seconds) before rechecking
                  for (let w = 0; w < 60; w++) yield;
                }
              }
            }
          }
        }
      })()
    );

    this.currentWave++;
  }

  private checkVictory(): void {
    const totalSiegeMobs = this.countActiveSiegeMobs();

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
