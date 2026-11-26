import { describe, expect, it } from 'vitest';
import { evaluateCelestialSkyPixel } from '../../components/celestial/celestialCpuRenderer';
import { evaluateWeatherSkyPixel } from '../../components/weather/weatherCpuRenderer';

describe('CPU software sky shaders', () => {
  it('evaluates finite Celestial Optics pixels across all moods and illuminates optical parhelia', () => {
    const out = new Float32Array(3);
    const moodSamples: number[][] = [];

    for (const moodIdx of [0, 1, 2]) {
      evaluateCelestialSkyPixel(
        {
          uvX: 0.5,
          uvY: 0.85,
          aspect: 16 / 9,
          mouseX: 0.5,
          mouseY: 0.5,
          timeSec: 3.2,
          moodIdx,
        },
        out,
      );
      expect(Number.isFinite(out[0])).toBe(true);
      expect(Number.isFinite(out[1])).toBe(true);
      expect(Number.isFinite(out[2])).toBe(true);
      expect(out[0]).toBeGreaterThanOrEqual(0);
      expect(out[0]).toBeLessThanOrEqual(255);
      moodSamples.push([out[0], out[1], out[2]]);
    }

    // Distinct palettes across Venus Dusk, Parhelion Night, and Dawn Rays
    expect(moodSamples[0]).not.toEqual(moodSamples[1]);
    expect(moodSamples[1]).not.toEqual(moodSamples[2]);

    // Check 22-degree Parhelia sundog right peak is noticeably brighter than dark zenith
    const zenith = new Float32Array(3);
    const parhelion = new Float32Array(3);
    const aspect = 16 / 9;
    evaluateCelestialSkyPixel(
      { uvX: 0.12, uvY: 0.88, aspect, mouseX: 0.5, mouseY: 0.5, timeSec: 1.0, moodIdx: 0 },
      zenith,
    );
    evaluateCelestialSkyPixel(
      {
        uvX: 0.5 + (0.33 * 1.02) / aspect,
        uvY: 0.44,
        aspect,
        mouseX: 0.5,
        mouseY: 0.5,
        timeSec: 1.0,
        moodIdx: 0,
      },
      parhelion,
    );
    const lumaZenith = zenith[0] + zenith[1] + zenith[2];
    const lumaSundog = parhelion[0] + parhelion[1] + parhelion[2];
    expect(lumaSundog).toBeGreaterThan(lumaZenith * 1.5);
  });

  it('evaluates finite Weather CPU sky pixels for clear day, volumetric clouds, rainbow, and aurora', () => {
    const dayClear = new Float32Array(3);
    evaluateWeatherSkyPixel(
      {
        uvX: 0.35,
        uvY: 0.72,
        aspect: 16 / 9,
        fragX: 40,
        fragY: 20,
        timeSec: 4.5,
        mouseX: 0.5,
        mouseY: 0.5,
        sunWeight: 1,
        auroraWeight: 0,
        cloudWeight: 0.6,
        stormWeight: 0,
        rainbowWeight: 0.8,
        dayFactor: 1,
        duskFactor: 0,
        nightFactor: 0,
        intensity: 1,
      },
      dayClear,
    );
    for (let i = 0; i < 3; i++) {
      expect(Number.isFinite(dayClear[i])).toBe(true);
      expect(dayClear[i]).toBeGreaterThanOrEqual(0);
      expect(dayClear[i]).toBeLessThanOrEqual(255);
    }
    expect(dayClear[2]).toBeGreaterThan(dayClear[0]); // Clear sky retains blue channel dominance

    // Verify Nimitz CPU aurora illuminates dark night sky
    const nightPlain = new Float32Array(3);
    const nightAurora = new Float32Array(3);
    const baseNight = {
      uvX: 0.52,
      uvY: 0.64,
      aspect: 16 / 9,
      fragX: 88,
      fragY: 42,
      timeSec: 7.5,
      mouseX: 0.5,
      mouseY: 0.5,
      sunWeight: 0,
      cloudWeight: 0,
      stormWeight: 0,
      rainbowWeight: 0,
      dayFactor: 0,
      duskFactor: 0,
      nightFactor: 1,
      intensity: 1.1,
    };
    evaluateWeatherSkyPixel({ ...baseNight, auroraWeight: 0 }, nightPlain);
    evaluateWeatherSkyPixel({ ...baseNight, auroraWeight: 1 }, nightAurora);
    const lumaPlain = nightPlain[0] + nightPlain[1] + nightPlain[2];
    const lumaAurora = nightAurora[0] + nightAurora[1] + nightAurora[2];
    expect(lumaAurora).toBeGreaterThan(lumaPlain);
  });

  it('maintains seamless angular continuity across the horizontal axis left of the sun (no atan seam)', () => {
    const above = new Float32Array(3);
    const below = new Float32Array(3);
    const baseWeather = {
      uvX: 0.62,
      aspect: 16 / 9,
      fragX: 40,
      fragY: 20,
      timeSec: 3.1,
      mouseX: 0.5,
      mouseY: 0.5,
      sunWeight: 1,
      auroraWeight: 0,
      cloudWeight: 0.5,
      stormWeight: 0,
      rainbowWeight: 0,
      dayFactor: 1,
      duskFactor: 0,
      nightFactor: 0,
      intensity: 1,
    };
    // Sun center is at uvY = 0.78 (screen-space 0.5 + 0.28); sample +/- 0.002 across left horizontal axis
    evaluateWeatherSkyPixel({ ...baseWeather, uvY: 0.782 }, above);
    evaluateWeatherSkyPixel({ ...baseWeather, uvY: 0.778 }, below);
    expect(Math.abs(above[0] - below[0])).toBeLessThan(4);
    expect(Math.abs(above[1] - below[1])).toBeLessThan(4);
    expect(Math.abs(above[2] - below[2])).toBeLessThan(4);

    // Celestial Optics left of sun (sun at uvX=0.5, uvY=0.26)
    const celAbove = new Float32Array(3);
    const celBelow = new Float32Array(3);
    evaluateCelestialSkyPixel(
      { uvX: 0.34, uvY: 0.262, aspect: 16 / 9, mouseX: 0.5, mouseY: 0.5, timeSec: 2.0, moodIdx: 2 },
      celAbove,
    );
    evaluateCelestialSkyPixel(
      { uvX: 0.34, uvY: 0.258, aspect: 16 / 9, mouseX: 0.5, mouseY: 0.5, timeSec: 2.0, moodIdx: 2 },
      celBelow,
    );
    expect(Math.abs(celAbove[0] - celBelow[0])).toBeLessThan(4);
    expect(Math.abs(celAbove[1] - celBelow[1])).toBeLessThan(4);
    expect(Math.abs(celAbove[2] - celBelow[2])).toBeLessThan(4);
  });
});
