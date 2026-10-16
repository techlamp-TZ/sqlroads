import { Badge, Code, CodeBlock, Emphasis, Heading, Link, List, Paragraph, Small, Strong, Text } from "@waffles/text";
import tokens from "@waffles/tokens/future-tokens";

export default { title: "Components/Text" };

const SIZES = [900, 800, 700, 650, 600, 500, 400, 300, 200];

export const Headings = {
  render: () => (
    <div className="cat-col">
      {SIZES.map((s, i) => (
        <Heading key={s} as={i === 0 ? "h1" : "h2"} size={s}>{`Heading size ${s}`}</Heading>
      ))}
      <Heading as="h2" size={800} multiLine>A multi-line large heading keeps a tighter line height when it wraps across lines</Heading>
    </div>
  ),
};

export const Body = {
  render: () => (
    <div className="cat-col" style={{ maxWidth: 640 }}>
      <Paragraph>A Paragraph. <Strong>Strong</Strong>, <Emphasis>Emphasis</Emphasis>, <Small>Small</Small> and <Code>inline code</Code> sit inside it.</Paragraph>
      <Text>Text (inline)</Text>
      <Paragraph><Link href="#/home">A Link</Link> inside a paragraph.</Paragraph>
      <CodeBlock>{"SELECT first_name, country\nFROM guests\nWHERE country = 'Kenya';"}</CodeBlock>
      <List><List.Item>Unordered one</List.Item><List.Item>Unordered two</List.Item></List>
      <List ordered><List.Item>Ordered one</List.Item><List.Item>Ordered two</List.Item></List>
    </div>
  ),
};

// every base palette colour, the blue text variant, and two neutrals
const BADGES = [...Object.keys(tokens.color.primary).filter((n) => !/(Dark|Light|Text)$/.test(n) || n === "blueText").map((n) => [n, "primary"]), ["grey200", "neutral"], ["beige300", "neutral"]];

export const Badges = {
  render: () => (
    <div className="cat-col">
      {["small", "large"].map((size) => (
        <div key={size} className="cat-row">
          {BADGES.map(([name, group]) => <Badge key={name} size={size} color={tokens.color[group][name].value.hex}>{name}</Badge>)}
        </div>
      ))}
    </div>
  ),
};
