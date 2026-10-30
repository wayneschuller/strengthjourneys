// GLSL for the two WebGL strength hexagon views. Both are a single full-screen
// fragment shader with no geometry: every pixel casts a ray from the camera in
// hexagon-model.js and works out what it sees analytically. That keeps the
// whole effect dependency-free (no three.js) and lets the glow be computed per
// pixel instead of faked with a bloom pass.
//
// The scene: a floor at y = 0 carrying the tier rings, the six axis spokes and
// a radar sweep, and above it the athlete's shape. The hologram stacks the
// shape in translucent slices to make a glowing prism; the crystal raymarches
// a faceted gem whose girdle is the shape, so each facet belongs to one axis.

import { HEXAGON_AXES } from "@/components/strength-hexagon/hexagon-model";

const COMMON = /* glsl */ `#version 300 es
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
uniform vec3 uBg;
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

// Each axis gets its own hue, drifting between the palette's core and accent.
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

// The floor: tier rings, axis spokes, a dot grid and a radar sweep, plus a
// pool of light cast by the shape above.
vec3 floorLayer(vec3 ro, vec3 rd) {
  if (rd.y >= -0.0001) return vec3(0.0);
  float t = -ro.y / rd.y;
  vec2 q = (ro + rd * t).xz;
  float r = length(q);
  float fade = exp(-max(r - 1.05, 0.0) * 3.0);
  float hn = ringNorm(q);

  float rings = 0.0;
  for (int k = 0; k < 4; k++) {
    float w = 0.0035 + 0.0015 * float(k);
    rings += exp(-abs(hn - uRings[k]) / w) * (0.3 + 0.2 * float(k));
  }
  float frame = exp(-abs(hn - 1.08) / 0.0025) * 0.45;

  float spokes = 0.0;
  for (int i = 0; i < AXES; i++) {
    vec2 d = axisDir(i);
    float along = dot(q, d);
    float perp = abs(d.x * q.y - d.y * q.x);
    float on = smoothstep(-0.02, 0.02, along) * smoothstep(1.07, 1.0, along);
    spokes += exp(-perp / 0.0035) * on * mix(0.25, 1.0, uTested[i]);
  }

  float ang = atan(q.x, q.y);
  float sweepAngle = mod(uTime * 0.7, TAU) - PI;
  float da = mod(sweepAngle - ang + 2.0 * TAU, TAU);
  float sweep = exp(-da * 2.5) * step(hn, 1.0) * uSweep;

  vec2 cell = fract(q * 18.0) - 0.5;
  float dots = exp(-dot(cell, cell) * 140.0) * 0.22 * step(hn, 1.0);

  float sd = sdPoly(q);
  float pool = exp(-max(sd, 0.0) * 9.0) * (sd < 0.0 ? 0.5 : 0.35);

  vec3 c = uEdge * (rings * 0.5 + frame * 0.55);
  c += uCore * spokes * 0.45;
  c += uCore * dots * (0.35 + 2.5 * sweep);
  c += uAccent * sweep * (0.06 + rings * 1.6 + spokes * 1.2);
  c += uCore * pool * 0.3;
  return c * fade;
}

// A glowing beacon on a vertex, with an anamorphic streak that grows into a
// full star once the axis passes the elite ring.
vec3 beacon(vec3 ro, vec3 rd, vec2 uv, vec3 p, float value, float tested, float phase) {
  float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + phase);
  float size = mix(0.01, 0.026, value) * pulse;
  vec3 c = mix(uEdge, vec3(1.0), 0.5) * pointGlow(ro, rd, p, size) * tested;
  vec2 d = uv - projectToScreen(p);
  float streak = exp(-abs(d.y) * 260.0) * exp(-abs(d.x) * 9.0);
  float elite = smoothstep(0.93, 0.99, value);
  float vertical = exp(-abs(d.x) * 260.0) * exp(-abs(d.y) * 12.0) * elite;
  c += mix(uCore, uEdge, 0.5) * (streak * (0.12 + 0.5 * elite) + vertical * 0.5) * tested * pulse;
  return c;
}

vec3 backdrop(vec2 uv) {
  vec3 col = uBg;
  col += uCore * 0.06 * exp(-dot(uv, uv) * 1.2);
  vec2 top = uv - vec2(0.0, 0.7);
  col += uAccent * 0.035 * exp(-dot(top, top) * 2.0);
  return col;
}

vec3 finish(vec3 col, vec2 uv) {
  col = vec3(1.0) - exp(-col * 1.35);
  col *= 1.0 - 0.25 * dot(uv * 0.55, uv * 0.55);
  col += (hash12(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * (2.0 / 255.0);
  return col;
}
`;

