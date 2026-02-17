import { world, Dimension, Vector3, ItemUseAfterEvent } from "@minecraft/server";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import { ArmySystem } from "./ArmySystem";

export class CastleSystem {
  private army: ArmySystem;

  constructor(army: ArmySystem) {
    this.army = army;
  }

  onItemUse(event: ItemUseAfterEvent): void {
    const item = event.itemStack;
    if (!item || !item.typeId.startsWith("mk:mk_blueprint_")) return;

    const player = event.source;
    const blueprintId = item.typeId.replace("mk:mk_blueprint_", "");
    const blueprint = CASTLE_BLUEPRINTS[blueprintId];

    if (!blueprint) return;

    // Get the block the player is looking at
    const rayResult = player.getBlockFromViewDirection({ maxDistance: 7 });
    if (!rayResult) {
      player.sendMessage(
        "§cLook at the ground where you want to place the structure!"
      );
      return;
    }

    const placeLoc = {
      x: rayResult.block.location.x,
      y: rayResult.block.location.y + 1,
      z: rayResult.block.location.z,
    };

    // Try structure manager first, fall back to command-based building
    let placed = false;
    try {
      world.structureManager.place(
        blueprint.structureId,
        player.dimension,
        placeLoc
      );
      placed = true;
    } catch {
      // Structure file not found — use command-based fallback
      placed = this.buildFallback(blueprintId, player.dimension, placeLoc);
    }

    if (placed) {
      player.sendMessage(`§a${blueprint.displayName} has been placed!`);
      this.army.addTroopBonus(player, blueprint.troopBonus);
      const newMax = this.army.getMaxArmySize(player);
      player.sendMessage(
        `§7Army capacity increased by +${blueprint.troopBonus}! (Max: ${newMax})`
      );
    } else {
      player.sendMessage(`§cFailed to place structure. Try a flatter area.`);
    }
  }

  /** Command-based fallback builds simple structures when .mcstructure files are missing */
  private buildFallback(
    blueprintId: string,
    dimension: Dimension,
    origin: Vector3
  ): boolean {
    try {
      const x = Math.floor(origin.x);
      const y = Math.floor(origin.y);
      const z = Math.floor(origin.z);

      if (blueprintId === "small_tower") {
        // 3x3 stone brick tower, 6 blocks tall with crenellations
        dimension.runCommand(
          `fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y + 5} ${z + 1} stonebrick hollow`
        );
        dimension.runCommand(`setblock ${x} ${y} ${z - 1} air`);
        dimension.runCommand(`setblock ${x} ${y + 1} ${z - 1} air`);
        dimension.runCommand(`setblock ${x - 1} ${y + 6} ${z - 1} stonebrick`);
        dimension.runCommand(`setblock ${x + 1} ${y + 6} ${z - 1} stonebrick`);
        dimension.runCommand(`setblock ${x - 1} ${y + 6} ${z + 1} stonebrick`);
        dimension.runCommand(`setblock ${x + 1} ${y + 6} ${z + 1} stonebrick`);
        dimension.runCommand(`setblock ${x} ${y + 3} ${z} torch`);
      } else if (blueprintId === "gatehouse") {
        // 5x5 stone brick gatehouse with archway
        dimension.runCommand(
          `fill ${x - 2} ${y} ${z - 2} ${x + 2} ${y + 5} ${z + 2} stonebrick hollow`
        );
        dimension.runCommand(
          `fill ${x - 1} ${y} ${z - 2} ${x + 1} ${y + 3} ${z - 2} air`
        );
        dimension.runCommand(
          `fill ${x - 1} ${y} ${z + 2} ${x + 1} ${y + 3} ${z + 2} air`
        );
        dimension.runCommand(
          `fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y} ${z + 1} stone`
        );
        for (let dx = -2; dx <= 2; dx += 2) {
          for (let dz = -2; dz <= 2; dz += 2) {
            dimension.runCommand(
              `setblock ${x + dx} ${y + 6} ${z + dz} stonebrick`
            );
          }
        }
        dimension.runCommand(`setblock ${x - 1} ${y + 2} ${z - 1} torch`);
        dimension.runCommand(`setblock ${x + 1} ${y + 2} ${z + 1} torch`);
      } else if (blueprintId === "great_hall") {
        // 9x7 stone brick hall
        dimension.runCommand(
          `fill ${x - 4} ${y} ${z - 3} ${x + 4} ${y + 6} ${z + 3} stonebrick hollow`
        );
        dimension.runCommand(
          `fill ${x - 3} ${y} ${z - 2} ${x + 3} ${y} ${z + 2} polished_deepslate`
        );
        dimension.runCommand(
          `fill ${x - 1} ${y + 1} ${z - 3} ${x + 1} ${y + 3} ${z - 3} air`
        );
        dimension.runCommand(`setblock ${x - 4} ${y + 3} ${z} glass`);
        dimension.runCommand(`setblock ${x + 4} ${y + 3} ${z} glass`);
        dimension.runCommand(
          `setblock ${x} ${y + 1} ${z + 2} oak_stairs ["weirdo_direction":2]`
        );
        for (let dx = -3; dx <= 3; dx += 2) {
          dimension.runCommand(
            `setblock ${x + dx} ${y + 3} ${z - 2} torch`
          );
        }
        dimension.runCommand(
          `setblock ${x} ${y + 3} ${z + 2} wall_banner ["facing_direction":3]`
        );
      } else {
        return false;
      }
      return true;
    } catch (e) {
      console.warn(`[MegaKnights] Fallback build failed: ${e}`);
      return false;
    }
  }
}
