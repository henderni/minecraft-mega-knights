import { world, system, Player, Dimension, Vector3, ItemStack } from "@minecraft/server";
import {
  CAMP_TIERS,
  getCampTierForDay,
  CAMP_SPAWN_MIN_DIST,
  CAMP_SPAWN_MAX_DIST,
  CAMP_COOLDOWN_DAYS,
  CAMP_START_DAY,
  MAX_CAMP_GUARDS,
  CampTierDef,
} from "../data/CampDefinitions";
import { CAMP_SPAWNED, CAMP_CLEARED, CAMP_DEBUG_SPAWNED } from "../data/Strings";
import { getFactionForBiome, FACTION_GUARD_WEIGHTS, FactionDef, FactionId } from "../data/FactionDefinitions";
import { MILESTONE_DAYS } from "../data/MilestoneEvents";
import { findGroundLevel } from "./MerchantSystem";

const CMDS_PER_TICK = 2;
const SPAWNS_PER_TICK = 1;

let nextCampId = 1;
const MAX_CAMP_ID = 1_000_000;

interface CampState {
  campId: string;
  playerName: string;
  location: Vector3;
  dimensionId: string;
  tier: CampTierDef;
  guardCount: number;
  daySpawned: number;
  spawningComplete: boolean;
  cleared: boolean;
  factionId: FactionId | undefined;
}

export class EnemyCampSystem {
  private activeCamps = new Map<string, CampState>();
  private lastCampDay = new Map<string, number>();
  private cachedPlayerMap = new Map<string, Player>();

  /** Getter for enemy spawn multiplier — reads from DifficultySystem at spawn time */
  private enemyMultiplierGetter: (() => number) | null = null;

  /** Wire a dynamic getter for the enemy spawn multiplier (called from main.ts) */
  setEnemyMultiplierGetter(getter: () => number): void {
    this.enemyMultiplierGetter = getter;
  }

  private get enemyMultiplier(): number {
    return this.enemyMultiplierGetter?.() ?? 1.0;
  }

  /** Clear all active camps — used by mk:reset */
  clearAllCamps(): void {
    this.activeCamps.clear();
    this.lastCampDay.clear();
    this.cachedPlayerMap.clear();
  }

  /**
   * Evaluate camp spawning on day change.
   * Called from dayCounter.onDayChanged() in main.ts.
   */
  onDayChanged(day: number, siegeActive: boolean): void {
    if (day < CAMP_START_DAY) {return;}
    if (siegeActive) {return;}
    if (MILESTONE_DAYS.has(day)) {return;}

    const tier = getCampTierForDay(day);
    if (!tier) {return;}

    const players = world.getAllPlayers();
    const playerCount = players.length;
    const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;

    for (const player of players) {
      if (!player.isValid) {continue;}
      const name = player.name;

      if (this.activeCamps.has(name)) {continue;}

      const lastDay = this.lastCampDay.get(name) ?? 0;
      if (day - lastDay < CAMP_COOLDOWN_DAYS) {continue;}

      this.spawnCamp(player, day, tier, scaleFactor);
    }
  }

  /**
   * Subscribe to entity death events to track camp guard kills.
   * Call once during setup from main.ts.
   */
  setupDeathListener(): void {
    world.afterEvents.entityDie.subscribe((event) => {
      const dead = event.deadEntity;
      if (!dead.hasTag("mk_camp_guard")) {return;}

      for (const [playerName, camp] of this.activeCamps) {
        if (dead.hasTag(`mk_camp_${camp.campId}`)) {
          camp.guardCount = Math.max(0, camp.guardCount - 1);
          if (camp.guardCount <= 0 && camp.spawningComplete && !camp.cleared) {
            this.campCleared(playerName, camp);
          }
          return;
        }
      }
    });
  }

