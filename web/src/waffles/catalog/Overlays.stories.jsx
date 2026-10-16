import { useRef, useState } from "react";
import Button from "@waffles/button";
import { AlertDialog, Dialog, Panel } from "@waffles/modals";
import { Paragraph } from "@waffles/text";
import { Toast, ToastContainer, toast } from "@waffles/toast";
import Tooltip from "@waffles/tooltip";
import Positioner from "@waffles/positioner";
import Markdown from "@waffles/markdown";

const noop = () => {};

// a modal story opens on load (so the open state can be checked) and can be reopened
const Opener = ({ label, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="cat-col">
      <div><Button onClick={() => setOpen(true)}>{label}</Button></div>
      {children(open, () => setOpen(false))}
    </div>
  );
};

export default { title: "Components/Overlays" };

export const AlertDialogNeutral = { name: "AlertDialog: neutral", render: () => <Opener label="Open">{(open, close) => <AlertDialog isOpen={open} onClose={close} onConfirm={close} title="Run this query?" description="It reads the guests table." />}</Opener> };
export const AlertDialogDanger = { name: "AlertDialog: danger", render: () => <Opener label="Open">{(open, close) => <AlertDialog intent="danger" isOpen={open} onClose={close} onConfirm={close} title="Delete this note?" description="This can't be undone." confirmButtonText="Delete" />}</Opener> };
export const AlertDialogSuccess = { name: "AlertDialog: success", render: () => <Opener label="Open">{(open, close) => <AlertDialog intent="success" isOpen={open} onClose={close} onConfirm={close} title="Publish?" description="Learners will see it." />}</Opener> };
export const AlertDialogWarning = { name: "AlertDialog: warning", render: () => <Opener label="Open">{(open, close) => <AlertDialog intent="warning" isOpen={open} onClose={close} onConfirm={close} title="Reset progress?" description="Your streak starts again." />}</Opener> };
export const AlertDialogLoading = { name: "AlertDialog: loading", render: () => <Opener label="Open">{(open, close) => <AlertDialog loading isOpen={open} onClose={close} onConfirm={noop} title="Saving" description="Please wait." />}</Opener> };

// the in-page confirm the old app uses (askConfirm): a <dialog id="confirmDlg"> whose OK button is [data-confirm=ok]
export const ConfirmDlg = {
  name: "AlertDialog as #confirmDlg",
  render: () => {
    const [result, setResult] = useState("open");
    return (
      <Opener label="Ask again">{(open, close) => (
        <>
          <p className="cat-label" data-testid="confirm-result">{result}</p>
          <AlertDialog id="confirmDlg" isOpen={open && result === "open"} title="Delete this exercise?" description="This can't be undone." confirmButtonText="OK"
            onConfirm={() => { setResult("ok"); close(); }} onClose={() => { setResult("cancel"); close(); }} />
        </>
      )}</Opener>
    );
  },
};

export const DialogWithSteps = {
  name: "Dialog: header, body, footer, steps",
  render: () => (
    <Opener label="Open">{(open, close) => (
      <Dialog isOpen={open} onClose={close} width={560} currentStep={2} totalSteps={4}>
        <Dialog.Header>Step 2 of 4: choose the columns</Dialog.Header>
        <Dialog.Body><Paragraph>Pick the columns the query should return.</Paragraph></Dialog.Body>
        <Dialog.Footer><Button onClick={close}>Back</Button><Button appearance="primary" onClick={close}>Next</Button></Dialog.Footer>
      </Dialog>
    )}</Opener>
  ),
};

export const PanelRight = { name: "Panel: right", render: () => <Opener label="Open">{(open, close) => <Panel isOpen={open} onClose={close} position="right"><div style={{ padding: 24 }}><Paragraph>A panel from the right.</Paragraph></div></Panel>}</Opener> };
export const PanelLeft = { name: "Panel: left", render: () => <Opener label="Open">{(open, close) => <Panel isOpen={open} onClose={close} position="left" width="320px"><div style={{ padding: 24 }}><Paragraph>A panel from the left.</Paragraph></div></Panel>}</Opener> };

export const Toasts = {
  render: () => (
    <div className="cat-col">
      {/* Waffles' Toast titles are h4: the levels above keep the page outline in order */}
      <h2 className="cat-h2">Toast</h2>
      <h3 className="cat-h2">Intents, with and without a description</h3>
      <Toast intent="success" title="Saved" closeToast={noop} />
      <Toast intent="success" title="Query ran" description="12 rows came back." closeToast={noop} />
      <Toast intent="error" title="It didn't run" description="Unknown column: nope." closeToast={noop} />
      <Toast intent="error" title="Without a close button" />
      <div><Button onClick={() => toast({ intent: "success", title: "Toast from toast()", description: "Closes after 5 seconds." })}>Show a toast</Button></div>
      <ToastContainer />
    </div>
  ),
};

const Anchored = ({ position, appearance }) => {
  const ref = useRef(null);
  return (
    <div className="cat-cell" style={{ padding: "48px 72px" }}>
      <span ref={ref} className="cat-box" aria-describedby={"tt-" + position + appearance}>{position}</span>
      <Tooltip id={"tt-" + position + appearance} target={ref} visible position={position} appearance={appearance}>{`${appearance} tooltip`}</Tooltip>
    </div>
  );
};

export const Tooltips = {
  render: () => (
    <div className="cat-col">
      {["dark", "light"].map((appearance) => (
        <div key={appearance} className="cat-row">
          {["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"].map((p) => <Anchored key={p} position={p} appearance={appearance} />)}
        </div>
      ))}
    </div>
  ),
};

const Placed = ({ position }) => {
  const ref = useRef(null);
  return (
    <div style={{ padding: "40px 64px" }}>
      <span ref={ref} className="cat-box">{position}</span>
      <Positioner target={ref} visible position={position}><span className="cat-label">{"<- " + position}</span></Positioner>
    </div>
  );
};
export const Positioners = { render: () => <div className="cat-row">{["top", "bottom", "left", "right"].map((p) => <Placed key={p} position={p} />)}</div> };

export const MarkdownText = {
  name: "Markdown",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <Markdown source={"# Joins\n\nA **join** combines rows from *two tables*.\n\n## Kinds\n\n- `INNER JOIN` keeps matches\n- `LEFT JOIN` keeps every left row\n\n1. Pick the tables\n2. Write the condition\n\n```\nSELECT g.first_name, b.room\nFROM guests g\nJOIN bookings b ON b.guest_id = g.id;\n```\n"} />
    </div>
  ),
};
