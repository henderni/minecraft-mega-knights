import {
  world,
  system,
  Player,
  Entity,
  Dimension,
  Vector3,
  EntityHealthComponent,
  PlayerInteractWithEntityAfterEvent,
} from "@minecraft/server";
import {
  ARMY_FULL,
  ARMY_FULL_SHARED,
  ALLY_RECRUITED,
  ALLY_NOT_YOURS,
  ALLY_INFO,
  ALLY_MODE_SET,
  ALLY_DIED,
  DEBUG_ALLIES_SPAWNED,
} from "../data/Strings";
import { generateAllyName } from "../data/AllyNames";

/** Max castle troop bonus a player can accumulate (+20 = all 3 structures) */
const MAX_ARMY_BONUS = 20;

/** Global army entity budget — in multiplayer, each player gets floor(GLOBAL/playerCount).
 *  Must satisfy: GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS (25) ≤ 60 (Switch siege budget). */
export const GLOBAL_ARMY_CAP = 35;

/** Cache for sanitized player tags — player names don't change during a session */
const tagCache = new Map<string, string>();

/** Cache for fully-built owner tags (e.g. "mk_owner_PlayerName") — avoids string concat per use */
const ownerTagCache = new Map<string, string>();

/** Max cached player names — prevents unbounded growth on long-running servers */
const MAX_TAG_CACHE = 100;

/** Sanitize player name for use in entity tags (only alphanum, underscore, hyphen allowed) */
export function sanitizePlayerTag(name: string): string {
  let cached = tagCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  if (tagCache.size >= MAX_TAG_CACHE) {
    tagCache.clear();
  }
  cached = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  tagCache.set(name, cached);
  return cached;
}

/** Get the full owner tag string for a player name — cached to avoid repeat concat */
export function getOwnerTag(name: string): string {
  let cached = ownerTagCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  if (ownerTagCache.size >= MAX_TAG_CACHE) {
    ownerTagCache.clear();
  }
  cached = `mk_owner_${sanitizePlayerTag(name)}`;
  ownerTagCache.set(name, cached);
  return cached;
}

/** Pre-computed display names for known ally types — avoids string manipulation on every recruit */
const ALLY_DISPLAY_NAMES = new Map<string, string>([
  ["mk:mk_ally_knight", "Knight"],
  ["mk:mk_ally_archer", "Archer"],
  ["mk:mk_ally_wizard", "Wizard"],
  ["mk:mk_ally_dark_knight", "Dark Knight"],
]);

export class ArmySystem {
  private static readonly BASE_ARMY_SIZE = 15;

  /** Cached player map — refreshed on every army recount tick (~10s). Keyed by name for O(1) lookup in death listener. */
  private cachedPlayerMap = new Map<string, Player>();

  /** Derive a display name from an ally type ID — uses pre-computed cache */
  private static allyDisplayName(allyTypeId: string): string {
    const cached = ALLY_DISPLAY_NAMES.get(allyTypeId);
    if (cached) {
      return cached;
    }
    // Fallback for unknown types
    const raw = allyTypeId.replace("mk:mk_ally_", "").replace(/_/g, " ");
    const name = raw
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    ALLY_DISPLAY_NAMES.set(allyTypeId, name);
    return name;
  }

  /** Get the current max army size for a player (base + castle bonuses, clamped) */
  getMaxArmySize(player: Player): number {
    const bonus = (player.getDynamicProperty("mk:army_bonus") as number) ?? 0;
    return ArmySystem.BASE_ARMY_SIZE + Math.min(bonus, MAX_ARMY_BONUS);
  }

  /** Compute effective army cap accounting for multiplayer scaling — used by HUD */
  static getEffectiveCap(armyBonus: number, playerCount: number): number {
    const personalCap = ArmySystem.BASE_ARMY_SIZE + Math.min(armyBonus, MAX_ARMY_BONUS);
    if (playerCount <= 1) {
      return personalCap;
    }
    return Math.min(personalCap, Math.floor(GLOBAL_ARMY_CAP / playerCount));
  }

  /** Add troop capacity from placing a castle structure (capped) */
  addTroopBonus(player: Player, bonus: number): void {
    const current = (player.getDynamicProperty("mk:army_bonus") as number) ?? 0;
    const capped = Math.min(current + bonus, MAX_ARMY_BONUS);
    player.setDynamicProperty("mk:army_bonus", capped);
  }

