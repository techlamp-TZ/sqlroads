import { CloseButton } from '@waffles/button';
import {
  CheckmarkCircleInvertedIcon,
  CrossCircleInvertedIcon,
} from '@waffles/icons';
import { Heading, Paragraph } from '@waffles/text';
import tokens from '@waffles/tokens/future-tokens';
import { computeDataAttributes } from '@waffles/utils';
import { css } from '@emotion/react';

// TODO(blurbyte) Remove when it will be added to design tokens
const EXTRA_TEXT_COLOR = 'var(--wf-text-muted)'; // SQL Drills: the muted text role (4.5:1 in both themes)

const colors = {
  error: tokens.color.primary.red.value.hex,
  success: tokens.color.primary.green.value.hex,
};

const icons = {
  error: CrossCircleInvertedIcon,
  success: CheckmarkCircleInvertedIcon,
};

const wrapperStyle = css({
  alignItems: 'flex-start',
  background: tokens.color.primary.white.value.hex,
  borderLeftStyle: 'solid',
  borderLeftWidth: 4,
  borderRadius: 4,
  boxShadow:
    `0px 0px 1px 0px var(--wf-shadow-color), ${tokens.shadow.xl.value}`,
  display: 'flex',
  justifyContent: 'space-between',
  maxWidth: 512,
  minWidth: 250,
  padding: 16,
  position: 'relative',
  zIndex: parseInt(tokens.zIndex[999].value, 10),
});

interface ToastProps {
  /**
   * Used internally. Do not explicitly set.
   */
  closeToast?: () => void;
  /**
   * Can be used to set data- html attributes on the element.
   */
  dataAttributes?: { [key: string]: string };
  /**
   * Optional content to display in the toast below title.
   */
  description?: string;
  /**
   * Determines the color and icon displayed in the toast.
   */
  intent: 'success' | 'error';
  /**
   * The main content to display in the toast.
   */
  title: string;
}

const Toast = ({
  closeToast,
  dataAttributes,
  description,
  intent,
  title,
}: ToastProps): JSX.Element => {
  const Icon = icons[intent];
  const color = colors[intent];
  const parsedDataAttributes = computeDataAttributes(dataAttributes);

  return (
    <div
      css={css({ borderColor: color }, wrapperStyle)}
      {...parsedDataAttributes}
      data-testid="toast-wrapper"
    >
      <Icon css={css({ flexShrink: 0 })} title={intent} />
      <div css={css({ flexGrow: 1, marginLeft: 12, marginRight: 8 })}>
        <Heading as="h4" multiLine size={300}>
          {title}
        </Heading>
        {description && (
          <Paragraph css={css({ color: EXTRA_TEXT_COLOR })}>
            {description}
          </Paragraph>
        )}
      </div>
      {closeToast && (
        <CloseButton
          css={{ flexShrink: 0 }}
          onClick={closeToast}
          size="small"
        />
      )}
    </div>
  );
};

export default Toast;
