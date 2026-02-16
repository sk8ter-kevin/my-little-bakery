import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Storage helpers ───
const STORAGE_KEY = "zions-recipes-v2";

const loadData = async () => {
  try {
    if (window.storage?.get) {
      const result = await window.storage.get(STORAGE_KEY);
      return result ? JSON.parse(result.value) : null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveData = async (data) => {
  try {
    const json = JSON.stringify(data);
    if (window.storage?.set) {
      await window.storage.set(STORAGE_KEY, json);
    } else {
      localStorage.setItem(STORAGE_KEY, json);
    }
  } catch (e) {
    console.error("Save failed:", e);
  }
};

// ─── Sample recipes to start with ───
const SAMPLE_RECIPES = [
  {
    id: "1",
    name: "Classic Chocolate Chip Cookies",
    category: "Cookies",
    servings: 24,
    prepTime: 15,
    cookTime: 12,
    ingredients: [
      { name: "all-purpose flour", amount: 2.25, unit: "cups" },
      { name: "butter, softened", amount: 1, unit: "cup" },
      { name: "granulated sugar", amount: 0.75, unit: "cup" },
      { name: "brown sugar, packed", amount: 0.75, unit: "cup" },
      { name: "eggs", amount: 2, unit: "large" },
      { name: "vanilla extract", amount: 1, unit: "tsp" },
      { name: "baking soda", amount: 1, unit: "tsp" },
      { name: "salt", amount: 1, unit: "tsp" },
      { name: "dark chocolate chips", amount: 2, unit: "cups" },
    ],
    instructions: "1. Preheat oven to 375°F.\n2. Combine flour, baking soda and salt in a small bowl.\n3. Beat butter, granulated sugar, brown sugar and vanilla extract in a large mixer bowl until creamy.\n4. Add eggs one at a time, beating well after each addition.\n5. Gradually beat in flour mixture.\n6. Stir in chocolate chips.\n7. Drop rounded tablespoon of dough onto ungreased baking sheets.\n8. Bake for 9 to 11 minutes or until golden brown.\n9. Cool on baking sheets for 2 minutes; remove to wire racks to cool completely.",
    tags: ["cookies", "chocolate", "classic", "dessert"],
    favorite: true,
    lastMade: "2025-01-15",
    timesCooked: 8,
    notes: "Kevin's favorite! Use dark chocolate chips for extra richness 🍫",
    createdAt: "2024-06-01",
  },
  {
    id: "2",
    name: "Lemon Blueberry Scones",
    category: "Breakfast",
    servings: 8,
    prepTime: 20,
    cookTime: 18,
    ingredients: [
      { name: "all-purpose flour", amount: 2, unit: "cups" },
      { name: "sugar", amount: 0.33, unit: "cup" },
      { name: "baking powder", amount: 1, unit: "tbsp" },
      { name: "salt", amount: 0.5, unit: "tsp" },
      { name: "cold butter, cubed", amount: 0.33, unit: "cup" },
      { name: "heavy cream", amount: 0.75, unit: "cup" },
      { name: "egg", amount: 1, unit: "large" },
      { name: "lemon zest", amount: 2, unit: "tsp" },
      { name: "fresh blueberries", amount: 1, unit: "cup" },
    ],
    instructions: "1. Preheat oven to 400°F. Line a baking sheet with parchment paper.\n2. Whisk together flour, sugar, baking powder, and salt.\n3. Cut in cold butter until mixture resembles coarse crumbs.\n4. In a separate bowl, whisk together cream, egg, and lemon zest.\n5. Pour wet ingredients into dry and stir until just combined.\n6. Gently fold in blueberries.\n7. Turn dough out onto a floured surface and pat into an 8-inch circle.\n8. Cut into 8 wedges and place on prepared baking sheet.\n9. Bake for 16-18 minutes until golden.",
    tags: ["breakfast", "scones", "lemon", "blueberry", "brunch"],
    favorite: false,
    lastMade: "2025-02-01",
    timesCooked: 3,
    notes: "Great for Sunday brunch!",
    createdAt: "2024-09-15",
  },
  {
    id: "3",
    name: "Salted Caramel Brownies",
    category: "Brownies & Bars",
    servings: 16,
    prepTime: 25,
    cookTime: 30,
    ingredients: [
      { name: "dark chocolate", amount: 8, unit: "oz" },
      { name: "butter", amount: 0.75, unit: "cup" },
      { name: "sugar", amount: 1.5, unit: "cups" },
      { name: "eggs", amount: 3, unit: "large" },
      { name: "vanilla extract", amount: 1, unit: "tsp" },
      { name: "all-purpose flour", amount: 1, unit: "cup" },
      { name: "cocoa powder", amount: 0.25, unit: "cup" },
      { name: "salt", amount: 0.5, unit: "tsp" },
      { name: "caramel sauce", amount: 0.5, unit: "cup" },
      { name: "flaky sea salt", amount: 1, unit: "tsp" },
    ],
    instructions: "1. Preheat oven to 350°F. Line a 9x9 pan with parchment paper.\n2. Melt chocolate and butter together, stirring until smooth.\n3. Whisk in sugar, then eggs one at a time, then vanilla.\n4. Fold in flour, cocoa powder, and salt until just combined.\n5. Pour half the batter into the prepared pan.\n6. Drizzle caramel sauce over the batter.\n7. Top with remaining batter and swirl with a knife.\n8. Bake for 28-30 minutes.\n9. Sprinkle with flaky sea salt while still warm.\n10. Cool completely before cutting.",
    tags: ["brownies", "chocolate", "caramel", "dessert"],
    favorite: true,
    lastMade: null,
    timesCooked: 0,
    notes: "",
    createdAt: "2025-01-20",
  },
];

const CATEGORIES = [
  "All",
  "Cookies",
  "Cakes",
  "Breakfast",
  "Bread",
  "Brownies & Bars",
  "Pies & Tarts",
  "Pastries",
  "Other",
];

const UNITS = ["cups", "tbsp", "tsp", "oz", "lb", "g", "ml", "large", "medium", "small", "whole", "pinch", "dash"];

// ─── Utility: generate unique IDs ───
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const getTodayISO = () => new Date().toISOString().split("T")[0];
const getMonthISO = (dateString = getTodayISO()) => dateString.slice(0, 7);
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Photo helpers ───
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const compressImage = (dataUrl, maxWidth = 800) =>
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
const haptic = (type) => {
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

// ─── PDF text extraction ───
const extractTextFromPdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    pages.push(strings.join(" "));
  }
  return pages.join("\n\n");
};

// ─── Recipe text parser ───
const UNIT_MAP = {
  cup: "cups", cups: "cups", c: "cups",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbs: "tbsp", tb: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp", ts: "tsp",
  ounce: "oz", ounces: "oz", oz: "oz",
  pound: "lb", pounds: "lb", lb: "lb", lbs: "lb",
  gram: "g", grams: "g", g: "g",
  kilogram: "kg", kilograms: "kg", kg: "kg",
  milliliter: "ml", milliliters: "ml", ml: "ml",
  liter: "L", liters: "L", l: "L",
  piece: "pcs", pieces: "pcs", pcs: "pcs",
  pinch: "pinch", pinches: "pinch",
  whole: "whole",
  slice: "slices", slices: "slices",
  clove: "cloves", cloves: "cloves",
  can: "cans", cans: "cans",
  bag: "bags", bags: "bags",
  stick: "sticks", sticks: "sticks",
  bunch: "bunch", bunches: "bunch",
  large: "large", medium: "medium", small: "small",
  dash: "dash", dashes: "dash",
};

const UNICODE_FRACTIONS = { "\u00BD": 0.5, "\u2153": 0.333, "\u2154": 0.667, "\u00BC": 0.25, "\u00BE": 0.75, "\u215B": 0.125, "\u215C": 0.375, "\u215D": 0.625, "\u215E": 0.875 };

const parseFraction = (str) => {
  let s = str.trim();
  for (const [ch, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(ch)) {
      const before = s.replace(ch, "").trim();
      return before ? parseFloat(before) + val : val;
    }
  }
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const num = parseFloat(s);
  return isNaN(num) ? 1 : num;
};

const parseIngredientLine = (line) => {
  let l = line.replace(/^[\s\u2022\u2023\u25E6\u2043\u2219\-\*\u2013\u2014\u25CF\u25CB\u00B7\u203A\u2192]+\s*/, "").trim();
  if (!l) return null;
  const ingredientRegex = /^([\d\s\/\u00BC-\u00BE\u2150-\u215E.]+)?\s*(cups?|tablespoons?|tbsp?|tbs?|teaspoons?|tsp?|ts|ounces?|oz|pounds?|lbs?|lb|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|pieces?|pcs|pinch(?:es)?|whole|slices?|cloves?|cans?|bags?|sticks?|bunch(?:es)?|large|medium|small|dash(?:es)?|c\b)\.?\s+(.+)/i;
  const match = l.match(ingredientRegex);
  if (match) {
    const amount = match[1] ? parseFraction(match[1]) : 1;
    const rawUnit = (match[2] || "").toLowerCase().replace(/\.$/, "");
    const unit = UNIT_MAP[rawUnit] || "whole";
    const name = (match[3] || l).replace(/,\s*$/, "").trim();
    return { amount: Math.round(amount * 1000) / 1000, unit, name };
  }
  // Try: line starts with number but no recognized unit
  const numStart = l.match(/^([\d\s\/\u00BC-\u00BE\u2150-\u215E.]+)\s+(.+)/);
  if (numStart) {
    return { amount: Math.round(parseFraction(numStart[1]) * 1000) / 1000, unit: "whole", name: numStart[2].replace(/,\s*$/, "").trim() };
  }
  return { amount: 1, unit: "whole", name: l };
};

const parseRecipeText = (rawText) => {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/ {2,}/g, " ").trim();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── Recipe name: first non-junk line ──
  let name = "";
  for (const line of lines) {
    const low = line.toLowerCase();
    if (low.startsWith("http") || low.startsWith("www.")) continue;
    if (/^(print|skip to|jump to|home|menu|search|log ?in|sign ?up|advertisement)/i.test(low)) continue;
    if (line.length > 3 && line.length < 120) {
      name = line.replace(/\s*recipe\s*$/i, "").trim();
      break;
    }
  }

  // ── Section detection ──
  const sectionPatterns = {
    ingredients: /^(ingredients|what you.?ll need|you.?ll need|shopping list)\s*:?\s*$/i,
    instructions: /^(instructions|directions|method|steps|preparation|how to make|procedure)\s*:?\s*$/i,
    notes: /^(notes|tips|chef.?s? notes?|cook.?s? notes?|variations?)\s*:?\s*$/i,
  };

  const sections = { ingredients: [], instructions: [], notes: [] };
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(line)) { currentSection = section; matched = true; break; }
    }
    if (matched) continue;
    // Detect inline headers like "Ingredients: 2 cups flour"
    if (!currentSection) {
      for (const [section] of Object.entries(sectionPatterns)) {
        const inlineRe = new RegExp(`^(ingredients|instructions|directions|method|steps|notes|tips)\\s*:\\s*(.+)`, "i");
        const m = line.match(inlineRe);
        if (m) {
          const sec = /ingredient/i.test(m[1]) ? "ingredients" : /note|tip/i.test(m[1]) ? "notes" : "instructions";
          currentSection = sec;
          if (m[2].trim()) sections[sec].push(m[2].trim());
          matched = true; break;
        }
      }
      if (matched) continue;
    }
    if (currentSection) sections[currentSection].push(line);
  }

  // ── Parse ingredients ──
  let ingredients = sections.ingredients
    .filter((l) => l.length > 1)
    .map(parseIngredientLine)
    .filter(Boolean);

  // ── Parse instructions ──
  let instructions = sections.instructions
    .filter((l) => l.length > 3)
    .map((l, i) => `${i + 1}. ${l.replace(/^\d+[\.\)]\s*/, "").trim()}`)
    .join("\n");

  // ── Fallback heuristics when no headers found ──
  if (ingredients.length === 0 && !instructions) {
    const ingLines = [];
    const instrLines = [];
    for (const line of lines) {
      if (/^[\d\u00BC-\u00BE\u2150-\u215E]/.test(line) && line.length < 80) {
        ingLines.push(line);
      } else if (
        /^\d+\.\s/.test(line) ||
        (line.length > 40 && /\b(mix|stir|bake|cook|heat|add|pour|fold|whisk|combine|preheat|beat|cream|roll|spread|set|let|remove|cool|place|transfer|melt|knead|simmer|boil|fry|saut[eé]|blend|chop|dice|slice|grate|brush|grease|line|sift|drain|cover|chill|refrigerate|freeze)\b/i.test(line))
      ) {
        instrLines.push(line);
      }
    }
    if (ingLines.length > 0) ingredients = ingLines.map(parseIngredientLine).filter(Boolean);
    if (instrLines.length > 0) {
      instructions = instrLines
        .map((l, i) => `${i + 1}. ${l.replace(/^\d+[\.\)]\s*/, "").trim()}`)
        .join("\n");
    }
  }

  // ── Metadata ──
  const servingsMatch = text.match(/(?:serves?|servings?|yield|makes?)\s*:?\s*(\d+)/i);
  const servings = servingsMatch ? parseInt(servingsMatch[1]) : 12;
  const prepMatch = text.match(/prep(?:aration)?\s*(?:time)?\s*:?\s*(\d+)\s*(?:min|m\b)/i);
  const prepTime = prepMatch ? parseInt(prepMatch[1]) : 15;
  const cookMatch = text.match(/(?:cook(?:ing)?|bak(?:e|ing))\s*(?:time)?\s*:?\s*(\d+)\s*(?:min|m\b)/i);
  const cookTime = cookMatch ? parseInt(cookMatch[1]) : 20;
  // Also try "Total Time: X hours Y min" patterns for cookTime fallback
  const totalMatch = text.match(/total\s*(?:time)?\s*:?\s*(?:(\d+)\s*h(?:ours?)?)?[\s,]*(\d+)\s*(?:min|m\b)/i);
  const finalCookTime = cookMatch ? parseInt(cookMatch[1]) : totalMatch ? (parseInt(totalMatch[1] || 0) * 60 + parseInt(totalMatch[2])) : 20;

  // ── Category guessing ──
  const combined = (name + " " + ingredients.map((i) => i.name).join(" ")).toLowerCase();
  let category = "Other";
  if (/cookie|biscuit/.test(combined)) category = "Cookies";
  else if (/cake|cupcake|bundt/.test(combined)) category = "Cakes";
  else if (/bread|loaf|roll|bun|sourdough|yeast/.test(combined)) category = "Bread";
  else if (/brownie|blondie|bar/.test(combined)) category = "Brownies & Bars";
  else if (/pie|tart|galette|crust/.test(combined)) category = "Pies & Tarts";
  else if (/pastry|croissant|puff|danish|eclair|choux/.test(combined)) category = "Pastries";
  else if (/pancake|waffle|scone|muffin|breakfast|brunch|granola|oatmeal/.test(combined)) category = "Breakfast";

  // ── Auto-tags ──
  const tags = new Set();
  tags.add(category.toLowerCase().replace(/ & /g, "-"));
  const tagKeywords = ["chocolate", "vanilla", "lemon", "blueberry", "strawberry", "apple", "banana", "cinnamon", "peanut butter", "cream cheese", "pumpkin", "caramel", "coconut", "honey", "oat", "almond", "pecan", "walnut", "raspberry", "cherry", "ginger", "maple", "nutella"];
  const nameLow = name.toLowerCase();
  for (const kw of tagKeywords) {
    if (nameLow.includes(kw) || ingredients.some((ig) => ig.name.toLowerCase().includes(kw))) tags.add(kw);
  }

  return {
    name: name || "Imported Recipe",
    category,
    servings,
    prepTime,
    cookTime: finalCookTime,
    ingredients: ingredients.length > 0 ? ingredients : [{ name: "", amount: 1, unit: "cups" }],
    instructions: instructions || "",
    tags: [...tags].slice(0, 6),
    favorite: false,
    lastMade: null,
    notes: sections.notes.join("\n") || "",
    photo: null,
  };
};

