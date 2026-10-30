// A minimal WebGL2 runner for a full-screen fragment shader: one oversized
// triangle, a program, and cached uniform locations. Returns null when WebGL2
// or the shader is unavailable, so callers can fall back to the SVG view.

import { devLog } from "@/lib/processing-utils";

const VERTEX_SOURCE = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    devLog(`Strength hexagon shader error: ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createHexagonRenderer(canvas, fragmentSource) {
  // The canvas is transparent (premultiplied) so the theme background shows
  // through. preserveDrawingBuffer lets the image export read the canvas at
  // any moment instead of racing the next animation frame.
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    devLog(`Strength hexagon link error: ${gl.getProgramInfoLog(program)}`);
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positionLocation = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const locations = new Map();
  const locationOf = (name) => {
    if (!locations.has(name)) {
      locations.set(name, gl.getUniformLocation(program, name));
    }
    return locations.get(name);
  };

  return {
    // Uniform values: a number is a float, an array of 2 or 3 numbers a vec,
    // and { type, data } covers the float and vec2 arrays.
    draw(width, height, uniforms) {
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      for (const [name, value] of Object.entries(uniforms)) {
        const location = locationOf(name);
        if (!location) continue;
        if (typeof value === "number") gl.uniform1f(location, value);
        else if (value.type === "float[]") gl.uniform1fv(location, value.data);
        else if (value.type === "vec2[]") gl.uniform2fv(location, value.data);
        else if (value.length === 2) gl.uniform2fv(location, value);
        else if (value.length === 3) gl.uniform3fv(location, value);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // The context itself is left alone: React's development double-mount
    // reuses this canvas, and a lost context cannot be recovered.
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
