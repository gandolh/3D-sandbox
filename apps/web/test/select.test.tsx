import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "../src/components/ui/Select.jsx";

const ITEMS = [
  { value: "", label: "Most used" },
  { value: "m-brick", label: "Brick" },
  { value: "m-lime", label: "Lime plaster" },
];

function Demo({ onChange = () => undefined }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Select
      label="Material"
      items={ITEMS}
      value={value}
      onValueChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe("Select", () => {
  it("shows the label of the value, never the raw id", async () => {
    render(<Demo />);
    const trigger = screen.getByRole("combobox", { name: "Material" });
    expect(trigger.textContent).toContain("Most used");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "Lime plaster" }));
    expect(screen.getByRole("combobox", { name: "Material" }).textContent).toContain("Lime plaster");
    expect(screen.getByRole("combobox", { name: "Material" }).textContent).not.toContain("m-lime");
  });

  it("reports the chosen value, an empty one included", async () => {
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Material" }));
    await userEvent.click(await screen.findByRole("option", { name: "Brick" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Material" }));
    await userEvent.click(await screen.findByRole("option", { name: "Most used" }));
    expect(onChange.mock.calls).toEqual([["m-brick"], [""]]);
  });

  it("does not open while disabled", async () => {
    render(<Select label="Scene" items={ITEMS} value="m-brick" onValueChange={() => undefined} disabled />);
    await userEvent.click(screen.getByRole("combobox", { name: "Scene" }));
    expect(screen.queryByRole("option")).toBeNull();
  });
});
