import {
  world,
  system,
  Dimension,
  Vector3,
  ItemUseAfterEvent,
} from "@minecraft/server";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import { ArmySystem } from "./ArmySystem";
import {
  CASTLE_LOOK_AT_GROUND,
  CASTLE_PLACED,
  CASTLE_CAPACITY_UP,
  CASTLE_FAILED,
} from "../data/Strings";

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
      player.sendMessage(CASTLE_LOOK_AT_GROUND);
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
      // Structure file not found — use command-based fallback (staggered via runJob)
      this.buildFallbackStaggered(blueprintId, player.dimension, placeLoc);
      placed = true; // Assume success — commands are staggered but will execute
    }

    if (placed) {
      player.sendMessage(CASTLE_PLACED(blueprint.displayName));
      this.army.addTroopBonus(player, blueprint.troopBonus);
      const newMax = this.army.getMaxArmySize(player);
      player.sendMessage(CASTLE_CAPACITY_UP(blueprint.troopBonus, newMax));
    } else {
      player.sendMessage(CASTLE_FAILED);
    }
  }

  /**
   * Builds a castle structure block-by-block using system.runJob().
   * Spreads runCommand calls across ticks to avoid freezing on low-end devices.
   */
  private buildFallbackStaggered(
    blueprintId: string,
    dimension: Dimension,
    origin: Vector3
  ): void {
    const commands = this.getBuildCommands(blueprintId, origin);
    if (commands.length === 0) return;

    // Run 2 commands per tick to spread work across frames
    const CMDS_PER_TICK = 2;

    system.runJob(
      (function* () {
        let executed = 0;
        for (const cmd of commands) {
          try {
            dimension.runCommand(cmd);
          } catch (e) {
            console.warn(`[MegaKnights] Build command failed: ${e}`);
          }

          executed++;
          if (executed % CMDS_PER_TICK === 0) {
            yield;
          }
        }
      })()
    );
  }

  /** Returns the list of build commands for a given blueprint */
  private getBuildCommands(blueprintId: string, origin: Vector3): string[] {
    const x = Math.floor(origin.x);
    const y = Math.floor(origin.y);
    const z = Math.floor(origin.z);

    if (blueprintId === "small_tower") {
      return [
        // 3x3 stone brick tower, 6 blocks tall with crenellations
        `fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y + 5} ${z + 1} stonebrick hollow`,
        `setblock ${x} ${y} ${z - 1} air`,
        `setblock ${x} ${y + 1} ${z - 1} air`,
        `setblock ${x - 1} ${y + 6} ${z - 1} stonebrick`,
        `setblock ${x + 1} ${y + 6} ${z - 1} stonebrick`,
        `setblock ${x - 1} ${y + 6} ${z + 1} stonebrick`,
        `setblock ${x + 1} ${y + 6} ${z + 1} stonebrick`,
        `setblock ${x} ${y + 3} ${z} torch`,
      ];
    } else if (blueprintId === "gatehouse") {
      const cmds = [
        // 5x5 stone brick gatehouse with archway
        `fill ${x - 2} ${y} ${z - 2} ${x + 2} ${y + 5} ${z + 2} stonebrick hollow`,
        `fill ${x - 1} ${y} ${z - 2} ${x + 1} ${y + 3} ${z - 2} air`,
        `fill ${x - 1} ${y} ${z + 2} ${x + 1} ${y + 3} ${z + 2} air`,
        `fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y} ${z + 1} stone`,
      ];
      // Crenellations
      for (let dx = -2; dx <= 2; dx += 2) {
        for (let dz = -2; dz <= 2; dz += 2) {
          cmds.push(`setblock ${x + dx} ${y + 6} ${z + dz} stonebrick`);
        }
      }
      cmds.push(`setblock ${x - 1} ${y + 2} ${z - 1} torch`);
      cmds.push(`setblock ${x + 1} ${y + 2} ${z + 1} torch`);
      return cmds;
    } else if (blueprintId === "great_hall") {
      const cmds = [
        // 9x7 stone brick hall
        `fill ${x - 4} ${y} ${z - 3} ${x + 4} ${y + 6} ${z + 3} stonebrick hollow`,
        `fill ${x - 3} ${y} ${z - 2} ${x + 3} ${y} ${z + 2} polished_deepslate`,
        `fill ${x - 1} ${y + 1} ${z - 3} ${x + 1} ${y + 3} ${z - 3} air`,
        `setblock ${x - 4} ${y + 3} ${z} glass`,
        `setblock ${x + 4} ${y + 3} ${z} glass`,
        `setblock ${x} ${y + 1} ${z + 2} oak_stairs ["weirdo_direction":2]`,
      ];
      // Torches along wall
      for (let dx = -3; dx <= 3; dx += 2) {
        cmds.push(`setblock ${x + dx} ${y + 3} ${z - 2} torch`);
      }
      cmds.push(
        `setblock ${x} ${y + 3} ${z + 2} wall_banner ["facing_direction":3]`
      );
      return cmds;
    }

    return [];
  }
}
