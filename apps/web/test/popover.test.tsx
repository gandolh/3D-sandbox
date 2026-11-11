import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PointPopover } from "../src/components/ui/Popover.jsx";

function Demo({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      <PointPopover at={[40, 60]} label="Distance" onClose={onClose} testId="pop">
        <input aria-label="Other" />
        <input aria-label="Distance from the nearer end" data-autofocus />
      </PointPopover>
      <button type="button">Elsewhere</button>
    </div>
  );
}

describe("PointPopover", () => {
  it("is a named popover that puts focus on its [data-autofocus] field", async () => {
    render(<Demo onClose={() => undefined} />);
    expect(await screen.findByRole("dialog", { name: "Distance" })).toBeTruthy();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Distance from the nearer end" })),
    );
  });

  it("closes on Escape, and only on Escape", async () => {
    const onClose = vi.fn();
    render(<Demo onClose={onClose} />);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Distance from the nearer end" })),
    );
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("textbox", { name: "Other" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
