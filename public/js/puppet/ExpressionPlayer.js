// Turns an authored emotion into a pose for one puppet on each frame. The player
// moves the head, arms and body between timed checkpoints. It plays the entry
// reaction (the spark) once, then follows the idle or speaking loop. Each puppet
// has its own clock so Claire can gesture through a line while Arthur listens,
// even when both use the same emotion definition.

class ExpressionPlayer {
  constructor(emotion) {
    this.pose = { left: 0, right: 0, nod: 0, tilt: 0, lean: 0, swayAngle: 0, bobOffset: 0 };
    this.setEmotion(emotion);
  }

  // A new emotion enters through its spark, starting from the visible pose.
  setEmotion(emotion) {
    if (emotion === this.emotion) return;
    this.emotion = emotion;
    this.start('spark');
  }

  // Enter a sequence from the current pose so a change of state never snaps.
  start(state) {
    this.state = state;
    this.index = 0;
    this.elapsed = 0;
    this.startingPose = { ...this.pose };
  }

  // Move between authored checkpoints, carrying unused frame time into the next.
  update(ms, speaking) {
    const loop = speaking ? 'speaking' : 'idle';
    if (this.state !== 'spark' && this.state !== loop) this.start(loop);
    let frameTimeLeftMs = Math.min(ms, 100);
    while (frameTimeLeftMs > 0) {
      const sequence = this.emotion[this.state];
      const checkpoint = sequence.checkpoints[this.index];
      if (!checkpoint) {
        // The final pose holds for the loop's repeat delay; sparks play just once.
        const delay = (sequence.repeatDelaySeconds ?? 0) * 1000;
        const wait = Math.min(frameTimeLeftMs, delay - this.elapsed);
        frameTimeLeftMs -= wait;
        this.elapsed += wait;
        if (this.elapsed >= delay) this.start(loop);
        continue;
      }
      // Listening stays measured. Reactions and spoken gestures land a little sooner.
      const sad = this.emotion.name === 'sad';
      let playbackRate = this.state === 'idle' ? 1.08 : 1.15;
      if (sad) playbackRate = 0.85;
      const duration = checkpoint.moveSeconds * 1000 / playbackRate;
      const step = Math.min(frameTimeLeftMs, duration - this.elapsed);
      frameTimeLeftMs -= step;
      this.elapsed += step;
      const t = this.elapsed / duration;
      // Shift the emphasis earlier in the gesture, then settle gently into the pose.
      const progress = sad ? t : t + 0.4 * t * (1 - t);
      const eased = progress * progress * (3 - 2 * progress);
      const target = { ...checkpoint.armOffsets, ...checkpoint.head, ...checkpoint.bodyOffsets };
      for (const joint of Object.keys(target)) {
        this.pose[joint] = this.startingPose[joint] + (target[joint] - this.startingPose[joint]) * eased;
      }
      if (this.elapsed >= duration) {
        this.index++;
        this.elapsed = 0;
        this.startingPose = { ...this.pose };
      }
    }
  }
}
