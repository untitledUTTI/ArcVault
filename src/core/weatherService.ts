import type {
  LiveWeatherSnapshot,
  WeatherEffectId,
  WeatherSettings,
  WeatherTimeOfDay,
} from '../types/archive';

export interface WeatherEffectMeta {
  id: WeatherEffectId;
  labelZh: string;
  labelEn: string;
  descZh: string;
  descEn: string;
  accentHex: string;
}

export interface WeatherPresetCombo {
  id: string;
  labelZh: string;
  labelEn: string;
  effects: WeatherEffectId[];
  timeOfDay: WeatherTimeOfDay;
}

export interface WeatherLocationCandidate {
  name: string;
  nameEn?: string;
  regionLabel: string;
  regionLabelEn?: string;
  latitude: number;
  longitude: number;
  province?: string;
  city?: string;
  county?: string;
}

interface DomesticCityEntry extends WeatherLocationCandidate {
  aliases: string[];
}

export const WEATHER_EFFECT_META: WeatherEffectMeta[] = [
  { id: 'clear-sun', labelZh: '晴空丁达尔光', labelEn: 'Tyndall Sunbeams', descZh: '日晕光芒、镜头炫光或月夜星辉', descEn: 'Solar halo, lens flare, or moonlit starlight', accentHex: '#fbbf24' },
  { id: 'clouds', labelZh: '层次流云', labelEn: 'Layered Clouds', descZh: '三层视差云海缓慢流动变幻', descEn: 'Three-layer parallax cloud sea drifting gently', accentHex: '#94a3b8' },
  { id: 'rain', labelZh: '细雨玻璃水滴', labelEn: 'Rain & Glass Drops', descZh: '斜织雨幕、地面涟漪与屏幕挂水滑落', descEn: 'Slanted rain streaks, ripples & glass droplets', accentHex: '#38bdf8' },
  { id: 'thunder', labelZh: '雷暴分叉闪电', labelEn: 'Thunder & Lightning', descZh: '分形枝状闪电与云层瞬时映亮', descEn: 'Fractal forked lightning & cloud flash', accentHex: '#a78bfa' },
  { id: 'snow', labelZh: '飘雪冰晶', labelEn: 'Snow & Ice Crystals', descZh: '散景雪团与旋转六角雪花轻舞', descEn: 'Bokeh snow & rotating hexagonal ice crystals', accentHex: '#e0f2fe' },
  { id: 'fog', labelZh: '流雾朦胧', labelEn: 'Drifting Mist', descZh: '低空漂浮雾霭与柔光呼吸层次', descEn: 'Low-lying drifting fog & soft breathing glow', accentHex: '#cbd5e1' },
  { id: 'rainbow', labelZh: '双霓彩虹', labelEn: 'Double Rainbow', descZh: '主虹与外副霓虹跨天穹舒展', descEn: 'Primary & secondary rainbow arching across sky', accentHex: '#f472b6' },
  { id: 'aurora', labelZh: '极光流星', labelEn: 'Aurora & Meteors', descZh: '翡翠紫粉极光帷幕与斜掠流星', descEn: 'Emerald-violet aurora curtains & shooting stars', accentHex: '#34d399' },
  { id: 'wind-petals', labelZh: '流风落英', labelEn: 'Wind & Petals', descZh: '气流丝带与随指针翻飞的樱花/微尘', descEn: 'Airflow ribbons & cursor-reactive drifting petals', accentHex: '#fda4af' },
];

