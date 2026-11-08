// Owns the paused ensemble and the next piece of its script. Scene owns speech
// and staging. All pending writing is tied to the scene that requested it.
class StoryProgress {
  constructor(scene) {
    this.scene = scene;
    this.interview = null;
    this.extensions = 0;
    this.metrics = [];
  }

  // Keep the unplayed queue and its position once, even across follow-up questions.
  enter(target) {
    if (!this.interview) {
      this.interview = { saved: this.scene.director.remainingCues, partner: this.scene.scriptedSuspect, firstRecord: this.scene.director.heard.length };
    }
    this.interview.target = target;
    this.scene.director.replaceRemaining([{ type: 'endInterview' }]);
    this.scene.scriptedSuspect = target;
  }

  // On the private ending, send the guest home and rewrite only the saved remainder.
  // A failed rewrite restores that exact queue. An interruption can supersede this request.
  async resume() {
    if (this.returnRequest || !this.scene.questioning.arrange(null)) return;
    const scene = this.scene;
    const interview = this.interview;
    const request = this.returnRequest = new AbortController();
    let cues = interview.saved;
    try {
      const result = await scene.director.writeSegment('resume', scene,
        { savedRemainder: cues, target: interview.target, privateDelivery: scene.director.heard.slice(interview.firstRecord) }, request.signal);
      cues = result.cues;
    } catch {
      if (!request.signal.aborted) scene.hint('Resuming the ensemble.');
    } finally {
      if (this.returnRequest === request) this.returnRequest = null;
    }
    if (!scene.active || request.signal.aborted) return;
    scene.director.replaceRemaining(cues);
    scene.scriptedSuspect = interview.partner;
    this.interview = null;
    scene.nextTurn();
  }

  // At each new turn estimate playable time from the remaining spoken words.
  // Two short extensions bound a normal show. A slow or failed writer leaves a
  // playable ending; only replace that ending while this queue is still current.
  async bufferNextSegment() {
    const scene = this.scene;
    this.startedAt ??= performance.now();
    const revision = scene.director.scriptRevision;
    if (this.finalSegmentBuffered || !scene.director.live || this.interview || this.bufferRequest || this.extensions >= 2 ||
        this.failedRevision === revision || !scene.speaker?.turn) return;
    const pending = [scene.speaker.turn, ...scene.director.remainingCues];
    const seconds = pending.reduce((total, cue) => cue.type === 'dialogue'
      ? total + LiveActor.spokenWords(cue.words).split(/\s+/).length / 2.4 + 1.1 : total, 0);
    if (seconds > 90) return;
    // Leave room for gestures and a natural ending within a roughly 3-5 minute show.
    const timeForNewMaterial = 270 - (performance.now() - this.startedAt) / 1000 - seconds;
    if (timeForNewMaterial < 20) return;
    const targetWords = Math.min(150, Math.round(timeForNewMaterial * 1.8));
    const finalSegment = this.extensions === 1 || timeForNewMaterial <= 120;
    const request = this.bufferRequest = new AbortController();
    const started = performance.now();
    const metric = { secondsRemaining: Math.round(seconds) };
    try {
      const result = await scene.director.writeSegment('extend', scene,
        { finalSegment, targetWords }, request.signal);
      if (request.signal.aborted || !scene.active || scene.cutRequested) return;
      if (!scene.director.extendRemaining(result.cues, revision)) return;
      this.extensions++;
      this.finalSegmentBuffered = finalSegment;
      metric.outputTokens = result.outputTokens;
      metric.outcome = 'buffered';
    } catch (error) {
      if (!request.signal.aborted) {
        this.failedRevision = revision;
        metric.outcome = error.message;
      }
    } finally {
      metric.elapsedMs = Math.round(performance.now() - started);
      metric.outcome ??= 'superseded';
      this.metrics.push(metric);
      if (this.bufferRequest === request) this.bufferRequest = null;
    }
  }

  // A confirmed audience interruption or a cut invalidates speculative writing.
  cancelWriting() {
    this.bufferRequest?.abort();
    this.bufferRequest = null;
    this.returnRequest?.abort();
    this.returnRequest = null;
  }
}
