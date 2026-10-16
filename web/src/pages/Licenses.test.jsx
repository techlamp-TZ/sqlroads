import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import Licenses from "./Licenses.jsx";
import { LESSONS_MIT } from "./licenses-text.js";

const icon = (name) => '<svg data-name="' + name + '" viewBox="0 0 24 24"></svg>';

test("shows the heading, the breadcrumb and the full MIT notice", () => {
  const { getByRole, container } = render(<Licenses icon={icon} />);
  expect(getByRole("heading", { level: 1 }).textContent).toBe("Licenses");
  expect(getByRole("link", { name: "Home" }).getAttribute("href")).toBe("#/home");
  expect(getByRole("navigation", { name: "Breadcrumb" }).querySelector('[aria-current="page"]').textContent).toBe("Licenses");
  expect(container.querySelector("pre").textContent).toBe(LESSONS_MIT);
  expect(LESSONS_MIT).toMatch(/^MIT License\n\nCopyright \(c\) 2024 s-shemmee\n/);
  expect(container.querySelector('.wf-ic svg[data-name="chevRight"]')).not.toBeNull();
});

test("still renders without the old icon helper", () => {
  const { container } = render(<Licenses />);
  expect(container.querySelector(".wf-ic")).toBeNull();
  expect(container.querySelector("h1").textContent).toBe("Licenses");
});

test("no axe violations (all rules on)", async () => {
  const { container } = render(<main><Licenses icon={icon} /></main>);
  const r = await axe.run(container);
  expect(r.violations.map((v) => v.id + ": " + v.help)).toEqual([]);
});