export const HOLOGRAM_FRAGMENT = `${COMMON}
// The shape sliced into translucent layers from the floor to uHeight. Adding
// them together reads as a solid of light, brightest at its edges.
vec3 prismLayers(vec3 ro, vec3 rd) {
  vec3 c = vec3(0.0);
  if (abs(rd.y) < 1e-4) return c;
  const int N = 16;
  for (int k = 0; k < N; k++) {
    float fk = float(k) / float(N - 1);
    float t = (uHeight * fk - ro.y) / rd.y;
    if (t <= 0.0) continue;
    vec2 q = (ro + rd * t).xz;
    float sd = sdPoly(q);
    float inside = smoothstep(0.003, -0.003, sd);
    float edge = exp(-abs(sd) / 0.005);
    vec3 hue = axisHue(atan(q.x, q.y) / TAU + uTime * 0.03);
    float scan = 0.55 + 0.45 * sin(fk * 40.0 - uTime * 4.0);
    c += hue * inside * 0.022 * scan;
    c += mix(hue, uEdge, 0.6) * edge * (0.035 + 0.05 * fk);
    if (k == N - 1) {
      float contour = smoothstep(0.82, 1.0, 0.5 + 0.5 * sin(-sd * 30.0 + uTime * 1.6));
      c += hue * inside * (0.07 + 0.1 * contour);
      c += uEdge * edge * 0.9;
      c += uEdge * exp(-abs(sd) / 0.02) * 0.16;
      c += mix(hue, uEdge, 0.4) * exp(-max(sd, 0.0) / 0.07) * 0.07;
    }
  }
  return c;
}

vec3 pillars(vec3 ro, vec3 rd, vec2 uv) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < AXES; i++) {
    vec3 base = vec3(uVerts[i].x, 0.0, uVerts[i].y);
    vec3 top = base + vec3(0.0, uHeight, 0.0);
    float d = raySegment(ro, rd, base, top);
    float tested = uTested[i];
    c += uEdge * exp(-d / 0.0035) * mix(0.15, 0.8, tested);
    c += mix(uCore, uEdge, 0.3) * exp(-d / 0.02) * 0.08 * tested;
    c += beacon(ro, rd, uv, top, uVals[i], tested, float(i));
  }
  return c;
}

// Motes of light drifting up out of the shape.
vec3 motes(vec3 ro, vec3 rd) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    float a = hash11(fi * 7.31 + 0.5) * TAU;
    vec2 dir = vec2(sin(a), cos(a));
    vec3 e = sectorEdge(dir);
    float rho = e.z / max(dot(dir, e.xy), 0.05);
    float rad = rho * sqrt(hash11(fi * 3.17 + 1.3)) * 0.92;
    float life = fract(uTime * (0.05 + 0.06 * hash11(fi * 1.91)) + hash11(fi * 5.7));
    vec3 p = vec3(dir.x * rad, life * (uHeight + 0.6), dir.y * rad);
    vec3 tint = mix(uEdge, uCore, hash11(fi * 9.1));
    c += tint * pointGlow(ro, rd, p, 0.0055) * sin(life * PI) * 0.7;
  }
  return c;
}

void main() {
  vec2 uv = screenUv();
  vec3 ro = uCamPos;
  vec3 rd = cameraRay(uv);
  vec3 col = backdrop(uv);
  col += floorLayer(ro, rd);
  col += prismLayers(ro, rd);
  col += pillars(ro, rd, uv);
  col += motes(ro, rd);
  fragColor = vec4(finish(col, uv), 1.0);
}
`;