  recruitAlly(player: Player, enemyTypeId: string, location: Vector3, dimension: Dimension): void {
    if (!player.isValid) {
      return;
    }

    // Count actual live entities rather than trusting the cached dynamic property.
    // This prevents the cap from being bypassed via externally modified player data.
    // recruitAlly() is not a hot path (30% kill-chance trigger) so getEntities() is acceptable here.
    const ownerTag = getOwnerTag(player.name);
    let actualCount: number;
    try {
      const allies = player.dimension.getEntities({
        tags: ["mk_army", ownerTag],
        location: player.location,
        maxDistance: 96,
      });
      actualCount = allies.length;
    } catch {
      // Dimension query failed — fall back to the stored value, clamped conservatively
      actualCount = Math.max(
        0,
        Math.min(GLOBAL_ARMY_CAP, (player.getDynamicProperty("mk:army_size") as number) ?? 0),
      );
    }
    // Sync the cache with reality so the HUD and death listener start from a correct baseline
    player.setDynamicProperty("mk:army_size", actualCount);

    const maxSize = this.getMaxArmySize(player);

    // Dynamic cap: in multiplayer, scale per-player limit to stay within global entity budget
    // Uses cachedPlayerMap (refreshed every 10s in tick()) to avoid bridge call
    const playerCount = Math.max(1, this.cachedPlayerMap.size);
    const effectiveCap =
      playerCount > 1 ? Math.min(maxSize, Math.floor(GLOBAL_ARMY_CAP / playerCount)) : maxSize;

    if (actualCount >= effectiveCap) {
      if (effectiveCap < maxSize && playerCount > 1) {
        player.sendMessage(ARMY_FULL_SHARED(effectiveCap));
      } else {
        player.sendMessage(ARMY_FULL);
      }
      return;
    }

    // Map enemy type to ally type
    const allyTypeId = enemyTypeId.replace("_enemy_", "_ally_");
    const displayName = ArmySystem.allyDisplayName(allyTypeId);

    try {
      const ally = dimension.spawnEntity(allyTypeId, location);
      ally.addTag("mk_army");
      ally.addTag(ownerTag);
      ally.setDynamicProperty("mk:owner_name", player.name);
      // Give the ally a procedural name (e.g., "Sir Marcus")
      const allyName = generateAllyName(allyTypeId);
      ally.nameTag = `§a${allyName} §7(${displayName})`;
      ally.setDynamicProperty("mk:ally_name", allyName);

      player.setDynamicProperty("mk:army_size", actualCount + 1);
      player.sendMessage(ALLY_RECRUITED(allyName));
    } catch (e) {
      console.warn(`[MegaKnights] Failed to spawn ally: ${e}`);
    }
  }

  /**
   * Subscribe to entity death events so we can decrement army count
   * immediately instead of waiting for the next tick recount.
   */
  setupDeathListener(): void {
    world.afterEvents.entityDie.subscribe((event) => {
      const dead = event.deadEntity;
      if (!dead.hasTag("mk_army")) {
        return;
      }

      const ownerName = dead.getDynamicProperty("mk:owner_name") as string;
      if (!ownerName) {
        return;
      }

      // Find the owner player by name — O(1) lookup from cached Map (refreshed every recount tick)
      const player = this.cachedPlayerMap.get(ownerName);
      if (player?.isValid) {
        const current = (player.getDynamicProperty("mk:army_size") as number) ?? 0;
        if (current > 0) {
          player.setDynamicProperty("mk:army_size", current - 1);
        }
        const allyName = (dead.getDynamicProperty("mk:ally_name") as string) ?? ArmySystem.allyDisplayName(dead.typeId);
        player.sendMessage(ALLY_DIED(allyName));
      }
    });
  }

  /**
   * Periodic recount — runs every 10 seconds as a safety net.
   * Death events handle most updates; this corrects edge cases (unloaded chunks, etc).
   */
  tick(): void {
    // Refresh cached player map (used by death listener for O(1) lookup)
    this.cachedPlayerMap.clear();
    const allPlayers = world.getAllPlayers();
    for (const p of allPlayers) {
      if (p.isValid) {
        this.cachedPlayerMap.set(p.name, p);
      }
    }
    for (const player of allPlayers) {
      if (!player.isValid) {
        continue;
      }

      const ownerTag = getOwnerTag(player.name);
      try {
        const allies = player.dimension.getEntities({
          tags: ["mk_army", ownerTag],
          location: player.location,
          maxDistance: 96,
        });
        player.setDynamicProperty("mk:army_size", allies.length);

        // Standard Bearer aura: apply Strength I to allies within 8 blocks of each bearer
        // Reuses the allies array — no extra getEntities() call
        for (const bearer of allies) {
          if (!bearer.isValid || bearer.typeId !== "mk:mk_ally_standard_bearer") {continue;}
          const bLoc = bearer.location;
          for (const ally of allies) {
            if (!ally.isValid) {continue;}
            const dx = ally.location.x - bLoc.x;
            const dy = ally.location.y - bLoc.y;
            const dz = ally.location.z - bLoc.z;
            if (dx * dx + dy * dy + dz * dz <= 64) {
              try { ally.addEffect("strength", 300, { amplifier: 0, showParticles: false }); } catch { /* entity may be invalid */ }
            }
          }
        }
      } catch {
        // Dimension query may fail if player is transitioning
      }
    }
  }

