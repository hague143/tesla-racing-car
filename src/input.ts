import { emptyCommands } from './simulation';
import type { Commands } from './types';
type Action = 'start' | 'pause' | 'mute' | 'restart' | 'escape';
export class Input {
  private held = new Set<string>();
  private touchHeld = new Set<string>();
  private pending: Commands = emptyCommands();
  private repeat = 0;
  private controller = new AbortController();
  constructor(private playing: () => boolean, private action: (action: Action) => void) {
    const signal = this.controller.signal;
    window.addEventListener('keydown', e => {
      const form = (e.target as HTMLElement).closest('input, select, textarea, [contenteditable]');
      if (form) { if (e.code === 'Escape') this.action('escape'); return; }
      if (e.code === 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(e.code) && (this.playing() || e.target === document.body)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyM') return this.action('mute');
      if (e.code === 'Escape') return this.action('escape');
      if (e.code === 'KeyP') return this.action('pause');
      if (e.code === 'KeyR') return this.action('restart');
      if (!this.playing()) { if (e.code === 'Space' && e.target === document.body) this.action('start'); return; }
      this.held.add(e.code);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.pending.lane = -1; this.repeat = .28; }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.pending.lane = 1; this.repeat = .28; }
      if (e.code === 'Space') this.pending.jump = true;
      if (e.code === 'KeyQ') this.pending.roll = -1;
      if (e.code === 'KeyE') this.pending.roll = 1;
    }, { signal });
    window.addEventListener('keyup', e => this.held.delete(e.code), { signal });
    window.addEventListener('blur', () => this.clear(), { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')) {
      const key = button.dataset.control!;
      button.addEventListener('pointerdown', e => {
        if (!this.playing()) return; e.preventDefault(); button.setPointerCapture(e.pointerId);
        this.touchHeld.add(key); button.classList.add('pressed');
        if (key === 'left' || key === 'right') { this.pending.lane = key === 'left' ? -1 : 1; this.repeat = .28; }
        if (key === 'jump') this.pending.jump = true;
        if (key === 'roll') this.pending.roll = 1;
      }, { signal });
      const release = () => { this.touchHeld.delete(key); button.classList.remove('pressed'); };
      button.addEventListener('pointerup', release, { signal });
      button.addEventListener('pointercancel', release, { signal });
      button.addEventListener('lostpointercapture', release, { signal });
      button.addEventListener('contextmenu', e => e.preventDefault(), { signal });
    }
  }
  sample(dt: number): Commands {
    const left = this.held.has('KeyA') || this.held.has('ArrowLeft') || this.touchHeld.has('left');
    const right = this.held.has('KeyD') || this.held.has('ArrowRight') || this.touchHeld.has('right');
    this.repeat -= dt;
    if ((left || right) && this.repeat <= 0) { this.pending.lane = Number(right) - Number(left); this.repeat = .22; }
    const input = { ...this.pending,
      boost: this.held.has('ShiftLeft') || this.held.has('ShiftRight') || this.touchHeld.has('boost'),
      brake: this.held.has('KeyS') || this.held.has('ArrowDown'),
      horn: this.held.has('KeyB') || this.touchHeld.has('horn'),
    };
    this.pending.lane = 0; this.pending.jump = false; this.pending.roll = 0; return input;
  }
  clear() { this.held.clear(); this.touchHeld.clear(); this.pending = emptyCommands(); this.repeat = 0;
    document.querySelectorAll('.pressed').forEach(e => e.classList.remove('pressed')); }
  dispose() { this.clear(); this.controller.abort(); }
}