export const WEATHER_PRESET_COMBOS: WeatherPresetCombo[] = [
  { id: 'sunshower-rainbow', labelZh: '太阳雨 · 双霓彩虹', labelEn: 'Sunshower · Double Rainbow', effects: ['clear-sun', 'rain', 'rainbow'], timeOfDay: 'day' },
  { id: 'midnight-storm', labelZh: '黑夜雷暴 · 玻璃雨滴', labelEn: 'Midnight Storm · Glass Rain', effects: ['clouds', 'rain', 'thunder', 'fog'], timeOfDay: 'night' },
  { id: 'aurora-blizzard', labelZh: '极光雪夜 · 流星冰晶', labelEn: 'Aurora Snow · Meteors', effects: ['snow', 'aurora'], timeOfDay: 'night' },
  { id: 'golden-sakura', labelZh: '暮光落英 · 暖阳流云', labelEn: 'Dusk Petals · Warm Clouds', effects: ['clear-sun', 'clouds', 'wind-petals'], timeOfDay: 'dusk' },
  { id: 'misty-rain', labelZh: '烟雨空蒙 · 江南雾岚', labelEn: 'Misty Rain · Soft Haze', effects: ['clouds', 'rain', 'fog'], timeOfDay: 'day' },
  { id: 'starry-clear', labelZh: '澄澈星穹 · 极光微风', labelEn: 'Starry Sky · Aurora Breeze', effects: ['clear-sun', 'aurora', 'wind-petals'], timeOfDay: 'night' },
  { id: 'clear-breeze', labelZh: '晴空万里 · 丁达尔光', labelEn: 'Clear Sky · Sunbeams', effects: ['clear-sun', 'clouds'], timeOfDay: 'day' },
  { id: 'heavy-snow', labelZh: '鹅毛大雪 · 银装雾霭', labelEn: 'Heavy Snow · Winter Mist', effects: ['clouds', 'snow', 'fog'], timeOfDay: 'dusk' },
];

export const WEATHER_RANDOM_INTERVALS: Array<{ seconds: number; label: string; labelEn: string }> = [
  { seconds: 15, label: '每 15 秒', labelEn: 'Every 15s' },
  { seconds: 30, label: '每 30 秒', labelEn: 'Every 30s' },
  { seconds: 60, label: '每 1 分钟', labelEn: 'Every 1m' },
  { seconds: 300, label: '每 5 分钟', labelEn: 'Every 5m' },
  { seconds: 900, label: '每 15 分钟', labelEn: 'Every 15m' },
  { seconds: 1800, label: '每 30 分钟', labelEn: 'Every 30m' },
  { seconds: 3600, label: '每 1 小时', labelEn: 'Every 1h' },
];

