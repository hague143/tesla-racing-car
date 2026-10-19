const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

// Convert driving conditions into a continuous mix, independent of the renderer.
export function drivingSoundMix(drive, input = {}, traffic = []) {
  const speed = Math.abs(drive.speed || 0);
  const pace = clamp(speed / 66);
  const grounded = clamp(1 - (drive.altitude || 0) / .9);
  const throttle = !!input.throttle && !input.brake;
  const skid = grounded * Math.max(input.brake ? clamp((speed - 7) / 35) : 0,
    clamp((Math.abs(drive.steering || 0) - .5) * 2) * clamp((speed - 18) / 30));
  let nearest = null, nearestDistance = 55;
  for (const car of traffic) {
    const x = car.model?.position.x ?? car.x;
    const distance = Math.hypot(x - drive.x, car.z - drive.z, drive.altitude || 0);
    if (distance < nearestDistance) { nearestDistance = distance; nearest = { ...car, x }; }
  }
  const relativeSpeed = nearest ? Math.abs((nearest.direction === 1 ? -nearest.speed : nearest.speed) - drive.speed) : 0;
  return {
    motor: .012 + pace * .055 + (throttle ? .035 : 0),
    motorPitch: 65 + speed * 7.4 + (throttle ? 22 : 0) + (drive.boosting ? 85 : 0),
    road: Math.pow(pace, .8) * .11 * grounded * (drive.offRoad ? 1.35 : 1),
    wind: pace ** 1.6 * .14,
    windPitch: 950 + speed * 45,
    brake: input.brake && speed > 1 ? clamp(speed / 28) * .11 * grounded : 0,
    skid: skid * .045,
    skidPitch: 680 + speed * 7 + Math.abs(drive.steering || 0) * 160,
    vapor: drive.vapor || drive.altitude > .15 ? .12 + (drive.flying ? .07 : 0) : 0,
    turbine: drive.flying || drive.altitude > .15 ? .055 : 0,
    turbinePitch: 94 + (drive.altitude || 0) * 12 + Math.abs(drive.verticalSpeed || 0) * 9,
    boost: drive.boosting ? .11 : 0,
    reverse: drive.speed < -.6 && grounded > .5 ? .055 : 0,
    horn: input.horn ? .075 : 0,
    traffic: nearest ? (1 - nearestDistance / 55) ** 2 * (.065 + clamp(relativeSpeed / 70) * .07) : 0,
    trafficPitch: 380 + relativeSpeed * 16,
    trafficPan: nearest ? clamp(((nearest.x-drive.x)*Math.cos(drive.heading||0)-(nearest.z-drive.z)*Math.sin(drive.heading||0))/12,-.85,.85) : 0,
  };
}

function noiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 234567;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 4294967296 * 2 - 1) * .8;
  }
  return buffer;
}

