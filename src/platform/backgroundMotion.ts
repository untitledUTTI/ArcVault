import type { GyroscopeSettings } from '../types/archive';

export const MOBILE_SWIPE_THRESHOLD_PX = 10;
export const MOBILE_LONG_PRESS_MS = 320;
const GYRO_RELEASE_GRACE_MS = 500;
const GYRO_RECALIBRATE_EVENT = 'arcvault://gyro-recalibrate';

export const DEFAULT_GYROSCOPE: GyroscopeSettings = {
  enabled: false,
  sensitivity: 1.0,
};

export function normalizeGyroscopeSettings(
  raw?: Partial<GyroscopeSettings> | null,
): GyroscopeSettings {
  const sens =
    typeof raw?.sensitivity === 'number' && Number.isFinite(raw.sensitivity)
      ? Math.max(0.4, Math.min(2.0, Math.round(raw.sensitivity * 10) / 10))
      : DEFAULT_GYROSCOPE.sensitivity;

  return {
    enabled: Boolean(raw?.enabled ?? DEFAULT_GYROSCOPE.enabled),
    sensitivity: sens,
  };
}

export interface MobileGestureGate {
  onDown: (x: number, y: number, nowMs?: number) => void;
  onMove: (x: number, y: number) => boolean;
  activateLongPress: () => boolean;
  onUp: () => void;
  isPressed: () => boolean;
  isActive: () => boolean;
}

/**
 * Pure state machine ensuring phone/tablet taps NEVER move the background;
 * only sustained long-press (>=320ms) or drag/swipe (>=10px) activates tracking.
 */
export function createMobileGestureGate(options?: {
  swipeThresholdPx?: number;
  longPressMs?: number;
}): MobileGestureGate {
  const threshold = options?.swipeThresholdPx ?? MOBILE_SWIPE_THRESHOLD_PX;
  let pressed = false;
  let active = false;
  let startX = 0;
  let startY = 0;

  return {
    onDown(x: number, y: number) {
      pressed = true;
      active = false;
      startX = x;
      startY = y;
    },
    onMove(x: number, y: number): boolean {
      if (!pressed) return false;
      if (!active && Math.hypot(x - startX, y - startY) >= threshold) {
        active = true;
      }
      return active;
    },
    activateLongPress(): boolean {
      if (!pressed) return false;
      active = true;
      return true;
    },
    onUp() {
      pressed = false;
      active = false;
    },
    isPressed: () => pressed,
    isActive: () => active,
  };
}

function clamp01(v: number, min = 0.04, max = 0.96): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Maps DeviceOrientation (beta/gamma) relative to neutral handheld baseline
 * into normalized [0.04, 0.96] background parallax target coordinates.
 */
export function mapOrientationToTarget(params: {
  beta: number;
  gamma: number;
  baseBeta: number;
  baseGamma: number;
  screenAngle?: number;
  sensitivity?: number;
}): { x: number; y: number } {
  const sens = Math.max(0.4, Math.min(2.0, params.sensitivity ?? 1.0));
  let dxDeg = params.gamma - params.baseGamma;
  let dyDeg = params.beta - params.baseBeta;

  // Normalize angle wrap-around
  if (dxDeg > 180) dxDeg -= 360;
  if (dxDeg < -180) dxDeg += 360;
  if (dyDeg > 180) dyDeg -= 360;
  if (dyDeg < -180) dyDeg += 360;

  const angle = ((params.screenAngle ?? 0) % 360 + 360) % 360;
  if (angle === 90) {
    const tmp = dxDeg;
    dxDeg = dyDeg;
    dyDeg = -tmp;
  } else if (angle === 270) {
    const tmp = dxDeg;
    dxDeg = -dyDeg;
    dyDeg = tmp;
  } else if (angle === 180) {
    dxDeg = -dxDeg;
    dyDeg = -dyDeg;
  }

  // +-32 deg maps across full normalized range at sensitivity 1.0
  const span = 64 / sens;
  return {
    x: clamp01(0.5 + dxDeg / span),
    y: clamp01(0.38 + dyDeg / span),
  };
}

export async function requestGyroscopePermission(): Promise<{
  granted: boolean;
  supported: boolean;
  message: string;
}> {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
    return {
      granted: false,
      supported: false,
      message: '当前设备或浏览器不支持陀螺仪方向传感器。',
    };
  }

  const devOri = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };

  if (typeof devOri.requestPermission === 'function') {
    try {
      const state = await devOri.requestPermission();
      if (state === 'granted') {
        return {
          granted: true,
          supported: true,
          message: '已授权访问陀螺仪，倾斜设备即可控制动态背景（不影响长按与滑动）。',
        };
      }
      return {
        granted: false,
        supported: true,
        message: '未授予陀螺仪权限，请在系统设置中允许方向传感器访问。',
      };
    } catch {
      return {
        granted: false,
        supported: true,
        message: '请求陀螺仪权限失败（iOS 需在 HTTPS 或原生容器内触发）。',
      };
    }
  }

  return {
    granted: true,
    supported: true,
    message: '已开启陀螺仪控制动态背景（长按与滑动仍可随时接管交互）。',
  };
}

