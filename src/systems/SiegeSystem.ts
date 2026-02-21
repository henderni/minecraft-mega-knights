import { world, system, Player, Entity, EntityHealthComponent } from "@minecraft/server";
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
  SIEGE_BOSS_PHASE_2,
  SIEGE_BOSS_PHASE_3,
  ENDLESS_UNLOCKED,
  ENDLESS_DESC,
  ENDLESS_WAVE,
  ENDLESS_WAVE_CLEARED,
  ENDLESS_DEFEAT,
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

/** Endless mode mini-siege wave definitions — escalate with day count */
const ENDLESS_WAVES: { entityId: string; count: number }[][] = [
  // Wave set 0: light (day 120)
  [
    { entityId: "mk:mk_enemy_knight", count: 6 },
    { entityId: "mk:mk_enemy_archer", count: 4 },
  ],
  // Wave set 1: medium (day 140)
  [
    { entityId: "mk:mk_enemy_knight", count: 8 },
    { entityId: "mk:mk_enemy_archer", count: 5 },
    { entityId: "mk:mk_enemy_wizard", count: 3 },
  ],
  // Wave set 2: heavy (day 160+)
  [
    { entityId: "mk:mk_enemy_knight", count: 10 },
    { entityId: "mk:mk_enemy_dark_knight", count: 4 },
    { entityId: "mk:mk_enemy_wizard", count: 4 },
    { entityId: "mk:mk_enemy_archer", count: 6 },
  ],
];

export class SiegeSystem {
  /** Getter for enemy spawn multiplier — reads from DifficultySystem at spawn time */
  private enemyMultiplierGetter: (() => number) | null = null;

  /** Wire a dynamic getter for the enemy spawn multiplier (called from main.ts) */
  setEnemyMultiplierGetter(getter: () => number): void {
    this.enemyMultiplierGetter = getter;
  }

  private get enemyMultiplier(): number {
    return this.enemyMultiplierGetter?.() ?? 1.0;
  }

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

  /** Reference to the Siege Lord entity for phase tracking */
  private bossEntity: Entity | null = null;
  /** Current phase: 0=normal, 1=phase2 (66%), 2=phase3 (33%) */
  private siegePhase = 0;

  /** Whether this is an endless mode mini-siege (no boss, simpler victory) */
  private isEndlessSiege = false;

  /** Callback fired on siege victory — used to enable endless mode */
  private onVictoryCallback: (() => void) | null = null;

  /** Register a callback for siege victory (called from main.ts) */
  onVictory(callback: () => void): void {
    this.onVictoryCallback = callback;
  }

  /** Check if siege is currently active — used by camp system to avoid spawning during siege */
  isActive(): boolean {
    return this.siegeActive;
  }

  startSiege(): void {
    if (this.siegeActive) {
      return;
    }

    this.siegeActive = true;
    this.currentWave = 0;
    this.ticksSinceWave = 0;
    this.ticksSinceVictoryCheck = 0;
    this.ticksSinceRecount = 0;
    this.siegeMobCount = 0;
    this.activeSpawnJobs = 0;
    this.bossEntity = null;
    this.siegePhase = 0;
    this.isEndlessSiege = false;

    world.sendMessage(SIEGE_BEGIN);
    world.sendMessage(SIEGE_DEFEND);
    // Ominous horn for siege start
    for (const p of world.getAllPlayers()) {
      try { p.runCommand("playsound mob.wither.spawn @s ~ ~ ~ 0.5 0.5"); } catch { /* */ }
    }

    this.spawnWave();
  }

  /** Start an endless mode mini-siege — simpler than the main siege, no boss */
  startEndlessSiege(day: number): void {
    if (this.siegeActive) {
      return;
    }

    this.siegeActive = true;
    this.isEndlessSiege = true;
    this.currentWave = 0;
    this.ticksSinceWave = 0;
    this.ticksSinceVictoryCheck = 0;
    this.ticksSinceRecount = 0;
    this.siegeMobCount = 0;
    this.activeSpawnJobs = 0;
    this.bossEntity = null;
    this.siegePhase = 0;

    world.sendMessage(ENDLESS_WAVE(day));

    // Select wave set based on day — escalates over time
    const waveIndex = Math.min(Math.floor((day - 100) / 40), ENDLESS_WAVES.length - 1);
    const spawns = ENDLESS_WAVES[waveIndex];

    this.spawnEndlessWave(spawns);
  }

