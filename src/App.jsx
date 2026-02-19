import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CATEGORIES, UNITS, SAMPLE_RECIPES, EMOJI_MAP, WEEK_DAYS, lightColors, darkColors } from "./utils/constants";
import { uid, getTodayISO, getMonthISO, fileToDataUrl, compressImage, haptic, fmtDate, fmtMonth, fmtTimer } from "./utils/helpers";
import { parseRecipeText, extractTextFromPdf } from "./utils/recipeParser";
import { buildRecipePdf } from "./utils/pdfBuilder";
import { loadData, saveData } from "./hooks/useStorage";
import { useSwipe } from "./hooks/useSwipe";
import { getStyles } from "./styles/theme";
import Icons from "./components/Icons";
import SwipeCard from "./components/SwipeCard";

// ─── Main App ───
export default function RecipeOrganizer() {
    const [recipes, setRecipes] = useState([]);
    const [view, setView] = useState("home");
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchDisplay, setSearchDisplay] = useState("");
    const searchDebounceRef = useRef(null);
    const [activeCategory, setActiveCategory] = useState("All");
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [scaleFactor, setScaleFactor] = useState(1);
    const [shoppingList, setShoppingList] = useState([]);
    const [checkedItems, setCheckedItems] = useState({});
    const [bakeLogEntries, setBakeLogEntries] = useState([]);
    const [calendarDate, setCalendarDate] = useState(() => getTodayISO());
    const [calendarMonth, setCalendarMonth] = useState(() => getMonthISO());
    const [bakeLogDraft, setBakeLogDraft] = useState({ recipeId: "", notes: "", photos: [] });
    const [ingredientSearch, setIngredientSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [editForm, setEditForm] = useState(null);
    const [toast, setToast] = useState(null);
    const [toastAction, setToastAction] = useState(null);
    const toastTimerRef = useRef(null);
    const [darkMode, setDarkMode] = useState(false);
    const [splashDone, setSplashDone] = useState(false);
    const [viewTransition, setViewTransition] = useState(null);
    const [bouncingHeartId, setBouncingHeartId] = useState(null);
    const [poppedCheck, setPoppedCheck] = useState(null);
    const [cookingSteps, setCookingSteps] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);
    const wakeLockRef = useRef(null);
    const [timers, setTimers] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const longPressTimerRef = useRef(null);
    const [sortBy, setSortBy] = useState("recent");
    const [recentlyViewed, setRecentlyViewed] = useState([]);
    const [fabExpanded, setFabExpanded] = useState(false);
    const [pdfImporting, setPdfImporting] = useState(false);
    const pdfInputRef = useRef(null);
    const transitionTimerRef = useRef(null);
    const photoInputRef = useRef(null);
    const bakeLogPhotoInputRef = useRef(null);
    const scrollRef = useRef(null);
    const cardsAnimatedRef = useRef(false);

    const c = useMemo(() => (darkMode ? darkColors : lightColors), [darkMode]);

    // Load data + dark mode pref
    useEffect(() => {
        (async () => {
            const data = await loadData();
            if (Array.isArray(data?.recipes)) {
                setRecipes(data.recipes);
            } else {
                setRecipes(SAMPLE_RECIPES);
                await saveData({ recipes: SAMPLE_RECIPES });
            }
            if (data?.darkMode !== undefined) setDarkMode(data.darkMode);
            if (data?.sortBy) setSortBy(data.sortBy);
            if (data?.recentlyViewed) setRecentlyViewed(data.recentlyViewed);
            if (data?.bakeLogEntries) setBakeLogEntries(data.bakeLogEntries);
            setLoading(false);
        })();
    }, []);

    // Splash screen timer
    useEffect(() => {
        if (!loading) {
            const t = setTimeout(() => setSplashDone(true), 2000);
            return () => clearTimeout(t);
        }
    }, [loading]);

    // Mark card animations as done after initial stagger
    useEffect(() => {
        if (view === "home") {
            const t = setTimeout(() => { cardsAnimatedRef.current = true; }, 600);
            return () => clearTimeout(t);
        } else {
            cardsAnimatedRef.current = false;
        }
    }, [view]);

    // Save on change (debounced)
    const saveTimerRef = useRef(null);
    useEffect(() => {
        if (!loading) {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                saveData({ recipes, darkMode, sortBy, recentlyViewed, bakeLogEntries });
            }, 400);
            return () => clearTimeout(saveTimerRef.current);
        }
    }, [recipes, loading, darkMode, sortBy, recentlyViewed, bakeLogEntries]);

    const showToast = (msg, action) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast(msg);
        setToastAction(action || null);
        toastTimerRef.current = setTimeout(() => {
            setToast(null);
            setToastAction(null);
            toastTimerRef.current = null;
        }, action ? 4000 : 2200);
    };

    const navigateTo = useCallback((to, direction = "forward") => {
        if (transitionTimerRef.current || to === view) return;
        setFabExpanded(false);
        setViewTransition({ from: view, to, direction });
        transitionTimerRef.current = setTimeout(() => {
            setView(to);
            setViewTransition(null);
            transitionTimerRef.current = null;
        }, 300);
    }, [view]);

    // Cooking mode helpers
    const startCooking = () => {
        const steps = selectedRecipe.instructions
            .split("\n").filter(Boolean).map((s) => s.replace(/^\d+\.\s*/, ""));
        setCookingSteps(steps);
        setCurrentStep(0);
        navigateTo("cooking", "forward");
        if (navigator.wakeLock) {
            navigator.wakeLock.request("screen").then((l) => { wakeLockRef.current = l; }).catch(() => { });
        }
    };

    const exitCooking = () => {
        if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => { }); wakeLockRef.current = null; }
        navigateTo("detail", "back");
    };

    const finishCooking = () => {
        if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => { }); wakeLockRef.current = null; }
        markCooked(selectedRecipe.id, true);
    };

    const cookingSwipe = useSwipe(
        () => { if (currentStep < cookingSteps.length - 1) { haptic("select"); setCurrentStep((s) => s + 1); } },
        () => { if (currentStep > 0) { haptic("select"); setCurrentStep((s) => s - 1); } },
        60
    );

    // Timer logic — stabilized deps
    const hasActiveTimers = useMemo(() => timers.some((t) => t.active), [timers]);
    useEffect(() => {
        if (timers.length === 0 || !hasActiveTimers) return;
        const interval = setInterval(() => {
            setTimers((prev) =>
                prev.map((t) => {
                    if (!t.active || t.remainingSeconds <= 0) return t;
                    const next = t.remainingSeconds - 1;
                    if (next <= 0) {
                        haptic("success");
                        showToast(`⏰ ${t.label} is done!`);
                        return { ...t, remainingSeconds: 0, active: false };
                    }
                    return { ...t, remainingSeconds: next };
                })
            );
        }, 1000);
        return () => clearInterval(interval);
    }, [timers.length, hasActiveTimers]);

    const addTimer = (label, minutes) => {
        haptic("medium");
        setTimers((prev) => [...prev, { id: uid(), label, totalSeconds: minutes * 60, remainingSeconds: minutes * 60, active: true }]);
        showToast(`Timer set: ${minutes}m ⏰`);
    };

    const removeTimer = (id) => { setTimers((prev) => prev.filter((t) => t.id !== id)); };
    const toggleTimer = (id) => { setTimers((prev) => prev.map((t) => t.id === id ? { ...t, active: !t.active } : t)); };

    // Long-press helpers
    const openContextMenu = (recipe) => { haptic("medium"); setContextMenu(recipe); };
    const closeContextMenu = () => setContextMenu(null);

    const duplicateRecipe = (recipe) => {
        const copy = { ...recipe, id: uid(), name: recipe.name + " (Copy)", timesCooked: 0, lastMade: null, createdAt: new Date().toISOString().split("T")[0] };
        setRecipes((prev) => [copy, ...prev]);
        haptic("success");
        showToast("Recipe duplicated! 📋");
        closeContextMenu();
    };

    // Export recipe as PDF
    const exportRecipePdf = async (recipe) => {
        try {
            const pdf = buildRecipePdf(recipe);
            const blob = new Blob([pdf], { type: "application/pdf" });
            const file = new File([blob], `${recipe.name.replace(/[^a-zA-Z0-9 ]/g, "").trim()}.pdf`, { type: "application/pdf" });
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: recipe.name });
                showToast("Recipe shared! 📄");
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = file.name; a.click();
                URL.revokeObjectURL(url);
                showToast("PDF downloaded! 📄");
            }
        } catch (e) {
            if (e.name !== "AbortError") showToast("Couldn't create PDF");
        }
        closeContextMenu();
    };

    // Recently viewed tracking
    const openRecipeDetail = (recipe) => {
        setSelectedRecipe(recipe);
        setScaleFactor(1);
        setRecentlyViewed((prev) => [recipe.id, ...prev.filter((id) => id !== recipe.id)].slice(0, 5));
        navigateTo("detail", "forward");
    };

    const openCalendarForDate = (dateString = getTodayISO(), recipeId = "") => {
        const month = getMonthISO(dateString);
        setCalendarDate(dateString);
        setCalendarMonth(month);
        setBakeLogDraft({ recipeId, notes: "", photos: [] });
        navigateTo("calendar", "forward");
    };

    // Photo handler
    const handlePhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await fileToDataUrl(file);
            const compressed = await compressImage(dataUrl);
            setEditForm((prev) => ({ ...prev, photo: compressed }));
            showToast("Photo added! 📸");
        } catch { showToast("Couldn't load photo"); }
        e.target.value = "";
    };

    const handleBakeLogPhotos = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        try {
            const compressedPhotos = await Promise.all(
                files.map(async (file) => {
                    const dataUrl = await fileToDataUrl(file);
                    return compressImage(dataUrl, 1024);
                })
            );
            setBakeLogDraft((prev) => ({ ...prev, photos: [...prev.photos, ...compressedPhotos].slice(0, 8) }));
            showToast("Bake photos added! 📸");
        } catch { showToast("Couldn't load one or more photos"); }
        e.target.value = "";
    };

    // PDF import handler (lazy-loaded)
    const handlePdfImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== "application/pdf") { showToast("Please select a PDF file"); e.target.value = ""; return; }
        if (file.size > 10 * 1024 * 1024) { showToast("PDF is too large (max 10MB)"); e.target.value = ""; return; }
        setPdfImporting(true);
        haptic("medium");
        try {
            const rawText = await extractTextFromPdf(file);
            if (!rawText || rawText.trim().length < 20) throw new Error("NO_TEXT");
            const parsed = parseRecipeText(rawText);
            setEditForm({ ...parsed });
            setPdfImporting(false);
            navigateTo("edit", "forward");
            showToast("Recipe imported! Review & save below 📋");
            haptic("success");
        } catch (err) {
            setPdfImporting(false);
            if (err.message === "NO_TEXT") {
                showToast("Couldn't read text from this PDF. It may be a scanned image.");
            } else {
                console.error("PDF import error:", err);
                showToast("Couldn't import this PDF. Try another file.");
            }
        }
        e.target.value = "";
    };

    // Filtered + sorted recipes
    const filtered = useMemo(() => {
        let result = recipes.filter((r) => {
            if (showFavoritesOnly && !r.favorite) return false;
            if (activeCategory !== "All" && r.category !== activeCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    r.name.toLowerCase().includes(q) ||
                    r.tags?.some((t) => t.toLowerCase().includes(q)) ||
                    r.ingredients?.some((i) => i.name.toLowerCase().includes(q)) ||
                    r.category?.toLowerCase().includes(q)
                );
            }
            return true;
        });
        if (sortBy === "alpha") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === "mostMade") result = [...result].sort((a, b) => (b.timesCooked || 0) - (a.timesCooked || 0));
        else if (sortBy === "lastMade") result = [...result].sort((a, b) => (b.lastMade || "").localeCompare(a.lastMade || ""));
        return result;
    }, [recipes, showFavoritesOnly, activeCategory, searchQuery, sortBy]);

    const bakeEntriesByDate = useMemo(() => (
        bakeLogEntries.reduce((acc, entry) => { acc[entry.date] = (acc[entry.date] || 0) + 1; return acc; }, {})
    ), [bakeLogEntries]);

    const selectedDateEntries = useMemo(
        () => bakeLogEntries.filter((entry) => entry.date === calendarDate).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
        [bakeLogEntries, calendarDate]
    );

    const calendarCells = useMemo(() => {
        const [year, month] = calendarMonth.split("-").map(Number);
        if (!year || !month) return [];
        const firstDay = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const leading = firstDay.getDay();
        const cells = Array.from({ length: leading }, () => null);
        for (let day = 1; day <= daysInMonth; day++) {
            const dayString = `${calendarMonth}-${String(day).padStart(2, "0")}`;
            cells.push(dayString);
        }
        return cells;
    }, [calendarMonth]);

    const suggestedRecipes = useMemo(() => ingredientSearch
        ? recipes.map((r) => {
            const searchTerms = ingredientSearch.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
            const matchCount = r.ingredients.filter((ing) => searchTerms.some((term) => ing.name.toLowerCase().includes(term))).length;
            return { ...r, matchCount, matchPercent: Math.round((matchCount / r.ingredients.length) * 100) };
        }).filter((r) => r.matchCount > 0).sort((a, b) => b.matchPercent - a.matchPercent)
        : [], [ingredientSearch, recipes]);

    const generateShoppingList = (recipe, scale = 1) => {
        const items = recipe.ingredients.map((ing) => ({
            name: ing.name, amount: +(ing.amount * scale).toFixed(2), unit: ing.unit, recipe: recipe.name, checked: false,
        }));
        setShoppingList((prev) => [...prev, ...items]);
        haptic("medium");
        navigateTo("shopping", "forward");
        showToast("Added to shopping list! 🛒");
    };

    const toggleFavorite = (id) => {
        haptic("light");
        setBouncingHeartId(id);
        setTimeout(() => setBouncingHeartId(null), 400);
        setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)));
    };

    const shiftCalendarMonth = (offset) => {
        const [year, month] = calendarMonth.split("-").map(Number);
        const next = new Date(year, month - 1 + offset, 1);
        const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
        setCalendarMonth(nextMonth);
        setCalendarDate((prev) => (prev.startsWith(nextMonth) ? prev : `${nextMonth}-01`));
    };

    const saveBakeLogEntry = () => {
        const selectedRecipeForLog = recipes.find((r) => r.id === bakeLogDraft.recipeId);
        if (!selectedRecipeForLog && !bakeLogDraft.notes.trim() && bakeLogDraft.photos.length === 0) {
            showToast("Choose what was baked or add a note/photo first"); return;
        }
        const newEntry = {
            id: uid(), date: calendarDate, recipeId: selectedRecipeForLog?.id || null,
            recipeName: selectedRecipeForLog?.name || "Custom Bake", notes: bakeLogDraft.notes.trim(),
            photos: bakeLogDraft.photos, createdAt: new Date().toISOString(),
        };
        setBakeLogEntries((prev) => [newEntry, ...prev]);
        setBakeLogDraft({ recipeId: "", notes: "", photos: [] });
        haptic("success");
        showToast("Saved to baking calendar! 🗓️");
    };

    const deleteBakeLogEntry = (id) => {
        setBakeLogEntries((prev) => prev.filter((entry) => entry.id !== id));
        haptic("light"); showToast("Bake entry removed");
    };

    const markCooked = (id, openLogAfter = false) => {
        const today = getTodayISO();
        setRecipes((prev) => prev.map((r) => r.id === id ? { ...r, lastMade: today, timesCooked: (r.timesCooked || 0) + 1 } : r));
        setSelectedRecipe((prev) => (prev && prev.id === id ? { ...prev, lastMade: today, timesCooked: (prev.timesCooked || 0) + 1 } : prev));
        haptic("success");
        if (openLogAfter) { openCalendarForDate(today, id); showToast("Nice bake. Add notes/photos for today 📸"); return; }
        showToast("Marked as made today! 🎉");
    };

    const deleteRecipe = (id) => {
        const deleted = recipes.find((r) => r.id === id);
        if (!deleted) return;
        haptic("error");
        setRecipes((prev) => prev.filter((r) => r.id !== id));
        navigateTo("home", "back");
        showToast("Recipe deleted", {
            label: "Undo",
            onPress: () => {
                setRecipes((prev) => [deleted, ...prev]);
                setToast(null); setToastAction(null);
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                showToast("Recipe restored! ✨");
            },
        });
    };

    const saveRecipe = (form) => {
        if (form.id) {
            setRecipes((prev) => prev.map((r) => (r.id === form.id ? { ...form } : r)));
            setSelectedRecipe(form);
            showToast("Recipe updated! ✨");
        } else {
            const newRecipe = { ...form, id: uid(), createdAt: new Date().toISOString().split("T")[0], timesCooked: 0 };
            setRecipes((prev) => [newRecipe, ...prev]);
            setSelectedRecipe(newRecipe);
            showToast("Recipe added! 🧁");
        }
        haptic("success");
        navigateTo(form.id ? "detail" : "home", "back");
    };

    // View transition animation helper
    const getViewAnim = (viewName) => {
        if (!viewTransition) return view === viewName ? {} : null;
        const { from, to, direction } = viewTransition;
        if (viewName === from) {
            return { animation: `${direction === "forward" ? "slideOutLeft" : "slideOutRight"} 0.3s ease both`, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 };
        }
        if (viewName === to) {
            return { animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 0.3s ease both`, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 };
        }
        return null;
    };

    const ds = useMemo(() => getStyles(c), [c]);

    // ─── RENDER ───
    if (loading || !splashDone) {
        return (
            <div style={ds.splashScreen}>
                <style>{`
          @keyframes cupcakeBounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.1)} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
          @keyframes shimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
          @keyframes sprinkle1 { 0%,100%{opacity:0;transform:translate(0,0) rotate(0deg)} 50%{opacity:1;transform:translate(-30px,-40px) rotate(180deg)} }
          @keyframes sprinkle2 { 0%,100%{opacity:0;transform:translate(0,0) rotate(0deg)} 50%{opacity:1;transform:translate(30px,-35px) rotate(-180deg)} }
          @keyframes sprinkle3 { 0%,100%{opacity:0;transform:translate(0,0)} 50%{opacity:1;transform:translate(-15px,-50px)} }
        `}</style>
                <div style={{ position: "relative" }}>
                    <div style={{ fontSize: 72, animation: "cupcakeBounce 1.5s ease-in-out infinite", filter: "drop-shadow(0 8px 24px rgba(212,119,91,0.3))" }}>🧁</div>
                    <div style={{ position: "absolute", top: 0, left: "50%", fontSize: 20, animation: "sprinkle1 2s ease-in-out infinite" }}>✨</div>
                    <div style={{ position: "absolute", top: 0, left: "50%", fontSize: 16, animation: "sprinkle2 2s ease-in-out 0.3s infinite" }}>🌸</div>
                    <div style={{ position: "absolute", top: 0, left: "50%", fontSize: 14, animation: "sprinkle3 2s ease-in-out 0.6s infinite" }}>💫</div>
                </div>
                <h1 style={{ fontFamily: "'Georgia', serif", fontSize: 28, fontWeight: 700, color: c.text, margin: "20px 0 8px", animation: "fadeUp 0.8s ease 0.3s both" }}>My Little Bakery</h1>
                <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, color: c.textLight, animation: "fadeUp 0.8s ease 0.6s both", margin: 0 }}>Let's bake something wonderful</p>
                <div style={{ marginTop: 32, width: 120, height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${c.warm}, ${c.accent}, ${c.warm})`, backgroundSize: "400px 4px", animation: "shimmer 1.5s infinite linear, fadeUp 0.8s ease 0.9s both" }} />
            </div>
        );
    }

    return (
        <div style={ds.app}>
            <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideInRight { from{transform:translateX(100%);opacity:0.5} to{transform:translateX(0);opacity:1} }
        @keyframes slideOutLeft { from{transform:translateX(0);opacity:1} to{transform:translateX(-30%);opacity:0} }
        @keyframes slideInLeft { from{transform:translateX(-30%);opacity:0.5} to{transform:translateX(0);opacity:1} }
        @keyframes slideOutRight { from{transform:translateX(0);opacity:1} to{transform:translateX(100%);opacity:0} }
        @keyframes cardFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes heartBounce { 0%{transform:scale(1)} 40%{transform:scale(1.35)} 100%{transform:scale(1)} }
        @keyframes checkPop { 0%{transform:scale(1)} 50%{transform:scale(1.25)} 100%{transform:scale(1)} }
        @keyframes toastSlideDown { from{opacity:0;transform:translateX(-50%) translateY(-20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes fabPulse { 0%{transform:scale(1)} 50%{transform:scale(0.9)} 100%{transform:scale(1)} }
        @keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes bottomSheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes backdropFadeIn { from{opacity:0} to{opacity:1} }
        .fab-btn:active { transform: scale(0.88) !important; }
      `}</style>
            {/* Toast */}
            {toast && (
                <div style={ds.toast}>
                    <span>{toast}</span>
                    {toastAction && (<button onClick={toastAction.onPress} style={ds.toastActionBtn}>{toastAction.label}</button>)}
                </div>
            )}

            {/* Hidden PDF input */}
            <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfImport} style={{ display: "none" }} />
            <input ref={bakeLogPhotoInputRef} type="file" accept="image/*" multiple onChange={handleBakeLogPhotos} style={{ display: "none" }} />

            {/* PDF Import Loading Overlay */}
            {pdfImporting && (
                <div style={ds.pdfLoadingOverlay}>
                    <div style={ds.pdfLoadingCard}>
                        <div style={{ fontSize: 48, animation: "cupcakeBounce 1.5s ease-in-out infinite" }}>📄</div>
                        <div style={ds.pdfLoadingTitle}>Reading recipe...</div>
                        <div style={ds.pdfLoadingSubtitle}>Extracting ingredients & instructions</div>
                        <div style={{ width: 120, height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${c.warm}, ${c.accent}, ${c.warm})`, backgroundSize: "400px 4px", animation: "shimmer 1.5s infinite linear" }} />
                    </div>
                </div>
            )}

            {/* ─── HOME VIEW ─── */}
            {getViewAnim("home") !== null && (
                <div style={{ ...ds.screen, ...getViewAnim("home") }} ref={scrollRef}>
                    <div style={ds.homeHeader}>
                        <div>
                            <h1 style={ds.brandName}>My Little Bakery</h1>
                            <p style={ds.brandSub}>{recipes.length} recipes in your collection</p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button style={ds.iconBtn} onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Light mode" : "Dark mode"}>{darkMode ? Icons.sun({ size: 22 }) : Icons.moon({ size: 22 })}</button>
                            <button style={ds.iconBtn} onClick={() => openCalendarForDate()}>{Icons.calendar({ size: 22 })}</button>
                            <button style={ds.iconBtn} onClick={() => { setIngredientSearch(""); navigateTo("suggest", "forward"); }}>{Icons.suggest({ size: 22 })}</button>
                            <button style={ds.iconBtn} onClick={() => navigateTo("shopping", "forward")}>{Icons.cart({ size: 22 })}{shoppingList.length > 0 && <span style={ds.badge}>{shoppingList.length}</span>}</button>
                        </div>
                    </div>

                    {/* Search */}
                    <div style={ds.searchWrap}>
                        <span style={ds.searchIcon}>{Icons.search({ size: 18, color: c.textLight })}</span>
                        <input style={ds.searchInput} placeholder="Search recipes, ingredients, tags..." value={searchDisplay}
                            onChange={(e) => { const v = e.target.value; setSearchDisplay(v); if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); searchDebounceRef.current = setTimeout(() => setSearchQuery(v), 200); }} />
                        {searchDisplay && (<button style={ds.searchClear} onClick={() => { setSearchDisplay(""); setSearchQuery(""); }}>{Icons.x({ size: 16 })}</button>)}
                    </div>

                    <p style={{ fontSize: 11, color: c.textLight, fontFamily: "system-ui, sans-serif", margin: "0 0 4px 4px", opacity: 0.7 }}>Swipe cards: right to fave, left to delete</p>

                    {/* Category pills */}
                    <div style={ds.pillRow}>
                        <button style={{ ...ds.pill, ...(showFavoritesOnly ? ds.pillActive : {}) }} onClick={() => { haptic("light"); setShowFavoritesOnly(!showFavoritesOnly); }}>
                            {Icons.heart({ size: 14, filled: showFavoritesOnly, color: showFavoritesOnly ? "#fff" : "#e74c6f" })}<span style={{ marginLeft: 4 }}>Favorites</span>
                        </button>
                        {CATEGORIES.map((cat) => (<button key={cat} style={{ ...ds.pill, ...(activeCategory === cat ? ds.pillActive : {}) }} onClick={() => { haptic("light"); setActiveCategory(cat); }}>{cat}</button>))}
                    </div>

                    {/* Sort pills */}
                    <div style={{ ...ds.pillRow, paddingBottom: 8, gap: 6 }}>
                        {[{ key: "recent", label: "Recent" }, { key: "alpha", label: "A-Z" }, { key: "mostMade", label: "Most Made" }, { key: "lastMade", label: "Last Made" }].map((s) => (
                            <button key={s.key} style={{ ...ds.sortPill, ...(sortBy === s.key ? ds.sortPillActive : {}) }} onClick={() => { haptic("light"); setSortBy(s.key); }}>{s.label}</button>
                        ))}
                    </div>

                    {/* Recently viewed */}
                    {recentlyViewed.length > 0 && (
                        <div style={ds.recentRow}>
                            <span style={ds.recentLabel}>Recent</span>
                            {recentlyViewed.map((id) => {
                                const r = recipes.find((rec) => rec.id === id);
                                if (!r) return null;
                                return (
                                    <button key={id} style={ds.recentItem} onClick={() => openRecipeDetail(r)}>
                                        <div style={ds.recentAvatar}>
                                            {r.photo ? (<img loading="lazy" src={r.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />) : (<span style={{ fontSize: 20 }}>{EMOJI_MAP[r.category] || "🧁"}</span>)}
                                        </div>
                                        <span style={ds.recentName}>{r.name.split(" ")[0]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Recipe list */}
                    <div style={ds.recipeGrid}>
                        {filtered.length === 0 ? (
                            <div style={ds.emptyState}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                                <p style={{ color: c.textLight, fontSize: 15 }}>No recipes found</p>
                                <p style={{ color: c.textLight, fontSize: 13, marginTop: 4, opacity: 0.7 }}>Try a different search or category</p>
                            </div>
                        ) : (
                            filtered.map((recipe, i) => (
                                <SwipeCard key={recipe.id} recipe={recipe} onDelete={deleteRecipe} onToggleFavorite={(id) => { toggleFavorite(id); showToast(recipe.favorite ? "Removed from favorites" : "Added to favorites! ❤️"); }} longPressTimerRef={longPressTimerRef}>
                                    <button
                                        style={{ ...ds.recipeCard, ...(cardsAnimatedRef.current ? {} : { animation: `cardFadeIn 0.3s ease ${i * 0.05}s both` }) }}
                                        onPointerDown={() => { longPressTimerRef.current = setTimeout(() => openContextMenu(recipe), 500); }}
                                        onPointerUp={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                                        onPointerLeave={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                                        onPointerCancel={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                                        onClick={() => openRecipeDetail(recipe)}
                                    >
                                        {recipe.photo && (<div style={{ width: "100%", height: 160, borderRadius: 12, overflow: "hidden", marginBottom: 12, background: c.warm }}><img loading="lazy" src={recipe.photo} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>)}
                                        <div style={ds.cardTop}>
                                            <span style={ds.cardCategory}>{recipe.category}</span>
                                            <button style={{ ...ds.cardFavBtn, ...(bouncingHeartId === recipe.id ? { animation: "heartBounce 0.4s ease" } : {}) }} onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id); }}>
                                                {Icons.heart({ size: 18, filled: recipe.favorite })}
                                            </button>
                                        </div>
                                        <h3 style={ds.cardTitle}>{recipe.name}</h3>
                                        <div style={ds.cardMeta}>
                                            <span style={ds.cardMetaItem}>{Icons.clock({ size: 13 })} {(recipe.prepTime || 0) + (recipe.cookTime || 0)}m</span>
                                            <span style={ds.cardMetaItem}>{Icons.chef({ size: 13 })} {recipe.servings} servings</span>
                                        </div>
                                        {recipe.timesCooked > 0 && (<div style={ds.cardCooked}>Made {recipe.timesCooked}× · Last: {fmtDate(recipe.lastMade)}</div>)}
                                        {recipe.tags?.length > 0 && (<div style={ds.cardTags}>{recipe.tags.slice(0, 3).map((t) => (<span key={t} style={ds.cardTag}>#{t}</span>))}</div>)}
                                    </button>
                                </SwipeCard>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* FAB */}
            {view === "home" && !viewTransition && (
                <>
                    {fabExpanded && (<div style={ds.fabOverlay} onClick={() => setFabExpanded(false)} />)}
                    {fabExpanded && (
                        <div style={ds.fabMenu}>
                            <div style={ds.fabMenuRow}><span style={ds.fabMenuLabel}>Import PDF</span><button style={ds.fabMini} onClick={() => { setFabExpanded(false); pdfInputRef.current?.click(); }}>{Icons.upload({ size: 20, color: "#fff" })}</button></div>
                            <div style={ds.fabMenuRow}><span style={ds.fabMenuLabel}>New Recipe</span><button style={ds.fabMini} onClick={() => { setFabExpanded(false); setEditForm({ name: "", category: "Cookies", servings: 12, prepTime: 15, cookTime: 20, ingredients: [{ name: "", amount: 1, unit: "cups" }], instructions: "", tags: [], favorite: false, lastMade: null, notes: "", photo: null }); navigateTo("edit", "forward"); }}>{Icons.edit({ size: 18, color: "#fff" })}</button></div>
                        </div>
                    )}
                    <button className="fab-btn" style={{ ...ds.fab, transform: fabExpanded ? "rotate(45deg)" : "scale(1)", transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }} onClick={() => { haptic("light"); setFabExpanded((prev) => !prev); }}>
                        {Icons.plus({ size: 28, color: "#fff" })}
                    </button>
                </>
            )}

            {/* ─── DETAIL VIEW ─── */}
            {getViewAnim("detail") !== null && selectedRecipe && (
                <div style={{ ...ds.screen, ...getViewAnim("detail") }}>
                    <div style={ds.detailNav}>
                        <button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>{Icons.back({ size: 20 })} Back</button>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button style={ds.iconBtnSmall} onClick={() => { setEditForm({ ...selectedRecipe }); navigateTo("edit", "forward"); }}>{Icons.edit({ size: 18 })}</button>
                            <button style={ds.iconBtnSmall} onClick={() => deleteRecipe(selectedRecipe.id)}>{Icons.trash({ size: 18, color: "#c0392b" })}</button>
                        </div>
                    </div>
                    {selectedRecipe.photo && (<div style={{ width: "100%", height: 220, borderRadius: 16, overflow: "hidden", marginBottom: 16, background: c.warm }}><img src={selectedRecipe.photo} alt={selectedRecipe.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>)}
                    <div style={ds.detailHeader}>
                        <div style={ds.detailCategoryPill}>{selectedRecipe.category}</div>
                        <h1 style={ds.detailTitle}>{selectedRecipe.name}</h1>
                        <div style={ds.detailStats}>
                            <div style={ds.statBox}><div style={ds.statValue}>{selectedRecipe.prepTime || 0}m</div><div style={ds.statLabel}>Prep</div></div>
                            <div style={ds.statDivider} />
                            <div style={ds.statBox}><div style={ds.statValue}>{selectedRecipe.cookTime || 0}m</div><div style={ds.statLabel}>Cook</div></div>
                            <div style={ds.statDivider} />
                            <div style={ds.statBox}><div style={ds.statValue}>{Math.round(selectedRecipe.servings * scaleFactor)}</div><div style={ds.statLabel}>Servings</div></div>
                            <div style={ds.statDivider} />
                            <div style={ds.statBox}><div style={ds.statValue}>{selectedRecipe.timesCooked || 0}</div><div style={ds.statLabel}>Times Made</div></div>
                        </div>
                    </div>
                    <div style={ds.scaleSection}>
                        <div style={ds.scaleLabel}>{Icons.scale({ size: 16 })} Scale Recipe</div>
                        <div style={ds.scaleButtons}>{[0.5, 1, 1.5, 2, 3].map((s) => (<button key={s} style={{ ...ds.scaleBtn, ...(scaleFactor === s ? ds.scaleBtnActive : {}) }} onClick={() => { haptic("select"); setScaleFactor(s); }}>{s}×</button>))}</div>
                    </div>
                    <div style={ds.section}>
                        <div style={ds.sectionHeader}><h2 style={ds.sectionTitle}>Ingredients</h2><button style={ds.shopBtn} onClick={() => generateShoppingList(selectedRecipe, scaleFactor)}>{Icons.cart({ size: 15 })} Add to List</button></div>
                        <div style={ds.ingredientsList}>{selectedRecipe.ingredients?.map((ing, i) => (<div key={i} style={ds.ingredientRow}><span style={ds.ingredientAmount}>{+(ing.amount * scaleFactor).toFixed(2)} {ing.unit}</span><span style={ds.ingredientName}>{ing.name}</span></div>))}</div>
                    </div>
                    <div style={ds.section}>
                        <h2 style={ds.sectionTitle}>Instructions</h2>
                        <div style={ds.instructions}>{selectedRecipe.instructions?.split("\n").map((line, i) => (<p key={i} style={ds.instructionLine}>{line}</p>))}</div>
                    </div>
                    {selectedRecipe.notes && (<div style={ds.section}><h2 style={ds.sectionTitle}>Notes</h2><p style={ds.notesText}>{selectedRecipe.notes}</p></div>)}
                    {selectedRecipe.tags?.length > 0 && (<div style={{ ...ds.section, ...ds.tagsRow }}>{selectedRecipe.tags.map((t) => (<span key={t} style={ds.detailTag}>#{t}</span>))}</div>)}
                    <button style={ds.startCookingBtn} onClick={startCooking}>👩‍🍳 Start Cooking</button>
                    {selectedRecipe.cookTime > 0 && (<button style={{ ...ds.actionBtn, marginBottom: 12, width: "100%" }} onClick={() => addTimer(selectedRecipe.name, selectedRecipe.cookTime)}>{Icons.clock({ size: 16 })} Set {selectedRecipe.cookTime}m Timer</button>)}
                    <div style={ds.detailActions}>
                        <button style={{ ...ds.actionBtn, ...(bouncingHeartId === selectedRecipe.id ? { animation: "heartBounce 0.4s ease" } : {}) }} onClick={() => toggleFavorite(selectedRecipe.id)}>
                            {Icons.heart({ size: 18, filled: recipes.find((r) => r.id === selectedRecipe.id)?.favorite })}{recipes.find((r) => r.id === selectedRecipe.id)?.favorite ? "Unfavorite" : "Favorite"}
                        </button>
                        <button style={{ ...ds.actionBtn, ...ds.actionBtnPrimary }} onClick={() => markCooked(selectedRecipe.id, true)}>{Icons.check({ size: 18 })} Made It + Log</button>
                    </div>
                    <button style={{ ...ds.actionBtn, marginTop: 12, width: "100%" }} onClick={() => exportRecipePdf(selectedRecipe)}>📄 Share as PDF</button>
                    <div style={{ height: 40 }} />
                </div>
            )}

            {/* ─── EDIT VIEW ─── */}
            {getViewAnim("edit") !== null && editForm && (
                <div style={{ ...ds.screen, ...getViewAnim("edit") }}>
                    <div style={ds.detailNav}>
                        <button style={ds.backBtn} onClick={() => navigateTo(editForm.id ? "detail" : "home", "back")}>{Icons.x({ size: 20 })} Cancel</button>
                        <button style={ds.saveBtn} onClick={() => saveRecipe({ ...editForm, ingredients: editForm.ingredients?.map((ing) => ({ ...ing, amount: ing.amount === '' ? '' : +ing.amount || 0 })) })}>Save</button>
                    </div>
                    <h1 style={ds.editTitle}>{editForm.id ? "Edit Recipe" : "New Recipe"}</h1>
                    <div style={ds.formGroup}>
                        <label style={ds.formLabel}>Recipe Photo</label>
                        <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
                        {editForm.photo ? (
                            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 4 }}>
                                <img src={editForm.photo} alt="Recipe" style={{ width: "100%", height: 180, objectFit: "cover", display: "block", borderRadius: 14 }} />
                                <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 8 }}>
                                    <button style={{ ...ds.iconBtnSmall, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => photoInputRef.current?.click()}>{Icons.camera({ size: 18, color: "#fff" })}</button>
                                    <button style={{ ...ds.iconBtnSmall, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setEditForm({ ...editForm, photo: null })}>{Icons.x({ size: 18, color: "#fff" })}</button>
                                </div>
                            </div>
                        ) : (
                            <button style={{ width: "100%", padding: "28px 16px", borderRadius: 14, border: `2px dashed ${c.border}`, background: c.warm, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", color: c.textMid, fontFamily: "system-ui, sans-serif", fontSize: 14 }} onClick={() => photoInputRef.current?.click()}>
                                {Icons.camera({ size: 28, color: c.accent })}<span>Add a photo from camera or gallery</span>
                            </button>
                        )}
                    </div>
                    <div style={ds.formGroup}><label style={ds.formLabel}>Recipe Name</label><input style={ds.formInput} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g. Double Chocolate Muffins" /></div>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ ...ds.formGroup, flex: 1 }}><label style={ds.formLabel}>Category</label><select style={ds.formSelect} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>{CATEGORIES.filter((ct) => ct !== "All").map((ct) => (<option key={ct} value={ct}>{ct}</option>))}</select></div>
                        <div style={{ ...ds.formGroup, flex: 1 }}><label style={ds.formLabel}>Servings</label><input style={ds.formInput} type="text" inputMode="numeric" value={editForm.servings} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setEditForm({ ...editForm, servings: v === '' ? '' : +v }); }} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ ...ds.formGroup, flex: 1 }}><label style={ds.formLabel}>Prep (min)</label><input style={ds.formInput} type="text" inputMode="numeric" value={editForm.prepTime} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setEditForm({ ...editForm, prepTime: v === '' ? '' : +v }); }} /></div>
                        <div style={{ ...ds.formGroup, flex: 1 }}><label style={ds.formLabel}>Cook (min)</label><input style={ds.formInput} type="text" inputMode="numeric" value={editForm.cookTime} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setEditForm({ ...editForm, cookTime: v === '' ? '' : +v }); }} /></div>
                    </div>
                    <div style={ds.formGroup}>
                        <label style={ds.formLabel}>Ingredients</label>
                        {editForm.ingredients?.map((ing, i) => (
                            <div key={i} style={ds.ingEditRow}>
                                <input style={{ ...ds.formInput, width: 60, flexShrink: 0 }} type="text" inputMode="decimal" value={ing.amount} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./, '$1'); const ings = [...editForm.ingredients]; ings[i] = { ...ings[i], amount: v }; setEditForm({ ...editForm, ingredients: ings }); }} />
                                <select style={{ ...ds.formSelect, width: 80, flexShrink: 0 }} value={ing.unit} onChange={(e) => { const ings = [...editForm.ingredients]; ings[i] = { ...ings[i], unit: e.target.value }; setEditForm({ ...editForm, ingredients: ings }); }}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                                <input style={{ ...ds.formInput, flex: 1 }} value={ing.name} placeholder="Ingredient name" onChange={(e) => { const ings = [...editForm.ingredients]; ings[i] = { ...ings[i], name: e.target.value }; setEditForm({ ...editForm, ingredients: ings }); }} />
                                <button style={ds.ingRemoveBtn} onClick={() => { const ings = editForm.ingredients.filter((_, j) => j !== i); setEditForm({ ...editForm, ingredients: ings }); }}>{Icons.x({ size: 16, color: "#c0392b" })}</button>
                            </div>
                        ))}
                        <button style={ds.addIngBtn} onClick={() => setEditForm({ ...editForm, ingredients: [...(editForm.ingredients || []), { name: "", amount: 1, unit: "cups" }] })}>{Icons.plus({ size: 16 })} Add Ingredient</button>
                    </div>
                    <div style={ds.formGroup}><label style={ds.formLabel}>Instructions</label><textarea style={ds.formTextarea} rows={8} value={editForm.instructions} onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })} placeholder="Write each step on a new line..." /></div>
                    <div style={ds.formGroup}><label style={ds.formLabel}>Tags (comma separated)</label><input style={ds.formInput} value={editForm.tags?.join(", ") || ""} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="chocolate, cookies, dessert" /></div>
                    <div style={ds.formGroup}><label style={ds.formLabel}>Notes</label><textarea style={ds.formTextarea} rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Any personal notes or tips..." /></div>
                    <div style={{ height: 40 }} />
                </div>
            )}

            {/* ─── SHOPPING LIST VIEW ─── */}
            {getViewAnim("shopping") !== null && (
                <div style={{ ...ds.screen, ...getViewAnim("shopping") }}>
                    <div style={ds.detailNav}>
                        <button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>{Icons.back({ size: 20 })} Back</button>
                        {shoppingList.length > 0 && (<button style={{ ...ds.saveBtn, background: "#c0392b" }} onClick={() => { setShoppingList([]); setCheckedItems({}); }}>Clear All</button>)}
                    </div>
                    <h1 style={ds.editTitle}>🛒 Shopping List</h1>
                    {shoppingList.length === 0 ? (
                        <div style={ds.emptyState}><div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div><p style={{ color: c.textLight, fontSize: 15 }}>Your shopping list is empty</p><p style={{ color: c.textLight, fontSize: 13, marginTop: 4, opacity: 0.7 }}>Open a recipe and tap "Add to List"</p></div>
                    ) : (
                        <div style={ds.shoppingItems}>
                            {shoppingList.map((item, i) => (
                                <div key={i} style={{ ...ds.shoppingItem, ...(checkedItems[i] ? ds.shoppingItemChecked : {}) }} onClick={() => { haptic("select"); setPoppedCheck(i); setTimeout(() => setPoppedCheck(null), 300); setCheckedItems({ ...checkedItems, [i]: !checkedItems[i] }); }}>
                                    <div style={{ ...ds.checkbox, ...(checkedItems[i] ? ds.checkboxChecked : {}), ...(poppedCheck === i ? { animation: "checkPop 0.3s ease" } : {}) }}>{checkedItems[i] && Icons.check({ size: 14, color: "#fff" })}</div>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ ...ds.shoppingItemName, ...(checkedItems[i] ? { textDecoration: "line-through", opacity: 0.5 } : {}) }}>{item.amount} {item.unit} {item.name}</span>
                                        <span style={ds.shoppingItemRecipe}>from {item.recipe}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── CALENDAR VIEW ─── */}
            {getViewAnim("calendar") !== null && (
                <div style={{ ...ds.screen, ...getViewAnim("calendar") }}>
                    <div style={ds.detailNav}><button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>{Icons.back({ size: 20 })} Back</button></div>
                    <h1 style={ds.editTitle}>🗓️ Baking Calendar</h1>
                    <div style={ds.calendarMonthBar}>
                        <button style={ds.calendarMonthBtn} onClick={() => shiftCalendarMonth(-1)}>{Icons.back({ size: 18 })}</button>
                        <div style={ds.calendarMonthLabel}>{fmtMonth(calendarMonth)}</div>
                        <button style={ds.calendarMonthBtn} onClick={() => shiftCalendarMonth(1)}><div style={{ transform: "rotate(180deg)", display: "flex" }}>{Icons.back({ size: 18 })}</div></button>
                    </div>
                    <div style={ds.calendarWeekRow}>{WEEK_DAYS.map((day) => (<div key={day} style={ds.calendarWeekCell}>{day}</div>))}</div>
                    <div style={ds.calendarGrid}>
                        {calendarCells.map((dayString, i) => {
                            if (!dayString) return <div key={`empty-${i}`} style={ds.calendarEmptyCell} />;
                            const dayNum = parseInt(dayString.split("-")[2], 10);
                            const isToday = dayString === getTodayISO();
                            const isSelected = dayString === calendarDate;
                            const entryCount = bakeEntriesByDate[dayString] || 0;
                            return (<button key={dayString} style={{ ...ds.calendarDay, ...(isToday ? ds.calendarDayToday : {}), ...(isSelected ? ds.calendarDaySelected : {}) }} onClick={() => setCalendarDate(dayString)}><span>{dayNum}</span>{entryCount > 0 && <span style={ds.calendarDayCount}>{entryCount}</span>}</button>);
                        })}
                    </div>
                    <div style={ds.calendarSelectedDate}>What I baked on {fmtDate(calendarDate)}</div>
                    {selectedDateEntries.length === 0 ? (
                        <div style={{ ...ds.emptyState, paddingTop: 24, paddingBottom: 20 }}><div style={{ fontSize: 40, marginBottom: 8 }}>🧁</div><p style={{ color: c.textLight, fontSize: 14, margin: 0 }}>No bakes logged for this day yet</p></div>
                    ) : (
                        <div style={ds.calendarEntriesList}>
                            {selectedDateEntries.map((entry) => (
                                <div key={entry.id} style={ds.calendarEntryCard}>
                                    <div style={ds.calendarEntryTop}>
                                        <div><div style={ds.calendarEntryTitle}>{entry.recipeName}</div>{entry.createdAt && (<div style={ds.calendarEntryTime}>Logged {new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>)}</div>
                                        <button style={ds.calendarEntryDelete} onClick={() => deleteBakeLogEntry(entry.id)}>{Icons.trash({ size: 16, color: "#c0392b" })}</button>
                                    </div>
                                    {entry.notes && <p style={ds.calendarEntryNotes}>{entry.notes}</p>}
                                    {entry.photos?.length > 0 && (<div style={ds.calendarEntryPhotos}>{entry.photos.map((photo, idx) => (<img loading="lazy" key={`${entry.id}-${idx}`} src={photo} alt="" style={ds.calendarEntryPhoto} />))}</div>)}
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ ...ds.section, marginTop: 8 }}>
                        <h2 style={ds.sectionTitle}>Log a Bake for This Day</h2>
                        <div style={ds.formGroup}><label style={ds.formLabel}>Recipe</label><select style={ds.formSelect} value={bakeLogDraft.recipeId} onChange={(e) => setBakeLogDraft((prev) => ({ ...prev, recipeId: e.target.value }))}><option value="">Custom bake / not in recipes</option>{recipes.map((recipe) => (<option key={recipe.id} value={recipe.id}>{recipe.name}</option>))}</select></div>
                        <div style={ds.formGroup}><label style={ds.formLabel}>Notes</label><textarea style={ds.formTextarea} rows={3} value={bakeLogDraft.notes} onChange={(e) => setBakeLogDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="What did I bake today? How did it turn out?" /></div>
                        <div style={ds.formGroup}>
                            <button style={ds.addBakePhotoBtn} onClick={() => bakeLogPhotoInputRef.current?.click()}>{Icons.camera({ size: 18, color: c.accent })} Upload Bake Photos</button>
                            {bakeLogDraft.photos.length > 0 && (<div style={ds.bakePhotoPreviewRow}>{bakeLogDraft.photos.map((photo, idx) => (<div key={`draft-photo-${idx}`} style={ds.bakePhotoPreviewWrap}><img src={photo} alt="" style={ds.bakePhotoPreview} /><button style={ds.bakePhotoRemoveBtn} onClick={() => setBakeLogDraft((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}>{Icons.x({ size: 14, color: "#fff" })}</button></div>))}</div>)}
                        </div>
                        <button style={{ ...ds.actionBtn, ...ds.actionBtnPrimary, width: "100%" }} onClick={saveBakeLogEntry}>{Icons.check({ size: 18 })} Save Day Entry</button>
                    </div>
                </div>
            )}

            {/* ─── SUGGEST VIEW ─── */}
            {getViewAnim("suggest") !== null && (
                <div style={{ ...ds.screen, ...getViewAnim("suggest") }}>
                    <div style={ds.detailNav}><button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>{Icons.back({ size: 20 })} Back</button></div>
                    <h1 style={ds.editTitle}>🔮 What Can I Bake?</h1>
                    <p style={{ color: c.textLight, fontSize: 14, marginBottom: 16, padding: "0 4px" }}>Enter ingredients you have on hand, separated by commas</p>
                    <div style={ds.formGroup}><input style={ds.formInput} value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} placeholder="e.g. butter, flour, eggs, chocolate" /></div>
                    {ingredientSearch && suggestedRecipes.length === 0 && (<div style={ds.emptyState}><div style={{ fontSize: 48, marginBottom: 12 }}>🤔</div><p style={{ color: c.textLight, fontSize: 15 }}>No matching recipes found</p><p style={{ color: c.textLight, fontSize: 13, marginTop: 4, opacity: 0.7 }}>Try different ingredients</p></div>)}
                    {suggestedRecipes.map((recipe) => (<button key={recipe.id} style={ds.suggestCard} onClick={() => openRecipeDetail(recipe)}><div style={ds.suggestTop}><h3 style={ds.suggestName}>{recipe.name}</h3><div style={ds.matchBadge}>{recipe.matchPercent}% match</div></div><p style={ds.suggestMeta}>{recipe.matchCount} of {recipe.ingredients.length} ingredients · {recipe.category}</p></button>))}
                </div>
            )}

            {/* ─── COOKING MODE VIEW ─── */}
            {getViewAnim("cooking") !== null && cookingSteps.length > 0 && (
                <div style={{ ...ds.cookingScreen, ...getViewAnim("cooking") }} ref={cookingSwipe.elRef} onTouchStart={cookingSwipe.onTouchStart} onTouchMove={cookingSwipe.onTouchMove} onTouchEnd={cookingSwipe.onTouchEnd}>
                    <div style={ds.cookingTopBar}><button style={{ ...ds.backBtn, color: c.textLight }} onClick={exitCooking}>{Icons.x({ size: 20 })} Close</button><span style={ds.cookingStepCount}>Step {currentStep + 1} of {cookingSteps.length}</span></div>
                    <div style={ds.cookingRecipeName}>{selectedRecipe?.name}</div>
                    <div style={ds.cookingProgress}>{cookingSteps.map((_, i) => (<div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= currentStep ? c.accent : c.border, transition: "background 0.3s" }} />))}</div>
                    <div style={ds.cookingStepContent}>
                        <div style={ds.cookingStepNumber}>Step {currentStep + 1}</div>
                        <p style={ds.cookingStepText}>{cookingSteps[currentStep]}</p>
                        {(() => { const match = cookingSteps[currentStep]?.match(/(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)/i); if (match) { return (<button style={ds.cookingTimerBtn} onClick={() => addTimer(`Step ${currentStep + 1}`, parseInt(match[1]))}>{Icons.clock({ size: 16 })} Set {match[1]}m Timer</button>); } return null; })()}
                    </div>
                    <div style={ds.cookingNav}>
                        <button style={{ ...ds.cookingNavBtn, opacity: currentStep === 0 ? 0.3 : 1 }} disabled={currentStep === 0} onClick={() => { haptic("select"); setCurrentStep((s) => Math.max(0, s - 1)); }}>{Icons.back({ size: 20 })} Previous</button>
                        {currentStep < cookingSteps.length - 1 ? (<button style={{ ...ds.cookingNavBtn, ...ds.cookingNavBtnPrimary }} onClick={() => { haptic("select"); setCurrentStep((s) => s + 1); }}>Next →</button>) : (<button style={{ ...ds.cookingNavBtn, ...ds.cookingNavBtnPrimary, background: "#27ae60" }} onClick={finishCooking}>{Icons.check({ size: 18 })} Done!</button>)}
                    </div>
                    <p style={{ textAlign: "center", fontSize: 11, color: c.textLight, marginTop: 8, fontFamily: "system-ui, sans-serif" }}>Swipe left/right to navigate</p>
                </div>
            )}

            {/* ─── FLOATING TIMER PILL ─── */}
            {timers.length > 0 && (
                <div style={ds.timerPillContainer}>
                    {timers.map((t) => (
                        <div key={t.id} style={{ ...ds.timerPill, ...(t.remainingSeconds === 0 ? { animation: "timerPulse 1s infinite" } : {}) }}>
                            <span style={ds.timerPillLabel}>{t.label}</span>
                            <span style={ds.timerPillTime}>{t.active ? fmtTimer(t.remainingSeconds) : (t.remainingSeconds === 0 ? "Done!" : "Paused")}</span>
                            <button style={ds.timerPillBtn} onClick={() => toggleTimer(t.id)}>{t.active ? "⏸" : (t.remainingSeconds > 0 ? "▶" : "")}</button>
                            <button style={ds.timerPillBtn} onClick={() => removeTimer(t.id)}>✕</button>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── BOTTOM SHEET CONTEXT MENU ─── */}
            {contextMenu && (
                <>
                    <div style={ds.bottomSheetBackdrop} onClick={closeContextMenu} />
                    <div style={ds.bottomSheet}>
                        <div style={ds.bottomSheetHandle} />
                        <div style={ds.bottomSheetTitle}>{contextMenu.name}</div>
                        {[
                            { icon: Icons.heart({ size: 18, filled: contextMenu.favorite }), label: contextMenu.favorite ? "Unfavorite" : "Favorite", action: () => { toggleFavorite(contextMenu.id); closeContextMenu(); } },
                            { icon: Icons.cart({ size: 18 }), label: "Add to Shopping List", action: () => { generateShoppingList(contextMenu, 1); closeContextMenu(); } },
                            { icon: "📋", label: "Duplicate Recipe", action: () => duplicateRecipe(contextMenu) },
                            { icon: "📄", label: "Share as PDF", action: () => exportRecipePdf(contextMenu) },
                            { icon: Icons.trash({ size: 18, color: "#c0392b" }), label: "Delete", action: () => { deleteRecipe(contextMenu.id); closeContextMenu(); }, danger: true },
                        ].map((item, i) => (
                            <button key={i} style={{ ...ds.bottomSheetAction, ...(item.danger ? { color: "#c0392b" } : {}) }} onClick={item.action}>
                                <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>{item.icon}</span>{item.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