  /**
   * Safety recount — call every 200 ticks from main.ts.
   * Corrects guard counts that drifted from despawns in unloaded chunks.
   */
  tick(): void {
    this.cachedPlayerMap.clear();
    for (const p of world.getAllPlayers()) {
      if (p.isValid) {
        this.cachedPlayerMap.set(p.name, p);
      }
    }

    for (const [playerName, camp] of this.activeCamps) {
      if (!camp.spawningComplete) {continue;}

      try {
        const dim = world.getDimension(camp.dimensionId);
        const guards = dim.getEntities({
          tags: ["mk_camp_guard", `mk_camp_${camp.campId}`],
          location: camp.location,
          maxDistance: 64,
        });
        camp.guardCount = guards.length;

        if (camp.guardCount <= 0 && !camp.cleared) {
          this.campCleared(playerName, camp);
        }
      } catch {
        // Dimension query failed — skip this cycle
      }
    }
  }

  /** Force-spawn a camp for the issuing player (debug command). */
  debugSpawnCamp(player: Player, currentDay: number): void {
    this.activeCamps.delete(player.name);
    const tier = getCampTierForDay(currentDay) ?? CAMP_TIERS[0];
    this.spawnCamp(player, currentDay, tier, 1.0);
    player.sendMessage(CAMP_DEBUG_SPAWNED);
  }

  private spawnCamp(player: Player, day: number, tier: CampTierDef, scaleFactor: number): void {
    const campId = String(nextCampId);
    nextCampId = (nextCampId + 1) % MAX_CAMP_ID;
    const angle = Math.random() * Math.PI * 2;
    const dist = CAMP_SPAWN_MIN_DIST + Math.random() * (CAMP_SPAWN_MAX_DIST - CAMP_SPAWN_MIN_DIST);
    const rawX = player.location.x + Math.cos(angle) * dist;
    const rawZ = player.location.z + Math.sin(angle) * dist;

    const dimension = player.dimension;
    const groundY = findGroundLevel(dimension, Math.floor(rawX), Math.floor(player.location.y), Math.floor(rawZ), 15);

    if (groundY === null) {
      console.warn(`[MegaKnights] Camp spawn skipped: no solid ground at ${Math.floor(rawX)}, ${Math.floor(rawZ)}`);
      return;
    }

    const campLocation: Vector3 = {
      x: Math.floor(rawX),
      y: groundY + 1,
      z: Math.floor(rawZ),
    };

    // Faction selection based on biome
    let faction: FactionDef | undefined;
    let displayName = tier.name;
    try {
      const biome = dimension.getBiome(campLocation);
      const selected = getFactionForBiome((biome as { id?: string }).id ?? "");
      faction = selected;
      displayName = `${selected.campPrefix} ${tier.name}`;
    } catch {
      // Biome API unavailable — use default tier name
    }

    const camp: CampState = {
      campId,
      playerName: player.name,
      location: campLocation,
      dimensionId: dimension.id,
      tier,
      guardCount: 0,
      daySpawned: day,
      spawningComplete: false,
      cleared: false,
      factionId: faction?.id,
    };

    this.activeCamps.set(player.name, camp);
    this.lastCampDay.set(player.name, day);

    const direction = this.getCompassDirection(angle);
    player.sendMessage(CAMP_SPAWNED(displayName, direction));
    try { player.runCommand("playsound note.pling @s ~ ~ ~ 1 0.8"); } catch { /* */ }

    this.buildCampStructure(dimension, campLocation, tier.structureSize, () => {
      this.spawnGuards(camp, scaleFactor, faction);
    });
  }

  private buildCampStructure(
    dimension: Dimension,
    origin: Vector3,
    size: 7 | 9,
    onComplete: () => void,
  ): void {
    // Try .mcstructure file first (allows dropping pre-built files in structures/ later)
    const structureId = size === 7 ? "mk:camp_small" : "mk:camp_large";
    try {
      world.structureManager.place(structureId, dimension, origin);
      onComplete();
      return;
    } catch {
      // Structure file not present — fall through to command-based fallback
    }

    const commands = size === 7 ? this.getSmallCampCommands(origin) : this.getLargeCampCommands(origin);

    system.runJob(
      (function* () {
        let executed = 0;
        for (const cmd of commands) {
          try {
            dimension.runCommand(cmd);
          } catch (e) {
            console.warn(`[MegaKnights] Camp build command failed: ${e}`);
          }
          executed++;
          if (executed % CMDS_PER_TICK === 0) {
            yield;
          }
        }
        onComplete();
      })(),
    );
  }

