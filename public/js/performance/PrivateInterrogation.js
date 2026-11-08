// One private stage for every suspect. Scene still owns the speaking turn.
// Show calls each staging callback behind closed curtains, so the voices stay
// connected and the audience sees only the finished arrangement.
class PrivateInterrogation {
  constructor(scene) {
    this.scene = scene;
    this.life = new AbortController();
  }

  receive(words, addressee) {
    if (this.active) {
      const returnToCast = /\b(?:back|return) to (?:the )?(?:full )?(?:line[ -]?up|group|ensemble|cast)\b/i;
      const endInterview = /\b(?:end|leave|finish) (?:the |this )?(?:private )?(?:interview|interrogation)\b/i;
      if (returnToCast.test(words) || endInterview.test(words)) {
        clearTimeout(this.timer);
        this.viewerRemark = null;
        this.scene.director.replaceRemaining([{ type: 'endInterview' }]);
        this.waiting = false;
      } else {
        this.viewerRemark = { words, addressee };
      }
      return true;
    }
    return false;
  }

  // Called only once the speaking turn, movement and microphone reservation
  // are clear. A reserved microphone keeps the timeout from cutting off an answer.
  advance() {
    const scene = this.scene;
    if (this.accusation && !this.active) {
      scene.changeStage(() => this.enter());
      return true;
    }
    if (!this.active) return false;
    if (this.viewerRemark) {
      const remark = this.viewerRemark;
      this.viewerRemark = null;
      this.waiting = false;
      this.writeReply(remark);
      return true;
    }
    if (this.writing || this.waiting) return true;
    const cue = scene.director.nextCue;
    if (cue?.type === 'waitForViewer' || cue?.type === 'waitForFollowUp') {
      scene.director.consumeCue();
      this.waiting = true;
      scene.hint(cue.type === 'waitForFollowUp' ? 'Any further questions?' : 'Arthur is listening…');
      this.timer = setTimeout(() => {
        this.waiting = false;
        if (scene.active) {
          scene.hint('');
          scene.nextTurn();
        }
      }, 6500);
      return true;
    }
    if (cue?.type === 'endInterview') {
      scene.changeStage(() => this.leave());
      return true;
    }
    // The director's third line is Arthur's invitation to the viewer.
    if (cue === this.viewerQuestion) scene.questioning.investigator.lookAt(null);
    else scene.questioning.investigator.lookAt(scene.questioning.suspect);
    return false;
  }

  async enter() {
    const scene = this.scene;
    const { target, words } = this.accusation;
    this.active = true;
    scene.story.enter(target);
    scene.director.record('Audience', words, 'spoken accusation; unverified claim', target);
    scene.hint('Preparing the interrogation…');
    let lines;
    try {
      lines = await scene.director.writeAccusation(scene, target, words, null, this.life.signal);
    } catch (error) {
      if (!scene.active) return;
      // Keep the private scene playable during a Director outage. Only report
      // the failure category, since a JSON parse error can contain dialogue.
      console.warn('Private interrogation using prepared dialogue:', error instanceof SyntaxError ? 'Invalid JSON' : error.message);
      lines = this.preparedLines(target);
    }
    if (!scene.active) return;
    this.viewerQuestion = lines[2];
    this.silenceFollowUp = lines[3];
    scene.director.replaceRemaining([...lines.slice(0, 3), { type: 'waitForViewer' },
      ...lines.slice(3), { type: 'waitForFollowUp' }, { type: 'endInterview' }]);
    this.stage(target);
    scene.hint('');
  }

  preparedLines(target) {
    const inspector = this.scene.questioning.investigator.name;
    const backup = this.scene.definition.script.interrogationBackup[target];
    const line = (speaker, words) => ({ type: 'dialogue', speaker, words, emotion: 'neutral' });
    return [line(inspector, backup.knownFacts), line(target, backup.testimony),
      line(inspector, 'What makes you suspect this witness?'),
      line(inspector, 'Let us check that account. What can we actually look at?'),
      line(target, backup.answer)];
  }

