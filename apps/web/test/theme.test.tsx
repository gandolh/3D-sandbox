import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitch } from "../src/components/ui/ThemeSwitch.jsx";
import {
  DEFAULT_THEME,
  getState,
  readThemeChoice,
  resolveTheme,
  setThemeChoice,
  type ThemeChoice,
} from "../src/state/store.js";

/** A stand-in for the operating system's colour setting that a test can flip. */
function mockSystem(dark: boolean): { flip: (dark: boolean) => void } {
  let matches = dark;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        media: query,
        get matches() {
          return matches;
        },
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  );
  return {
    flip(next) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };
}

const attribute = (): string | undefined => document.documentElement.dataset.theme;

beforeEach(() => {
  localStorage.clear();
  setThemeChoice(DEFAULT_THEME, { persist: false });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the theme choice", () => {
  it("shows Solstice's default on a first visit", () => {
    expect(readThemeChoice()).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("dark");
  });

  it("applies a stored light, and keeps what is picked", () => {
    localStorage.setItem("theme", "light");
    expect(readThemeChoice()).toBe("light");
    setThemeChoice("light");
    expect(attribute()).toBe("light");
    expect(getState()).toMatchObject({ themeChoice: "light", theme: "light" });
    setThemeChoice("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("ignores a stored value it does not know", () => {
    localStorage.setItem("theme", "sepia");
    expect(readThemeChoice()).toBe(DEFAULT_THEME);
  });

  it("follows the system setting live while the choice is System, and stops when it is not", () => {
    const system = mockSystem(true);
    setThemeChoice("system");
    expect(attribute()).toBe("dark");
    system.flip(false);
    expect(attribute()).toBe("light");
    expect(getState()).toMatchObject({ themeChoice: "system", theme: "light" });
    setThemeChoice("dark");
    system.flip(false);
    expect(attribute()).toBe("dark");
    expect(resolveTheme("system")).toBe("light");
  });

  it("works with storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readThemeChoice()).toBe(DEFAULT_THEME);
    expect(() => setThemeChoice("light")).not.toThrow();
    expect(attribute()).toBe("light");
  });
});

describe("the boot script in index.html", () => {
  const html = readFileSync(join(process.cwd(), "apps/web/index.html"), "utf8");
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
  const boot = (): string | undefined => {
    delete document.documentElement.dataset.theme;
    new Function(script)();
    return attribute();
  };

  it("sets the default on a first visit, in step with DEFAULT_THEME", () => {
    expect(script).not.toBe("");
    expect(boot()).toBe(DEFAULT_THEME);
  });

  it("applies a stored choice before the first paint", () => {
    localStorage.setItem("theme", "light");
    expect(boot()).toBe("light");
    localStorage.setItem("theme", "dark");
    expect(boot()).toBe("dark");
    mockSystem(false);
    localStorage.setItem("theme", "system");
    expect(boot()).toBe("light");
  });

  it("falls back to the default when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(boot()).toBe(DEFAULT_THEME);
  });

  it("uses data-theme as the only mechanism: no prefers-color-scheme in the stylesheet", () => {
    const css = readFileSync(join(process.cwd(), "apps/web/src/styles.css"), "utf8");
    expect(css).not.toContain("prefers-color-scheme");
  });
});

describe("ThemeSwitch", () => {
  it("is a named group of Light, Dark and System, with the current choice checked", () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Light", "Dark", "System"]);
    expect(screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("true");
  });

  it("changes the palette and keeps the choice when one is picked", async () => {
    render(<ThemeSwitch />);
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(attribute()).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(screen.getByRole("radio", { name: "Light" }).getAttribute("aria-checked")).toBe("true");
  });

  it("follows the arrow keys, because nothing it picks goes to a server", async () => {
    render(<ThemeSwitch />);
    act(() => screen.getByRole("radio", { name: "Dark" }).focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(getState().themeChoice satisfies ThemeChoice).toBe("system");
  });
});
