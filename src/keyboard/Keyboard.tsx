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
  const [selectedKeyPosition, setSelectedKeyPosition] = useState<
    number | undefined
  >(undefined);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [keyLabels, setKeyLabels] = useState<Record<string, string>>({});
  const panGesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>();
  const behaviors = useBehaviors();

  const conn = useContext(ConnectionContext);
  const undoRedo = useContext(UndoRedoContext);

  useEffect(() => {
    setSelectedLayerIndex(0);
    setSelectedKeyPosition(undefined);
    setKeyLabels({});
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
    (binding: BehaviorBinding, keyPosition: number, slotLabel?: string, clearLabel = false) => {
      if (!keymap) {
        console.error(
          "Can't update binding without a loaded keymap"
        );
        return;
      }

      const layer = selectedLayerIndex;
      const layerId = keymap.layers[layer].id;
      const oldBinding = keymap.layers[layer].bindings[keyPosition];
      const labelKey = `${layer}:${keyPosition}`;
      const oldLabel = keyLabels[labelKey];
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
          if (slotLabel) {
            setKeyLabels((current) => ({
              ...current,
              [labelKey]: slotLabel,
            }));
          } else if (clearLabel) {
            setKeyLabels((current) => {
              const next = { ...current };
              delete next[labelKey];
              return next;
            });
          }
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
            setKeyLabels((current) => {
              const restored = { ...current };
              if (oldLabel) restored[labelKey] = oldLabel;
              else delete restored[labelKey];
              return restored;
            });
          } else {
          }
        };
      });
    },
    [conn, keyLabels, keymap, undoRedo, selectedLayerIndex]
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
      <div className="p-2 flex flex-col gap-2 bg-base-200">
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
              layers={keymap.layers.slice(0, 12)}
              selectedLayerIndex={selectedLayerIndex}
              onLayerClicked={setSelectedLayerIndex}
            />
          </div>
        )}
      </div>
      {layouts && keymap && behaviors && (
        <div className="nape-stage p-2 col-start-2 row-start-1 relative min-w-0">
          <div className="nape-workbench">
            <SlotPalette
              behaviors={Object.values(behaviors)}
              layers={keymap.layers.map(({ id, name }, li) => ({ id, name: name || li.toLocaleString() }))}
            />
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
                    keyLabels={Object.fromEntries(
                      Object.entries(keyLabels)
                        .filter(([key]) => key.startsWith(`${selectedLayerIndex}:`))
                        .map(([key, label]) => [Number(key.split(":")[1]), label])
                    )}
                    onKeyPositionClicked={setSelectedKeyPosition}
                    onBindingDropped={(keyPosition, binding, label) => doApplyBinding(binding, keyPosition, label)}
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
                onBindingChanged={(binding) => doApplyBinding(binding, selectedKeyPosition, undefined, true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
