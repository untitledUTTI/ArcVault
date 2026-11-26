import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
  SKY_FRAGMENT_SHADER,
  SKY_VERTEX_SHADER,
  resolveMoodIndex,
} from './celestialShaders';
import { createCelestialCpuRenderer } from './celestialCpuRenderer';
import {
  applyMobilePowerBudget,
  createAutoFallbackWatchdog,
  detectWebGL2Capability,
  getRenderQualityProfile,
  resolveInitialRenderBackend,
} from '../../core/renderEngine';
import {
  attachBackgroundMotionController,
} from '../../platform/backgroundMotion';
import type {
  ActiveRenderBackend,
  CelestialSettings,
  GyroscopeSettings,
  RenderBackendStatus,
} from '../../types/archive';

interface CelestialCanvasProps {
  settings: CelestialSettings;
  isMobileOrTablet?: boolean;
  prefersReducedMotion?: boolean;
  gyroscope?: GyroscopeSettings;
  onBackendStatusChange?: (status: RenderBackendStatus) => void;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSrc: string,
  fsSrc: string,
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

interface StarNode {
  id: number;
  xPct: number;
  yPct: number;
  r: number;
}

const CONSTELLATION_STARS: StarNode[] = [
  { id: 0, xPct: 12, yPct: 16, r: 2.1 },
  { id: 1, xPct: 21, yPct: 11, r: 1.6 },
  { id: 2, xPct: 29, yPct: 21, r: 2.3 },
  { id: 3, xPct: 38, yPct: 13, r: 1.7 },
  { id: 4, xPct: 48, yPct: 19, r: 2.0 },
  { id: 5, xPct: 57, yPct: 10, r: 2.4 },
  { id: 6, xPct: 66, yPct: 22, r: 1.8 },
  { id: 7, xPct: 75, yPct: 14, r: 2.2 },
  { id: 8, xPct: 86, yPct: 18, r: 1.9 },
  { id: 9, xPct: 16, yPct: 34, r: 1.5 },
  { id: 10, xPct: 33, yPct: 38, r: 1.8 },
  { id: 11, xPct: 63, yPct: 36, r: 1.7 },
  { id: 12, xPct: 81, yPct: 33, r: 2.0 },
  { id: 13, xPct: 91, yPct: 29, r: 1.5 },
];

export const CelestialCanvas: React.FC<CelestialCanvasProps> = ({
  settings,
  isMobileOrTablet = false,
  prefersReducedMotion = false,
  gyroscope,
  onBackendStatusChange,
}) => {
  const requestedMode = settings.renderMode ?? 'auto';
  const qualityTier = settings.quality ?? 'balanced';
  const powerOptsRef = useRef({ isMobileOrTablet, prefersReducedMotion });
  powerOptsRef.current = { isMobileOrTablet, prefersReducedMotion };

  const initialDecision = useMemo(
    () => resolveInitialRenderBackend(requestedMode, detectWebGL2Capability()),
    [requestedMode],
  );

  const [activeBackend, setActiveBackend] = useState<ActiveRenderBackend>(initialDecision.backend);
  const [backendReason, setBackendReason] = useState<string>(initialDecision.reason);

  useEffect(() => {
    setActiveBackend(initialDecision.backend);
    setBackendReason(initialDecision.reason);
  }, [initialDecision]);

  useEffect(() => {
    onBackendStatusChange?.({
      mode: requestedMode,
      active: activeBackend,
      reason: backendReason,
    });
  }, [requestedMode, activeBackend, backendReason, onBackendStatusChange]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 });
  const [pointerPct, setPointerPct] = useState({ x: 50, y: 30 });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Track desktop pointer, mobile/tablet long-press+swipe, and optional gyroscope
  useEffect(() => {
    return attachBackgroundMotionController({
      getContainer: () => containerRef.current,
      isMobileOrTablet,
      gyroscope,
      onUpdate: ({ x, y }) => {
        mouseRef.current.tx = x;
        mouseRef.current.ty = 1 - y;
        setPointerPct({ x: x * 100, y: y * 100 });
      },
    });
  }, [isMobileOrTablet, gyroscope?.enabled, gyroscope?.sensitivity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // -------------------------------------------------------------------------
    // CPU Software-Shader + Crisp Diamond Dust Renderer
    // -------------------------------------------------------------------------
    if (activeBackend === 'cpu') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cpuRenderer = createCelestialCpuRenderer();
      const getBoxSize = () => ({
        w: Math.max(1, Math.round(containerRef.current?.clientWidth || canvas.clientWidth || window.innerWidth)),
        h: Math.max(1, Math.round(containerRef.current?.clientHeight || canvas.clientHeight || window.innerHeight)),
      });
      let { w: width, h: height } = getBoxSize();
      let dpr = 1;

      const resizeCpu = () => {
        const prof = applyMobilePowerBudget(
          getRenderQualityProfile(settingsRef.current.quality),
          powerOptsRef.current,
        );
        dpr = Math.min(window.devicePixelRatio || 1, prof.cpuDprCap);
        const box = getBoxSize();
        width = box.w;
        height = box.h;
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resizeCpu();
      window.addEventListener('resize', resizeCpu);
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resizeCpu) : null;
      if (ro) ro.observe(containerRef.current ?? canvas);

      let rafId = 0;
      let lastFrameTime = 0;
      const startTime = performance.now();

      const renderCpu = (now: number) => {
        rafId = requestAnimationFrame(renderCpu);
        if (document.hidden) return;

        const cur = settingsRef.current;
        const prof = applyMobilePowerBudget(
          getRenderQualityProfile(cur.quality),
          powerOptsRef.current,
        );
        if (prof.cpuMinFrameMs > 0 && now - lastFrameTime < prof.cpuMinFrameMs) return;
        lastFrameTime = now;

        mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.08;
        mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.08;

        const t = powerOptsRef.current.prefersReducedMotion
          ? 2.4
          : (now - startTime) * 0.001;
        cpuRenderer.render(ctx, {
          width,
          height,
          timeSec: t,
          mouseX: mouseRef.current.x,
          mouseY: mouseRef.current.y,
          settings: cur,
        });
      };

      rafId = requestAnimationFrame(renderCpu);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resizeCpu);
        ro?.disconnect();
        cpuRenderer.dispose();
      };
    }

    // -------------------------------------------------------------------------
    // GPU WebGL2 Celestial Shader Renderer
    // -------------------------------------------------------------------------
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: qualityTier === 'eco' ? 'low-power' : 'high-performance',
    });

    if (!gl) {
      setBackendReason('WebGL2 上下文初始化失败，已自动回退 CPU 渲染');
      setActiveBackend('cpu');
      return;
    }

    const skyProg = createProgram(gl, SKY_VERTEX_SHADER, SKY_FRAGMENT_SHADER);
    const partProg = createProgram(gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
    if (!skyProg || !partProg) {
      setBackendReason('着色器编译异常，已自动回退 CPU 渲染');
      setActiveBackend('cpu');
      return;
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if ((settingsRef.current.renderMode ?? 'auto') === 'auto') {
        setBackendReason('自动：GPU 上下文丢失，已切至 CPU 渲染');
        setActiveBackend('cpu');
      }
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    // Fullscreen quad VAO
    const quadVao = gl.createVertexArray();
    const quadBuf = gl.createBuffer();
    gl.bindVertexArray(quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPosLoc = gl.getAttribLocation(skyProg, 'a_pos');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    // Diamond Dust Particle VAO
    const maxParticles = 240;
    const particleData = new Float32Array(maxParticles * 4);
    for (let i = 0; i < maxParticles; i++) {
      particleData[i * 4 + 0] = Math.random();
      particleData[i * 4 + 1] = Math.random();
      particleData[i * 4 + 2] = Math.random();
      particleData[i * 4 + 3] = Math.random();
    }
    const partVao = gl.createVertexArray();
    const partBuf = gl.createBuffer();
    gl.bindVertexArray(partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.STATIC_DRAW);
    const aSeedLoc = gl.getAttribLocation(partProg, 'a_seed');
    const aMetaLoc = gl.getAttribLocation(partProg, 'a_meta');
    gl.enableVertexAttribArray(aSeedLoc);
    gl.vertexAttribPointer(aSeedLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aMetaLoc);
    gl.vertexAttribPointer(aMetaLoc, 2, gl.FLOAT, false, 16, 8);

    const uSkyRes = gl.getUniformLocation(skyProg, 'u_resolution');
    const uSkyMouse = gl.getUniformLocation(skyProg, 'u_mouse');
    const uSkyTime = gl.getUniformLocation(skyProg, 'u_time');
    const uSkyMood = gl.getUniformLocation(skyProg, 'u_mood');

    const uPartTime = gl.getUniformLocation(partProg, 'u_time');
    const uPartMouse = gl.getUniformLocation(partProg, 'u_mouse');
    const uPartDpr = gl.getUniformLocation(partProg, 'u_dpr');

    let dpr = 1;
    const resize = () => {
      const prof = applyMobilePowerBudget(
        getRenderQualityProfile(settingsRef.current.quality),
        powerOptsRef.current,
      );
      dpr = Math.min(window.devicePixelRatio || 1, prof.gpuDprCap);
      const w = Math.max(1, Math.round(containerRef.current?.clientWidth || canvas.clientWidth || window.innerWidth));
      const h = Math.max(1, Math.round(containerRef.current?.clientHeight || canvas.clientHeight || window.innerHeight));
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    const gpuRo = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (gpuRo) gpuRo.observe(containerRef.current ?? canvas);

    const watchdog = createAutoFallbackWatchdog();
    let rafId = 0;
    let lastFrameTime = performance.now();
    let lastDrawnTime = 0;
    const startTime = performance.now();

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);
      if (document.hidden) {
        lastFrameTime = now;
        return;
      }

      const rawDelta = now - lastFrameTime;
      lastFrameTime = now;

      const cur = settingsRef.current;
      const prof = applyMobilePowerBudget(
        getRenderQualityProfile(cur.quality),
        powerOptsRef.current,
      );

      if ((cur.renderMode ?? 'auto') === 'auto' && prof.gpuMinFrameMs === 0) {
        if (watchdog.recordFrame(rawDelta)) {
          setBackendReason('自动：检测到连续掉帧，已切至 CPU 渲染');
          setActiveBackend('cpu');
          return;
        }
      }

      if (prof.gpuMinFrameMs > 0 && now - lastDrawnTime < prof.gpuMinFrameMs) return;
      lastDrawnTime = now;

      // Smooth pointer lerp
      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.08;

      const t = powerOptsRef.current.prefersReducedMotion
        ? 2.4
        : (now - startTime) * 0.001;

      // Pass 1: Atmospheric Sky + Venus Belt + God-Rays + Parhelia
      gl.disable(gl.BLEND);
      gl.useProgram(skyProg);
      gl.bindVertexArray(quadVao);
      gl.uniform2f(uSkyRes, canvas.width, canvas.height);
      gl.uniform2f(uSkyMouse, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(uSkyTime, t);
      gl.uniform1i(uSkyMood, resolveMoodIndex(cur.mood));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 2: Diamond Dust GPU Particles
      const activeCount = Math.max(
        20,
        Math.min(maxParticles, Math.round(140 * cur.particleDensity * prof.particleScale)),
      );
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(partProg);
      gl.bindVertexArray(partVao);
      gl.uniform1f(uPartTime, t);
      gl.uniform2f(uPartMouse, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(uPartDpr, dpr);
      gl.drawArrays(gl.POINTS, 0, activeCount);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      gpuRo?.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      gl.deleteBuffer(quadBuf);
      gl.deleteVertexArray(quadVao);
      gl.deleteBuffer(partBuf);
      gl.deleteVertexArray(partVao);
      gl.deleteProgram(skyProg);
      gl.deleteProgram(partProg);
    };
  }, [activeBackend, qualityTier]);

  // Interactive Constellation lines illuminated around pointer
  const constellationLines = useMemo(() => {
    if (!settings.enableConstellations) return [];
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    for (let i = 0; i < CONSTELLATION_STARS.length; i++) {
      const a = CONSTELLATION_STARS[i];
      const da = Math.hypot(a.xPct - pointerPct.x, a.yPct - pointerPct.y);
      if (da > 28) continue;
      for (let j = i + 1; j < CONSTELLATION_STARS.length; j++) {
        const b = CONSTELLATION_STARS[j];
        const dist = Math.hypot(a.xPct - b.xPct, a.yPct - b.yPct);
        if (dist < 22) {
          const proximity = Math.max(0, 1 - da / 28);
          lines.push({
            x1: a.xPct,
            y1: a.yPct,
            x2: b.xPct,
            y2: b.yPct,
            opacity: proximity * 0.55,
          });
        }
      }
    }
    return lines;
  }, [pointerPct, settings.enableConstellations]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <canvas
        key={activeBackend}
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {settings.enableConstellations && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
        >
          {constellationLines.map((l, idx) => (
            <line
              key={idx}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#bae6fd"
              strokeWidth="0.14"
              strokeOpacity={l.opacity}
            />
          ))}
          {CONSTELLATION_STARS.map((s) => {
            const d = Math.hypot(s.xPct - pointerPct.x, s.yPct - pointerPct.y);
            const active = d < 24;
            return (
              <circle
                key={s.id}
                cx={s.xPct}
                cy={s.yPct}
                r={active ? 0.34 : 0.22}
                fill={active ? '#e0f2fe' : '#93c5fd'}
                fillOpacity={active ? 0.9 : 0.35}
              />
            );
          })}
        </svg>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000000',
          opacity: Math.max(0, Math.min(1, settings.darkMaskOpacity ?? 0)),
          pointerEvents: 'none',
          transition: 'opacity 120ms ease',
        }}
      />
    </div>
  );
};
