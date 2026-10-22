import { World } from './world';
import { Input } from './input';
import { UI, el } from './ui';
import { StateMachine } from './state';
import { createRun, emptyCommands, simulate } from './simulation';
import { loadProfile, loadSettings, saveRecord } from './storage';
import { createCarAudio } from './audio.js';
import { Leaderboard } from './leaderboard';
import { STEP } from './config';
import type { Commands, Run, SimEvent } from './types';

const settings = loadSettings(), profile = loadProfile(), rankings = new Leaderboard();
const audio = createCarAudio();
let world: World | null = null, run = createRun(), accumulator = 0, last = 0, frame = 0, hudClock = 0;
let runNumber = 0, beganAt = 0, booting = false, input: Input;
let lastCommands = emptyCommands();

const machine = new StateMachine((next) => {
  input?.clear(); accumulator = 0; audio.setPlaying(next === 'PLAYING'); ui.setState(next);
});
const applySettings = () => { world?.applySettings(settings); audio.setMuted(settings.muted); audio.setVolume(settings.volume); };
const ui = new UI(settings, profile, rankings, {
  play: start, pause, resume, menu, settings: applySettings, feedback: () => audio.menu(),
  mute: () => { settings.muted = !settings.muted; ui.persistSettings(); ui.syncSettings(); },
  retry: () => { void boot(); },
});
input = new Input(() => machine.current === 'PLAYING' && !ui.panel, action => {
  if (action === 'mute') { settings.muted = !settings.muted; ui.persistSettings(); ui.syncSettings(); }
  if (action === 'start' && ['MENU', 'GAME_OVER'].includes(machine.current) && !ui.panel) ui.play();
  if (action === 'restart' && machine.current === 'GAME_OVER' && !ui.panel) start();
  if (action === 'pause') { if (machine.current === 'PLAYING') pause(); else if (machine.current === 'PAUSED' && !ui.panel) resume(); }
  if (action === 'escape') {
    if (ui.panel) ui.close(); else if (machine.current === 'PLAYING') pause(); else if (machine.current === 'PAUSED') resume();
  }
});
applySettings();

function start() {
  if (machine.current === 'PAUSED') return resume();
  if (!['MENU', 'GAME_OVER'].includes(machine.current) || !world) return;
  runNumber++; run = createRun((Date.now() ^ runNumber * 7919) >>> 0); world.reset(); lastCommands = emptyCommands();
  beganAt = performance.now(); rankings.start();
  void audio.unlock().then(() => { if (machine.current === 'PLAYING') audio.cue('start'); });
  machine.go('PLAYING'); ui.hud(run, 0);
}
function pause() { if (machine.current === 'PLAYING') machine.go('PAUSED'); }
function resume() {
  if (machine.current !== 'PAUSED') return;
  ui.close(); void audio.unlock(); machine.go('PLAYING');
}
function menu() {
  if (machine.current === 'PLAYING') pause();
  if (!['PAUSED', 'GAME_OVER'].includes(machine.current)) return;
  runNumber++; world?.reset(); machine.go('MENU');
}
function event(kind: SimEvent) {
  ui.event(kind);
  if (kind === 'jump') audio.cue('jump');
  if (kind === 'roll') audio.cue('roll');
  if (kind === 'pickup') { audio.cue('pickup'); world?.burst(kind, run); }
  if (kind === 'landing') { audio.cue('landing', .4); world?.burst(kind, run); }
  if (kind === 'near') audio.cue('near');
  if (kind === 'collision') world?.burst(kind, run);
}
function finish() {
  if (machine.current !== 'PLAYING') return;
  const record = saveRecord(profile, run), number = runNumber;
  ui.gameOver(run, record.newScore || record.newDistance, record.stored);
  machine.go('GAME_OVER'); audio.ending(); ui.hud(run, 0);
  // A brief impact cue may finish; all continuous channels and horn are already muted.
  void rankings.submit(profile, run, (performance.now() - beganAt) / 1000).then(status => {
    if (runNumber === number) ui.submission(status);
  });
}
const soundDrive = { speed: 0, x: 0, z: 0, heading: 0, steering: 0, altitude: 0, verticalSpeed: 0,
  flying: false, vapor: false, boosting: false, offRoad: false };
