import { call_rpc, type RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { NapeRequest, NapeResponse } from "../rpc/napeCodec";
import { decodeRuntime, encodeRuntime, type RuntimeSettings } from "./model";

export async function runtimeRpc(connection: RpcConnection, mode: "current" | "stock" | RuntimeSettings): Promise<RuntimeSettings | void> {
  const nape = mode === "current" ? { getRuntime: true } : mode === "stock" ? { getStockRuntime: true } : { setRuntime: encodeRuntime(mode) };
  const response = await call_rpc(connection, { nape } as Omit<NapeRequest, "requestId">) as NapeResponse;
  if (response.nape?.error !== undefined) throw new Error(response.nape.error === -16 ? "Release all Nape keys and retry." : `Device rejected settings (${response.nape.error}).`);
  if (typeof mode === "object") {
    if (!response.nape?.updated) throw new Error("Device did not acknowledge settings.");
    return;
  }
  if (!response.nape?.runtime) throw new Error("This firmware does not support runtime settings.");
  return decodeRuntime(response.nape.runtime);
}
