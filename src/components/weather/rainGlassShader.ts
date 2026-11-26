/**
 * Procedural WebGL2 refractive rain-on-glass shader inspired by
 * Martijn Steinrucken's "Heartfelt" technique & SardineFish/raindrop-fx.
 *
 * All dynamic droplets nucleate in place and slide monotonically downward
 * with stick-slip gravity acceleration (never moving upward), carving curved
 * wet trails and leaving stationary micro-beads with physical 3D dome refraction.
 */

export const RAIN_GLASS_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const RAIN_GLASS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_rainWeight;
uniform float u_intensity;

vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

float N(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}

float Saw(float b, float t) {
  return smoothstep(0.0, b, t) * smoothstep(1.0, b, t);
}

float trackXAt(float py, float baseX, float seed, float freq) {
  return baseX + sin(py * freq + seed * 6.2831853) * 0.095 * (0.45 - abs(baseX));
}

vec2 DropLayerDown(vec2 uv, float t) {
  vec2 a = vec2(6.0, 1.0);
  vec2 grid = a * 2.0;

  float colIdx = floor(uv.x * grid.x);
  uv.y += N(colIdx) * 0.85;

  vec2 id = floor(uv * grid);
  vec2 st = fract(uv * grid);
  st.x -= 0.5;

  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  float baseX = (n.x - 0.5) * 0.68;
  float freq = 11.0 + n.y * 6.5;

  // Per-cell lifecycle: grow in place (0..0.14), strictly downward stick-slip (0.14..0.90), fade (0.86..1.0)
  float ti = fract(t * 0.42 + n.z);
  float grow = smoothstep(0.0, 0.14, ti);
  float fadeOut = smoothstep(1.0, 0.86, ti);

  float u = clamp((ti - 0.14) / 0.76, 0.0, 1.0);
  float slip = u - (0.76 / (4.0 * 3.14159265)) * sin(u * 4.0 * 3.14159265);
  float slide = mix(slip, slip * slip, 0.32);
  float y = mix(0.88, 0.06, slide);

  float xDrop = trackXAt(y, baseX, n.y, freq);
  float dDrop = length(vec2(st.x - xDrop, (st.y - y) * 5.2));
  float mainDrop = smoothstep(0.36 * grow, 0.0, dDrop) * grow * fadeOut;

  // Curved stationary wake & trailing micro-droplets left above current drop position
  float wakeX = trackXAt(st.y, baseX, n.y, freq);
  float trailFront = smoothstep(-0.016, 0.016, st.y - y) * smoothstep(0.91, 0.86, st.y);
  float progressMask = smoothstep(0.12, 0.24, ti) * fadeOut;
  float cd = abs(st.x - wakeX);
  float trail = smoothstep(0.22, 0.08, cd) * trailFront * progressMask;

  float beadSlot = floor(st.y * 8.0);
  float beadPresent = step(0.42, N(id.x * 19.3 + id.y * 173.1 + beadSlot * 7.7));
  float beadCellY = (fract(st.y * 8.0) - 0.5) / 8.0;
  float beadD = length(vec2(st.x - wakeX, beadCellY * 6.0));
  float droplets = smoothstep(0.21, 0.0, beadD) * beadPresent * trailFront * progressMask;

  float m = max(mainDrop, droplets * 0.82);
  return vec2(m, trail);
}

float StaticDrops(vec2 uv, float t) {
  uv *= 38.0;
  vec2 id = floor(uv);
  uv = fract(uv) - 0.5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - 0.5) * 0.7;
  float d = length(uv - p);

  float fade = Saw(0.025, fract(t + n.z));
  float c = smoothstep(0.28, 0.0, d) * fract(n.z * 10.0) * fade;
  return c;
}

vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayerDown(uv, t) * l1;
  vec2 m2 = DropLayerDown(uv * 1.58 + vec2(0.47, 0.33), t * 0.82 + 11.3) * l2;

  float c = s + m1.x + m2.x;
  c = smoothstep(0.32, 1.0, c);
  return vec2(c, max(m1.y * l0, m2.y * l1));
}

