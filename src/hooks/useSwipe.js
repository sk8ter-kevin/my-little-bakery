import { useRef, useCallback } from "react";
import { haptic } from "../utils/helpers";

// ─── Swipe hook ───
export const useSwipe = (onSwipeLeft, onSwipeRight, threshold = 80) => {
    const touchStart = useRef(null);
    const touchDelta = useRef(0);
    const elRef = useRef(null);

    const onTouchStart = useCallback((e) => {
        touchStart.current = e.touches[0].clientX;
        touchDelta.current = 0;
    }, []);

    const onTouchMove = useCallback((e) => {
        if (touchStart.current === null) return;
        touchDelta.current = e.touches[0].clientX - touchStart.current;
        if (elRef.current) {
            const clamped = Math.max(-120, Math.min(120, touchDelta.current));
            elRef.current.style.transform = `translateX(${clamped}px)`;
            elRef.current.style.transition = "none";
        }
    }, []);

    const onTouchEnd = useCallback(() => {
        if (elRef.current) {
            elRef.current.style.transform = "translateX(0)";
            elRef.current.style.transition = "transform 0.3s ease";
        }
        if (Math.abs(touchDelta.current) > threshold) {
            haptic("medium");
            if (touchDelta.current < 0) onSwipeLeft?.();
            else onSwipeRight?.();
        }
        touchStart.current = null;
        touchDelta.current = 0;
    }, [onSwipeLeft, onSwipeRight, threshold]);

    return { elRef, onTouchStart, onTouchMove, onTouchEnd };
};
