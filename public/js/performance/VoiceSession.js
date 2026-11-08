// Connects one live actor to GPT-Live and plays its voice through Web Audio.
// It negotiates a WebRTC connection through TheatreAPI, sends spoken-line cues
// and opens the actor's audio output for its turn. It watches the audio level
// for speech followed by quiet to estimate when the line has finished. That
// separate playback check matters because transcript text can arrive before
// the audience has finished hearing the words.

// AudioContext; a scene only opens the gate of the actor holding the floor.
class VoiceSession {
  // LiveActor reuses the line object when a replacement connection retries it.
  // A weak key lets the trace follow that line without keeping old scripts alive.
  static lineTraces = new WeakMap();
  static nextLineId = 0;

  traceTiming(event) {
    const { trace, start } = this.turn;
    const now = performance.now();
    console.info('Theatre voice timing', {
      actor: this.actor.scene?.definition.cast.find(member => member.name === this.actor.puppet.name)?.profile?.spokenName ?? this.actor.puppet.name,
      lineId: trace.id, attempt: trace.attempt, event,
      msSinceFirstCue: Math.round(now - trace.start),
      msSinceAttempt: Math.round(now - start)
    });
  }

  // The transcript can run ahead of playback, especially when a line is cut.
  // Keep one comparison per attempt in the local Console, including silent retries.
  compareDelivery(outcome) {
    const turn = this.turn;
    if (turn?.expectedDialogue === undefined) return;
    const tokens = words => words.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const expected = tokens(turn.expectedDialogue);
    const returned = tokens(turn.words);
    let index = 0;
    while (index < expected.length && expected[index] === returned[index]) index++;
    console.info('Theatre voice delivery', {
      actor: this.actor.puppet.name, lineId: turn.trace.id, attempt: turn.trace.attempt,
      outcome, cueAcknowledged: turn.acknowledged, soundDetected: turn.firstSound !== undefined,
      msToFirstSound: turn.firstSound === undefined ? null : Math.round(turn.firstSound - turn.start)
    });
    console.info('Theatre dialogue comparison', {
      actor: this.actor.scene.definition.cast.find(member => member.name === this.actor.puppet.name)?.profile?.spokenName ?? this.actor.puppet.name,
      lineId: turn.trace.id, attempt: turn.trace.attempt, outcome,
      soundDetected: turn.firstSound !== undefined,
      cue: turn.expectedDialogue, transcript: turn.words,
      firstDifferentWord: index < Math.max(expected.length, returned.length) ? index + 1 : null
    });
  }

  constructor(actor, context) {
    this.actor = actor;
    this.context = context;
    this.peer = new RTCPeerConnection();
    this.channel = this.peer.createDataChannel('oai-events');
    this.life = new AbortController();
    this.sequence = 0;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.ready.catch(() => {}); // Stop can arrive while SDP is still in flight.
  }

