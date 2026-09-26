import { BehaviorBindingParametersSet } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { ParameterValuePicker } from "./ParameterValuePicker";
import { validateValue } from "./parameters";

export interface BehaviorParametersPickerProps {
  param1?: number;
  param2?: number;
  metadata: BehaviorBindingParametersSet[];
  behaviorName?: string;
  layers: { id: number; name: string }[];
  onParam1Changed: (value?: number) => void;
  onParam2Changed: (value?: number) => void;
}

export const BehaviorParametersPicker = ({
  param1,
  param2,
  metadata,
  behaviorName,
  layers,
  onParam1Changed,
  onParam2Changed,
}: BehaviorParametersPickerProps) => {
  const holdTap = ["Mod-Tap", "Layer-Tap", "LT_MKP", "MOD_MKP"].includes(behaviorName || "");
  const firstLabel = holdTap ? "Hold" : undefined;
  const secondLabel = holdTap ? "Tap" : undefined;
  if (param1 === undefined) {
    return (
      <div>
        <ParameterValuePicker
          values={metadata.flatMap((m) => m.param1)}
          onValueChanged={onParam1Changed}
          layers={layers}
          roleLabel={firstLabel}
        />
      </div>
    );
  } else {
    const set = metadata.find((s) =>
      validateValue(
        layers.map((l) => l.id),
        param1,
        s.param1
      )
    );
    return (
      <>
        <ParameterValuePicker
          values={metadata.flatMap((m) => m.param1)}
          value={param1}
          layers={layers}
          roleLabel={firstLabel}
          onValueChanged={onParam1Changed}
        />
        {(set?.param2?.length || 0) > 0 && (
          <ParameterValuePicker
            values={set!.param2}
            value={param2}
            layers={layers}
            roleLabel={secondLabel}
            onValueChanged={onParam2Changed}
          />
        )}
      </>
    );
  }
};
