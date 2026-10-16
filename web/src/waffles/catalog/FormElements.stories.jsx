import { useState } from "react";
import { Checkbox, CheckboxList, Input, Label, Radio, RadioList, Select, SelectOption, Switch, TextArea } from "@waffles/form-elements";
import { SearchIcon } from "@waffles/icons";

export default { title: "Components/Form elements" };

const Controlled = ({ initial, children }) => { const [v, setV] = useState(initial); return children(v, setV); };

export const Inputs = {
  render: () => (
    <div className="cat-col" style={{ maxWidth: 420 }}>
      {["small", "medium", "large"].map((size) => (
        <Controlled key={size} initial="">{(v, set) => <Input label={`Input (${size})`} name={"in-" + size} size={size} placeholder="Type here" value={v} onChange={set} />}</Controlled>
      ))}
      <Controlled initial="SELECT">{(v, set) => <Input label="With a description" description="Shown under the label" name="in-d" value={v} onChange={set} />}</Controlled>
      <Controlled initial="">{(v, set) => <Input label="With an icon" name="in-i" icon={<SearchIcon />} placeholder="Search" value={v} onChange={set} />}</Controlled>
      <Controlled initial="x">{(v, set) => <Input label="With an error" name="in-e" errorMessage="That is not a table name" value={v} onChange={set} />}</Controlled>
      <Input label="Required" name="in-r" required value="" onChange={() => {}} />
      <Input label="Disabled" name="in-x" disabled value="read only" onChange={() => {}} />
    </div>
  ),
};

export const Selects = {
  render: () => (
    <div className="cat-col" style={{ maxWidth: 420 }}>
      {["small", "medium", "large"].map((size) => (
        <Controlled key={size} initial="mysql">{(v, set) => (
          <Select label={`Select (${size})`} name={"sel-" + size} size={size} value={v} onChange={set}>
            <SelectOption value="mysql">MySQL</SelectOption>
            <SelectOption value="postgres">PostgreSQL</SelectOption>
            <SelectOption value="sqlite" disabled>SQLite (disabled option)</SelectOption>
          </Select>
        )}</Controlled>
      ))}
      <Select label="With an error" name="sel-e" errorMessage="Pick an engine" value="mysql" onChange={() => {}}><SelectOption value="mysql">MySQL</SelectOption><SelectOption value="pg">PostgreSQL</SelectOption></Select>
      <Select label="Disabled" name="sel-x" disabled value="mysql" onChange={() => {}}><SelectOption value="mysql">MySQL</SelectOption><SelectOption value="pg">PostgreSQL</SelectOption></Select>
    </div>
  ),
};

export const RadiosAndCheckboxes = {
  render: () => (
    <div className="cat-row">
      <Controlled initial="b">{(v, set) => (
        <RadioList label="RadioList" description="Pick one" name="rl" value={v} onChange={set}>
          <Radio value="a">INNER JOIN</Radio><Radio value="b">LEFT JOIN</Radio><Radio value="c" disabled>CROSS JOIN (disabled)</Radio>
        </RadioList>
      )}</Controlled>
      <RadioList label="RadioList with an error" name="rl-e" errorMessage="Choose one" value="" onChange={() => {}}><Radio value="a">Yes</Radio><Radio value="b">No</Radio></RadioList>
      <Controlled initial={["a"]}>{(v, set) => (
        <CheckboxList label="CheckboxList" description="Pick any" name="cl" value={v} onChange={set}>
          <Checkbox value="a">WHERE</Checkbox><Checkbox value="b">GROUP BY</Checkbox><Checkbox value="c" disabled>HAVING (disabled)</Checkbox>
        </CheckboxList>
      )}</Controlled>
      <CheckboxList label="Disabled list" name="cl-x" disabled value={["a"]} onChange={() => {}}><Checkbox value="a">One</Checkbox><Checkbox value="b">Two</Checkbox></CheckboxList>
    </div>
  ),
};

export const TextAreas = {
  render: () => (
    <div className="cat-col" style={{ maxWidth: 520 }}>
      <Controlled initial={"SELECT *\nFROM guests;"}>{(v, set) => <TextArea label="TextArea" name="ta" rows={4} value={v} onChange={set} />}</Controlled>
      <TextArea label="With an error" name="ta-e" errorMessage="Write a query first" value="" onChange={() => {}} />
      <TextArea label="Disabled" name="ta-x" disabled value="locked" onChange={() => {}} />
    </div>
  ),
};

export const Switches = {
  render: () => (
    <div className="cat-col">
      <Controlled initial={false}>{(v, set) => <Switch checked={v} onChange={() => set(!v)}>Dark mode</Switch>}</Controlled>
      <Switch checked onChange={() => {}}>On</Switch>
      <Switch checked={false} disabled onChange={() => {}}>Disabled</Switch>
      <div className="cat-dark-band"><Controlled initial>{(v, set) => <Switch appearance="inverted" checked={v} onChange={() => set(!v)}>Inverted (on dark)</Switch>}</Controlled></div>
    </div>
  ),
};

export const Labels = {
  render: () => (
    <div className="cat-col" style={{ maxWidth: 420 }}>
      <Label label="Label around a control" description="With a description" htmlFor="lbl-in"><input id="lbl-in" /></Label>
      <Label as="div" label="Required, with an error" required errorMessage="Something is missing"><span>content</span></Label>
    </div>
  ),
};
