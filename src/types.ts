export type GameState = 'BOOT' | 'LOADING' | 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'ERROR';
export type Language = 'en' | 'es';
export interface Settings {
  quality: 'low' | 'medium' | 'high'; muted: boolean; volume: number;
  reducedMotion: boolean; shake: boolean; language: Language; seenControls: boolean;
}
export interface Profile { name: string; region: string; bestScore: number; bestDistance: number; runs: number }
export interface Obstacle {
  active: boolean; id: number; lane: number; x: number; z: number; prevZ: number;
  speed: number; height: number; length: number; width: number; variant: number;
  nearMissed: boolean;
}
export interface Pickup { active: boolean; lane: number; z: number; prevZ: number; phase: number }
export interface Run {
  x: number; prevX: number; lane: number; y: number; prevY: number; vy: number;
  speed: number; distance: number; elapsed: number; score: number; energy: number;
  boosting: boolean; boostLocked: boolean; roll: number; rollTime: number; rollDuration: number;
  rollDirection: number; rolls: number; nearMisses: number; pickups: number;
  jumpCooldown: number; alive: boolean; nextRow: number; rowIndex: number;
  obstacles: Obstacle[]; pickupsPool: Pickup[]; seed: number; lastSafeLane: number;
}
export interface Commands { lane: number; jump: boolean; roll: number; boost: boolean; brake: boolean; horn: boolean }
export type SimEvent = 'jump' | 'landing' | 'roll' | 'pickup' | 'near' | 'collision' | 'boost';
