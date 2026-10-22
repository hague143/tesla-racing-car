// Original game identity and optional links can be changed without editing UI code.
export const CONFIG = {
  title: ['TESLA', 'NIGHT SHIFT'], brand: 'NIGHTSHIFT', logoUrl: '',
  attribution: 'Independent fan game. Not affiliated with Tesla, Inc.',
  supportUrl: '', contactUrl: '',
  leaderboardUrl: (import.meta.env?.VITE_LEADERBOARD_URL || '').replace(/\/$/, ''),
};
export const LANES = [-5.25, -1.75, 1.75, 5.25];
export const STEP = 1 / 120;
export const GRAVITY = 22;
export const JUMP_VELOCITY = 11.5;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
