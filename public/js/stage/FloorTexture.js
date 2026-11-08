// Paints a wooden floor once into a p5 offscreen canvas. StageBackdrop maps this
// image onto its existing floor; boards do not need separate 3D geometry.
// The scene supplies an HSB palette. All variation is deterministic and local,
// so creating scenery never changes the show's random murderer selection.
class FloorTexture {
  static create(colour) {
    const image = createGraphics(1536, 1024);
    image.pixelDensity(1);
    image.colorMode(HSB, 360, 100, 100);
    image.background(colour.h, colour.s, colour.b * 0.65);
    const boardWidth = 128;
    const boardLength = 340;

    // Columns run from the far wall towards the audience. Offset each column's
    // end joints so perspective shows timber lengths rather than a square grid.
    for (let column = 0; column < 12; column++) {
      const jointOffset = (column * 137) % boardLength;
      for (let row = -1; row < 4; row++) {
        const x = column * boardWidth;
        const y = row * boardLength + jointOffset;
        const variation = Math.sin(column * 9.3 + row * 5.7);
        const brightness = colour.b + variation * 3;
        image.noStroke();
        image.fill(colour.h + variation, colour.s, brightness);
        image.rect(x + 1, y + 1, boardWidth - 2, boardLength - 2);
        // A restrained edge highlight keeps the seams soft and painted.
        image.stroke(colour.h, colour.s * 0.8, brightness + 4);
        image.strokeWeight(1);
        image.line(x + 3, y + 3, x + 3, y + boardLength - 3);

        // Sparse, broken grain follows the board, never crossing its joints.
        // Small waves read as handmade wood without competing with stitching.
        for (let grain = 0; grain < 8; grain++) {
          const grainX = x + 12 + grain * 14;
          const startY = y + 12 + ((grain * 47 + column * 19) % 100);
          const length = 110 + ((grain * 31 + column * 23) % 160);
          image.stroke(colour.h, colour.s + 3, brightness - 5, 0.45);
          image.noFill();
          image.beginShape();
          for (let step = 0; step <= 12; step++) {
            const grainY = Math.min(startY + step * length / 12, y + boardLength - 12);
            image.vertex(grainX + Math.sin(step * 0.5 + column + grain) * 2, grainY);
          }
          image.endShape();
        }
      }
    }
    const texture = image.get();
    image.remove(); // Keep the pixels, release the temporary canvas.
    return texture;
  }
}
