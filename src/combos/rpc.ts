import { call_rpc, type RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { NapeRequest, NapeResponse } from "../rpc/napeCodec";
import { Combo, decodeCombos, encodeCombos } from "./model";

export async function comboRpc(connection: RpcConnection, combos?: Combo[]): Promise<Combo[]> {
  const request: Omit<NapeRequest, "requestId"> = { nape: combos === undefined ? { getCombos: true } : { setCombos: encodeCombos(combos) } };
  const response = await call_rpc(connection, request) as NapeResponse;
  if (response.nape?.error !== undefined) {
    const errors: Record<number, string> = {
      [-16]: "Release all Nape keys, then try again.",
      [-17]: "Another combo already uses these keys on the same layers.",
      [-22]: "The device rejected this combo. Check its behavior, keys and timing.",
    };
    throw new Error(errors[response.nape.error] || `Combo update failed (${response.nape.error}).`);
  }
  if (combos !== undefined && response.nape?.updated) {
    return [...combos].sort((a, b) => a.positions.length - b.positions.length);
  }
  if (!response.nape?.combos) throw new Error("This firmware does not support runtime combos.");
  return decodeCombos(response.nape.combos);
}
