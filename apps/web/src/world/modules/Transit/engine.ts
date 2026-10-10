// Transit engine: one passenger pool shared by buses and metro, rendered in two draw calls.
import { useWorld } from "../../store";
import { createBuses } from "./buses";
import { nightLevel } from "./kit";
import { createMetro } from "./metro";
import { PassengerPool } from "./passengers";
import { createPeople } from "./people";

export function createTransit() {
  const pool = new PassengerPool(720, 1717);
  const buses = createBuses(pool);
  const metro = createMetro(pool);
  const people = createPeople(pool);
  return {
    meshes: [...buses.meshes, ...metro.meshes, ...people.meshes],
    register: () => buses.register(),
    tick(delta: number) {
      const dt = Math.min(delta, 0.1);
      const { paused, timeOfDay } = useWorld.getState();
      const night = nightLevel(timeOfDay);
      const now = performance.now();
      if (!paused) pool.step(dt);
      buses.tick(dt, now, !paused, night);
      metro.tick(dt, !paused, night);
      people.tick();
    },
    dispose() {
      buses.dispose();
      metro.dispose();
      people.dispose();
    },
  };
}
