import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNumberAnimation, easings } from '@/hooks/useAnimation';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  delay?: number;
  formatFn?: (value: number) => string;
  easing?: (t: number) => number;
  className?: string;
  isAnimated?: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

/**
 * A component that animates counting up to a number value
 * Great for statistics, data counters, and drawing attention to changing values
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1200,
  delay = 0,
  formatFn,
  easing = easings.easeOutQuad,
  className,
  isAnimated = true,
  prefix = '',
  suffix = '',
  decimals = 0,
}) => {
  const formattedValue = typeof formatFn === 'function'
    ? formatFn(value)
    : formatValue(value, decimals);
  
  // Use a dummy value animation when animations are disabled
  if (!isAnimated) {
    return (
      <StyledValue className={className}>
        {prefix}{formattedValue}{suffix}
      </StyledValue>
    );
  }
  
  const { value: animatedValue, restart } = useNumberAnimation(0, value, {
    duration,
    delay,
    easing,
  });

  // Restart animation when value changes
  useEffect(() => {
    restart();
  }, [value, restart]);

  // Format the current animated value
  const displayValue = typeof formatFn === 'function'
    ? formatFn(animatedValue)
    : formatValue(animatedValue, decimals);

  return (
    <StyledValue className={className}>
      {prefix}{displayValue}{suffix}
    </StyledValue>
  );
};

// Format number with commas and decimal places
const formatValue = (value: number, decimals: number): string => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const StyledValue = styled.span`
  display: inline-block;
`;

export default AnimatedNumber; 