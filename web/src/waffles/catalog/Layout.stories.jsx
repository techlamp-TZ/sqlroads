import ResizableElements from "@waffles/resizable-elements";
import * as Icons from "@waffles/icons";

export default { title: "Components/Layout and icons" };

export const Resizable = {
  render: () => (
    <div className="cat-col">
      <h2 className="cat-h2">row (drag the bar, or focus it and use the arrow keys)</h2>
      <div style={{ height: 160 }}>
        <ResizableElements orientation="row" initialProportions={[0.4, 0.6]}>
          <div className="cat-box" style={{ height: "100%" }}>Editor</div>
          <div className="cat-box" style={{ height: "100%" }}>Result</div>
        </ResizableElements>
      </div>
      <h2 className="cat-h2">column</h2>
      <div style={{ height: 240 }}>
        <ResizableElements orientation="column" initialProportions={[0.5, 0.5]}>
          <div className="cat-box" style={{ height: "100%" }}>Top</div>
          <div className="cat-box" style={{ height: "100%" }}>Bottom</div>
        </ResizableElements>
      </div>
    </div>
  ),
};

const names = Object.keys(Icons).sort();

export const IconGallery = {
  name: "Icons: all",
  render: () => (
    <div className="cat-col">
      <p className="cat-label">{names.length + " icons (standard and inverted)"}</p>
      <div className="cat-grid">
        {names.map((n) => { const I = Icons[n]; return <div key={n} className="cat-icon"><I aria-hidden /><span>{n.replace(/Icon$/, "")}</span></div>; })}
      </div>
    </div>
  ),
};

export const IconSizes = {
  name: "Icons: sizes and colours",
  render: () => (
    <div className="cat-col">
      <div className="cat-row">{[12, 18, 24].map((s) => <Icons.DatabaseIcon key={s} size={s} title={"Database " + s} />)}</div>
      <div className="cat-row">
        <Icons.CheckmarkCircleIcon title="Done" color="var(--wf-w-green-text)" size={24} />
        <Icons.CrossCircleIcon title="Error" color="var(--wf-w-red-text)" size={24} />
        <Icons.InfoCircleIcon title="Info" color="var(--wf-w-blue-text)" size={24} />
        <Icons.AttentionIcon title="Warning" color="var(--wf-w-orange-text)" size={24} />
      </div>
    </div>
  ),
};
