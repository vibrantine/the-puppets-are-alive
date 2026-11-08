// Scene gives one LiveActor the floor and waits for its delivery callback.
// A cast name identifies two objects: the Puppet moves on stage, and its
// LiveActor performs the line. SuspectQuestioning brings the pair together.
// StoryProgress keeps the ensemble's place while a suspect is interviewed.

class Scene {
  constructor(definition, puppets, onFailure) {
    this.definition = definition;
    this.backdrop = new StageBackdrop(definition);
    this.onFailure = onFailure;
    this.cast = new Map();
    this.actors = new Map();
    this.director = new Director(definition.script);
    this.active = true;
    this.offer = null;
    this.gesture = null;
    this.speaker = null;
    this.reservedAudienceTarget = null;
    this.confirmation = null;
    this.pendingAudience = null;
    this.cutRequested = false;

    for (const characterInScene of definition.cast) {
      const puppet = puppets.get(characterInScene.name);
      puppet.place(characterInScene.x, characterInScene.y, characterInScene.z);
      this.cast.set(characterInScene.name, puppet);
      this.actors.set(characterInScene.name, new LiveActor(puppet, this));
    }
    // Resolve gaze after placing everyone. A puppet can watch someone listed later in the cast.
    for (const characterInScene of definition.cast) {
      this.cast.get(characterInScene.name).lookAt(this.cast.get(characterInScene.looksAt) ?? null);
    }
    this.questioning = definition.questioning ? new SuspectQuestioning(this) : null;
    this.story = this.questioning ? new StoryProgress(this) : null;
    this.interrogation = this.story ? new PrivateInterrogation(this) : null;
    this.scriptedSuspect = null;
  }

  prepareLive(context) {
    this.director.live = true;
    for (const actor of this.actors.values()) actor.context = context;
  }

  // Report errors to the show so all sessions close together.
  fail(message) { if (this.active) this.onFailure(message); }

  // Show calls this when the curtain opens. Delivery and staging callbacks call
  // it again. Checking the current speaker first keeps those calls from overlapping lines.
  nextTurn() {
    if (!this.active || this.speaker || this.cutRequested || this.stageChange) return;
    if (this.reservedAudienceTarget) return;
    if (this.questioning && this.questioning.phase !== 'ready') return;
    if (this.interrogation?.advance()) return;
    if (this.pendingAudience) {
      if (this.pendingAudience.words && !this.audienceReview) {
        if (!this.pendingAudience.reply) {
          this.interpretAudience();
          return;
        }
        const target = this.pendingAudience.target;
        if (this.questioning && target !== this.questioning.investigator.name &&
            !this.questioning.arrange(target)) return;
        this.answerAudience();
      }
      return;
    }
    // Start the answer window only after Arthur releases his speaking turn.
    if (this.confirmation) {
      this.confirmation.deadline ??= performance.now() + 6500;
      this.hint('Arthur is listening…');
      return;
    }
    // Peek while moving. Only consume a cue once the cast is in place, so a
    // microphone reservation can hold or replace the unperformed script.
    const cue = this.director.nextCue;
    if (!cue) { this.fail('Scene script ended without an endScene cue.'); return; }
    // A private exchange has its own ending. Reaching it brings the ensemble back.
    if (cue.type === 'endInterview') {
      if (!this.story?.interview) { this.fail('No interview to end.'); return; }
      this.story.resume();
      return;
    }
    if (this.questioning) {
      if (cue.type === 'callSuspect') {
        if (!this.questioning.arrange(cue.suspect, cue.greeting)) return;
        this.scriptedSuspect = cue.suspect;
        this.director.consumeCue();
        this.nextTurn();
        return;
      }
      const partner = cue.type === 'endScene' ? null :
        cue.speaker === this.questioning.investigator.name ? this.scriptedSuspect : cue.speaker;
      if (!this.questioning.arrange(partner)) return;
      this.scriptedSuspect = partner;
    }
    this.director.consumeCue();
    // A script ends this scene; Show alone chooses and stages the subsequent scene.
    if (cue.type === 'endScene') {
      this.cutRequested = true;
      return;
    }
    const actor = this.actors.get(cue.speaker);
    if (cue.type !== 'dialogue' || !actor) {
      this.fail('Invalid dialogue cue or speaker.'); return;
    }
    this.speaker = actor;
    actor.speak(cue);
    if (this.active) this.story?.bufferNextSegment();
    this.hint('');
  }

