// Admin → Backups (#/backups): the list, "Back up now" (saves and downloads the .zip) and Restore (typed RESTORE).
// Same text, calls (/api/admin/backups…) and behaviour as the old view (admin.js viewBackups).
import { useEffect, useState } from "react";
import Button from "@waffles/button";
import { ArchiveIcon, DownloadIcon, RefreshIcon } from "@waffles/icons";
import { AdminPage, ErrorLine, Loading, attrs, useAdmin } from "../../admin/admin.jsx";

const note = (label) => (label === "before-restore" ? "Automatic, before a restore" : label === "manual" ? "Backed up from admin" : label);

export default function BackupsPage() {
  const A = useAdmin();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const load = () => A.api("/backups").then(setList, setError);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const backUp = () => {
    setBusy(true);
    A.api("/backups", "POST").then((b) => {
      setBusy(false);
      A.toast("Backup saved: " + b.name);
      const link = document.createElement("a"); link.href = "/api/admin/backups/" + encodeURIComponent(b.name) + "/download"; link.download = b.name;
      document.body.appendChild(link); link.click(); link.remove();
      load();
    }).catch((e) => { setBusy(false); A.toast(e.message); });
  };
  const restore = (name) => {
    // the old page asked for the word RESTORE in the browser's own prompt (kept: it is a deliberate, typed step)
    if (window.prompt("Restore " + name + "?\n\nThe current database (exercises, progress, settings tables) is replaced by the backup. A backup of the current state is taken first.\n\nType RESTORE to confirm.") !== "RESTORE") return;
    setRestoring(name);
    A.api("/backups/" + encodeURIComponent(name) + "/restore", "POST", { confirm: "RESTORE" })
      .then((r) => { A.toast("Restored " + r.rows.toLocaleString() + " rows. Safety backup: " + r.safety); A.refreshCounts(); setRestoring(null); load(); })
      .catch((e) => { setRestoring(null); A.toast(e.message); });
  };

  if (error) return <AdminPage><ErrorLine error={error} /></AdminPage>;
  if (!list) return <AdminPage><Loading /></AdminPage>;
  return (
    <AdminPage
      eyebrow="Backups"
      title={A.plural(list.length, "backup")}
      intro="Each backup is a .zip with a copy of the database (exercises, MCQs, progress, settings tables) and the non-secret settings. API keys and passwords are never included."
      actions={<Button appearance="primary" onClick={backUp} disabled={busy} dataAttributes={{ act: "backup" }}>{[<ArchiveIcon key="i" />, "Back up now"]}</Button>}
    >
      <p className="wf-muted">Last backup: <span className="mono" id="lastBk">{A.fmtDate(list[0] && list[0].created_at, true)}</span> · stored in sql-drills-server/backups</p>
      <section className="wf-card-plain">
        <div className="wf-table-wrap" tabIndex={0} role="group" aria-label="Backups">
          <table className="wf-table">
            <thead><tr><th scope="col">Created</th><th scope="col" className="n">Size</th><th scope="col" className="n">Exercises</th><th scope="col">Note</th><th scope="col"><span className="wf-sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.length ? list.map((b) => (
                <tr key={b.name} data-name={b.name}>
                  <td className="mono">{A.fmtDate(b.created_at, true)}</td>
                  <td className="n">{(b.bytes / 1048576).toFixed(1) + " MB"}</td>
                  <td className="n">{b.exercises != null ? b.exercises.toLocaleString() : "–"}</td>
                  <td>{note(b.label)}</td>
                  <td className="acts">
                    <Button type="link" size="small" href={"/api/admin/backups/" + encodeURIComponent(b.name) + "/download"} ref={attrs({ download: "" })}>{[<DownloadIcon key="i" />, "Download"]}</Button>{" "}
                    <Button size="small" intent="danger" onClick={() => restore(b.name)} disabled={restoring === b.name} dataAttributes={{ act: "restore" }}>{[<RefreshIcon key="i" />, "Restore"]}</Button>
                  </td>
                </tr>
              )) : <tr><td colSpan={5} className="wf-empty">No backups yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPage>
  );
}
