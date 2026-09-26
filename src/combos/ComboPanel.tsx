import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { UndoRedoContext } from "../undoRedo";
import { bindingDisplayLines } from "../keyboard/bindingDisplay";
import { NAPE_BINDING_MIME } from "../keyboard/SlotPalette";
import { Combo, MAX_COMBOS, validateCombos } from "./model";
import { comboRpc } from "./rpc";
import { usePub } from "../usePubSub";
import napeWireframe from "../../images/Nape.svg";
import napeBackWireframe from "../../images/NapeBack.svg";

interface Props {
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; name: string }[];
}

const keyNames = ["Front Key 1 (lower)", "Front Key 2 (middle)", "Front Key 3 (upper)", "Back 1", "Back 2", "Back 3"];
const points = [[22, 81], [22, 37], [22, 13], [86, 64], [68, 64], [50, 64]];

function ComboMap({ positions }: { positions: number[] }) {
  return <svg className="nape-combo-map" viewBox="0 0 104 108" role="img" aria-label={positions.map((p) => keyNames[p]).join(" + ")}>
    <text x="22" y="8" textAnchor="middle">F</text><text x="68" y="46" textAnchor="middle">B</text>
    {points.map(([x, y], position) => <rect key={position} x={x - 7} y={y} width={14} height={16} rx="2" className={positions.includes(position) ? "is-selected" : ""} />)}
    <circle cx="22" cy="68" r="7" className="nape-combo-ball" />
    {[5, 4, 3].map((p) => <text key={p} x={points[p][0]} y="92" textAnchor="middle">{p - 2}</text>)}
  </svg>;
}

function BindingLabel({ binding, behaviors, layers }: { binding: BehaviorBinding } & Props) {
  return <div className="nape-combo-binding">{bindingDisplayLines(binding, behaviors, layers).map((line, index) =>
    <span key={index} className={index === 0 ? "nape-pro-key-behavior" : "nape-pro-key-detail"}>{line}</span>)}</div>;
}

function ComboKeyDiagram({ side, positions, onToggle }: {
  side: "front" | "back";
  positions: number[];
  onToggle: (position: number) => void;
}) {
  const keys = side === "front"
    ? [{ position: 2, label: "3" }, { position: 1, label: "2" }, { position: 0, label: "1" }]
    : [{ position: 5, label: "3" }, { position: 4, label: "2" }, { position: 3, label: "1" }];
  return <div className="nape-combo-device-group">
    <strong>{side === "front" ? "Front · 0°" : "Back · 0°"}</strong>
    <div className={`nape-combo-device nape-combo-device--${side}`}>
      <img src={side === "front" ? napeWireframe : napeBackWireframe} alt="" aria-hidden="true" />
      {keys.map(({ position, label }) => <button
        key={position}
        type="button"
        className={`nape-combo-device-key nape-combo-device-key--${position}`}
        aria-label={keyNames[position]}
        aria-pressed={positions.includes(position)}
        title={keyNames[position]}
        onClick={() => onToggle(position)}
      >{label}</button>)}
    </div>
  </div>;
}

