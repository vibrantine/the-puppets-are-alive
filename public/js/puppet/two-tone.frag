#version 300 es
precision highp float;
uniform vec3 uColour;
uniform float uThread;
in vec3 vNormal;
in vec3 vPosition;
out vec4 finalColour;
void main() {
    vec3 normal = normalize(vNormal);
    float light = dot(normal, normalize(vec3(-0.4, -0.6, 1.0)));
    // Derivative-aware two-level ramp, inspired by three.js's default toon
    // gradient (see THIRD_PARTY.md); this is not its separate OutlineEffect.
    float width = max(0.0001, 0.5 * fwidth(light));
    float shade = mix(0.7, 1.0, smoothstep(0.4 - width, 0.4 + width, light));
    float edge = abs(dot(normal, normalize(-vPosition)));
    float edgeWidth = max(0.0001, fwidth(edge));
    vec3 surface = mix(vec3(0.055, 0.06, 0.09), uColour * shade,
        smoothstep(0.24 - edgeWidth, 0.24 + edgeWidth, edge));
    // Cream stitching is an independent unlit material, without dark contour
    // bands. Depth testing stays enabled; no overlay hides mesh intersections.
    finalColour = vec4(uThread > 0.5 ? uColour : surface, 1.0);
}
