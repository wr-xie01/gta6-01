// Audio — one clear job: every sound the game makes, synthesized with WebAudio.
// No audio files: engine, siren, gunshot, punch, pickup, mission chimes, explosion,
// and a small bass-and-hat music loop. Starts on the first user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let musicTimer = null, musicStep = 0;
  let muted = false;
  let sirenOn = false, sirenOscA = null, sirenOscB = null, sirenGain = null, sirenPhase = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth through a low-pass filter, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch { return false; }
  }
  function unlock() { ensure(); }
  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }
  function isMuted() { return muted; }
  function engine(speed01, on) {
    if (!ctx || !engineOsc) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, t, 0.08);
    engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.06);
    engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.08);
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, vol, filterFreq, type = 'lowpass') {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, (dur * ctx.sampleRate) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }
  function gunshot() { noiseBurst(0.14, 0.5, 1800, 'highpass'); blip(160, 0.1, 'square', 0.22, 60); }
  function punch() { noiseBurst(0.09, 0.35, 500); blip(110, 0.08, 'sine', 0.3, 55); }
  function pickup() { blip(660, 0.09, 'sine', 0.3); setTimeout(() => blip(990, 0.14, 'sine', 0.3), 80); }
  function cash() { blip(880, 0.08, 'triangle', 0.28); setTimeout(() => blip(1174, 0.1, 'triangle', 0.28), 70); setTimeout(() => blip(1568, 0.16, 'triangle', 0.3), 140); }
  function missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.32), i * 110)); }
  function missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.18), i * 140)); }
  function click() { blip(700, 0.05, 'square', 0.12); }
  function crash() { noiseBurst(0.25, 0.5, 900); blip(90, 0.2, 'sine', 0.4, 40); }
  function explosion() { noiseBurst(0.7, 0.7, 400); blip(70, 0.6, 'sine', 0.5, 28); }
  function busted() { [440, 415, 392, 370].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'square', 0.16), i * 130)); }
  // Police siren: two alternating tones while any police car is near.
  function siren(active) {
    if (!ctx) return;
    if (active && !sirenOn) {
      sirenOn = true;
      sirenOscA = ctx.createOscillator(); sirenOscA.type = 'triangle'; sirenOscA.frequency.value = 720;
      sirenOscB = ctx.createOscillator(); sirenOscB.type = 'triangle'; sirenOscB.frequency.value = 540;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
      sirenOscA.connect(sirenGain); sirenOscB.connect(sirenGain); sirenGain.connect(master);
      sirenOscA.start(); sirenOscB.start();
      sirenPhase = 0;
    } else if (!active && sirenOn) {
      sirenOn = false;
      try { sirenOscA.stop(); sirenOscB.stop(); } catch { /* already stopped */ }
      sirenOscA = null; sirenOscB = null; sirenGain = null;
    }
    if (sirenOn) {
      sirenPhase += 1;
      const hi = sirenPhase % 40 < 20;
      if (sirenOscA && sirenOscB) {
        sirenOscA.frequency.value = hi ? 720 : 0;
        sirenOscB.frequency.value = hi ? 0 : 540;
      }
    }
  }
  // Music: a slow 8-step bass loop with a hat tick, started after the first gesture.
  function startMusic() {
    if (!ctx || musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0];
    musicTimer = setInterval(() => {
      if (muted) return;
      const f = bass[musicStep % bass.length];
      if (f) blip(f, 0.22, 'triangle', 0.16);
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.05, 6000, 'highpass');
      musicStep++;
    }, 300);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  return { unlock, setMuted, isMuted, engine, gunshot, punch, pickup, cash, missionDone, missionFail, click, crash, explosion, busted, siren, startMusic, stopMusic };
}
