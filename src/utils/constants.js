// ─── Storage key ───
export const STORAGE_KEY = "zions-recipes-v2";

// ─── Categories ───
export const CATEGORIES = [
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

// ─── Units ───
export const UNITS = ["cups", "tbsp", "tsp", "oz", "lb", "g", "ml", "large", "medium", "small", "whole", "pinch", "dash"];

// ─── Week days ───
export const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Emoji map for categories ───
export const EMOJI_MAP = {
  Cookies: "🍪",
  Cakes: "🎂",
  Breakfast: "🥞",
  Bread: "🍞",
  "Brownies & Bars": "🍫",
  "Pies & Tarts": "🥧",
  Pastries: "🥐",
  Other: "🧁",
};

// ─── Sample recipes to start with ───
export const SAMPLE_RECIPES = [
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

// ─── Color schemes ───
export const lightColors = {
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

export const darkColors = {
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
