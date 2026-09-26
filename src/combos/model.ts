import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";

export interface Combo {
  binding: BehaviorBinding;
  positions: number[];
  layerMask: number;
  timeoutMs: number;
  requirePriorIdleMs: number;
  slowRelease: boolean;
}
export const MAX_COMBOS = 16;
export const COMBO_BLOB_SIZE = 520;

export function validateCombos(combos: Combo[]): string | undefined {
  if (combos.length > MAX_COMBOS) return "Up to 16 combos can be stored.";
  for (const [index, combo] of combos.entries()) {
    if (combo.positions.length < 2 || combo.positions.length > 6) return "Select 2–6 keys.";
    if (new Set(combo.positions).size !== combo.positions.length || combo.positions.some((p) => !Number.isInteger(p) || p < 0 || p > 5)) return "Invalid key positions.";
    if (!Number.isInteger(combo.timeoutMs) || combo.timeoutMs < 1 || combo.timeoutMs > 5000) return "Timeout must be 1–5000 ms.";
    if (!Number.isInteger(combo.requirePriorIdleMs) || combo.requirePriorIdleMs < 0 || combo.requirePriorIdleMs > 5000) return "Prior idle must be 0–5000 ms.";
    if (!Number.isInteger(combo.layerMask) || combo.layerMask < 0 || combo.layerMask > 0xffffffff) return "Invalid layer selection.";
    if (!Number.isInteger(combo.binding.behaviorId) || combo.binding.behaviorId < 0 || combo.binding.behaviorId >= 65535) return "Select a behavior.";
    if ([combo.binding.param1, combo.binding.param2].some((p) => !Number.isInteger(p) || p < 0 || p > 0xffffffff)) return "Invalid behavior parameters.";
    const positions = [...combo.positions].sort().join(",");
    if (combos.slice(0, index).some((other) => [...other.positions].sort().join(",") === positions &&
      (!combo.layerMask || !other.layerMask || (combo.layerMask & other.layerMask)))) {
      return "Another combo uses these keys on the same layers.";
    }
  }
}

export function encodeCombos(combos: Combo[]): Uint8Array {
  const error = validateCombos(combos);
  if (error) throw new Error(error);
  const bytes = new Uint8Array(COMBO_BLOB_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 1, true);
  view.setUint32(4, combos.length, true);
  combos.forEach((combo, index) => {
    const offset = 8 + index * 32;
    view.setUint32(offset, combo.binding.behaviorId, true);
    view.setUint32(offset + 4, combo.binding.param1, true);
    view.setUint32(offset + 8, combo.binding.param2, true);
    view.setUint32(offset + 12, combo.layerMask, true);
    view.setUint16(offset + 16, combo.timeoutMs, true);
    view.setUint16(offset + 18, combo.requirePriorIdleMs, true);
    bytes[offset + 20] = combo.positions.length;
    bytes[offset + 21] = Number(combo.slowRelease);
    bytes.set(combo.positions, offset + 22);
  });
  return bytes;
}

export function decodeCombos(bytes: Uint8Array): Combo[] {
  if (bytes.length !== COMBO_BLOB_SIZE) throw new Error("Unexpected combo data length.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 1) throw new Error("This firmware uses a different combo protocol version.");
  const count = view.getUint32(4, true);
  if (count > MAX_COMBOS) throw new Error("Unexpected combo count.");
  const combos = Array.from({ length: count }, (_, index): Combo => {
    const offset = 8 + index * 32;
    const length = bytes[offset + 20];
    if (length > 6 || bytes[offset + 21] > 1) throw new Error("Invalid combo data.");
    return {
      binding: { behaviorId: view.getUint32(offset, true), param1: view.getUint32(offset + 4, true), param2: view.getUint32(offset + 8, true) },
      layerMask: view.getUint32(offset + 12, true),
      timeoutMs: view.getUint16(offset + 16, true),
      // ZMK's devicetree default is -1 (disabled). The firmware transmits
      // the low 16 bits, so normalize 0xffff to the editor's disabled value.
      requirePriorIdleMs: view.getUint16(offset + 18, true) === 0xffff ? 0 : view.getUint16(offset + 18, true),
      slowRelease: Boolean(bytes[offset + 21]),
      positions: Array.from(bytes.slice(offset + 22, offset + 22 + length)),
    };
  });
  const error = validateCombos(combos);
  if (error) throw new Error(error);
  return combos;
}