  private getSmallCampCommands(origin: Vector3): string[] {
    const x = Math.floor(origin.x);
    const y = Math.floor(origin.y);
    const z = Math.floor(origin.z);
    return [
      // Foundation
      `fill ${x - 3} ${y - 1} ${z - 3} ${x + 3} ${y - 1} ${z + 3} coarse_dirt`,
      // North fence wall
      `fill ${x - 3} ${y} ${z + 3} ${x + 3} ${y} ${z + 3} oak_fence`,
      // South fence wall with entrance gap at center
      `fill ${x - 3} ${y} ${z - 3} ${x - 1} ${y} ${z - 3} oak_fence`,
      `fill ${x + 1} ${y} ${z - 3} ${x + 3} ${y} ${z - 3} oak_fence`,
      // East fence wall
      `fill ${x + 3} ${y} ${z - 2} ${x + 3} ${y} ${z + 2} oak_fence`,
      // West fence wall
      `fill ${x - 3} ${y} ${z - 2} ${x - 3} ${y} ${z + 2} oak_fence`,
      // Soul campfire center
      `setblock ${x} ${y} ${z} soul_campfire`,
      // Oak log benches
      `setblock ${x - 1} ${y} ${z + 1} oak_log ["pillar_axis":"x"]`,
      `setblock ${x + 1} ${y} ${z + 1} oak_log ["pillar_axis":"x"]`,
      // Corner fence spikes
      `setblock ${x - 3} ${y + 1} ${z - 3} oak_fence`,
      `setblock ${x + 3} ${y + 1} ${z - 3} oak_fence`,
      `setblock ${x - 3} ${y + 1} ${z + 3} oak_fence`,
      `setblock ${x + 3} ${y + 1} ${z + 3} oak_fence`,
    ];
  }

  private getLargeCampCommands(origin: Vector3): string[] {
    const x = Math.floor(origin.x);
    const y = Math.floor(origin.y);
    const z = Math.floor(origin.z);
    const cmds: string[] = [
      // Foundation layers
      `fill ${x - 4} ${y - 1} ${z - 4} ${x + 4} ${y - 1} ${z + 4} coarse_dirt`,
      `fill ${x - 2} ${y - 1} ${z - 2} ${x + 2} ${y - 1} ${z + 2} gravel`,
      // North fence wall
      `fill ${x - 4} ${y} ${z + 4} ${x + 4} ${y} ${z + 4} spruce_fence`,
      // South fence wall with entrance gap
      `fill ${x - 4} ${y} ${z - 4} ${x - 2} ${y} ${z - 4} spruce_fence`,
      `fill ${x + 2} ${y} ${z - 4} ${x + 4} ${y} ${z - 4} spruce_fence`,
      // East fence wall
      `fill ${x + 4} ${y} ${z - 3} ${x + 4} ${y} ${z + 3} spruce_fence`,
      // West fence wall
      `fill ${x - 4} ${y} ${z - 3} ${x - 4} ${y} ${z + 3} spruce_fence`,
      // Soul campfire center
      `setblock ${x} ${y} ${z} soul_campfire`,
      // Crafting table and barrel
      `setblock ${x + 2} ${y} ${z + 2} crafting_table`,
      `setblock ${x + 3} ${y} ${z + 2} barrel`,
      // Small tent (spruce planks base, red wool roof)
      `fill ${x - 3} ${y} ${z + 2} ${x - 2} ${y} ${z + 3} spruce_planks`,
      `fill ${x - 3} ${y + 1} ${z + 2} ${x - 2} ${y + 1} ${z + 3} red_wool`,
      `setblock ${x - 3} ${y + 2} ${z + 2} red_wool`,
    ];
    // Corner cobblestone posts (2 tall)
    for (const [dx, dz] of [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ] as [number, number][]) {
      cmds.push(`fill ${x + dx} ${y} ${z + dz} ${x + dx} ${y + 1} ${z + dz} cobblestone`);
    }
    return cmds;
  }

