import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BOARD_PAN_BLOCK_SELECTOR,
  dispatchSystemBack,
  installGlobalBackDispatcher,
  registerBackHandler,
  shouldStartBoardPan,
} from '../../platform/backProtection';

describe('Mobile Back Protection & Blackboard Pan Guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches back handlers by descending priority and LIFO order', () => {
    const trace: string[] = [];
    const u1 = registerBackHandler(() => {
      trace.push('low');
      return true;
    }, 10);
    const u2 = registerBackHandler(() => {
      trace.push('high-1');
      return false;
    }, 50);
    const u3 = registerBackHandler(() => {
      trace.push('high-2');
      return true;
    }, 50);

    expect(dispatchSystemBack()).toBe(true);
    expect(trace).toEqual(['high-2']);

    u3();
    trace.length = 0;
    expect(dispatchSystemBack()).toBe(true);
    expect(trace).toEqual(['high-1', 'low']);

    u2();
    u1();
    expect(dispatchSystemBack()).toBe(false);
  });

  it('installs global Android-Tauri back hook and falls back to root exit guard', () => {
    const winTarget: Record<string, unknown> = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      history: {
        state: null,
        pushState: vi.fn(),
      },
    };
    vi.stubGlobal('window', winTarget);

    let armed = false;
    const dispose = installGlobalBackDispatcher(
      () => {
        if (armed) return 'exit';
        armed = true;
        return 'handled';
      },
      { enableBrowserPopState: true },
    );

    const hook = winTarget.__ARC_HANDLE_BACK__ as () => string;
    expect(typeof hook).toBe('function');

    // Registered sub-handler (e.g. dirty paragraph confirm) intercepts before root
    const unsubChild = registerBackHandler(() => true, 50);
    expect(hook()).toBe('handled');
    expect(armed).toBe(false);
    unsubChild();

    // First root back press arms protection; second exits
    expect(hook()).toBe('handled');
    expect(armed).toBe(true);
    expect(hook()).toBe('exit');

    dispose();
    expect(winTarget.__ARC_HANDLE_BACK__).toBeUndefined();
  });

  it('allows blackboard drag on sticky notes & stickers while blocking toolbars, capsules & modals', () => {
    const fakeTarget = (matchedSelectors: string[]) => ({
      closest: (selectorList: string) =>
        matchedSelectors.some((s) => selectorList.includes(s)) ? {} : null,
    });

    // Sticky notes & stickers must allow blackboard pan start
    expect(shouldStartBoardPan(fakeTarget(['.arc-sticky-note']))).toBe(true);
    expect(shouldStartBoardPan(fakeTarget(['.arc-archive-sticker-card']))).toBe(true);
    expect(shouldStartBoardPan(fakeTarget(['.arc-archive-sticker-strip']))).toBe(true);
    expect(shouldStartBoardPan(fakeTarget([]))).toBe(true);

    // Interactive chrome & inputs must remain blocked
    expect(BOARD_PAN_BLOCK_SELECTOR).toContain('.arc-blackboard-toolbar');
    expect(shouldStartBoardPan(fakeTarget(['.arc-blackboard-toolbar']))).toBe(false);
    expect(shouldStartBoardPan(fakeTarget(['.arc-blackboard-capsule']))).toBe(false);
    expect(shouldStartBoardPan(fakeTarget(['.arc-bb-modal']))).toBe(false);
    expect(shouldStartBoardPan(fakeTarget(['input']))).toBe(false);
  });
});
