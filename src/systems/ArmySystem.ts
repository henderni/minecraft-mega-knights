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
  ALLY_RECRUITED,
  ALLY_NOT_YOURS,
  ALLY_INFO,
  DEBUG_ALLIES_SPAWNED,
} from "../data/Strings";

/** Max castle troop bonus a player can accumulate (+30 = all 3 structures) */
const MAX_ARMY_BONUS = 30;

/** Sanitize player name for use in entity tags (only alphanum, underscore, hyphen allowed) */
function sanitizePlayerTag(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, "_");
}

export class ArmySystem {
  private static readonly BASE_ARMY_SIZE = 20;

  /** Derive a display name from an ally type ID like "mk:mk_ally_dark_knight" -> "Dark Knight" */
  private static allyDisplayName(allyTypeId: string): string {
    const raw = allyTypeId.replace("mk:mk_ally_", "").replace(/_/g, " ");
    return raw
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  /** Get the current max army size for a player (base + castle bonuses) */
  getMaxArmySize(player: Player): number {
    const bonus =
      (player.getDynamicProperty("mk:army_bonus") as number) ?? 0;
    return ArmySystem.BASE_ARMY_SIZE + bonus;
  }

  /** Add troop capacity from placing a castle structure (capped) */
  addTroopBonus(player: Player, bonus: number): void {
    const current =
      (player.getDynamicProperty("mk:army_bonus") as number) ?? 0;
    const capped = Math.min(current + bonus, MAX_ARMY_BONUS);
    player.setDynamicProperty("mk:army_bonus", capped);
  }

  recruitAlly(
    player: Player,
    enemyTypeId: string,
    location: Vector3,
    dimension: Dimension
  ): void {
    if (!player.isValid) return;

    const armySize =
      (player.getDynamicProperty("mk:army_size") as number) ?? 0;
    const maxSize = this.getMaxArmySize(player);
    if (armySize >= maxSize) {
      player.sendMessage(ARMY_FULL);
      return;
    }

    // Map enemy type to ally type
    const allyTypeId = enemyTypeId.replace("_enemy_", "_ally_");
    const displayName = ArmySystem.allyDisplayName(allyTypeId);
    const safeTag = sanitizePlayerTag(player.name);

    try {
      const ally = dimension.spawnEntity(allyTypeId, location);
      ally.addTag("mk_army");
      ally.addTag(`mk_owner_${safeTag}`);
      ally.setDynamicProperty("mk:owner_name", player.name);
      ally.nameTag = `§a${player.name}'s ${displayName}`;

      player.setDynamicProperty("mk:army_size", armySize + 1);
      player.sendMessage(ALLY_RECRUITED(displayName));
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
      if (!dead.hasTag("mk_army")) return;

      const ownerName = dead.getDynamicProperty("mk:owner_name") as string;
      if (!ownerName) return;

      // Find the owner player and decrement army size
      for (const player of world.getAllPlayers()) {
        if (player.name === ownerName && player.isValid) {
          const current =
            (player.getDynamicProperty("mk:army_size") as number) ?? 0;
          if (current > 0) {
            player.setDynamicProperty("mk:army_size", current - 1);
          }
          break;
        }
      }
    });
  }

  /**
   * Periodic recount — runs less frequently now since death events handle
   * most updates. Acts as a correction pass for edge cases (unloaded chunks, etc).
   */
  tick(): void {
    for (const player of world.getAllPlayers()) {
      if (!player.isValid) continue;

      const safeTag = sanitizePlayerTag(player.name);
      const ownerTag = `mk_owner_${safeTag}`;
      try {
        const allies = player.dimension.getEntities({
          tags: ["mk_army", ownerTag],
        });
        player.setDynamicProperty("mk:army_size", allies.length);
      } catch {
        // Dimension query may fail if player is transitioning
      }
    }
  }

  onPlayerInteract(event: PlayerInteractWithEntityAfterEvent): void {
    const entity = event.target;
    if (!entity.hasTag("mk_army")) return;

    const ownerName = entity.getDynamicProperty("mk:owner_name") as string;
    if (ownerName !== event.player.name) {
      event.player.sendMessage(ALLY_NOT_YOURS(ownerName));
      return;
    }

    // Show ally info
    const hp = entity.getComponent("minecraft:health") as
      | EntityHealthComponent
      | undefined;
    const healthValue = hp ? Math.floor(hp.currentValue) : "?";
    const healthMax = hp ? Math.floor(hp.effectiveMax) : "?";
    event.player.sendMessage(ALLY_INFO(entity.nameTag, healthValue, healthMax));
  }

  getArmyEntities(player: Player): Entity[] {
    const safeTag = sanitizePlayerTag(player.name);
    const ownerTag = `mk_owner_${safeTag}`;
    try {
      return player.dimension.getEntities({
        tags: ["mk_army", ownerTag],
      });
    } catch {
      return [];
    }
  }

  getArmySize(player: Player): number {
    return (player.getDynamicProperty("mk:army_size") as number) ?? 0;
  }

  debugSpawnAllies(player: Player, count: number): void {
    const safeTag = sanitizePlayerTag(player.name);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 3;
      const loc = {
        x: player.location.x + Math.cos(angle) * dist,
        y: player.location.y,
        z: player.location.z + Math.sin(angle) * dist,
      };
      try {
        const ally = player.dimension.spawnEntity("mk:mk_ally_knight", loc);
        ally.addTag("mk_army");
        ally.addTag(`mk_owner_${safeTag}`);
        ally.setDynamicProperty("mk:owner_name", player.name);
        ally.nameTag = `§a${player.name}'s Knight`;
      } catch (e) {
        console.warn(`[MegaKnights] Failed to spawn debug ally: ${e}`);
      }
    }
    player.sendMessage(DEBUG_ALLIES_SPAWNED(count));
  }
}
