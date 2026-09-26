import { useContext, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { usePub } from "../usePubSub";
import { runtimeRpc } from "./rpc";
import type { RuntimeSettings, HoldTapSettings } from "./model";

const flavors = ["Hold preferred", "Balanced", "Tap preferred", "Tap unless interrupted"];
type TimeKey = "tappingTermMs" | "quickTapMs" | "requirePriorIdleMs";
type FlagKey = "holdWhileUndecided" | "holdWhileUndecidedLinger" | "retroTap" | "holdTriggerOnRelease";

export function RuntimeSettingsButton({ behaviors }: { behaviors: GetBehaviorDetailsResponse[] }) {
  const { conn } = useContext(ConnectionContext);
  const publish = usePub();
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState<RuntimeSettings>();
  const [stock, setStock] = useState<RuntimeSettings>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function open() {
    if (!conn) return;
    setBusy(true); setError(""); dialog.current?.showModal();
    try {
      const current = await runtimeRpc(conn, "current");
      const defaults = await runtimeRpc(conn, "stock");
      setValue(current as RuntimeSettings); setStock(defaults as RuntimeSettings);
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  }

  function update(index: number, changes: Partial<HoldTapSettings>) {
    setValue((previous) => previous && ({ ...previous, holdTaps: previous.holdTaps.map((s, i) => i === index ? { ...s, ...changes } : s) }));
  }

  async function apply() {
    if (!conn || !value) return;
    setBusy(true); setError("");
    try {
      await runtimeRpc(conn, value);
      await publish("rpc_notification.keymap.unsavedChangesStatusChanged", true);
      await publish("nape-runtime.changed", true);
      dialog.current?.close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" className="nape-runtime-open" onClick={open} disabled={!conn}>
      <SlidersHorizontal size={15} /> Runtime settings
    </button>
    <dialog ref={dialog} className="nape-runtime-dialog" onClose={() => { setValue(undefined); setStock(undefined); }}>
      <div className="nape-runtime-head">
        <div><small>Nape Console</small><h2>Runtime settings</h2><p>DPI and behavior changes take effect now; startup layer changes after restart. Use Save in the top bar to keep them.</p></div>
        <button type="button" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
      </div>
      {busy && !value && <p>Reading device settings…</p>}
      {value && <div className="nape-runtime-body">
        <section className="nape-runtime-dpi">
          <div><h3>Common trackball DPI</h3><p>Used by layers set to inherit · 200–3200 in steps of 200. Applied on the next ball movement.</p></div>
          <label>DPI <select value={value.cpi} onChange={(e) => setValue({ ...value, cpi: Number(e.target.value) })}>
            {Array.from({ length: 16 }, (_, i) => (i + 1) * 200).map((dpi) => <option key={dpi} value={dpi}>{dpi}</option>)}
          </select></label>
        </section>
        <h3>Hold-Tap behaviors</h3>
        <p className="nape-runtime-note">Timing is in milliseconds. Leave Quick tap or Require prior idle blank to disable it. Release all held keys before applying.</p>
        {value.holdTaps.map((s, index) => <section key={s.behaviorId} className="nape-runtime-behavior">
          <h4>{behaviors.find((b) => b.id === s.behaviorId)?.displayName || `Hold-Tap ${s.behaviorId}`}</h4>
          <div className="nape-runtime-fields">
            {([ ["Tapping term", "tappingTermMs"], ["Quick tap", "quickTapMs"], ["Require prior idle", "requirePriorIdleMs"] ] as [string, TimeKey][]).map(([label, key]) =>
              <label key={key}>{label}<input type="number" min={key === "tappingTermMs" ? 1 : 0} max={5000}
                placeholder={key === "tappingTermMs" ? undefined : "Disabled"}
                value={s[key] < 0 ? "" : s[key]}
                onChange={(e) => update(index, { [key]: e.target.value === "" ? -1 : Number(e.target.value) })} /></label>)}
            <label>Flavor<select value={s.flavor} onChange={(e) => update(index, { flavor: Number(e.target.value) })}>{flavors.map((f, i) => <option value={i} key={f}>{f}</option>)}</select></label>
          </div>
          <div className="nape-runtime-flags">
            {([ ["Hold while undecided", "holdWhileUndecided"], ["Linger", "holdWhileUndecidedLinger"], ["Retro tap", "retroTap"], ["Hold trigger on release", "holdTriggerOnRelease"] ] as [string, FlagKey][]).map(([label, key]) =>
              <label key={key}><input type="checkbox" checked={s[key]} onChange={(e) => update(index, { [key]: e.target.checked })} />{label}</label>)}
          </div>
        </section>)}
      </div>}
      {error && <p className="nape-runtime-error" role="alert">{error}</p>}
      <div className="nape-runtime-actions">
        <button type="button" disabled={!stock || busy} onClick={() => setValue((current) => current && stock && ({
          ...current, cpi: stock.cpi, holdTaps: structuredClone(stock.holdTaps),
        }))}>Reset shown settings</button>
        <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className="nape-runtime-apply" disabled={!value || busy} onClick={apply}>{busy ? "Applying…" : "Apply"}</button>
      </div>
    </dialog>
  </>;
}
