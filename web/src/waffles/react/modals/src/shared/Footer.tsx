import Button, { ButtonGroup } from '@waffles/button';
import tokens from '@waffles/tokens/future-tokens';
import { css } from '@emotion/react';
import React, { ReactElement } from 'react';

export interface FooterProps {
  children: ReactElement | ReactElement[];
}

const baseStyle = css({
  boxShadow: `0px -1px 0px 0px ${tokens.color.neutral.grey200.value.hex}`,
  display: 'flex',
  flex: 'none',
  padding: tokens.size.space[16].value,
});

const twoChildrenStyle = css(baseStyle, {
  justifyContent: 'space-between',
});

const defaultStyle = css(baseStyle, {
  justifyContent: 'space-around',
  textAlign: 'center',
});

const Footer = ({ children }: FooterProps): ReactElement => (
  <div
    css={React.Children.count(children) === 2 ? twoChildrenStyle : defaultStyle}
  >
    {children}
  </div>
);

export default Footer;
