import tokens from '@waffles/tokens/future-tokens';
import { hexColorLuminance } from '@waffles/utils';
import { css } from '@emotion/react';
import React from 'react';

import Strong from './Strong';

interface BadgeProps {
  /**
   * The content to render in the Badge
   */
  children: string;
  /**
   * Additionaly css className to add to the rendered element
   */
  className?: string;
  /**
   * The colour of the Badge. This can be any HEX color, but it is recommended
   * to use a color from @waffles/tokens. The text color will be set
   * automatically.
   */
  color: string;
  /**
   * The size of the Badge to render.
   */
  size?: 'small' | 'large';
}

const baseStyle = css({
  borderRadius: 4,
  display: 'inline-block',
  textTransform: 'uppercase',
});

const sizeStyles = {
  large: {
    fontSize: tokens.size.font[300].value,
    lineHeight: '24px',
    paddingLeft: tokens.size.space[8].value,
    paddingRight: tokens.size.space[8].value,
  },
  small: {
    fontSize: tokens.size.font[200].value,
    lineHeight: '18px',
    paddingLeft: tokens.size.space[4].value,
    paddingRight: tokens.size.space[4].value,
  },
};

// SQL Drills: the background may be a palette variable whose colour changes in dark mode, so the text colour is
// chosen for each theme from that theme's real colour (navy on light backgrounds, white on dark ones).
const textFor = (backgroundColor: string, theme: 'light' | 'dark'): string =>
  // Compare to luminance of neutral grey color in the middle of the RGB scale
  hexColorLuminance(backgroundColor, theme) > 0.179 ? 'var(--wf-w-on-fill)' : 'var(--wf-w-on-dark)';

const getTextColor = (backgroundColor: string) => ({
  ':root[data-theme="dark"] &': { color: textFor(backgroundColor, 'dark') },
  color: textFor(backgroundColor, 'light'),
});

const Badge = ({
  children,
  className,
  color,
  size = 'small',
}: BadgeProps): React.ReactElement => (
  <Strong
    className={className}
    css={css(
      baseStyle,
      { backgroundColor: color, ...getTextColor(color) },
      sizeStyles[size],
    )}
  >
    {children}
  </Strong>
);

export default Badge;