  // The microphone detects sound before it knows the words. Reserve the next
  // turn now so another actor cannot start while transcription is in flight.
  reserveAudience(target) {
    if (!this.active || this.stageChange || this.interrogation?.writing || this.cutRequested || !this.cast.has(target)) return false;
    if (this.pendingAudience && !this.pendingAudience.replyStarted) return false;
    if (this.reservedAudienceTarget) return false;
    this.reservedAudienceTarget = target;
    // Interrupt calls nextTurn synchronously. Reserve first so the next actor
    // stays quiet while the viewer finishes speaking and the words are checked.
    this.speaker?.interrupt();
    return true;
  }

  // A spoken return command takes the interview through its normal ending,
  // so the suspect walks home and the ensemble recovers its place in the script.
  async receiveAudience(words, target = this.reservedAudienceTarget) {
    if (!this.active || !this.reservedAudienceTarget || !this.cast.has(target)) return;
    // Transcription accepted this question. Earlier writing may now be about
    // a different conversation, so only this confirmed question can replace it.
    this.reservedAudienceTarget = null;
    const confirmation = this.confirmation;
    this.confirmation = null;
    this.story?.cancelWriting();
    this.audienceReview?.abort();
    this.audienceReview = null;
    if (this.interrogation?.receive(words, target)) {
      this.pendingAudience = null;
      this.nextTurn();
      return;
    }
    if (this.story?.interview && /\b(?:back to (?:the )?(?:group|ensemble)|end (?:the )?(?:interview|interrogation)|return to (?:the )?(?:group|ensemble))\b/i.test(words)) {
      this.director.replaceRemaining([{ type: 'endInterview' }]);
      this.pendingAudience = null;
    } else {
      this.pendingAudience = { target, words: words.slice(0, 4000), confirmation };
    }
    this.nextTurn();
  }

  // Ask for the dramatic decision before moving a puppet. Only ordinary replies
  // need the addressed performer to walk forward. Clarification belongs to Arthur.
  async interpretAudience() {
    const audience = this.pendingAudience;
    audience.suspectAtFront = this.questioning?.suspect?.name ?? null;
    const request = this.audienceReview = new AbortController();
    this.hint('The Director is considering your question…');
    try {
      const result = await this.director.respondToAudience(this.definition, this.mystery, audience, request.signal);
      if (!this.active || request.signal.aborted || this.pendingAudience !== audience) return;
      this.hint('');
      if (result.decision === 'reply') {
        audience.reply = result.reply;
      } else {
        this.pendingAudience = null;
        const original = audience.confirmation?.original ?? audience.words;
        if (result.decision === 'accuse') {
          const words = audience.confirmation ? original + '\nViewer clarification: ' + audience.words : audience.words;
          this.interrogation.accusation = { target: result.suspect, words };
        } else {
          this.director.record('Audience', audience.words, 'transcribed audience remark', this.story?.interview?.target);
          if (result.decision === 'clarify') {
            const suspect = this.definition.cast.find(member => member.name === result.suspect);
            const name = suspect?.profile?.spokenName ?? suspect?.name;
            const words = name ? 'Shall we question ' + name + ' privately?' : 'Which of them do you suspect?';
            this.confirmation = { suspect: result.suspect, original, question: words };
            this.speaker = this.actors.get(this.questioning.investigator.name);
            this.speaker.puppet.lookAt(null);
            this.speaker.speak({ type: 'dialogue', speaker: this.speaker.puppet.name, emotion: 'neutral', words });
          }
        }
      }
    } catch {
      if (!this.active || request.signal.aborted) return;
      this.pendingAudience = null;
      this.hint('Could not interpret that remark. Continuing the scene.');
    } finally {
      if (this.audienceReview === request) this.audienceReview = null;
    }
    if (this.active && !request.signal.aborted) this.nextTurn();
  }

