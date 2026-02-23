// ─── Utility: generate unique IDs ───
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const getTodayISO = () => new Date().toISOString().split("T")[0];
export const getMonthISO = (dateString = getTodayISO()) => dateString.slice(0, 7);

// ─── Photo helpers ───
export const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });

export const compressImage = (dataUrl, maxWidth = 800) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ratio = Math.min(maxWidth / img.width, 1);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = dataUrl;
    });

// ─── Haptic feedback ───
export const haptic = (type) => {
    if (!navigator.vibrate) return;
    const patterns = {
        light: [10],
        medium: [20],
        success: [15, 50, 15],
        error: [30, 30, 30],
        select: [5],
    };
    navigator.vibrate(patterns[type] || [10]);
};

// ─── Date formatting ───
export const fmtDate = (d) => {
    if (!d) return "Never";
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const fmtMonth = (monthString) => {
    const [year, month] = monthString.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

// ─── Fraction formatting ───
export const toFraction = (value) => {
    if (value == null || isNaN(value) || value === 0) return "0";
    const whole = Math.floor(value);
    const decimal = value - whole;

    const fractions = [
        [1, 8, 1 / 8],
        [1, 4, 1 / 4],
        [1, 3, 1 / 3],
        [3, 8, 3 / 8],
        [1, 2, 1 / 2],
        [5, 8, 5 / 8],
        [2, 3, 2 / 3],
        [3, 4, 3 / 4],
        [7, 8, 7 / 8],
    ];

    if (decimal < 0.01) return `${whole}`;

    let closest = null;
    let minDiff = Infinity;
    for (const [num, den, val] of fractions) {
        const diff = Math.abs(decimal - val);
        if (diff < minDiff) {
            minDiff = diff;
            closest = [num, den];
        }
    }

    if (minDiff < 0.05) {
        const frac = `${closest[0]}/${closest[1]}`;
        return whole > 0 ? `${whole} ${frac}` : frac;
    }

    return `${+value.toFixed(2)}`;
};

// ─── Timer formatting ───
export const fmtTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
};
