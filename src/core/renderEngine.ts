import type {
  ActiveRenderBackend,
  RenderBackendMode,
  RenderQualityTier,
} from '../types/archive';

export interface RenderQualityProfile {
  tier: RenderQualityTier;
  labelZh: string;
  gpuDprCap: number;
  cpuDprCap: number;
  shaderDprCap: number;
  gpuMinFrameMs: number;
  cpuMinFrameMs: number;
  particleScale: number;
  cpuShaderMaxWidth: number;
  cpuCloudOctaves: number;
  cpuAuroraSteps: number;
}

export interface WebGLCapabilityInfo {
  available: boolean;
  hardwareAccelerated: boolean;
  isSoftwareRenderer: boolean;
  rendererName: string | null;
}

const QUALITY_PROFILES: Record<RenderQualityTier, RenderQualityProfile> = {
  ultra: {
    tier: 'ultra',
    labelZh: '极致',
    gpuDprCap: 2.0,
    cpuDprCap: 1.5,
    shaderDprCap: 1.5,
    gpuMinFrameMs: 0,
    cpuMinFrameMs: 16,
    particleScale: 1.15,
    cpuShaderMaxWidth: 440,
    cpuCloudOctaves: 4,
    cpuAuroraSteps: 18,
  },
  balanced: {
    tier: 'balanced',
    labelZh: '均衡',
    gpuDprCap: 1.35,
    cpuDprCap: 1.15,
    shaderDprCap: 1.15,
    gpuMinFrameMs: 0,
    cpuMinFrameMs: 22,
    particleScale: 0.85,
    cpuShaderMaxWidth: 320,
    cpuCloudOctaves: 3,
    cpuAuroraSteps: 14,
  },
  eco: {
    tier: 'eco',
    labelZh: '省电',
    gpuDprCap: 0.85,
    cpuDprCap: 0.85,
    shaderDprCap: 0.78,
    gpuMinFrameMs: 33,
    cpuMinFrameMs: 40,
    particleScale: 0.5,
    cpuShaderMaxWidth: 210,
    cpuCloudOctaves: 2,
    cpuAuroraSteps: 10,
  },
};

export function getRenderQualityProfile(
  tier: RenderQualityTier | undefined,
): RenderQualityProfile {
  return QUALITY_PROFILES[tier ?? 'balanced'] ?? QUALITY_PROFILES.balanced;
}

export function applyMobilePowerBudget(
  profile: RenderQualityProfile,
  opts?: { isMobileOrTablet?: boolean; prefersReducedMotion?: boolean },
): RenderQualityProfile {
  if (!opts?.isMobileOrTablet && !opts?.prefersReducedMotion) {
    return profile;
  }

  if (opts.prefersReducedMotion) {
    return {
      ...profile,
      gpuDprCap: Math.min(profile.gpuDprCap, 1.0),
      cpuDprCap: Math.min(profile.cpuDprCap, 1.0),
      shaderDprCap: Math.min(profile.shaderDprCap, 0.9),
      gpuMinFrameMs: Math.max(profile.gpuMinFrameMs, 100),
      cpuMinFrameMs: Math.max(profile.cpuMinFrameMs, 100),
      particleScale: Math.min(profile.particleScale, 0.35),
      cpuShaderMaxWidth: Math.min(profile.cpuShaderMaxWidth, 240),
    };
  }

  // Mobile / Tablet power budget: cap DPR & particle budget while keeping smooth 30fps+ visuals
  return {
    ...profile,
    gpuDprCap: Math.min(profile.gpuDprCap, 1.15),
    cpuDprCap: Math.min(profile.cpuDprCap, 1.0),
    shaderDprCap: Math.min(profile.shaderDprCap, 0.95),
    gpuMinFrameMs: Math.max(profile.gpuMinFrameMs, 33),
    cpuMinFrameMs: Math.max(profile.cpuMinFrameMs, 33),
    particleScale: Math.min(profile.particleScale, 0.65),
    cpuShaderMaxWidth: Math.min(profile.cpuShaderMaxWidth, 260),
    cpuCloudOctaves: Math.min(profile.cpuCloudOctaves, 3),
    cpuAuroraSteps: Math.min(profile.cpuAuroraSteps, 12),
  };
}

const SOFTWARE_RENDERER_RE =
  /swiftshader|llvmpipe|softpipe|software|microsoft basic render|angle.*warp|mesa.*swrast/i;

export function isSoftwareWebGLRenderer(renderer: string | null | undefined): boolean {
  if (!renderer) return false;
  return SOFTWARE_RENDERER_RE.test(renderer);
}

