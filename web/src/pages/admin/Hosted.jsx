// An admin page whose old view still draws it (Review queue, Generate): React owns the route and gives the view a box
// to draw in (window.SQLDrillsAdmin.hostView). The box is not a .wf-root, so the old page looks and works exactly as
// before; admin.js takes #view back on every route change. Moved onto React components later, page by page.
import { useLayoutEffect, useRef } from "react";
import { useAdmin } from "../../admin/admin.jsx";

export function hosted(name) {
  function HostedPage() {
    const A = useAdmin();
    const box = useRef(null);
    useLayoutEffect(() => { A.hostView(name, box.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div ref={box} className="wf-host-box" data-hosted={name} />;
  }
  HostedPage.hosted = true; // the bridge mounts it outside .wf-root
  return HostedPage;
}
export const ReviewPage = hosted("review");
export const GeneratePage = hosted("generate");
