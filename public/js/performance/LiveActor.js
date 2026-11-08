// Performs the lines of one speaking puppet for one scene. Scene hands this actor
// a line; the actor presents a timed caption in rehearsal or cues its VoiceSession
// during a paid show. It applies optional line emotions and forwards the line's action as its bound puppet and tells
// Scene when delivery finishes. Both kinds of performance therefore use the same
// turn order, and Scene always knows who requested a gesture.

class LiveActor {
  constructor(puppet, scene) {
    this.puppet = puppet;
    this.scene = scene;
    this.active = true;
    this.turn = null;
  }

  // Brackets contain vocal direction, not dialogue. Rehearsal captions and timing
  // use the plain words. Paid delivery history still uses the observed transcript.
  static spokenWords(words) {
    return words.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Scene cues one line, with optional emotion and action, for voice or captions.
  speak(line) {
    // Ignore cues when stopped or already performing a line.
    if (!this.active || this.turn) return;

    // Keep the current emotion unless this line supplies one.
    if (line.emotion !== undefined) this.puppet.setEmotion(line.emotion);

    // Save the line; strip bracketed vocal directions from captions.
    this.turn = line;
    this.captionWords = LiveActor.spokenWords(line.words);

    // Reset retry and timing state. Live animation waits for audible playback.
    this.retried = false;
    this.captionsOnly = false; // A failed voice only falls back for its current line.
    this.lastSpokenMs = undefined;
    this.puppet.speaking = false;

    // Caption-only reading time: 1.1 seconds plus 0.39 seconds per word.
    this.captionTimeLeftMs = 1100 + this.captionWords.split(/\s+/).length * 390;
    // The authored caption remains readable while WebRTC starts or reconnects.
    this.scene.caption(this.puppet.name, this.captionWords);

    // Request the action once; voice retries skip this step.
    if (line.action) this.requestAction(line.action);

    // Animate captions immediately, or cue live voice through deliverLine().
    if (!this.context) this.puppet.speaking = true;
    else this.deliverLine();
  }

  // The Scene still owns the floor. A retry cues just the words, so gestures
  // and emotions run once even when the voice transport is replaced.
  deliverLine() {
    if (!this.active || !this.turn || this.reconnecting) return;
    if (!this.voice) { void this.openVoice(false); return; }
    try { this.voice.speak(this.turn); }
    catch { this.voiceFailed(this.voice, 'Could not cue voice.'); }
  }

  // Retire the failed peer before another can play. After audible speech, yield
  // the unfinished turn. Reconnect on the next cue to avoid repeating it.
  voiceFailed(session, reason) {
    if (!this.active || session !== this.voice) return;
    // A single noisy packet is too little evidence to discard an unheard line.
    const heardSound = (session.turn?.sampledSoundMs ?? 0) >= 100;
    const words = session.turn?.words ?? '';
    this.voice = null;
    session.stop();
    console.warn(this.puppet.name + ': ' + reason);
    if (!this.turn || this.reconnecting) return;
    if (heardSound) {
      this.turn = null;
      this.puppet.speaking = false;
      this.scene.interrupted(this, words);
    } else if (this.retried) {
      this.useCaptions();
    } else {
      void this.openVoice(true);
    }
  }

  // Open only for live dialogue. One replacement is allowed for an unheard
  // line. An interruption can change the turn while negotiation is in flight.
  async openVoice(retry) {
    const requestedLine = this.turn;
    this.retried = retry;
    this.reconnecting = true;
    const name = this.scene.definition.cast.find(member => member.name === this.puppet.name)?.profile?.spokenName ?? this.puppet.name;
    this.scene.hint((retry ? 'Reconnecting ' : 'Connecting ') + name + '…');
    let opened = false;
    let session;
    try {
      session = new VoiceSession(this, this.context);
      this.voice = session;
      await session.open(12000);
      opened = this.voice === session && session.connected;
    } catch (error) {
      console.warn(name + ': voice unavailable.', error.message);
      session?.stop();
      if (this.voice === session) this.voice = null;
    } finally {
      this.reconnecting = false;
      if (this.active && this.scene.speaker === this) this.scene.hint('');
    }
    if (!this.active || !this.turn || this.captionsOnly) return;
    if (opened || this.turn !== requestedLine) this.deliverLine();
    else if (!retry) void this.openVoice(true);
    else this.useCaptions();
  }

  // Exhausting the retry leaves this line readable for its normal caption time.
  // The ordinary caption timer releases the floor exactly once.
  useCaptions() {
    this.captionsOnly = true;
    if (!this.turn) return;
    console.info('Theatre voice delivery', { actor: this.puppet.name, outcome: 'caption only', soundDetected: false });
    this.scene.caption(this.puppet.name, 'Caption only · ' + this.captionWords);
    this.puppet.speaking = false;
  }

  // The actor's identity comes from this session, never from action arguments.
  requestAction(action) {
    if (this.active) this.scene.act(this.puppet, action);
  }

  // Signal completion only after the full caption has been presented.
  update(ms) {
    if (!this.active || this.reconnecting) return;
    if (this.voice) { this.voice.update(); return; }
    if (!this.turn) return;
    this.captionTimeLeftMs -= ms;
    if (this.captionTimeLeftMs > 0) return;
    this.complete(this.captionWords, this.captionsOnly ? 'caption displayed after voice failure; no audio' : 'caption completed');
  }

  // Only the current actor may release the next scripted turn.
  complete(words, delivery) {
    if (!this.active || !this.turn) return;
    const line = this.turn;
    this.turn = null;
    this.puppet.speaking = false;
    this.scene.finished(this, line, words, delivery).catch(() => this.scene.fail("Could not advance the live scene."));
  }

  // Yield without completing the line or closing this actor's connection.
  interrupt() {
    if (!this.active || !this.turn) return;
    const words = this.voice?.connected && !this.reconnecting ? this.voice.interrupt() : '';
    this.turn = null;
    this.puppet.speaking = false;
    this.scene.caption(this.puppet.name, '…');
    this.scene.interrupted(this, words);
  }

  // Closing this session prevents any later cue from this actor being applied.
  stop() {
    this.active = false;
    this.puppet.speaking = false;
    if (this.voice?.turn) this.scene.director.record(this.puppet.name, this.voice.turn.words, 'interrupted; partial delivery uncertain');
    this.voice?.stop();
    this.turn = null;
  }
}