export function recalibrateGyroscopeBaseline(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GYRO_RECALIBRATE_EVENT));
  }
}

export interface BackgroundMotionSample {
  x: number;
  y: number;
  vx: number;
  vy: number;
  source: 'desktop-pointer' | 'gesture' | 'gyro';
}

export function attachBackgroundMotionController(opts: {
  getContainer: () => HTMLElement | null;
  isMobileOrTablet: boolean;
  gyroscope?: GyroscopeSettings;
  onUpdate: (sample: BackgroundMotionSample) => void;
}): () => void {
  const gyro = normalizeGyroscopeSettings(opts.gyroscope);
  const gate = createMobileGestureGate();
  let longPressTimer: number | null = null;
  let lastGestureReleaseMs = 0;
  let lastPos = { x: 0.5, y: 0.35 };
  let gyroBaseline: { beta: number; gamma: number } | null = null;

  const normalizeCoords = (clientX: number, clientY: number) => {
    const rect = opts.getContainer()?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const w = Math.max(1, rect?.width || window.innerWidth);
    const h = Math.max(1, rect?.height || window.innerHeight);
    return {
      x: Math.max(0, Math.min(1, (clientX - left) / w)),
      y: Math.max(0, Math.min(1, (clientY - top) / h)),
    };
  };

  const clearLongPressTimer = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const emitSample = (
    x: number,
    y: number,
    source: BackgroundMotionSample['source'],
    withVelocity = true,
  ) => {
    const vx = withVelocity ? Math.max(-0.08, Math.min(0.08, x - lastPos.x)) : 0;
    const vy = withVelocity ? Math.max(-0.08, Math.min(0.08, y - lastPos.y)) : 0;
    lastPos = { x, y };
    opts.onUpdate({ x, y, vx, vy, source });
  };

  const onDesktopMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const pos = normalizeCoords(e.clientX, e.clientY);
    emitSample(pos.x, pos.y, 'desktop-pointer', true);
  };

  const onMobilePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    gate.onDown(e.clientX, e.clientY, performance.now());
    clearLongPressTimer();
    const cx = e.clientX;
    const cy = e.clientY;
    longPressTimer = window.setTimeout(() => {
      longPressTimer = null;
      if (gate.activateLongPress()) {
        const pos = normalizeCoords(cx, cy);
        emitSample(pos.x, pos.y, 'gesture', false);
      }
    }, MOBILE_LONG_PRESS_MS);
  };

  const onMobilePointerMove = (e: PointerEvent) => {
    if (!gate.isPressed()) return;
    const becameActive = gate.onMove(e.clientX, e.clientY);
    if (!becameActive) return;
    clearLongPressTimer();
    const pos = normalizeCoords(e.clientX, e.clientY);
    emitSample(pos.x, pos.y, 'gesture', true);
  };

  const onMobilePointerUp = () => {
    const wasActive = gate.isActive();
    clearLongPressTimer();
    gate.onUp();
    if (wasActive) {
      lastGestureReleaseMs = performance.now();
    }
  };

  const onDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (!gyro.enabled) return;
    if (typeof e.beta !== 'number' || typeof e.gamma !== 'number') return;
    // Never override an active long-press or swipe (nor within brief release grace period)
    if (gate.isActive() || performance.now() - lastGestureReleaseMs < GYRO_RELEASE_GRACE_MS) {
      return;
    }
    if (!gyroBaseline) {
      gyroBaseline = { beta: e.beta, gamma: e.gamma };
    }
    const screenAngle =
      typeof window.screen?.orientation?.angle === 'number'
        ? window.screen.orientation.angle
        : 0;
    const target = mapOrientationToTarget({
      beta: e.beta,
      gamma: e.gamma,
      baseBeta: gyroBaseline.beta,
      baseGamma: gyroBaseline.gamma,
      screenAngle,
      sensitivity: gyro.sensitivity,
    });
    emitSample(target.x, target.y, 'gyro', false);
  };

  const onRecalibrate = () => {
    gyroBaseline = null;
  };

  if (opts.isMobileOrTablet) {
    window.addEventListener('pointerdown', onMobilePointerDown, { passive: true, capture: true });
    window.addEventListener('pointermove', onMobilePointerMove, { passive: true, capture: true });
    window.addEventListener('pointerup', onMobilePointerUp, { passive: true, capture: true });
    window.addEventListener('pointercancel', onMobilePointerUp, { passive: true, capture: true });
  } else {
    window.addEventListener('pointermove', onDesktopMove, { passive: true });
  }

  if (gyro.enabled) {
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    window.addEventListener(GYRO_RECALIBRATE_EVENT, onRecalibrate);
  }

  return () => {
    clearLongPressTimer();
    window.removeEventListener('pointermove', onDesktopMove);
    window.removeEventListener('pointerdown', onMobilePointerDown, true);
    window.removeEventListener('pointermove', onMobilePointerMove, true);
    window.removeEventListener('pointerup', onMobilePointerUp, true);
    window.removeEventListener('pointercancel', onMobilePointerUp, true);
    window.removeEventListener('deviceorientation', onDeviceOrientation);
    window.removeEventListener(GYRO_RECALIBRATE_EVENT, onRecalibrate);
  };
}
