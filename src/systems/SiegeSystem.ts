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

/** Ticks between safety-net getEntities() recounts to correct counter drift (every 30 seconds).
 *  Mobs can despawn (unloaded chunks, minecraft:despawn) without firing entityDie. */
const RECOUNT_INTERVAL = 600;

/** Maximum active siege mobs before delaying next wave — keeps total custom entities under 60 on Switch */
const MAX_ACTIVE_SIEGE_MOBS = 25;

export class SiegeSystem {
  private siegeActive = false;
  private currentWave = 0;
  private ticksSinceWave = 0;
  private ticksSinceVictoryCheck = 0;
  private ticksSinceRecount = 0;

  /** Spawn/death counter for siege mobs — avoids expensive getEntities() calls entirely.
   *  Incremented on successful spawn, decremented via death event subscription. */
  private siegeMobCount = 0;

  /** Number of active wave spawn generators still running.
   *  Victory check is blocked until all generators complete, preventing premature
   *  victory if siegeMobCount briefly hits 0 mid-spawn. */
  private activeSpawnJobs = 0;

  startSiege(): void {
    if (this.siegeActive) return;

    this.siegeActive = true;
    this.currentWave = 0;
    this.ticksSinceWave = 0;
    this.ticksSinceVictoryCheck = 0;
    this.ticksSinceRecount = 0;
    this.siegeMobCount = 0;
    this.activeSpawnJobs = 0;

    world.sendMessage(SIEGE_BEGIN);
    world.sendMessage(SIEGE_DEFEND);

    this.spawnWave();
  }

  /** Subscribe to entity death events to decrement siege mob counter
   *  and detect total party defeat.
   *  Must be called once during system setup (from main.ts). */
  setupDeathListener(): void {
    world.afterEvents.entityDie.subscribe((event) => {
      if (!this.siegeActive) return;
      const dead = event.deadEntity;

      if (dead.hasTag("mk_siege_mob")) {
        this.siegeMobCount = Math.max(0, this.siegeMobCount - 1);
      }

      // Player death during siege — check if ALL players are dead
      if (dead.typeId === "minecraft:player") {
        system.run(() => {
          if (!this.siegeActive) return;
          const players = world.getAllPlayers();
          if (players.length === 0) return;

          let anyAlive = false;
          for (const p of players) {
            if (!p.isValid) continue;
            try {
              const health = p.getComponent("minecraft:health");
              if (health && health.currentValue > 0) {
                anyAlive = true;
                break;
              }
            } catch {
              // Can't check — assume dead
            }
          }

          if (!anyAlive) {
            this.endSiege(false);
          }
        });
      }
    });
  }

  tick(): void {
    if (!this.siegeActive) return;

    this.ticksSinceWave += 20; // called every 20 ticks

    // Check if it's time for the next wave
    if (this.currentWave < WAVE_DEFINITIONS.length) {
      const wave = WAVE_DEFINITIONS[this.currentWave];
      if (this.ticksSinceWave >= wave.delayTicks) {
        if (this.siegeMobCount < MAX_ACTIVE_SIEGE_MOBS) {
          this.spawnWave();
          this.ticksSinceWave = 0;
        }
        // If over cap, ticksSinceWave stays high so we re-check next tick()
      }
    }

    // Safety-net recount: correct siegeMobCount drift from despawns (unloaded chunks, etc.)
    // Runs every 30s — infrequent enough to not impact performance, but catches counter drift.
    this.ticksSinceRecount += 20;
    if (this.ticksSinceRecount >= RECOUNT_INTERVAL) {
      this.ticksSinceRecount = 0;
      try {
        // Query overworld without location constraint for global accuracy
        // Siege always happens in the overworld; no distance filter avoids missing despawned-far mobs
        const overworld = world.getDimension("overworld");
        const actual = overworld.getEntities({ tags: ["mk_siege_mob"] });
        this.siegeMobCount = actual.length;
      } catch {
        // Dimension query may fail during world load
      }
    }

    // Check victory condition — throttled to every VICTORY_CHECK_INTERVAL ticks.
    // Requires all wave generators to have completed (activeSpawnJobs === 0)
    // to prevent premature victory while the last wave is still spawning.
    if (this.currentWave >= WAVE_DEFINITIONS.length && this.activeSpawnJobs === 0) {
      this.ticksSinceVictoryCheck += 20;
      if (this.ticksSinceVictoryCheck >= VICTORY_CHECK_INTERVAL) {
        this.ticksSinceVictoryCheck = 0;
        if (this.siegeMobCount <= 0) {
          this.endSiege(true);
        }
      }
    }
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
    // Uses a player Map refreshed only at yield boundaries — avoids getAllPlayers per name lookup
    const siegeRef = this;
    // Reuse the outer players array for the initial map (avoids double getAllPlayers on same tick)
    const initialPlayers = players;
    this.activeSpawnJobs++;
    system.runJob(
      (function* () {
        let spawned = 0;
        // Build player map from outer array; refresh with getAllPlayers only every 5th yield
        const playerMap = new Map<string, Player>();
        for (const p of initialPlayers) {
          if (p.isValid) playerMap.set(p.name, p);
        }

        for (const entry of spawnQueue) {
          const cachedPlayer = playerMap.get(entry.playerName);

          if (cachedPlayer?.isValid) {
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
              siegeRef.siegeMobCount++;
            } catch {
              // Chunk not loaded or entity limit reached
            }
          }

          spawned++;
          if (spawned % SPAWNS_PER_TICK === 0) {
            yield;
            // Refresh player map every 5th yield — balances staleness vs bridge call cost
            if (spawned % 5 === 0) {
              playerMap.clear();
              for (const p of world.getAllPlayers()) {
                if (p.isValid) playerMap.set(p.name, p);
              }
              // Mid-wave entity cap check: pause spawning if over budget
              if (siegeRef.siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS) {
                // Wait until mobs die before continuing to spawn (max 5 retries to prevent infinite spin)
                let retries = 0;
                while (siegeRef.siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS && retries < 5) {
                  // Yield 120 times (~6 seconds) before rechecking — longer pause when Switch is under load
                  for (let w = 0; w < 120; w++) yield;
                  retries++;
                }
                // Refresh player map after long wait
                playerMap.clear();
                for (const p of world.getAllPlayers()) {
                  if (p.isValid) playerMap.set(p.name, p);
                }
              }
            }
          }
        }

        // Signal that this wave's spawning is complete — unblocks victory check
        siegeRef.activeSpawnJobs = Math.max(0, siegeRef.activeSpawnJobs - 1);
      })()
    );

    this.currentWave++;
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
