import { Keymap as KeymapMsg } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

import { HidUsageLabel } from "./HidUsageLabel";
import napeWireframe from "../../images/Nape.svg";
import napeBackWireframe from "../../images/NapeBack.svg";
import { inferBindingLabel, NAPE_BINDING_MIME } from "./SlotPalette";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

export interface KeymapProps {
  keymap: KeymapMsg;
  behaviors: BehaviorMap;
  selectedLayerIndex: number;
  rotationDegrees: number;
  selectedKeyPosition: number | undefined;
  keyLabels: Record<number, string>;
  onKeyPositionClicked: (keyPosition: number) => void;
  onBindingDropped: (keyPosition: number, binding: { behaviorId: number; param1: number; param2: number }, label: string) => void;
}

export const Keymap = ({
  keymap,
  behaviors,
  selectedLayerIndex,
  rotationDegrees,
  selectedKeyPosition,
  keyLabels,
  onKeyPositionClicked,
  onBindingDropped,
}: KeymapProps) => {
  if (!keymap.layers[selectedLayerIndex]) {
    return <></>;
  }

  const layer = keymap.layers[selectedLayerIndex];

  const renderKey = (position: number, backNumber?: number) => {
    const binding = layer.bindings[position];
    const behavior = behaviors[binding?.behaviorId];
    const slotLabel = keyLabels[position] || inferBindingLabel(binding, Object.values(behaviors));

    return (
      <button
        type="button"
        className={`nape-pro-key ${selectedKeyPosition === position ? "is-selected" : ""}`}
        onClick={() => onKeyPositionClicked(position)}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(NAPE_BINDING_MIME)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const rawBinding = event.dataTransfer.getData(NAPE_BINDING_MIME);
          const slotLabel = event.dataTransfer.getData("text/plain");
          if (!rawBinding) return;
          try {
            onBindingDropped(position, JSON.parse(rawBinding), slotLabel);
          } catch (error) {
            console.error("Invalid Nape slot binding", error);
          }
        }}
        aria-label={`${backNumber ? `Back ${backNumber}` : `Front ${position + 1}`}: ${behavior?.displayName || "Unknown"}`}
      >
        {backNumber && <span className="nape-pro-key-number">{backNumber}</span>}
        <span className="nape-pro-key-behavior">{behavior?.displayName || "Unknown"}</span>
        <span className="nape-pro-key-value">
          {slotLabel || (binding && <HidUsageLabel hid_usage={binding.param1} />)}
        </span>
      </button>
    );
  };

  type CalloutSide = "right" | "bottom" | "left" | "top";

  const normalizedRotation = ((rotationDegrees % 360) + 360) % 360;
  const getCalloutSide = (diagramSide: "front" | "back"): CalloutSide => {
    if (diagramSide === "back") {
      return normalizedRotation < 90
        ? "bottom"
        : normalizedRotation < 180
          ? "left"
          : normalizedRotation < 270
            ? "top"
            : "right";
    }

    return normalizedRotation < 90
      ? "right"
      : normalizedRotation < 180
        ? "bottom"
        : normalizedRotation < 270
          ? "left"
          : "top";
  };

  const getDiagramCenter = (side: CalloutSide) => ({
    right: { x: 34, y: 50 },
    bottom: { x: 50, y: 34 },
    left: { x: 66, y: 50 },
    top: { x: 50, y: 66 },
  })[side];

  const rotatePoint = (x: number, y: number, center: { x: number; y: number }) => {
    const radians = (rotationDegrees * Math.PI) / 180;
    const diagramScale = 0.68;
    const dx = (x - 50) * diagramScale;
    const dy = (y - 50) * diagramScale;
    return {
      x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    };
  };

  const calloutSlots = (
    side: CalloutSide,
    center: { x: number; y: number },
    keys: Array<{ position: number; number?: number; anchor: [number, number] }>,
  ) => {
    const horizontal = side === "top" || side === "bottom";
    const sorted = keys
      .map((key) => ({ ...key, point: rotatePoint(key.anchor[0], key.anchor[1], center) }))
      .sort((a, b) => horizontal ? a.point.x - b.point.x : a.point.y - b.point.y);
    const slots = [16, 50, 84];

    return sorted.map((key, index) => {
      const slot = slots[index];
      if (side === "right") {
        return { ...key, label: { x: 62, y: slot }, port: { x: 62, y: slot } };
      }
      if (side === "left") {
        return { ...key, label: { x: 1, y: slot }, port: { x: 39, y: slot } };
      }
      if (side === "bottom") {
        return { ...key, label: { x: slot - 15.5, y: 89 }, port: { x: slot, y: 79 } };
      }
      return { ...key, label: { x: slot - 15.5, y: 11 }, port: { x: slot, y: 21 } };
    });
  };

  const renderDiagram = (
    side: "front" | "back",
    wireframe: string,
    keys: Array<{
      position: number;
      number?: number;
      anchor: [number, number];
    }>,
  ) => {
    const activeCalloutSide = getCalloutSide(side);
    const diagramCenter = getDiagramCenter(activeCalloutSide);
    const callouts = calloutSlots(activeCalloutSide, diagramCenter, keys);
    return (
    <section className={`nape-diagram nape-diagram--${activeCalloutSide}`} aria-label={`${side} keys`}>
      <span className="nape-diagram-label">{side === "front" ? "Front" : "Back"}</span>
      <div
        className="nape-diagram-shell"
        style={{
          left: `${diagramCenter.x - 8.85}%`,
          top: `${diagramCenter.y - 34}%`,
          transform: `rotate(${rotationDegrees}deg)`,
        }}
      >
        <img src={wireframe} alt={`Nape Pro ${side} wireframe`} />
      </div>
      <svg className="nape-callout-lines" viewBox="0 0 100 100" aria-hidden="true">
        {callouts.map(({ position, point, port }) => {
          return (
            <g key={position} className={selectedKeyPosition === position ? "is-selected" : ""}>
              <line x1={point.x} y1={point.y} x2={port.x} y2={port.y} />
              <circle cx={point.x} cy={point.y} r="0.9" />
            </g>
          );
        })}
      </svg>
      {callouts.map(({ position, number, label }) => (
        <div
          key={position}
          className="nape-callout-key"
          style={{ left: `${label.x}%`, top: `${label.y}%` }}
        >
          {renderKey(position, number)}
        </div>
      ))}
    </section>
  )};

  return (
    <div className="nape-pro-layout">
      {renderDiagram("front", napeWireframe, [
        { position: 2, anchor: [50, 17.5] },
        { position: 1, anchor: [50, 29.4] },
        { position: 0, anchor: [50, 72.6] },
      ])}
      {renderDiagram("back", napeBackWireframe, [
        { position: 5, number: 3, anchor: [43.5, 60] },
        { position: 4, number: 2, anchor: [50, 60] },
        { position: 3, number: 1, anchor: [56.5, 60] },
      ])}
    </div>
  );
};
