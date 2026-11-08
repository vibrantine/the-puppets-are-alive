// Owns the cast, prepared opening and persistent mystery truth for this show. Show loads
// each puppet once and lends those objects to successive scenes. When a scene
// requests a cut, Show closes the curtain, stops its actors and stages the next
// cast. Returning characters reuse their puppet objects with fresh voice sessions.

class Show {
  constructor(puppets, sceneDefinitions) {
    this.puppets = puppets;
    this.sceneDefinitions = sceneDefinitions;
    this.index = -1;
    this.activeScene = null;
    this.started = false;
    this.curtain = 1; // Start closed: 0 is open, 1 is closed.
    this.curtainView = new Curtain(document.querySelector('.stage-curtain'));
    this.transition = null;
    this.curtainCloseMs = 3000;
    this.closingScene = null; // Draw-only reference while an ended show closes.
  }

  // Load the opening alongside the cast so the first live line is ready before Start.
  static async load(renderer) {
    // These small files refer to each other by character ID. Read the current
    // copies together so a cached cast cannot be paired with a renamed speaker.
    async function readShowData(path) {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load ' + path);
      return response.json();
    }
    const definition = await readShowData('scenes/opening-ensemble.json');
    if (definition.backdrop.wallImage) definition.wallTexture = await loadImage(definition.backdrop.wallImage);
    const puppets = new Map();
    for (const member of definition.cast) {
      const character = await readShowData('characters/' + member.character + '.json');
      member.profile = character.profile;
      puppets.set(character.name, new Puppet(character, renderer));
    }
    definition.script = await readShowData('scripts/opening-ensemble.json');
    const show = new Show(puppets, [definition]);
    // Choose once per show. The same opening must be possible for every culprit.
    const suspects = definition.cast.filter(member => member.name !== 'arthur-investigator');
    show.mystery = {
      murderer: suspects[Math.floor(Math.random() * suspects.length)].name,
      fixedFacts: definition.script.fixedFacts,
      characterKnowledge: definition.script.characterKnowledge,
      events: []
    };
    return show;
  }

  // One place controls the two audience-facing buttons through startup and ending.
  updateControls() {
    const running = !!this.activeScene && (this.starting || this.started);
    document.querySelector('#live').hidden = running;
    document.querySelector('#live').disabled = this.transition === 'ending';
    document.querySelector('#live').textContent = this.started ? 'Play again' : 'Start show';
    document.querySelector('#end').hidden = !running;
    document.querySelector('#start-note').hidden = running;
  }

  // Show chooses each scene only after the previous one has ended.
  openNextScene() {
    const definition = this.sceneDefinitions[++this.index];
    this.activeScene = definition ? new Scene(definition, this.puppets, message => this.end(message)) : null;
    if (this.activeScene) {
      this.activeScene.mystery = this.mystery;
      this.activeScene.changeStage = prepare => {
        this.performing = false;
        this.activeScene.stageChange = prepare;
        this.transition = 'closing';
      };
    }
    if (!this.activeScene) {
      this.performing = false;
      this.releaseAudio();
    }
    this.updateControls();
    document.querySelector('#scene-title').textContent = definition?.title ?? 'Curtain';
    document.querySelector('#caption').textContent = '';
    document.querySelector('#hint').textContent = '';
  }

  // One user gesture unlocks audio and requests the mic before any paid request.
  // A run ID prevents a cancelled startup from applying to a subsequent attempt.
  async beginLive() {
    if (this.transition === 'ending' || this.starting || (this.started && this.activeScene)) return;
    const run = this.runId = (this.runId ?? 0) + 1;
    if (!this.activeScene) {
      this.index = -1;
      this.started = false;
      this.curtain = 1;
      this.transition = null;
      this.mystery.events = [];
      this.openNextScene();
    }
    this.starting = true;
    this.updateControls();
    try {
      this.audio = new AudioContext();
      await this.audio.resume();
      if (run !== this.runId) return;
      await this.audience.start(this.audio);
      if (run !== this.runId) return;
      this.started = true;
      this.prepareLiveScene();
    } catch (error) {
      if (run === this.runId) this.end('Could not start the show. ' + error.message);
    } finally {
      if (run === this.runId) {
        this.starting = false;
        this.updateControls();
      }
    }
  }

