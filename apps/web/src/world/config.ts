// World layout. Units are metres, y is up, the ground is y = 0.
// Every module places its content inside its own zone box so modules never overlap.

export const ROAD_WIDTH = 8; // two lanes, one each way
export const LANE_OFFSET = 2; // vehicles drive on the LEFT (UK): offset from the road centre line
export const BLOCK = 40; // distance between downtown intersections
export const GRID_HALF = 4; // downtown grid runs from -4..4 blocks => -160..160
export const HIGHWAY_RING = 220; // highway square ring at |x| = 220 or |z| = 220

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ZONES = {
  // Downtown grid (roads every 40 m). Buildings fill the blocks between roads.
  downtown: { minX: -160, maxX: 160, minZ: -160, maxZ: 160 },
  // East: harbour with cranes, containers, a ship on the water past x = 330.
  docks: { minX: 240, maxX: 340, minZ: -80, maxZ: 80 },
  // West: farms, fields, trees, hills.
  countryside: { minX: -360, maxX: -240, minZ: -120, maxZ: 120 },
  // South: the delivery depot / warehouse with loading bays.
  depot: { minX: -60, maxX: 60, minZ: 240, maxZ: 330 },
  // North: suburb houses (delivery stops).
  suburbs: { minX: -80, maxX: 80, minZ: -340, maxZ: -240 },
  // North-west: the airport. Runway runs along x; terminal, cargo sheds, control tower.
  airport: { minX: -460, maxX: -250, minZ: -440, maxZ: -250 },
} satisfies Record<string, Box>;

export type ZoneName = keyof typeof ZONES;

export const WORLD_SIZE = 800; // ground plane is WORLD_SIZE x WORLD_SIZE centred on 0
export const WATER_X = 340; // water (sea) starts east of this x

export function inBox(b: Box, x: number, z: number, margin = 0) {
  return x >= b.minX - margin && x <= b.maxX + margin && z >= b.minZ - margin && z <= b.maxZ + margin;
}
