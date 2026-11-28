export type BackActionResult = 'handled' | 'exit' | 'unhandled';

export type BackHandler = () => boolean;

interface RegisteredBackHandler {
  id: number;
  priority: number;
  handler: BackHandler;
}

const handlers: RegisteredBackHandler[] = [];
let nextHandlerId = 1;

export const BOARD_PAN_BLOCK_SELECTOR =
  '.arc-blackboard-toolbar, .arc-blackboard-capsule, .arc-bb-modal-backdrop, .arc-bb-modal, input, textarea, select';

/**
 * Allows dragging the blackboard when a touch/pointer begins on the canvas,
 * sticky notes, or stickers, while blocking interactive toolbars, capsules,
 * modals, and text inputs.
 */
export function shouldStartBoardPan(
  target: { closest?: (selector: string) => unknown } | null,
): boolean {
  if (!target || typeof target.closest !== 'function') return true;
  return !target.closest(BOARD_PAN_BLOCK_SELECTOR);
}

/**
 * Registers a system back handler with priority ordering (higher priority runs first;
 * equal priority runs LIFO so nested views/dialogs intercept before outer views).
 */
export function registerBackHandler(handler: BackHandler, priority = 0): () => void {
  const entry: RegisteredBackHandler = {
    id: nextHandlerId++,
    priority,
    handler,
  };
  handlers.push(entry);
  return () => {
    const idx = handlers.findIndex((item) => item.id === entry.id);
    if (idx >= 0) {
      handlers.splice(idx, 1);
    }
  };
}

export function dispatchSystemBack(): boolean {
  const ordered = [...handlers].sort(
    (a, b) => b.priority - a.priority || b.id - a.id,
  );
  for (const entry of ordered) {
    if (entry.handler()) {
      return true;
    }
  }
  return false;
}

interface ArcBackWindow extends Window {
  __ARC_HANDLE_BACK__?: () => BackActionResult;
  __ARC_ANDROID_BACK__?: {
    exitApp?: () => boolean;
  };
}

export function hasAndroidNativeBackBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as ArcBackWindow;
  return typeof win.__ARC_ANDROID_BACK__?.exitApp === 'function';
}

export function exitAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as ArcBackWindow;
  if (typeof win.__ARC_ANDROID_BACK__?.exitApp === 'function') {
    return Boolean(win.__ARC_ANDROID_BACK__.exitApp());
  }
  return false;
}

/**
 * Installs `window.__ARC_HANDLE_BACK__` for Android-Tauri native back interception,
 * and adds a History API popstate guard on mobile web browsers when the native
 * Android bridge is absent.
 */
export function installGlobalBackDispatcher(
  onRootBack: () => BackActionResult,
  options?: { enableBrowserPopState?: boolean },
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const win = window as ArcBackWindow;
  const previousHook = win.__ARC_HANDLE_BACK__;

  const runBackChain = (): BackActionResult => {
    if (dispatchSystemBack()) {
      return 'handled';
    }
    return onRootBack();
  };

  win.__ARC_HANDLE_BACK__ = runBackChain;

  const usePopState = Boolean(
    options?.enableBrowserPopState && !hasAndroidNativeBackBridge(),
  );
  let onPopState: (() => void) | null = null;

  if (usePopState && typeof window.history?.pushState === 'function') {
    try {
      if (!(window.history.state && (window.history.state as { arcBackGuard?: boolean }).arcBackGuard)) {
        window.history.pushState({ arcBackGuard: true }, '');
      }
      onPopState = () => {
        const res = runBackChain();
        if (res === 'handled') {
          try {
            window.history.pushState({ arcBackGuard: true }, '');
          } catch {
            // ignore history restriction
          }
        }
      };
      window.addEventListener('popstate', onPopState);
    } catch {
      onPopState = null;
    }
  }

  return () => {
    if (onPopState) {
      window.removeEventListener('popstate', onPopState);
    }
    if (previousHook) {
      win.__ARC_HANDLE_BACK__ = previousHook;
    } else {
      delete win.__ARC_HANDLE_BACK__;
    }
  };
}
