import { Select as BaseSelect } from "@base-ui/react/select";
import { cn } from "../../lib/cn.js";
import { panel, row } from "./looks.js";

export interface SelectItem<Value extends string> {
  value: Value;
  label: string;
}

export interface SelectProps<Value extends string> {
  /** Names the control for a screen reader; the caller draws any visible label beside it. */
  label: string;
  /** Every choice, with the label the trigger shows for it, so the trigger never shows a raw id. */
  items: readonly SelectItem<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  title?: string | undefined;
  /** The trigger's size, colours and typography. */
  className?: string;
}

/** A choice from a short list, in a popup. The popup drops below the trigger. */
export function Select<Value extends string>({
  label,
  items,
  value,
  onValueChange,
  disabled,
  title,
  className,
}: SelectProps<Value>) {
  return (
    <BaseSelect.Root
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={disabled ?? false}
    >
      <BaseSelect.Trigger
        aria-label={label}
        title={title}
        className={cn(
          "flex items-center justify-between gap-1.5 rounded-sm border border-line outline-none",
          "data-disabled:opacity-40 data-popup-open:border-accent",
          className,
        )}
      >
        <BaseSelect.Value className="truncate" />
        <BaseSelect.Icon aria-hidden className="text-[9px] text-subtle">
          ▾
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          sideOffset={3}
          collisionPadding={8}
          className="z-popup outline-none"
        >
          <BaseSelect.Popup className={cn(panel, "min-w-(--anchor-width)")}>
            <BaseSelect.List className="max-h-(--available-height) overflow-y-auto p-1">
              {items.map((item) => (
                <BaseSelect.Item
                  key={item.value}
                  value={item.value}
                  className={cn(row, "grid grid-cols-[0.75rem_1fr]")}
                >
                  <BaseSelect.ItemIndicator aria-hidden className="col-start-1 text-[10px] text-accent">
                    ✓
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText className="col-start-2">{item.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
