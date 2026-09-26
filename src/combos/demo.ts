// Development-only in-memory device. Never connects to hardware.
import type { Request, RequestResponse, RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { NapeRequest, NapeResponse } from "../rpc/napeCodec";
import { usePub } from "../usePubSub";
import { Combo, decodeCombos, encodeCombos } from "./model";

const key = { name: "Key", hidUsage: { keyboardMax: 255, consumerMax: 1023 } };
const layer = { name: "Layer", layerId: {} };
const mouse = ["Left click", "Right click", "Middle click", "MB4", "MB5"].map((name, i) => ({ name, constant: 1 << i }));
const behaviors = [
  { id: 1, displayName: "Key Press", metadata: [{ param1: [key] }] },
  { id: 2, displayName: "Mouse Key Press", metadata: [{ param1: mouse }] },
  { id: 3, displayName: "Momentary Layer", metadata: [{ param1: [layer] }] },
  { id: 4, displayName: "To Layer", metadata: [{ param1: [layer] }] },
  { id: 5, displayName: "Bluetooth", metadata: [
    { param1: [{ name: "Select Profile", constant: 3 }], param2: [{ name: "Profile", range: { min: 0, max: 4 } }] },
    { param1: [{ name: "Clear Selected Profile", constant: 0 }, { name: "Clear All Profiles", constant: 4 }] },
  ] },
  { id: 6, displayName: "Transparent", metadata: [] },
  { id: 7, displayName: "LT_MKP", metadata: [{ param1: [layer], param2: mouse }] },
  { id: 8, displayName: "Mod-Tap", metadata: [{ param1: [key], param2: [key] }] },
  { id: 9, displayName: "Layer-Tap", metadata: [{ param1: [layer], param2: [key] }] },
].map((b) => GetBehaviorDetailsResponse.fromPartial(b));

export function createDemoConnection(): RpcConnection {
  const binding = (behaviorId: number, param1 = 0, param2 = 0) => ({ behaviorId, param1, param2 });
  const stockKeymap: Keymap = {
    availableLayers: 8, maxLayerNameLength: 20,
    layers: ["0°", "45°", "90°", "135°", "180°", "225°", "270°", "315°", "Bluetooth Select", "Bluetooth Clear", "Scroll", "Orientation"].map((name, id) => ({
      id, name, bindings: [binding(7, 10, 4), binding(2, 2), binding(2, 1), binding(3, 8), binding(3, 9), binding(3, 11)],
    })),
  };
  const stockCombos: Combo[] = [{ binding: binding(3, 10), positions: [1, 2], timeoutMs: 50, requirePriorIdleMs: 0, slowRelease: false, layerMask: 0 }];
  let keymap = structuredClone(stockKeymap);
  let combos = structuredClone(stockCombos);
  let saved = { keymap: structuredClone(keymap), combos: structuredClone(combos) };
  const notify = () => usePub()("rpc_notification.keymap.unsavedChangesStatusChanged", JSON.stringify({ keymap, combos }) !== JSON.stringify(saved));
  let replies: ReadableStreamDefaultController<RequestResponse>;
  return {
    label: "Demo only — no device connected", current_request: 0,
    request_response_readable: new ReadableStream({ start(controller) { replies = controller; } }),
    notification_readable: new ReadableStream(),
    request_writable: new WritableStream<Request>({
      write(request: NapeRequest) {
        const response: NapeResponse = { requestId: request.requestId };
        if (request.core?.getLockState) response.core = { getLockState: 1 };
        else if (request.core?.resetSettings) {
          keymap = structuredClone(stockKeymap); combos = structuredClone(stockCombos);
          saved = { keymap: structuredClone(keymap), combos: structuredClone(combos) };
          response.core = { resetSettings: true };
        } else if (request.behaviors?.listAllBehaviors) response.behaviors = { listAllBehaviors: { behaviors: behaviors.map((b) => b.id) } };
        else if (request.behaviors?.getBehaviorDetails) response.behaviors = { getBehaviorDetails: behaviors.find((b) => b.id === request.behaviors!.getBehaviorDetails!.behaviorId) };
        else if (request.nape) {
          if (request.nape.setCombos) {
            combos = decodeCombos(request.nape.setCombos).sort((a, b) => a.positions.length - b.positions.length);
            response.nape = { updated: true };
          } else response.nape = { combos: encodeCombos(combos) };
        } else if (request.keymap) {
          const req = request.keymap;
          if (req.getKeymap) response.keymap = { getKeymap: keymap };
          else if (req.getPhysicalLayouts) response.keymap = { getPhysicalLayouts: { activeLayoutIndex: 0, layouts: [{ name: "Nape", keys: [] }] } };
          else if (req.setActivePhysicalLayout !== undefined) response.keymap = { setActivePhysicalLayout: { ok: keymap } };
          else if (req.checkUnsavedChanges) response.keymap = { checkUnsavedChanges: JSON.stringify({ keymap, combos }) !== JSON.stringify(saved) };
          else if (req.saveChanges) { saved = structuredClone({ keymap, combos }); response.keymap = { saveChanges: { ok: true } }; }
          else if (req.discardChanges) { ({ keymap, combos } = structuredClone(saved)); response.keymap = { discardChanges: true }; }
          else if (req.setLayerBinding?.binding) {
            keymap.layers.find((l) => l.id === req.setLayerBinding!.layerId)!.bindings[req.setLayerBinding.keyPosition] = req.setLayerBinding.binding;
            response.keymap = { setLayerBinding: 0 };
          } else if (req.addLayer) {
            const index = keymap.layers.length;
            const added = { id: index, name: "", bindings: Array.from({ length: 6 }, () => binding(6)) };
            keymap.layers.push(added); keymap.availableLayers--;
            response.keymap = { addLayer: { ok: { index, layer: added } } };
          } else if (req.removeLayer) {
            const index = req.removeLayer.layerIndex;
            if (index < 12 || index >= keymap.layers.length) response.keymap = { removeLayer: { err: 2 } };
            else {
              keymap.layers.splice(index, 1); keymap.availableLayers++;
              response.keymap = { removeLayer: { ok: {} } };
            }
          }
        }
        replies.enqueue(structuredClone(response));
        void notify();
      },
    }),
  };
}