  /** Subscribe to entity death events to decrement siege mob counter
   *  and detect total party defeat.
   *  Must be called once during system setup (from main.ts). */
  setupDeathListener(): void {
    world.afterEvents.entityDie.subscribe((event) => {
      if (!this.siegeActive) {
        return;
      }
      const dead = event.deadEntity;

      if (dead.hasTag("mk_siege_mob")) {
        this.siegeMobCount = Math.max(0, this.siegeMobCount - 1);
      }

      // Player death during siege — check if ALL players are dead
      if (dead.typeId === "minecraft:player") {
        system.run(() => {
          if (!this.siegeActive) {
            return;
          }
          const players = world.getAllPlayers();
          if (players.length === 0) {
            return;
          }

          let anyAlive = false;
          for (const p of players) {
            if (!p.isValid) {
              continue;
            }
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
    if (!this.siegeActive) {
      return;
    }

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

    // Boss phase check — only when boss has been spawned
    if (this.bossEntity !== null) {
      this.checkBossPhase();
    }
  }

  private spawnWave(): void {
    if (this.currentWave >= WAVE_DEFINITIONS.length) {
      return;
    }

    const wave = WAVE_DEFINITIONS[this.currentWave];
    world.sendMessage(SIEGE_WAVE(wave.waveNumber, WAVE_DEFINITIONS.length));
    // Drum beat for each wave
    for (const p of world.getAllPlayers()) {
      try { p.runCommand("playsound note.bd @s ~ ~ ~ 1 0.6"); } catch { /* */ }
    }

    const players = world.getAllPlayers();
    const playerCount = players.length;

    // Scale spawn counts: solo gets full wave, multiplayer reduces per-player to stay under entity limits
    const mpScale = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;

    // Build a flat spawn queue with scaled counts per player
    const spawnQueue: { entityId: string; playerName: string }[] = [];

    for (const player of players) {
      if (!player.isValid) {
        continue;
      }
      let playerSpawns = 0;
      for (const spawn of wave.spawns) {
        const scaledCount = Math.max(1, Math.round(spawn.count * this.enemyMultiplier * mpScale));
        for (let i = 0; i < scaledCount; i++) {
          if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) {
            break;
          }
          spawnQueue.push({ entityId: spawn.entityId, playerName: player.name });
          playerSpawns++;
        }
        if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) {
          break;
        }
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
          if (p.isValid) {
            playerMap.set(p.name, p);
          }
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

              const entity = cachedPlayer.dimension.spawnEntity(entry.entityId, spawnLoc);
              entity.addTag("mk_siege_mob");
              siegeRef.siegeMobCount++;

              // Capture boss entity reference for phase tracking
              if (entry.entityId === "mk:mk_boss_siege_lord") {
                siegeRef.bossEntity = entity;
              }
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
                if (p.isValid) {
                  playerMap.set(p.name, p);
                }
              }
              // Mid-wave entity cap check: pause spawning if over budget.
              // Yield one tick at a time so the generator stays responsive
              // and resumes promptly once mobs die. The main tick() also gates
              // wave *starts* via the same cap, so this only affects mid-wave pauses.
              while (siegeRef.siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS) {
                yield;
              }
              // Refresh player map after pause
              if (siegeRef.siegeMobCount < MAX_ACTIVE_SIEGE_MOBS) {
                playerMap.clear();
                for (const p of world.getAllPlayers()) {
                  if (p.isValid) {
                    playerMap.set(p.name, p);
                  }
                }
              }
            }
          }
        }

        // Signal that this wave's spawning is complete — unblocks victory check
        siegeRef.activeSpawnJobs = Math.max(0, siegeRef.activeSpawnJobs - 1);
      })(),
    );

