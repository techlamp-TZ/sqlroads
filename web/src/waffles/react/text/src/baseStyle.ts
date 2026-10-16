import tokens from '@waffles/tokens/future-tokens';
import { css } from '@emotion/react';

const baseStyle = css({
  color: tokens.color.primary.navyText.value.rgb,
  fontFamily: `${tokens.asset.font.sansSerif.value}, ${tokens.asset.font.sansSerif.attributes.fallback}`,
  fontStyle: 'normal',
});

export default baseStyle;
