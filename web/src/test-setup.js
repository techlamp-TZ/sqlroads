// Test-only: jsdom has no <dialog> methods. A minimal stand-in (open attribute, close event) so the
// Waffles modals, which use the native <dialog>, can be tested; the real behaviour is checked in Chrome.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.show = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
  Object.defineProperty(HTMLDialogElement.prototype, "open", { get() { return this.hasAttribute("open"); }, configurable: true });
}

// Testing Library only cleans up between tests by itself when Vitest's globals are on; they are off here.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
