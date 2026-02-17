import { Entity, Vector3 } from "@minecraft/server";

export function distanceBetween(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function randomPositionAround(
  center: Vector3,
  minDist: number,
  maxDist: number
): Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const dist = minDist + Math.random() * (maxDist - minDist);
  return {
    x: center.x + Math.cos(angle) * dist,
    y: center.y,
    z: center.z + Math.sin(angle) * dist,
  };
}

export function isAlive(entity: Entity): boolean {
  try {
    const health = entity.getComponent("minecraft:health");
    return health !== undefined && (health as any).currentValue > 0;
  } catch {
    return false;
  }
}
