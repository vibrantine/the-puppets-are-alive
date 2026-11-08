// Represents one physical puppet on stage. A Puppet keeps its appearance,
// 3D position, destination, gaze target and expression player. Scene can call
// arthur.lookAt(claire) to change Arthur's attention, or moveTo() to give him a mark.
// Each update advances his movement and pose; draw() hands that state to the
// shared renderer. Each performer can therefore move and react independently.

class Puppet {
  constructor(character, renderer) {
    this.name = character.name;
    this.head = character.head;
    this.body = character.body;
    this.renderer = renderer;
    this.place(0, 0);
  }

  // The hem of the glove sits on this stage mark. Placement resets old poses.
  place(x, y, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.moveTo(x, y, z);
    this.lookAt(null);
    this.gestureArm = null;
    this.gestureArmLiftDegrees = 0;
    this.speaking = false;
    this.bodyTurn = 0;
    this.targetBodyTurn = 0;
    this.walkPhase = 0;
    this.expression = new ExpressionPlayer(neutralEmotion);
  }

  // A destination is approached during update, at a fixed pixel speed.
  moveTo(x, y, z = this.z, pixelsPerSecond = 120) {
    this.destination = { x, y, z };
    this.walkSpeed = pixelsPerSecond;
  }

  // Remember the target itself so a moving partner remains in view.
  lookAt(puppet) { this.lookTarget = puppet; }

  // Select an emotion by name, for example arthur.setEmotion("happy").
  // The player blends from the current pose into the new entry reaction, then
  // follows this puppet's speaking flag. Repeating the same emotion keeps its clock.
  // Reject an unknown name before changing anything so spelling mistakes are visible.
  setEmotion(emotionName) {
    const emotions = {
      neutral: neutralEmotion,
      happy: happyEmotion,
      sad: sadEmotion,
      angry: angryEmotion,
      afraid: afraidEmotion,
      surprised: surprisedEmotion
    };
    if (!Object.hasOwn(emotions, emotionName)) {
      throw new Error("Unknown puppet emotion: " + emotionName);
    }
    this.expression.setEmotion(emotions[emotionName]);
  }

  // Advance at the requested walking pace and stop exactly on the mark.
  update(ms) {
    this.expression.update(ms, this.speaking);
    const turn = this.targetBodyTurn - this.bodyTurn;
    this.bodyTurn += Math.sign(turn) * Math.min(Math.abs(turn), ms * 0.24);
    const dx = this.destination.x - this.x;
    const dy = this.destination.y - this.y;
    const dz = this.destination.z - this.z;
    const distance = Math.hypot(dx, dy, dz);
    if (!distance) {
      this.walkPhase = 0;
      return;
    }
    this.walkPhase += ms / 105;
    const fraction = Math.min(1, ms * this.walkSpeed / (1000 * distance));
    this.x += dx * fraction;
    this.y += dy * fraction;
    this.z += dz * fraction;
  }

  // The renderer shares the meshes. This instance supplies today's pose and colours.
  draw() { this.renderer.draw(this); }
}