void main() {
  float rainAmt = clamp(u_rainWeight, 0.0, 1.0);
  if (rainAmt <= 0.005) {
    outColor = texture(u_scene, v_uv);
    return;
  }

  float inten = clamp(u_intensity, 0.35, 1.5);
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  vec2 uv = (v_uv - 0.5) * vec2(aspect, 1.0);

  float T = u_time * 0.24;
  float staticLayer = smoothstep(-0.2, 0.85, rainAmt * inten) * 1.45;
  float layer1 = smoothstep(0.08, 0.9, rainAmt * inten);
  float layer2 = smoothstep(0.0, 0.95, rainAmt * inten) * 1.1;

  vec2 c = Drops(uv, T, staticLayer, layer1, layer2);

  // Analytical 3D dome normals via finite differences
  vec2 e = vec2(0.0012, 0.0);
  float cx = Drops(uv + e, T, staticLayer, layer1, layer2).x;
  float cy = Drops(uv + e.yx, T, staticLayer, layer1, layer2).x;
  vec2 n = vec2(cx - c.x, cy - c.x);

  // Refracted background sampling with subtle chromatic dispersion
  float refractScale = mix(0.28, 0.52, rainAmt);
  vec2 refUv = clamp(v_uv - n * refractScale, vec2(0.002), vec2(0.998));
  vec2 disp = n * (0.045 * rainAmt);

  float rCh = texture(u_scene, clamp(refUv - disp, vec2(0.001), vec2(0.999))).r;
  float gCh = texture(u_scene, refUv).g;
  float bCh = texture(u_scene, clamp(refUv + disp, vec2(0.001), vec2(0.999))).b;
  vec3 col = vec3(rCh, gCh, bCh);

  // Subtle condensation haze outside wet trails & droplets, crystal-clear inside
  float clearMask = clamp(c.x * 1.2 + c.y * 0.95, 0.0, 1.0);
  float blurAmt = (1.0 - clearMask) * 0.0038 * rainAmt;
  if (blurAmt > 0.0002) {
    vec3 blurAcc = col * 0.36;
    blurAcc += texture(u_scene, clamp(v_uv + vec2( blurAmt,  blurAmt * 0.8), vec2(0.001), vec2(0.999))).rgb * 0.16;
    blurAcc += texture(u_scene, clamp(v_uv + vec2(-blurAmt,  blurAmt * 0.8), vec2(0.001), vec2(0.999))).rgb * 0.16;
    blurAcc += texture(u_scene, clamp(v_uv + vec2( blurAmt, -blurAmt * 0.8), vec2(0.001), vec2(0.999))).rgb * 0.16;
    blurAcc += texture(u_scene, clamp(v_uv + vec2(-blurAmt, -blurAmt * 0.8), vec2(0.001), vec2(0.999))).rgb * 0.16;
    col = mix(col, blurAcc, 0.65);
  }

  // Subtle Fresnel rim specular highlight & lower meniscus contrast from 3D dome normal
  float rimLight = clamp(dot(normalize(vec3(n * 18.0, 1.0)), normalize(vec3(-0.45, 0.72, 0.52))), 0.0, 1.0);
  float spec = pow(rimLight, 6.0) * smoothstep(0.04, 0.35, length(n)) * rainAmt;
  float edgeShadow = clamp(-n.y * 3.2, 0.0, 0.14) * rainAmt;

  col = col * (1.0 - edgeShadow) + vec3(0.86, 0.94, 1.0) * (spec * 0.32);

  outColor = vec4(col, 1.0);
}
`;

export interface RainGlassRenderer {
  resize: (width: number, height: number, dpr: number) => void;
  render: (
    sourceCanvas: HTMLCanvasElement,
    timeSec: number,
    rainWeight: number,
    intensity: number,
  ) => void;
  dispose: () => void;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createRainGlassRenderer(
  glCanvas: HTMLCanvasElement,
  powerPreference: WebGLPowerPreference = 'low-power',
): RainGlassRenderer | null {
  const gl = glCanvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference,
  });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, RAIN_GLASS_VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, RAIN_GLASS_FRAGMENT_SHADER);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const sceneTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sceneTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uScene = gl.getUniformLocation(program, 'u_scene');
  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uRainWeight = gl.getUniformLocation(program, 'u_rainWeight');
  const uIntensity = gl.getUniformLocation(program, 'u_intensity');

  let viewWidth = 1;
  let viewHeight = 1;

  const resize = (width: number, height: number, dprScale: number) => {
    const scale = Math.max(0.45, Math.min(2.0, dprScale));
    viewWidth = Math.max(1, Math.floor(width * scale));
    viewHeight = Math.max(1, Math.floor(height * scale));
    glCanvas.width = viewWidth;
    glCanvas.height = viewHeight;
    gl.viewport(0, 0, viewWidth, viewHeight);
  };

  const render = (
    sourceCanvas: HTMLCanvasElement,
    timeSec: number,
    rainWeight: number,
    intensity: number,
  ) => {
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

    gl.uniform1i(uScene, 0);
    gl.uniform2f(uResolution, viewWidth, viewHeight);
    gl.uniform1f(uTime, timeSec);
    gl.uniform1f(uRainWeight, rainWeight);
    gl.uniform1f(uIntensity, intensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const dispose = () => {
    gl.deleteTexture(sceneTex);
    gl.deleteBuffer(buf);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };

  return { resize, render, dispose };
}
