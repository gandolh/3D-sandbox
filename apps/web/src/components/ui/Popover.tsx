import { Popover as BasePopover } from "@base-ui/react/popover";
import { type ReactNode, useRef } from "react";
import { cn } from "../../lib/cn.js";

const FOCUSABLE = "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)";

export interface PointPopoverProps {
  /** Where it sits, in the pixels of the positioned parent that holds this component. */
  at: readonly [number, number];
  /** Names the popover for a screen reader. */
  label: string;
  /** Esc was pressed. Outside clicks and focus leaving do not close it: the plan's own click handler decides that. */
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** For tests that find the popover by id. */
  testId?: string;
}

/**
 * A small panel that opens at a point on the plan and asks for one thing: a room's name, a typed distance.
 * Not modal, and the plan behind stays live. Focus goes to the first `[data-autofocus]` inside, else the
 * first control. Esc closes it.
 *
 * It is portalled and placed from an invisible anchor at `at`, which is computed geometry, so the one inline
 * `style` here is the base-ui rule 5 exception.
 */
export function PointPopover({ at, label, onClose, children, className, testId }: PointPopoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden
        style={{ left: at[0], top: at[1] }}
        className="pointer-events-none absolute size-0"
      />
      <BasePopover.Root
        open
        modal={false}
        onOpenChange={(next, details) => {
          if (!next && details.reason === "escape-key" && !details.event.defaultPrevented) onClose();
        }}
      >
        <BasePopover.Portal>
          <BasePopover.Positioner anchor={anchorRef} side="bottom" align="start" sideOffset={0} className="z-popup">
            <BasePopover.Popup
              ref={popupRef}
              aria-label={label}
              data-testid={testId}
              initialFocus={() =>
                popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
                popupRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
                true
              }
              className={cn("rounded-sm border border-line bg-chrome p-2.5 text-ink shadow-lg outline-none", className)}
            >
              {children}
            </BasePopover.Popup>
          </BasePopover.Positioner>
        </BasePopover.Portal>
      </BasePopover.Root>
    </>
  );
}
