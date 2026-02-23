// ─── URL Recipe Importer ───
// Fetches recipe pages via CORS proxy and extracts structured data (JSON-LD)
// Falls back to text parsing when structured data isn't available

import { parseRecipeText } from "./recipeParser";

const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// ── Fetch HTML from URL via CORS proxy ──
const fetchPageHtml = async (url) => {
    const resp = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (!resp.ok) throw new Error("FETCH_FAILED");
    return resp.text();
};

// ── Extract JSON-LD from HTML using DOMParser ──
const extractJsonLd = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const results = [];
    for (const script of scripts) {
        try {
            results.push(JSON.parse(script.textContent));
        } catch { /* skip malformed JSON-LD */ }
    }
    return results;
};

// ── Find Recipe object in JSON-LD data ──
const findRecipe = (jsonLdArray) => {
    for (const data of jsonLdArray) {
        if (data?.["@type"] === "Recipe") return data;
        if (Array.isArray(data?.["@type"]) && data["@type"].includes("Recipe")) return data;
        if (Array.isArray(data?.["@graph"])) {
            const found = data["@graph"].find(
                (item) => item?.["@type"] === "Recipe" || (Array.isArray(item?.["@type"]) && item["@type"].includes("Recipe"))
            );
            if (found) return found;
        }
        if (Array.isArray(data)) {
            const found = data.find(
                (item) => item?.["@type"] === "Recipe" || (Array.isArray(item?.["@type"]) && item["@type"].includes("Recipe"))
            );
            if (found) return found;
        }
    }
    return null;
};

// ── Parse ISO 8601 duration (PT1H30M) to minutes ──
const parseDuration = (duration) => {
    if (!duration || typeof duration !== "string") return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;
    return (parseInt(match[1] || 0) * 60) + parseInt(match[2] || 0);
};

// ── Parse image from JSON-LD (handles string, array, ImageObject) ──
const parseImage = (image) => {
    if (!image) return null;
    if (typeof image === "string") return image;
    if (Array.isArray(image)) return typeof image[0] === "string" ? image[0] : image[0]?.url || null;
    return image.url || null;
};

