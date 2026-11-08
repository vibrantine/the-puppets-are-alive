// Coordinates the Investigator and one suspect on the ensemble stage. The script
// names the guest and greeting. This object resolves the stage positions and
// advances each physical beat before Scene releases the next line.
class SuspectQuestioning {
  constructor(scene) {
    this.scene = scene;
    const { investigator, conversationPosition } = scene.definition.questioning;
    this.investigator = scene.cast.get(investigator);
    this.conversationPosition = conversationPosition;
    this.suspect = null;
    this.phase = 'ready';
    this.elapsed = 0;
    this.walkSpeed = 300; // Cross from the back row in about two seconds.
  }

  // Called again after each physical sequence. Return true once the requested
  // arrangement is ready. Returning the previous guest always frees the mark first.
  arrange(name, greeting = 'wave') {
    if (this.phase !== 'ready') return false;
    if (name === (this.suspect?.name ?? null)) return true;
    if (this.suspect) {
      const home = this.scene.definition.cast.find(member => member.name === this.suspect.name);
      this.suspect.targetBodyTurn = 0;
      this.suspect.moveTo(home.x, home.y, home.z, this.walkSpeed);
      this.phase = 'returning';
      return false;
    }
    this.suspect = this.scene.cast.get(name);
    this.greeting = greeting;
    this.investigator.lookAt(this.suspect);
    this.suspect.lookAt(this.investigator);
    // Turn the pointing sleeve towards the real mark, including its depth.
    const dx = this.suspect.x - this.investigator.x;
    const dz = this.suspect.z - this.investigator.z;
    this.investigator.targetBodyTurn = Math.sign(dx) * Math.atan2(-dz, Math.abs(dx)) * 180 / Math.PI;
    this.phase = 'turning';
    this.elapsed = 0;
    return false;
  }

  // The Scene calls this after puppet movement and shared gesture updates.
  // Returning true wakes the script once, including a waiting audience reply.
  update(ms) {
    if (this.phase === 'ready') return false;
    this.elapsed += ms;
    const inspector = this.investigator;
    const guest = this.suspect;
    const atMark = guest.x === guest.destination.x && guest.y === guest.destination.y &&
      guest.z === guest.destination.z;
    switch (this.phase) {
      case 'turning':
        if (inspector.bodyTurn !== inspector.targetBodyTurn || this.elapsed < 230) break;
        inspector.gestureArm = guest.x < inspector.x ? 'left' : 'right';
        inspector.gestureArmLiftDegrees = 23;
        this.phase = 'pointing';
        this.elapsed = 0;
        break;
      case 'pointing':
        if (this.elapsed < 420) break;
        const position = this.conversationPosition;
        guest.moveTo(position.x, position.y, position.z, this.walkSpeed);
        this.phase = 'approaching';
        break;
      case 'approaching':
        if (!atMark) break;
        inspector.gestureArm = null;
        inspector.targetBodyTurn = 0;
        // The handshake uses front-facing sleeve pivots. Turn to talk after contact.
        if (this.greeting !== 'handshake') guest.targetBodyTurn = Math.sign(inspector.x - guest.x) * 50;
        this.phase = 'facing';
        break;
      case 'facing':
        if (inspector.bodyTurn !== 0 || guest.bodyTurn !== guest.targetBodyTurn) break;
        inspector.lookAt(guest);
        guest.lookAt(inspector);
        if (this.greeting === 'handshake') {
          this.scene.act(inspector, { kind: 'handshake', target: guest.name });
          this.scene.act(guest, { kind: 'accept' });
        } else {
          guest.gestureArm = guest.x > inspector.x ? 'left' : 'right';
        }
        this.phase = 'greeting';
        this.elapsed = 0;
        break;
      case 'greeting':
        if (this.greeting === 'handshake') {
          if (this.scene.gesture) break;
          // Contact brings both hands together. Restore the authored interview spacing for dialogue.
          const home = this.scene.definition.cast.find(member => member.name === inspector.name);
          const mark = this.conversationPosition;
          inspector.moveTo(home.x, home.y, home.z, this.walkSpeed);
          guest.moveTo(mark.x, mark.y, mark.z, this.walkSpeed);
          guest.targetBodyTurn = Math.sign(home.x - mark.x) * 50;
          this.phase = 'settling';
          break;
        } else {
          guest.gestureArmLiftDegrees = 48 + 12 * Math.sin(this.elapsed / 80);
          if (this.elapsed < 650) break;
          guest.gestureArm = null;
        }
        this.phase = 'ready';
        return true;
      case 'settling':
        if (!atMark || inspector.x !== inspector.destination.x || guest.bodyTurn !== guest.targetBodyTurn) break;
        this.phase = 'ready';
        return true;
      case 'returning':
        if (!atMark) break;
        guest.lookAt(inspector);
        this.suspect = null;
        this.phase = 'ready';
        return true;
    }
    return false;
  }
}