export function ComboPanel({ behaviors, layers }: Props) {
  const connection = useContext(ConnectionContext);
  const undoRedo = useContext(UndoRedoContext);
  const [combos, setCombos] = useState<Combo[]>();
  const [error, setError] = useState<string>();
  const [unsupported, setUnsupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ index?: number; combo: Combo }>();
  const [bindingValid, setBindingValid] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const connectionRef = useRef(connection);
  connectionRef.current = connection;

  useEffect(() => {
    let ignore = false;
    setCombos(undefined);
    setError(undefined);
    setUnsupported(false);
    setDraft(undefined);
    if (connection.conn) comboRpc(connection.conn).then((result) => {
      if (!ignore) setCombos(result);
    }).catch((cause) => {
      if (ignore) return;
      if (cause instanceof MetaError && cause.condition === 2) setUnsupported(true);
      else setError(cause instanceof Error ? cause.message : "Could not read combos. Reconnect and try again.");
    });
    return () => { ignore = true; };
  }, [connection, refresh]);

  useEffect(() => {
    if (draft) dialog.current?.showModal();
  }, [Boolean(draft)]);

  const edit = (index?: number) => {
    const behavior = behaviors.find((b) => b.displayName === "Key Press") || behaviors[0];
    if (!behavior || !combos) return;
    setError(undefined);
    setBindingValid(true);
    setDraft({ index, combo: index === undefined ? {
      binding: { behaviorId: behavior.id, param1: 0x70004, param2: 0 },
      positions: [], timeoutMs: 50, requirePriorIdleMs: 0, slowRelease: false, layerMask: 0,
    } : structuredClone(combos[index]) });
  };

  const updateDraft = (update: Partial<Combo>) => setDraft((current) => current && ({ ...current, combo: { ...current.combo, ...update } }));

  const apply = async (next: Combo[]) => {
    if (!connection.conn || !combos || busy) return;
    const validation = validateCombos(next);
    if (validation) { setError(validation); return; }
    const before = combos;
    const conn = connection.conn;
    const currentConnection = connection;
    setBusy(true);
    setError(undefined);
    const perform = async (value: Combo[]) => {
      if (connectionRef.current.conn !== conn) throw new Error("The device was disconnected.");
      const result = await comboRpc(conn, value);
      if (connectionRef.current === currentConnection) {
        setCombos(result);
        void usePub()("rpc_notification.keymap.unsavedChangesStatusChanged", true);
      }
    };
    try {
      if (undoRedo) await undoRedo(async () => {
        await perform(next);
        return async () => { await perform(before); };
      });
      else await perform(next);
      setDraft(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update combos.");
    } finally { setBusy(false); }
  };

  const withDraft = draft && combos ? (draft.index === undefined ? [...combos, draft.combo] : combos.map((c, i) => i === draft.index ? draft.combo : c)) : undefined;
  const validation = withDraft && validateCombos(withDraft);

  return <aside className="nape-combo-panel" aria-label="Combos">
    <header className="nape-slot-header">
      <div><strong>Combos {combos && <small>{combos.length}/{MAX_COMBOS}</small>}</strong><span>Press keys together</span></div>
      <button type="button" className="nape-slot-add" aria-label="Add combo" disabled={!combos || combos.length >= MAX_COMBOS || busy} onClick={() => edit()}>+</button>
    </header>
    {unsupported ? <p className="nape-combo-notice">Combo editing needs the Nape Console firmware. Install <strong>nape-console.uf2</strong>, then reconnect.</p> :
      !combos && !error ? <p className="nape-combo-notice">Reading combos…</p> : null}
    {error && !draft && <div role="alert" className="nape-combo-error">{error}<button type="button" onClick={() => setRefresh((r) => r + 1)}>Reload</button></div>}
    <div className="nape-combo-list">
      {combos?.map((combo, index) => <button type="button" className="nape-combo-card" key={index} disabled={busy} onClick={() => edit(index)}
        aria-label={`Edit combo ${index + 1}: ${keyNames.filter((_, p) => combo.positions.includes(p)).join(" + ")}`}
        onDragOver={(event) => { if (event.dataTransfer.types.includes(NAPE_BINDING_MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
        onDrop={(event) => {
          event.preventDefault();
          try {
            const binding: BehaviorBinding = JSON.parse(event.dataTransfer.getData(NAPE_BINDING_MIME));
            void apply(combos.map((c, i) => i === index ? { ...c, binding } : c));
          } catch { setError("Could not read this slot."); }
        }}>
        <BindingLabel binding={combo.binding} behaviors={behaviors} layers={layers} />
        <ComboMap positions={combo.positions} />
        <small className="nape-combo-summary">{combo.timeoutMs} ms · {combo.layerMask === 0 ? "All layers" : layers.flatMap((layer, i) => combo.layerMask & (1 << i) ? [layer.name] : []).join(", ")}</small>
      </button>)}
      {combos?.length === 0 && <p className="nape-combo-notice">Use + to choose the keys and what they do together.</p>}
    </div>
    {combos && <p className="nape-combo-notice">Apply to try immediately. Use the top Save button to keep changes after power-off.</p>}
    {draft && createPortal(<dialog ref={dialog} className="nape-slot-editor nape-combo-editor" aria-label="Edit combo" onCancel={(event) => { if (busy) event.preventDefault(); else setDraft(undefined); }}>
      <header><div><span>{draft.index === undefined ? "New combo" : "Edit combo"}</span><h2>Choose keys to press together</h2></div>
        <button type="button" aria-label="Cancel combo editing" disabled={busy} onClick={() => setDraft(undefined)}>×</button></header>
      <fieldset disabled={busy} className="nape-combo-fields">
        <div className="nape-combo-keys">
          {(["front", "back"] as const).map((side) => <ComboKeyDiagram key={side} side={side} positions={draft.combo.positions} onToggle={(position) => updateDraft({ positions: draft.combo.positions.includes(position) ? draft.combo.positions.filter((key) => key !== position) : [...draft.combo.positions, position] })} />)}
          <p className="nape-combo-key-hint">Select two or more keys. Diagrams use 0°.</p>
        </div>
        <div className="nape-slot-editor-body"><BehaviorBindingPicker binding={draft.combo.binding} behaviors={[...behaviors]} layers={layers} onBindingChanged={(binding) => updateDraft({ binding })} onValidityChanged={setBindingValid} /></div>
        <div className="nape-combo-timing">
          <label>Timeout (ms)<input type="number" min="1" max="5000" value={draft.combo.timeoutMs} onChange={(event) => updateDraft({ timeoutMs: event.target.valueAsNumber })} /><small>Press all keys within this time.</small></label>
          <label>Require prior idle (ms)<input type="number" min="0" max="5000" value={draft.combo.requirePriorIdleMs} onChange={(event) => updateDraft({ requirePriorIdleMs: event.target.valueAsNumber })} /><small>0 disables this condition.</small></label>
        </div>
        <label className="nape-combo-check"><input type="checkbox" checked={draft.combo.slowRelease} onChange={(event) => updateDraft({ slowRelease: event.target.checked })} />Slow release <small>Release the action after all keys are released.</small></label>
        <fieldset className="nape-combo-layers"><legend>Active layers</legend>
          <label><input type="checkbox" checked={draft.combo.layerMask === 0} onChange={() => updateDraft({ layerMask: draft.combo.layerMask === 0 ? 1 : 0 })} />All layers</label>
          <div>{layers.map((layer, i) => <label key={layer.id}><input type="checkbox" checked={Boolean(draft.combo.layerMask & (1 << i))} onChange={() => updateDraft({ layerMask: (draft.combo.layerMask ^ (1 << i)) >>> 0 })} />{i}: {layer.name}</label>)}</div>
        </fieldset>
      </fieldset>
      {(error || validation || !bindingValid) && <p className="nape-combo-error" role="alert">{error || validation || "Complete the behavior settings."}</p>}
      <footer className="nape-slot-editor-footer">
        <button type="button" disabled={busy} onClick={() => setDraft(undefined)}>Cancel</button>
        <button type="button" className="nape-slot-save" disabled={busy || Boolean(validation) || !bindingValid} onClick={() => withDraft && void apply(withDraft)}>{busy ? "Applying…" : "Apply"}</button>
        {draft.index !== undefined && <button type="button" className="nape-slot-delete" disabled={busy} onClick={() => combos && void apply(combos.filter((_, i) => i !== draft.index))}>Delete combo</button>}
      </footer>
    </dialog>, document.body)}
  </aside>;
}