const DOMESTIC_CITY_CATALOG: DomesticCityEntry[] = [
  { name: '北京', regionLabel: '中国 · 北京', province: '北京', city: '北京', latitude: 39.9042, longitude: 116.4074, aliases: ['beijing', 'bj'] },
  { name: '上海', regionLabel: '中国 · 上海', province: '上海', city: '上海', latitude: 31.2304, longitude: 121.4737, aliases: ['shanghai', 'sh'] },
  { name: '广州', regionLabel: '中国 · 广东 · 广州', province: '广东', city: '广州', latitude: 23.1291, longitude: 113.2644, aliases: ['guangzhou', 'gz'] },
  { name: '深圳', regionLabel: '中国 · 广东 · 深圳', province: '广东', city: '深圳', latitude: 22.5431, longitude: 114.0579, aliases: ['shenzhen', 'sz'] },
  { name: '杭州', regionLabel: '中国 · 浙江 · 杭州', province: '浙江', city: '杭州', latitude: 30.2741, longitude: 120.1551, aliases: ['hangzhou', 'hz'] },
  { name: '成都', regionLabel: '中国 · 四川 · 成都', province: '四川', city: '成都', latitude: 30.5728, longitude: 104.0668, aliases: ['chengdu', 'cd'] },
  { name: '武汉', regionLabel: '中国 · 湖北 · 武汉', province: '湖北', city: '武汉', latitude: 30.5928, longitude: 114.3055, aliases: ['wuhan', 'wh'] },
  { name: '哈尔滨', regionLabel: '中国 · 黑龙江 · 哈尔滨', province: '黑龙江', city: '哈尔滨', latitude: 45.8038, longitude: 126.535, aliases: ['haerbin', 'harbin', 'hrb'] },
  { name: '天津', regionLabel: '中国 · 天津', province: '天津', city: '天津', latitude: 39.0842, longitude: 117.201, aliases: ['tianjin', 'tj'] },
  { name: '重庆', regionLabel: '中国 · 重庆', province: '重庆', city: '重庆', latitude: 29.563, longitude: 106.5516, aliases: ['chongqing', 'cq'] },
  { name: '南京', regionLabel: '中国 · 江苏 · 南京', province: '江苏', city: '南京', latitude: 32.0603, longitude: 118.7969, aliases: ['nanjing', 'nj'] },
  { name: '苏州', regionLabel: '中国 · 江苏 · 苏州', province: '江苏', city: '苏州', latitude: 31.299, longitude: 120.5853, aliases: ['suzhou'] },
  { name: '西安', regionLabel: '中国 · 陕西 · 西安', province: '陕西', city: '西安', latitude: 34.3416, longitude: 108.9398, aliases: ['xian', "xi'an"] },
  { name: '长沙', regionLabel: '中国 · 湖南 · 长沙', province: '湖南', city: '长沙', latitude: 28.2282, longitude: 112.9388, aliases: ['changsha'] },
  { name: '青岛', regionLabel: '中国 · 山东 · 青岛', province: '山东', city: '青岛', latitude: 36.0671, longitude: 120.3826, aliases: ['qingdao'] },
  { name: '济南', regionLabel: '中国 · 山东 · 济南', province: '山东', city: '济南', latitude: 36.6512, longitude: 117.1201, aliases: ['jinan'] },
  { name: '厦门', regionLabel: '中国 · 福建 · 厦门', province: '福建', city: '厦门', latitude: 24.4798, longitude: 118.0894, aliases: ['xiamen'] },
  { name: '福州', regionLabel: '中国 · 福建 · 福州', province: '福建', city: '福州', latitude: 26.0745, longitude: 119.2965, aliases: ['fuzhou'] },
  { name: '昆明', regionLabel: '中国 · 云南 · 昆明', province: '云南', city: '昆明', latitude: 25.0389, longitude: 102.7183, aliases: ['kunming'] },
  { name: '大理', regionLabel: '中国 · 云南 · 大理', province: '云南', city: '大理', latitude: 25.6065, longitude: 100.2676, aliases: ['dali'] },
  { name: '丽江', regionLabel: '中国 · 云南 · 丽江', province: '云南', city: '丽江', latitude: 26.855, longitude: 100.2278, aliases: ['lijiang'] },
  { name: '拉萨', regionLabel: '中国 · 西藏 · 拉萨', province: '西藏', city: '拉萨', latitude: 29.6525, longitude: 91.1721, aliases: ['lhasa', 'lasa'] },
  { name: '乌鲁木齐', regionLabel: '中国 · 新疆 · 乌鲁木齐', province: '新疆', city: '乌鲁木齐', latitude: 43.8256, longitude: 87.6168, aliases: ['wulumuqi', 'urumqi'] },
  { name: '沈阳', regionLabel: '中国 · 辽宁 · 沈阳', province: '辽宁', city: '沈阳', latitude: 41.8057, longitude: 123.4315, aliases: ['shenyang'] },
  { name: '大连', regionLabel: '中国 · 辽宁 · 大连', province: '辽宁', city: '大连', latitude: 38.914, longitude: 121.6147, aliases: ['dalian'] },
  { name: '长春', regionLabel: '中国 · 吉林 · 长春', province: '吉林', city: '长春', latitude: 43.8171, longitude: 125.3235, aliases: ['changchun'] },
  { name: '漠河', regionLabel: '中国 · 黑龙江 · 漠河', province: '黑龙江', city: '大兴安岭', county: '漠河', latitude: 52.972, longitude: 122.536, aliases: ['mohe'] },
  { name: '海口', regionLabel: '中国 · 海南 · 海口', province: '海南', city: '海口', latitude: 20.044, longitude: 110.1983, aliases: ['haikou'] },
  { name: '三亚', regionLabel: '中国 · 海南 · 三亚', province: '海南', city: '三亚', latitude: 18.2528, longitude: 109.512, aliases: ['sanya'] },
  { name: '合肥', regionLabel: '中国 · 安徽 · 合肥', province: '安徽', city: '合肥', latitude: 31.8206, longitude: 117.2272, aliases: ['hefei'] },
  { name: '郑州', regionLabel: '中国 · 河南 · 郑州', province: '河南', city: '郑州', latitude: 34.7466, longitude: 113.6253, aliases: ['zhengzhou'] },
  { name: '宁波', regionLabel: '中国 · 浙江 · 宁波', province: '浙江', city: '宁波', latitude: 29.8683, longitude: 121.544, aliases: ['ningbo'] },
  { name: '珠海', regionLabel: '中国 · 广东 · 珠海', province: '广东', city: '珠海', latitude: 22.271, longitude: 113.5767, aliases: ['zhuhai'] },
  { name: '贵阳', regionLabel: '中国 · 贵州 · 贵阳', province: '贵州', city: '贵阳', latitude: 26.647, longitude: 106.6302, aliases: ['guiyang'] },
  { name: '香港', regionLabel: '中国 · 香港', province: '香港', city: '香港', latitude: 22.3193, longitude: 114.1694, aliases: ['hongkong', 'hk'] },
  { name: '台北', regionLabel: '中国 · 台湾 · 台北', province: '台湾', city: '台北', latitude: 25.033, longitude: 121.5654, aliases: ['taipei', 'taibei'] },
];

