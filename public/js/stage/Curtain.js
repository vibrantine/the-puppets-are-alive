// Displays Show's curtain progress using two textured HTML panels. Show owns
// timing and scene changes; this view only translates the fabric left and right.
// It has no animation timer, audio logic or authority to release the next scene.
class Curtain {
  constructor(element) {
    this.left = element.querySelector('.curtain-panel--left');
    this.right = element.querySelector('.curtain-panel--right');
    this.progress = null;
  }

  // 0 is fully open, 1 fully closed. Skip unchanged frames. A smoothstep curve
  // softens the travel while preserving Show's exact opening/closing endpoints.
  setProgress(progress) {
    const closed = Math.max(0, Math.min(1, progress));
    if (closed === this.progress) return;
    this.progress = closed;
    const eased = closed * closed * (3 - 2 * closed);
    const travel = (1 - eased) * 110;
    this.left.style.transform = `translateX(${-travel}%)`;
    this.right.style.transform = `translateX(${travel}%)`;
  }
}
