// A page whose old view still draws it: React owns the route and gives the view a box to draw in (hostView in
// app.js / admin.js). The box is not a .wf-root, so the page looks and works exactly as before; each app takes
// #view back on every route change. These are the pages still to move onto React components.
import { useLayoutEffect, useRef } from "react";
import { useAdmin } from "../../admin/admin.jsx";
import { useShared } from "../../shared/shared.jsx";

export function hosted(name, app) {
  const useHelpers = app === "admin" ? useAdmin : useShared; // fixed per page, so the hook order never changes
  function HostedPage() {
    const helpers = useHelpers();
    const box = useRef(null);
    useLayoutEffect(() => { helpers.hostView(name, box.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div ref={box} className="wf-host-box" data-hosted={name} />;
  }
  HostedPage.hosted = true; // the bridge mounts it outside .wf-root
  HostedPage.displayName = "Hosted(" + app + ":" + name + ")";
  return HostedPage;
}

// the learner app's and the admin's routes that are still drawn by their old views
export const LEARNER_HOSTED = ["levels", "level", "drills", "mcqs", "mcq", "quiz", "recent", "interview", "bookmarks", "review", "progress", "guide", "preview"];
export const ADMIN_HOSTED = ["review", "generate", "library", "item", "mcqs", "drills", "recent", "learners"];
export const hostedPages = (names, app) => Object.fromEntries(names.map((n) => [n, hosted(n, app)]));