  // All spoken lines use live voices. Give the scene its audio context and let
  // the curtain open; each actor connects when first handed live dialogue.
  prepareLiveScene() {
    this.activeScene.prepareLive(this.audio);
    this.transition = 'opening';
  }

  // Stop paid work immediately. Keep only the stopped scene visible while the
  // curtain closes; this ending never advances to another scene.
  end(message = 'Performance ended.') {
    this.runId = (this.runId ?? 0) + 1;
    this.starting = false;
    this.performing = false;
    this.closingScene = this.activeScene ?? this.closingScene;
    this.activeScene?.stop();
    this.activeScene = null;
    this.transition = this.curtain < 1 ? 'ending' : null;
    if (!this.transition) this.closingScene = null;
    this.releaseAudio();
    this.updateControls();
    document.querySelector('#scene-title').textContent = 'Curtain';
    document.querySelector('#caption').textContent = '';
    document.querySelector('#hint').textContent = message;
  }

  // Show alone owns the microphone and audio device lifetime.
  releaseAudio() {
    this.audience?.stop();
    this.audio?.close().catch(() => {});
    this.audio = null;
  }

  // Silent rehearsal entry point for development checks, with no production UI.
  begin() {
    if (this.transition === 'ending' || this.started || !this.activeScene) return;
    this.started = true;
    document.querySelector('#hint').textContent = '';
    document.querySelector('#live').hidden = true;
    this.transition = 'opening';
  }

  // Finish the outgoing scene behind the closed curtain. Release the next
  // opening line only once the incoming cast is on stage and visible.
  update(ms) {
    // Manual End and failures have already released audio. Animate only the
    // curtain, then discard the stopped scene and enable replay.
    if (this.transition === 'ending') {
      this.curtain = Math.min(1, this.curtain + ms / this.curtainCloseMs);
      if (this.curtain === 1) {
        this.closingScene = null;
        this.transition = null;
        this.updateControls();
      }
      return;
    }
    if (!this.activeScene) return;
    const scene = this.activeScene;
    scene.update(ms);
    // An actor failure can end the show from inside update. Do not keep
    // advancing a scene after its callback has stopped or replaced it.
    if (this.activeScene !== scene || !scene.active) return;
    if (scene.cutRequested) {
      this.performing = false;
      this.transition = 'closing';
    }
    if (this.transition === 'holding') {
      if (performance.now() < this.openAfter) return;
      this.transition = 'opening';
    }
    if (!this.transition || this.transition === 'connecting') return;
    // Give the scene ending a slower three-second close; entrances stay at 1.8s.
    const travelMs = this.transition === 'closing' ? this.curtainCloseMs : 1800;
    // Paint the travel across frames even after a background tab or slow frame.
    const step = Math.min(ms, 100) / travelMs;
    if (this.transition === 'closing') {
      this.curtain = Math.min(1, this.curtain + step);
      if (this.curtain === 1) {
        if (scene.stageChange) {
          this.transition = 'connecting';
          document.querySelector('#caption').textContent = '';
          // Preparation and the pause run together behind fully closed velvet.
          this.openAfter = performance.now() + 1200;
          scene.stageChange().then(() => {
            if (scene.active) this.transition = 'holding';
          }).catch(error => { if (scene.active) scene.fail(error.message); });
          return;
        }
        if (this.mystery) this.mystery.events.push(...this.activeScene.director.heard);
        this.activeScene.stop();
        this.openNextScene();
        this.transition = this.activeScene ? 'opening' : null;
        if (this.activeScene && this.audio) {
          this.transition = 'connecting';
          this.prepareLiveScene();
        }
      }
    } else {
      this.curtain = Math.max(0, this.curtain - step);
      if (this.curtain === 0) {
        this.transition = null;
        this.performing = !!this.audio;
        scene.stageChange = null;
        scene.nextTurn();
      }
    }
  }

  // The stage uses top-left pixel marks. Shift once from WebGL's centre.
  draw() {
    background(0);
    push();
    translate(-width / 2, -height / 2);
    (this.activeScene ?? this.closingScene)?.draw();
    pop();
    this.curtainView.setProgress(this.curtain);
  }
}
