import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toolbar } from "@base-ui/react/toolbar";
import { cn } from "../../lib/cn.js";

export interface ToggleToolbarItem<Value extends string> {
  value: Value;
  label: string;
  title?: string | undefined;
  disabled?: boolean;
}

export interface ToggleToolbarProps<Value extends string> {
  /** Names the toolbar for a screen reader. */
  label: string;
  items: readonly ToggleToolbarItem<Value>[];
  /** The chosen item. One is always chosen: pressing it again keeps it. */
  value: Value;
  onValueChange: (value: Value) => void;
  className?: string;
}

/**
 * A row of tool buttons that is one Tab stop: Tab enters it, the arrow keys move along it, Tab leaves. Each button
 * is a Toggle, so the chosen one reads as pressed; the group holds exactly one.
 */
export function ToggleToolbar<Value extends string>({
  label,
  items,
  value,
  onValueChange,
  className,
}: ToggleToolbarProps<Value>) {
  return (
    <Toolbar.Root aria-label={label} className={cn("flex", className)}>
      <ToggleGroup
        aria-label={label}
        value={[value]}
        onValueChange={(next) => {
          const chosen = next[0];
          // Pressing the chosen tool again would leave none chosen.
          if (chosen !== undefined) onValueChange(chosen as Value);
        }}
        className="flex"
      >
        {items.map((item, i) => (
          <Toolbar.Button
            key={item.value}
            render={<Toggle />}
            value={item.value}
            disabled={item.disabled ?? false}
            title={item.title}
            className={cn(
              "rounded-sm border border-line bg-panel px-2 py-[3px] font-mono text-[10px] tracking-wider text-muted uppercase outline-none",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              "hover:not-data-disabled:not-data-pressed:text-ink data-disabled:cursor-default data-disabled:opacity-40",
              "data-pressed:border-accent data-pressed:bg-accent data-pressed:text-accent-ink",
              i > 0 && "-ml-px",
            )}
          >
            {item.label}
          </Toolbar.Button>
        ))}
      </ToggleGroup>
    </Toolbar.Root>
  );
}
