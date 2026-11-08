// Listens only while Show owns an active microphone. Browser echo cancellation
// reduces stage playback in the input; local voice activity brackets a short WAV.
// Scene interrupts the speaker and holds the next turn for the viewer. Transcription and
// target selection happen here; Director writes the response through Scene.
class AudienceInput {
  constructor(show) {
    this.show = show;
    this.status = document.querySelector('#microphone-status');
    this.resetCapture();
  }

  // Start from the user's Start click, using Show's existing AudioContext.
  async start(context) {
    this.stop();
    const life = this.life = new AbortController();
    this.status.textContent = 'Allow microphone access';
    if (!navigator.mediaDevices?.getUserMedia || !context.audioWorklet) {
      throw new Error('This browser cannot capture microphone audio. Use Chrome or Edge.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    });
    if (life.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    try {
      await context.audioWorklet.addModule('js/performance/microphone-capture.js');
      if (life.signal.aborted) return;
      this.sampleRate = context.sampleRate;
      this.source = context.createMediaStreamSource(stream);
      this.capture = new AudioWorkletNode(context, 'microphone-capture');
      this.capture.port.onmessage = event => this.samples(event.data);
      this.capture.onprocessorerror = () => {
        if (!life.signal.aborted) this.show.end('Microphone processing stopped. Please start again.');
      };
      // The processor emits silence, but must remain connected to be scheduled.
      this.source.connect(this.capture).connect(context.destination);
      stream.getTracks().forEach(track => track.onended = () => {
        if (!life.signal.aborted) this.show.end('Microphone disconnected.');
      });
      this.status.textContent = 'Microphone on';
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  // A vowel repeats over a short pitch period. Compare the waveform with a
  // delayed copy: bursts of keyboard noise can be loud and sustained without
  // repeating like a voice. This check is only needed to start an interruption.
  hasVoicing(samples) {
    const stride = 4;
    const firstLag = Math.ceil(this.sampleRate / 450 / stride) * stride;
    const lastLag = Math.floor(this.sampleRate / 75 / stride) * stride;
    for (let lag = firstLag; lag <= lastLag; lag += stride) {
      let product = 0;
      let energy = 0;
      for (let i = lag; i < samples.length; i += stride) {
        const a = samples[i], b = samples[i - lag];
        product += a * b;
        energy += a * a + b * b;
      }
      if (energy > 0 && 2 * product > 0.65 * energy) return true;
    }
    return false;
  }

  // Require sustained energy above the room floor, then wait for a natural pause.
  // Keep 550 ms of pre-roll so detection does not clip the first word. Constants
  // are internal timing choices, not another settings panel for the audience.
  samples(samples) {
    const scene = this.show.activeScene;
    if (this.life?.signal.aborted || !this.show.performing || !scene?.active ||
        scene.cutRequested || this.request || (scene.pendingAudience && !scene.pendingAudience.replyStarted && !this.recording)) {
      this.resetCapture();
      return;
    }
    const seconds = samples.length / this.sampleRate;
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const threshold = Math.max(0.012, this.noiseFloor * 3);
    const voiced = rms > threshold;
    if (!voiced && !this.recording) this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02;

    if (!this.recording) {
      this.preRoll.push(samples);
      while (this.preRoll.length * seconds > 0.55 + seconds) this.preRoll.shift();
      // A key click can lift the RMS of a whole 2048-sample buffer. Speech
      // usually fills several adjacent 8 ms intervals, even between key taps.
      const interval = Math.max(1, Math.round(this.sampleRate * 0.008));
      let activeIntervals = 0;
      const intervals = Math.floor(samples.length / interval);
      for (let part = 0; voiced && part < intervals; part++) {
        let energy = 0;
        const start = part * interval;
        for (let i = start; i < start + interval; i++) energy += samples[i] * samples[i];
        if (energy / interval > threshold * threshold) activeIntervals++;
      }
      const sustained = voiced && activeIntervals >= Math.ceil(intervals * 0.7);
      const speechLike = sustained && this.hasVoicing(samples);
      this.attack = speechLike ? this.attack + seconds : Math.max(0, this.attack - seconds);
      if (this.attack < 0.14) return;
      // Reserving the floor clears the actor's turn before transcription returns.
      this.interruptedWords = scene.speaker?.turn?.words;
      if (!scene.reserveAudience('arthur-investigator')) { this.resetCapture(); return; }
      this.scene = scene;
      scene.audienceInput = this;
      this.recording = true;
      this.chunks = [...this.preRoll];
      this.duration = this.chunks.length * seconds;
      this.silence = 0;
      this.status.textContent = 'Listening…';
      return;
    }
    this.chunks.push(samples);
    this.duration += seconds;
    this.silence = voiced ? 0 : this.silence + seconds;
    // Allow a pause after a name ("Claire ... where were you?") within one turn.
    if (this.silence >= 1.65 || this.duration >= Math.min(30, 1900000 / this.sampleRate)) this.submit();
  }

  // Compare only near-exact repeated dialogue, never arbitrary shared keywords.
  // This catches residual speaker echo after acoustic cancellation.
  isStageEcho(words, scene, interruptedWords) {
    const normalise = text => LiveActor.spokenWords(text).toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const text = normalise(words);
    if (text.split(' ').length < 4) return false;
    const recent = scene.director.heard.filter(line => !line.speaker.startsWith('Audience')).slice(-2).map(line => line.words);
    if (interruptedWords) recent.push(interruptedWords);
    if (scene.speaker?.turn) recent.push(scene.speaker.turn.words);
    return recent.some(line => normalise(line).includes(text));
  }

  // Cast aliases live in scene data, so recording knows nothing about costumes.
  // Prefer the first explicitly addressed character; otherwise use the Investigator.
  targetFor(words, scene) {
    const text = words.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');
    // In private, naming someone as evidence ("I think Claire lied") is
    // different from addressing them ("Claire, where were you?").
    if (scene.interrogation?.active) {
      const guest = scene.interrogation.accusation.target;
      const inspector = scene.questioning.investigator.name;
      const address = text.trim().replace(/^(?:hey|okay|ok) /, '');
      for (const member of scene.definition.cast.filter(member => [guest, inspector].includes(member.name))) {
        const aliases = [member.name, member.profile?.spokenName, ...(member.profile?.aliases ?? [])].filter(Boolean);
        if (aliases.some(alias => {
          const name = alias.toLowerCase();
          return address === name || address.startsWith(name + ' ') ||
            (/\b(?:you|your)\b/.test(address) && address.endsWith(' ' + name));
        })) return member.name;
      }
      return /\b(?:you|your)\b/.test(address) ? guest : inspector;
    }
    // In "Arthur, question Evelyn" the person being called takes priority.
    const called = text.match(/\b(?:question|interrogate|call forward|speak to|talk to|bring forward)\s+(.+)/);
    const address = called?.[1] ?? text;
    const matches = [];
    for (const member of scene.definition.cast) {
      for (const alias of [member.name, member.profile?.spokenName, ...(member.profile?.aliases ?? member.aliases ?? [])].filter(Boolean)) {
        const name = alias.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');
        if (called && (address.trim() + ' ').startsWith(name + ' ')) return member.name;
        const index = (' ' + text + ' ').indexOf(' ' + name + ' ');
        if (index >= 0) matches.push({ name: member.name, index });
      }
    }
    return matches.sort((a, b) => a.index - b.index)[0]?.name ?? scene.story?.interview?.target ?? 'arthur-investigator';
  }

  // Encode the retained samples as standard mono PCM WAV, kept only in memory.
  recordingBlob() {
    const count = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new ArrayBuffer(44 + count * 2);
    const view = new DataView(buffer);
    const label = (offset, text) => [...text].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)));
    label(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); label(8, 'WAVE');
    label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, count * 2, true);
    let offset = 44;
    for (const chunk of this.chunks) for (const sample of chunk) {
      view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 32767, true);
      offset += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async submit() {
    const scene = this.scene;
    const interruptedWords = this.interruptedWords;
    const blob = this.recordingBlob();
    this.resetCapture();
    const request = this.request = new AbortController();
    this.status.textContent = 'Hearing your question…';
    try {
      const words = await TheatreAPI.transcribe(blob, request.signal);
      if (request.signal.aborted || !scene.active) return;
      if (!words.trim() || this.isStageEcho(words, scene, interruptedWords)) { scene.cancelAudience(); return; }
      const target = this.targetFor(words, scene);
      this.status.textContent = 'Microphone on';
      // Only transcription owns this request. Release capture while the short
      // reply plays so a second interruption can supersede its pending rewrite.
      this.request = null;
      void scene.receiveAudience(words, target).catch(() => {
        if (scene.active) scene.fail('Could not handle the audience question.');
      });
    } catch (error) {
      if (!request.signal.aborted && scene.active) {
        scene.cancelAudience();
        scene.hint('I could not hear that clearly. Please try again.');
      }
    } finally {
      if (this.request === request) {
        this.request = null;
        if (!this.life?.signal.aborted) this.status.textContent = 'Microphone on';
      }
    }
  }

  resetCapture() {
    this.interruptedWords = undefined;
    this.preRoll = [];
    this.chunks = [];
    this.recording = false;
    this.attack = 0;
    this.duration = 0;
    this.silence = 0;
    this.noiseFloor = 0.003;
  }

  // Scene exit cancels only its pending question. Show owns the microphone lifetime.
  cancel() {
    this.request?.abort();
    this.request = null;
    this.scene?.cancelAudience();
    this.resetCapture();
  }

  // End, page exit and startup failure all release the microphone and audio graph.
  stop() {
    this.life?.abort();
    this.cancel();
    if (this.capture) {
      this.capture.port.onmessage = null;
      this.capture.onprocessorerror = null;
    }
    this.source?.disconnect();
    this.capture?.disconnect();
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.stream = this.source = this.capture = null;
    this.status.textContent = '';
  }
}
