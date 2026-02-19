import { useRef } from "react";
import { useSwipe } from "../hooks/useSwipe";
import Icons from "./Icons";

// ─── SwipeCard — extracted to top-level to avoid re-mounting on every render ───
const SwipeCard = ({ recipe, onDelete, onToggleFavorite, longPressTimerRef, children }) => {
    const swipe = useSwipe(
        () => onDelete(recipe.id),
        () => onToggleFavorite(recipe.id)
    );
    return (
        <div
            ref={swipe.elRef}
            onTouchStart={swipe.onTouchStart}
            onTouchMove={(e) => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); swipe.onTouchMove(e); }}
            onTouchEnd={swipe.onTouchEnd}
            style={{ position: "relative" }}
        >
            {/* Swipe hints behind the card */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 16, display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "0 20px", zIndex: 0,
            }}>
                <div style={{ color: "#e74c6f", fontWeight: 700, fontSize: 13, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                    {Icons.heart({ size: 18, filled: true })} Fave
                </div>
                <div style={{ color: "#c0392b", fontWeight: 700, fontSize: 13, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                    Delete {Icons.trash({ size: 18, color: "#c0392b" })}
                </div>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
};

export default SwipeCard;
