import { hexToRgbaColor, ssrSafeNotFirstChildSelector } from '@waffles/utils';
import { css } from '@emotion/react';
import React from 'react';

const indicatorStyle = css({
  borderRadius: '50%',
  display: 'inline-block',
  height: 8,
  [ssrSafeNotFirstChildSelector]: {
    marginLeft: 8,
  },
  width: 8,
});

interface StepsIndicatorProps {
  currentStep?: number;
  totalSteps: number;
}

const StepsIndicator: React.FC<StepsIndicatorProps> = ({
  currentStep = 0,
  totalSteps,
}) => (
  <div
    aria-label={`Step ${currentStep} of ${totalSteps}`}
    role="img" // SQL Drills: an aria-label needs a role (axe aria-prohibited-attr)
    css={{ lineHeight: '8px', marginTop: 16, padding: 0 }}
  >
    {[...Array(totalSteps).keys()].map((step) => {
      return (
        <div
          css={css(indicatorStyle, {
            backgroundColor:
              step >= currentStep ? hexToRgbaColor('var(--wf-w-on-dark)', 0.3) : 'var(--wf-w-on-dark)',
          })}
          key={step}
        />
      );
    })}
  </div>
);

export default StepsIndicator;