// ── Unit normalization map ──
const UNIT_MAP = {
    cup: "cups", cups: "cups", c: "cups",
    tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbs: "tbsp",
    teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp",
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
    stick: "sticks", sticks: "sticks",
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

// ── Parse a single ingredient string from JSON-LD ──
const parseIngredient = (text) => {
    const cleaned = text.replace(/^[\s\u2022\u2023\u25E6\-\*]+/, "").trim();
    if (!cleaned) return null;

    const unitPattern = "cups?|tablespoons?|tbsp?|tbs|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|lb|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|pieces?|pcs|pinch(?:es)?|whole|slices?|cloves?|cans?|sticks?|large|medium|small|dash(?:es)?|c\\b";
    const regex = new RegExp(`^([\\d\\s\\/\\u00BC-\\u00BE\\u2150-\\u215E.]+)?\\s*(${unitPattern})\\.?\\s+(.+)`, "i");
    const match = cleaned.match(regex);

    if (match) {
        const amount = match[1] ? parseFraction(match[1]) : 1;
        const rawUnit = (match[2] || "").toLowerCase().replace(/\.$/, "");
        const unit = UNIT_MAP[rawUnit] || "whole";
        const name = (match[3] || cleaned).replace(/,\s*$/, "").trim();
        return { amount: Math.round(amount * 1000) / 1000, unit, name };
    }

    const numStart = cleaned.match(/^([\d\s\/\u00BC-\u00BE\u2150-\u215E.]+)\s+(.+)/);
    if (numStart) {
        return { amount: Math.round(parseFraction(numStart[1]) * 1000) / 1000, unit: "whole", name: numStart[2].replace(/,\s*$/, "").trim() };
    }

    return { amount: 1, unit: "whole", name: cleaned };
};

// ── Parse instructions from JSON-LD (handles string, array, HowToStep) ──
const parseInstructions = (instructions) => {
    if (!instructions) return "";
    if (typeof instructions === "string") return instructions;
    if (Array.isArray(instructions)) {
        const steps = [];
        for (const item of instructions) {
            if (typeof item === "string") {
                steps.push(item);
            } else if (item?.["@type"] === "HowToStep") {
                steps.push(item.text || item.name || "");
            } else if (item?.["@type"] === "HowToSection") {
                const sectionSteps = item.itemListElement || [];
                for (const s of sectionSteps) {
                    steps.push(s.text || s.name || (typeof s === "string" ? s : ""));
                }
            }
        }
        return steps
            .filter((s) => s.trim())
            .map((s, i) => `${i + 1}. ${s.replace(/^\d+[\.\)]\s*/, "").trim()}`)
            .join("\n");
    }
    return "";
};

// ── Guess category from recipe name + ingredients ──
const guessCategory = (name, ingredientNames) => {
    const combined = (name + " " + ingredientNames.join(" ")).toLowerCase();
    if (/cookie|biscuit/.test(combined)) return "Cookies";
    if (/cake|cupcake|bundt/.test(combined)) return "Cakes";
    if (/bread|loaf|roll|bun|sourdough|yeast/.test(combined)) return "Bread";
    if (/brownie|blondie|bar/.test(combined)) return "Brownies & Bars";
    if (/pie|tart|galette|crust/.test(combined)) return "Pies & Tarts";
    if (/pastry|croissant|puff|danish|eclair|choux/.test(combined)) return "Pastries";
    if (/pancake|waffle|scone|muffin|breakfast|brunch|granola|oatmeal/.test(combined)) return "Breakfast";
    return "Other";
};

// ── Auto-generate tags ──
const autoTags = (name, ingredientNames, category) => {
    const tags = new Set();
    tags.add(category.toLowerCase().replace(/ & /g, "-"));
    const keywords = ["chocolate", "vanilla", "lemon", "blueberry", "strawberry", "apple", "banana", "cinnamon", "peanut butter", "cream cheese", "pumpkin", "caramel", "coconut", "honey", "oat", "almond", "pecan", "walnut", "raspberry", "cherry", "ginger", "maple", "nutella"];
    const nameLow = name.toLowerCase();
    const allText = nameLow + " " + ingredientNames.join(" ").toLowerCase();
    for (const kw of keywords) {
        if (allText.includes(kw)) tags.add(kw);
    }
    return [...tags].slice(0, 6);
};

// ── Strip HTML to plain text (fallback when no JSON-LD) ──
const stripHtmlToText = (html) => {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
        .replace(/ {2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

// ── Parse yield/servings from JSON-LD ──
const parseServings = (recipeYield) => {
    if (!recipeYield) return 12;
    if (typeof recipeYield === "number") return recipeYield;
    const str = Array.isArray(recipeYield) ? recipeYield[0] : recipeYield;
    const match = String(str).match(/(\d+)/);
    return match ? parseInt(match[1]) : 12;
};

// ── Main export: import recipe from a URL ──
export const importRecipeFromUrl = async (url) => {
    const html = await fetchPageHtml(url);

    // Try JSON-LD structured data first
    const jsonLdData = extractJsonLd(html);
    const recipe = findRecipe(jsonLdData);

    if (recipe) {
        const name = recipe.name || "Imported Recipe";
        const ingredients = (recipe.recipeIngredient || []).map(parseIngredient).filter(Boolean);
        const instructions = parseInstructions(recipe.recipeInstructions);
        const servings = parseServings(recipe.recipeYield);
        const prepTime = parseDuration(recipe.prepTime) || 15;
        const cookTime = parseDuration(recipe.cookTime) || 20;
        const photo = parseImage(recipe.image);
        const ingredientNames = ingredients.map((i) => i.name);
        const category = guessCategory(name, ingredientNames);
        const tags = autoTags(name, ingredientNames, category);
        const notes = recipe.description || "";

        return {
            name,
            category,
            servings,
            prepTime,
            cookTime,
            ingredients: ingredients.length > 0 ? ingredients : [{ name: "", amount: 1, unit: "cups" }],
            instructions,
            tags,
            favorite: false,
            lastMade: null,
            notes,
            photo,
        };
    }

    // Fallback: strip HTML to text and use the text parser
    const text = stripHtmlToText(html);
    if (text.length < 50) throw new Error("NO_RECIPE");
    return parseRecipeText(text);
};
