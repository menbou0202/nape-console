import { useContext, useEffect, useState } from "react";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { usePub, useSub } from "../usePubSub";
import { runtimeRpc } from "./rpc";
import type { RuntimeSettings } from "./model";

export function useLayerRuntimeSettings() {
  const { conn } = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);
  const publish = usePub();
  const [settings, setSettings] = useState<RuntimeSettings>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useSub("nape-runtime.changed", () => setRevision((v) => v + 1));
  useSub("rpc_notification.keymap.unsavedChangesStatusChanged", (unsaved) => {
    if (!unsaved) setRevision((v) => v + 1);
  });

  useEffect(() => {
    let cancelled = false;
    if (!conn || lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) {
      setSettings(undefined);
      return;
    }
    runtimeRpc(conn, "current").then((result) => {
      if (!cancelled) { setSettings(result as RuntimeSettings); setError(""); }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { cancelled = true; };
  }, [conn, lockState, revision]);

  async function change(update: (current: RuntimeSettings) => RuntimeSettings) {
    if (!conn || busy) return;
    setBusy(true); setError("");
    try {
      const current = await runtimeRpc(conn, "current") as RuntimeSettings;
      const next = update(current);
      await runtimeRpc(conn, next);
      setSettings(next);
      await publish("rpc_notification.keymap.unsavedChangesStatusChanged", true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  }

  return { settings, error, busy, change };
}
