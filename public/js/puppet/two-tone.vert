#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
out vec3 vNormal;
out vec3 vPosition;
void main() {
    vec4 position = uModelViewMatrix * vec4(aPosition, 1.0);
    vNormal = normalize(uNormalMatrix * aNormal);
    vPosition = position.xyz;
    gl_Position = uProjectionMatrix * position;
}
