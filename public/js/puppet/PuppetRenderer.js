// Draws the current pose of any puppet on the WebGL stage. During setup it reads
// the model catalogue and loads each required OBJ mesh once. At draw time it
// uses the puppet's colours, turns the head and sleeves about their pivots, and
// applies the two-tone shader. Sharing this renderer lets the whole cast reuse
// geometry while each Puppet supplies its own costume and pose.

class PuppetRenderer {
  // Load the stage's one material and the mesh pieces used by this cast.
  async load() {
    this.material = await loadShader('js/puppet/two-tone.vert', 'js/puppet/two-tone.frag');
    this.models = await loadJSON('assets/puppet-models.json');
    // Multiple models can share a mesh, so load each OBJ path once.
    const paths = new Set();
    for (const regions of Object.values(this.models)) {
      for (const pieces of Object.values(regions)) {
        for (const path of pieces) paths.add(path);
      }
    }
    this.meshes = new Map();
    await Promise.all([...paths].map(async path => {
      this.meshes.set(path, await loadModel('assets/' + path));
    }));
  }

  // Place the glove by its hem. The original 390 mm model appears 215 pixels tall.
  draw(puppet) {
    push();
    translate(puppet.x, puppet.y, puppet.z);
    // A small lift on each step gives a travelling glove puppet a walking rhythm.
    translate(0, -3 * Math.abs(Math.sin(puppet.walkPhase)));
    rotateY(radians(puppet.bodyTurn));
    scale(0.55);
    shader(this.material);
    const pose = puppet.expression.pose;
    // Hold the torso steady during contact so the two hands keep their marks.
    if (!puppet.gestureArm) {
      translate(0, pose.bobOffset);
      rotateX(radians(-pose.lean));
      rotateZ(radians(pose.swayAngle));
    }
    const left = puppet.gestureArm === 'left' ? puppet.gestureArmLiftDegrees : pose.left;
    const right = puppet.gestureArm === 'right' ? puppet.gestureArmLiftDegrees : pose.right;
    this.drawPart(puppet.body, left, right);
    // Rotate around the exported neck, 185 mm above the hem.
    translate(0, -185);
    const side = puppet.lookTarget ? Math.sign(puppet.lookTarget.x - puppet.x) : 0;
    rotateY(radians(18 * side));
    rotateX(radians(-pose.nod));
    rotateZ(radians(pose.tilt));
    translate(0, 185);
    this.drawPart(puppet.head);
    resetShader();
    pop();
  }

  // Read each material region from character JSON. p5 converts the authored HSB
  // to the RGB fractions the shader needs; thread keeps its unlit cream colour.
  drawPart(part, left = 0, right = 0) {
    for (const [region, pieces] of Object.entries(this.models[part.model])) {
      const { h, s, b } = part.materials[region];
      const tint = color(h, s, b);
      this.material.setUniform('uColour', [red(tint), green(tint), blue(tint)].map(channel => channel / 255));
      this.material.setUniform('uThread', region === 'thread' ? 1 : 0);
      for (const path of pieces) {
        push();
        if (path.includes('arm-left') || path.includes('arm-right')) {
          // Swing each sleeve and its stitches about the same exported shoulder.
          const side = path.includes('arm-left') ? -1 : 1;
          const lift = side === -1 ? left : right;
          translate(side * 62, -160);
          rotateZ(radians(-side * lift));
          translate(-side * 62, 160);
        }
        model(this.meshes.get(path));
        pop();
      }
    }
  }
}
