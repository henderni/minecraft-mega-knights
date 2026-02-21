import { world, system, Player, Dimension, Vector3 } from "@minecraft/server";
import { getOwnerTag } from "./ArmySystem";
import { ArmySystem } from "./ArmySystem";
import { generateAllyName } from "../data/AllyNames";
import {
  MERCHANT_APPEARED,
  STANDARD_BEARER_JOINED,
  ARMY_FULL,
  ARMY_FULL_SHARED,
} from "../data/Strings";

/** Days on which the Wandering Merchant may spawn near each player */
export const MERCHANT_DAYS = new Set([15, 30, 55, 75, 95]);

/** Minimum blocks away from player the merchant spawns */
const MERCHANT_SPAWN_DIST = 10;
/** Maximum blocks away */
const MERCHANT_SPAWN_MAX_DIST = 20;

const GROUND_SCAN_RANGE = 10;

/**
 * MerchantSystem — spawns the Wandering Merchant near players on
 * specific milestone days (15, 30, 55, 75, 95).
 *
 * One merchant per player per day. The entity has a built-in 600s timer
 * (minecraft:timer in entity JSON) and despawns itself — no script tracking needed.
 */
export class MerchantSystem {
  private army: ArmySystem;

  constructor(army: ArmySystem) {
    this.army = army;
  }

  /** Track which players already have a merchant this day */
  private merchantedThisDay = new Set<string>();

  onDayChanged(day: number): void {
    // Normal merchant days + endless mode recurring every 25 days past day 100
    const isMerchantDay = MERCHANT_DAYS.has(day) || (day > 100 && (day - 100) % 25 === 0);
    if (!isMerchantDay) {return;}
    this.merchantedThisDay.clear();
    this.spawnMerchantsForDay();
  }

  private spawnMerchantsForDay(): void {
    const players = world.getAllPlayers();
    for (const player of players) {
      if (!player.isValid) {continue;}
      if (this.merchantedThisDay.has(player.name)) {continue;}
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
    const groundY = findGroundLevel(dim, Math.floor(rawX), Math.floor(player.location.y), Math.floor(rawZ));
    if (groundY === null) {return;}

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
        player.sendMessage(MERCHANT_APPEARED);
      } catch (e) {
        console.warn(`[MegaKnights] Merchant spawn failed: ${e}`);
      }
    });
  }

  /** Handle use of mk:standard_bearer_scroll — spawn a Standard Bearer ally nearby */
  onScrollUse(player: Player): void {
    if (!player.isValid) {return;}

    const ownerTag = getOwnerTag(player.name);
    const angle = Math.random() * Math.PI * 2;
    const loc: Vector3 = {
      x: player.location.x + Math.cos(angle) * 3,
      y: player.location.y,
      z: player.location.z + Math.sin(angle) * 3,
    };

    system.run(() => {
      try {
        if (!player.isValid) {return;}

        // Re-check army capacity inside system.run() to prevent race condition
        // when two scrolls are used in the same tick
        const currentSize = (player.getDynamicProperty("mk:army_size") as number) ?? 0;
        const armyBonus = (player.getDynamicProperty("mk:army_bonus") as number) ?? 0;
        const maxSize = this.army.getMaxArmySize(player);
        const playerCount = world.getAllPlayers().length;
        const effectiveCap = ArmySystem.getEffectiveCap(armyBonus, playerCount);

        if (currentSize >= effectiveCap) {
          if (effectiveCap < maxSize && playerCount > 1) {
            player.sendMessage(ARMY_FULL_SHARED(effectiveCap));
          } else {
            player.sendMessage(ARMY_FULL);
          }
          return;
        }

        const bearer = player.dimension.spawnEntity("mk:mk_ally_standard_bearer", loc);
        bearer.addTag("mk_army");
        bearer.addTag(ownerTag);
        bearer.setDynamicProperty("mk:owner_name", player.name);
        const allyName = generateAllyName("mk:mk_ally_standard_bearer");
        bearer.nameTag = `§a${allyName} §7(Standard Bearer)`;
        bearer.setDynamicProperty("mk:ally_name", allyName);
        // Increment army count
        const size = (player.getDynamicProperty("mk:army_size") as number) ?? 0;
        player.setDynamicProperty("mk:army_size", size + 1);
        // Remove scroll from inventory
        player.runCommand("clear @s mk:mk_standard_bearer_scroll 0 1");
        player.sendMessage(STANDARD_BEARER_JOINED);
      } catch (e) {
        console.warn(`[MegaKnights] Standard Bearer spawn failed: ${e}`);
      }
    });
  }
}

/** Find solid ground level at the given X/Z — shared between camp and merchant spawning */
export function findGroundLevel(dimension: Dimension, x: number, baseY: number, z: number, scanRange = GROUND_SCAN_RANGE): number | null {
  for (let y = baseY + scanRange; y >= baseY - scanRange; y--) {
    try {
      const block = dimension.getBlock({ x, y, z });
      if (block && !block.isAir && !block.isLiquid) {return y;}
    } catch {
      // Block not loaded
    }
  }
  return null;
}