  // Wait for the current line, then release one short addressed reply immediately.
  // Keep the audience reservation while the Director writes what follows. If the
  // reply ends first, nextTurn waits; if writing ends first, the speaker keeps
  // the floor. The same cancellation token owns both stages.
  async answerAudience() {
    if (!this.active || this.speaker || this.audienceReview || !this.pendingAudience?.words) return;
    const audience = this.pendingAudience;
    const reply = audience.reply;
    const request = this.audienceReview = new AbortController();
    try {
      const suspect = this.questioning && audience.target !== this.questioning.investigator.name
        ? audience.target : this.story?.interview?.target;
      if (suspect) this.story.enter(suspect);
      this.director.record('Audience → ' + audience.target, audience.words, 'transcribed audience input; claim, not established fact', suspect);
      const actor = this.actors.get(reply.speaker);
      this.speaker = actor;
      this.hint('');
      audience.replyStarted = true;
      actor.speak(reply);
      if (!this.active || request.signal.aborted) return;
      const cues = suspect
        ? await this.director.writeInterrogation(this, { target: suspect, audience, committedReply: reply }, request.signal)
        : await this.director.respondToAudience(this.definition, this.mystery, audience, request.signal, reply);
      if (!this.active || request.signal.aborted || this.pendingAudience !== audience) return;
      this.scriptedSuspect = this.questioning?.suspect?.name ?? null;
      this.director.replaceRemaining(cues);
      this.pendingAudience = null;
      this.hint('');
    } catch (error) {
      if (!this.active || request.signal.aborted) return;
      this.pendingAudience = null;
      this.hint('Could not write a response. Continuing the existing script.');
    } finally {
      if (this.audienceReview === request) this.audienceReview = null;
    }
    if (this.active && !request.signal.aborted) this.nextTurn();
  }

  // An empty transcript or echo releases only the microphone's hold. A reply
  // already being written can finish and use the same normal turn handoff.
  cancelAudience() {
    if (!this.reservedAudienceTarget) return;
    this.reservedAudienceTarget = null;
    if (this.active && !this.speaker) this.nextTurn();
  }

  // The actor reports how the line was delivered (audio or caption). Only the
  // actor holding the floor can release it and run the line's after-actions.
  async finished(actor, line, words, delivery) {
    if (!this.active || actor !== this.speaker) return;
    this.director.record(actor.puppet.name, words, delivery, this.story?.interview?.target, actor.lastSpokenMs);
    this.speaker = null;
    for (const cue of line.after ?? []) {
      this.actors.get(cue.by).requestAction(cue);
    }
    this.nextTurn();
  }

  // A cut-off turn is not completion: skip its after-actions and never replay
  // its remainder. The transcript is only a generated upper bound on delivery.
  interrupted(actor, words) {
    if (!this.active || this.speaker !== actor) return;
    this.director.record(actor.puppet.name, words,
      'interrupted; transcript may include unheard words; exact partial delivery unknown', this.story?.interview?.target);
    this.speaker = null;
    this.closeOffer();
    this.nextTurn();
  }

  // Find the named partner in the cast. When a handshake is accepted, the Scene
  // assigns both marks and coordinates contact and release. Each puppet moves
  // itself to its mark in Puppet.update(ms).
  act(requestingPuppet, action) {
    const targetPuppet = this.cast.get(action.target);
    if (action.kind === 'look') { requestingPuppet.lookAt(targetPuppet ?? null); return; }
    if (action.kind === 'accept') {
      if (this.offer?.invitedPuppet !== requestingPuppet || this.gesture) return;
      this.gesture = this.offer;
      this.offer = null;
      const { offeringPuppet, invitedPuppet } = this.gesture;
      const side = Math.sign(invitedPuppet.x - offeringPuppet.x) || 1;
      const centre = (offeringPuppet.x + invitedPuppet.x) / 2;
      const y = Math.max(offeringPuppet.y, invitedPuppet.y);
      // Two extended glove arms touch across roughly 234 stage pixels.
      const z = (offeringPuppet.z + invitedPuppet.z) / 2;
      offeringPuppet.moveTo(centre - side * 117, y, z);
      invitedPuppet.moveTo(centre + side * 117, y, z);
      invitedPuppet.gestureArm = side > 0 ? 'left' : 'right';
      invitedPuppet.lookAt(offeringPuppet);
      return;
    }
    if (action.kind === 'decline' || action.kind === 'withdraw') {
      const owner = action.kind === 'decline' ? this.offer?.invitedPuppet : this.offer?.offeringPuppet;
      if (owner === requestingPuppet) this.closeOffer();
      return;
    }
    const busy = p => this.gesture && (p === this.gesture.offeringPuppet || p === this.gesture.invitedPuppet);
    if (busy(requestingPuppet) || busy(targetPuppet)) return;
    if (action.kind === 'walk' || action.kind === 'swap') {
      if (this.offer && [requestingPuppet, targetPuppet].some(p => p === this.offer.offeringPuppet || p === this.offer.invitedPuppet)) this.closeOffer();
      if (action.kind === 'walk') requestingPuppet.moveTo(action.x, action.y, action.z);
      else if (targetPuppet) {
        const { x, y, z } = requestingPuppet;
        requestingPuppet.moveTo(targetPuppet.x, targetPuppet.y, targetPuppet.z);
        targetPuppet.moveTo(x, y, z);
      }
      return;
    }
    if (targetPuppet && !this.offer && !this.gesture && ['handshake', 'high-five'].includes(action.kind)) {
      this.offer = { offeringPuppet: requestingPuppet, invitedPuppet: targetPuppet, kind: action.kind, held: 0 };
      requestingPuppet.lookAt(targetPuppet);
      requestingPuppet.gestureArm = targetPuppet.x > requestingPuppet.x ? 'right' : 'left';
      requestingPuppet.gestureArmLiftDegrees = 8;
    }
  }