  private spawnGuards(camp: CampState, scaleFactor: number, faction?: FactionDef): void {
    const spawnQueue: string[] = [];
    const weights = faction ? FACTION_GUARD_WEIGHTS[faction.id] : {};
    for (const guardDef of camp.tier.guards) {
      const factionWeight = weights[guardDef.entityId] ?? 1.0;
      const scaledCount = Math.max(0, Math.round(guardDef.count * this.enemyMultiplier * scaleFactor * factionWeight));
      for (let i = 0; i < scaledCount; i++) {
        spawnQueue.push(guardDef.entityId);
      }
    }
    // Ensure at least 1 guard even with aggressive faction weights
    if (spawnQueue.length === 0 && camp.tier.guards.length > 0) {
      spawnQueue.push(camp.tier.guards[0].entityId);
    }

    if (spawnQueue.length > MAX_CAMP_GUARDS) {
      spawnQueue.length = MAX_CAMP_GUARDS;
    }

    const campRef = camp;
    const loc = camp.location;
    const dimId = camp.dimensionId;

    system.runJob(
      (function* () {
        let spawned = 0;
        let dimension;
        try {
          dimension = world.getDimension(dimId);
        } catch (e) {
          console.warn(`[MegaKnights] Camp guard spawn failed — invalid dimension ${dimId}: ${e}`);
        }

        if (dimension) {
          for (const entityId of spawnQueue) {
            const offsetX = (Math.random() - 0.5) * 6;
            const offsetZ = (Math.random() - 0.5) * 6;
            const spawnLoc = { x: loc.x + offsetX, y: loc.y, z: loc.z + offsetZ };

            try {
              const entity = dimension.spawnEntity(entityId, spawnLoc);
              entity.addTag("mk_camp_guard");
              entity.addTag(`mk_camp_${campRef.campId}`);
              try {
                entity.triggerEvent("mk:become_camp_guard");
              } catch {
                // Event not yet present — entity still functional with default despawn
              }
              campRef.guardCount++;
            } catch (e) {
              console.warn(`[MegaKnights] Camp guard spawn failed: ${e}`);
            }

            spawned++;
            if (spawned % SPAWNS_PER_TICK === 0) {
              yield;
            }
          }
        }

        campRef.spawningComplete = true;
      })(),
    );
  }

  private campCleared(playerName: string, camp: CampState): void {
    camp.cleared = true;
    this.activeCamps.delete(playerName);

    const player = this.cachedPlayerMap.get(playerName);
    if (player?.isValid) {
      player.sendMessage(CAMP_CLEARED(camp.tier.name));
    }

    this.dropRewards(camp);
  }

  private dropRewards(camp: CampState): void {
    const rewards = camp.tier.rewards;
    const loc = camp.location;
    const dimId = camp.dimensionId;

    system.runJob(
      (function* () {
        let dimension;
        try {
          dimension = world.getDimension(dimId);
        } catch (e) {
          console.warn(`[MegaKnights] Camp reward drop failed — invalid dimension ${dimId}: ${e}`);
          return;
        }
        let executed = 0;

        for (const reward of rewards) {
          const count = reward.min + Math.floor(Math.random() * (reward.max - reward.min + 1));
          if (count <= 0) {continue;}

          try {
            const item = new ItemStack(reward.itemId, count);
            dimension.spawnItem(item, {
              x: Math.floor(loc.x),
              y: Math.floor(loc.y) + 1,
              z: Math.floor(loc.z),
            });
          } catch (e) {
            console.warn(`[MegaKnights] Camp reward drop failed: ${e}`);
          }

          executed++;
          if (executed % CMDS_PER_TICK === 0) {
            yield;
          }
        }
      })(),
    );
  }

  private getCompassDirection(angle: number): string {
    // cos(angle) = X offset (+X = East), sin(angle) = Z offset (+Z = South)
    const deg = (((angle * 180) / Math.PI) % 360 + 360) % 360;
    if (deg < 22.5 || deg >= 337.5) {return "East";}
    if (deg < 67.5) {return "Southeast";}
    if (deg < 112.5) {return "South";}
    if (deg < 157.5) {return "Southwest";}
    if (deg < 202.5) {return "West";}
    if (deg < 247.5) {return "Northwest";}
    if (deg < 292.5) {return "North";}
    return "Northeast";
  }
}