// Also accepts OfflineAudioContext for verification of the actual generated audio.
export function createSoundGraph(context) {
  const master = context.createGain(); master.gain.value = 0;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -14; limiter.knee.value = 18; limiter.ratio.value = 5;
  limiter.attack.value = .004; limiter.release.value = .16;
  const meter = context.createAnalyser(); meter.fftSize = 2048;
  master.connect(limiter); limiter.connect(meter); meter.connect(context.destination);
  const noise = noiseBuffer(context), channels = {}, oscillators = {}, filters = {}, sources = [], voices = new Set();
  const targets = new WeakMap();
  const ramp = (parameter, value, seconds = .04) => {
    if (targets.get(parameter) === value) return;
    const now = context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
    parameter.linearRampToValueAtTime(value, now + seconds);
    targets.set(parameter, value);
  };
  const channel = name => {
    const gain = context.createGain(); gain.gain.value = 0; gain.connect(master); channels[name] = gain; return gain;
  };
  const tone = (name, type, frequency, destination = channel(name)) => {
    const oscillator = context.createOscillator(); oscillator.type = type; oscillator.frequency.value = frequency;
    oscillator.connect(destination); oscillator.start(); sources.push(oscillator); oscillators[name] = oscillator; return oscillator;
  };
  const hiss = (name, type, frequency, q = .6) => {
    const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
    const filter = context.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
    source.connect(filter); filter.connect(channel(name)); source.start(0, (sources.length * .17) % 1.9);
    sources.push(source); filters[name] = filter;
  };
  tone('motor', 'triangle', 65);
  const harmonic = context.createGain(); harmonic.gain.value = .23; harmonic.connect(channels.motor);
  tone('harmonic', 'sine', 156, harmonic);
  hiss('road', 'lowpass', 620);
  hiss('wind', 'bandpass', 1200, .35);
  hiss('brake', 'bandpass', 2400, 1.2);
  tone('skid', 'triangle', 700);
  hiss('vapor', 'bandpass', 1800, .45);
  tone('turbine', 'sine', 110);
  hiss('boost', 'bandpass', 2500, .5);
  const hornFilter = context.createBiquadFilter(); hornFilter.type = 'lowpass'; hornFilter.frequency.value = 1600;
  hornFilter.connect(channel('horn'));
  tone('hornLow', 'square', 349.23, hornFilter); tone('hornHigh', 'square', 440, hornFilter);
  hiss('traffic', 'bandpass', 800, .55);
  const pan = context.createStereoPanner();
  channels.traffic.disconnect(); channels.traffic.connect(pan); pan.connect(master);
  // The warning rhythm is in the loop itself, so it stays regular at low frame rates.
  const reverseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const reverseData = reverseBuffer.getChannelData(0);
  for (let i = 0; i < reverseData.length; i++) {
    const t = i / context.sampleRate;
    reverseData[i] = t < .18 ? Math.sin(2 * Math.PI * 880 * t) * Math.min(1, t / .008, (.18 - t) / .025) : 0;
  }
  const reverse = context.createBufferSource(); reverse.buffer = reverseBuffer; reverse.loop = true; reverse.connect(channel('reverse')); reverse.start(); sources.push(reverse);

  let hornActive=false,hornStarted=-Infinity;
  function setHorn(active,force=false) {
    if(active===hornActive&&!force)return;
    hornActive=active;
    const now=context.currentTime,parameter=channels.horn.gain;
    if(active){hornStarted=now;ramp(parameter,.075,.015);}
    else if(force){targets.delete(parameter);ramp(parameter,0,.015);}
    else if(now-hornStarted>=.12)ramp(parameter,0,.025);
    else {
      // A quick tap still makes a short honk; a held button sustains it.
      if(parameter.cancelAndHoldAtTime)parameter.cancelAndHoldAtTime(now);
      else{parameter.cancelScheduledValues(now);parameter.setValueAtTime(parameter.value,now);}
      parameter.linearRampToValueAtTime(.075,now+.012);
      parameter.setValueAtTime(.075,hornStarted+.12);
      parameter.linearRampToValueAtTime(0,hornStarted+.15);
      targets.set(parameter,0);
    }
  }
  function cue(kind, strength = 1) {
    if (voices.size >= 8) return;
    const now = context.currentTime + .012;
    const impact = kind === 'impact' || kind === 'landing';
    const settings = {
      start: [392, 523.25, .32], boost: [430, 900, .2], lift: [260, 540, .4],
      land: [480, 250, .28], reset: [330, 440, .22], impact: [70, 34, .38], landing: [60, 38, .24],
    }[kind];
    if (!settings) return;
    const [from, to, duration] = settings;
    const gain = context.createGain(); gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime((impact ? .16 : .065) * clamp(strength, .1, 1), now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration); gain.connect(master);
    const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration * .8); oscillator.connect(gain);
    voices.add(oscillator); oscillator.start(now); oscillator.stop(now + duration);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    if (impact) {
      const crack = context.createBufferSource(); crack.buffer = noise;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
      const envelope = context.createGain(); envelope.gain.setValueAtTime(.23 * clamp(strength, .1, 1), now);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + .2);
      crack.connect(filter); filter.connect(envelope); envelope.connect(master); voices.add(crack);
      crack.start(now); crack.stop(now + .21);
      crack.onended = () => { voices.delete(crack); crack.disconnect(); filter.disconnect(); envelope.disconnect(); };
    }
  }
  return {
    channels, oscillators, meter, master,
    get activeVoices() { return voices.size; },
    setMaster: value => ramp(master.gain, value),
    setHorn,
    apply(mix) {
      for (const name of Object.keys(channels)) if(name!=='horn')ramp(channels[name].gain, mix[name] || 0);
      setHorn(!!mix.horn);
      ramp(oscillators.motor.frequency, mix.motorPitch); ramp(oscillators.harmonic.frequency, mix.motorPitch * 2.4);
      ramp(oscillators.skid.frequency, mix.skidPitch); ramp(oscillators.turbine.frequency, mix.turbinePitch);
      ramp(filters.wind.frequency, mix.windPitch); ramp(filters.traffic.frequency, mix.trafficPitch);
      ramp(pan.pan, mix.trafficPan);
    },
    cue,
    stop() { for (const source of [...sources, ...voices]) { try { source.stop(); } catch {} source.disconnect(); } master.disconnect(); },
  };
}

