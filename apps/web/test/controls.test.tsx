import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "../src/components/ui/Checkbox.jsx";
import { Slider } from "../src/components/ui/Slider.jsx";
import { editsText } from "../src/ui/useUndoKeys.js";

function Ticks({ onChange }: { onChange: (on: boolean) => void }) {
  const [on, setOn] = useState(false);
  return (
    <Checkbox
      label="Colliders"
      checked={on}
      onCheckedChange={(next) => {
        onChange(next);
        setOn(next);
      }}
    />
  );
}

describe("Checkbox", () => {
  it("is named by its label, and a click on the label ticks it", async () => {
    const onChange = vi.fn();
    render(<Ticks onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Colliders" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(screen.getByText("Colliders"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Colliders" }).getAttribute("aria-checked")).toBe("true");
  });

  it("cannot be ticked while disabled", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Context" checked={false} onCheckedChange={onChange} disabled />);
    await userEvent.click(screen.getByText("Context"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Slider", () => {
  it("is a named slider whose arrow keys step the value, one report per press", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState(600);
      return (
        <Slider
          label="Solar time"
          min={0}
          max={1439}
          step={1}
          value={value}
          onValueChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          look="scrub"
        />
      );
    }
    render(<Harness />);
    const thumb = screen.getByRole("slider", { name: "Solar time" });
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(onChange.mock.calls).toEqual([[601], [602]]);
  });

  it("keeps the slider out of the text fields that own Ctrl+Z", () => {
    render(<Slider label="Animation time" min={0} max={10} step={0.05} value={2} onValueChange={() => undefined} />);
    expect(editsText(screen.getByRole("slider", { name: "Animation time" }))).toBe(false);
  });
});
