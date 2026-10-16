import Card from "@waffles/card";
import { Heading, Paragraph } from "@waffles/text";
import { CodeIcon } from "@waffles/icons";

export default { title: "Components/Card", component: Card };

export const Elevations = {
  render: () => (
    <div className="cat-row">
      {[0, 1, 2, 3, 4].map((e) => (
        <Card key={e} elevation={e}>
          <div style={{ padding: 16, width: 160 }}>
            <Heading as="h2" size={300}>{`elevation ${e}`}</Heading>
            <Paragraph>A card.</Paragraph>
          </div>
        </Card>
      ))}
    </div>
  ),
};

export const HoverAndHeadStone = {
  render: () => (
    <div className="cat-row" style={{ paddingTop: 24 }}>
      <Card elevation={1} hoverElevation={3} onClick={() => {}}>
        <div style={{ padding: 16, width: 220 }}><Heading as="h2" size={300}>Raises on hover</Heading><Paragraph>hoverElevation 3, clickable.</Paragraph></div>
      </Card>
      <Card as="section" elevation={2} headStone={<CodeIcon size={24} aria-hidden />}>
        <div style={{ padding: "32px 16px 16px", width: 220 }}><Heading as="h2" size={300}>With a headstone</Heading><Paragraph>As a section.</Paragraph></div>
      </Card>
    </div>
  ),
};
