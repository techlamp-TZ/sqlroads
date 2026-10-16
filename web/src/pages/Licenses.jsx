import "./licenses.scss";
import { LESSONS_MIT, LESSONS_NOTE } from "./licenses-text.js";

// The old app's icon() returns trusted SVG markup from its own icon set; it is passed in by the router.
function OldIcon({ icon, name }) {
  if (typeof icon !== "function") return null;
  return <span className="wf-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon(name) }} />;
}

export default function Licenses({ icon }) {
  return (
    <div className="wf-page">
      <nav className="wf-crumbs" aria-label="Breadcrumb">
        <a href="#/home">Home</a>
        <OldIcon icon={icon} name="chevRight" />
        <span aria-current="page">Licenses</span>
      </nav>
      <section className="wf-card wf-licenses" aria-labelledby="wf-licenses-h">
        <h1 id="wf-licenses-h">Licenses</h1>
        <p className="wf-muted">{LESSONS_NOTE}</p>
        <pre className="wf-license-text">{LESSONS_MIT}</pre>
      </section>
    </div>
  );
}