  onPlayerInteract(event: PlayerInteractWithEntityAfterEvent): void {
    const entity = event.target;
    if (!entity.hasTag("mk_army")) {
      return;
    }

    if (event.player.isSneaking) {
      const ownerName = entity.getDynamicProperty("mk:owner_name") as string;
      if (ownerName !== event.player.name) {
        event.player.sendMessage(ALLY_NOT_YOURS(ownerName));
        return;
      }
      const currentStance = Math.max(0, Math.min(2, (entity.getDynamicProperty("mk:stance") as number) ?? 0));
      const nextStance = (currentStance + 1) % 3;
      entity.setDynamicProperty("mk:stance", nextStance);
      const [eventName, modeName] = nextStance === 0
        ? ["mk:set_mode_follow", "Follow"]
        : nextStance === 1
          ? ["mk:set_mode_guard", "Guard"]
          : ["mk:set_mode_hold", "Hold"];
      try {
        entity.triggerEvent(eventName);
        event.player.sendMessage(ALLY_MODE_SET(modeName));
      } catch {
        // Entity may have despawned
      }
      return;
    }

    const ownerName = entity.getDynamicProperty("mk:owner_name") as string;
    if (ownerName !== event.player.name) {
      event.player.sendMessage(ALLY_NOT_YOURS(ownerName));
      return;
    }

    // Show ally info — entity may despawn or chunk may unload between event and access
    try {
      const hp = entity.getComponent("minecraft:health") as EntityHealthComponent | undefined;
      const healthValue = hp ? Math.floor(hp.currentValue) : "?";
      const healthMax = hp ? Math.floor(hp.effectiveMax) : "?";
      const allyName = (entity.getDynamicProperty("mk:ally_name") as string) ?? entity.nameTag;
      event.player.sendMessage(ALLY_INFO(allyName, healthValue, healthMax));
    } catch {
      // Entity became invalid before we could read its health
    }
  }

  getArmyEntities(player: Player): Entity[] {
    const ownerTag = getOwnerTag(player.name);
    try {
      return player.dimension.getEntities({
        tags: ["mk_army", ownerTag],
        location: player.location,
        maxDistance: 96,
      });
    } catch {
      return [];
    }
  }

  getArmySize(player: Player): number {
    const raw = (player.getDynamicProperty("mk:army_size") as number) ?? 0;
    return Math.max(0, Math.min(GLOBAL_ARMY_CAP, Math.floor(raw)));
  }

  /** Debug spawn allies — staggered across ticks to avoid freezing Switch */
  debugSpawnAllies(player: Player, count: number): void {
    const ownerTag = getOwnerTag(player.name);
    const playerName = player.name;
    const dimension = player.dimension;

    system.runJob(
      (function* () {
        let spawned = 0;
        let currentPlayer: Player | undefined = player;

        for (let i = 0; i < count; i++) {
          // Only re-fetch player at yield boundaries or if stale
          if (!currentPlayer?.isValid) {
            currentPlayer = undefined;
            for (const p of world.getAllPlayers()) {
              if (p.name === playerName && p.isValid) {
                currentPlayer = p;
                break;
              }
            }
            if (!currentPlayer) {
              break;
            }
          }

          const angle = Math.random() * Math.PI * 2;
          const dist = 3 + Math.random() * 3;
          const loc = {
            x: currentPlayer.location.x + Math.cos(angle) * dist,
            y: currentPlayer.location.y,
            z: currentPlayer.location.z + Math.sin(angle) * dist,
          };
          try {
            const ally = dimension.spawnEntity("mk:mk_ally_knight", loc);
            ally.addTag("mk_army");
            ally.addTag(ownerTag);
            ally.setDynamicProperty("mk:owner_name", playerName);
            const safeName = playerName.replace(/§./g, "").slice(0, 16);
            ally.nameTag = `§a${safeName}'s Knight`;
          } catch (e) {
            console.warn(`[MegaKnights] Failed to spawn debug ally: ${e}`);
          }

          spawned++;
          if (spawned % 2 === 0) {
            currentPlayer = undefined; // Invalidate at yield boundary
            yield; // 2 spawns per tick max
          }
        }
        // Notify after all spawned
        for (const p of world.getAllPlayers()) {
          if (p.name === playerName && p.isValid) {
            p.sendMessage(DEBUG_ALLIES_SPAWNED(count));
            break;
          }
        }
      })(),
    );
  }
}
