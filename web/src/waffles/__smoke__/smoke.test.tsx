import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import Button, { ButtonGroup, CloseButton, CompactButtonGroup } from "@waffles/button";
import Card from "@waffles/card";
import { Input, Select, SelectOption, RadioList, Radio, CheckboxList, Checkbox, TextArea, Switch } from "@waffles/form-elements";
import Markdown from "@waffles/markdown";
import { AlertDialog, Dialog, Panel } from "@waffles/modals";
import { Text, Strong, Small, Paragraph, Heading, Emphasis, CodeBlock, Code, Link, Badge, List } from "@waffles/text";
import { Toast } from "@waffles/toast";
import Tooltip from "@waffles/tooltip";
import ResizableElements from "@waffles/resizable-elements";
import { CrossIcon, CheckmarkCircleInvertedIcon } from "@waffles/icons";
import tokens from "@waffles/tokens/future-tokens";

test("every package renders on React 19", () => {
  const { container } = render(
    <div>
      <Button onClick={() => {}}>Run</Button>
      <Button appearance="primary" intent="danger" onClick={() => {}}>Delete</Button>
      <ButtonGroup><Button onClick={() => {}}>A</Button><Button onClick={() => {}}>B</Button></ButtonGroup>
      <CompactButtonGroup><Button onClick={() => {}}>A</Button><Button onClick={() => {}}>B</Button></CompactButtonGroup>
      <CloseButton onClick={() => {}} />
      <Card><p>card</p></Card>
      <Input label="Name" name="n" onChange={() => {}} value="" />
      <Select label="Pick" name="s" onChange={() => {}} value="a"><SelectOption value="a">A</SelectOption></Select>
      <RadioList label="R" name="r" onChange={() => {}} value="a"><Radio value="a">A</Radio></RadioList>
      <CheckboxList label="C" name="c" onChange={() => {}} value={[]}><Checkbox value="a">A</Checkbox></CheckboxList>
      <TextArea label="T" name="t" onChange={() => {}} value="" />
      <Switch checked={false} onChange={() => {}}>On</Switch>
      <Markdown source={"# Title\n\nSome *em* and **strong** and `code`.\n\n- a\n- b\n\n```\nSELECT 1;\n```"} />
      <Text>t</Text><Strong>s</Strong><Small>sm</Small><Paragraph>p</Paragraph><Heading as="h2" size={600}>h</Heading><Emphasis>e</Emphasis>
      <CodeBlock>SELECT 1;</CodeBlock><Code>x</Code><Link href="#">l</Link><Badge color={tokens.color.primary.green.value.hex}>New</Badge>
      <List><List.Item>one</List.Item></List>
      <Toast intent="success" title="Saved" />
      <ResizableElements orientation="row"><div>left</div><div>right</div></ResizableElements>
      <CrossIcon title="Close" /><CheckmarkCircleInvertedIcon title="Done" />
    </div>,
  );
  expect(container.querySelectorAll("button").length).toBeGreaterThan(5);
  expect(container.querySelector("h1").textContent).toBe("Title");
  void [AlertDialog, Dialog, Panel, Tooltip];
});
