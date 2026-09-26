import type { GetBehaviorDetailsResponse, BehaviorParameterValueDescription } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { hid_usage_get_labels, hid_usage_page_and_id_from_usage } from "../hid-usages";

type Layer = { id: number; name: string };

export function hidKeyName(usage: number): string {
  if (usage === 0) return "Not set";
  const [rawPage, id] = hid_usage_page_and_id_from_usage(usage);
  const page = rawPage & 0xff;
  const label = hid_usage_get_labels(page, id);
  let name = (label.short || label.med || label.long || `Key 0x${id.toString(16).toUpperCase()}`)
    .replace(/^Keyboard /, "");
  if (page === 7 && id >= 4 && id <= 29) name = String.fromCharCode(65 + id - 4);
  if (page === 7 && (id === 227 || id === 231)) name = "Cmd";
  const modifierNames = ["Ctrl", "Shift", "Alt", "Cmd", "R Ctrl", "R Shift", "R Alt", "R Cmd"];
  const modifiers = (usage >>> 24) & 0xff;
  const prefix = modifierNames.filter((_, bit) => modifiers & (1 << bit));
  return [...prefix, name].join(" + ");
}

function parameterName(
  value: number,
  descriptions: BehaviorParameterValueDescription[] | undefined,
  layers: Layer[],
): string {
  const constant = descriptions?.find((item) => item.constant === value);
  if (constant) return constant.name;
  if (descriptions?.some((item) => item.layerId)) {
    const layer = layers.find((item) => item.id === value);
    return layer ? `Layer ${value}${layer.name && layer.name !== String(value) ? ` (${layer.name})` : ""}` : `Layer ${value}`;
  }
  if (descriptions?.some((item) => item.hidUsage)) return hidKeyName(value);
  if (descriptions?.some((item) => item.range)) return String(value);
  return value === 0 ? "Not set" : `Value ${value}`;
}

export function bindingDisplayLines(
  binding: BehaviorBinding | undefined,
  behaviors: GetBehaviorDetailsResponse[],
  layers: Layer[] = [],
): string[] {
  if (!binding) return ["Unknown"];
  const behavior = behaviors.find((item) => item.id === binding.behaviorId);
  if (!behavior) return ["Unknown behavior"];
  const name = behavior.displayName;
  const set = behavior.metadata.find((item) => item.param1.some((value) =>
    value.constant === binding.param1 || value.hidUsage || value.layerId || value.range || value.nil
  )) || behavior.metadata[0];
  const first = parameterName(binding.param1, set?.param1, layers);
  const second = parameterName(binding.param2, set?.param2, layers);

  if (name === "Mouse Key Press") {
    const click = { 1: "Left click", 2: "Right click", 4: "Middle click", 8: "MB4", 16: "MB5" }[binding.param1];
    return [name, click || first];
  }

  if (["Mod-Tap", "Layer-Tap", "LT_MKP", "MOD_MKP"].includes(name)) {
    return [name, `Tap: ${second}`, `Hold: ${first}`];
  }
  if (name === "Bluetooth" && first.toLowerCase().includes("select")) {
    return [name, `${first} · Profile ${binding.param2 + 1}`];
  }
  if (set?.param2?.length) return [name, first, second];
  if (set?.param1?.length) return [name, first];
  return [name];
}