export const QUICK_CITIES: WeatherLocationCandidate[] = DOMESTIC_CITY_CATALOG.slice(0, 8).map(
  ({ aliases: _aliases, ...rest }) => rest,
);

export const DEFAULT_WEATHER: WeatherSettings = {
  mode: 'custom',
  renderMode: 'auto',
  quality: 'balanced',
  locationQuery: '北京',
  latitude: 39.9042,
  longitude: 116.4074,
  regionLabel: '中国 · 北京',
  province: '北京',
  city: '北京',
  customEffects: ['clear-sun', 'rain', 'rainbow'],
  timeOfDay: 'auto',
  randomIntervalSeconds: 60,
  effectIntensity: 1.0,
  rainStreakOpacity: 0.55,
  glassOpacity: 0.05,
  darkMaskOpacity: 0.3,
  adaptColorByTime: true,
};

const BEAUFORT_KMH = [1, 4, 9, 16, 24, 34, 44, 56, 68, 82, 96, 110, 125];

export function beaufortToKmh(power: string | number | undefined): number {
  if (typeof power === 'number' && Number.isFinite(power)) {
    const lvl = Math.max(0, Math.min(12, Math.round(power)));
    return BEAUFORT_KMH[lvl];
  }
  const str = String(power ?? '');
  const nums = str.match(/\d+/g)?.map(Number).filter((n) => Number.isFinite(n)) ?? [];
  if (nums.length === 0) return 10;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const lvl = Math.max(0, Math.min(12, Math.round(avg)));
  return BEAUFORT_KMH[lvl];
}

export function computeApparentTempC(tempC: number, humidity: number, windSpeedKmh: number): number {
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  const wsMs = Math.max(0, windSpeedKmh) / 3.6;
  const apparent = tempC + 0.33 * e - 0.7 * wsMs - 4.0;
  return Math.round(apparent * 10) / 10;
}

export function resolveIsDayFromRise(
  riseEntry?: { sunrise?: string; sunset?: string },
  now: Date = new Date(),
): boolean {
  const parseHm = (s?: string): number | null => {
    const m = s?.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sr = parseHm(riseEntry?.sunrise);
  const ss = parseHm(riseEntry?.sunset);
  if (sr !== null && ss !== null && ss > sr) {
    return nowMin >= sr && nowMin < ss;
  }
  const hr = now.getHours();
  return hr >= 6 && hr < 18;
}

export function mapWmoCodeToEffects(
  code: number,
  opts?: { isDay?: boolean; cloudCover?: number; windSpeedKmh?: number; latitude?: number },
): { descriptionZh: string; effects: WeatherEffectId[] } {
  const isDay = opts?.isDay ?? true;
  const cloudCover = opts?.cloudCover ?? 40;
  const windSpeedKmh = opts?.windSpeedKmh ?? 8;
  const latitude = opts?.latitude ?? 35;

  let descriptionZh = '晴朗';
  const effects = new Set<WeatherEffectId>();

  if (code === 0) {
    descriptionZh = isDay ? '晴空万里' : '晴朗星空';
    effects.add('clear-sun');
  } else if (code === 1 || code === 2) {
    descriptionZh = code === 1 ? '晴间少云' : '局部多云';
    effects.add('clear-sun');
    effects.add('clouds');
  } else if (code === 3) {
    descriptionZh = '阴云满天';
    effects.add('clouds');
  } else if (code === 45 || code === 48) {
    descriptionZh = code === 48 ? '冻雾笼罩' : '轻雾朦胧';
    effects.add('clouds');
    effects.add('fog');
  } else if (code >= 51 && code <= 57) {
    descriptionZh = code >= 56 ? '冻毛毛雨' : '细雨霏霏';
    effects.add('clouds');
    effects.add('rain');
    effects.add('fog');
  } else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const heavy = code === 65 || code === 67 || code === 82;
    descriptionZh = code >= 80 ? (heavy ? '强阵雨' : '阵雨') : heavy ? '大雨' : code === 63 ? '中雨' : '小雨';
    effects.add('clouds');
    effects.add('rain');
    if (code === 80 && isDay && cloudCover < 75) {
      effects.add('clear-sun');
      effects.add('rainbow');
      descriptionZh = '太阳阵雨 · 虹光';
    }
  } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    descriptionZh = code === 75 || code === 86 ? '大雪纷飞' : code === 73 ? '中雪' : '小雪飘落';
    effects.add('clouds');
    effects.add('snow');
  } else if (code >= 95) {
    descriptionZh = code >= 96 ? '强雷暴冰雹' : '雷阵雨';
    effects.add('clouds');
    effects.add('rain');
    effects.add('thunder');
  } else {
    descriptionZh = '微云清朗';
    effects.add('clear-sun');
    effects.add('clouds');
  }

  if (windSpeedKmh >= 24) {
    effects.add('wind-petals');
  }
  if (Math.abs(latitude) >= 60 && !isDay && cloudCover < 60) {
    effects.add('aurora');
  }

  return { descriptionZh, effects: Array.from(effects) };
}

