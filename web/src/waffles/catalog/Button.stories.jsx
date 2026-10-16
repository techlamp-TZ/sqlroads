import Button, { ButtonGroup, CloseButton, CompactButtonGroup, UserAccountMenu } from "@waffles/button";
import { AddCircleIcon, ArrowRightIcon, TrashIcon } from "@waffles/icons";

export default { title: "Components/Button", component: Button };

const APPEARANCES = ["default", "primary", "inverted"];
const INTENTS = ["neutral", "danger", "success", "warning", "b2b"];
const SIZES = ["small", "medium", "large"];
const noop = () => {};

// every appearance x intent x size (inverted sits on a dark band, as Waffles intends)
export const Matrix = {
  render: () => (
    <div className="cat-col">
      {APPEARANCES.map((appearance) => (
        <section key={appearance} className={appearance === "inverted" ? "cat-dark-band" : undefined} aria-label={appearance}>
          <h2 className={appearance === "inverted" ? "cat-h2 cat-on-dark" : "cat-h2"}>{appearance}</h2>
          {INTENTS.map((intent) => (
            <div key={intent} className="cat-row" style={{ marginBottom: 12 }}>
              {SIZES.map((size) => (
                <Button key={size} appearance={appearance} intent={intent} size={size} onClick={noop}>
                  {`${intent} ${size}`}
                </Button>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  ),
};

export const States = {
  render: () => (
    <div className="cat-col">
      <h2 className="cat-h2">disabled</h2>
      <div className="cat-row">{APPEARANCES.slice(0, 2).flatMap((a) => INTENTS.map((i) => <Button key={a + i} appearance={a} intent={i} disabled onClick={noop}>{`${a} ${i}`}</Button>))}</div>
      <h2 className="cat-h2">loading</h2>
      <div className="cat-row">{SIZES.map((s) => <Button key={s} appearance="primary" size={s} loading onClick={noop}>Saving</Button>)}<Button loading onClick={noop}>Loading</Button></div>
      <h2 className="cat-h2">with an icon, icon only</h2>
      <div className="cat-row">
        <Button appearance="primary" onClick={noop}>{["Add", <AddCircleIcon key="i" />]}</Button>
        <Button onClick={noop}>{[<ArrowRightIcon key="i" />, "Next"]}</Button>
        {SIZES.map((s) => <Button key={s} ariaLabel={"Delete (" + s + ")"} intent="danger" size={s} onClick={noop}><TrashIcon /></Button>)}
      </div>
      <h2 className="cat-h2">as a link, as submit, with a tooltip (shown on hover and keyboard focus)</h2>
      <div className="cat-row">
        <Button type="link" href="#/home">Link button</Button>
        <form onSubmit={(e) => e.preventDefault()}><Button type="submit" appearance="primary">Submit</Button></form>
        <Button tooltipText="Runs the query" tooltipPosition="top" onClick={noop}>Hover me</Button>
        <Button tooltipText="Light tooltip" tooltipAppearance="light" onClick={noop}>Light tooltip</Button>
      </div>
    </div>
  ),
};

export const Groups = {
  render: () => (
    <div className="cat-col">
      <h2 className="cat-h2">ButtonGroup</h2>
      <ButtonGroup><Button onClick={noop}>Cancel</Button><Button appearance="primary" onClick={noop}>Save</Button></ButtonGroup>
      <h2 className="cat-h2">CompactButtonGroup</h2>
      <CompactButtonGroup><Button onClick={noop}>Day</Button><Button onClick={noop}>Week</Button><Button onClick={noop}>Month</Button></CompactButtonGroup>
      <h2 className="cat-h2">CloseButton (large, small, disabled)</h2>
      <div className="cat-row"><CloseButton onClick={noop} /><CloseButton size="small" onClick={noop} /><CloseButton disabled onClick={noop} /></div>
    </div>
  ),
};

export const AccountMenu = {
  render: () => (
    <div className="cat-col">
      <h2 className="cat-h2">UserAccountMenu (opens on click; arrow keys move through the items)</h2>
      <div className="cat-dark-band" style={{ display: "flex", justifyContent: "flex-end", minHeight: 260 }}>
        <UserAccountMenu mainAppUrl="#" userSlug="learner" userTotalXp={12450} showAlertDot />
      </div>
    </div>
  ),
};
