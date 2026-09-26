import React, {
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Request } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "../rpc/logging";
import {
  PhysicalLayout,
  Keymap,
  SetLayerBindingResponse,
  BehaviorBinding,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

import { LayerPicker } from "./LayerPicker";
import { PhysicalLayoutPicker } from "./PhysicalLayoutPicker";
import { Keymap as KeymapComp } from "./Keymap";
import { SlotPalette } from "./SlotPalette";
import { ComboPanel } from "../combos/ComboPanel";
import { RuntimeSettingsButton } from "../runtime/RuntimeSettingsButton";
import { useLayerRuntimeSettings } from "../runtime/useLayerRuntimeSettings";
import { useConnectedDeviceData } from "../rpc/useConnectedDeviceData";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { UndoRedoContext } from "../undoRedo";
import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import { produce } from "immer";
import { LockStateContext } from "../rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { deserializeLayoutZoom, LayoutZoom } from "./PhysicalLayout";
import { useLocalStorageState } from "../misc/useLocalStorageState";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

function useBehaviors(): BehaviorMap {
  let connection = useContext(ConnectionContext);
  let lockState = useContext(LockStateContext);

  const [behaviors, setBehaviors] = useState<BehaviorMap>({});

  useEffect(() => {
    if (
      !connection.conn ||
      lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    ) {
      setBehaviors({});
      return;
    }

    async function startRequest() {
      setBehaviors({});

      if (!connection.conn) {
        return;
      }

      let get_behaviors: Request = {
        behaviors: { listAllBehaviors: true },
        requestId: 0,
      };

      let behavior_list = await call_rpc(connection.conn, get_behaviors);
      if (!ignore) {
        let behavior_map: BehaviorMap = {};
        for (let behaviorId of behavior_list.behaviors?.listAllBehaviors
          ?.behaviors || []) {
          if (ignore) {
            break;
          }
          let details_req = {
            behaviors: { getBehaviorDetails: { behaviorId } },
            requestId: 0,
          };
          let behavior_details = await call_rpc(connection.conn, details_req);
          let dets: GetBehaviorDetailsResponse | undefined =
            behavior_details?.behaviors?.getBehaviorDetails;

          if (dets) {
            behavior_map[dets.id] = dets;
          }
        }

        if (!ignore) {
          setBehaviors(behavior_map);
        }
      }
    }

    let ignore = false;
    startRequest();

    return () => {
      ignore = true;
    };
  }, [connection, lockState]);

  return behaviors;
}

function useLayouts(): [
  PhysicalLayout[] | undefined,
  React.Dispatch<SetStateAction<PhysicalLayout[] | undefined>>,
  number,
  React.Dispatch<SetStateAction<number>>
] {
  let connection = useContext(ConnectionContext);
  let lockState = useContext(LockStateContext);

  const [layouts, setLayouts] = useState<PhysicalLayout[] | undefined>(
    undefined
  );
  const [selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex] =
    useState<number>(0);

  useEffect(() => {
    if (
      !connection.conn ||
      lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    ) {
      setLayouts(undefined);
      return;
    }

    async function startRequest() {
      setLayouts(undefined);

      if (!connection.conn) {
        return;
      }

      let response = await call_rpc(connection.conn, {
        keymap: { getPhysicalLayouts: true },
      });

      if (!ignore) {
        setLayouts(response?.keymap?.getPhysicalLayouts?.layouts);
        setSelectedPhysicalLayoutIndex(
          response?.keymap?.getPhysicalLayouts?.activeLayoutIndex || 0
        );
      }
    }

    let ignore = false;
    startRequest();

    return () => {
      ignore = true;
    };
  }, [connection, lockState]);

  return [
    layouts,
    setLayouts,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ];
}

export default function Keyboard() {
  const [
    layouts,
    _setLayouts,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ] = useLayouts();
  const [keymap, setKeymap] = useConnectedDeviceData<Keymap>(
    { keymap: { getKeymap: true } },
    (keymap) => {
      console.log("Got the keymap!");
      return keymap?.keymap?.getKeymap;
    },
    true
  );

  const [keymapScale, setKeymapScale] = useLocalStorageState<LayoutZoom>("keymapScale", "auto", {
    deserialize: deserializeLayoutZoom,
  });

  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0);
  const [addingLayer, setAddingLayer] = useState(false);
  const [removingLayer, setRemovingLayer] = useState(false);
  const [layerError, setLayerError] = useState<string>();
  const [selectedKeyPosition, setSelectedKeyPosition] = useState<
    number | undefined
  >(undefined);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const panGesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>();
  const behaviors = useBehaviors();
  const runtime = useLayerRuntimeSettings();

  const conn = useContext(ConnectionContext);
  const undoRedo = useContext(UndoRedoContext);

  const addLayer = useCallback(async () => {
    if (!conn.conn || !keymap || addingLayer) return;
    if (keymap.availableLayers <= 0) {
      setLayerError("No free layer slots on this device. Flash the updated nape-studio.uf2 to add layers 12–19, then reconnect.");
      return;
    }
    setAddingLayer(true);
    setLayerError(undefined);
    try {
      const response = await call_rpc(conn.conn, { keymap: { addLayer: {} } });
      const added = response.keymap?.addLayer?.ok;
      if (!added?.layer) {
        setLayerError(response.keymap?.addLayer?.err === 2
          ? "No free layer slots on this firmware. Rebuild the Nape Studio firmware with reserved layers."
          : "Could not add a layer to the device.");
        return;
      }
      setKeymap((current) => current && produce(current, (draft) => {
        draft.layers.splice(added.index, 0, added.layer!);
        draft.availableLayers -= 1;
      }));
      setSelectedLayerIndex(added.index);
    } catch (error) {
      console.error("Failed to add layer", error);
      setLayerError("Could not add a layer to the device.");
    } finally {
      setAddingLayer(false);
    }
  }, [conn.conn, keymap, addingLayer, setKeymap]);

  const removeLayer = useCallback(async () => {
    const layer = keymap?.layers[selectedLayerIndex];
    // The first twelve layers are part of Nape's firmware layout, not user layers.
    if (!conn.conn || !layer || layer.id < 12 || selectedLayerIndex < 12 || addingLayer || removingLayer) return;
    if (layer.id === runtime.settings?.bootLayerId) {
      setLayerError("Choose another startup layer before deleting this layer.");
      return;
    }
    if (!window.confirm(`Delete layer ${selectedLayerIndex}${layer.name ? ` (${layer.name})` : ""}? Its key assignments will no longer be available. Save afterward to keep the change.`)) return;
    setRemovingLayer(true);
    setLayerError(undefined);
    try {
      const response = await call_rpc(conn.conn, { keymap: { removeLayer: { layerIndex: selectedLayerIndex } } });
      if (!response.keymap?.removeLayer?.ok) {
        setLayerError("Could not delete this layer from the device.");
        return;
      }
      setKeymap((current) => current && produce(current, (draft) => {
        draft.layers.splice(selectedLayerIndex, 1);
        draft.availableLayers += 1;
      }));
      setSelectedLayerIndex(Math.max(0, selectedLayerIndex - 1));
    } catch (error) {
      console.error("Failed to delete layer", error);
      setLayerError("Could not delete this layer from the device.");
    } finally {
      setRemovingLayer(false);
    }
  }, [conn.conn, keymap, selectedLayerIndex, addingLayer, removingLayer, runtime.settings?.bootLayerId, setKeymap]);

  useEffect(() => {
    setSelectedLayerIndex(0);
    setSelectedKeyPosition(undefined);
  }, [conn]);

  useEffect(() => {
    async function performSetRequest() {
      if (!conn.conn || !layouts) {
        return;
      }

      let resp = await call_rpc(conn.conn, {
        keymap: { setActivePhysicalLayout: selectedPhysicalLayoutIndex },
      });

      let new_keymap = resp?.keymap?.setActivePhysicalLayout?.ok;
      if (new_keymap) {
        setKeymap(new_keymap);
      } else {
        console.error(
          "Failed to set the active physical layout err:",
          resp?.keymap?.setActivePhysicalLayout?.err
        );
      }
    }

    performSetRequest();
  }, [selectedPhysicalLayoutIndex]);

  let doSelectPhysicalLayout = useCallback(
    (i: number) => {
      let oldLayout = selectedPhysicalLayoutIndex;
      undoRedo?.(async () => {
        setSelectedPhysicalLayoutIndex(i);

        return async () => {
          setSelectedPhysicalLayoutIndex(oldLayout);
        };
      });
    },
    [undoRedo, selectedPhysicalLayoutIndex]
  );

  let doApplyBinding = useCallback(
    (binding: BehaviorBinding, keyPosition: number) => {
      if (!keymap) {
        console.error(
          "Can't update binding without a loaded keymap"
        );
        return;
      }

      const layer = selectedLayerIndex;
      const layerId = keymap.layers[layer].id;
      const oldBinding = keymap.layers[layer].bindings[keyPosition];
      undoRedo?.(async () => {
        if (!conn.conn) {
          throw new Error("Not connected");
        }

        let resp = await call_rpc(conn.conn, {
          keymap: { setLayerBinding: { layerId, keyPosition, binding } },
        });

        if (
          resp.keymap?.setLayerBinding ===
          SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
        ) {
          setKeymap(
            produce((draft: any) => {
              draft.layers[layer].bindings[keyPosition] = binding;
            })
          );
        } else {
          console.error("Failed to set binding", resp.keymap?.setLayerBinding);
        }

        return async () => {
          if (!conn.conn) {
            return;
          }

          let resp = await call_rpc(conn.conn, {
            keymap: {
              setLayerBinding: { layerId, keyPosition, binding: oldBinding },
            },
          });
          if (
            resp.keymap?.setLayerBinding ===
            SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
          ) {
            setKeymap(
              produce((draft: any) => {
                draft.layers[layer].bindings[keyPosition] = oldBinding;
              })
            );
          } else {
          }
        };
      });
    },
    [conn, keymap, undoRedo, selectedLayerIndex]
  );

  const selectedBinding =
    keymap && selectedKeyPosition !== undefined
      ? keymap.layers[selectedLayerIndex]?.bindings[selectedKeyPosition]
      : undefined;

  useEffect(() => {
    if (!keymap?.layers) return;

    const layers = keymap.layers.length - 1;

    if (selectedLayerIndex > layers) {
      setSelectedLayerIndex(layers);
    }
  }, [keymap, selectedLayerIndex]);

  return (
    <div className="grid grid-cols-[auto_1fr] grid-rows-[1fr] bg-base-300 max-w-full min-w-0 min-h-0">
      <div className="nape-layer-sidebar bg-base-200">
        <div className="nape-layer-scroll">
        {layouts && layouts.length > 1 && (
          <div className="col-start-3 row-start-1 row-end-2">
            <PhysicalLayoutPicker
              layouts={layouts}
              selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
              onPhysicalLayoutClicked={doSelectPhysicalLayout}
            />
          </div>
        )}

        {keymap && (
          <div className="col-start-1 row-start-1 row-end-2">
            <LayerPicker
              layers={keymap.layers}
              selectedLayerIndex={selectedLayerIndex}
              onLayerClicked={setSelectedLayerIndex}
              bootLayerId={runtime.settings?.bootLayerId}
              bootLayerBusy={runtime.busy}
              onBootLayerClicked={runtime.settings ? (id) => void runtime.change((current) => ({ ...current, bootLayerId: id })) : undefined}
              canAdd={!addingLayer && !removingLayer}
              onAddClicked={addLayer}
              canRemove={!addingLayer && !removingLayer && selectedLayerIndex >= 12 && (keymap.layers[selectedLayerIndex]?.id ?? -1) >= 12}
              onRemoveClicked={removeLayer}
            />
            {keymap.availableLayers <= 0 && <p className="max-w-40 text-xs text-muted">0 free layers on this firmware</p>}
            {layerError && <p role="alert" className="max-w-40 text-xs text-error">{layerError}</p>}
          </div>
        )}
        </div>
        {keymap && <div className="nape-layer-inspector">
          <p className="nape-layer-inspector-title">Selected layer</p>
          <p className="nape-layer-inspector-name">{keymap.layers[selectedLayerIndex]?.name || String(selectedLayerIndex)}</p>
          <label htmlFor="nape-layer-dpi">Trackball DPI</label>
          <select id="nape-layer-dpi"
            disabled={!runtime.settings || runtime.busy || (keymap.layers[selectedLayerIndex]?.id ?? 32) >= 32}
            value={runtime.settings?.layerCpi[keymap.layers[selectedLayerIndex]?.id ?? 32] ?? 0}
            onChange={(event) => {
              const id = keymap.layers[selectedLayerIndex]?.id;
              if (id === undefined) return;
              const cpi = Number(event.target.value);
              void runtime.change((current) => ({ ...current,
                layerCpi: current.layerCpi.map((value, index) => index === id ? cpi : value),
              }));
            }}>
            <option value={0}>Use common ({runtime.settings?.cpi ?? 800} DPI)</option>
            {Array.from({ length: 16 }, (_, i) => (i + 1) * 200).map((cpi) => <option key={cpi} value={cpi}>{cpi} DPI</option>)}
          </select>
          <p className="nape-layer-inspector-help">Takes effect when this layer is active.</p>
        </div>}
        {keymap && <div className="nape-global-settings">
          {runtime.settings && <p className="nape-layer-inspector-boot">Next startup: {keymap.layers.find((layer) => layer.id === runtime.settings?.bootLayerId)?.name || "0°"}</p>}
          {runtime.error && <p role="alert" className="nape-layer-inspector-error">{runtime.error}</p>}
          <RuntimeSettingsButton behaviors={Object.values(behaviors)} />
        </div>}
      </div>
      {layouts && keymap && behaviors && (
        <div className="nape-stage p-2 col-start-2 row-start-1 relative min-w-0">
          <div className="nape-workbench">
            <SlotPalette
              behaviors={Object.values(behaviors)}
              layers={keymap.layers.map(({ id, name }, li) => ({ id, name: name || li.toLocaleString() }))}
            />
            <ComboPanel behaviors={Object.values(behaviors)} layers={keymap.layers.map(({ id, name }, i) => ({ id, name: name || String(i) }))} />
            <div
              className="nape-keymap-viewport"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button, input, select, textarea, summary")) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                panGesture.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: canvasPan.x,
                  originY: canvasPan.y,
                };
                event.currentTarget.classList.add("is-panning");
              }}
              onPointerMove={(event) => {
                const gesture = panGesture.current;
                if (!gesture || gesture.pointerId !== event.pointerId) return;
                setCanvasPan({
                  x: gesture.originX + event.clientX - gesture.startX,
                  y: gesture.originY + event.clientY - gesture.startY,
                });
              }}
              onPointerUp={(event) => {
                if (panGesture.current?.pointerId !== event.pointerId) return;
                panGesture.current = undefined;
                event.currentTarget.classList.remove("is-panning");
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
            >
              <div
                className="nape-keymap-canvas"
                style={{
                  transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${typeof keymapScale === "number" ? keymapScale : 1})`,
                }}
              >
                <div className="nape-keymap-rotation">
                  <KeymapComp
                    keymap={keymap}
                    behaviors={behaviors}
                    selectedLayerIndex={selectedLayerIndex}
                    rotationDegrees={selectedLayerIndex >= 0 && selectedLayerIndex <= 7 ? selectedLayerIndex * 45 : 0}
                    selectedKeyPosition={selectedKeyPosition}
                    onKeyPositionClicked={setSelectedKeyPosition}
                    onBindingDropped={(keyPosition, binding) => doApplyBinding(binding, keyPosition)}
                  />
                </div>
              </div>
              <div className="nape-canvas-controls" aria-label="Canvas zoom">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setKeymapScale(Math.max(0.5, (typeof keymapScale === "number" ? keymapScale : 1) - 0.1))}
                >−</button>
                <button
                  type="button"
                  className="nape-canvas-zoom-value"
                  onClick={() => { setKeymapScale(1); setCanvasPan({ x: 0, y: 0 }); }}
                  aria-label="Reset zoom and position"
                >{Math.round((typeof keymapScale === "number" ? keymapScale : 1) * 100)}%</button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setKeymapScale(Math.min(2, (typeof keymapScale === "number" ? keymapScale : 1) + 0.1))}
                >+</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {keymap && selectedBinding && selectedKeyPosition !== undefined && (
        <div className="nape-slot-modal-backdrop" onMouseDown={() => setSelectedKeyPosition(undefined)}>
          <div
            className="nape-slot-editor"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit key ${selectedKeyPosition + 1}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Edit key</span>
                <h2>Key {selectedKeyPosition + 1}</h2>
              </div>
              <button type="button" onClick={() => setSelectedKeyPosition(undefined)} aria-label="Close editor">×</button>
            </header>
            <div className="nape-slot-editor-body">
              <BehaviorBindingPicker
                binding={selectedBinding}
                behaviors={[...Object.values(behaviors)]}
                layers={keymap.layers.map(({ id, name }, li) => ({ id, name: name || li.toLocaleString() }))}
                onBindingChanged={(binding) => doApplyBinding(binding, selectedKeyPosition)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
