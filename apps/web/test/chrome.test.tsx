import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RenderProgress } from "../src/engine/PathTracer.js";
import { RenderOverlay } from "../src/ui/RenderOverlay.jsx";

/**
 * The parts of the interface briefs 35 and 36 paid for, finally asserted.
 *
 * Both were verified by reading and by a screenshot, because nothing in this
 * project could render a component. Brief 36's outcome had to record that
 * Escape-to-cancel was *unverified here*; brief 24's had to say a dependency
 * array was "verified by reading". This is that gap closing.
 */
const progress = (over: Partial<RenderProgress> = {}): RenderProgress => ({
  phase: "rendering",
  build: 1,
  samples: 12,
  targetSamples: 600,
  elapsedMs: 4200,
  ...over,
});

describe("the render overlay", () => {
  it("puts focus on Cancel as soon as it appears", () => {
    // It is the control that stops an hour of GPU, and it was the hardest
    // thing in the app to reach — a small button behind every control in the
    // toolbar and the whole scene tree.
    render(<RenderOverlay progress={progress()} onCancel={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /cancel/i }));
  });

  it("cancels on Escape, from wherever focus happens to be", async () => {
    // Bound on `window` rather than the overlay, because when someone starts a
    // render focus is usually on the canvas. This is the assertion brief 36
    // could not make: its own end-to-end attempt was drowned out by a machine
    // that path-traces at 77 s per sample.
    const onCancel = vi.fn();
    render(<RenderOverlay progress={progress()} onCancel={onCancel} />);
    document.body.focus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancels on Enter, because focus is already on the button", async () => {
    const onCancel = vi.fn();
    render(<RenderOverlay progress={progress()} onCancel={onCancel} />);
    await userEvent.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("announces milestones politely, and never the sample counter", () => {
    // The numbers change many times a second. A live region carrying them
    // would read the sample count aloud continuously and be switched off.
    const { container } = render(
      <RenderOverlay
        progress={progress({ queue: { index: 2, total: 4 }, label: "South-west" })}
        onCancel={vi.fn()}
      />,
    );
    const live = container.querySelector('[role="status"]');
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toContain("Shot 2 of 4");
    expect(live?.textContent).toContain("path tracing");
    expect(live?.textContent).not.toContain("12");
  });

  it("says it is building rather than tracing while the BVH is built", () => {
    const { container } = render(
      <RenderOverlay progress={progress({ phase: "building", build: 0.4 })} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "building acceleration structure",
    );
  });
});
