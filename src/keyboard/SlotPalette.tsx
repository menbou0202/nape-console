import { useEffect, useMemo, useRef, useState } from "react";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";

import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import { bindingDisplayLines } from "./bindingDisplay";

export const NAPE_BINDING_MIME = "application/x-nape-binding";
const USER_SLOTS_STORAGE_KEY = "nape-console:user-slots:v1";

type SlotCategory = "user" | "mouse" | "bluetooth" | "shortcuts" | "layers";

export interface BindingSlot {
  id: string;
  category: SlotCategory;
  binding: BehaviorBinding;
}

interface StoredUserSlot {
  id: string;
  behaviorName: string;
  param1: number;
  param2: number;
}

interface SlotDraft {
  slot: BindingSlot;
  isNew: boolean;
}

const CATEGORY_LABELS: Record<SlotCategory, string> = {
  user: "User",
  mouse: "Mouse",
  bluetooth: "Bluetooth",
  shortcuts: "Shortcuts",
  layers: "Layers",
};

const KEYBOARD_USAGE = 0x07 << 16;
const C = KEYBOARD_USAGE | 0x06;
const V = KEYBOARD_USAGE | 0x19;
const LEFT_CONTROL = 0x01 << 24;
const LEFT_GUI = 0x08 << 24;

export function createDefaultSlots(behaviors: GetBehaviorDetailsResponse[], layerCount = 12): BindingSlot[] {
  const behavior = (name: string) => behaviors.find((item) => item.displayName === name)?.id;
  const slots: BindingSlot[] = [];
  const add = (
    category: SlotCategory,
    behaviorName: string,
    param1 = 0,
    param2 = 0,
  ) => {
    const behaviorId = behavior(behaviorName);
    if (behaviorId === undefined) return;
    slots.push({
      id: `${category}-${behaviorName}-${param1}-${param2}`,
      category,
      binding: { behaviorId, param1, param2 },
    });
  };

  add("mouse", "Mouse Key Press", 1);
  add("mouse", "Mouse Key Press", 2);
  add("mouse", "Mouse Key Press", 4);
  add("mouse", "Mouse Key Press", 8);
  add("mouse", "Mouse Key Press", 16);
  add("mouse", "Momentary Layer", 10);

  for (let profile = 0; profile < 5; profile += 1) {
    add("bluetooth", "Bluetooth", 3, profile);
  }
  add("bluetooth", "Bluetooth", 0, 0);
  add("bluetooth", "Bluetooth", 4, 0);

  add("shortcuts", "Key Press", LEFT_GUI | C);
  add("shortcuts", "Key Press", LEFT_CONTROL | C);
  add("shortcuts", "Key Press", LEFT_GUI | V);
  add("shortcuts", "Key Press", LEFT_CONTROL | V);

  for (let layer = 0; layer < 12; layer += 1) {
    add("layers", "Momentary Layer", layer);
  }
  for (let layer = 0; layer < layerCount; layer += 1) {
    add("layers", "To Layer", layer);
  }

  return slots;
}