  // Negotiate an active audio input carrying silence. Only the web page's
  // explicit audience cue is sent to the performers; no room mic is opened.
  async open(timeoutMs = 35000) {
    const peer = this.peer;
    const signal = this.life.signal;
    this.input = this.context.createMediaStreamDestination();
    this.silence = this.context.createConstantSource();
    this.silence.offset.value = 0;
    this.silence.connect(this.input);
    this.silence.start();
    peer.addTrack(this.input.stream.getAudioTracks()[0], this.input.stream);
    peer.ontrack = event => {
      if (signal.aborted) return;
      const stream = new MediaStream([event.track]);
      // Attach the received stream for Chromium's audio engine. Web Audio owns
      // audible playback, so the element is muted to prevent double playback.
      this.element = new Audio();
      this.element.muted = true;
      this.element.srcObject = stream;
      this.element.play().catch(() => this.fail('The browser blocked live audio.'));
      this.source = this.context.createMediaStreamSource(stream);
      this.meter = this.context.createAnalyser();
      this.samples = new Float32Array(this.meter.fftSize);
      this.gate = this.context.createGain();
      this.gate.gain.value = 0;
      this.source.connect(this.meter).connect(this.gate).connect(this.context.destination);
      this.checkReady();
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') this.fail('Voice connection lost.');
    };
    this.channel.onclose = () => this.fail('Voice channel closed.');
    this.channel.onmessage = ({ data }) => {
      if (signal.aborted) return;
      try {
        const event = JSON.parse(data);
        if (event.type === 'session.started') {
          this.started = true;
          this.checkReady();
        }
        // An acknowledgement confirms cue injection, not audible delivery.
        if (event.type === 'session.instructions.appended' && this.turn && !this.turn.acknowledged &&
            event.client_event_id === this.turn.eventId) {
          this.turn.acknowledged = true;
          this.traceTiming('cue acknowledged');
        }
        if (event.type === 'session.instructions.appended' && this.draining &&
            event.client_event_id === this.draining.eventId) this.draining.acknowledged = true;
        if (event.type === 'session.output_transcript.delta' && this.turn) {
          this.turn.words += event.delta;
          // Keep the received transcript for delivery checks. The stage already
          // shows the complete scripted line, even if the audio track is silent.
        }
        if (event.type === 'error') {
          const code = event.error?.code ?? event.code ?? 'unknown';
          this.fail('Voice service error (' + code + ').');
        }
        if (event.type === 'session.closed') this.fail('The provider closed the voice session.');
      } catch { this.fail('Invalid voice session event.'); }
    };

    const timeout = setTimeout(() => this.fail('Voice startup timed out.'), timeoutMs);
    try {
      await peer.setLocalDescription(await peer.createOffer());
      signal.throwIfAborted();
      if (peer.iceGatheringState !== 'complete') {
        await new Promise((resolve, reject) => {
          peer.onicegatheringstatechange = () => { if (peer.iceGatheringState === 'complete') resolve(); };
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      }
      signal.throwIfAborted();
      const { sdp } = await TheatreAPI.startSession(this.actor.puppet.name, peer.localDescription.sdp, signal);
      signal.throwIfAborted();
      await peer.setRemoteDescription({ type: 'answer', sdp });
      await this.ready;
    } finally { clearTimeout(timeout); }
  }

  // Both a negotiated audio track and the provider's session event are required.
  checkReady() {
    if (this.started && this.gate) {
      this.connected = true;
      this.resolveReady();
    }
  }

  // Send one application cue with an ID unique to this session.
  send(type, content) {
    const eventId = 'cue_' + ++this.sequence;
    this.channel.send(JSON.stringify({ type, content, event_id: eventId, delegation_id: null }));
    return eventId;
  }

  // A line instruction explicitly asks the actor to speak now. Gate the audible track here.
  speak(line) {
    if (this.life.signal.aborted) return;
    if (this.draining) { this.queuedLine = line; return; }
    if (this.context.state !== 'running') throw new Error('Live audio is not running.');
    const spokenLine = LiveActor.spokenWords(line.words);
    const dialogue = spokenLine.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    this.turn = { openingWords: dialogue.slice(0, 3).join(' '), closingWords: dialogue.slice(-3).join(' '),
      minimumSoundMs: Math.min(1200, Math.max(0, (dialogue.length - 1) * 45)),
      sampledSoundMs: 0, words: '', start: performance.now(), audioStart: this.context.currentTime,
      peakLevel: 0, lastSound: 0, acknowledged: false };
    const turn = this.turn;
    let trace = this.actor.retried && VoiceSession.lineTraces.get(line);
    if (!trace) {
      trace = { id: ++VoiceSession.nextLineId, start: turn.start, attempt: 0 };
      VoiceSession.lineTraces.set(line, trace);
    }
    turn.expectedDialogue = spokenLine;
    turn.trace = trace;
    trace.attempt++;
    this.audioStats().then(stats => { if (this.turn === turn) turn.initialAudioStats = stats; });
    this.gate.gain.cancelScheduledValues(this.context.currentTime);
    this.gate.gain.setValueAtTime(1, this.context.currentTime);
    // Give the actor one cue. Number the words so a mid-line direction can
    // target its passage without repeating dialogue fragments as separate cues.
    const parts = line.words.split(/\[([^\]]*)\]/g);
    const countWords = passage => passage.trim().split(/\s+/).filter(Boolean).length;
    const directions = [];
    let position = countWords(parts[0]) + 1;
    for (let index = 1; index < parts.length; index += 2) {
      const length = countWords(parts[index + 1]);
      const direction = parts[index].trim();
      if (direction && length) directions.push({ firstWord: position, lastWord: position + length - 1, direction });
      position += length;
    }
    this.turn.eventId = this.send('session.instructions.append',
      'Speak the entire dialogue field now, from its first word to its last, exactly once. ' +
      'Use delivery only to shape your voice. Read aloud only dialogue. Then wait silently.\n' +
      JSON.stringify({ delivery: directions, dialogue: spokenLine }));
    this.traceTiming('cue sent');
  }

  // Fade locally now; ask the provider to abandon the remainder. Keep receiving
  // its muted track until the stop cue is acknowledged AND audio has gone quiet.
  // An acknowledgement alone does not prove that buffered audio has drained.
  interrupt() {
    this.compareDelivery('interrupted');
    const words = this.turn?.words ?? '';
    this.turn = null;
    this.queuedLine = null;
    if (!this.connected) return words;
    const gain = this.gate.gain;
    const now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 0.04);
    if (!this.draining) {
      this.draining = { start: performance.now(), lastSound: performance.now(), acknowledged: false };
      try {
        this.draining.eventId = this.send('session.instructions.append',
          'The audience interrupted. Stop speaking now. Discard the unfinished line; do not resume it. ' +
          'Wait silently until explicitly instructed to speak a new line.');
      } catch { this.fail('Could not stop the interrupted voice.'); }
    }
    return words;
  }

