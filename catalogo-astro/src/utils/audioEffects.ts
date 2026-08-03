// Audio Controller for Interactive Flipbook
// Features "Bad Bunny - Eoow" background audio track with multiple audio mirrors & fallback synth
// Handles browser autoplay permissions and gesture activation gracefully.

class AudioController {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private isMusicPlaying = false;
  private oscs: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private trackAudio: HTMLAudioElement | null = null;

  // List of audio sources to try for Bad Bunny - Eoow (local asset first, then mirrors)
  private audioSources = [
    "/audio/eoow.mp3",
    "https://raw.githubusercontent.com/Jeysson16/catalogo-dechy/main/public/audio/eoow.mp3"
  ];
  private currentSourceIdx = 0;

  constructor() {
    if (typeof window !== "undefined") {
      this.initAudioElement();
    }
  }

  private initAudioElement() {
    if (this.currentSourceIdx >= this.audioSources.length) return;
    const url = this.audioSources[this.currentSourceIdx];
    this.trackAudio = new Audio(url);
    this.trackAudio.loop = true;
    this.trackAudio.volume = 0.55;

    this.trackAudio.onerror = () => {
      this.currentSourceIdx++;
      if (this.currentSourceIdx < this.audioSources.length) {
        this.initAudioElement();
        if (this.isMusicPlaying) {
          this.trackAudio?.play().catch(() => {});
        }
      }
    };
  }

  /**
   * Safe AudioContext initialization only after user gesture
   */
  private initContext() {
    try {
      if (!this.ctx && typeof window !== "undefined") {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    } catch (_) {}
  }

  /**
   * Synthesizes a realistic, crisp paper flipping sound
   */
  playPageFlip() {
    try {
      this.initContext();
      if (!this.ctx || this.ctx.state === "suspended") return;

      const duration = 0.22;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(800, this.ctx.currentTime);
      bandpass.frequency.exponentialRampToValueAtTime(2200, this.ctx.currentTime + duration * 0.5);
      bandpass.Q.setValueAtTime(2.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      whiteNoise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(this.ctx.currentTime + duration);
    } catch (_) {}
  }

  /**
   * Starts playing Bad Bunny - Eoow music track with safe gesture handling
   */
  startMusic(): boolean {
    if (this.isMusicPlaying) return true;
    this.isMusicPlaying = true;

    if (this.trackAudio) {
      const promise = this.trackAudio.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          // Playback blocked by browser autoplay policy until user gesture
          console.warn("Autoplay notice: Waiting for user gesture to play audio.");
          this.isMusicPlaying = false;
        });
      }
      return true;
    } else {
      this.startAmbientFallback();
      return true;
    }
  }

  private startAmbientFallback() {
    try {
      this.initContext();
      if (!this.ctx || this.ctx.state === "suspended") return;

      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.001, now);
      this.ambientGain.gain.linearRampToValueAtTime(0.06, now + 2.5);
      this.ambientGain.connect(this.ctx.destination);

      const frequencies = [130.81, 174.61, 220.0, 261.63, 329.63];
      this.oscs = [];

      frequencies.forEach((freq, idx) => {
        if (!this.ctx || !this.ambientGain) return;
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        osc.type = idx % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq + (Math.random() * 0.4 - 0.2), now);

        oscGain.gain.setValueAtTime(1 / (idx + 2), now);

        osc.connect(oscGain);
        oscGain.connect(this.ambientGain);
        osc.start();
        this.oscs.push(osc);
      });

      this.lfo = this.ctx.createOscillator();
      this.lfo.type = "sine";
      this.lfo.frequency.setValueAtTime(0.12, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(1.5, now);
      this.lfo.connect(lfoGain);
      if (this.oscs[0]) lfoGain.connect(this.oscs[0].frequency);
      this.lfo.start();
    } catch (_) {}
  }

  /**
   * Stops the active music track & synth
   */
  stopMusic() {
    this.isMusicPlaying = false;
    if (this.trackAudio) {
      try {
        this.trackAudio.pause();
      } catch (_) {}
    }

    if (this.ambientGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
        this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
        setTimeout(() => {
          this.oscs.forEach((osc) => {
            try { osc.stop(); osc.disconnect(); } catch (_) {}
          });
          if (this.lfo) {
            try { this.lfo.stop(); this.lfo.disconnect(); } catch (_) {}
          }
          this.oscs = [];
          this.lfo = null;
          this.ambientGain?.disconnect();
        }, 850);
      } catch (_) {}
    }
  }

  toggleMusic(): boolean {
    if (this.isMusicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  isPlaying(): boolean {
    return this.isMusicPlaying;
  }
}

export const flipbookAudio = new AudioController();
