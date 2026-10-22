import type { GameState } from './types';
const transitions: Record<GameState, GameState[]> = {
  BOOT: ['LOADING'], LOADING: ['MENU', 'ERROR'], MENU: ['PLAYING', 'ERROR'],
  PLAYING: ['PAUSED', 'GAME_OVER', 'ERROR'], PAUSED: ['PLAYING', 'MENU', 'ERROR'],
  GAME_OVER: ['PLAYING', 'MENU', 'ERROR'], ERROR: ['LOADING'],
};
export class StateMachine {
  current: GameState = 'BOOT';
  constructor(private onChange: (next: GameState, previous: GameState) => void) {}
  go(next: GameState) {
    if (next === this.current) return;
    if (!transitions[this.current].includes(next)) throw new Error(`Invalid state: ${this.current} → ${next}`);
    const previous = this.current; this.current = next; this.onChange(next, previous);
  }
}
