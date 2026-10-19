// The shared pieces: each old piece (app.js) next to its React wrapper, inside the real old app (booted from the
// test copy on :4100 through the catalog's proxy), so both run with the old handlers.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader } from "../index.jsx";
import { legacyApp } from "./legacyApp.js";
import { CardPair, ConfirmPair, ExamplePair, MiniTablePair, ResultDiffPair, ResultTablePair, SchemaPair, TablesPair, WorkspacePair } from "./pairs.jsx";

// render the story inside the old app's #view (once it has booted), not in Storybook's own root
const InApp = ({ children }) => {
  const [host, setHost] = useState(null);
  useEffect(() => { let on = true; legacyApp().then((h) => on && setHost(h)); return () => { on = false; }; }, []);
  return host ? createPortal(children, host) : <Loader label="Starting the old app" showLabel />;
};
const inApp = (Story) => <InApp><Story /></InApp>;

export default { title: "Shared pieces", decorators: [inApp], parameters: { legacyApp: true } };

export const SchemaPanel = { render: () => <SchemaPair /> };
export const TablesPanel = { render: () => <TablesPair /> };
export const SqlWorkspace = { render: () => <WorkspacePair /> };
export const ExampleBox = { render: () => <ExamplePair /> };
export const ResultTable = { render: () => <ResultTablePair /> };
export const ResultDiff = { name: "ResultDiff (.rdiff)", render: () => <ResultDiffPair /> };
export const MiniTable = { render: () => <MiniTablePair /> };
export const InteractionCard = { name: "InteractionCard (xcardHtml)", render: () => <CardPair /> };
export const Confirm = { name: "Confirm (askConfirm, #confirmDlg)", render: () => <ConfirmPair /> };