export const CRYSTAL_FRAGMENT = `${COMMON}
uniform float uGemY;
uniform float uGemHalf;

// The table (the flat top) sits at this fraction of the crown height, and the
// pavilion below the girdle runs deeper than the crown, like a cut stone.
#define TABLE 0.5
#define PAVILION 1.55

// A cut gem over the athlete's polygon: a crown rising from the girdle to a
// flat table, and a pavilion falling to a point. Within one sector every facet
// is a plane, so the distance to that plane is the distance estimate.
float facetDist(vec3 p) {
  vec3 e = sectorEdge(p.xz);
  float invC = 1.0 / e.z;
  float y = p.y - uGemY;
  float h = y >= 0.0 ? uGemHalf : uGemHalf * PAVILION;
  float f = dot(p.xz, e.xy) * invC + abs(y) / h - 1.0;
  return f / sqrt(invC * invC + 1.0 / (h * h));
}

float gemDist(vec3 p) {
  return max(facetDist(p), p.y - uGemY - uGemHalf * TABLE);
}

vec3 gemNormal(vec3 p) {
  if (p.y - uGemY - uGemHalf * TABLE > facetDist(p) - 0.0005) return vec3(0.0, 1.0, 0.0);
  vec3 e = sectorEdge(p.xz);
  float invC = 1.0 / e.z;
  float y = p.y - uGemY;
  float h = y >= 0.0 ? uGemHalf : uGemHalf * PAVILION;
  return normalize(vec3(e.x * invC, (y >= 0.0 ? 1.0 : -1.0) / h, e.y * invC));
}

// A dark studio with three soft boxes circling it. The boxes are what make the
// facets flash as the camera orbits.
vec3 studio(vec3 d) {
  float a = atan(d.x, d.z);
  vec3 c = mix(uBg * 2.0, uBg * 4.0 + uCore * 0.05, smoothstep(-0.3, 0.8, d.y));
  for (int k = 0; k < 3; k++) {
    float la = float(k) * 2.0944 + uTime * 0.25;
    float band = smoothstep(0.93, 0.995, cos(a - la));
    band *= smoothstep(-0.05, 0.25, d.y) * smoothstep(0.95, 0.6, d.y);
    c += vec3(1.0) * band * 1.6;
  }
  c += uCore * smoothstep(0.25, 0.0, abs(d.y + 0.05)) * 0.35;
  c += mix(uCore, uEdge, 0.3) * smoothstep(0.0, -0.7, d.y) * 0.45;
  c += uAccent * smoothstep(0.6, 1.0, d.y) * 0.25;
  return c;
}

bool marchGem(vec3 ro, vec3 rd, int steps, out float tHit, out float minD) {
  minD = 1e9;
  tHit = 0.0;
  vec3 oc = ro - vec3(0.0, uGemY, 0.0);
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - 1.2 * 1.2);
  if (h < 0.0) return false;
  h = sqrt(h);
  float t = max(-b - h, 0.0);
  float tEnd = -b + h;
  for (int i = 0; i < 96; i++) {
    if (i >= steps || t > tEnd) break;
    float d = gemDist(ro + rd * t);
    minD = min(minD, d);
    if (d < 0.0012) {
      tHit = t;
      return true;
    }
    t += max(d * 0.7, 0.0015);
  }
  return false;
}

vec3 shadeGem(vec3 ro, vec3 rd, vec3 p, vec2 uv, bool detailed) {
  vec3 n = gemNormal(p);
  int sector = sectorOf(p.xz);
  vec3 hue = axisHue((float(sector) + 0.5) / float(AXES) + uTime * 0.02);
  float tested = 0.5 * (uTested[sector] + uTested[(sector + 1) % AXES]);

  vec3 lightDir = normalize(vec3(0.4, 0.9, -0.3));
  float fres = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
  vec3 refl = studio(reflect(rd, n));
  vec3 refr = vec3(
    studio(refract(rd, n, 1.0 / 1.5)).r,
    studio(refract(rd, n, 1.0 / 1.54)).g,
    studio(refract(rd, n, 1.0 / 1.58)).b
  );

  bool onTable = n.y > 0.999;
  vec3 e = sectorEdge(p.xz);
  float gauge = dot(p.xz, e.xy) / e.z;

  vec3 body = hue * (0.22 + 0.5 * pow(max(dot(n, lightDir), 0.0), 2.0));
  body += refr * mix(vec3(1.0), hue, 0.65) * 0.7;
  body += hue * 0.25 + uCore * pow(1.0 - gauge, 3.0) * (0.35 + 0.15 * sin(uTime * 1.7));

  vec3 col = mix(body, refl, 0.12 + fres * 0.7);
  col += vec3(1.0) * pow(max(dot(reflect(rd, n), lightDir), 0.0), 80.0) * 1.4;

  if (onTable) {
    // The table is a window onto the shape: contours of it flow inward.
    float contour = smoothstep(0.8, 1.0, 0.5 + 0.5 * sin(gauge * 48.0 + uTime * 1.6));
    col += hue * contour * 0.35 + uEdge * exp(-abs(facetDist(p)) / 0.006) * 1.1;
  }

  if (detailed) {
    // Seams: the girdle and the ridges running from each vertex inward, with
    // light travelling along them.
    vec2 q = p.xz;
    float seam = exp(-abs(p.y - uGemY) / 0.007);
    if (!onTable) {
      for (int k = 0; k < 2; k++) {
        int i = (sector + k) % AXES;
        vec2 d = axisDir(i);
        seam += exp(-abs(d.x * q.y - d.y * q.x) / 0.006) * mix(0.3, 1.0, uTested[i]);
      }
    }
    float flow = 0.6 + 0.4 * sin(length(q) * 22.0 - uTime * 3.0);
    col += uEdge * seam * flow * mix(0.35, 1.0, tested) * 0.9;
  }

  float luma = dot(col, vec3(0.3, 0.5, 0.2));
  return mix(vec3(luma) * 0.6, col, mix(0.3, 1.0, tested));
}

void main() {
  vec2 uv = screenUv();
  vec3 ro = uCamPos;
  vec3 rd = cameraRay(uv);
  vec3 col = backdrop(uv);

  float tHit;
  float minD;
  bool hit = marchGem(ro, rd, 96, tHit, minD);
  if (hit) {
    col = shadeGem(ro, rd, ro + rd * tHit, uv, true);
  } else {
    col += mix(uCore, uAccent, 0.3) * exp(-minD * 7.0) * 0.4;
    col += floorLayer(ro, rd);
    // A glossy floor: a dim reflection of the gem under it.
    if (rd.y < 0.0) {
      vec3 fp = ro + rd * (-ro.y / rd.y);
      vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
      float tr;
      float md;
      if (marchGem(fp, rr, 48, tr, md)) {
        vec3 reflected = shadeGem(fp, rr, fp + rr * tr, uv, false);
        col += reflected * 0.22 * exp(-length(fp.xz) * 0.8);
      } else {
        col += mix(uCore, uAccent, 0.3) * exp(-md * 7.0) * 0.12;
      }
    }
  }

  for (int i = 0; i < AXES; i++) {
    vec3 v = vec3(uVerts[i].x, uGemY, uVerts[i].y);
    col += beacon(ro, rd, uv, v, uVals[i], uTested[i], float(i));
  }

  fragColor = vec4(finish(col, uv), 1.0);
}
`;
