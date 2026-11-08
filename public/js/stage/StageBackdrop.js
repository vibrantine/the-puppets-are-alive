// Draws the physical setting behind the cast: an open curved wall and a floor.
// Scene supplies dimensions and HSB colours from its definition. This class owns
// only scenery geometry; it never moves puppets, changes the camera or runs audio.
// Coordinates match the cast: x runs across the stage, y down, z towards us.
class StageBackdrop {
  constructor(definition) {
    const settings = definition.backdrop ?? {};
    this.wallColour = definition.background;
    this.wallTexture = definition.wallTexture;
    this.floorColour = settings.floorColour ?? { h: 30, s: 24, b: 48 };
    this.floorTexture = FloorTexture.create(this.floorColour);
    this.radius = settings.radius ?? 760;
    this.arcDegrees = settings.arcDegrees ?? 170;
    this.wallHeight = settings.wallHeight ?? 700;
    this.centreZ = settings.centreZ ?? 160;
    this.floorY = settings.floorY ?? 365;
    this.floorFrontZ = settings.floorFrontZ ?? 440;
  }

  // Scene calls this inside Show's existing top-left stage translation.
  // A flat floor reaches behind the wall and forward beyond the camera frame.
  // The depth buffer lets the wall hide the part of the floor outside the set.
  draw(showEnsembleWall) {
    const wall = this.wallColour;
    background(wall.h, wall.s, wall.b);
    push();
    noStroke();
    push();
    textureMode(NORMAL);
    texture(this.floorTexture);
    beginShape();
    vertex(width / 2 - this.radius, this.floorY, this.centreZ - this.radius, 0, 0);
    vertex(width / 2 + this.radius, this.floorY, this.centreZ - this.radius, 1, 0);
    vertex(width / 2 + this.radius, this.floorY, this.floorFrontZ, 1, 1);
    vertex(width / 2 - this.radius, this.floorY, this.floorFrontZ, 0, 1);
    endShape(CLOSE);
    pop();

    // Sweep a vertical strip around the BACK of a cylinder, leaving its front
    // open. At angle zero the wall is farthest away; both ends curl towards us.
    // 80 narrow panels make a smooth silhouette without an imported mesh.
    const halfArc = this.arcDegrees * Math.PI / 360;
    const panels = 80;
    const textured = showEnsembleWall && this.wallTexture;
    if (textured) {
      textureMode(NORMAL);
      texture(this.wallTexture);
    }
    beginShape(TRIANGLE_STRIP);
    for (let panel = 0; panel <= panels; panel++) {
      const angle = -halfArc + (panel / panels) * halfArc * 2;
      const x = width / 2 + Math.sin(angle) * this.radius;
      const z = this.centreZ - Math.cos(angle) * this.radius;
      // Subtle side shading reveals the curve without adding scene lights that
      // would interfere with the puppets' existing two-tone rendering.
      const brightness = wall.b * (1 - 0.16 * Math.abs(Math.sin(angle)));
      if (!textured) fill(wall.h, wall.s, brightness);
      // Each strip shares its neighbour's UV so the grain continues across the curve.
      const u = panel / panels;
      vertex(x, this.floorY - this.wallHeight, z, u, 0);
      vertex(x, this.floorY, z, u, 1);
    }
    endShape();
    pop();
  }
}
