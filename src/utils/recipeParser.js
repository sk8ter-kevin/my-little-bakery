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

// ── Filter out recipe metadata / UI junk lines that aren't ingredients ──
const METADATA_LINE_RE = /^(prep|cook|total|course|cuisine|servings?|calories?|yield|makes?|author|submitted|rated?|rating|reviews?|print|save|share|pin|jump to|skip to|advertisement|sponsored|nutrition(?:al)?\s*(?:info|facts)?|keywords?|description|summary|equipment|tools needed)\b/i;
const METADATA_COMBO_RE = /^(prep\s+cook\s+total|course\s+cuisine|servings?\s+calories?|prep\s+time|cook\s+time|total\s+time)\s*$/i;
const TIME_ONLY_RE = /^(\d+\s*(mins?|minutes?|hrs?|hours?|h|m)\s*)+$/i;
const SUB_SECTION_RE = /^(for\s+the\s+.+|fillings?|toppings?|frosting|icing|glaze|ganache|garnish|assembly|decoration|sauce|crust|base|meringue|batter|dough|filling ingredients?|macaron shells?)\s*:?\s*$/i;

const isJunkIngredientLine = (line) => {
    const l = line.trim();
    if (METADATA_LINE_RE.test(l)) return true;
    if (METADATA_COMBO_RE.test(l)) return true;
    if (TIME_ONLY_RE.test(l)) return true;
    if (SUB_SECTION_RE.test(l)) return true;
    // Pure numbers with units of time (e.g. "5 mins 15 mins 20 mins")
    if (/^\d+\s*(mins?|minutes?|hrs?|hours?)\s+\d+\s*(mins?|minutes?|hrs?|hours?)/i.test(l)) return true;
    // Very short all-caps lines that look like labels (e.g. "COURSE", "SERVINGS")
    if (l.length < 20 && /^[A-Z\s]+$/.test(l) && !/[a-z]/.test(l) && l.split(/\s+/).length <= 3) {
        const words = l.toLowerCase().split(/\s+/);
        const metaWords = ["prep", "cook", "total", "course", "cuisine", "servings", "calories", "time", "yield", "makes", "nutrition", "print", "save", "share"];
        if (words.some((w) => metaWords.includes(w))) return true;
    }
    return false;
};

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
    if (isJunkIngredientLine(l)) return null;
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

export const parseRecipeText = (rawText) => {
    const text = rawText.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/ {2,}/g, " ").trim();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    // ── Section detection patterns ──
    const sectionPatterns = {
        ingredients: /^(ingredients|what you.?ll need|you.?ll need|shopping list)\s*:?\s*$/i,
        instructions: /^(instructions|directions|method|steps|preparation|how to make|procedure)\s*:?\s*$/i,
        notes: /^(notes|tips|chef.?s? notes?|cook.?s? notes?|variations?)\s*:?\s*$/i,
    };

    // ── Recipe name: first non-junk line (may span multiple lines) ──
    let name = "";
    let nameEndIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const low = line.toLowerCase();
        if (low.startsWith("http") || low.startsWith("www.")) continue;
        if (/^(print|skip to|jump to|home|menu|search|log ?in|sign ?up|advertisement)/i.test(low)) continue;
        if (isJunkIngredientLine(line)) continue;
        if (line.length > 3 && line.length < 120) {
            name = line.replace(/\s*recipe\s*$/i, "").trim();
            nameEndIdx = i;
            // Check if the next line continues the title (short, no numbers, not a section header, not metadata)
            for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
                const next = lines[j];
                if (!next || next.length > 40 || next.length < 2) break;
                if (isJunkIngredientLine(next)) break;
                if (/^[\d\u00BC-\u00BE\u2150-\u215E]/.test(next)) break;
                const isHeaderLike = Object.values(sectionPatterns).some((p) => p.test(next));
                if (isHeaderLike) break;
                name = (name + " " + next).trim();
                nameEndIdx = j;
            }
            break;
        }
    }

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
        .filter((l) => !isJunkIngredientLine(l))
        .map(parseIngredientLine)
        .filter(Boolean);

    // ── Parse instructions ──
    let instructions = sections.instructions
        .filter((l) => l.length > 3)
        .map((l, i) => `${i + 1}. ${l.replace(/^\d+[\.\\)]\s*/, "").trim()}`)
        .join("\n");

    // ── Fallback heuristics when no headers found ──
    if (ingredients.length === 0 && !instructions) {
        const ingLines = [];
        const instrLines = [];
        for (const line of lines) {
            if (isJunkIngredientLine(line)) continue;
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
                .map((l, i) => `${i + 1}. ${l.replace(/^\d+[\.\\)]\s*/, "").trim()}`)
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

