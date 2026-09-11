import { ScrollArea } from "@base-ui/react/scroll-area";
import type { ReactNode } from "react";

/**
 * Every panel that can outgrow its space gets one of these.
 *
 * The design mockups clipped precisely because they had fixed heights and no
 * scroll containers. A wall with eight openings and a material stack overflows
 * any height you pick, so this is in the layout from the first commit rather
 * than retrofitted once panels start cutting content off.
 */
export function Scroll({ children }: { children: ReactNode }) {
  return (
    <ScrollArea.Root className="min-h-0 flex-1">
      <ScrollArea.Viewport className="h-full w-full overscroll-contain">
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="m-0.5 flex w-1.5 justify-center rounded opacity-0 transition-opacity delay-150 data-[hovering]:opacity-100 data-[hovering]:delay-0 data-[scrolling]:opacity-100 data-[scrolling]:delay-0"
      >
        <ScrollArea.Thumb className="w-full rounded bg-subtle/60" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
