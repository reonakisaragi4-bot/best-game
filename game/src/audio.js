// Synthesised sound effects, no audio files: short oscillator blips through one
// master gain, created lazily on the first user gesture (browsers block audio
// before that) and silent whenever the context is missing or muted.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** A tone that slides from one frequency to another over `seconds`. */
  function tone(from, to, seconds, type, volume) {
    if (muted) return;
    const audio = ensure();
    if (!audio || !master) return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.02);
    } catch {
      // Sound is garnish: a failure here must never stop the game.
    }
  }

  /** A short burst of filtered noise, for explosions. */
  function noise(seconds, volume) {
    if (muted) return;
    const audio = ensure();
    if (!audio || !master) return;
    try {
      const length = Math.max(1, Math.floor(audio.sampleRate * seconds));
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
      source.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // See tone(): sound must never stop the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 320, 0.09, 'square', 0.25);
    },
    explosion() {
      noise(0.28, 0.6);
      tone(160, 40, 0.25, 'sawtooth', 0.35);
    },
    pickup() {
      tone(660, 990, 0.1, 'sine', 0.4);
    },
    hit() {
      tone(220, 55, 0.3, 'sawtooth', 0.5);
      noise(0.2, 0.4);
    },
    waveClear() {
      tone(523, 523, 0.12, 'sine', 0.4);
      setTimeout(() => tone(659, 659, 0.12, 'sine', 0.4), 110);
      setTimeout(() => tone(784, 784, 0.2, 'sine', 0.4), 220);
    },
    win() {
      [523, 659, 784, 1047].forEach((note, i) => {
        setTimeout(() => tone(note, note, 0.22, 'triangle', 0.45), i * 140);
      });
    },
  };
}