// ─── Dark mode color schemes ───
const lightColors = {
  bg: "#faf6f1",
  card: "#fff",
  accent: "#d4775b",
  accentDark: "#b8604a",
  text: "#3d3225",
  textMid: "#6b5e4f",
  textLight: "#a0927b",
  border: "#e8dfd5",
  warm: "#f5ede4",
  warmDark: "#eadccf",
};

const darkColors = {
  bg: "#1a1512",
  card: "#2a2320",
  accent: "#e08b6d",
  accentDark: "#d4775b",
  text: "#f0e8df",
  textMid: "#c4b8a8",
  textLight: "#8a7e6e",
  border: "#3d3530",
  warm: "#2f2822",
  warmDark: "#3a322b",
};

// ─── Swipe hook ───
const useSwipe = (onSwipeLeft, onSwipeRight, threshold = 80) => {
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

// ─── Icons as inline SVG components ───
const Icon = ({ d, size = 20, color = "currentColor", children, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {d && <path d={d} />}
    {children}
  </svg>
);

const Icons = {
  search: (p) => <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" {...p} />,
  plus: (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>,
  heart: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill={p?.filled ? p?.color || "#e74c6f" : "none"} stroke={p?.color || "#e74c6f"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  back: (p) => <Icon d="M19 12H5m7-7l-7 7 7 7" {...p} />,
  edit: (p) => <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" {...p}><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></Icon>,
  trash: (p) => <Icon d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" {...p} />,
  clock: (p) => <Icon d="M12 2a10 10 0 100 20 10 10 0 000-20z" {...p}><path d="M12 6v6l4 2" /></Icon>,
  list: (p) => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />,
  scale: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  ),
  chef: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6V13.87Z" />
      <line x1="6" y1="17" x2="18" y2="17" />
    </svg>
  ),
  cart: (p) => <Icon d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" {...p}><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></Icon>,
  calendar: (p) => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" {...p} />,
  check: (p) => <Icon d="M20 6L9 17l-5-5" {...p} />,
  x: (p) => <Icon d="M18 6L6 18M6 6l12 12" {...p} />,
  filter: (p) => <Icon d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" {...p} />,
  star: (p) => (
    <svg width={p?.size || 16} height={p?.size || 16} viewBox="0 0 24 24" fill={p?.filled ? "#f6b93b" : "none"} stroke="#f6b93b" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  suggest: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  camera: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  sun: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  moon: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  upload: (p) => (
    <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
};

// ─── Main App ───
export default function RecipeOrganizer() {
  const [recipes, setRecipes] = useState([]);
  const [view, setView] = useState("home"); // home, detail, edit, shopping, suggest, calendar, cooking
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
  const [viewTransition, setViewTransition] = useState(null); // { from, to, direction }
  const [bouncingHeartId, setBouncingHeartId] = useState(null);

  const [poppedCheck, setPoppedCheck] = useState(null);
  // Feature 4: Cooking mode
  const [cookingSteps, setCookingSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const wakeLockRef = useRef(null);
  // Feature 5: Timers
  const [timers, setTimers] = useState([]);
  // Feature 6: Context menu
  const [contextMenu, setContextMenu] = useState(null);
  const longPressTimerRef = useRef(null);
  // Feature 7: Sort + recently viewed
  const [sortBy, setSortBy] = useState("recent");
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  // PDF import
  const [fabExpanded, setFabExpanded] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const pdfInputRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const photoInputRef = useRef(null);
  const bakeLogPhotoInputRef = useRef(null);
  const scrollRef = useRef(null);
  const cardsAnimatedRef = useRef(false);

  // Themed colors
  const c = useMemo(() => (darkMode ? darkColors : lightColors), [darkMode]);

  // Load data + dark mode pref
  useEffect(() => {
    (async () => {
      const data = await loadData();
      if (data?.recipes?.length) {
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

  // Mark card animations as done after initial stagger, reset when leaving home
  useEffect(() => {
    if (view === "home") {
      const t = setTimeout(() => { cardsAnimatedRef.current = true; }, 600);
      return () => clearTimeout(t);
    } else {
      cardsAnimatedRef.current = false;
    }
  }, [view]);

  // Save on change (debounced to avoid blocking the UI)
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

  // ─── Feature 4: Cooking mode helpers ───
  const startCooking = () => {
    const steps = selectedRecipe.instructions
      .split("\n")
      .filter(Boolean)
      .map((s) => s.replace(/^\d+\.\s*/, ""));
    setCookingSteps(steps);
    setCurrentStep(0);
    navigateTo("cooking", "forward");
    // Keep screen awake
    if (navigator.wakeLock) {
      navigator.wakeLock.request("screen").then((l) => { wakeLockRef.current = l; }).catch(() => {});
    }
  };

  const exitCooking = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    navigateTo("detail", "back");
  };

  const finishCooking = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    markCooked(selectedRecipe.id, true);
  };

  const cookingSwipe = useSwipe(
    () => { if (currentStep < cookingSteps.length - 1) { haptic("select"); setCurrentStep((s) => s + 1); } },
    () => { if (currentStep > 0) { haptic("select"); setCurrentStep((s) => s - 1); } },
    60
  );

  // ─── Feature 5: Timer logic ───
  useEffect(() => {
    if (timers.length === 0 || !timers.some((t) => t.active)) return;
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
  }, [timers.length, timers.some((t) => t.active)]);

  const addTimer = (label, minutes) => {
    haptic("medium");
    setTimers((prev) => [...prev, { id: uid(), label, totalSeconds: minutes * 60, remainingSeconds: minutes * 60, active: true }]);
    showToast(`Timer set: ${minutes}m ⏰`);
  };

  const removeTimer = (id) => { setTimers((prev) => prev.filter((t) => t.id !== id)); };
  const toggleTimer = (id) => { setTimers((prev) => prev.map((t) => t.id === id ? { ...t, active: !t.active } : t)); };

  const fmtTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ─── Feature 6: Long-press helpers ───
  const openContextMenu = (recipe) => { haptic("medium"); setContextMenu(recipe); };
  const closeContextMenu = () => setContextMenu(null);

  const duplicateRecipe = (recipe) => {
    const copy = { ...recipe, id: uid(), name: recipe.name + " (Copy)", timesCooked: 0, lastMade: null, createdAt: new Date().toISOString().split("T")[0] };
    setRecipes((prev) => [copy, ...prev]);
    haptic("success");
    showToast("Recipe duplicated! 📋");
    closeContextMenu();
  };

  // ─── Feature 7: Recently viewed tracking ───
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
    } catch {
      showToast("Couldn't load photo");
    }
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
    } catch {
      showToast("Couldn't load one or more photos");
    }
    e.target.value = "";
  };

  // ─── PDF import handler ───
  const handlePdfImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      showToast("Please select a PDF file");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("PDF is too large (max 10MB)");
      e.target.value = "";
      return;
    }
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

  // ─── Filtered + sorted recipes ───
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
    // Sort
    if (sortBy === "alpha") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "mostMade") result = [...result].sort((a, b) => (b.timesCooked || 0) - (a.timesCooked || 0));
    else if (sortBy === "lastMade") result = [...result].sort((a, b) => (b.lastMade || "").localeCompare(a.lastMade || ""));
    return result;
  }, [recipes, showFavoritesOnly, activeCategory, searchQuery, sortBy]);

  const bakeEntriesByDate = useMemo(() => (
    bakeLogEntries.reduce((acc, entry) => {
      acc[entry.date] = (acc[entry.date] || 0) + 1;
      return acc;
    }, {})
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

  // ─── Suggest recipes based on ingredients ───
  const suggestedRecipes = useMemo(() => ingredientSearch
    ? recipes
        .map((r) => {
          const searchTerms = ingredientSearch.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
          const matchCount = r.ingredients.filter((ing) =>
            searchTerms.some((term) => ing.name.toLowerCase().includes(term))
          ).length;
          return { ...r, matchCount, matchPercent: Math.round((matchCount / r.ingredients.length) * 100) };
        })
        .filter((r) => r.matchCount > 0)
        .sort((a, b) => b.matchPercent - a.matchPercent)
    : [], [ingredientSearch, recipes]);

  // ─── Shopping list generation ───
  const generateShoppingList = (recipe, scale = 1) => {
    const items = recipe.ingredients.map((ing) => ({
      name: ing.name,
      amount: +(ing.amount * scale).toFixed(2),
      unit: ing.unit,
      recipe: recipe.name,
      checked: false,
    }));
    setShoppingList((prev) => [...prev, ...items]);
    haptic("medium");
    navigateTo("shopping", "forward");
    showToast("Added to shopping list! 🛒");
  };

  // ─── Toggle favorite ───
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
      showToast("Choose what was baked or add a note/photo first");
      return;
    }
    const newEntry = {
      id: uid(),
      date: calendarDate,
      recipeId: selectedRecipeForLog?.id || null,
      recipeName: selectedRecipeForLog?.name || "Custom Bake",
      notes: bakeLogDraft.notes.trim(),
      photos: bakeLogDraft.photos,
      createdAt: new Date().toISOString(),
    };
    setBakeLogEntries((prev) => [newEntry, ...prev]);
    setBakeLogDraft({ recipeId: "", notes: "", photos: [] });
    haptic("success");
    showToast("Saved to baking calendar! 🗓️");
  };

  const deleteBakeLogEntry = (id) => {
    setBakeLogEntries((prev) => prev.filter((entry) => entry.id !== id));
    haptic("light");
    showToast("Bake entry removed");
  };

  // ─── Mark as cooked ───
  const markCooked = (id, openLogAfter = false) => {
    const today = getTodayISO();
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, lastMade: today, timesCooked: (r.timesCooked || 0) + 1 }
          : r
      )
    );
    setSelectedRecipe((prev) => (
      prev && prev.id === id
        ? { ...prev, lastMade: today, timesCooked: (prev.timesCooked || 0) + 1 }
        : prev
    ));
    haptic("success");
    if (openLogAfter) {
      openCalendarForDate(today, id);
      showToast("Nice bake. Add notes/photos for today 📸");
      return;
    }
    showToast("Marked as made today! 🎉");
  };

  // ─── Delete recipe (with undo) ───
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
        setToast(null);
        setToastAction(null);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        showToast("Recipe restored! ✨");
      },
    });
  };

  // ─── Save recipe (add or edit) ───
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

  // ─── Format date ───
  const fmtDate = (d) => {
    if (!d) return "Never";
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const fmtMonth = (monthString) => {
    const [year, month] = monthString.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // ─── Swipeable card wrapper ───
  const SwipeCard = ({ recipe, children }) => {
    const swipe = useSwipe(
      () => deleteRecipe(recipe.id),
      () => { toggleFavorite(recipe.id); showToast(recipe.favorite ? "Removed from favorites" : "Added to favorites! ❤️"); }
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

  // ─── View transition animation helper ───
  const getViewAnim = (viewName) => {
    if (!viewTransition) return view === viewName ? {} : null;
    const { from, to, direction } = viewTransition;
    if (viewName === from) {
      return {
        animation: `${direction === "forward" ? "slideOutLeft" : "slideOutRight"} 0.3s ease both`,
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
      };
    }
    if (viewName === to) {
      return {
        animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 0.3s ease both`,
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2,
      };
    }
    return null;
  };

  // ─── Dynamic styles using themed colors ───
  const ds = useMemo(() => getStyles(c), [c]);

  // ─── Render ───
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
          <div style={{
            fontSize: 72, animation: "cupcakeBounce 1.5s ease-in-out infinite",
            filter: "drop-shadow(0 8px 24px rgba(212,119,91,0.3))",
          }}>🧁</div>
          <div style={{ position: "absolute", top: 0, left: "50%", fontSize: 20, animation: "sprinkle1 2s ease-in-out infinite" }}>✨</div>
          <div style={{ position: "absolute", top: 0, left: "50%", fontSize: 16, animation: "sprinkle2 2s ease-in-out 0.3s infinite" }}>🌸</div>
          <div style={{ position: "absolute", top: 0, left: "50%", fontSize: 14, animation: "sprinkle3 2s ease-in-out 0.6s infinite" }}>💫</div>
        </div>
        <h1 style={{
          fontFamily: "'Georgia', serif", fontSize: 28, fontWeight: 700,
          color: c.text, margin: "20px 0 8px", animation: "fadeUp 0.8s ease 0.3s both",
        }}>My Little Bakery</h1>
        <p style={{
          fontFamily: "system-ui, sans-serif", fontSize: 15, color: c.textLight,
          animation: "fadeUp 0.8s ease 0.6s both", margin: 0,
        }}>Let's bake something wonderful</p>
        <div style={{
          marginTop: 32, width: 120, height: 4, borderRadius: 2,
          background: `linear-gradient(90deg, ${c.warm}, ${c.accent}, ${c.warm})`,
          backgroundSize: "400px 4px", animation: "shimmer 1.5s infinite linear, fadeUp 0.8s ease 0.9s both",
        }} />
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
          {toastAction && (
            <button
              onClick={toastAction.onPress}
              style={ds.toastActionBtn}
            >
              {toastAction.label}
            </button>
          )}
        </div>
      )}

      {/* Hidden PDF input */}
      <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfImport} style={{ display: "none" }} />
      <input
        ref={bakeLogPhotoInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleBakeLogPhotos}
        style={{ display: "none" }}
      />

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
          {/* Header */}
          <div style={ds.homeHeader}>
            <div>
              <h1 style={ds.brandName}>My Little Bakery</h1>
              <p style={ds.brandSub}>{recipes.length} recipes in your collection</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={ds.iconBtn} onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Light mode" : "Dark mode"}>
                {darkMode ? Icons.sun({ size: 22 }) : Icons.moon({ size: 22 })}
              </button>
              <button style={ds.iconBtn} onClick={() => openCalendarForDate()}>
                {Icons.calendar({ size: 22 })}
              </button>
              <button style={ds.iconBtn} onClick={() => { setIngredientSearch(""); navigateTo("suggest", "forward"); }}>
                {Icons.suggest({ size: 22 })}
              </button>
              <button style={ds.iconBtn} onClick={() => navigateTo("shopping", "forward")}>
                {Icons.cart({ size: 22 })}
                {shoppingList.length > 0 && <span style={ds.badge}>{shoppingList.length}</span>}
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={ds.searchWrap}>
            <span style={ds.searchIcon}>{Icons.search({ size: 18, color: c.textLight })}</span>
            <input
              style={ds.searchInput}
              placeholder="Search recipes, ingredients, tags..."
              value={searchDisplay}
              onChange={(e) => {
                const v = e.target.value;
                setSearchDisplay(v);
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => setSearchQuery(v), 200);
              }}
            />
            {searchDisplay && (
              <button style={ds.searchClear} onClick={() => { setSearchDisplay(""); setSearchQuery(""); }}>
                {Icons.x({ size: 16 })}
              </button>
            )}
          </div>

          {/* Swipe hint */}
          <p style={{ fontSize: 11, color: c.textLight, fontFamily: "system-ui, sans-serif", margin: "0 0 4px 4px", opacity: 0.7 }}>
            Swipe cards: right to fave, left to delete
          </p>

          {/* Category pills */}
          <div style={ds.pillRow}>
            <button
              style={{ ...ds.pill, ...(showFavoritesOnly ? ds.pillActive : {}) }}
              onClick={() => { haptic("light"); setShowFavoritesOnly(!showFavoritesOnly); }}
            >
              {Icons.heart({ size: 14, filled: showFavoritesOnly, color: showFavoritesOnly ? "#fff" : "#e74c6f" })}
              <span style={{ marginLeft: 4 }}>Favorites</span>
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                style={{ ...ds.pill, ...(activeCategory === cat ? ds.pillActive : {}) }}
                onClick={() => { haptic("light"); setActiveCategory(cat); }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort pills */}
          <div style={{ ...ds.pillRow, paddingBottom: 8, gap: 6 }}>
            {[
              { key: "recent", label: "Recent" },
              { key: "alpha", label: "A-Z" },
              { key: "mostMade", label: "Most Made" },
              { key: "lastMade", label: "Last Made" },
            ].map((s) => (
              <button
                key={s.key}
                style={{ ...ds.sortPill, ...(sortBy === s.key ? ds.sortPillActive : {}) }}
                onClick={() => { haptic("light"); setSortBy(s.key); }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Recently viewed */}
          {recentlyViewed.length > 0 && (
            <div style={ds.recentRow}>
              <span style={ds.recentLabel}>Recent</span>
              {recentlyViewed.map((id) => {
                const r = recipes.find((rec) => rec.id === id);
                if (!r) return null;
                const EMOJI_MAP = { Cookies: "🍪", Cakes: "🎂", Breakfast: "🥞", Bread: "🍞", "Brownies & Bars": "🍫", "Pies & Tarts": "🥧", Pastries: "🥐", Other: "🧁" };
                return (
                  <button key={id} style={ds.recentItem} onClick={() => openRecipeDetail(r)}>
                    <div style={ds.recentAvatar}>
                      {r.photo ? (
                        <img loading="lazy" src={r.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>{EMOJI_MAP[r.category] || "🧁"}</span>
                      )}
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
                <SwipeCard key={recipe.id} recipe={recipe}>
                  <button
                    style={{ ...ds.recipeCard, ...(cardsAnimatedRef.current ? {} : { animation: `cardFadeIn 0.3s ease ${i * 0.05}s both` }) }}
                    onPointerDown={() => { longPressTimerRef.current = setTimeout(() => openContextMenu(recipe), 500); }}
                    onPointerUp={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                    onPointerLeave={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                    onPointerCancel={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                    onClick={() => openRecipeDetail(recipe)}
                  >
                    {recipe.photo && (
                      <div style={{
                        width: "100%", height: 160, borderRadius: 12, overflow: "hidden",
                        marginBottom: 12, background: c.warm,
                      }}>
                        <img loading="lazy" src={recipe.photo} alt={recipe.name} style={{
                          width: "100%", height: "100%", objectFit: "cover", display: "block",
                        }} />
                      </div>
                    )}
                    <div style={ds.cardTop}>
                      <span style={ds.cardCategory}>{recipe.category}</span>
                      <button
                        style={{
                          ...ds.cardFavBtn,
                          ...(bouncingHeartId === recipe.id ? { animation: "heartBounce 0.4s ease" } : {}),
                        }}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id); }}
                      >
                        {Icons.heart({ size: 18, filled: recipe.favorite })}
                      </button>
                    </div>
                    <h3 style={ds.cardTitle}>{recipe.name}</h3>
                    <div style={ds.cardMeta}>
                      <span style={ds.cardMetaItem}>
                        {Icons.clock({ size: 13 })} {(recipe.prepTime || 0) + (recipe.cookTime || 0)}m
                      </span>
                      <span style={ds.cardMetaItem}>
                        {Icons.chef({ size: 13 })} {recipe.servings} servings
                      </span>
                    </div>
                    {recipe.timesCooked > 0 && (
                      <div style={ds.cardCooked}>
                        Made {recipe.timesCooked}× · Last: {fmtDate(recipe.lastMade)}
                      </div>
                    )}
                    {recipe.tags?.length > 0 && (
                      <div style={ds.cardTags}>
                        {recipe.tags.slice(0, 3).map((t) => (
                          <span key={t} style={ds.cardTag}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </button>
                </SwipeCard>
              ))
            )}
          </div>

        </div>
      )}

      {/* FAB - outside scrollable home view so it stays fixed on mobile */}
      {view === "home" && !viewTransition && (
        <>
          {/* FAB overlay */}
          {fabExpanded && (
            <div style={ds.fabOverlay} onClick={() => setFabExpanded(false)} />
          )}

          {/* FAB expanded menu */}
          {fabExpanded && (
            <div style={ds.fabMenu}>
              {/* Import PDF */}
              <div style={ds.fabMenuRow}>
                <span style={ds.fabMenuLabel}>Import PDF</span>
                <button style={ds.fabMini} onClick={() => { setFabExpanded(false); pdfInputRef.current?.click(); }}>
                  {Icons.upload({ size: 20, color: "#fff" })}
                </button>
              </div>
              {/* New Recipe */}
              <div style={ds.fabMenuRow}>
                <span style={ds.fabMenuLabel}>New Recipe</span>
                <button style={ds.fabMini} onClick={() => {
                  setFabExpanded(false);
                  setEditForm({
                    name: "", category: "Cookies", servings: 12, prepTime: 15, cookTime: 20,
                    ingredients: [{ name: "", amount: 1, unit: "cups" }],
                    instructions: "", tags: [], favorite: false, lastMade: null, notes: "", photo: null,
                  });
                  navigateTo("edit", "forward");
                }}>
                  {Icons.edit({ size: 18, color: "#fff" })}
                </button>
              </div>
            </div>
          )}

          {/* FAB button */}
          <button
            className="fab-btn"
            style={{
              ...ds.fab,
              transform: fabExpanded ? "rotate(45deg)" : "scale(1)",
              transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
            onClick={() => { haptic("light"); setFabExpanded((prev) => !prev); }}
          >
            {Icons.plus({ size: 28, color: "#fff" })}
          </button>
        </>
      )}

      {/* ─── DETAIL VIEW ─── */}
      {getViewAnim("detail") !== null && selectedRecipe && (
        <div style={{ ...ds.screen, ...getViewAnim("detail") }}>
          {/* Nav */}
          <div style={ds.detailNav}>
            <button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>
              {Icons.back({ size: 20 })} Back
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={ds.iconBtnSmall}
                onClick={() => {
                  setEditForm({ ...selectedRecipe });
                  navigateTo("edit", "forward");
                }}
              >
                {Icons.edit({ size: 18 })}
              </button>
              <button style={ds.iconBtnSmall} onClick={() => deleteRecipe(selectedRecipe.id)}>
                {Icons.trash({ size: 18, color: "#c0392b" })}
              </button>
            </div>
          </div>

          {/* Recipe photo */}
          {selectedRecipe.photo && (
            <div style={{
              width: "100%", height: 220, borderRadius: 16, overflow: "hidden",
              marginBottom: 16, background: c.warm,
            }}>
              <img src={selectedRecipe.photo} alt={selectedRecipe.name} style={{
                width: "100%", height: "100%", objectFit: "cover", display: "block",
              }} />
            </div>
          )}

          {/* Recipe header */}
          <div style={ds.detailHeader}>
            <div style={ds.detailCategoryPill}>{selectedRecipe.category}</div>
            <h1 style={ds.detailTitle}>{selectedRecipe.name}</h1>
            <div style={ds.detailStats}>
              <div style={ds.statBox}>
                <div style={ds.statValue}>{selectedRecipe.prepTime || 0}m</div>
                <div style={ds.statLabel}>Prep</div>
              </div>
              <div style={ds.statDivider} />
              <div style={ds.statBox}>
                <div style={ds.statValue}>{selectedRecipe.cookTime || 0}m</div>
                <div style={ds.statLabel}>Cook</div>
              </div>
              <div style={ds.statDivider} />
              <div style={ds.statBox}>
                <div style={ds.statValue}>{Math.round(selectedRecipe.servings * scaleFactor)}</div>
                <div style={ds.statLabel}>Servings</div>
              </div>
              <div style={ds.statDivider} />
              <div style={ds.statBox}>
                <div style={ds.statValue}>{selectedRecipe.timesCooked || 0}</div>
                <div style={ds.statLabel}>Times Made</div>
              </div>
            </div>
          </div>

          {/* Scale control */}
          <div style={ds.scaleSection}>
            <div style={ds.scaleLabel}>{Icons.scale({ size: 16 })} Scale Recipe</div>
            <div style={ds.scaleButtons}>
              {[0.5, 1, 1.5, 2, 3].map((s) => (
                <button
                  key={s}
                  style={{ ...ds.scaleBtn, ...(scaleFactor === s ? ds.scaleBtnActive : {}) }}
                  onClick={() => { haptic("select"); setScaleFactor(s); }}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div style={ds.section}>
            <div style={ds.sectionHeader}>
              <h2 style={ds.sectionTitle}>Ingredients</h2>
              <button
                style={ds.shopBtn}
                onClick={() => generateShoppingList(selectedRecipe, scaleFactor)}
              >
                {Icons.cart({ size: 15 })} Add to List
              </button>
            </div>
            <div style={ds.ingredientsList}>
              {selectedRecipe.ingredients?.map((ing, i) => (
                <div key={i} style={ds.ingredientRow}>
                  <span style={ds.ingredientAmount}>
                    {+(ing.amount * scaleFactor).toFixed(2)} {ing.unit}
                  </span>
                  <span style={ds.ingredientName}>{ing.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div style={ds.section}>
            <h2 style={ds.sectionTitle}>Instructions</h2>
            <div style={ds.instructions}>
              {selectedRecipe.instructions?.split("\n").map((line, i) => (
                <p key={i} style={ds.instructionLine}>{line}</p>
              ))}
            </div>
          </div>

          {/* Notes */}
          {selectedRecipe.notes && (
            <div style={ds.section}>
              <h2 style={ds.sectionTitle}>Notes</h2>
              <p style={ds.notesText}>{selectedRecipe.notes}</p>
            </div>
          )}

          {/* Tags */}
          {selectedRecipe.tags?.length > 0 && (
            <div style={{ ...ds.section, ...ds.tagsRow }}>
              {selectedRecipe.tags.map((t) => (
                <span key={t} style={ds.detailTag}>#{t}</span>
              ))}
            </div>
          )}

          {/* Start Cooking + Timer */}
          <button style={ds.startCookingBtn} onClick={startCooking}>
            👩‍🍳 Start Cooking
          </button>

          {selectedRecipe.cookTime > 0 && (
            <button
              style={{ ...ds.actionBtn, marginBottom: 12, width: "100%" }}
              onClick={() => addTimer(selectedRecipe.name, selectedRecipe.cookTime)}
            >
              {Icons.clock({ size: 16 })} Set {selectedRecipe.cookTime}m Timer
            </button>
          )}

          {/* Action buttons */}
          <div style={ds.detailActions}>
            <button
              style={{
                ...ds.actionBtn,
                ...(bouncingHeartId === selectedRecipe.id ? { animation: "heartBounce 0.4s ease" } : {}),
              }}
              onClick={() => toggleFavorite(selectedRecipe.id)}
            >
              {Icons.heart({
                size: 18,
                filled: recipes.find((r) => r.id === selectedRecipe.id)?.favorite,
              })}
              {recipes.find((r) => r.id === selectedRecipe.id)?.favorite ? "Unfavorite" : "Favorite"}
            </button>
            <button style={{ ...ds.actionBtn, ...ds.actionBtnPrimary }} onClick={() => markCooked(selectedRecipe.id, true)}>
              {Icons.check({ size: 18 })} Made It + Log
            </button>
          </div>

          <div style={{ height: 40 }} />
        </div>
      )}

      {/* ─── EDIT / ADD VIEW ─── */}
      {getViewAnim("edit") !== null && editForm && (
        <div style={{ ...ds.screen, ...getViewAnim("edit") }}>
          <div style={ds.detailNav}>
            <button style={ds.backBtn} onClick={() => navigateTo(editForm.id ? "detail" : "home", "back")}>
              {Icons.x({ size: 20 })} Cancel
            </button>
            <button style={ds.saveBtn} onClick={() => saveRecipe(editForm)}>
              Save
            </button>
          </div>

          <h1 style={ds.editTitle}>{editForm.id ? "Edit Recipe" : "New Recipe"}</h1>

          {/* Photo upload */}
          <div style={ds.formGroup}>
            <label style={ds.formLabel}>Recipe Photo</label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              style={{ display: "none" }}
            />
            {editForm.photo ? (
              <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 4 }}>
                <img src={editForm.photo} alt="Recipe" style={{
                  width: "100%", height: 180, objectFit: "cover", display: "block", borderRadius: 14,
                }} />
                <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 8 }}>
                  <button
                    style={{ ...ds.iconBtnSmall, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {Icons.camera({ size: 18, color: "#fff" })}
                  </button>
                  <button
                    style={{ ...ds.iconBtnSmall, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                    onClick={() => setEditForm({ ...editForm, photo: null })}
                  >
                    {Icons.x({ size: 18, color: "#fff" })}
                  </button>
                </div>
              </div>
            ) : (
              <button
                style={{
                  width: "100%", padding: "28px 16px", borderRadius: 14,
                  border: `2px dashed ${c.border}`, background: c.warm,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  cursor: "pointer", color: c.textMid, fontFamily: "system-ui, sans-serif",
                  fontSize: 14,
                }}
                onClick={() => photoInputRef.current?.click()}
              >
                {Icons.camera({ size: 28, color: c.accent })}
                <span>Add a photo from camera or gallery</span>
              </button>
            )}
          </div>

          <div style={ds.formGroup}>
            <label style={ds.formLabel}>Recipe Name</label>
            <input
              style={ds.formInput}
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="e.g. Double Chocolate Muffins"
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...ds.formGroup, flex: 1 }}>
              <label style={ds.formLabel}>Category</label>
              <select
                style={ds.formSelect}
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              >
                {CATEGORIES.filter((ct) => ct !== "All").map((ct) => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>
            <div style={{ ...ds.formGroup, flex: 1 }}>
              <label style={ds.formLabel}>Servings</label>
              <input
                style={ds.formInput}
                type="text"
                inputMode="numeric"
                value={editForm.servings}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setEditForm({ ...editForm, servings: v === '' ? '' : +v });
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...ds.formGroup, flex: 1 }}>
              <label style={ds.formLabel}>Prep (min)</label>
              <input
                style={ds.formInput}
                type="text"
                inputMode="numeric"
                value={editForm.prepTime}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setEditForm({ ...editForm, prepTime: v === '' ? '' : +v });
                }}
              />
            </div>
            <div style={{ ...ds.formGroup, flex: 1 }}>
              <label style={ds.formLabel}>Cook (min)</label>
              <input
                style={ds.formInput}
                type="text"
                inputMode="numeric"
                value={editForm.cookTime}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setEditForm({ ...editForm, cookTime: v === '' ? '' : +v });
                }}
              />
            </div>
          </div>

          {/* Ingredients */}
          <div style={ds.formGroup}>
            <label style={ds.formLabel}>Ingredients</label>
            {editForm.ingredients?.map((ing, i) => (
              <div key={i} style={ds.ingEditRow}>
                <input
                  style={{ ...ds.formInput, width: 60, flexShrink: 0 }}
                  type="text"
                  inputMode="decimal"
                  value={ing.amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    const ings = [...editForm.ingredients];
                    ings[i] = { ...ings[i], amount: v === '' ? '' : +v };
                    setEditForm({ ...editForm, ingredients: ings });
                  }}
                />
                <select
                  style={{ ...ds.formSelect, width: 80, flexShrink: 0 }}
                  value={ing.unit}
                  onChange={(e) => {
                    const ings = [...editForm.ingredients];
                    ings[i] = { ...ings[i], unit: e.target.value };
                    setEditForm({ ...editForm, ingredients: ings });
                  }}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input
                  style={{ ...ds.formInput, flex: 1 }}
                  value={ing.name}
                  placeholder="Ingredient name"
                  onChange={(e) => {
                    const ings = [...editForm.ingredients];
                    ings[i] = { ...ings[i], name: e.target.value };
                    setEditForm({ ...editForm, ingredients: ings });
                  }}
                />
                <button
                  style={ds.ingRemoveBtn}
                  onClick={() => {
                    const ings = editForm.ingredients.filter((_, j) => j !== i);
                    setEditForm({ ...editForm, ingredients: ings });
                  }}
                >
                  {Icons.x({ size: 16, color: "#c0392b" })}
                </button>
              </div>
            ))}
            <button
              style={ds.addIngBtn}
              onClick={() =>
                setEditForm({
                  ...editForm,
                  ingredients: [...(editForm.ingredients || []), { name: "", amount: 1, unit: "cups" }],
                })
              }
            >
              {Icons.plus({ size: 16 })} Add Ingredient
            </button>
          </div>

          {/* Instructions */}
          <div style={ds.formGroup}>
            <label style={ds.formLabel}>Instructions</label>
            <textarea
              style={ds.formTextarea}
              rows={8}
              value={editForm.instructions}
              onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
              placeholder="Write each step on a new line..."
            />
          </div>

          {/* Tags */}
          <div style={ds.formGroup}>
            <label style={ds.formLabel}>Tags (comma separated)</label>
            <input
              style={ds.formInput}
              value={editForm.tags?.join(", ") || ""}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="chocolate, cookies, dessert"
            />
          </div>

          {/* Notes */}
          <div style={ds.formGroup}>
            <label style={ds.formLabel}>Notes</label>
            <textarea
              style={ds.formTextarea}
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Any personal notes or tips..."
            />
          </div>

          <div style={{ height: 40 }} />
        </div>
      )}

      {/* ─── SHOPPING LIST VIEW ─── */}
      {getViewAnim("shopping") !== null && (
        <div style={{ ...ds.screen, ...getViewAnim("shopping") }}>
          <div style={ds.detailNav}>
            <button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>
              {Icons.back({ size: 20 })} Back
            </button>
            {shoppingList.length > 0 && (
              <button
                style={{ ...ds.saveBtn, background: "#c0392b" }}
                onClick={() => { setShoppingList([]); setCheckedItems({}); }}
              >
                Clear All
              </button>
            )}
          </div>

          <h1 style={ds.editTitle}>🛒 Shopping List</h1>

          {shoppingList.length === 0 ? (
            <div style={ds.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <p style={{ color: c.textLight, fontSize: 15 }}>Your shopping list is empty</p>
              <p style={{ color: c.textLight, fontSize: 13, marginTop: 4, opacity: 0.7 }}>
                Open a recipe and tap "Add to List"
              </p>
            </div>
          ) : (
            <div style={ds.shoppingItems}>
              {shoppingList.map((item, i) => (
                <div
                  key={i}
                  style={{
                    ...ds.shoppingItem,
                    ...(checkedItems[i] ? ds.shoppingItemChecked : {}),
                  }}
                  onClick={() => {
                    haptic("select");
                    setPoppedCheck(i);
                    setTimeout(() => setPoppedCheck(null), 300);
                    setCheckedItems({ ...checkedItems, [i]: !checkedItems[i] });
                  }}
                >
                  <div
                    style={{
                      ...ds.checkbox,
                      ...(checkedItems[i] ? ds.checkboxChecked : {}),
                      ...(poppedCheck === i ? { animation: "checkPop 0.3s ease" } : {}),
                    }}
                  >
                    {checkedItems[i] && Icons.check({ size: 14, color: "#fff" })}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      ...ds.shoppingItemName,
                      ...(checkedItems[i] ? { textDecoration: "line-through", opacity: 0.5 } : {}),
                    }}>
                      {item.amount} {item.unit} {item.name}
                    </span>
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
          <div style={ds.detailNav}>
            <button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>
              {Icons.back({ size: 20 })} Back
            </button>
          </div>

          <h1 style={ds.editTitle}>🗓️ Baking Calendar</h1>

          <div style={ds.calendarMonthBar}>
            <button style={ds.calendarMonthBtn} onClick={() => shiftCalendarMonth(-1)}>
              {Icons.back({ size: 18 })}
            </button>
            <div style={ds.calendarMonthLabel}>{fmtMonth(calendarMonth)}</div>
            <button style={ds.calendarMonthBtn} onClick={() => shiftCalendarMonth(1)}>
              <div style={{ transform: "rotate(180deg)", display: "flex" }}>{Icons.back({ size: 18 })}</div>
            </button>
          </div>

          <div style={ds.calendarWeekRow}>
            {WEEK_DAYS.map((day) => (
              <div key={day} style={ds.calendarWeekCell}>{day}</div>
            ))}
          </div>

          <div style={ds.calendarGrid}>
            {calendarCells.map((dayString, i) => {
              if (!dayString) return <div key={`empty-${i}`} style={ds.calendarEmptyCell} />;
              const dayNum = parseInt(dayString.split("-")[2], 10);
              const isToday = dayString === getTodayISO();
              const isSelected = dayString === calendarDate;
              const entryCount = bakeEntriesByDate[dayString] || 0;
              return (
                <button
                  key={dayString}
                  style={{
                    ...ds.calendarDay,
                    ...(isToday ? ds.calendarDayToday : {}),
                    ...(isSelected ? ds.calendarDaySelected : {}),
                  }}
                  onClick={() => setCalendarDate(dayString)}
                >
                  <span>{dayNum}</span>
                  {entryCount > 0 && <span style={ds.calendarDayCount}>{entryCount}</span>}
                </button>
              );
            })}
          </div>

          <div style={ds.calendarSelectedDate}>What I baked on {fmtDate(calendarDate)}</div>

          {selectedDateEntries.length === 0 ? (
            <div style={{ ...ds.emptyState, paddingTop: 24, paddingBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🧁</div>
              <p style={{ color: c.textLight, fontSize: 14, margin: 0 }}>No bakes logged for this day yet</p>
            </div>
          ) : (
            <div style={ds.calendarEntriesList}>
              {selectedDateEntries.map((entry) => (
                <div key={entry.id} style={ds.calendarEntryCard}>
                  <div style={ds.calendarEntryTop}>
                    <div>
                      <div style={ds.calendarEntryTitle}>{entry.recipeName}</div>
                      {entry.createdAt && (
                        <div style={ds.calendarEntryTime}>
                          Logged {new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                    <button style={ds.calendarEntryDelete} onClick={() => deleteBakeLogEntry(entry.id)}>
                      {Icons.trash({ size: 16, color: "#c0392b" })}
                    </button>
                  </div>
                  {entry.notes && <p style={ds.calendarEntryNotes}>{entry.notes}</p>}
                  {entry.photos?.length > 0 && (
                    <div style={ds.calendarEntryPhotos}>
                      {entry.photos.map((photo, idx) => (
                        <img loading="lazy" key={`${entry.id}-${idx}`} src={photo} alt="" style={ds.calendarEntryPhoto} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ ...ds.section, marginTop: 8 }}>
            <h2 style={ds.sectionTitle}>Log a Bake for This Day</h2>
            <div style={ds.formGroup}>
              <label style={ds.formLabel}>Recipe</label>
              <select
                style={ds.formSelect}
                value={bakeLogDraft.recipeId}
                onChange={(e) => setBakeLogDraft((prev) => ({ ...prev, recipeId: e.target.value }))}
              >
                <option value="">Custom bake / not in recipes</option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                ))}
              </select>
            </div>

            <div style={ds.formGroup}>
              <label style={ds.formLabel}>Notes</label>
              <textarea
                style={ds.formTextarea}
                rows={3}
                value={bakeLogDraft.notes}
                onChange={(e) => setBakeLogDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="What did I bake today? How did it turn out?"
              />
            </div>

            <div style={ds.formGroup}>
              <button style={ds.addBakePhotoBtn} onClick={() => bakeLogPhotoInputRef.current?.click()}>
                {Icons.camera({ size: 18, color: c.accent })} Upload Bake Photos
              </button>
              {bakeLogDraft.photos.length > 0 && (
                <div style={ds.bakePhotoPreviewRow}>
                  {bakeLogDraft.photos.map((photo, idx) => (
                    <div key={`draft-photo-${idx}`} style={ds.bakePhotoPreviewWrap}>
                      <img src={photo} alt="" style={ds.bakePhotoPreview} />
                      <button
                        style={ds.bakePhotoRemoveBtn}
                        onClick={() =>
                          setBakeLogDraft((prev) => ({
                            ...prev,
                            photos: prev.photos.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        {Icons.x({ size: 14, color: "#fff" })}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button style={{ ...ds.actionBtn, ...ds.actionBtnPrimary, width: "100%" }} onClick={saveBakeLogEntry}>
              {Icons.check({ size: 18 })} Save Day Entry
            </button>
          </div>
        </div>
      )}

      {/* ─── SUGGEST VIEW ─── */}
      {getViewAnim("suggest") !== null && (
        <div style={{ ...ds.screen, ...getViewAnim("suggest") }}>
          <div style={ds.detailNav}>
            <button style={ds.backBtn} onClick={() => navigateTo("home", "back")}>
              {Icons.back({ size: 20 })} Back
            </button>
          </div>

          <h1 style={ds.editTitle}>🔮 What Can I Bake?</h1>
          <p style={{ color: c.textLight, fontSize: 14, marginBottom: 16, padding: "0 4px" }}>
            Enter ingredients you have on hand, separated by commas
          </p>

          <div style={ds.formGroup}>
            <input
              style={ds.formInput}
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              placeholder="e.g. butter, flour, eggs, chocolate"
            />
          </div>

          {ingredientSearch && suggestedRecipes.length === 0 && (
            <div style={ds.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🤔</div>
              <p style={{ color: c.textLight, fontSize: 15 }}>No matching recipes found</p>
              <p style={{ color: c.textLight, fontSize: 13, marginTop: 4, opacity: 0.7 }}>Try different ingredients</p>
            </div>
          )}

          {suggestedRecipes.map((recipe) => (
            <button
              key={recipe.id}
              style={ds.suggestCard}
              onClick={() => openRecipeDetail(recipe)}
            >
              <div style={ds.suggestTop}>
                <h3 style={ds.suggestName}>{recipe.name}</h3>
                <div style={ds.matchBadge}>{recipe.matchPercent}% match</div>
              </div>
              <p style={ds.suggestMeta}>
                {recipe.matchCount} of {recipe.ingredients.length} ingredients · {recipe.category}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* ─── COOKING MODE VIEW ─── */}
      {getViewAnim("cooking") !== null && cookingSteps.length > 0 && (
        <div
          style={{ ...ds.cookingScreen, ...getViewAnim("cooking") }}
          ref={cookingSwipe.elRef}
          onTouchStart={cookingSwipe.onTouchStart}
          onTouchMove={cookingSwipe.onTouchMove}
          onTouchEnd={cookingSwipe.onTouchEnd}
        >
          {/* Top bar */}
          <div style={ds.cookingTopBar}>
            <button style={{ ...ds.backBtn, color: c.textLight }} onClick={exitCooking}>
              {Icons.x({ size: 20 })} Close
            </button>
            <span style={ds.cookingStepCount}>Step {currentStep + 1} of {cookingSteps.length}</span>
          </div>

          {/* Recipe name */}
          <div style={ds.cookingRecipeName}>{selectedRecipe?.name}</div>

          {/* Progress bar */}
          <div style={ds.cookingProgress}>
            {cookingSteps.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: i <= currentStep ? c.accent : c.border,
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>

          {/* Step content */}
          <div style={ds.cookingStepContent}>
            <div style={ds.cookingStepNumber}>Step {currentStep + 1}</div>
            <p style={ds.cookingStepText}>{cookingSteps[currentStep]}</p>

            {/* Detect time mentions and offer timer */}
            {(() => {
              const match = cookingSteps[currentStep]?.match(/(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)/i);
              if (match) {
                return (
                  <button style={ds.cookingTimerBtn} onClick={() => addTimer(`Step ${currentStep + 1}`, parseInt(match[1]))}>
                    {Icons.clock({ size: 16 })} Set {match[1]}m Timer
                  </button>
                );
              }
              return null;
            })()}
          </div>

          {/* Nav buttons */}
          <div style={ds.cookingNav}>
            <button
              style={{ ...ds.cookingNavBtn, opacity: currentStep === 0 ? 0.3 : 1 }}
              disabled={currentStep === 0}
              onClick={() => { haptic("select"); setCurrentStep((s) => Math.max(0, s - 1)); }}
            >
              {Icons.back({ size: 20 })} Previous
            </button>
            {currentStep < cookingSteps.length - 1 ? (
              <button
                style={{ ...ds.cookingNavBtn, ...ds.cookingNavBtnPrimary }}
                onClick={() => { haptic("select"); setCurrentStep((s) => s + 1); }}
              >
                Next →
              </button>
            ) : (
              <button
                style={{ ...ds.cookingNavBtn, ...ds.cookingNavBtnPrimary, background: "#27ae60" }}
                onClick={finishCooking}
              >
                {Icons.check({ size: 18 })} Done!
              </button>
            )}
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: c.textLight, marginTop: 8, fontFamily: "system-ui, sans-serif" }}>
            Swipe left/right to navigate
          </p>
        </div>
      )}

      {/* ─── FLOATING TIMER PILL ─── */}
      {timers.length > 0 && (
        <div style={ds.timerPillContainer}>
          {timers.map((t) => (
            <div key={t.id} style={{ ...ds.timerPill, ...(t.remainingSeconds === 0 ? { animation: "timerPulse 1s infinite" } : {}) }}>
              <span style={ds.timerPillLabel}>{t.label}</span>
              <span style={ds.timerPillTime}>{t.active ? fmtTimer(t.remainingSeconds) : (t.remainingSeconds === 0 ? "Done!" : "Paused")}</span>
              <button style={ds.timerPillBtn} onClick={() => toggleTimer(t.id)}>
                {t.active ? "⏸" : (t.remainingSeconds > 0 ? "▶" : "")}
              </button>
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
              { icon: Icons.trash({ size: 18, color: "#c0392b" }), label: "Delete", action: () => { deleteRecipe(contextMenu.id); closeContextMenu(); }, danger: true },
            ].map((item, i) => (
              <button
                key={i}
                style={{ ...ds.bottomSheetAction, ...(item.danger ? { color: "#c0392b" } : {}) }}
                onClick={item.action}
              >
                <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dynamic styles factory ───
const getStyles = (colors) => ({
  app: {
    fontFamily: "'Georgia', 'Palatino', 'Times New Roman', serif",
    background: colors.bg,
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    position: "relative",
    overflow: "hidden",
    WebkitFontSmoothing: "antialiased",
    transition: "background 0.3s",
  },
  splashScreen: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: colors.bg,
    transition: "background 0.3s",
  },
  toast: {
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 12px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: colors.text,
    color: colors.bg,
    padding: "10px 20px",
    borderRadius: 20,
    fontSize: 14,
    zIndex: 1000,
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    animation: "toastSlideDown 0.3s ease",
    display: "flex",
    alignItems: "center",
    gap: 12,
    whiteSpace: "nowrap",
  },
  toastActionBtn: {
    background: "none",
    border: "none",
    color: colors.accent,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    padding: "2px 4px",
    textDecoration: "underline",
    fontFamily: "inherit",
  },
  screen: {
    padding: "calc(env(safe-area-inset-top, 0px) + 16px) 16px 100px 16px",
    overflowY: "auto",
    minHeight: "100vh",
  },

  // Home
  homeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingTop: 8,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.text,
    margin: 0,
    letterSpacing: -0.5,
    fontFamily: "'Georgia', serif",
  },
  brandSub: { color: colors.textLight, fontSize: 13, marginTop: 4, fontFamily: "system-ui, sans-serif" },
  iconBtn: {
    background: colors.warm,
    border: "none",
    borderRadius: 12,
    width: 42,
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    color: colors.text,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    background: colors.accent,
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    width: 18,
    height: 18,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui",
  },

  // Search
  searchWrap: {
    position: "relative",
    marginBottom: 16,
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
  },
  searchInput: {
    width: "100%",
    padding: "13px 40px 13px 42px",
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    fontSize: 15,
    color: colors.text,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  searchClear: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: colors.textLight,
    padding: 4,
  },

  // Pills
  pillRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 16,
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  pill: {
    flexShrink: 0,
    padding: "8px 14px",
    borderRadius: 20,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    color: colors.textMid,
    fontSize: 13,
    fontFamily: "system-ui, sans-serif",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  pillActive: {
    background: colors.accent,
    color: "#fff",
    borderColor: colors.accent,
  },

  // Recipe cards
  recipeGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  recipeCard: {
    background: colors.card,
    borderRadius: 16,
    padding: 16,
    border: `1.5px solid ${colors.border}`,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
    width: "100%",
    boxSizing: "border-box",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardCategory: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "system-ui, sans-serif",
  },
  cardFavBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: colors.text,
    margin: "0 0 8px",
    lineHeight: 1.3,
    fontFamily: "'Georgia', serif",
  },
  cardMeta: {
    display: "flex",
    gap: 16,
    fontSize: 12,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
  },
  cardMetaItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  cardCooked: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 8,
    fontFamily: "system-ui, sans-serif",
  },
  cardTags: {
    display: "flex",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  cardTag: {
    fontSize: 11,
    color: colors.accent,
    fontFamily: "system-ui, sans-serif",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 20px",
  },

  // FAB
  fab: {
    position: "fixed",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    background: colors.accent,
    border: "none",
    boxShadow: "0 4px 20px rgba(212, 119, 91, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 100,
    transition: "transform 0.2s",
  },
  fabOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 99,
    background: "rgba(0,0,0,0.3)",
    animation: "backdropFadeIn 0.2s ease",
  },
  fabMenu: {
    position: "fixed",
    bottom: 92,
    right: 24,
    zIndex: 101,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "flex-end",
    animation: "fadeIn 0.2s ease",
  },
  fabMenuRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  fabMenuLabel: {
    background: colors.text,
    color: colors.bg,
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "system-ui, sans-serif",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  fabMini: {
    width: 46,
    height: 46,
    borderRadius: 23,
    background: colors.accent,
    border: "none",
    boxShadow: "0 2px 12px rgba(212,119,91,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  pdfLoadingOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 500,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    animation: "backdropFadeIn 0.2s ease",
  },
  pdfLoadingCard: {
    background: colors.card,
    borderRadius: 20,
    padding: "32px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  pdfLoadingTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.text,
    fontFamily: "'Georgia', serif",
  },
  pdfLoadingSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
  },

  // Detail view
  detailNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 4,
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    fontSize: 15,
    color: colors.accent,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    fontWeight: 500,
    padding: 0,
  },
  iconBtnSmall: {
    background: colors.warm,
    border: "none",
    borderRadius: 10,
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: colors.textMid,
  },
  detailHeader: {
    marginBottom: 20,
  },
  detailCategoryPill: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    fontFamily: "system-ui, sans-serif",
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: colors.text,
    margin: "0 0 16px",
    lineHeight: 1.2,
    fontFamily: "'Georgia', serif",
  },
  detailStats: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    background: colors.warm,
    borderRadius: 14,
    padding: "14px 8px",
  },
  statBox: { textAlign: "center" },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
    fontFamily: "system-ui, sans-serif",
  },
  statLabel: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
    fontFamily: "system-ui, sans-serif",
  },
  statDivider: {
    width: 1,
    height: 30,
    background: colors.border,
  },

  // Scale
  scaleSection: {
    margin: "16px 0",
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  scaleLabel: {
    fontSize: 13,
    color: colors.textMid,
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 500,
    flexShrink: 0,
  },
  scaleButtons: {
    display: "flex",
    gap: 6,
  },
  scaleBtn: {
    padding: "7px 12px",
    borderRadius: 10,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    fontSize: 13,
    fontWeight: 600,
    color: colors.textMid,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
  scaleBtnActive: {
    background: colors.accent,
    color: "#fff",
    borderColor: colors.accent,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
    margin: 0,
    fontFamily: "'Georgia', serif",
  },
  shopBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 10,
    border: `1.5px solid ${colors.accent}`,
    background: "transparent",
    color: colors.accent,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },

  // Ingredients
  ingredientsList: {
    background: colors.card,
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    overflow: "hidden",
  },
  ingredientRow: {
    display: "flex",
    alignItems: "center",
    padding: "11px 14px",
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 14,
    fontFamily: "system-ui, sans-serif",
  },
  ingredientAmount: {
    fontWeight: 600,
    color: colors.accent,
    minWidth: 90,
    fontSize: 13,
  },
  ingredientName: {
    color: colors.text,
  },

  // Instructions
  instructions: {
    background: colors.card,
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    padding: 16,
  },
  instructionLine: {
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.text,
    margin: "0 0 8px",
    fontFamily: "system-ui, sans-serif",
  },

  // Notes
  notesText: {
    background: colors.warm,
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    lineHeight: 1.6,
    color: colors.textMid,
    fontStyle: "italic",
    margin: 0,
    fontFamily: "'Georgia', serif",
  },

  // Tags
  tagsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  detailTag: {
    padding: "6px 12px",
    borderRadius: 16,
    background: colors.warm,
    fontSize: 12,
    color: colors.textMid,
    fontFamily: "system-ui, sans-serif",
  },

  // Actions
  detailActions: {
    display: "flex",
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    padding: "13px 16px",
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    fontSize: 14,
    fontWeight: 600,
    color: colors.textMid,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "system-ui, sans-serif",
  },
  actionBtnPrimary: {
    background: colors.accent,
    color: "#fff",
    borderColor: colors.accent,
  },

  // Edit form
  editTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: colors.text,
    margin: "0 0 20px",
    fontFamily: "'Georgia', serif",
  },
  saveBtn: {
    padding: "9px 20px",
    borderRadius: 10,
    border: "none",
    background: colors.accent,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: colors.textMid,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "system-ui, sans-serif",
  },
  formInput: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    fontSize: 15,
    color: colors.text,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  },
  formSelect: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    fontSize: 15,
    color: colors.text,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box",
    appearance: "auto",
  },
  formTextarea: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    fontSize: 15,
    color: colors.text,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    lineHeight: 1.6,
  },
  ingEditRow: {
    display: "flex",
    gap: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  ingRemoveBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    flexShrink: 0,
  },
  addIngBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 14px",
    borderRadius: 10,
    border: `1.5px dashed ${colors.border}`,
    background: "transparent",
    fontSize: 13,
    fontWeight: 500,
    color: colors.textMid,
    cursor: "pointer",
    width: "100%",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    marginTop: 4,
  },

  // Shopping list
  shoppingItems: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  shoppingItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    background: colors.card,
    border: `1.5px solid ${colors.border}`,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  shoppingItemChecked: {
    background: colors.warm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: `2px solid ${colors.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.2s",
  },
  checkboxChecked: {
    background: colors.accent,
    borderColor: colors.accent,
  },
  shoppingItemName: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "system-ui, sans-serif",
    display: "block",
  },
  shoppingItemRecipe: {
    fontSize: 11,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
    display: "block",
    marginTop: 2,
  },

  // Suggest
  suggestCard: {
    display: "block",
    width: "100%",
    padding: 16,
    borderRadius: 14,
    background: colors.card,
    border: `1.5px solid ${colors.border}`,
    marginBottom: 10,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
  },
  suggestTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  suggestName: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.text,
    margin: 0,
    fontFamily: "'Georgia', serif",
  },
  matchBadge: {
    padding: "4px 10px",
    borderRadius: 12,
    background: colors.accent,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "system-ui, sans-serif",
  },
  suggestMeta: {
    fontSize: 12,
    color: colors.textLight,
    margin: 0,
    fontFamily: "system-ui, sans-serif",
  },

  // Calendar
  calendarMonthBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarMonthBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: colors.textMid,
  },
  calendarMonthLabel: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
    fontFamily: "'Georgia', serif",
  },
  calendarWeekRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
    marginBottom: 6,
  },
  calendarWeekCell: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
    marginBottom: 14,
  },
  calendarEmptyCell: {
    minHeight: 44,
  },
  calendarDay: {
    minHeight: 44,
    borderRadius: 12,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    color: colors.text,
    fontSize: 14,
    fontFamily: "system-ui, sans-serif",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "4px 2px",
    position: "relative",
  },
  calendarDayToday: {
    borderColor: colors.accent,
  },
  calendarDaySelected: {
    background: colors.warm,
    borderColor: colors.accent,
    color: colors.accentDark,
  },
  calendarDayCount: {
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
    color: colors.accent,
    fontFamily: "system-ui, sans-serif",
  },
  calendarSelectedDate: {
    fontSize: 13,
    color: colors.textMid,
    fontFamily: "system-ui, sans-serif",
    margin: "4px 2px 8px",
  },
  calendarEntriesList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  calendarEntryCard: {
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    padding: 12,
  },
  calendarEntryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  calendarEntryTitle: {
    fontSize: 15,
    color: colors.text,
    fontWeight: 700,
    fontFamily: "'Georgia', serif",
  },
  calendarEntryTime: {
    fontSize: 11,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
    marginTop: 2,
  },
  calendarEntryDelete: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 2,
    flexShrink: 0,
  },
  calendarEntryNotes: {
    margin: "8px 0 0",
    fontSize: 13,
    lineHeight: 1.5,
    color: colors.textMid,
    fontFamily: "system-ui, sans-serif",
  },
  calendarEntryPhotos: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  calendarEntryPhoto: {
    width: "100%",
    height: 88,
    objectFit: "cover",
    borderRadius: 10,
    display: "block",
    background: colors.warm,
  },
  addBakePhotoBtn: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px dashed ${colors.border}`,
    background: colors.warm,
    fontSize: 14,
    color: colors.textMid,
    fontFamily: "system-ui, sans-serif",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bakePhotoPreviewRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginTop: 10,
  },
  bakePhotoPreviewWrap: {
    position: "relative",
  },
  bakePhotoPreview: {
    width: "100%",
    height: 64,
    objectFit: "cover",
    borderRadius: 10,
    display: "block",
    background: colors.warm,
  },
  bakePhotoRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    border: "none",
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },

  // ─── Cooking Mode ───
  startCookingBtn: {
    width: "100%",
    padding: "16px 20px",
    borderRadius: 16,
    border: "none",
    background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDark})`,
    color: "#fff",
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    marginBottom: 12,
    letterSpacing: 0.3,
    boxShadow: "0 4px 16px rgba(212,119,91,0.3)",
  },
  cookingScreen: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: colors.bg,
    display: "flex",
    flexDirection: "column",
    padding: "calc(env(safe-area-inset-top, 0px) + 16px) 20px env(safe-area-inset-bottom)",
    maxWidth: 480,
    margin: "0 auto",
    boxSizing: "border-box",
  },
  cookingTopBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cookingStepCount: {
    fontSize: 13,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
  },
  cookingRecipeName: {
    fontSize: 14,
    color: colors.textMid,
    fontFamily: "system-ui, sans-serif",
    marginBottom: 12,
    textAlign: "center",
  },
  cookingProgress: {
    display: "flex",
    gap: 3,
    marginBottom: 24,
  },
  cookingStepContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    textAlign: "center",
  },
  cookingStepNumber: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.accent,
    fontFamily: "system-ui, sans-serif",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  cookingStepText: {
    fontSize: 22,
    lineHeight: 1.5,
    color: colors.text,
    fontFamily: "'Georgia', serif",
    margin: 0,
    fontWeight: 500,
  },
  cookingTimerBtn: {
    marginTop: 20,
    padding: "10px 20px",
    borderRadius: 12,
    border: `1.5px solid ${colors.accent}`,
    background: "transparent",
    color: colors.accent,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cookingNav: {
    display: "flex",
    gap: 12,
    marginTop: 20,
  },
  cookingNavBtn: {
    flex: 1,
    padding: "14px 16px",
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    background: colors.card,
    fontSize: 15,
    fontWeight: 600,
    color: colors.textMid,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "system-ui, sans-serif",
  },
  cookingNavBtnPrimary: {
    background: colors.accent,
    color: "#fff",
    borderColor: colors.accent,
  },

  // ─── Timer Pill ───
  timerPillContainer: {
    position: "fixed",
    bottom: 90,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 150,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
  },
  timerPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 20,
    background: colors.text,
    color: colors.bg,
    fontSize: 13,
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    backdropFilter: "blur(8px)",
    whiteSpace: "nowrap",
  },
  timerPillLabel: {
    maxWidth: 100,
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    opacity: 0.8,
  },
  timerPillTime: {
    fontVariantNumeric: "tabular-nums",
    fontSize: 15,
    fontWeight: 700,
    minWidth: 36,
  },
  timerPillBtn: {
    background: "none",
    border: "none",
    color: colors.bg,
    fontSize: 14,
    cursor: "pointer",
    padding: "0 2px",
    opacity: 0.8,
  },

  // ─── Bottom Sheet ───
  bottomSheetBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 300,
    animation: "backdropFadeIn 0.2s ease",
  },
  bottomSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: 480,
    margin: "0 auto",
    background: colors.card,
    borderRadius: "20px 20px 0 0",
    padding: "12px 20px calc(20px + env(safe-area-inset-bottom))",
    zIndex: 301,
    animation: "bottomSheetUp 0.3s ease",
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: colors.border,
    margin: "0 auto 16px",
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.text,
    fontFamily: "'Georgia', serif",
    marginBottom: 16,
    textAlign: "center",
  },
  bottomSheetAction: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 4px",
    background: "none",
    border: "none",
    borderTop: `1px solid ${colors.border}`,
    fontSize: 15,
    fontWeight: 500,
    color: colors.text,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    textAlign: "left",
  },

  // ─── Sort Pills ───
  sortPill: {
    flexShrink: 0,
    padding: "5px 11px",
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    background: "transparent",
    color: colors.textLight,
    fontSize: 11,
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  sortPillActive: {
    background: colors.warmDark,
    color: colors.text,
    borderColor: colors.warmDark,
  },

  // ─── Recently Viewed ───
  recentRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 12,
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
    flexShrink: 0,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recentItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  },
  recentAvatar: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: colors.warm,
    border: `2px solid ${colors.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  recentName: {
    fontSize: 10,
    color: colors.textLight,
    fontFamily: "system-ui, sans-serif",
    maxWidth: 52,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
