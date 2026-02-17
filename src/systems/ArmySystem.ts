import {
  world,
  Player,
  Entity,
  Dimension,
  Vector3,
  EntityHealthComponent,
  PlayerInteractWithEntityAfterEvent,
} from "@minecraft/server";

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

  /** Add troop capacity from placing a castle structure */
  addTroopBonus(player: Player, bonus: number): void {
    const current =
      (player.getDynamicProperty("mk:army_bonus") as number) ?? 0;
    player.setDynamicProperty("mk:army_bonus", current + bonus);
  }

  recruitAlly(
    player: Player,
    enemyTypeId: string,
    location: Vector3,
    dimension: Dimension
  ): void {
    const armySize =
      (player.getDynamicProperty("mk:army_size") as number) ?? 0;
    const maxSize = this.getMaxArmySize(player);
    if (armySize >= maxSize) {
      player.sendMessage("§cYour army is at maximum capacity!");
      return;
    }

    // Map enemy type to ally type
    const allyTypeId = enemyTypeId.replace("_enemy_", "_ally_");
    const displayName = ArmySystem.allyDisplayName(allyTypeId);

    try {
      const ally = dimension.spawnEntity(allyTypeId, location);
      ally.addTag("mk_army");
      ally.addTag(`mk_owner_${player.name}`);
      ally.setDynamicProperty("mk:owner_name", player.name);
      ally.nameTag = `§a${player.name}'s ${displayName}`;

      player.setDynamicProperty("mk:army_size", armySize + 1);
      player.sendMessage(`§a+ A ${displayName} has joined your army!`);
    } catch (e) {
      console.warn(`[MegaKnights] Failed to spawn ally: ${e}`);
    }
  }

  tick(): void {
    // Periodically recount alive allies for each player
    for (const player of world.getAllPlayers()) {
      const ownerTag = `mk_owner_${player.name}`;
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
      event.player.sendMessage(`§7This warrior serves ${ownerName}.`);
      return;
    }

    // Show ally info
    const hp = entity.getComponent("minecraft:health") as
      | EntityHealthComponent
      | undefined;
    const healthValue = hp ? Math.floor(hp.currentValue) : "?";
    const healthMax = hp ? Math.floor(hp.effectiveMax) : "?";
    event.player.sendMessage(
      `§b${entity.nameTag} §7- HP: ${healthValue}/${healthMax}`
    );
  }

  getArmyEntities(player: Player): Entity[] {
    const ownerTag = `mk_owner_${player.name}`;
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
        ally.addTag(`mk_owner_${player.name}`);
        ally.setDynamicProperty("mk:owner_name", player.name);
        ally.nameTag = `§a${player.name}'s Knight`;
      } catch (e) {
        console.warn(`[MegaKnights] Failed to spawn debug ally: ${e}`);
      }
    }
    player.sendMessage(`§e[Debug] Spawned ${count} allies`);
  }
}
