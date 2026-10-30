// GLSL for the WebGL strength shape. It is a single full-screen fragment
// shader with no geometry: every pixel casts a ray from the camera in
// hexagon-model.js and works out what it sees analytically. That keeps the
// effect dependency-free (no three.js) and lets the glow be computed per pixel
// instead of faked with a bloom pass.
//
// The scene: a floor at y = 0 carrying the tier rings, the axis spokes and a
// slow radar sweep, and above it the athlete's shape stacked in translucent
// slices to make a glowing prism.
//
// The canvas is transparent so the theme's own background shows through. The
// scene is gathered as two layers, crisp lines and soft coloured glow, so a
// light theme can draw the lines as ink and the glow as a tint while a dark
// theme draws both as light.

import { HEXAGON_AXES } from "@/components/strength-hexagon/hexagon-model";

export const HOLOGRAM_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
#define AXES ${HEXAGON_AXES.length}
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamFwd;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uFocal;
uniform vec2 uVerts[AXES];
uniform float uVals[AXES];
uniform float uTested[AXES];
uniform float uRings[4];
uniform vec3 uCore;
uniform vec3 uEdge;
uniform vec3 uAccent;
uniform vec3 uLine;
uniform vec3 uSpark;
uniform float uLight;
uniform float uHeight;
uniform float uSweep;

#define PI 3.14159265
#define TAU 6.28318531
#define SECTOR (TAU / float(AXES))

vec2 screenUv() {
  return (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
}

vec3 cameraRay(vec2 uv) {
  return normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);
}

