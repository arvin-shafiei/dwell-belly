// Vehicle physics contract: look-ahead "raycast" and collision detection over the live registry.
// Driving modules call obstacleAhead() each frame (or every few frames) to brake for anything in
// front of them, not just vehicles on the same lane. The Collisions module (modules/Collisions.tsx)
// detects real overlaps and turns them into crashes. Implemented by the physics agent; signatures fixed.
import type { VehicleEntry } from "./registry";

export interface Hit {
  id: string; // registry id of the thing hit / ahead
  dist: number; // metres from the ray origin to the obstacle's near edge
  kind: VehicleEntry["kind"];
  stopped: boolean;
}

/**
 * Cast a ray from (x, z) along `heading` (radians, 0 = +z, same as mesh.rotation.y) for `range` metres
 * with a corridor `halfWidth` either side. Returns the nearest registry vehicle (other than `selfId`)
 * whose footprint intersects the corridor, or null.
 */
export function obstacleAhead(selfId: string, x: number, z: number, heading: number, range: number, halfWidth = 1.2): Hit | null {
  void selfId; void x; void z; void heading; void range; void halfWidth;
  return null; // TODO(physics agent): spatial hash over registry + OBB/corridor test
}

/** Approximate footprint half-extents for a registry kind (length/2, width/2) in metres. */
export function footprint(kind: VehicleEntry["kind"]): { halfLength: number; halfWidth: number } {
  switch (kind) {
    case "truck": case "roadworks": case "fire": case "tow": return { halfLength: 5.5, halfWidth: 1.3 };
    case "bus": return { halfLength: 5.5, halfWidth: 1.3 };
    case "van": case "ambulance": return { halfLength: 2.8, halfWidth: 1.05 };
    default: return { halfLength: 2.2, halfWidth: 0.95 };
  }
}