let cachedCapability: WebGLCapabilityInfo | null = null;

/**
 * Probes WebGL2 hardware availability safely once per session and releases
 * the temporary probe context immediately.
 */
export function detectWebGL2Capability(): WebGLCapabilityInfo {
  if (cachedCapability) return cachedCapability;

  if (typeof document === 'undefined') {
    return {
      available: false,
      hardwareAccelerated: false,
      isSoftwareRenderer: false,
      rendererName: null,
    };
  }

  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = 4;
  probeCanvas.height = 4;

  let hwCaveatPassed = false;
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = probeCanvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
      alpha: false,
      antialias: false,
    });
    hwCaveatPassed = Boolean(gl);
    if (!gl) {
      gl = probeCanvas.getContext('webgl2', {
        failIfMajorPerformanceCaveat: false,
        alpha: false,
        antialias: false,
      });
    }
  } catch {
    gl = null;
  }

  if (!gl) {
    cachedCapability = {
      available: false,
      hardwareAccelerated: false,
      isSoftwareRenderer: false,
      rendererName: null,
    };
    return cachedCapability;
  }

  let rendererName: string | null = null;
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      rendererName = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '') || null;
    } else {
      rendererName = String(gl.getParameter(gl.RENDERER) ?? '') || null;
    }
  } catch {
    rendererName = null;
  }

  try {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Ignore cleanup errors
  }

  const isSw = isSoftwareWebGLRenderer(rendererName);
  cachedCapability = {
    available: true,
    hardwareAccelerated: hwCaveatPassed && !isSw,
    isSoftwareRenderer: isSw || !hwCaveatPassed,
    rendererName,
  };
  return cachedCapability;
}

export function resolveInitialRenderBackend(
  mode: RenderBackendMode | undefined,
  cap: WebGLCapabilityInfo,
): { backend: ActiveRenderBackend; reason: string } {
  const m: RenderBackendMode = mode ?? 'auto';
  if (m === 'cpu') {
    return { backend: 'cpu', reason: '手动锁定 CPU Canvas 2D 渲染' };
  }
  if (m === 'gpu') {
    if (!cap.available) {
      return { backend: 'cpu', reason: '环境不支持 WebGL2，已回退 CPU 渲染' };
    }
    return {
      backend: 'gpu',
      reason: cap.rendererName ? `手动 GPU 渲染 (${cap.rendererName})` : '手动 GPU WebGL2 渲染',
    };
  }

  // Auto mode: prefer hardware-accelerated WebGL2, fall back to CPU for software/unavailable WebGL2
  if (!cap.available) {
    return { backend: 'cpu', reason: '自动：WebGL2 不可用，已使用 CPU 渲染' };
  }
  if (!cap.hardwareAccelerated || cap.isSoftwareRenderer) {
    return {
      backend: 'cpu',
      reason: '自动：检测到软件光栅化，已智能切换 CPU 渲染以降低开销',
    };
  }
  return {
    backend: 'gpu',
    reason: cap.rendererName ? `自动：硬件 GPU 加速 (${cap.rendererName})` : '自动：硬件 GPU 加速中',
  };
}

export interface AutoFallbackWatchdog {
  recordFrame: (deltaMs: number) => boolean;
  reset: () => void;
}

/**
 * Tracks smoothed frame times during Auto mode and signals CPU fallback
 * if GPU rendering sustains severe frame drops after initial warmup.
 */
export function createAutoFallbackWatchdog(options?: {
  warmupFrames?: number;
  slowFrameMs?: number;
  slowFramesThreshold?: number;
}): AutoFallbackWatchdog {
  const warmupFrames = options?.warmupFrames ?? 30;
  const slowFrameMs = options?.slowFrameMs ?? 52;
  const slowFramesThreshold = options?.slowFramesThreshold ?? 45;

  let frames = 0;
  let emaMs = 16.7;
  let slowStreak = 0;
  let triggered = false;

  return {
    recordFrame(deltaMs: number): boolean {
      if (triggered) return true;
      // Ignore background-tab resumes or OS sleep pauses
      if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > 250) {
        return false;
      }

      frames += 1;
      if (frames <= warmupFrames) {
        return false;
      }

      emaMs = emaMs * 0.85 + deltaMs * 0.15;
      if (emaMs > slowFrameMs) {
        slowStreak += 1;
        if (slowStreak >= slowFramesThreshold) {
          triggered = true;
          return true;
        }
      } else {
        slowStreak = Math.max(0, slowStreak - 2);
      }
      return false;
    },
    reset() {
      frames = 0;
      emaMs = 16.7;
      slowStreak = 0;
      triggered = false;
    },
  };
}
