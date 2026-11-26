import { describe, expect, it, vi } from 'vitest';
import {
  fetchLiveWeather,
  mapChineseWeatherToEffects,
  mapWmoCodeToEffects,
  pickRandomWeatherCombo,
  searchWeatherLocations,
} from '../weatherService';

describe('weatherService', () => {
  it('maps WMO weather codes & environment telemetry to composable effects', () => {
    const clearDay = mapWmoCodeToEffects(0, { isDay: true, windSpeedKmh: 6 });
    expect(clearDay.descriptionZh).toContain('晴');
    expect(clearDay.effects).toEqual(['clear-sun']);

    const sunShower = mapWmoCodeToEffects(80, {
      isDay: true,
      cloudCover: 45,
      windSpeedKmh: 12,
    });
    expect(sunShower.effects).toContain('rain');
    expect(sunShower.effects).toContain('rainbow');
    expect(sunShower.effects).toContain('clear-sun');

    const blizzard = mapWmoCodeToEffects(75, { isDay: false, windSpeedKmh: 30, latitude: 46 });
    expect(blizzard.effects).toContain('snow');
    expect(blizzard.effects).toContain('clouds');
    expect(blizzard.effects).toContain('wind-petals');

    const arcticNight = mapWmoCodeToEffects(0, { isDay: false, cloudCover: 10, latitude: 64.1 });
    expect(arcticNight.effects).toContain('clear-sun');
    expect(arcticNight.effects).toContain('aurora');

    const thunder = mapWmoCodeToEffects(95, { isDay: false });
    expect(thunder.effects).toEqual(['clouds', 'rain', 'thunder']);
  });

  it('maps Chinese weather descriptions to visual weather effects', () => {
    const sunny = mapChineseWeatherToEffects('晴', { isDay: true, windSpeedKmh: 8 });
    expect(sunny.effects).toEqual(['clear-sun']);

    const storm = mapChineseWeatherToEffects('雷阵雨', { isDay: false, windSpeedKmh: 18 });
    expect(storm.effects).toEqual(['clouds', 'rain', 'thunder']);

    const heavySnow = mapChineseWeatherToEffects('大雪', { isDay: true, windSpeedKmh: 28 });
    expect(heavySnow.effects).toContain('snow');
    expect(heavySnow.effects).toContain('clouds');
    expect(heavySnow.effects).toContain('wind-petals');

    const sunShower = mapChineseWeatherToEffects('太阳雨', { isDay: true });
    expect(sunShower.effects).toEqual(['clear-sun', 'rain', 'rainbow']);
  });

  it('cycles random weather combos without immediate repetition', () => {
    let prevSig: string | undefined;
    for (let i = 0; i < 15; i++) {
      const picked = pickRandomWeatherCombo(prevSig);
      expect(picked.effects.length).toBeGreaterThanOrEqual(1);
      if (prevSig) {
        expect(picked.signature).not.toBe(prevSig);
      }
      prevSig = picked.signature;
    }
  });

  it('searches domestic cities and fetches live weather from Tencent Weather', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('wis.qq.com/city/like')) {
        return new Response(
          JSON.stringify({
            status: 200,
            data: {
              '101210101': '浙江, 杭州',
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes('wis.qq.com/weather/common')) {
        return new Response(
          JSON.stringify({
            status: 200,
            data: {
              observe: {
                degree: '21',
                humidity: '64',
                weather: '阵雨',
                wind_power: '5',
              },
              rise: {
                '0': {
                  sunrise: '00:00',
                  sunset: '23:59',
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    const locs = await searchWeatherLocations('杭州', mockFetch);
    expect(locs).toHaveLength(1);
    expect(locs[0].province).toBe('浙江');
    expect(locs[0].city).toBe('杭州');
    expect(locs[0].regionLabel).toBe('中国 · 浙江 · 杭州');

    const snap = await fetchLiveWeather(
      locs[0].latitude,
      locs[0].longitude,
      locs[0].name,
      locs[0].regionLabel,
      {
        fetchImpl: mockFetch,
        province: locs[0].province,
        city: locs[0].city,
      },
    );
    expect(snap.temperatureC).toBe(21);
    expect(snap.humidity).toBe(64);
    expect(snap.sourceName).toBe('腾讯天气');
    expect(snap.mappedEffects).toContain('rain');
    expect(snap.mappedEffects).toContain('rainbow');
    expect(snap.mappedEffects).toContain('wind-petals');
  });

  it('falls back to uapis.cn domestic source when Tencent Weather fails or returns empty', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('wis.qq.com/weather/common')) {
        return new Response(JSON.stringify({ status: 200, data: {} }), { status: 200 });
      }
      if (url.includes('uapis.cn/api/v1/misc/weather')) {
        return new Response(
          JSON.stringify({
            province: '四川省',
            city: '成都市',
            weather: '多云',
            temperature: '18.5',
            feelst: '17.8',
            humidity: '72',
            wind_speed: '2.5',
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    const snap = await fetchLiveWeather(30.5728, 104.0668, '成都', '中国 · 四川 · 成都', mockFetch);
    expect(snap.temperatureC).toBe(18.5);
    expect(snap.apparentTempC).toBe(17.8);
    expect(snap.humidity).toBe(72);
    expect(snap.sourceName).toBe('国内气象源');
    expect(snap.mappedEffects).toEqual(['clear-sun', 'clouds']);
  });
});