export function mapChineseWeatherToEffects(
  weatherText: string,
  opts?: { isDay?: boolean; windSpeedKmh?: number; latitude?: number; cloudCover?: number },
): { descriptionZh: string; weatherCode: number; effects: WeatherEffectId[] } {
  const raw = weatherText.trim() || '晴';
  const isDay = opts?.isDay ?? true;
  const windSpeedKmh = opts?.windSpeedKmh ?? 10;
  const latitude = opts?.latitude ?? 35;

  const effects = new Set<WeatherEffectId>();
  let weatherCode = 0;

  if (/雷|电/.test(raw)) {
    weatherCode = 95;
    effects.add('clouds');
    effects.add('rain');
    effects.add('thunder');
  } else if (/雪|冰粒|冰雹|冻雨/.test(raw)) {
    weatherCode = /大雪|暴雪/.test(raw) ? 75 : 73;
    effects.add('clouds');
    effects.add('snow');
    if (/雨夹雪|冻雨/.test(raw)) {
      effects.add('rain');
    }
  } else if (/太阳雨/.test(raw)) {
    weatherCode = 80;
    effects.add('clear-sun');
    effects.add('rain');
    effects.add('rainbow');
  } else if (/阵雨/.test(raw)) {
    weatherCode = 80;
    effects.add('clouds');
    effects.add('rain');
    if (isDay && !/强|大|暴/.test(raw)) {
      effects.add('clear-sun');
      effects.add('rainbow');
    }
  } else if (/毛毛雨|细雨|小雨/.test(raw)) {
    weatherCode = /毛毛雨|细雨/.test(raw) ? 51 : 61;
    effects.add('clouds');
    effects.add('rain');
    if (/毛毛雨|细雨/.test(raw)) {
      effects.add('fog');
    }
  } else if (/雨/.test(raw)) {
    weatherCode = /大|暴/.test(raw) ? 65 : 63;
    effects.add('clouds');
    effects.add('rain');
  } else if (/雾|霾|沙|尘/.test(raw)) {
    weatherCode = 45;
    effects.add('clouds');
    effects.add('fog');
  } else if (/阴/.test(raw)) {
    weatherCode = 3;
    effects.add('clouds');
  } else if (/多云|少云|间晴/.test(raw)) {
    weatherCode = 2;
    effects.add('clear-sun');
    effects.add('clouds');
  } else if (/晴/.test(raw)) {
    weatherCode = 0;
    effects.add('clear-sun');
  } else {
    weatherCode = 1;
    effects.add('clear-sun');
    effects.add('clouds');
  }

  if (windSpeedKmh >= 24 || /风/.test(raw)) {
    effects.add('wind-petals');
  }
  if (Math.abs(latitude) >= 52 && !isDay && !effects.has('rain') && !effects.has('fog')) {
    effects.add('aurora');
  }

  return {
    descriptionZh: raw,
    weatherCode,
    effects: Array.from(effects),
  };
}