vec2 projectToScreen(vec3 p) {
  vec3 d = p - uCamPos;
  float z = max(dot(d, uCamFwd), 0.0001);
  return vec2(dot(d, uCamRight), dot(d, uCamUp)) / z * uFocal;
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 axisDir(int i) {
  float a = float(i) * SECTOR;
  return vec2(sin(a), cos(a));
}

// Signed distance to the athlete's polygon on the floor plane.
float sdPoly(vec2 p) {
  float d = dot(p - uVerts[0], p - uVerts[0]);
  float s = 1.0;
  for (int i = 0; i < AXES; i++) {
    int j = (i + AXES - 1) % AXES;
    vec2 e = uVerts[j] - uVerts[i];
    vec2 w = p - uVerts[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= uVerts[i].y, p.y < uVerts[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s *= -1.0;
  }
  return s * sqrt(d);
}

// Radius of p measured as a regular polygon whose vertices sit on the axes,
// so a tier ring of radius R is the set where ringNorm(p) == R.
float ringNorm(vec2 p) {
  float m = -1e9;
  for (int k = 0; k < AXES; k++) {
    float a = float(k) * SECTOR + SECTOR * 0.5;
    m = max(m, dot(p, vec2(sin(a), cos(a))));
  }
  return m / cos(SECTOR * 0.5);
}

int sectorOf(vec2 p) {
  float a = atan(p.x, p.y);
  if (a < 0.0) a += TAU;
  return min(int(a / SECTOR), AXES - 1);
}

// Outward normal (xy) and offset (z) of the shape edge in the sector holding p.
vec3 sectorEdge(vec2 p) {
  int i = sectorOf(p);
  vec2 A = uVerts[i];
  vec2 B = uVerts[(i + 1) % AXES];
  vec2 e = B - A;
  vec2 n = normalize(vec2(e.y, -e.x));
  if (dot(n, A) < 0.0) n = -n;
  return vec3(n, dot(n, A));
}

// The theme's two chart colours, drifting around the shape.
vec3 axisHue(float t) {
  return mix(uCore, uAccent, 0.5 + 0.5 * sin(t * TAU));
}

// Soft point light seen along a ray: 1 at the centre, falling off as size^2/d^2.
float pointGlow(vec3 ro, vec3 rd, vec3 p, float size) {
  float t = max(dot(p - ro, rd), 0.0);
  vec3 c = ro + rd * t - p;
  float s2 = size * size;
  return s2 / (dot(c, c) + s2);
}

float raySegment(vec3 ro, vec3 rd, vec3 a, vec3 b) {
  vec3 ba = b - a;
  vec3 oa = ro - a;
  float bb = dot(ba, ba);
  float br = dot(ba, rd);
  float den = bb - br * br;
  float s = den > 1e-5 ? clamp((dot(ba, oa) - br * dot(rd, oa)) / den, 0.0, 1.0) : 0.0;
  vec3 q = a + ba * s;
  float t = max(dot(q - ro, rd), 0.0);
  return length(ro + rd * t - q);
}

// Two layers are gathered as the scene is traced: L, crisp lines (rings,
// spokes, the prism's edges) as a single intensity, and G, soft coloured light
// (fills, glows, beacons, motes). finish() composes them for the theme.
float L;
vec3 G;

// The floor: tier rings, axis spokes, a faint dot grid and a slow sweep, plus
// a pool of light cast by the shape above.
void floorLayer(vec3 ro, vec3 rd) {
  if (rd.y >= -0.0001) return;
  float t = -ro.y / rd.y;
  vec2 q = (ro + rd * t).xz;
  float r = length(q);
  float fade = exp(-max(r - 1.05, 0.0) * 3.0);
  float rn = ringNorm(q);

  float rings = 0.0;
  for (int k = 0; k < 4; k++) {
    float w = 0.0035 + 0.0012 * float(k);
    rings += exp(-abs(rn - uRings[k]) / w) * (0.3 + 0.15 * float(k));
  }
  float frame = exp(-abs(rn - 1.08) / 0.0025) * 0.4;

  float spokes = 0.0;
  for (int i = 0; i < AXES; i++) {
    vec2 d = axisDir(i);
    float along = dot(q, d);
    float perp = abs(d.x * q.y - d.y * q.x);
    float on = smoothstep(-0.02, 0.02, along) * smoothstep(1.08, 1.0, along);
    spokes += exp(-perp / 0.0035) * on * mix(0.25, 1.0, uTested[i]);
  }

  float ang = atan(q.x, q.y);
  float sweepAngle = mod(uTime * 0.35, TAU) - PI;
  float da = mod(sweepAngle - ang + 2.0 * TAU, TAU);
  float sweep = exp(-da * 3.0) * step(rn, 1.0) * uSweep * 0.5;

  vec2 cell = fract(q * 18.0) - 0.5;
  float dots = exp(-dot(cell, cell) * 160.0) * 0.12 * step(rn, 1.0);

  float sd = sdPoly(q);
  float pool = exp(-max(sd, 0.0) * 9.0) * (sd < 0.0 ? 0.45 : 0.3);

  L += (rings * 0.5 + frame * 0.55 + spokes * 0.3) * fade;
  G += (uCore * (spokes * 0.15 + dots * (0.35 + 2.0 * sweep) + pool * 0.28)
    + uAccent * sweep * (0.05 + rings * 1.2 + spokes * 0.9)) * fade;
}

// The shape sliced into translucent layers from the floor to uHeight. Adding
// them together reads as a solid of light, brightest at its edges.
void prismLayers(vec3 ro, vec3 rd) {
  if (abs(rd.y) < 1e-4) return;
  const int N = 16;
  for (int k = 0; k < N; k++) {
    float fk = float(k) / float(N - 1);
    float t = (uHeight * fk - ro.y) / rd.y;
    if (t <= 0.0) continue;
    vec2 q = (ro + rd * t).xz;
    float sd = sdPoly(q);
    float inside = smoothstep(0.003, -0.003, sd);
    float edge = exp(-abs(sd) / 0.005);
    vec3 hue = axisHue(atan(q.x, q.y) / TAU + uTime * 0.015);
    float scan = 0.8 + 0.2 * sin(fk * 40.0 - uTime * 2.0);
    G += hue * (inside * 0.022 * scan + edge * 0.015);
    L += edge * (0.025 + 0.04 * fk);
    if (k == N - 1) {
      float contour = smoothstep(0.85, 1.0, 0.5 + 0.5 * sin(-sd * 30.0 + uTime * 0.8));
      G += hue * inside * (0.07 + 0.07 * contour);
      L += edge * 0.9;
      G += uEdge * exp(-abs(sd) / 0.02) * 0.14;
      G += mix(hue, uEdge, 0.4) * exp(-max(sd, 0.0) / 0.07) * 0.06;
    }
  }
}

// A glowing beacon on a vertex, with a short streak that grows into a full
// star once the axis passes the elite ring.
void beacon(vec3 ro, vec3 rd, vec2 uv, vec3 p, float value, float tested, float phase) {
  float pulse = 0.9 + 0.1 * sin(uTime * 1.8 + phase);
  float size = mix(0.01, 0.024, value) * pulse;
  G += uSpark * pointGlow(ro, rd, p, size) * tested;
  vec2 d = uv - projectToScreen(p);
  float streak = exp(-abs(d.y) * 280.0) * exp(-abs(d.x) * 11.0);
  float elite = smoothstep(0.93, 0.99, value);
  float vertical = exp(-abs(d.x) * 280.0) * exp(-abs(d.y) * 13.0) * elite;
  G += mix(uCore, uEdge, 0.5) * (streak * (0.08 + 0.4 * elite) + vertical * 0.4) * tested * pulse;
}

void pillars(vec3 ro, vec3 rd, vec2 uv) {
  for (int i = 0; i < AXES; i++) {
    vec3 base = vec3(uVerts[i].x, 0.0, uVerts[i].y);
    vec3 top = base + vec3(0.0, uHeight, 0.0);
    float d = raySegment(ro, rd, base, top);
    float tested = uTested[i];
    L += exp(-d / 0.0035) * mix(0.15, 0.8, tested);
    G += mix(uCore, uEdge, 0.3) * exp(-d / 0.02) * 0.06 * tested;
    beacon(ro, rd, uv, top, uVals[i], tested, float(i));
  }
}

// A few motes of light drifting up out of the shape.
void motes(vec3 ro, vec3 rd) {
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float a = hash11(fi * 7.31 + 0.5) * TAU;
    vec2 dir = vec2(sin(a), cos(a));
    vec3 e = sectorEdge(dir);
    float rho = e.z / max(dot(dir, e.xy), 0.05);
    float rad = rho * sqrt(hash11(fi * 3.17 + 1.3)) * 0.9;
    float life = fract(uTime * (0.03 + 0.04 * hash11(fi * 1.91)) + hash11(fi * 5.7));
    vec3 p = vec3(dir.x * rad, life * (uHeight + 0.5), dir.y * rad);
    vec3 tint = mix(uEdge, uCore, hash11(fi * 9.1));
    G += tint * pointGlow(ro, rd, p, 0.005) * sin(life * PI) * 0.45;
  }
}

// Output is premultiplied over a transparent canvas. On a dark theme lines
// and glow are both light. On a light theme the glow becomes a tint of its own
// hue and the lines are drawn over it in the line colour, like ink.
vec4 finish() {
  float dither = (hash12(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) / 255.0;
  if (uLight < 0.5) {
    vec3 lit = vec3(1.0) - exp(-(G + uLine * L) * 1.35);
    float alpha = clamp(max(max(lit.r, lit.g), lit.b) + dither, 0.0, 1.0);
    return vec4(min(lit, vec3(alpha)), alpha);
  }
  vec3 glow = vec3(1.0) - exp(-G * 1.6);
  float peak = max(max(glow.r, glow.g), glow.b);
  float glowAlpha = clamp(peak * 0.85 + dither, 0.0, 1.0);
  vec3 glowRgb = glow / max(peak, 1e-4) * glowAlpha;
  float lineAlpha = 1.0 - exp(-L * 2.2);
  return vec4(uLine * lineAlpha + glowRgb * (1.0 - lineAlpha), lineAlpha + glowAlpha * (1.0 - lineAlpha));
}

void main() {
  vec2 uv = screenUv();
  vec3 ro = uCamPos;
  vec3 rd = cameraRay(uv);
  L = 0.0;
  G = uCore * 0.035 * exp(-dot(uv, uv) * 1.6);
  floorLayer(ro, rd);
  prismLayers(ro, rd);
  pillars(ro, rd, uv);
  motes(ro, rd);
  fragColor = finish();
}
`;
