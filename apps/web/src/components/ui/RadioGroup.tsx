import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { type ReactNode, useId } from "react";
import { cn } from "../../lib/cn.js";

export interface RadioOption<Value extends string> {
  value: Value;
  label: ReactNode;
}

export interface RadioGroupProps<Value extends string> {
  /** Names the group; it is not drawn. */
  label: string;
  options: readonly RadioOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  /** The group's size and typography. */
  className?: string;
}

/**
 * One choice from a few, drawn as a row of buttons. Tab enters the group and the arrow keys move and choose,
 * which is right for a setting kept on the device: trying each option is free, because nothing goes to the
 * server.
 */
export function RadioGroup<Value extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: RadioGroupProps<Value>) {
  const labelId = useId();
  return (
    <>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <BaseRadioGroup<Value>
        aria-labelledby={labelId}
        value={value}
        onValueChange={onValueChange}
        className="inline-flex w-fit rounded-sm border border-line bg-panel"
      >
        {options.map((option, i) => (
          <Radio.Root
            key={option.value}
            value={option.value}
            className={cn(
              "px-2.5 py-1.5 text-muted outline-none select-none",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              "hover:not-data-checked:text-ink data-checked:bg-accent data-checked:text-accent-ink",
              i > 0 && "border-l border-line",
              className,
            )}
          >
            {option.label}
          </Radio.Root>
        ))}
      </BaseRadioGroup>
    </>
  );
}
