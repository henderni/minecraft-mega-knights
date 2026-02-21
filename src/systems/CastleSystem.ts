import { world, system, Dimension, Vector3, ItemUseAfterEvent } from "@minecraft/server";
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
    if (!item || !item.typeId.startsWith("mk:mk_blueprint_")) {
      return;
    }

    const player = event.source;
    if (!player.isValid) {return;}

    const blueprintId = item.typeId.replace("mk:mk_blueprint_", "");
    const blueprint = CASTLE_BLUEPRINTS[blueprintId];

    if (!blueprint) {
      return;
    }

    try {
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
      try {
        world.structureManager.place(blueprint.structureId, player.dimension, placeLoc);
      } catch {
        // Structure file not found — use command-based fallback (staggered via runJob)
        this.buildFallbackStaggered(blueprintId, player.dimension, placeLoc);
      }

      // Consume the blueprint item (1 per use)
      // Reconstruct typeId from validated blueprintId to avoid using raw item.typeId in commands
      const safeTypeId = `mk:mk_blueprint_${blueprintId}`;
      try {
        player.runCommand(`clear @s ${safeTypeId} 0 1`);
      } catch {
        // clear command may fail if item was already removed — non-fatal
      }
      player.sendMessage(CASTLE_PLACED(blueprint.displayName));
      this.army.addTroopBonus(player, blueprint.troopBonus);
      const newMax = this.army.getMaxArmySize(player);
      player.sendMessage(CASTLE_CAPACITY_UP(blueprint.troopBonus, newMax));
      try { player.runCommand("playsound random.anvil_use @s ~ ~ ~ 1 0.8"); } catch { /* */ }
    } catch {
      // Player disconnected or placement failed entirely — send failure feedback
      try { player.sendMessage(CASTLE_FAILED); } catch { /* player may be invalid */ }
    }
  }

  /**
   * Builds a castle structure block-by-block using system.runJob().
   * Spreads runCommand calls across ticks to avoid freezing on low-end devices.
   */
  private buildFallbackStaggered(blueprintId: string, dimension: Dimension, origin: Vector3): void {
    const commands = this.getBuildCommands(blueprintId, origin);
    if (commands.length === 0) {
      return;
    }

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
      })(),
    );
  }

  /** Returns the list of build commands for a given blueprint */
  private getBuildCommands(blueprintId: string, origin: Vector3): string[] {
    const x = Math.floor(origin.x);
    const y = Math.floor(origin.y);
    const z = Math.floor(origin.z);

    switch (blueprintId) {
      case "small_tower":
        return this.buildSmallTower(x, y, z);
      case "gatehouse":
        return this.buildGatehouse(x, y, z);
      case "great_hall":
        return this.buildGreatHall(x, y, z);
      default:
        return [];
    }
  }

  /** Small Watchtower: 5×5 stone tower with two floors, ladder, windows, and crenellations */
  private buildSmallTower(x: number, y: number, z: number): string[] {
    const cmds: string[] = [];

    // Foundation
    cmds.push(`fill ${x - 2} ${y - 1} ${z - 2} ${x + 2} ${y - 1} ${z + 2} cobblestone`);

    // Walls: 5×5 hollow stone brick, 8 tall
    cmds.push(`fill ${x - 2} ${y} ${z - 2} ${x + 2} ${y + 7} ${z + 2} stonebrick hollow`);

    // Ground floor
    cmds.push(`fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y} ${z + 1} oak_planks`);

    // Door opening (south face)
    cmds.push(`setblock ${x} ${y} ${z - 2} air`);
    cmds.push(`setblock ${x} ${y + 1} ${z - 2} air`);

    // Upper floor at y+4
    cmds.push(`fill ${x - 1} ${y + 4} ${z - 1} ${x + 1} ${y + 4} ${z + 1} oak_planks`);

    // Ladder up east wall (y+1 to y+6, overwrites floor plank at y+4 to create hole)
    for (let ly = y + 1; ly <= y + 6; ly++) {
      cmds.push(`setblock ${x + 1} ${ly} ${z + 1} ladder ["facing_direction":4]`);
    }

    // Windows: glass panes in walls
    cmds.push(`setblock ${x - 2} ${y + 2} ${z} glass_pane`);
    cmds.push(`setblock ${x + 2} ${y + 2} ${z} glass_pane`);
    cmds.push(`setblock ${x - 2} ${y + 5} ${z} glass_pane`);
    cmds.push(`setblock ${x + 2} ${y + 5} ${z} glass_pane`);
    cmds.push(`setblock ${x} ${y + 5} ${z + 2} glass_pane`);

    // Crenellations at y+8 (corners and midpoints)
    for (const dx of [-2, 0, 2]) {
      cmds.push(`setblock ${x + dx} ${y + 8} ${z - 2} stonebrick`);
      cmds.push(`setblock ${x + dx} ${y + 8} ${z + 2} stonebrick`);
    }
    cmds.push(`setblock ${x - 2} ${y + 8} ${z} stonebrick`);
    cmds.push(`setblock ${x + 2} ${y + 8} ${z} stonebrick`);

    // Lighting
    cmds.push(`setblock ${x} ${y + 1} ${z} lantern`);
    cmds.push(`setblock ${x - 1} ${y + 5} ${z - 1} lantern`);

    // Cobblestone wall parapets between merlons for proper battlements
    cmds.push(`setblock ${x - 1} ${y + 8} ${z - 2} cobblestone_wall`);
    cmds.push(`setblock ${x + 1} ${y + 8} ${z - 2} cobblestone_wall`);
    cmds.push(`setblock ${x - 1} ${y + 8} ${z + 2} cobblestone_wall`);
    cmds.push(`setblock ${x + 1} ${y + 8} ${z + 2} cobblestone_wall`);

    // Corner flagpoles
    cmds.push(`setblock ${x - 2} ${y + 9} ${z - 2} oak_fence`);
    cmds.push(`setblock ${x + 2} ${y + 9} ${z + 2} oak_fence`);

    return cmds;
  }

  /** Gatehouse: 9×7 fortified passage with archways, iron bars portcullis, and roof walkway */
  private buildGatehouse(x: number, y: number, z: number): string[] {
    const cmds: string[] = [];

    // Foundation
    cmds.push(`fill ${x - 4} ${y - 1} ${z - 3} ${x + 4} ${y - 1} ${z + 3} cobblestone`);

    // Walls: 9×7 hollow stone brick, 7 tall
    cmds.push(`fill ${x - 4} ${y} ${z - 3} ${x + 4} ${y + 6} ${z + 3} stonebrick hollow`);

    // Passage floor
    cmds.push(`fill ${x - 3} ${y} ${z - 2} ${x + 3} ${y} ${z + 2} cobblestone`);

    // Front archway (south face): 3 wide, 4 tall
    cmds.push(`fill ${x - 1} ${y} ${z - 3} ${x + 1} ${y + 3} ${z - 3} air`);

    // Rear archway (north face): 3 wide, 4 tall
    cmds.push(`fill ${x - 1} ${y} ${z + 3} ${x + 1} ${y + 3} ${z + 3} air`);

    // Iron bars portcullis at top of front archway
    cmds.push(`fill ${x - 1} ${y + 3} ${z - 3} ${x + 1} ${y + 3} ${z - 3} iron_bars`);

    // Crenellations at y+7 — alternating merlons around perimeter
    for (const dx of [-4, -2, 0, 2, 4]) {
      cmds.push(`setblock ${x + dx} ${y + 7} ${z - 3} stonebrick`);
      cmds.push(`setblock ${x + dx} ${y + 7} ${z + 3} stonebrick`);
    }
    for (const dz of [-1, 1]) {
      cmds.push(`setblock ${x - 4} ${y + 7} ${z + dz} stonebrick`);
      cmds.push(`setblock ${x + 4} ${y + 7} ${z + dz} stonebrick`);
    }

    // Ladder to roof walkway (inside east wall, climbs through ceiling)
    for (let ly = y + 1; ly <= y + 6; ly++) {
      cmds.push(`setblock ${x + 3} ${ly} ${z + 2} ladder ["facing_direction":4]`);
    }

    // Passage lighting
    cmds.push(`setblock ${x} ${y + 1} ${z - 1} lantern`);
    cmds.push(`setblock ${x} ${y + 1} ${z + 1} lantern`);

    // Ladder access hole through ceiling so player can reach roof
    cmds.push(`setblock ${x + 3} ${y + 6} ${z + 2} ladder ["facing_direction":4]`);

    // Arrow slits in side walls
    cmds.push(`setblock ${x - 4} ${y + 3} ${z - 1} iron_bars`);
    cmds.push(`setblock ${x - 4} ${y + 3} ${z + 1} iron_bars`);
    cmds.push(`setblock ${x + 4} ${y + 3} ${z - 1} iron_bars`);
    cmds.push(`setblock ${x + 4} ${y + 3} ${z + 1} iron_bars`);

    // Corner flagpoles on roof
    cmds.push(`setblock ${x - 4} ${y + 8} ${z - 3} oak_fence`);
    cmds.push(`setblock ${x + 4} ${y + 8} ${z - 3} oak_fence`);
    cmds.push(`setblock ${x - 4} ${y + 8} ${z + 3} oak_fence`);
    cmds.push(`setblock ${x + 4} ${y + 8} ${z + 3} oak_fence`);

    // Roof walkway lighting
    cmds.push(`setblock ${x} ${y + 7} ${z} lantern`);

    return cmds;
  }

  /** Great Hall: 13×9 grand hall with pillars, windows, throne, and chandeliers */
  private buildGreatHall(x: number, y: number, z: number): string[] {
    const cmds: string[] = [];

    // Foundation
    cmds.push(`fill ${x - 6} ${y - 1} ${z - 4} ${x + 6} ${y - 1} ${z + 4} cobblestone`);

    // Walls: 13×9 hollow stone brick, 7 tall
    cmds.push(`fill ${x - 6} ${y} ${z - 4} ${x + 6} ${y + 6} ${z + 4} stonebrick hollow`);

    // Floor: polished deepslate with center aisle
    cmds.push(`fill ${x - 5} ${y} ${z - 3} ${x + 5} ${y} ${z + 3} polished_deepslate`);
    cmds.push(`fill ${x} ${y} ${z - 3} ${x} ${y} ${z + 3} deepslate_tiles`);

    // Entrance (south face): 3 wide, 4 tall
    cmds.push(`fill ${x - 1} ${y} ${z - 4} ${x + 1} ${y + 3} ${z - 4} air`);

    // Windows along east and west walls
    for (const dz of [-2, 0, 2]) {
      cmds.push(`setblock ${x - 6} ${y + 3} ${z + dz} glass_pane`);
      cmds.push(`setblock ${x + 6} ${y + 3} ${z + dz} glass_pane`);
      cmds.push(`setblock ${x - 6} ${y + 4} ${z + dz} glass_pane`);
      cmds.push(`setblock ${x + 6} ${y + 4} ${z + dz} glass_pane`);
    }

    // Oak log pillars (4 columns)
    for (const dx of [-4, 4]) {
      for (const dz of [-2, 2]) {
        cmds.push(`fill ${x + dx} ${y + 1} ${z + dz} ${x + dx} ${y + 5} ${z + dz} oak_log`);
      }
    }

    // Raised throne platform at back
    cmds.push(`fill ${x - 2} ${y + 1} ${z + 2} ${x + 2} ${y + 1} ${z + 3} stonebrick`);

    // Throne with armrests
    cmds.push(`setblock ${x} ${y + 2} ${z + 3} oak_stairs ["weirdo_direction":2]`);
    cmds.push(`setblock ${x - 1} ${y + 2} ${z + 3} oak_stairs ["weirdo_direction":0]`);
    cmds.push(`setblock ${x + 1} ${y + 2} ${z + 3} oak_stairs ["weirdo_direction":1]`);

    // Chandeliers (chain + hanging lantern)
    for (const dx of [-3, 3]) {
      cmds.push(`setblock ${x + dx} ${y + 5} ${z} chain`);
      cmds.push(`setblock ${x + dx} ${y + 4} ${z} lantern ["hanging":true]`);
    }

    // Floor lighting along walls
    cmds.push(`setblock ${x - 5} ${y + 1} ${z} lantern`);
    cmds.push(`setblock ${x + 5} ${y + 1} ${z} lantern`);
    cmds.push(`setblock ${x - 4} ${y + 1} ${z - 3} lantern`);
    cmds.push(`setblock ${x + 4} ${y + 1} ${z - 3} lantern`);
    cmds.push(`setblock ${x - 4} ${y + 1} ${z + 3} lantern`);
    cmds.push(`setblock ${x + 4} ${y + 1} ${z + 3} lantern`);

    // Red carpet down center aisle to throne
    cmds.push(`fill ${x} ${y + 1} ${z - 3} ${x} ${y + 1} ${z + 1} red_carpet`);

    // Bookshelves flanking throne along back wall
    cmds.push(`fill ${x - 4} ${y + 1} ${z + 3} ${x - 3} ${y + 2} ${z + 3} bookshelf`);
    cmds.push(`fill ${x + 3} ${y + 1} ${z + 3} ${x + 4} ${y + 2} ${z + 3} bookshelf`);

    // Blue tapestry on back wall behind throne
    cmds.push(`fill ${x - 1} ${y + 3} ${z + 4} ${x + 1} ${y + 5} ${z + 4} blue_wool`);

    return cmds;
  }
}
