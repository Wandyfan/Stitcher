/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SkydivingAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private windNoise: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private beepTimer: any = null;
  private lastBeepTime: number = 0;

  constructor() {
    // Initialized lazily on user interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.setupWind();
    } catch (e) {
      console.warn("Failed to initialize Web Audio API:", e);
    }
  }

  private setupWind() {
    if (!this.ctx || !this.masterGain) return;

    // Generate 2 seconds of white noise buffer
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.windNoise = this.ctx.createBufferSource();
    this.windNoise.buffer = noiseBuffer;
    this.windNoise.loop = true;

    // Create a lowpass filter & bandpass filter combination for rich wind
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);
    this.windFilter.frequency.setValueAtTime(200, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.001, this.ctx.currentTime); // Start quiet

    // Connect nodes
    this.windNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    this.windNoise.start();
  }

  public updateWind(speedKmh: number, isParachute: boolean) {
    if (!this.ctx || !this.windFilter || !this.windGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Normalize speed 0 - 250
    const ratio = Math.min(Math.max(speedKmh / 225, 0), 1.2);
    
    // Wind volume gets Louder as we fall faster
    let targetVolume = ratio * 0.4;
    // Lowpass filter frequency gets higher as air friction increases
    let targetFrequency = 150 + ratio * 700;

    if (isParachute) {
      targetVolume = 0.12; 
      targetFrequency = 220; // Calm wind hum
    }

    this.windGain.gain.setTargetAtTime(targetVolume, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(targetFrequency, t, 0.25);
  }

  public playWhoosh() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Create an oscillator sweeper
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(350, t + 0.4);
    osc.frequency.exponentialRampToValueAtTime(100, t + 1.2);

    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(0.8, t + 0.15);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.start();
    osc.stop(t + 1.5);

    // Temp high pass sweep for the rustle
    const highPass = this.ctx.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(1000, t);
    highPass.frequency.exponentialRampToValueAtTime(100, t + 1.0);

    const noise = this.ctx.createBufferSource();
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
       data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.6, t + 0.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    noise.connect(highPass);
    highPass.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noise.start();
    noise.stop(t + 1.3);
  }

  public triggerBeepAlarm(altitude: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const now = Date.now();
    
    // Determine interval speed based on how critical altitude is
    // Only beep between 1000m and 3000m if parachute is closed
    if (altitude > 3500 || altitude < 1010) {
      return; 
    }

    let interval = 1200; // default slow beep
    if (altitude < 2000) interval = 600;
    if (altitude < 1500) interval = 300;

    if (now - this.lastBeepTime >= interval) {
      this.lastBeepTime = now;
      this.playBeepTone();
    }
  }

  private playBeepTone() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, t); // Pitch of alarm
    
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08); // short beep

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + 0.1);
  }

  public playLandingThud() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const t = this.ctx.currentTime;
    
    // Low frequency drum punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.5);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + 1.0);

    // Crowd applause synthesizer (simulating micro ambient swell)
    const noise = this.ctx.createBufferSource();
    const bufferSize = this.ctx.sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
       data[i] = (Math.random() * 2 - 1) * 0.1;
    }
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(800, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.15, t + 0.3);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start();
    noise.stop(t + 2.0);
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.4, t, 0.1);
    }
    return this.isMuted;
  }

  public shutdown() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const gameAudio = new SkydivingAudioSynthesizer();
