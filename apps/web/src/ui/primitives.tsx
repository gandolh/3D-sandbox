import type { ReactNode } from "react";

export const PanelTitle = ({ children }: { children: ReactNode }) => (
  <div className="px-3 pt-3 pb-2 font-mono text-[9.5px] tracking-[0.13em] text-subtle uppercase">
    {children}
  </div>
);

export function Field({
  label,
  value,
  unit,
  onCommit,
  step = 0.01,
  disabled = false,
}: {
  label: string;
  value: number;
  unit?: string | undefined;
  onCommit?: ((next: number) => void) | undefined;
  step?: number | undefined;
  disabled?: boolean | undefined;
}) {
  const readOnly = onCommit === undefined || disabled;
  return (
    <label className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          disabled={readOnly}
          value={Number.isFinite(value) ? Number(value.toFixed(4)) : 0}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value);
            if (Number.isFinite(next)) onCommit?.(next);
          }}
          className="w-[86px] rounded-sm border border-line bg-input px-2 py-[3px] text-right font-mono text-[11.5px] text-ink tabular-nums disabled:text-muted"
        />
        {unit !== undefined && <span className="w-5 font-mono text-[10px] text-subtle">{unit}</span>}
      </span>
    </label>
  );
}

export const Divider = ({ children }: { children: ReactNode }) => (
  <div className="mt-4 mb-2 border-t border-line pt-3 font-mono text-[9.5px] tracking-[0.12em] text-subtle uppercase">
    {children}
  </div>
);