export function createCarAudio(onChange = () => {}) {
  let context = null, graph = null, playing = false, muted = false, volume = .55, available = true, lastMix = null;
  let wasBoosting = false, previousAltitude = 0;
  try {
    muted = localStorage.getItem('teslaAudioMuted') === 'true';
    const stored = localStorage.getItem('teslaAudioVolume');
    if (stored !== null && Number.isFinite(Number(stored))) volume = clamp(Number(stored));
  } catch {}
  const applyVolume = () => { if (graph) graph.setMaster(playing && !muted ? volume * .8 : 0); };
  const save = () => { try { localStorage.setItem('teslaAudioMuted', String(muted)); localStorage.setItem('teslaAudioVolume', String(volume)); } catch {} };
  return {
    async unlock() {
      try {
        if (context?.state === 'running') return true;
        if (!context) {
          const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!AudioContext) { available = false; onChange(); return false; }
          context = new AudioContext({ latencyHint: 'interactive' }); graph = createSoundGraph(context); applyVolume();
        }
        if (context.state === 'suspended' || context.state === 'interrupted') await context.resume();
        onChange(); return context.state === 'running';
      } catch { available = false; onChange(); return false; }
    },
    setPlaying(value) {
      playing = value; if (!value && graph) graph.setHorn(false,true); applyVolume();
      if (!value) { wasBoosting = false; previousAltitude = 0; }
    },
    setMuted(value) { muted = !!value; save(); applyVolume(); onChange(); },
    setVolume(value) { if (Number.isFinite(value)) volume = clamp(value); save(); applyVolume(); onChange(); },
    setHorn(active) { if (graph) graph.setHorn(playing && active); },
    cue(kind, strength) { if (graph && playing && !muted) graph.cue(kind, strength); },
    update(drive, input, traffic) {
      if (!graph || !playing) return;
      lastMix = drivingSoundMix(drive, input, traffic); graph.apply(lastMix);
      if (drive.boosting && !wasBoosting && !muted) graph.cue('boost');
      if (previousAltitude > .04 && drive.altitude <= .04 && drive.verticalSpeed <= 0 && !muted) graph.cue('landing', .3);
      wasBoosting = drive.boosting; previousAltitude = drive.altitude;
    },
    snapshot() {
      let rms = 0, peak = 0;
      if (graph) {
        const samples = new Float32Array(graph.meter.fftSize); graph.meter.getFloatTimeDomainData(samples);
        for (const value of samples) { rms += value * value; peak = Math.max(peak, Math.abs(value)); } rms = Math.sqrt(rms / samples.length);
      }
      return { initialized: !!context, available, contextState: context?.state || 'uninitialized', playing, muted, volume, rms, peak,
        mix: lastMix, masterGain:graph?.master.gain.value||0, levels:graph?Object.fromEntries(Object.entries(graph.channels).map(([name,node])=>[name,node.gain.value])):{}, motorFrequency: graph?.oscillators.motor.frequency.value || 0, voices: graph?.activeVoices || 0 };
    },
    dispose() { if (graph) graph.stop(); if (context) void context.close(); graph = null; context = null; },
  };
}
