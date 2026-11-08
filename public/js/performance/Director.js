// Owns the remaining cues and the record of what actors delivered. Audience
// replies and later scenes use that history when the Director writes new lines.

class Director {
  #queue;

  constructor(script) {
    this.validateCues(script.cues);
    this.#queue = [...script.cues];
    this.scriptRevision = 0;
    this.heard = [];
  }

  // Give readers a snapshot so saving an interview or sharing lines cannot consume a cue.
  get remainingCues() { return [...this.#queue]; }
  get nextCue() { return this.#queue[0]; }

  // Performing a cue advances the same script. A writer can still extend its ending.
  consumeCue() { return this.#queue.shift(); }

  // Replacing future lines invalidates writing based on the earlier script.
  replaceRemaining(cues) {
    this.#queue = [...cues];
    this.scriptRevision++;
  }

  // Keep the existing ending playable while writing. Swap it out only if the
  // request still belongs to this script and the ending is still ahead of us.
  extendRemaining(cues, expectedRevision) {
    if (expectedRevision !== this.scriptRevision || this.#queue.at(-1)?.type !== 'endScene') return false;
    this.#queue.splice(this.#queue.length - 1, 1, ...cues);
    this.scriptRevision++;
    return true;
  }

  // Share stable identity and this case's role with each writing request.
  static castBriefs(definition) {
    return definition.cast.map(({ name, role, profile }) => ({
      name, role, spokenName: profile?.spokenName ?? name, brief: profile?.brief
    }));
  }

  // Write the opening from Show's private truth and the authored ensemble premise.
  // Validate the complete result before any line reaches a performer.
  static async generateOpening(definition, mystery, signal) {
    const prompt = JSON.stringify({
      premise: definition.premise,
      cast: Director.castBriefs(definition),
      murderer: mystery.murderer
    });
    const { text } = await TheatreAPI.requestOpening(prompt, signal);
    const result = JSON.parse(text);
    const names = new Set(definition.cast.map(member => member.name));
    new Director({ cues: result.cues });
    const speakers = new Set();
    const investigator = definition.questioning.investigator;
    let calledSuspect = null;
    let wordCount = 0;
    for (const cue of result.cues) {
      if (cue.type === 'endScene') continue;
      if (cue.type === 'callSuspect') {
        if (!names.has(cue.suspect) || cue.suspect === investigator) throw new Error('Unknown suspect.');
        calledSuspect = cue.suspect;
        continue;
      }
      if (cue.speaker !== investigator && cue.speaker !== calledSuspect) {
        throw new Error('Call the suspect forward before their dialogue.');
      }
      if (!names.has(cue.speaker)) throw new Error('Unknown generated speaker.');
      speakers.add(cue.speaker);
      wordCount += LiveActor.spokenWords(cue.words).split(/\s+/).length;
      for (const action of [cue.action, ...(cue.after ?? [])].filter(Boolean)) {
        if (action.kind !== 'look' || (action.target && !names.has(action.target)) ||
            (action.by && !names.has(action.by))) throw new Error('Invalid generated stage action.');
      }
    }
    if (speakers.size !== names.size || wordCount < 180 || wordCount > 380) {
      throw new Error('Opening must include the full cast and roughly two minutes of dialogue.');
    }
    if (!Array.isArray(result.fixedFacts) || !result.fixedFacts.length ||
        !result.fixedFacts.every(fact => typeof fact === 'string') ||
        !Array.isArray(result.characterKnowledge) ||
        result.characterKnowledge.length !== names.size ||
        new Set(result.characterKnowledge.map(entry => entry.character)).size !== names.size ||
        !result.characterKnowledge.every(entry => names.has(entry.character) &&
          Array.isArray(entry.knows) && entry.knows.every(fact => typeof fact === 'string'))) {
      throw new Error('Incomplete mystery facts or character knowledge.');
    }
    return result;
  }

  // First write one short reply. With that reply supplied, write only what follows.
  // Scene can play the fixed reply while this second request is in flight. Neither
  // generated text nor an in-flight reply is recorded as completed performance.
  // Each stage retries once; Scene retains the old continuation on failure.
  async respondToAudience(definition, mystery, audience, signal, committedReply = null) {
    const phase = committedReply ? 'continuation' : 'reply';
    const isReply = phase === 'reply';
    const investigator = definition.questioning?.investigator;
    const performed = isReply
      ? this.heard.filter(line => !line.privateSuspect || line.privateSuspect === audience.target || audience.target === investigator)
      : this.heard;
    const prompt = JSON.stringify({
      premise: definition.premise, cast: Director.castBriefs(definition),
      mystery: isReply ? undefined : mystery,
      knowledge: isReply ? mystery?.characterKnowledge?.find(entry => entry.character === audience.target)?.knows : undefined,
      performed, remainingCues: isReply ? undefined : this.remainingCues, audience, committedReply
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      signal.throwIfAborted();
      try {
        const { text } = await TheatreAPI.requestAudience(prompt, phase,
          AbortSignal.any([signal, AbortSignal.timeout(10000)]));
        signal.throwIfAborted();
        const result = JSON.parse(text);
        if (isReply && result.decision !== 'reply') {
          const { decision, suspect } = result;
          const knownSuspect = definition.cast.some(member => member.name === suspect && member.name !== investigator);
          if (result.reply !== null || !(
            (decision === 'accuse' && knownSuspect) ||
            (decision === 'clarify' && (knownSuspect || suspect === null)) ||
            (decision === 'resume' && audience.confirmation && suspect === null)
          )) throw new Error('Invalid audience decision.');
          return result;
        }
        const cues = phase === 'reply' ? [result.reply, { type: 'endScene' }] : result.cues;
        this.validateCues(cues);
        if (phase === 'reply' && (result.reply.type !== 'dialogue' || result.reply.speaker !== audience.target ||
            LiveActor.spokenWords(result.reply.words).split(/\s+/).length > 45)) {
          throw new Error('Expected a short reply from the addressed character.');
        }
        this.validateCast(cues, definition);
        return isReply ? result : cues;
      } catch (error) {
        if (signal.aborted || attempt === 1) throw error;
      }
    }
  }

  // Reject unroutable lines, partners and after-actions before replacing a playable queue.
  validateCast(cues, definition) {
    const names = new Set(definition.cast.map(member => member.name));
    for (const cue of cues) {
      if (cue.type === 'endScene' || cue.type === 'endInterview') continue;
      if (cue.type === 'callSuspect') {
        if (!names.has(cue.suspect) || cue.suspect === definition.questioning.investigator) {
          throw new Error('Invalid called suspect.');
        }
        continue;
      }
      if (!names.has(cue.speaker)) throw new Error('Unknown speaker.');
      if (cue.after && !cue.after.every(action => names.has(action.by))) throw new Error('Unknown performer.');
      for (const action of [cue.action, ...(cue.after ?? [])].filter(Boolean)) {
        if (action.kind !== 'look' || (action.target && !names.has(action.target))) throw new Error('Invalid gaze.');
      }
    }
  }

  // A follow-up must advance the testimony. Retry once if the writer copies
  // the audience question or the answer that has already been released.
  async writeInterrogation(scene, details, signal) {
    const plain = words => LiveActor.spokenWords(words).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.writeSegment('interrogation', scene, details, signal);
      const [question, answer] = result.cues;
      if (plain(question.words) !== plain(details.audience.words) &&
          plain(answer.words) !== plain(details.committedReply.words)) return result.cues;
      details = { ...details, revision: 'That exchange repeated a performed line. Ask about a particular detail and give a fresh piece of testimony.' };
    }
    throw new Error('Private follow-up repeated an earlier line.');
  }

  // Write a private exchange, a return, or a future segment from the same case.
  async writeSegment(phase, scene, details, signal) {
    const interview = phase === 'interrogation';
    // A private answer can draw only on this guest's knowledge. The return
    // writer sees performed testimony and the saved script; giving it the
    // solution here lets Arthur accidentally announce evidence he never heard.
    const evidence = interview
      ? { suspectKnowledge: scene.mystery.characterKnowledge.find(entry => entry.character === details.target)?.knows ?? [] }
      : phase === 'extend' ? { mystery: scene.mystery } : {};
    const performed = interview
      ? this.heard.filter(line => !line.privateSuspect || line.privateSuspect === details.target)
      : this.heard;
    const prompt = JSON.stringify({
      premise: scene.definition.premise, cast: Director.castBriefs(scene.definition), ...evidence,
      performed, currentLine: scene.speaker?.turn,
      remaining: phase === 'extend' ? this.remainingCues : undefined, ...details
    });
    const result = await TheatreAPI.post('segment', { prompt, phase }, signal);
    signal.throwIfAborted();
    const script = JSON.parse(result.text);
    const cues = phase === 'interrogation'
      ? [script.question, script.answer, { type: 'endInterview' }]
      : script.cues;
    if (!Array.isArray(cues) || cues.some(cue => !cue)) throw new Error('Incomplete Director segment.');
    this.validateCues(cues, interview ? 'endInterview' : 'endScene');
    this.validateCast(cues, scene.definition);
    if (cues.length < 2 && phase !== 'resume') throw new Error('Empty segment.');
    if (phase === 'interrogation') {
      const pair = [scene.definition.questioning.investigator, details.target];
      if (cues.length !== 3 || !pair.every((name, index) => cues[index].type === 'dialogue' && cues[index].speaker === name)) {
        throw new Error('Expected one question and one answer.');
      }
      for (const cue of cues.slice(0, 2)) {
        for (const action of [cue.action, ...(cue.after ?? [])].filter(Boolean)) {
          if ((action.by && !pair.includes(action.by)) || (action.target && !pair.includes(action.target))) throw new Error('Offstage action.');
        }
      }
    }
    return { cues, outputTokens: result.outputTokens };
  }

  // The private script has a fixed turn order so the theatre knows exactly when
  // to offer the floor to the viewer. The Director supplies every spoken word.
  async writeAccusation(scene, target, accusation, viewerRemark, signal) {
    const inspector = scene.questioning.investigator.name;
    let phase = 'accusation';
    if (viewerRemark) phase = viewerRemark.addressee === target ? 'suspectReply' : 'viewerReason';
    const prompt = JSON.stringify({
      target, accusation, viewerWords: viewerRemark?.words, premise: scene.definition.premise,
      cast: Director.castBriefs(scene.definition).filter(member => [inspector, target].includes(member.name)),
      fixedFacts: scene.mystery.fixedFacts,
      suspectKnowledge: scene.mystery.characterKnowledge.find(entry => entry.character === target)?.knows,
      performed: this.heard.filter(record => !record.privateSuspect || record.privateSuspect === target)
    });
    const result = await TheatreAPI.post('segment', { phase, prompt },
      AbortSignal.any([signal, AbortSignal.timeout(30000)]));
    signal.throwIfAborted();
    const script = JSON.parse(result.text);
    const parts = viewerRemark ? [] : [
      [inspector, script.knownFacts], [target, script.testimony], [inspector, script.viewerQuestion]
    ];
    if (phase !== 'suspectReply') parts.push([inspector, script.followUp]);
    parts.push([target, script.answer]);
    const lines = parts.map(([speaker, part]) => ({
      type: 'dialogue', speaker, words: part?.words, emotion: part?.emotion
    }));
    this.validateCues([...lines, { type: 'endInterview' }], 'endInterview');
    return lines;
  }

  // The rehearsal record distinguishes completed captions from audible speech.
  record(speaker, words, delivery, privateSuspect = null, spokenMs) {
    this.heard.push({ speaker, words, delivery, privateSuspect, spokenMs });
  }

  // The caller specifies which ending belongs to this part of the performance.
  // Reject unsupported cues before they can become a partially performed script.
  validateCues(cues, expectedEnding = 'endScene') {
    if (!Array.isArray(cues) || !cues.length || cues.at(-1).type !== expectedEnding) {
      throw new Error('Expected final cue: ' + expectedEnding);
    }
    for (const [index, cue] of cues.entries()) {
      if (cue.type === expectedEnding && index === cues.length - 1) continue;
      if (cue.type === 'callSuspect' && typeof cue.suspect === 'string' &&
          ['wave', 'handshake'].includes(cue.greeting)) continue;
      if (cue.type !== 'dialogue' || typeof cue.speaker !== 'string' ||
          typeof cue.words !== 'string' || !LiveActor.spokenWords(cue.words)) {
        throw new Error('Expected dialogue or callSuspect before the final ' + expectedEnding + ' cue.');
      }
      if (cue.emotion !== undefined &&
          !['neutral', 'happy', 'sad', 'angry', 'afraid', 'surprised'].includes(cue.emotion)) {
        throw new Error('Unknown script emotion: ' + cue.emotion);
      }
    }
  }
}
