export interface WaveSpawn {
  entityId: string;
  count: number;
}

export interface WaveDefinition {
  waveNumber: number;
  spawns: WaveSpawn[];
  delayTicks: number; // ticks before this wave spawns (after previous wave)
}

export const WAVE_DEFINITIONS: WaveDefinition[] = [
  {
    waveNumber: 1,
    spawns: [
      { entityId: "mk:mk_enemy_knight", count: 5 },
      { entityId: "mk:mk_enemy_archer", count: 3 },
    ],
    delayTicks: 0, // immediate
  },
  {
    waveNumber: 2,
    spawns: [
      { entityId: "mk:mk_enemy_knight", count: 8 },
      { entityId: "mk:mk_enemy_archer", count: 5 },
      { entityId: "mk:mk_enemy_wizard", count: 2 },
    ],
    delayTicks: 1200, // 60 seconds
  },
  {
    waveNumber: 3,
    spawns: [
      { entityId: "mk:mk_enemy_knight", count: 10 },
      { entityId: "mk:mk_enemy_archer", count: 8 },
      { entityId: "mk:mk_enemy_wizard", count: 4 },
      { entityId: "mk:mk_enemy_dark_knight", count: 3 },
    ],
    delayTicks: 1200,
  },
  {
    waveNumber: 4,
    spawns: [
      { entityId: "mk:mk_enemy_dark_knight", count: 6 },
      { entityId: "mk:mk_enemy_wizard", count: 6 },
      { entityId: "mk:mk_enemy_archer", count: 10 },
    ],
    delayTicks: 1200,
  },
  {
    waveNumber: 5,
    spawns: [
      { entityId: "mk:mk_boss_siege_lord", count: 1 },
      { entityId: "mk:mk_enemy_dark_knight", count: 8 },
      { entityId: "mk:mk_enemy_knight", count: 15 },
    ],
    delayTicks: 1200,
  },
];
