// The Waffles SCSS stylesheets (class-based CSS). Each story wraps its markup in the stylesheet's scope class
// (catalog.scss), so the stylesheets cannot clash.
import { useState } from "react";
import { CheckmarkIcon, ChevronDownIcon, DatabaseIcon, SearchIcon, TrashIcon } from "@waffles/icons";

export default { title: "Stylesheets" };

export const Table = {
  render: () => (
    <div className="wf-css-table">
      <div className="dc-table-wrapper">
        <table className="dc-table--headless">
          <tbody className="dc-table__tbody">
            {[["Ada", "Kenya", "3"], ["Ben", "Ghana", "1"], ["Chi", "Nigeria", "4"]].map((r) => (
              <tr key={r[0]} className="dc-table__tr">{r.map((c, i) => <td key={i} className="dc-table__td">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
};

// the active label is bold; the hidden ::after copy of each label (data-text) keeps every tab at its bold width,
// so selecting a tab does not move the others
export const Tabs = {
  render: () => {
    const [tab, setTab] = useState("Learn");
    return (
      <div className="wf-css-tabs">
        <div className="minimal-tabs-bar">
          <ul className="minimal-tabs" role="tablist" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {["Learn", "Practise", "Review", "Notes"].map((t) => (
              <li key={t} className={"minimal-tab" + (t === tab ? " active" : "")} role="presentation">
                <button type="button" role="tab" aria-selected={t === tab} className="minimal-tab__link" data-tab={t} onClick={() => setTab(t)} style={{ background: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  <span className="minimal-tab__text" data-text={t}>{t}</span>{t === "Review" && <span className="minimal-tab__label">3</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="minimal-tab-pane" role="tabpanel" style={{ paddingTop: 16 }}>{tab}</div>
      </div>
    );
  },
};

export const ProgressBar = {
  render: () => (
    <div className="wf-css-progress-bar cat-col" style={{ maxWidth: 480 }}>
      {[["", 40], [" dc-progress-bar--small", 65], [" dc-progress-bar--green", 80], [" dc-progress-bar--orange", 30], [" dc-progress-bar--red", 15], [" dc-progress-bar--light", 55], [" dc-progress-bar--completed", 100]].map(([m, v]) => (
        <div key={m} className={"dc-progress-bar" + m}>
          <div className="dc-progress-bar__bar" role="progressbar" aria-label={"progress" + m} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><div className="dc-progress-bar__fill" style={{ width: v + "%" }} /></div>
          <span className="dc-progress-bar__text">{v + "%" + m.replace(" dc-progress-bar--", " ")}</span>
        </div>
      ))}
    </div>
  ),
};

export const Pagination = {
  render: () => (
    <nav className="wf-css-pagination" aria-label="Pages">
      <div className="dc-pagination">
        <ul className="dc-pagination__list" style={{ listStyle: "none" }}>
          {[1, 2, 3, 4, 5].map((n) => <li key={n}><button type="button" className={"dc-pagination__page" + (n === 2 ? " dc-is-active" : "")} aria-current={n === 2 ? "page" : undefined}>{n}</button></li>)}
          <li><button type="button" className="dc-pagination__page" disabled>6</button></li>
        </ul>
      </div>
    </nav>
  ),
};

export const Dropdown = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div className="wf-css-dropdown" style={{ minHeight: 220 }}>
        <div className={"dc-dropdown dc-dropdown--caret dc-dropdown--arrow" + (open ? " dc-is-open" : "")}>
          <button type="button" className="dc-dropdown__toggle cat-box" aria-expanded={open} onClick={() => setOpen(!open)}>Options <ChevronDownIcon aria-hidden /></button>
          <div className="dc-dropdown__content">
            <ul className="dc-dropdown__list dc-dropdown__list--bordered">
              <li className="dc-dropdown__item"><a className="dc-dropdown__link" href="#/home">Profile</a></li>
              <li className="dc-dropdown__item"><a className="dc-dropdown__link" href="#/progress">Progress</a></li>
              <li className="dc-dropdown__item"><a className="dc-dropdown__link disabled" aria-disabled="true">Disabled</a></li>
            </ul>
          </div>
        </div>
      </div>
    );
  },
};

export const FlashBanner = {
  render: () => (
    <div className="wf-css-flash-banner">
      <div className="dc-flash-wrapper" style={{ position: "static" }}>
        {[["notice", "A notice."], ["success", "Saved."], ["error", "It didn't save."]].map(([k, t]) => (
          <div key={k} className={"dc-flash dc-flash--" + k} role="status">
            <div className="dc-flash__content">{t} <a className="dc-flash__cta" href="#/home">Details</a></div>
            <button type="button" className="dc-flash__close" aria-label="Close">x</button>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const CountIndicator = {
  render: () => (
    <div className="wf-css-count-indicator cat-row">
      <span className="cat-box" style={{ position: "relative" }}>Inbox <span className="dc-count-indicator">3</span></span>
      <span className="cat-box" style={{ position: "relative" }}>Alerts <span className="dc-count-indicator dc-count-indicator--red">12</span></span>
      <span className="cat-box" style={{ position: "relative", paddingRight: 32 }}>Right <span className="dc-count-indicator dc-count-indicator--right">5</span></span>
      <span className="cat-box" style={{ position: "relative", paddingLeft: 32 }}>Left <span className="dc-count-indicator dc-count-indicator--left">7</span></span>
    </div>
  ),
};

export const IconClasses = {
  name: "Icon classes",
  render: () => (
    <div className="wf-css-icon cat-row">
      {["blue-text", "green-text", "red-text", "navy-text", "orange-text", "purple-text"].map((c) => (
        <span key={c} className={"dc-icon dc-icon--" + c} title={c}><DatabaseIcon className="dc-icon__svg" title={c} /></span>
      ))}
      <span className="dc-icon dc-icon--flex"><SearchIcon className="dc-icon__svg" title="flex" /></span>
    </div>
  ),
};

const BTN = ["dc-btn--primary-light", "dc-btn--secondary", "dc-btn--tertiary", "dc-btn--green", "dc-btn--grey", "dc-btn--red", "dc-btn--purple", "dc-btn--orange", "dc-btn--white", "dc-btn--white dc-btn--white-green", "dc-btn--white dc-btn--white-red", "dc-btn--white dc-btn--shadowed", "dc-btn--bordered", "dc-btn--bordered-red", "dc-btn--bordered-green", "dc-btn--bordered-grey-light", "dc-btn--link"];
// (white-green, white-red and shadowed are modifiers of dc-btn--white; a bare .dc-btn is not a variant)

export const LegacyButtons = {
  name: "Legacy buttons (button package CSS)",
  render: () => (
    <div className="wf-css-button cat-col">
      <div className="cat-row">{BTN.map((m) => <button key={m} type="button" className={"dc-btn " + m}>{m.replace(/dc-btn--/g, "")}</button>)}</div>
      <div className="cat-row">
        <button type="button" className="dc-btn dc-btn--secondary dc-btn--sm">small</button>
        <button type="button" className="dc-btn dc-btn--secondary dc-btn--lg">large</button>
        <button type="button" className="dc-btn dc-btn--secondary dc-btn--squared" aria-label="Delete"><TrashIcon aria-hidden /></button>
        <button type="button" className="dc-btn dc-btn--secondary is-disabled" disabled>disabled</button>
        <button type="button" className="dc-btn dc-btn--secondary dc-is-loading"><span className="dc-btn__content">loading</span></button>
      </div>
      <div className="cat-dark-band cat-row"><button type="button" className="dc-btn dc-btn--bordered-white">bordered white</button><button type="button" className="dc-btn dc-btn--text-light">text light</button></div>
      <div className="dc-multi-btn" role="group" aria-label="Multi button">
        <button type="button" className="dc-multi-btn__item"><span className="dc-multi-btn__text">Run</span></button>
        <button type="button" className="dc-multi-btn__item" aria-label="More"><span className="dc-multi-btn__icon"><ChevronDownIcon aria-hidden /></span></button>
      </div>
      <button type="button" className="dc-btn dc-btn--secondary dc-btn--block">block</button>
    </div>
  ),
};

export const LegacyCard = {
  name: "Legacy card (card package CSS)",
  render: () => (
    <div className="wf-css-card cat-row">
      {["dc-card--bordered", "dc-card--shadowed-sm", "dc-card--shadowed-lg", "dc-card--shadowed-xl", "dc-card--interactive"].map((m) => (
        <div key={m} className={"dc-card dc-card--content " + m} style={{ width: 200 }}>{m.replace("dc-card--", "")}</div>
      ))}
      <div className="dc-card dc-card--sectioned dc-card--bordered" style={{ width: 240 }}>
        <div className="dc-card__header">Header</div><div className="dc-card__body">Body</div><div className="dc-card__footer">Footer</div>
      </div>
    </div>
  ),
};

export const LegacyTag = {
  name: "Tag (the React Tag is deprecated in Waffles: use Badge; this is its CSS)",
  render: () => (
    <div className="wf-css-tag cat-row">
      <span className="dc-tag">SELECT</span>
      <a className="dc-tag dc-tag--link" href="#/docs">JOIN (link)</a>
      <span className="dc-tag dc-tag--lg">large</span>
    </div>
  ),
};

export const Core = {
  name: "Core: typography, forms, grid, utilities",
  render: () => (
    <div className="wf-css-core cat-col">
      <h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4>
      <p>Body text with a <a href="#/home">link</a>, <strong>strong</strong>, <em>emphasis</em> and <code>code</code>.</p>
      <div className="dc-input-group" style={{ maxWidth: 320 }}>
        <label className="dc-label" htmlFor="core-text">Text input</label>
        <input id="core-text" className="dc-input--text" placeholder="Type here" />
      </div>
      <input className="dc-input-search" aria-label="Search" placeholder="Search" />
      <div className="dc-select-container" style={{ maxWidth: 240 }}><select className="dc-select" aria-label="Engine"><option>MySQL</option><option>PostgreSQL</option></select></div>
      <label className="dc-input-checkbox"><input type="checkbox" className="dc-input-checkbox__input" defaultChecked /><span className="dc-input-checkbox__indicator"><CheckmarkIcon className="dc-input-checkbox__check" aria-hidden size={12} /></span><span className="dc-input-checkbox__text">Checkbox</span></label>
      <label className="dc-input-radio"><input type="radio" name="core-r" className="dc-input-radio__input" defaultChecked /><span className="dc-input-radio__indicator" /><span className="dc-input-radio__text">Radio one</span></label>
      <label className="dc-input-radio"><input type="radio" name="core-r" className="dc-input-radio__input" /><span className="dc-input-radio__indicator" /><span className="dc-input-radio__text">Radio two</span></label>
      <div className="dc-toggle-switch"><input id="core-t" type="checkbox" className="dc-toggle-switch__input" defaultChecked /><label className="dc-toggle-switch__label" htmlFor="core-t">Toggle</label></div>
      <div className="dc-u-fx dc-u-fx-jcsb dc-u-p-16 dc-u-bgc-grey-100 dc-u-brad-all" style={{ maxWidth: 480 }}>
        <span className="dc-u-fw-bold">dc-u-* utilities</span><span className="dc-u-color-navy-text">flex, padding, background</span>
      </div>
      <div className="dc-row" style={{ maxWidth: 640 }}>
        {[1, 2, 3].map((n) => <div key={n} className="dc-col-sm-4"><div className="cat-box">dc-col-sm-4</div></div>)}
      </div>
    </div>
  ),
};
