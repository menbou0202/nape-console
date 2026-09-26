export interface HoldTapSettings {
  behaviorId: number;
  tappingTermMs: number;
  quickTapMs: number;
  requirePriorIdleMs: number;
  flavor: number;
  holdWhileUndecided: boolean;
  holdWhileUndecidedLinger: boolean;
  retroTap: boolean;
  holdTriggerOnRelease: boolean;
}
export interface RuntimeSettings { cpi: number; bootLayerId: number; layerCpi: number[]; holdTaps: HoldTapSettings[] }

export function decodeRuntime(bytes: Uint8Array): RuntimeSettings {
  if (bytes.length !== 200 || bytes[0] !== 2 || 4 + bytes[1] * 12 > 128)
    throw new Error("This firmware needs the latest Nape Console UF2 for startup layers and per-layer DPI.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { cpi: view.getUint16(2, true), bootLayerId: bytes[128],
    layerCpi: Array.from({ length: 32 }, (_, id) => view.getUint16(130 + id * 2, true)),
    holdTaps: Array.from({ length: bytes[1] }, (_, i) => {
    const offset = 4 + i * 12;
    const flags = bytes[offset + 9];
    return {
      behaviorId: view.getUint16(offset, true), tappingTermMs: view.getUint16(offset + 2, true),
      quickTapMs: view.getInt16(offset + 4, true), requirePriorIdleMs: view.getInt16(offset + 6, true),
      flavor: bytes[offset + 8], holdWhileUndecided: Boolean(flags & 1),
      holdWhileUndecidedLinger: Boolean(flags & 2), retroTap: Boolean(flags & 4),
      holdTriggerOnRelease: Boolean(flags & 8),
    };
  }) };
}

export function encodeRuntime(settings: RuntimeSettings): Uint8Array {
  if (settings.cpi < 200 || settings.cpi > 3200 || settings.cpi % 200 || settings.holdTaps.length > 10)
    throw new Error("DPI must be 200–3200 in steps of 200.");
  if (!Number.isInteger(settings.bootLayerId) || settings.bootLayerId < 0 || settings.bootLayerId >= 32)
    throw new Error("Choose a valid startup layer.");
  if (settings.layerCpi.length !== 32 || settings.layerCpi.some((cpi) => !Number.isInteger(cpi) ||
      (cpi !== 0 && (cpi < 200 || cpi > 3200 || cpi % 200))))
    throw new Error("Layer DPI must inherit the common value or be 200–3200 in steps of 200.");
  const bytes = new Uint8Array(200);
  const view = new DataView(bytes.buffer);
  bytes[0] = 2; bytes[1] = settings.holdTaps.length;
  view.setUint16(2, settings.cpi, true);
  bytes[128] = settings.bootLayerId;
  settings.layerCpi.forEach((cpi, id) => view.setUint16(130 + id * 2, cpi, true));
  settings.holdTaps.forEach((s, i) => {
    if (!Number.isInteger(s.tappingTermMs) || s.tappingTermMs < 1 || s.tappingTermMs > 5000 ||
      ![s.quickTapMs, s.requirePriorIdleMs].every((value) => Number.isInteger(value) && value >= -1 && value <= 5000))
      throw new Error("Tapping term must be 1–5000 ms; Quick tap and Prior idle must be blank (disabled) or 0–5000 ms.");
    const offset = 4 + i * 12;
    view.setUint16(offset, s.behaviorId, true);
    view.setUint16(offset + 2, s.tappingTermMs, true);
    view.setInt16(offset + 4, s.quickTapMs, true);
    view.setInt16(offset + 6, s.requirePriorIdleMs, true);
    bytes[offset + 8] = s.flavor;
    bytes[offset + 9] = Number(s.holdWhileUndecided) | Number(s.holdWhileUndecidedLinger) << 1 |
      Number(s.retroTap) << 2 | Number(s.holdTriggerOnRelease) << 3;
  });
  return bytes;
}