  // The provider's transcript is generated text. Estimate playback completion
  // separately by observing actual signal followed by 1.1 seconds of quiet.
  update() {
    if (this.diagnosing || (!this.turn && !this.draining)) return;
    this.meter.getFloatTimeDomainData(this.samples);
    let energy = 0;
    for (const sample of this.samples) energy += sample * sample;
    const now = performance.now();
    const level = Math.sqrt(energy / this.samples.length);
    const audible = level > 0.005;
    if (this.turn) this.turn.peakLevel = Math.max(this.turn.peakLevel, level);
    if (this.draining) {
      if (audible) this.draining.lastSound = now;
      if (this.draining.acknowledged && now - this.draining.lastSound >= 1100) {
        this.draining = null;
        const line = this.queuedLine;
        this.queuedLine = null;
        if (line && this.actor.active && this.actor.turn === line) this.actor.deliverLine();
      } else if (now - this.draining.start > 8000) {
        this.fail('The interrupted voice did not become quiet.');
      }
      return;
    }
    if (audible) {
      if (this.turn.firstSound === undefined) {
        this.turn.firstSound = now;
        this.traceTiming('first sound');
      }
      // Credit nearby audible samples only. A long quiet gap between two noises
      // contributes no speaking time. Short replies need less evidence than a speech.
      const gap = now - this.turn.lastSound;
      if (this.turn.lastSound && gap <= 300) this.turn.sampledSoundMs += gap;
      this.turn.lastSound = now;
      this.actor.puppet.speaking = true;
    }
    const quiet = this.turn.lastSound && now - this.turn.lastSound >= 1100;
    // The transcript can lead playback. Require both the opening words and
    // evidence of speech on the audio track before silence can release the floor.
    if (quiet) {
      const transcript = (this.turn.words.toLowerCase().match(/[a-z0-9]+/g) ?? []).join(' ');
      const beganLine = this.turn.openingWords && (' ' + transcript + ' ').includes(' ' + this.turn.openingWords + ' ');
      const endedLine = (' ' + transcript).endsWith(' ' + this.turn.closingWords);
      if (beganLine && endedLine && this.turn.sampledSoundMs >= this.turn.minimumSoundMs) {
        this.compareDelivery('finished');
        const words = this.turn.words;
        this.actor.lastSpokenMs = this.turn.lastSound - this.turn.firstSound;
        this.turn = null;
        this.gate.gain.value = 0;
        this.actor.complete(words, 'playback end estimated from audio');
        return;
      }
      // A paraphrase or incomplete line must still yield. Preserve the uncertainty
      // in the scene history and use the existing actor recovery on the next cue.
      if (now - this.turn.lastSound >= 8000) {
        this.fail('Audio stopped before the scripted line could be confirmed.');
        return;
      }
    }
    // An accepted first cue with no sound gets one chance on a fresh connection.
    // Give the replacement its usual grace period. Once audio starts, a long
    // scripted line keeps its full playback window.
    let deadlineMs = 60000;
    if (!this.turn.lastSound) {
      deadlineMs = this.turn.words ? 5000 : 8000;
      if (this.turn.acknowledged && this.turn.trace.attempt === 1) deadlineMs = 4000;
    }
    if (now - this.turn.start > deadlineMs) {
      let message = 'The line did not finish.';
      if (!this.turn.lastSound) {
        if (this.context.state !== 'running') message = 'Browser audio stopped running.';
        else if (this.turn.words) message = 'Speech text arrived, but no playback audio was detected.';
        else if (this.turn.acknowledged) message = 'The voice service accepted the cue but produced no speech.';
        else message = 'The voice service did not acknowledge the speech cue.';
      }
      if (this.turn.lastSound) this.fail(message);
      else void this.reportSilentTurn(message, this.turn);
    }
  }

