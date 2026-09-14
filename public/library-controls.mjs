export const SHELVES = [
  { minX: -2.55, maxX: -1.85, minZ: -3.55, maxZ: 1.55 },
  { minX: 1.85, maxX: 2.55, minZ: -3.55, maxZ: 1.55 },
];
const obstacles = [...SHELVES, {minX: -1.05, maxX: 1.05, minZ: -5.41, maxZ: -4.89}];

export function movePlayer(position, forward, sideways, yaw, delta, layout = null) {
  const length = Math.hypot(forward, sideways) || 1;
  const distance = Math.min(delta, 0.05) * 2.2;
  const dx = (sideways * Math.cos(yaw) - forward * Math.sin(yaw)) / length * distance;
  const dz = (-sideways * Math.sin(yaw) - forward * Math.cos(yaw)) / length * distance;
  const localObstacles = layout ? layout.bays.filter(bay => Math.abs(position.z + bay.offset + 1) < 8).flatMap(bay => SHELVES.map(shelf => ({...shelf, minZ:shelf.minZ - bay.offset, maxZ:shelf.maxZ - bay.offset}))) : obstacles;
  const blocked = (x, z) => localObstacles.some(shelf =>
    x > shelf.minX - .23 && x < shelf.maxX + .23 && z > shelf.minZ - .23 && z < shelf.maxZ + .23);
  const x = Math.max(-2.32, Math.min(2.32, position.x + dx));
  if (!blocked(x, position.z)) position.x = x;
  const z = Math.max(layout?.minZ ?? -5.35, Math.min(layout?.maxZ ?? 4.35, position.z + dz));
  if (!blocked(position.x, z)) position.z = z;
  return position;
}

export function targetBook(intersections) {
  // The closest solid surface wins: books behind boards cannot be selected.
  const hit = intersections[0];
  if (!hit || hit.distance > 3) return null;
  let object = hit.object;
  while (object) {
    if (object.userData?.book) return object;
    object = object.parent;
  }
  return null;
}
