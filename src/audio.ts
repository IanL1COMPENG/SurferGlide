/** Original, procedural sound design. No downloaded audio or API credentials. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private volume = 0.65;
  private music = true;
  private playing = false;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * 0.55;
      this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = this.music ? 0.18 : 0;
      this.musicGain.connect(this.master);
      const buffer = this.context.createBuffer(
        1,
        this.context.sampleRate * 4,
        this.context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.035) / 1.015;
        data[i] = last;
      }
      const noise = this.context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 850;
      this.ambience = this.context.createGain();
      this.ambience.gain.value = 0.32;
      noise.connect(filter);
      filter.connect(this.ambience);
      this.ambience.connect(this.master);
      noise.start();
      this.timer = setInterval(() => this.beat(), 240);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  configure(volume: number, music: boolean) {
    this.volume = volume;
    this.music = music;
    if (this.context) {
      this.master?.gain.setTargetAtTime(volume * 0.55, this.context.currentTime, 0.1);
      this.musicGain?.gain.setTargetAtTime(music ? 0.18 : 0, this.context.currentTime, 0.2);
    }
  }
  setPlaying(playing: boolean) {
    this.playing = playing;
  }
  motion(speed: number, air: boolean) {
    if (this.context && this.ambience)
      this.ambience.gain.setTargetAtTime(
        (this.playing ? 0.55 : 0.22) + Math.abs(speed) * 0.025 - (air ? 0.15 : 0),
        this.context.currentTime,
        0.2,
      );
  }
  private tone(
    freq: number,
    duration: number,
    gain = 0.15,
    type: OscillatorType = 'sine',
    delay = 0,
    target?: number,
    output?: AudioNode,
  ) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const time = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, time);
    if (target) oscillator.frequency.exponentialRampToValueAtTime(target, time + duration);
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(output || this.master);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
  private beat() {
    if (!this.context || this.context.state !== 'running' || !this.musicGain || !this.music) return;
    const melody = [0, 7, 12, 16, 14, 7, 4, 7, 0, 7, 12, 19, 16, 12, 7, 4];
    const transposition = [0, -5, -3, -7][Math.floor(this.step / 16) % 4];
    const note = 261.63 * 2 ** ((melody[this.step % 16] + transposition) / 12);
    this.tone(note, 0.5, 0.13, 'sine', 0, undefined, this.musicGain);
    if (this.step % 4 === 0)
      this.tone(65.4 * 2 ** (transposition / 12), 0.65, 0.3, 'sine', 0, undefined, this.musicGain);
    if (this.playing && this.step % 2 === 0)
      this.tone(120, 0.1, 0.24, 'sine', 0, 40, this.musicGain);
    this.step++;
  }
  play(kind: 'click' | 'launch' | 'land' | 'wipeout' | 'pickup' | 'finish' | 'buy' | 'count') {
    if (kind === 'click') this.tone(660, 0.08, 0.08);
    if (kind === 'launch') {
      this.tone(140, 0.26, 0.13, 'sine', 0, 700);
      this.tone(220, 0.3, 0.06, 'triangle', 0.06, 880);
    }
    if (kind === 'land' || kind === 'pickup')
      [523, 659, 784].forEach((n, i) => this.tone(n, 0.26, 0.14, 'sine', i * 0.07));
    if (kind === 'wipeout') {
      this.tone(180, 0.5, 0.15, 'triangle', 0, 45);
      this.tone(90, 0.35, 0.12, 'sine');
    }
    if (kind === 'finish' || kind === 'buy')
      [392, 523, 659, 784, 1047].forEach((n, i) => this.tone(n, 0.5, 0.14, 'sine', i * 0.1));
    if (kind === 'count') this.tone(540, 0.14, 0.18);
  }
  suspend() {
    void this.context?.suspend();
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    void this.context?.close();
  }
}