function estimateCloudCover(weatherText: string): number {
  if (/阴|雷|暴|雨|雪/.test(weatherText)) return 85;
  if (/多云/.test(weatherText)) return 52;
  if (/少云|雾|霾/.test(weatherText)) return 32;
  return 10;
}

function findCatalogCity(query: string): DomesticCityEntry | undefined {
  const norm = query.trim().toLowerCase().replace(/[市省区县]/g, '');
  if (!norm) return undefined;
  return DOMESTIC_CITY_CATALOG.find(
    (c) =>
      c.name.toLowerCase() === norm ||
      c.city?.toLowerCase() === norm ||
      c.aliases.some((a) => a === norm),
  );
}

function normalizeAdminName(part: string): string {
  return part.trim().replace(/(?:省|市|自治区|特别行政区)$/u, '');
}

let jsonpSeq = 0;

function fetchJsonp<T>(url: string, timeoutMs = 8000): Promise<T> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('JSONP requires a browser DOM environment'));
  }
  return new Promise<T>((resolve, reject) => {
    const cbName = `__arcWeatherCb_${Date.now()}_${++jsonpSeq}`;
    const win = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      delete win[cbName];
      script.remove();
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('国内气象服务请求超时'));
    }, timeoutMs);

    win[cbName] = (payload: T) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('国内气象服务脚本加载失败'));
    };

    const sep = url.includes('?') ? '&' : '?';
    script.src = `${url}${sep}callback=${encodeURIComponent(cbName)}`;
    script.async = true;
    document.head.appendChild(script);
  });
}

async function requestTencentJson<T>(url: string, fetchImpl?: typeof fetch): Promise<T> {
  if (fetchImpl) {
    const resp = await fetchImpl(url);
    if (!resp.ok) {
      throw new Error(`腾讯天气服务响应异常 (${resp.status})`);
    }
    return (await resp.json()) as T;
  }
  if (typeof document !== 'undefined') {
    return fetchJsonp<T>(url);
  }
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`腾讯天气服务响应异常 (${resp.status})`);
  }
  return (await resp.json()) as T;
}

interface TencentCityResponse {
  status?: number;
  data?: Record<string, string | { province?: string; name?: string; county?: string }> | Array<{
    province?: string;
    name?: string;
    city?: string;
    county?: string;
  }>;
}

