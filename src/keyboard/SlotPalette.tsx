import { useEffect, useMemo, useRef, useState } from "react";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";

import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";

export const NAPE_BINDING_MIME = "application/x-nape-binding";
const USER_SLOTS_STORAGE_KEY = "nape-console:user-slots:v1";

type SlotCategory = "user" | "mouse" | "bluetooth" | "shortcuts" | "layers";

export interface BindingSlot {
  id: string;
  label: string;
  category: SlotCategory;
  binding: BehaviorBinding;
}

interface StoredUserSlot {
  id: string;
  label: string;
  behaviorName: string;
  param1: number;
  param2: number;
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

export function createDefaultSlots(behaviors: GetBehaviorDetailsResponse[]): BindingSlot[] {
  const behavior = (name: string) => behaviors.find((item) => item.displayName === name)?.id;
  const slots: BindingSlot[] = [];
  const add = (
    category: SlotCategory,
    label: string,
    behaviorName: string,
    param1 = 0,
    param2 = 0,
  ) => {
    const behaviorId = behavior(behaviorName);
    if (behaviorId === undefined) return;
    slots.push({
      id: `${category}-${slots.length}-${label}`,
      label,
      category,
      binding: { behaviorId, param1, param2 },
    });
  };

  add("mouse", "Left click", "Mouse Key Press", 1);
  add("mouse", "Right click", "Mouse Key Press", 2);
  add("mouse", "Middle click", "Mouse Key Press", 4);
  add("mouse", "MB4", "Mouse Key Press", 8);
  add("mouse", "MB5", "Mouse Key Press", 16);
  add("mouse", "Scroll layer", "Momentary Layer", 10);

  for (let profile = 0; profile < 5; profile += 1) {
    add("bluetooth", `Select profile ${profile + 1}`, "Bluetooth", 3, profile);
  }
  add("bluetooth", "Clear selected profile", "Bluetooth", 0, 0);
  add("bluetooth", "Clear all profiles", "Bluetooth", 4, 0);

  add("shortcuts", "Copy (Mac)", "Key Press", LEFT_GUI | C);
  add("shortcuts", "Copy (Win)", "Key Press", LEFT_CONTROL | C);
  add("shortcuts", "Paste (Mac)", "Key Press", LEFT_GUI | V);
  add("shortcuts", "Paste (Win)", "Key Press", LEFT_CONTROL | V);

  add("layers", "MO11 · Orientation", "Momentary Layer", 11);
  for (let layer = 0; layer < 12; layer += 1) {
    add("layers", `TO layer ${layer}`, "To Layer", layer);
  }

  return slots;
}

export function inferBindingLabel(
  binding: BehaviorBinding | undefined,
  behaviors: GetBehaviorDetailsResponse[],
): string | undefined {
  if (!binding) return undefined;

  const matchingDefault = createDefaultSlots(behaviors).find((slot) =>
    slot.binding.behaviorId === binding.behaviorId &&
    slot.binding.param1 === binding.param1 &&
    slot.binding.param2 === binding.param2
  );
  if (matchingDefault) return matchingDefault.label;

  const behavior = behaviors.find(({ id }) => id === binding.behaviorId);
  if (!behavior) return undefined;

  const params = [binding.param1, binding.param2].filter((value) => value !== 0);
  return params.length > 0
    ? `${behavior.displayName} · ${params.join(" / ")}`
    : behavior.displayName;
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
        !("label" in candidate) || typeof candidate.label !== "string" ||
        !("behaviorName" in candidate) || typeof candidate.behaviorName !== "string" ||
        !("param1" in candidate) || typeof candidate.param1 !== "number" ||
        !("param2" in candidate) || typeof candidate.param2 !== "number"
      ) return [];

      const behavior = behaviors.find(({ displayName }) => displayName === candidate.behaviorName);
      if (!behavior) return [];

      return [{
        id: candidate.id,
        label: candidate.label,
        category: "user",
        binding: {
          behaviorId: behavior.id,
          param1: candidate.param1,
          param2: candidate.param2,
        },
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
          label: slot.label,
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
  const defaults = useMemo(() => createDefaultSlots(behaviors), [behaviors]);
  const [slots, setSlots] = useState<BindingSlot[]>([]);
  const [editingId, setEditingId] = useState<string>();
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
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveUserSlots(slots, behaviors);
  }, [behaviors, slots]);

  const editingSlot = slots.find(({ id }) => id === editingId);
  const categories = (["user", "mouse", "bluetooth", "shortcuts", "layers"] as SlotCategory[])
    .map((category) => ({ category, slots: slots.filter((slot) => slot.category === category) }))
    .filter(({ category, slots: categorySlots }) => category !== "user" || categorySlots.length > 0);

  const updateSlot = (id: string, update: Partial<BindingSlot>) => {
    setSlots((current) => current.map((slot) => slot.id === id ? { ...slot, ...update } : slot));
  };

  const deleteUserSlot = (id: string) => {
    setSlots((current) => current.filter((slot) => slot.id !== id || slot.category !== "user"));
    setEditingId(undefined);
  };

  const addSlot = () => {
    const firstBehavior = behaviors[0];
    if (!firstBehavior) return;
    const id = `user-${Date.now()}`;
    setSlots((current) => [{
      id,
      label: "New slot",
      category: "user",
      binding: { behaviorId: firstBehavior.id, param1: 0, param2: 0 },
    }, ...current]);
    setEditingId(id);
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
                  className={`nape-slot ${editingId === slot.id ? "is-editing" : ""}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(NAPE_BINDING_MIME, JSON.stringify(slot.binding));
                    event.dataTransfer.setData("text/plain", slot.label);
                  }}
                  onClick={() => setEditingId((current) => current === slot.id ? undefined : slot.id)}
                >
                  <span>{slot.label}</span>
                  <small>{behaviors.find(({ id }) => id === slot.binding.behaviorId)?.displayName}</small>
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
      {editingSlot && (
        <div className="nape-slot-modal-backdrop" onMouseDown={() => setEditingId(undefined)}>
          <div
            className="nape-slot-editor"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${editingSlot.label}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Edit slot</span>
                <input
                  aria-label="Slot name"
                  value={editingSlot.label}
                  onChange={(event) => updateSlot(editingSlot.id, { label: event.target.value })}
                />
              </div>
              <button type="button" onClick={() => setEditingId(undefined)} aria-label="Close editor">×</button>
            </header>
            <div className="nape-slot-editor-body">
              <BehaviorBindingPicker
                binding={editingSlot.binding}
                behaviors={[...behaviors]}
                layers={layers}
                onBindingChanged={(binding) => updateSlot(editingSlot.id, { binding })}
              />
            </div>
            {editingSlot.category === "user" && (
              <footer className="nape-slot-editor-footer">
                <button type="button" onClick={() => deleteUserSlot(editingSlot.id)}>
                  Delete slot
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
