// The logic of the Waffles components after the move to React 19 and the SQL Drills changes.
import { describe, test, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import Button from "@waffles/button";
import { Checkbox, CheckboxList, Input, Radio, RadioList, Select, SelectOption, Switch } from "@waffles/form-elements";
import Markdown from "@waffles/markdown";
import { AlertDialog, Dialog, setAppElement } from "@waffles/modals";
import { Badge } from "@waffles/text";
import { Toast } from "@waffles/toast";
import * as Icons from "@waffles/icons";
import { computeDataAttributes, hexColorLuminance, hexToRgbaColor, resolveColor } from "@waffles/utils";
import tokens from "@waffles/tokens/future-tokens";
import core from "@waffles/tokens";
import palette from "../tokens/palette.js";

describe("Button", () => {
  test("defaults (formerly defaultProps): a button of type button that calls onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run</Button>);
    const b = screen.getByRole("button", { name: "Run" });
    expect(b.getAttribute("type")).toBe("button");
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("disabled and loading do not call onClick", () => {
    const onClick = vi.fn();
    render(<><Button disabled onClick={onClick}>A</Button><Button loading onClick={onClick}>B</Button></>);
    for (const b of screen.getAllByRole("button")) { expect(b.hasAttribute("disabled")).toBe(true); fireEvent.click(b); }
    expect(onClick).not.toHaveBeenCalled();
  });

  test("type link renders an anchor; a disabled link does not navigate", () => {
    render(<><Button type="link" href="#/a">Go</Button><Button type="link" href="#/b" disabled>No</Button></>);
    expect(screen.getByRole("link", { name: "Go" }).getAttribute("href")).toBe("#/a");
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("link", { name: "No" }).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("an icon-only button is named by ariaLabel and its icon is hidden from screen readers", () => {
    render(<Button ariaLabel="Delete" onClick={() => {}}><Icons.TrashIcon /></Button>);
    const b = screen.getByRole("button", { name: "Delete" });
    expect(b.querySelector("svg").getAttribute("aria-hidden")).toBe("true");
  });

  test("dataAttributes become data-* attributes (used for data-confirm)", () => {
    render(<Button dataAttributes={{ confirm: "ok" }} onClick={() => {}}>OK</Button>);
    expect(screen.getByRole("button", { name: "OK" }).getAttribute("data-confirm")).toBe("ok");
  });
});

describe("AlertDialog on the native <dialog> (askConfirm's #confirmDlg)", () => {
  const Harness = ({ onConfirm, onClose }) => {
    const [open, setOpen] = useState(true);
    return <AlertDialog id="confirmDlg" isOpen={open} title="Delete?" description="Gone for good." confirmButtonText="OK" onConfirm={() => { onConfirm(); setOpen(false); }} onClose={(o) => { onClose(o); setOpen(false); }} />;
  };

  test("opens a <dialog id=confirmDlg> named by the title, with [data-confirm=ok] and [data-confirm=cancel] buttons", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} onClose={() => {}} />);
    const d = document.getElementById("confirmDlg");
    expect(d.tagName).toBe("DIALOG");
    expect(d.hasAttribute("open")).toBe(true);
    expect(d.querySelector('[data-confirm="ok"]').textContent).toBe("OK");
    expect(d.querySelector('[data-confirm="cancel"]').textContent).toBe("Cancel");
    fireEvent.click(d.querySelector('[data-confirm="ok"]'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("Esc closes with origin escKey, a backdrop click with overlayClick, Cancel with cancelButton", () => {
    for (const [act2, origin] of [[(d) => fireEvent(d, new Event("cancel", { cancelable: true })), "escKey"], [(d) => fireEvent.click(d), "overlayClick"], [(d) => fireEvent.click(d.querySelector('[data-confirm="cancel"]')), "cancelButton"]]) {
      const onClose = vi.fn();
      const { unmount } = render(<Harness onConfirm={() => {}} onClose={onClose} />);
      act2(document.getElementById("confirmDlg"));
      expect(onClose).toHaveBeenCalledWith(origin);
      unmount();
    }
  });

  test("the dialog leaves the DOM after its closing animation", async () => {
    vi.useFakeTimers();
    try {
      render(<Harness onConfirm={() => {}} onClose={() => {}} />);
      fireEvent.click(document.querySelector('[data-confirm="ok"]'));
      expect(document.getElementById("confirmDlg")).not.toBeNull();
      await act(async () => { vi.advanceTimersByTime(700); });
      expect(document.getElementById("confirmDlg")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  test("Dialog keeps its Header/Body/Footer parts; setAppElement is kept as a no-op", () => {
    render(<Dialog isOpen onClose={() => {}} width={400}><Dialog.Header>Title</Dialog.Header><Dialog.Body>Body</Dialog.Body><Dialog.Footer><Button onClick={() => {}}>Close</Button></Dialog.Footer></Dialog>);
    expect(screen.getByText("Title")).toBeTruthy();
    expect(() => setAppElement("#root")).not.toThrow();
  });
});

describe("form elements", () => {
  test("Input reports the new value", () => {
    const onChange = vi.fn();
    render(<Input label="Table" name="t" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Table"), { target: { value: "guests" } });
    expect(onChange).toHaveBeenCalledWith("guests");
  });

  test("Select, RadioList and CheckboxList report their values", () => {
    const sel = vi.fn(), rad = vi.fn(), chk = vi.fn();
    render(<>
      <Select label="Engine" name="e" value="a" onChange={sel}><SelectOption value="a">A</SelectOption><SelectOption value="b">B</SelectOption></Select>
      <RadioList label="Join" name="j" value="x" onChange={rad}><Radio value="x">X</Radio><Radio value="y">Y</Radio></RadioList>
      <CheckboxList label="Parts" name="p" value={["w"]} onChange={chk}><Checkbox value="w">W</Checkbox><Checkbox value="g">G</Checkbox></CheckboxList>
    </>);
    fireEvent.change(screen.getByLabelText("Engine"), { target: { value: "b" } });
    fireEvent.click(screen.getByLabelText("Y"));
    fireEvent.click(screen.getByLabelText("G"));
    expect(sel).toHaveBeenCalledWith("b");
    expect(rad).toHaveBeenCalledWith("y");
    expect(chk).toHaveBeenCalledWith(["w", "g"]);
  });

  test("an error message is shown with the field", () => {
    render(<Input label="Name" name="n" value="" onChange={() => {}} errorMessage="Required" />);
    expect(screen.getByText("Required")).toBeTruthy();
  });

  test("decorative icons in Select and Input are hidden from screen readers", () => {
    const { container } = render(<><Select label="S" name="s" value="a" onChange={() => {}}><SelectOption value="a">A</SelectOption></Select><Input label="I" name="i" value="" onChange={() => {}} icon={<Icons.SearchIcon />} /></>);
    for (const svg of container.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  test("Switch toggles", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange}>Dark</Switch>);
    fireEvent.click(screen.getByLabelText("Dark"));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Markdown on react-markdown 10", () => {
  test("headings, emphasis, lists, inline code and code blocks map to the Waffles text components", () => {
    const { container } = render(<Markdown className="md" source={"# One\n\n## Two\n\n*em* **strong** `x = 1`\n\n- a\n- b\n\n1. c\n\n```\nSELECT 1;\n```\n"} />);
    expect(container.firstChild.className).toBe("md");
    expect(container.querySelector("h1").textContent).toBe("One");
    expect(container.querySelector("h2").textContent).toBe("Two");
    expect(container.querySelector("em").textContent).toBe("em");
    expect(container.querySelector("strong").textContent).toBe("strong");
    expect(container.querySelectorAll("ul li").length).toBe(2);
    expect(container.querySelectorAll("ol li").length).toBe(1);
    expect(container.querySelector("pre").textContent).toBe("SELECT 1;");
    expect([...container.querySelectorAll("code")].some((c) => c.textContent === "x = 1" && !c.closest("pre"))).toBe(true);
    expect(container.querySelector("[node]")).toBeNull();
  });
});

describe("Toast", () => {
  test("title, description and a close button that calls closeToast", () => {
    const close = vi.fn();
    render(<Toast intent="error" title="It failed" description="Unknown column" closeToast={close} />);
    expect(screen.getByRole("heading", { name: "It failed" })).toBeTruthy();
    expect(screen.getByText("Unknown column")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalled();
  });
});

describe("icons", () => {
  test("198 generated icons (155 standard + 43 inverted), none of the brand ones", () => {
    const names = Object.keys(Icons);
    expect(names.length).toBe(198);
    expect(names.filter((n) => /InvertedIcon$/.test(n)).length).toBe(43);
    // Waffles named its brand icons "...BrandIcon"; none were generated
    expect(names.some((n) => /BrandIcon$/.test(n))).toBe(false);
  });

  test("size, colour, title and aria-hidden props as in Waffles", () => {
    const { container } = render(<><Icons.CrossIcon size={24} color="red" title="Close" /><Icons.CrossIcon aria-hidden /></>);
    const [a, b] = container.querySelectorAll("svg");
    expect(a.getAttribute("width")).toBe("24");
    expect(a.querySelector("path").getAttribute("fill")).toBe("red");
    expect(a.querySelector("title").textContent).toBe("Close");
    expect(b.getAttribute("width")).toBe("18");
    expect(b.querySelector("path").getAttribute("fill")).toBe("currentColor");
    expect(b.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("tokens and colour utilities", () => {
  test("Waffles token shapes, with colours as theme variables and IBM Plex in place of the Waffles font", () => {
    expect(tokens.color.primary.navy.value.hex).toBe("var(--wf-w-navy)");
    expect(tokens.size.space[16].value).toBe(16);
    expect(tokens.size.font[300].value).toBe("16px");
    expect(tokens.asset.font.sansSerif.value).toBe("IBM Plex Sans");
    expect(core.colors.white).toBe("var(--wf-w-white)");
    expect(core.fontFamily.sansSerif).toBe("'IBM Plex Sans'");
  });

  test("hexToRgbaColor keeps hex behaviour and mixes theme variables with transparency", () => {
    expect(hexToRgbaColor("#05192D", 0.5)).toBe("rgba(5, 25, 45, 0.5)");
    expect(hexToRgbaColor("var(--wf-w-navy)", 0.8)).toBe("color-mix(in srgb, var(--wf-w-navy) 80%, transparent)");
    expect(() => hexToRgbaColor("navy")).toThrow();
  });

  test("resolveColor / hexColorLuminance read a variable's real colour per theme", () => {
    expect(resolveColor("var(--wf-w-white)", "light")).toBe(palette.light["--wf-w-white"]);
    expect(resolveColor("var(--wf-w-white)", "dark")).toBe(palette.dark["--wf-w-white"]);
    expect(hexColorLuminance("var(--wf-w-white)", "light")).toBeGreaterThan(0.9);
    expect(hexColorLuminance("var(--wf-w-white)", "dark")).toBeLessThan(0.05);
    expect(() => resolveColor("var(--wf-w-nope)")).toThrow();
    expect(resolveColor("#123456")).toBe("#123456");
  });

  test("computeDataAttributes", () => {
    expect(computeDataAttributes({ confirm: "ok" })).toEqual({ "data-confirm": "ok" });
    expect(computeDataAttributes()).toEqual({});
  });

  test("Badge text: navy on light backgrounds, white on dark ones", () => {
    const { container } = render(<><Badge color={tokens.color.primary.green.value.hex}>New</Badge><Badge color={tokens.color.primary.purpleDark.value.hex}>Old</Badge></>);
    const [a, b] = container.querySelectorAll("strong");
    expect(getComputedStyle(a).color).toBe("var(--wf-w-on-fill)");
    expect(getComputedStyle(b).color).toBe("var(--wf-w-on-dark)");
  });
});