  // Releasing an unanswered offer also releases the offering arm.
  closeOffer() {
    if (this.offer) this.offer.offeringPuppet.gestureArm = null;
    this.offer = null;
  }

  // Hold the hands together after both performers have reached their marks.
  // Everyone else continues moving and speaking throughout the gesture.
  update(ms) {
    // A viewer who started speaking in time keeps the floor through transcription.
    if (this.confirmation?.deadline <= performance.now() && !this.reservedAudienceTarget) {
      this.confirmation = null;
      this.hint('');
      this.nextTurn();
    }
    if (this.gesture) {
      const pair = this.gesture;
      const arrived = [pair.offeringPuppet, pair.invitedPuppet].every(p => p.x === p.destination.x && p.y === p.destination.y && p.z === p.destination.z);
      if (arrived) pair.held += ms;
      const lift = pair.kind === 'high-five' ? 38 : 15 + 4 * Math.sin(pair.held / 130);
      pair.offeringPuppet.gestureArmLiftDegrees = pair.invitedPuppet.gestureArmLiftDegrees = lift;
      if (pair.held >= 1000) {
        pair.offeringPuppet.gestureArm = pair.invitedPuppet.gestureArm = null;
        this.gesture = null;
      }
    }
    for (const puppet of this.cast.values()) puppet.update(ms);
    if (this.questioning?.update(ms)) this.nextTurn();
    // Update all actors so an interrupted voice can drain silently off-turn.
    for (const actor of this.actors.values()) actor.update(ms);
  }

  // Scenery owns its geometry; Scene draws it before its reusable cast.
  draw() {
    this.backdrop.draw(!this.interrogation?.active);
    for (const puppet of this.cast.values()) {
      const target = this.interrogation?.active ? this.interrogation.accusation.target : null;
      if (!target || puppet.name === target || puppet === this.questioning.investigator) puppet.draw();
    }
  }

  // The spoken-text area doubles as the silent rehearsal's playback surface.
  caption(name, words) { document.querySelector('#caption').textContent = (this.definition.cast.find(member => member.name === name)?.profile?.spokenName ?? name) + ' — ' + words; }
  // Brief writing and rehearsal messages share one status area beside the stage.
  hint(words) { document.querySelector('#hint').textContent = words; }

  // Show can reuse these puppets immediately. Mark the scene inactive first
  // so callbacks from its microphone, Director or actors cannot move the new cast.
  stop() {
    this.active = false;
    this.interrogation?.stop();
    this.story?.cancelWriting();
    this.audienceInput?.cancel();
    this.audienceReview?.abort();
    for (const actor of this.actors.values()) actor.stop();
    this.speaker = null;
    this.closeOffer();
    this.gesture = null;
    for (const puppet of this.cast.values()) puppet.place(puppet.x, puppet.y, puppet.z);
  }
}
