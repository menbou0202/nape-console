import assert from "node:assert/strict";
import test from "node:test";
import { Reader, Writer } from "protobufjs/minimal";
import { Request, Response } from "@zmkfirmware/zmk-studio-ts-client";
import { encodeCombos, decodeCombos, Combo, validateCombos } from "../src/combos/model";
import { encodeNapeRequest, decodeNapeResponse, NapeResponse } from "../src/rpc/napeCodec";
import { encodeRuntime, decodeRuntime, type RuntimeSettings } from "../src/runtime/model";

const sample: Combo = { binding: { behaviorId: 12, param1: 0x80070004, param2: 10 }, positions: [0, 1, 2, 3, 4, 5], layerMask: 0x80080001, timeoutMs: 5000, requirePriorIdleMs: 5000, slowRelease: true };
test("combo binary round-trip preserves all six positions and unsigned fields", () => {
  const bytes = encodeCombos([sample]);
  assert.equal(bytes.length, 520);
  assert.deepEqual([...bytes.slice(0, 12)], [1, 0, 0, 0, 1, 0, 0, 0, 12, 0, 0, 0]);
  assert.deepEqual(decodeCombos(bytes), [sample]);
  assert.deepEqual(decodeCombos(encodeCombos([])), []);
});
test("stock ZMK prior-idle sentinel is shown as disabled", () => {
  const bytes = encodeCombos([{ ...sample, requirePriorIdleMs: 0 }]);
  new DataView(bytes.buffer).setUint16(8 + 18, 0xffff, true);
  assert.equal(decodeCombos(bytes)[0].requirePriorIdleMs, 0);
});
test("invalid and ambiguous combinations are refused before transmission", () => {
  assert.match(validateCombos([{ ...sample, positions: [1] }])!, /2–6/);
  assert.match(validateCombos([{ ...sample, positions: [1, 1] }])!, /positions/);
  assert.match(validateCombos([{ ...sample, timeoutMs: NaN }])!, /Timeout/);
  assert.match(validateCombos([sample, sample])!, /Another/);
  assert.equal(validateCombos([{ ...sample, layerMask: 1 }, { ...sample, layerMask: 2 }]), undefined);
  assert.throws(() => decodeCombos(new Uint8Array(519)), /length/);
  const bytes = encodeCombos([sample]); bytes[0] = 2;
  assert.throws(() => decodeCombos(bytes), /version/);
  assert.throws(() => encodeCombos(Array(17).fill(sample)), /16/);
});
test("Nape requests preserve stock envelopes and add subsystem 20", () => {
  const stock = { requestId: 17, keymap: { getKeymap: true } };
  assert.deepEqual(encodeNapeRequest(stock), Request.encode(stock).finish());
  const reader = Reader.create(encodeNapeRequest({ requestId: 18, nape: { setCombos: encodeCombos([sample]) } }));
  assert.equal(reader.uint32(), 8); assert.equal(reader.uint32(), 18);
  assert.equal(reader.uint32(), 162);
  const payload = Reader.create(reader.bytes());
  assert.equal(payload.uint32(), 18);
  assert.deepEqual(decodeCombos(payload.bytes()), [sample]);
});
function envelope(payload: Uint8Array) {
  const inner = Writer.create().uint32(8).uint32(19).uint32(162).bytes(payload).finish();
  return Writer.create().uint32(10).bytes(inner).finish();
}
test("Nape responses decode combo data and signed device errors", () => {
  const result = decodeNapeResponse(envelope(Writer.create().uint32(10).bytes(encodeCombos([sample])).finish()));
  assert.equal(result.requestResponse?.requestId, 19);
  assert.deepEqual(decodeCombos((result.requestResponse as NapeResponse).nape!.combos!), [sample]);
  const error = decodeNapeResponse(envelope(Writer.create().uint32(16).int32(-16).finish()));
  assert.equal((error.requestResponse as NapeResponse).nape?.error, -16);
  const updated = decodeNapeResponse(envelope(Writer.create().uint32(24).bool(true).finish()));
  assert.equal((updated.requestResponse as NapeResponse).nape?.updated, true);
});
test("stock keymap responses and notifications remain compatible", () => {
  for (const value of [{ requestResponse: { requestId: 20, keymap: { checkUnsavedChanges: true } } }, { notification: { keymap: { unsavedChangesStatusChanged: true } } }]) {
    const encoded = Response.encode(value).finish();
    assert.deepEqual(decodeNapeResponse(encoded), Response.decode(encoded));
  }
});

test("runtime timing and DPI round-trip, with strict limits", () => {
  const settings: RuntimeSettings = { cpi: 1200, bootLayerId: 3,
    layerCpi: Array.from({ length: 32 }, (_, i) => i === 10 ? 400 : 0),
    holdTaps: [{ behaviorId: 42,
    tappingTermMs: 180, quickTapMs: 90, requirePriorIdleMs: 200, flavor: 2,
    holdWhileUndecided: true, holdWhileUndecidedLinger: false, retroTap: true,
    holdTriggerOnRelease: false }] };
  assert.deepEqual(decodeRuntime(encodeRuntime(settings)), settings);
  assert.equal(encodeRuntime(settings)[128], 3);
  assert.equal(new DataView(encodeRuntime(settings).buffer).getUint16(130 + 10 * 2, true), 400);
  assert.throws(() => encodeRuntime({ ...settings, cpi: 1250 }), /DPI/);
  assert.throws(() => encodeRuntime({ ...settings, bootLayerId: 32 }), /startup layer/);
  assert.throws(() => encodeRuntime({ ...settings, layerCpi: settings.layerCpi.map((cpi, index) => index === 10 ? 350 : cpi) }), /Layer DPI/);
  assert.throws(() => decodeRuntime(new Uint8Array(128)), /latest Nape Console UF2/);
  assert.throws(() => encodeRuntime({ ...settings, holdTaps: [{ ...settings.holdTaps[0], tappingTermMs: 0 }] }), /Tapping term/);
  const disabled = { ...settings, holdTaps: [{ ...settings.holdTaps[0], quickTapMs: -1, requirePriorIdleMs: -1 }] };
  const disabledBytes = encodeRuntime(disabled);
  assert.equal(new DataView(disabledBytes.buffer).getUint16(4 + 4, true), 0xffff);
  assert.deepEqual(decodeRuntime(disabledBytes), disabled);
  const request = encodeNapeRequest({ requestId: 21, nape: { setRuntime: encodeRuntime(settings) } });
  const reader = Reader.create(request);
  assert.equal(reader.uint32(), 8); assert.equal(reader.uint32(), 21);
  assert.equal(reader.uint32(), 162);
  const payload = Reader.create(reader.bytes());
  assert.equal(payload.uint32(), 34);
  assert.deepEqual(decodeRuntime(payload.bytes()), settings);
  const response = decodeNapeResponse(envelope(Writer.create().uint32(34).bytes(encodeRuntime(settings)).finish()));
  assert.deepEqual(decodeRuntime((response.requestResponse as NapeResponse).nape!.runtime!), settings);
});
