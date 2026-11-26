import { describe, expect, it } from 'vitest';
import {
  createAutoFallbackWatchdog,
  getRenderQualityProfile,
  isSoftwareWebGLRenderer,
  resolveInitialRenderBackend,
} from '../renderEngine';

describe('renderEngine', () => {
  it('orders quality profiles monotonically from ultra to eco', () => {
    const ultra = getRenderQualityProfile('ultra');
    const balanced = getRenderQualityProfile('balanced');
    const eco = getRenderQualityProfile('eco');

    expect(ultra.gpuDprCap).toBeGreaterThan(balanced.gpuDprCap);
    expect(balanced.gpuDprCap).toBeGreaterThan(eco.gpuDprCap);

    expect(ultra.cpuDprCap).toBeGreaterThan(balanced.cpuDprCap);
    expect(balanced.cpuDprCap).toBeGreaterThan(eco.cpuDprCap);

    expect(ultra.particleScale).toBeGreaterThan(balanced.particleScale);
    expect(balanced.particleScale).toBeGreaterThan(eco.particleScale);

    expect(ultra.cpuShaderMaxWidth).toBeGreaterThan(balanced.cpuShaderMaxWidth);
    expect(balanced.cpuShaderMaxWidth).toBeGreaterThan(eco.cpuShaderMaxWidth);

    expect(ultra.cpuCloudOctaves).toBeGreaterThan(balanced.cpuCloudOctaves);
    expect(balanced.cpuCloudOctaves).toBeGreaterThan(eco.cpuCloudOctaves);

    expect(ultra.cpuAuroraSteps).toBeGreaterThan(balanced.cpuAuroraSteps);
    expect(balanced.cpuAuroraSteps).toBeGreaterThan(eco.cpuAuroraSteps);

    expect(eco.gpuMinFrameMs).toBeGreaterThan(0);
    expect(eco.cpuMinFrameMs).toBeGreaterThan(balanced.cpuMinFrameMs);
  });

  it('identifies software vs hardware WebGL renderers', () => {
    expect(isSoftwareWebGLRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))')).toBe(true);
    expect(isSoftwareWebGLRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareWebGLRenderer('ANGLE (Microsoft Basic Render Driver Direct3D11)')).toBe(true);

    expect(isSoftwareWebGLRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)')).toBe(false);
    expect(isSoftwareWebGLRenderer('Apple M3 Pro')).toBe(false);
    expect(isSoftwareWebGLRenderer('AMD Radeon RX 7800 XT')).toBe(false);
    expect(isSoftwareWebGLRenderer(null)).toBe(false);
  });

  it('resolves initial render backend for auto, gpu, and cpu modes', () => {
    const hwCap = {
      available: true,
      hardwareAccelerated: true,
      isSoftwareRenderer: false,
      rendererName: 'NVIDIA RTX 4060',
    };
    const swCap = {
      available: true,
      hardwareAccelerated: false,
      isSoftwareRenderer: true,
      rendererName: 'Google SwiftShader',
    };
    const noWebglCap = {
      available: false,
      hardwareAccelerated: false,
      isSoftwareRenderer: false,
      rendererName: null,
    };

    expect(resolveInitialRenderBackend('cpu', hwCap).backend).toBe('cpu');
    expect(resolveInitialRenderBackend('gpu', hwCap).backend).toBe('gpu');
    expect(resolveInitialRenderBackend('gpu', swCap).backend).toBe('gpu');
    expect(resolveInitialRenderBackend('gpu', noWebglCap).backend).toBe('cpu');

    expect(resolveInitialRenderBackend('auto', hwCap).backend).toBe('gpu');
    expect(resolveInitialRenderBackend('auto', swCap).backend).toBe('cpu');
    expect(resolveInitialRenderBackend('auto', noWebglCap).backend).toBe('cpu');
  });

  it('triggers auto CPU fallback on sustained slow frames while ignoring tab spikes', () => {
    const healthy = createAutoFallbackWatchdog({ warmupFrames: 5, slowFrameMs: 50, slowFramesThreshold: 10 });
    for (let i = 0; i < 60; i++) {
      expect(healthy.recordFrame(16.6)).toBe(false);
    }
    // Single large tab-switch pause should not falsely trigger fallback
    expect(healthy.recordFrame(900)).toBe(false);
    expect(healthy.recordFrame(16.6)).toBe(false);

    const slow = createAutoFallbackWatchdog({ warmupFrames: 5, slowFrameMs: 45, slowFramesThreshold: 10 });
    for (let i = 0; i < 5; i++) {
      expect(slow.recordFrame(90)).toBe(false);
    }
    let fellBack = false;
    for (let i = 0; i < 30; i++) {
      if (slow.recordFrame(95)) {
        fellBack = true;
        break;
      }
    }
    expect(fellBack).toBe(true);
  });
});