const soundInput = { throttle: true, brake: false, horn: false };
function sound() {
  // Adapt the arcade simulation to the existing original electric-car synthesizer.
  Object.assign(soundDrive, { speed: run.speed, x: run.x, z: 0, heading: 0, steering: (run.x - run.prevX) * 12,
    altitude: run.y, verticalSpeed: run.vy, flying: run.y > .2, vapor: run.boosting || run.y > .2,
    boosting: run.boosting, offRoad: false });
  soundInput.brake = lastCommands.brake; soundInput.horn = lastCommands.horn;
  audio.update(soundDrive, soundInput, run.obstacles);
}
function tick(now: number) {
  const dt = Math.min((now - last) / 1000 || 0, .08); last = now;
  if (machine.current === 'PLAYING') {
    accumulator += dt;
    while (accumulator >= STEP && machine.current === 'PLAYING') {
      lastCommands = input.sample(STEP); simulate(run, lastCommands, STEP, event); accumulator -= STEP;
      if (!run.alive) finish();
    }
    sound(); hudClock += dt;
    if (hudClock > .05) { ui.hud(run, hudClock); hudClock = 0; }
  }
  if (world && !document.hidden && !['ERROR', 'BOOT', 'LOADING'].includes(machine.current)) {
    try { world.render(run, machine.current, dt, now / 1000); }
    catch { fail('contextLost'); }
  }
  frame = requestAnimationFrame(tick);
}
function fail(kind: 'unsupported' | 'contextLost') {
  if (machine.current === 'ERROR') return;
  audio.setPlaying(false); machine.go('ERROR'); ui.error(kind);
}
const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
async function boot() {
  if (booting) return; booting = true;
  machine.go('LOADING'); ui.loading(8, 'loadCheck');
  try {
    await nextPaint(); world?.dispose(); world = null;
    // A lost canvas context cannot always be restored immediately. Replacing it
    // gives Retry a fresh context rather than a cached failed one.
    const old = el<HTMLCanvasElement>('world'), canvas = old.cloneNode() as HTMLCanvasElement; old.replaceWith(canvas);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('contextLost'); });
    if (new URLSearchParams(location.search).has('noWebGL')) throw new Error('WEBGL_UNSUPPORTED');
    ui.loading(25, 'loadWorld'); await nextPaint();
    world = new World(canvas, settings); ui.loading(85, 'loadWorld');
    world.render(run, 'MENU', 1, 0); await nextPaint(); // Includes actual first shader compilation.
    ui.loading(100, 'loadReady'); await nextPaint(); machine.go('MENU');
  } catch (error) { console.warn('Night Shift graphics initialization:', error); fail('unsupported'); }
  finally { booting = false; }
}
window.addEventListener('resize', () => world?.resize());
const suspend = () => { pause(); input.clear(); audio.setPlaying(false); };
window.addEventListener('blur', suspend);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); last = performance.now(); });
window.addEventListener('pagehide', () => { audio.setPlaying(false); });
window.addEventListener('beforeunload', () => { cancelAnimationFrame(frame); input.dispose(); audio.dispose(); world?.dispose(); });

if (new URLSearchParams(location.search).has('debug')) {
  // Deterministic diagnostics are absent unless explicitly requested.
  Object.assign(window, { __nightshift: {
    get state() { return machine.current; }, get run() { return run; }, get world() { return world; },
    get audio() { return audio.snapshot(); }, get settings() { return settings; },
    step(seconds: number, commands: Partial<Commands> = {}) {
      for (let t = 0; t < Math.min(600, seconds) && machine.current === 'PLAYING'; t += STEP) {
        simulate(run, { ...emptyCommands(), ...commands, lane: t === 0 ? commands.lane || 0 : 0, jump: t === 0 && !!commands.jump, roll: t === 0 ? commands.roll || 0 : 0 }, STEP, event);
        if (!run.alive) finish();
      }
      ui.hud(run, .1); sound();
    },
    clearTraffic() { run.obstacles.forEach(o => o.active = false); run.pickupsPool.forEach(p => p.active = false); run.nextRow = 1e8; },
  } });
}
void boot(); frame = requestAnimationFrame(tick);
