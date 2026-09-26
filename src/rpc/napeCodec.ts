import { Reader, Writer } from "protobufjs/minimal";
import { Request, Response, RequestResponse } from "@zmkfirmware/zmk-studio-ts-client";

export type NapeRequest = Request & { nape?: { getCombos?: boolean; setCombos?: Uint8Array; getRuntime?: boolean; setRuntime?: Uint8Array; getStockRuntime?: boolean } };
export type NapeResponse = RequestResponse & { nape?: { combos?: Uint8Array; error?: number; updated?: boolean; runtime?: Uint8Array } };

export function encodeNapeRequest(request: NapeRequest): Uint8Array {
  const writer = Request.encode(request);
  if (request.nape) {
    const payload = Writer.create();
    if (request.nape.getCombos) payload.uint32(8).bool(true);
    if (request.nape.setCombos) payload.uint32(18).bytes(request.nape.setCombos);
    if (request.nape.getRuntime) payload.uint32(24).bool(true);
    if (request.nape.setRuntime) payload.uint32(34).bytes(request.nape.setRuntime);
    if (request.nape.getStockRuntime) payload.uint32(40).bool(true);
    writer.uint32(162).bytes(payload.finish()); // private subsystem tag 20
  }
  return writer.finish();
}

function bytesField(bytes: Uint8Array, field: number): Uint8Array | undefined {
  const reader = Reader.create(bytes);
  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    if (tag === (field << 3 | 2)) return reader.bytes();
    reader.skipType(tag & 7);
  }
}

export function decodeNapeResponse(bytes: Uint8Array): Response {
  const response = Response.decode(bytes);
  const envelope = bytesField(bytes, 1);
  const payload = envelope && bytesField(envelope, 20);
  if (payload && response.requestResponse) {
    const nape: NonNullable<NapeResponse["nape"]> = {};
    const reader = Reader.create(payload);
    while (reader.pos < reader.len) {
      const tag = reader.uint32();
      if (tag === 10) nape.combos = reader.bytes();
      else if (tag === 16) nape.error = reader.int32();
      else if (tag === 24) nape.updated = reader.bool();
      else if (tag === 34) nape.runtime = reader.bytes();
      else reader.skipType(tag & 7);
    }
    (response.requestResponse as NapeResponse).nape = nape;
  }
  return response;
}
