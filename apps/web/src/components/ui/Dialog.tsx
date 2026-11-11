import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode, useRef } from "react";
import { cn } from "../../lib/cn.js";

const FOCUSABLE =
  "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children?: ReactNode;
  /** The actions, Cancel first. */
  footer?: ReactNode;
  /** For a dialog that holds a form: an outside click must not throw away what was typed. */
  disablePointerDismissal?: boolean;
  className?: string;
}

/**
 * A modal dialog: focus stays inside, the page behind is inert, and focus goes back where it was on close.
 * Esc, the X and (unless `disablePointerDismissal`) an outside click close it.
 *
 * On open, focus goes to the first `[data-autofocus]` inside, else the body's first control, else the footer's
 * first button: never the X.
 *
 * The Escape guard: an Esc that a control inside already used (a list closing) is not the dialog's. The Esc that
 * does close it stops at the document (Base UI stops its propagation), so the plan tools' window listeners never
 * see it and a half-drawn wall stays.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  disablePointerDismissal,
  className,
}: DialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next, details) => {
        if (!next && details.reason === "escape-key" && details.event.defaultPrevented) return;
        onOpenChange(next);
      }}
      disablePointerDismissal={disablePointerDismissal ?? false}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-overlay bg-black/55 motion-safe:transition-opacity motion-safe:duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <BaseDialog.Popup
          ref={popupRef}
          initialFocus={() =>
            popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
            bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
            popupRef.current?.querySelector<HTMLElement>("footer button:not(:disabled)") ??
            true
          }
          className={cn(
            "fixed top-1/2 left-1/2 z-dialog w-105 max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2",
            "rounded-sm border border-line bg-panel p-4 text-ink shadow-2xl outline-none",
            "motion-safe:transition-opacity motion-safe:duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
            className,
          )}
        >
          <div className="mb-2 flex items-start gap-3">
            <BaseDialog.Title className="flex-1 text-[13px] font-semibold text-ink">{title}</BaseDialog.Title>
            <BaseDialog.Close
              aria-label="Close"
              className="-mt-1 -mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-sm text-[16px] leading-none text-muted hover:text-ink"
            >
              <span aria-hidden>×</span>
            </BaseDialog.Close>
          </div>
          <div ref={bodyRef}>{children}</div>
          {footer !== undefined && <footer className="flex justify-end gap-2">{footer}</footer>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
