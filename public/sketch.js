// The entry point for the global p5 sketch. setup() prepares the 3D canvas,
// loads the puppet art and creates the Show. Each time p5 calls draw(), the
// sketch passes the elapsed time to the show, then asks it to draw the stage.
// This keeps the frame order easy to follow while the scene handles the cast.

let show;

async function setup() {
  createCanvas(1000, 470, WEBGL).parent('stage');
  colorMode(HSB, 360, 100, 100);
  // At z = 0 one stage unit fills one pixel. Positive z brings actors closer.
  const eyeDistance = 600;
  camera(0, 0, eyeDistance, 0, 0, 0, 0, 1, 0);
  perspective(2 * Math.atan(height / (2 * eyeDistance)), width / height, 10, 2400);
  noStroke();

  const renderer = new PuppetRenderer();
  await renderer.load();
  show = await Show.load(renderer);
  show.openNextScene();
  show.audience = new AudienceInput(show);
  const start = document.querySelector('#live');
  start.disabled = false;
  start.onclick = () => show.beginLive();
  document.querySelector('#end').onclick = () => show.end();
  window.addEventListener('pagehide', () => { show.end(); });
}

function draw() {
  if (!show) return;
  show.update(deltaTime);
  show.draw();
}
