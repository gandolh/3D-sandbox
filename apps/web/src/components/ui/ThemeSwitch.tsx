import { setThemeChoice, type ThemeChoice, useStore } from "../../state/store.js";
import { RadioGroup } from "./RadioGroup.jsx";

const THEMES: readonly { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/**
 * Light, Dark or System, kept on this device. A RadioGroup, not a Select: three choices are worth showing at once,
 * and nothing is saved to a server, so an arrow key may try each one.
 */
export function ThemeSwitch() {
  const choice = useStore((s) => s.themeChoice);
  return (
    <RadioGroup
      label="Theme"
      options={THEMES}
      value={choice}
      onValueChange={(next) => setThemeChoice(next)}
      className="font-mono text-[10px] tracking-wider uppercase"
    />
  );
}
