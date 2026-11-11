import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface CheckboxProps extends Omit<ComponentProps<typeof BaseCheckbox.Root>, "className" | "children"> {
  label: ReactNode;
  /** Why it is off, or what it does: shown for the whole row. */
  title?: string | undefined;
  /** The row's typography; the box is drawn by the wrapper. */
  className?: string;
}

/** A tick box with its label. The whole row is the click target. */
export function Checkbox({ label, title, className, ...props }: CheckboxProps) {
  return (
    <label
      title={title}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 has-data-disabled:cursor-default has-data-disabled:opacity-40",
        className,
      )}
    >
      <BaseCheckbox.Root
        {...props}
        className="flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-line bg-input text-accent-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent data-checked:border-accent data-checked:bg-accent"
      >
        <BaseCheckbox.Indicator aria-hidden className="text-[10px] leading-none font-bold">
          ✓
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      {label}
    </label>
  );
}
