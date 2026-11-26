import type { HlcTimestamp } from '../../types/archive';

export function createHlc(nodeId: string, wallMs = Date.now()): HlcTimestamp {
  return {
    wallMs: Math.max(0, Math.floor(wallMs)),
    logical: 0,
    nodeId,
  };
}

export function tickHlc(local: HlcTimestamp, nowMs = Date.now()): HlcTimestamp {
  const physical = Math.max(0, Math.floor(nowMs));
  if (physical > local.wallMs) {
    return {
      wallMs: physical,
      logical: 0,
      nodeId: local.nodeId,
    };
  }
  return {
    wallMs: local.wallMs,
    logical: local.logical + 1,
    nodeId: local.nodeId,
  };
}

export function receiveHlc(
  local: HlcTimestamp,
  remote: HlcTimestamp,
  nowMs = Date.now(),
): HlcTimestamp {
  const physical = Math.max(0, Math.floor(nowMs));
  const maxWall = Math.max(physical, local.wallMs, remote.wallMs);

  if (maxWall === local.wallMs && maxWall === remote.wallMs) {
    return {
      wallMs: maxWall,
      logical: Math.max(local.logical, remote.logical) + 1,
      nodeId: local.nodeId,
    };
  }
  if (maxWall === local.wallMs) {
    return {
      wallMs: maxWall,
      logical: local.logical + 1,
      nodeId: local.nodeId,
    };
  }
  if (maxWall === remote.wallMs) {
    return {
      wallMs: maxWall,
      logical: remote.logical + 1,
      nodeId: local.nodeId,
    };
  }
  return {
    wallMs: maxWall,
    logical: 0,
    nodeId: local.nodeId,
  };
}

export function compareHlc(a: HlcTimestamp, b: HlcTimestamp): -1 | 0 | 1 {
  if (a.wallMs !== b.wallMs) return a.wallMs < b.wallMs ? -1 : 1;
  if (a.logical !== b.logical) return a.logical < b.logical ? -1 : 1;
  if (a.nodeId !== b.nodeId) return a.nodeId < b.nodeId ? -1 : 1;
  return 0;
}

export function formatHlc(hlc: HlcTimestamp): string {
  const wallHex = hlc.wallMs.toString(16).padStart(12, '0');
  const logHex = hlc.logical.toString(16).padStart(4, '0');
  return `${wallHex}-${logHex}-${hlc.nodeId}`;
}

export function parseHlc(raw: string): HlcTimestamp | null {
  const m = /^([0-9a-f]+)-([0-9a-f]+)-(.+)$/i.exec(raw.trim());
  if (!m) return null;
  const wallMs = Number.parseInt(m[1], 16);
  const logical = Number.parseInt(m[2], 16);
  if (!Number.isFinite(wallMs) || !Number.isFinite(logical)) return null;
  return { wallMs, logical, nodeId: m[3] };
}
