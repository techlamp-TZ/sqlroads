// The old app's icon set (app.js / admin.js icon(): trusted SVG markup), passed in by the router.
export function OldIcon({ icon, name, className = "wf-ic" }) {
  if (typeof icon !== "function") return null;
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon(name) }} />;
}
