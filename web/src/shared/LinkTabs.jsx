// Tabs that are links (each tab is its own address, as on the old pages), in Waffles' minimal-tabs style:
// the selected label is bold, and a hidden bold copy of every label keeps its width, so nothing shifts.
import "./link-tabs.scss";
import { OldIcon } from "./OldIcon.jsx";

export default function LinkTabs({ tabs, current, icon }) {
  return (
    <div className="wf-tabs" role="tablist">
      {tabs.map((t) => {
        const on = t.key === current;
        return (
          <a key={t.key} role="tab" href={t.href} className={"wf-tab" + (on ? " is-on" : "")} aria-selected={on}>
            {t.icon && <OldIcon icon={icon} name={t.icon} />}
            <span className="wf-tab-text" data-text={t.text}>{t.text}</span>
          </a>
        );
      })}
    </div>
  );
}