function parseTencentCityCandidates(payload: TencentCityResponse): WeatherLocationCandidate[] {
  if (!payload || (payload.status !== undefined && payload.status !== 200) || !payload.data) {
    return [];
  }

  const out: WeatherLocationCandidate[] = [];
  const seen = new Set<string>();

  const pushEntry = (provinceRaw?: string, cityRaw?: string, countyRaw?: string) => {
    const province = (provinceRaw ?? '').trim();
    const city = (cityRaw ?? province).trim();
    const county = countyRaw?.trim() || undefined;
    const displayName = county || city || province;
    if (!displayName) return;

    const parts = ['中国', province, city, county].filter(
      (p, idx, arr): p is string => Boolean(p && p.trim()) && arr.indexOf(p) === idx,
    );
    const key = `${province}|${city}|${county ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);

    const matched = findCatalogCity(displayName) ?? findCatalogCity(city);
    out.push({
      name: displayName,
      regionLabel: parts.join(' · '),
      latitude: matched?.latitude ?? 35.0,
      longitude: matched?.longitude ?? 105.0,
      province: province || matched?.province,
      city: city || matched?.city,
      county,
    });
  };

  if (Array.isArray(payload.data)) {
    for (const item of payload.data) {
      pushEntry(item.province, item.city ?? item.name, item.county);
    }
    return out;
  }

  for (const val of Object.values(payload.data)) {
    if (typeof val === 'string') {
      const segs = val
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs.length >= 2) {
        pushEntry(segs[0], segs[1], segs[2]);
      } else if (segs.length === 1) {
        pushEntry(segs[0], segs[0]);
      }
    } else if (val && typeof val === 'object') {
      const inner = val as Record<string, unknown>;
      if ('province' in inner || 'name' in inner) {
        pushEntry(
          String(inner.province ?? ''),
          String(inner.name ?? ''),
          inner.county ? String(inner.county) : undefined,
        );
      } else {
        for (const sub of Object.values(inner)) {
          if (sub && typeof sub === 'object') {
            const subObj = sub as Record<string, unknown>;
            pushEntry(
              String(subObj.province ?? ''),
              String(subObj.name ?? ''),
              subObj.county ? String(subObj.county) : undefined,
            );
          }
        }
      }
    }
  }

  return out;
}

export async function searchWeatherLocations(
  query: string,
  fetchImpl?: typeof fetch,
): Promise<WeatherLocationCandidate[]> {
  const q = query.trim();
  if (!q) return [];

  const catalogMatches = DOMESTIC_CITY_CATALOG.filter((c) => {
    const ql = q.toLowerCase();
    return (
      c.name.includes(q) ||
      (c.province?.includes(q) ?? false) ||
      c.aliases.some((a) => a.includes(ql))
    );
  }).map(({ aliases: _aliases, ...rest }) => rest);

  const searchKeyword = catalogMatches[0]?.name ?? q;
  const url = `https://wis.qq.com/city/like?source=pc&city=${encodeURIComponent(searchKeyword)}`;

  try {
    const payload = await requestTencentJson<TencentCityResponse>(url, fetchImpl);
    const parsed = parseTencentCityCandidates(payload);
    if (parsed.length > 0) {
      return parsed.slice(0, 6);
    }
  } catch {
    // Fall through to local Chinese city catalog or direct city fallback
  }

  if (catalogMatches.length > 0) {
    return catalogMatches.slice(0, 6);
  }

  const clean = normalizeAdminName(q) || q;
  return [
    {
      name: clean,
      regionLabel: `中国 · ${clean}`,
      province: clean,
      city: clean,
      latitude: 35.0,
      longitude: 105.0,
    },
  ];
}

export interface FetchLiveWeatherOptions {
  fetchImpl?: typeof fetch;
  province?: string;
  city?: string;
  county?: string;
}

interface TencentWeatherResponse {
  status?: number;
  data?: {
    observe?: {
      degree?: string | number;
      humidity?: string | number;
      weather?: string;
      wind_power?: string | number;
    };
    rise?: Record<string, { sunrise?: string; sunset?: string }>;
  };
}

interface UapiWeatherResponse {
  province?: string;
  city?: string;
  district?: string;
  weather?: string;
  temperature?: string | number;
  feelst?: string | number;
  humidity?: string | number;
  wind_speed?: string | number;
  wind_power?: string | number;
  update_time?: string;
}

function resolveAdminParams(
  cityName: string,
  regionLabel: string,
  opts?: FetchLiveWeatherOptions,
): { province: string; city: string; county?: string } {
  if (opts?.province && opts?.city) {
    return {
      province: normalizeAdminName(opts.province),
      city: normalizeAdminName(opts.city),
      county: opts.county ? normalizeAdminName(opts.county) : undefined,
    };
  }

  const catalog = findCatalogCity(cityName);
  if (catalog?.province && catalog?.city) {
    return {
      province: catalog.province,
      city: catalog.city,
      county: catalog.county,
    };
  }

  const parts = regionLabel
    .split(/[·,]/)
    .map((s) => normalizeAdminName(s))
    .filter((s) => s && s !== '中国');

  if (parts.length >= 2) {
    return { province: parts[0], city: parts[1], county: parts[2] };
  }
  const cleanCity = normalizeAdminName(cityName) || parts[0] || '北京';
  return { province: cleanCity, city: cleanCity };
}

export async function fetchLiveWeather(
  lat: number,
  lon: number,
  cityName: string,
  regionLabel: string,
  fetchOrOpts?: typeof fetch | FetchLiveWeatherOptions,
): Promise<LiveWeatherSnapshot> {
  const opts: FetchLiveWeatherOptions =
    typeof fetchOrOpts === 'function' ? { fetchImpl: fetchOrOpts } : (fetchOrOpts ?? {});
  const customFetch = opts.fetchImpl;
  const admin = resolveAdminParams(cityName, regionLabel, opts);

  const tencentParams = new URLSearchParams({
    source: 'pc',
    province: admin.province,
    city: admin.city,
    weather_type: 'observe|rise',
  });
  if (admin.county) {
    tencentParams.set('county', admin.county);
  }
  const tencentUrl = `https://wis.qq.com/weather/common?${tencentParams.toString()}`;

  try {
    const tencentPayload = await requestTencentJson<TencentWeatherResponse>(tencentUrl, customFetch);
    const obs = tencentPayload?.data?.observe;
    const temp = Number(obs?.degree);
    if (
      tencentPayload &&
      (tencentPayload.status === undefined || tencentPayload.status === 200) &&
      obs &&
      Number.isFinite(temp) &&
      typeof obs.weather === 'string' &&
      obs.weather.trim().length > 0
    ) {
      const humidity = Math.max(0, Math.min(100, Math.round(Number(obs.humidity ?? 50))));
      const windSpeedKmh = beaufortToKmh(obs.wind_power);
      const isDay = resolveIsDayFromRise(tencentPayload.data?.rise?.['0']);
      const cloudCover = estimateCloudCover(obs.weather);
      const mapped = mapChineseWeatherToEffects(obs.weather, {
        isDay,
        cloudCover,
        windSpeedKmh,
        latitude: lat,
      });

      return {
        cityName,
        regionLabel,
        latitude: lat,
        longitude: lon,
        temperatureC: Math.round(temp * 10) / 10,
        apparentTempC: computeApparentTempC(temp, humidity, windSpeedKmh),
        humidity,
        windSpeedKmh: Math.round(windSpeedKmh * 10) / 10,
        cloudCover,
        weatherCode: mapped.weatherCode,
        descriptionZh: mapped.descriptionZh,
        isDay,
        mappedEffects: mapped.effects,
        fetchedAt: new Date().toISOString(),
        sourceName: '腾讯天气',
      };
    }
  } catch {
    // Fall through to secondary domestic provider
  }

  const doFetch = customFetch ?? fetch;
  const uapiUrl = `https://uapis.cn/api/v1/misc/weather?city=${encodeURIComponent(cityName)}&extended=true`;
  try {
    const resp = await doFetch(uapiUrl);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = (await resp.json()) as UapiWeatherResponse;
    const temp = Number(data.temperature);
    if (!Number.isFinite(temp) || !data.weather) {
      throw new Error('返回数据不完整');
    }
    const humidity = Math.max(0, Math.min(100, Math.round(Number(data.humidity ?? 50))));
    const rawWind = Number(data.wind_speed);
    const windSpeedKmh = Number.isFinite(rawWind)
      ? Math.round(rawWind * 3.6 * 10) / 10
      : beaufortToKmh(data.wind_power);
    const apparentNum = Number(data.feelst);
    const apparentTempC = Number.isFinite(apparentNum)
      ? Math.round(apparentNum * 10) / 10
      : computeApparentTempC(temp, humidity, windSpeedKmh);
    const isDay = resolveIsDayFromRise();
    const cloudCover = estimateCloudCover(data.weather);
    const mapped = mapChineseWeatherToEffects(data.weather, {
      isDay,
      cloudCover,
      windSpeedKmh,
      latitude: lat,
    });

    return {
      cityName,
      regionLabel,
      latitude: lat,
      longitude: lon,
      temperatureC: Math.round(temp * 10) / 10,
      apparentTempC,
      humidity,
      windSpeedKmh,
      cloudCover,
      weatherCode: mapped.weatherCode,
      descriptionZh: mapped.descriptionZh,
      isDay,
      mappedEffects: mapped.effects,
      fetchedAt: new Date().toISOString(),
      sourceName: '国内气象源',
    };
  } catch {
    throw new Error('国内实时天气服务暂时不可用，请检查网络连接');
  }
}

export function pickRandomWeatherCombo(
  previousSignature?: string,
  rng: () => number = Math.random,
): {
  labelZh: string;
  effects: WeatherEffectId[];
  timeOfDay: WeatherTimeOfDay;
  signature: string;
} {
  const pool = WEATHER_PRESET_COMBOS.map((p) => ({
    labelZh: p.labelZh,
    effects: [...p.effects],
    timeOfDay: p.timeOfDay,
    signature: `${p.id}:${p.timeOfDay}`,
  }));
  const candidates = previousSignature
    ? pool.filter((item) => item.signature !== previousSignature)
    : pool;
  const pickFrom = candidates.length > 0 ? candidates : pool;
  const idx = Math.min(pickFrom.length - 1, Math.floor(rng() * pickFrom.length));
  return pickFrom[Math.max(0, idx)];
}
