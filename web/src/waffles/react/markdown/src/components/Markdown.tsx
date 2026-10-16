import {
  alternateComponents,
  Emphasis,
  List,
  Paragraph,
  Strong,
} from '@waffles/text';
import React, { ReactElement } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';

interface MarkdownProps {
  /**
   * Adds a css className to the rendered element.
   */
  className?: string;
  /**
   * The markdown string to render.
   */
  source: string;
}

const {
  AlternateCode,
  AlternateCodeBlock,
  AlternateHeading,
  AlternateListItem,
} = alternateComponents;

// SQL Drills: react-markdown 10 renders by HTML tag (`components`) instead of the v5 node types (`renderers`):
// code blocks arrive as <pre><code>, inline code as <code>, headings as h1–h6, lists as ul/ol, plain text needs
// no renderer, and every component also receives the syntax-tree `node`, which must not reach the DOM.
const textOf = (children: React.ReactNode): string =>
  React.Children.toArray(children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : React.isValidElement<{ children?: React.ReactNode }>(c) ? textOf(c.props.children) : ''))
    .join('');
const heading = (level: 1 | 2 | 3 | 4 | 5 | 6) => ({ children }: { children?: React.ReactNode }) => (
  <AlternateHeading level={level}>{children}</AlternateHeading>
);

const renderers: Components = {
  code: ({ children }) => <AlternateCode value={textOf(children)} />,
  em: ({ children }) => <Emphasis>{children as any}</Emphasis>,
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  h5: heading(5),
  h6: heading(6),
  li: ({ children }) => <AlternateListItem>{children as any}</AlternateListItem>,
  ol: ({ children }) => <List ordered>{children}</List>,
  p: ({ children }) => <Paragraph>{children as any}</Paragraph>,
  pre: ({ children }) => <AlternateCodeBlock value={textOf(children).replace(/\n$/, '')} />,
  strong: ({ children }) => <Strong>{children as any}</Strong>,
  ul: ({ children }) => <List>{children}</List>,
};

const Markdown = (props: MarkdownProps): ReactElement => {
  const { className, source } = props;
  // react-markdown 10 dropped its className prop, so the wrapper carries it
  return (
    <div className={className}>
      <ReactMarkdown components={renderers}>{source}</ReactMarkdown>
    </div>
  );
};

export default Markdown;