function loadUserSlots(behaviors: GetBehaviorDetailsResponse[]): BindingSlot[] {
  try {
    const stored = localStorage.getItem(USER_SLOTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((candidate): BindingSlot[] => {
      if (
        typeof candidate !== "object" || candidate === null ||
        !("id" in candidate) || typeof candidate.id !== "string" ||
        !("behaviorName" in candidate) || typeof candidate.behaviorName !== "string" ||
        !("param1" in candidate) || typeof candidate.param1 !== "number" ||
        !("param2" in candidate) || typeof candidate.param2 !== "number"
      ) return [];

      const behavior = behaviors.find(({ displayName }) => displayName === candidate.behaviorName);
      if (!behavior) return [];

      const binding = {
        behaviorId: behavior.id,
        param1: candidate.param1,
        param2: candidate.param2,
      };
      return [{
        id: candidate.id,
        category: "user",
        binding,
      }];
    });
  } catch (error) {
    console.error("Failed to load Nape user slots", error);
    return [];
  }
}

function saveUserSlots(slots: BindingSlot[], behaviors: GetBehaviorDetailsResponse[]) {
  try {
    const stored: StoredUserSlot[] = slots
      .filter(({ category }) => category === "user")
      .flatMap((slot): StoredUserSlot[] => {
        const behaviorName = behaviors.find(({ id }) => id === slot.binding.behaviorId)?.displayName;
        if (!behaviorName) return [];
        return [{
          id: slot.id,
          behaviorName,
          param1: slot.binding.param1,
          param2: slot.binding.param2,
        }];
      });
    localStorage.setItem(USER_SLOTS_STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error("Failed to save Nape user slots", error);
  }
}

export interface SlotPaletteProps {
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; name: string }[];
}

export function SlotPalette({ behaviors, layers }: SlotPaletteProps) {
  const defaults = useMemo(() => createDefaultSlots(behaviors, layers.length), [behaviors, layers.length]);
  const [slots, setSlots] = useState<BindingSlot[]>([]);
  const [draft, setDraft] = useState<SlotDraft>();
  const initialized = useRef(false);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (initialized.current || defaults.length === 0) return;
    setSlots([...loadUserSlots(behaviors), ...defaults]);
    skipNextSave.current = true;
    initialized.current = true;
  }, [behaviors, defaults]);

  useEffect(() => {
    if (!initialized.current) return;
    setSlots((current) => {
      const existingDefaults = new Map(current.filter((slot) => slot.category !== "user").map((slot) => [slot.id, slot]));
      const next = [...current.filter((slot) => slot.category === "user"), ...defaults.map((slot) => existingDefaults.get(slot.id) || slot)];
      return current.length === next.length && current.every((slot, index) => slot === next[index]) ? current : next;
    });
  }, [defaults]);

  useEffect(() => {
    if (!initialized.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveUserSlots(slots, behaviors);
  }, [behaviors, slots]);

  const editingSlot = draft?.slot;
  const categories = (["user", "mouse", "bluetooth", "shortcuts", "layers"] as SlotCategory[])
    .map((category) => ({ category, slots: slots.filter((slot) => slot.category === category) }))
    .filter(({ category, slots: categorySlots }) => category !== "user" || categorySlots.length > 0);

  const updateDraft = (update: Partial<BindingSlot>) => {
    setDraft((current) => current ? { ...current, slot: { ...current.slot, ...update } } : current);
  };

  const deleteUserSlot = (id: string) => {
    setSlots((current) => current.filter((slot) => slot.id !== id || slot.category !== "user"));
    setDraft(undefined);
  };

  const saveDraft = () => {
    if (!draft) return;
    const savedSlot = draft.slot;
    setSlots((current) => draft.isNew
      ? [savedSlot, ...current]
      : current.map((slot) => slot.id === savedSlot.id ? savedSlot : slot)
    );
    setDraft(undefined);
  };

  const addSlot = () => {
    const firstBehavior = behaviors[0];
    if (!firstBehavior) return;
    const id = `user-${Date.now()}`;
    setDraft({
      isNew: true,
      slot: {
        id,
        category: "user",
        binding: { behaviorId: firstBehavior.id, param1: 0, param2: 0 },
      },
    });
  };

  return (
    <aside className="nape-slot-palette" aria-label="Key slots">
      <header className="nape-slot-header">
        <div>
          <strong>Key slots</strong>
          <span>Drag onto a key</span>
        </div>
        <button type="button" className="nape-slot-add" onClick={addSlot} aria-label="Add key slot">+</button>
      </header>
      <div className="nape-slot-categories">
        {categories.map(({ category, slots: categorySlots }) => (
          <details key={category} className="nape-slot-category" open>
            <summary>{CATEGORY_LABELS[category]} <span>{categorySlots.length}</span></summary>
            <div className="nape-slot-list">
              {categorySlots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`nape-slot ${editingSlot?.id === slot.id ? "is-editing" : ""}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(NAPE_BINDING_MIME, JSON.stringify(slot.binding));
                  }}
                  onClick={() => setDraft((current) => current?.slot.id === slot.id
                    ? undefined
                    : { slot: { ...slot, binding: { ...slot.binding } }, isNew: false }
                  )}
                >
                  <span>{behaviors.find(({ id }) => id === slot.binding.behaviorId)?.displayName || "Unknown"}</span>
                  {bindingDisplayLines(slot.binding, behaviors, layers).slice(1).map((line, index) =>
                    <small key={index}>{line}</small>
                  )}
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
      {editingSlot && (
        <div className="nape-slot-modal-backdrop" onMouseDown={() => setDraft(undefined)}>
          <div
            className="nape-slot-editor"
            role="dialog"
            aria-modal="true"
            aria-label="Edit slot"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Edit slot</span>
                <h2>{bindingDisplayLines(editingSlot.binding, behaviors, layers).map((line, index) =>
                  <span key={index}>{line}</span>
                )}</h2>
              </div>
              <button type="button" onClick={() => setDraft(undefined)} aria-label="Cancel editing">×</button>
            </header>
            <div className="nape-slot-editor-body">
              <BehaviorBindingPicker
                binding={editingSlot.binding}
                behaviors={[...behaviors]}
                layers={layers}
                onBindingChanged={(binding) => updateDraft({ binding })}
              />
            </div>
            <footer className="nape-slot-editor-footer">
              <button type="button" className="nape-slot-save" onClick={saveDraft}>
                Save
              </button>
              {editingSlot.category === "user" && !draft?.isNew && (
                <button type="button" className="nape-slot-delete" onClick={() => deleteUserSlot(editingSlot.id)}>
                  Delete slot
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </aside>
  );
}
