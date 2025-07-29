import { useRef, useEffect, useState } from 'react';

type AnimationCallback = (progress: number) => void;
type EasingFunction = (t: number) => number;

interface AnimationOptions {
  duration?: number;
  delay?: number;
  easing?: EasingFunction;
  onComplete?: () => void;
  autoPlay?: boolean;
}

// Common easing functions
export const easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) => 
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  bounceOut: (t: number) => {
    if (t < 1/2.75) {
      return 7.5625 * t * t;
    } else if (t < 2/2.75) {
      return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
    } else if (t < 2.5/2.75) {
      return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
    }
  },
};

/**
 * A custom hook for creating JavaScript-based animations.
 * This allows for more complex animations than what CSS alone can provide.
 *
 * @param callback Function to be called on each animation frame
 * @param options Animation configuration options
 * @returns Object with animation control functions
 */
export function useAnimation(
  callback: AnimationCallback,
  options: AnimationOptions = {}
) {
  const {
    duration = 1000,
    delay = 0,
    easing = easings.easeOutQuad,
    onComplete,
    autoPlay = true,
  } = options;

  const requestRef = useRef<number>();
  const startTimeRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);
  const hasStartedRef = useRef(false);

  const animate = (timestamp: number) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    
    if (elapsed < delay) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }
    
    const adjustedElapsed = elapsed - delay;
    const rawProgress = Math.min(adjustedElapsed / duration, 1);
    const easedProgress = easing(rawProgress);
    
    setProgress(easedProgress);
    callback(easedProgress);

    if (rawProgress < 1) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (onComplete) onComplete();
      setIsPlaying(false);
    }
  };

  // Start or stop animation based on isPlaying
  useEffect(() => {
    if (isPlaying && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);

  // Control functions
  const play = () => {
    hasStartedRef.current = false;
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const stop = () => {
    setIsPlaying(false);
    setProgress(0);
    startTimeRef.current = null;
  };

  const restart = () => {
    stop();
    play();
  };

  return {
    play,
    pause,
    stop,
    restart,
    isPlaying,
    progress,
  };
}

/**
 * A simplified hook for number-based animations (like counters)
 * 
 * @param start Starting value
 * @param end Ending value
 * @param options Animation options
 * @returns The current value and control functions
 */
export function useNumberAnimation(
  start: number, 
  end: number, 
  options: AnimationOptions = {}
) {
  const [value, setValue] = useState(start);
  
  const animation = useAnimation(
    (progress) => {
      setValue(start + (end - start) * progress);
    },
    options
  );
  
  return {
    value,
    ...animation,
  };
}

export default useAnimation; 