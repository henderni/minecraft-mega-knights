import { world, system, Player, Vector3 } from "@minecraft/server";

/** Days on which the Wandering Merchant may spawn near each player */
const MERCHANT_DAYS = new Set([15, 30, 55, 75]);

/** Minimum blocks away from player the merchant spawns */
const MERCHANT_SPAWN_DIST = 10;
/** Maximum blocks away */
const MERCHANT_SPAWN_MAX_DIST = 20;

const GROUND_SCAN_RANGE = 10;

/**
 * MerchantSystem — spawns the Wandering Merchant near players on
 * specific milestone days (15, 30, 55, 75).
 *
 * One merchant per player per day. The entity has a built-in 600s timer
 * (minecraft:timer in entity JSON) and despawns itself — no script tracking needed.
 */
export class MerchantSystem {
  /** Track which players already have a merchant this day */
  private merchantedThisDay = new Set<string>();

  onDayChanged(day: number): void {
    if (!MERCHANT_DAYS.has(day)) return;
    this.merchantedThisDay.clear();
    this.spawnMerchantsForDay();
  }

  private spawnMerchantsForDay(): void {
    const players = world.getAllPlayers();
    for (const player of players) {
      if (!player.isValid) continue;
      if (this.merchantedThisDay.has(player.name)) continue;
      this.spawnMerchantNear(player);
      this.merchantedThisDay.add(player.name);
    }
  }

  private spawnMerchantNear(player: Player): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = MERCHANT_SPAWN_DIST + Math.random() * (MERCHANT_SPAWN_MAX_DIST - MERCHANT_SPAWN_DIST);
    const rawX = player.location.x + Math.cos(angle) * dist;
    const rawZ = player.location.z + Math.sin(angle) * dist;

    const dim = player.dimension;
    const groundY = this.findGroundLevel(dim, Math.floor(rawX), Math.floor(player.location.y), Math.floor(rawZ));
    if (groundY === null) return;

    const spawnLoc: Vector3 = {
      x: Math.floor(rawX),
      y: groundY + 1,
      z: Math.floor(rawZ),
    };

    system.run(() => {
      try {
        const merchant = dim.spawnEntity("mk:mk_wandering_merchant", spawnLoc);
        merchant.nameTag = "§6Wandering Merchant";
        merchant.addTag("mk_merchant");
        player.sendMessage("§6⚑ A Wandering Merchant has appeared nearby!");
      } catch (e) {
        console.warn(`[MegaKnights] Merchant spawn failed: ${e}`);
      }
    });
  }

  private findGroundLevel(dimension: import("@minecraft/server").Dimension, x: number, baseY: number, z: number): number | null {
    for (let y = baseY + GROUND_SCAN_RANGE; y >= baseY - GROUND_SCAN_RANGE; y--) {
      try {
        const block = dimension.getBlock({ x, y, z });
        if (block && !block.isAir && !block.isLiquid) return y;
      } catch {
        // Block not loaded
      }
    }
    return null;
  }

  /** Handle use of mk:standard_bearer_scroll — spawn a Standard Bearer ally nearby */
  onScrollUse(player: Player): void {
    const ownerTag = `mk_owner_${player.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const angle = Math.random() * Math.PI * 2;
    const loc: Vector3 = {
      x: player.location.x + Math.cos(angle) * 3,
      y: player.location.y,
      z: player.location.z + Math.sin(angle) * 3,
    };

    system.run(() => {
      try {
        const bearer = player.dimension.spawnEntity("mk:mk_ally_standard_bearer", loc);
        bearer.addTag("mk_army");
        bearer.addTag(ownerTag);
        bearer.setDynamicProperty("mk:owner_name", player.name);
        const safeName = player.name.replace(/§./g, "");
        bearer.nameTag = `§a${safeName}'s Standard Bearer`;
        // Remove scroll from inventory
        player.runCommand("clear @s mk:mk_standard_bearer_scroll 0 1");
        player.sendMessage("§a+ A Standard Bearer has joined your army, raising morale!");
      } catch (e) {
        console.warn(`[MegaKnights] Standard Bearer spawn failed: ${e}`);
      }
    });
  }
}