  // Position the same two roles for every accusation, keeping the ensemble
  // layout in scene data so a return can restore everyone's original mark.
  stage(target) {
    const scene = this.scene;
    const { wallColour, investigatorMark, suspectMark } = scene.definition.privateInterrogation;
    this.wall = scene.backdrop.wallColour;
    scene.backdrop.wallColour = wallColour;
    const inspector = scene.questioning.investigator;
    const guest = scene.cast.get(target);
    inspector.place(investigatorMark.x, investigatorMark.y, investigatorMark.z);
    guest.place(suspectMark.x, suspectMark.y, suspectMark.z);
    guest.targetBodyTurn = -35;
    inspector.lookAt(guest);
    guest.lookAt(inspector);
    scene.questioning.suspect = guest;
    document.querySelector('#scene-title').textContent = 'Private interrogation';
  }

  async writeReply({ words, addressee }) {
    clearTimeout(this.timer);
    const scene = this.scene;
    const { target, words: accusation } = this.accusation;
    this.writing = true;
    const addressedSuspect = addressee === target;
    scene.director.record('Audience → ' + addressee, words, 'transcribed viewer input; unverified claim', target);
    scene.hint('');
    const remaining = scene.director.remainingCues;
    // A direct answer replaces the witness's pending answer to the previous
    // question. Keep Arthur's next question and the viewer's next invitation.
    if (addressedSuspect && remaining[0]?.type === 'dialogue' && remaining[0].speaker === target) {
      remaining.shift();
    }
    try {
      const lines = await scene.director.writeAccusation(scene, target, accusation, { words, addressee }, this.life.signal);
      if (!scene.active) return;
      // Only replace the prepared silence branch when Arthur has actually
      // asked for the viewer's reasoning. Earlier interruptions keep the script.
      if (!addressedSuspect) {
        if (remaining[0]?.type === 'waitForViewer') remaining.shift();
        if (remaining[0] === this.silenceFollowUp) remaining.splice(0, 2);
      }
      if (remaining[0]?.type === 'endInterview') remaining.unshift({ type: 'waitForFollowUp' });
      scene.director.replaceRemaining([...lines, ...remaining]);
    } catch {
      // The prepared follow-up is already queued after the viewer's invitation.
      if (!scene.active) return;
      if (addressedSuspect) {
        const answer = this.preparedLines(target)[1];
        if (remaining[0]?.type === 'endInterview') remaining.unshift({ type: 'waitForFollowUp' });
        scene.director.replaceRemaining([answer, ...remaining]);
      } else if (scene.director.nextCue?.type === 'waitForViewer') scene.director.consumeCue();
    } finally {
      this.writing = false;
      if (scene.active) {
        scene.hint('');
        scene.nextTurn();
      }
    }
  }

  async leave() {
    const scene = this.scene;
    const interview = scene.story.interview;
    try {
      const result = await scene.director.writeSegment('resume', scene, {
        savedRemainder: interview.saved, target: interview.target,
        privateDelivery: scene.director.heard.slice(interview.firstRecord)
      }, AbortSignal.any([this.life.signal, AbortSignal.timeout(15000)]));
      if (scene.active) interview.saved = result.cues;
    } catch {
      // The saved ensemble queue remains playable if the return writer is late.
    }
    if (!scene.active) return;
    this.restore();
    this.scene.hint('');
  }

  restore() {
    const scene = this.scene;
    clearTimeout(this.timer);
    const { saved, partner } = scene.story.interview;
    scene.director.replaceRemaining(saved);
    scene.scriptedSuspect = partner;
    scene.story.interview = null;
    for (const member of scene.definition.cast) {
      const puppet = scene.cast.get(member.name);
      puppet.place(member.x, member.y, member.z);
      puppet.lookAt(scene.cast.get(member.looksAt) ?? null);
    }
    scene.questioning.suspect = null;
    if (this.wall) scene.backdrop.wallColour = this.wall;
    this.active = this.waiting = false;
    this.accusation = this.viewerQuestion = null;
    document.querySelector('#scene-title').textContent = scene.definition.title;
  }

  stop() {
    clearTimeout(this.timer);
    this.life.abort();
  }
}