  // Read transport counters only: no audio, transcripts, addresses or credentials.
  async audioStats() {
    try {
      const reports = await Promise.race([this.peer.getStats(),
        new Promise(resolve => setTimeout(() => resolve(null), 700))]);
      const totals = { hasInbound: false, packets: 0, bytes: 0, samples: 0, energy: null, duration: null };
      if (!reports) return null;
      reports.forEach(report => {
        if (report.type === 'inbound-rtp' && (report.kind ?? report.mediaType) === 'audio') {
          totals.hasInbound = true;
          totals.packets += report.packetsReceived ?? 0;
          totals.bytes += report.bytesReceived ?? 0;
          totals.samples += report.totalSamplesReceived ?? 0;
          if (typeof report.totalAudioEnergy === 'number') totals.energy = (totals.energy ?? 0) + report.totalAudioEnergy;
          if (typeof report.totalSamplesDuration === 'number') totals.duration = (totals.duration ?? 0) + report.totalSamplesDuration;
        }
      });
      return totals;
    } catch { return null; }
  }

  // Capture evidence before the actor replaces the peer. The snapshot lives only in
  // memory and the browser console; it survives this scene's cleanup.
  async reportSilentTurn(message, turn) {
    // Freeze this silent attempt before reading transport stats. Late packets
    // cannot become audible while we decide whether to replay the line.
    const gainBeforeDiagnosis = this.gate.gain.value;
    this.gate.gain.value = 0;
    this.diagnosing = true;
    const latest = await this.audioStats();
    if (this.life.signal.aborted || this.turn !== turn) { this.diagnosing = false; return; }
    const initial = turn.initialAudioStats;
    // Chrome may create its first inbound report after the cue. In that case
    // its cumulative counters start at zero. Missing metric support stays unknown.
    const change = key => {
      if (!initial || !latest?.hasInbound || latest[key] == null) return null;
      if (!initial.hasInbound) return latest[key];
      return initial[key] == null ? null : latest[key] - initial[key];
    };
    const snapshot = {
      actor: this.actor.puppet.name,
      lineId: turn.trace.id, attempt: turn.trace.attempt,
      audioState: this.context.state,
      audioClockSeconds: this.context.currentTime - turn.audioStart,
      peakLevel: turn.peakLevel,
      gate: gainBeforeDiagnosis,
      connection: this.peer.connectionState,
      trackState: this.peer.getReceivers().find(receiver => receiver.track?.kind === 'audio')?.track.readyState,
      packetsDuringTurn: initial && latest ? latest.packets - initial.packets : null,
      samplesDuringTurn: change('samples'),
      receivedEnergyDuringTurn: change('energy'),
      receivedDurationDuringTurn: change('duration'),
      cueAcknowledged: turn.acknowledged,
      transcriptReceived: Boolean(turn.words)
    };
    window.lastTheatreAudioFailure = snapshot;
    console.warn('Theatre audio failure', snapshot);
    if (snapshot.audioClockSeconds < 0.1) message += ' Browser audio clock did not advance.';
    else if (snapshot.packetsDuringTurn === 0) message += ' No incoming audio packets during the turn.';
    else if (snapshot.receivedDurationDuringTurn > 0 && snapshot.receivedEnergyDuringTurn === 0) {
      message += ' The WebRTC receiver decoded silence.';
    } else if (snapshot.receivedEnergyDuringTurn > 0 && snapshot.peakLevel === 0) {
      message += ' The WebRTC receiver measured energy but the playback meter measured none.';
    } else if (snapshot.packetsDuringTurn > 0) message += ' Audio packets arrived; peak level ' + snapshot.peakLevel.toExponential(2) + '.';
    this.fail(message);
  }

  // During setup, closing rejects open(). During a turn, only this actor recovers.
  fail(message) {
    if (this.life.signal.aborted) return;
    if (this.turn?.trace) this.traceTiming('attempt failed: ' + message);
    if (this.connected) this.actor.voiceFailed(this, message);
    else this.stop(message);
  }

  // Close the peer and every media resource, including partial startup.
  stop(message = 'Voice session stopped.') {
    if (this.life.signal.aborted) return;
    this.compareDelivery('session stopped');
    this.connected = false;
    this.life.abort();
    this.turn = this.draining = this.queuedLine = null;
    this.rejectReady(new Error(message));
    this.channel.onclose = null;
    this.channel.onmessage = null;
    this.channel.close();
    this.peer.ontrack = null;
    this.peer.onconnectionstatechange = null;
    this.peer.getReceivers().forEach(receiver => receiver.track?.stop());
    this.peer.close();
    this.input?.stream.getTracks().forEach(track => track.stop());
    this.silence?.stop();
    this.source?.disconnect();
    this.gate?.disconnect();
    this.element?.pause();
    if (this.element) this.element.srcObject = null;
  }
}