    this.currentWave++;
  }

  /** Spawn a single endless wave (no multi-wave progression) */
  private spawnEndlessWave(spawns: { entityId: string; count: number }[]): void {
    const players = world.getAllPlayers();
    const playerCount = players.length;
    const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;

    const spawnQueue: { entityId: string; playerName: string }[] = [];
    for (const player of players) {
      if (!player.isValid) {
        continue;
      }
      let playerSpawns = 0;
      for (const spawn of spawns) {
        const scaledCount = Math.max(1, Math.round(spawn.count * this.enemyMultiplier * scaleFactor));
        for (let i = 0; i < scaledCount; i++) {
          if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) {
            break;
          }
          spawnQueue.push({ entityId: spawn.entityId, playerName: player.name });
          playerSpawns++;
        }
        if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) {
          break;
        }
      }
    }

    const siegeRef = this;
    const initialPlayers = players;
    this.activeSpawnJobs++;
    system.runJob(
      (function* () {
        let spawned = 0;
        const playerMap = new Map<string, Player>();
        for (const p of initialPlayers) {
          if (p.isValid) {
            playerMap.set(p.name, p);
          }
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
              const entity = cachedPlayer.dimension.spawnEntity(entry.entityId, spawnLoc);
              entity.addTag("mk_siege_mob");
              siegeRef.siegeMobCount++;
            } catch {
              // Chunk not loaded or entity limit reached
            }
          }
          spawned++;
          if (spawned % SPAWNS_PER_TICK === 0) {
            yield;
            if (spawned % 5 === 0) {
              playerMap.clear();
              for (const p of world.getAllPlayers()) {
                if (p.isValid) {
                  playerMap.set(p.name, p);
                }
              }
              while (siegeRef.siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS) {
                yield;
              }
              // Refresh player map after cap pause — players may have moved/disconnected
              playerMap.clear();
              for (const p of world.getAllPlayers()) {
                if (p.isValid) {
                  playerMap.set(p.name, p);
                }
              }
            }
          }
        }
        siegeRef.activeSpawnJobs = Math.max(0, siegeRef.activeSpawnJobs - 1);
      })(),
    );

    // Mark that we've used one "wave" so victory check doesn't wait for more
    this.currentWave = WAVE_DEFINITIONS.length;
  }

  private endSiege(victory: boolean): void {
    const wasEndless = this.isEndlessSiege;
    this.bossEntity = null;
    this.siegePhase = 0;
    this.siegeActive = false;
    this.isEndlessSiege = false;

    if (wasEndless) {
      if (victory) {
        world.sendMessage(ENDLESS_WAVE_CLEARED);
      } else {
        world.sendMessage(ENDLESS_DEFEAT);
      }
      return;
    }

    if (victory) {
      world.sendMessage(SIEGE_VICTORY_1);
      world.sendMessage(SIEGE_VICTORY_2);
      world.sendMessage(SIEGE_VICTORY_3);

      for (const player of world.getAllPlayers()) {
        if (!player.isValid) {
          continue;
        }
        player.onScreenDisplay.setTitle(SIEGE_VICTORY_TITLE, {
          subtitle: SIEGE_VICTORY_SUBTITLE,
          fadeInDuration: 20,
          stayDuration: 100,
          fadeOutDuration: 20,
        });
        // Play victory fanfare
        player.runCommand("playsound random.totem @s ~ ~ ~ 1 1");
      }

      // Enable endless mode after a short delay for dramatic effect
      system.runTimeout(() => {
        world.sendMessage(ENDLESS_UNLOCKED);
        world.sendMessage(ENDLESS_DESC);
        if (this.onVictoryCallback) {
          this.onVictoryCallback();
        }
      }, 100); // 5 seconds after victory
    } else {
      world.sendMessage(SIEGE_DEFEAT_1);
      world.sendMessage(SIEGE_DEFEAT_2);
      world.sendMessage(SIEGE_DEFEAT_3);
    }
  }

  private checkBossPhase(): void {
    if (!this.bossEntity) {return;}
    try {
      if (!this.bossEntity.isValid) {
        this.bossEntity = null;
        return;
      }
      const hp = this.bossEntity.getComponent("minecraft:health") as EntityHealthComponent | undefined;
      if (!hp) {return;}
      const ratio = hp.currentValue / hp.effectiveMax;
      if (ratio <= 0.33 && this.siegePhase < 2) {
        this.siegePhase = 2;
        this.bossEntity.triggerEvent("mk:enter_phase_3");
        world.sendMessage(SIEGE_BOSS_PHASE_3);
      } else if (ratio <= 0.66 && this.siegePhase < 1) {
        this.siegePhase = 1;
        this.bossEntity.triggerEvent("mk:enter_phase_2");
        world.sendMessage(SIEGE_BOSS_PHASE_2);
      }
    } catch {
      // Entity removed or in unloaded chunk
      this.bossEntity = null;
    }
  }
}
