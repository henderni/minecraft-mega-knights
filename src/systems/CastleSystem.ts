import { world, ItemUseAfterEvent, Player } from "@minecraft/server";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";

export class CastleSystem {
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

    try {
      world.structureManager.place(
        `megaknights:${blueprintId}`,
        player.dimension,
        placeLoc
      );
      player.sendMessage(`§a${blueprint.displayName} has been placed!`);
      player.sendMessage(
        `§7Your army capacity increased by +${blueprint.troopBonus}!`
      );
    } catch (e) {
      player.sendMessage(`§cFailed to place structure. Try a flatter area.`);
      console.warn(`[MegaKnights] Structure placement failed: ${e}`);
    }
  }
}
