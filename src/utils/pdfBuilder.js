// ─── PDF Builder ───
export const buildRecipePdf = (recipe) => {
    // Lightweight PDF generator — uses only built-in Helvetica fonts
    const PAGE_W = 612, PAGE_H = 792; // US Letter in points
    const ML = 54, MR = 54, MT = 60, MB = 60;
    const ACCENT = "0.831 0.467 0.357"; // #d4775b in RGB 0-1

    let objects = [];
    let pageStreams = [];
    let currentStream = "";
    let y = PAGE_H - MT;

    const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

    const newPage = () => {
        if (currentStream) pageStreams.push(currentStream);
        currentStream = "";
        y = PAGE_H - MT;
    };

    const checkSpace = (needed) => { if (y - needed < MB) newPage(); };

    const textLine = (text, size, font, x = ML) => {
        checkSpace(size + 4);
        currentStream += `BT /${font} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET\n`;
        y -= size + 4;
    };

    const colorText = (text, size, font, r, g, b, x = ML) => {
        checkSpace(size + 4);
        currentStream += `BT ${r} ${g} ${b} rg /${font} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET\n`;
        y -= size + 4;
    };

    // Wrap long text to fit within content width — approximate char width
    const wrapText = (text, size, charsPerLine) => {
        const words = text.split(" ");
        const lines = [];
        let line = "";
        for (const word of words) {
            if (line && (line + " " + word).length > charsPerLine) {
                lines.push(line);
                line = word;
            } else {
                line = line ? line + " " + word : word;
            }
        }
        if (line) lines.push(line);
        return lines;
    };

    const hLine = () => {
        checkSpace(12);
        currentStream += `0.9 0.87 0.82 RG 0.5 w ${ML} ${y} m ${PAGE_W - MR} ${y} l S\n`;
        y -= 12;
    };

    // ── Title
    const titleLines = wrapText(recipe.name, 22, 35);
    currentStream += `${ACCENT} rg\n`;
    for (const line of titleLines) {
        checkSpace(26);
        currentStream += `BT /HB 22 Tf ${ML} ${y} Td (${esc(line)}) Tj ET\n`;
        y -= 26;
    }
    currentStream += `0 0 0 rg\n`;
    y -= 4;

    // ── Category
    if (recipe.category) {
        colorText(recipe.category, 11, "H", 0.5, 0.45, 0.4);
        y -= 2;
    }

    // ── Metadata row
    const meta = [];
    if (recipe.prepTime) meta.push(`Prep: ${recipe.prepTime}m`);
    if (recipe.cookTime) meta.push(`Cook: ${recipe.cookTime}m`);
    if (recipe.servings) meta.push(`Servings: ${recipe.servings}`);
    if (meta.length) {
        textLine(meta.join("   |   "), 10, "H");
        y -= 2;
    }

    hLine();

    // ── Ingredients
    colorText("Ingredients", 14, "HB", ...ACCENT.split(" ").map(Number));
    y -= 4;
    for (const ing of recipe.ingredients || []) {
        const amt = ing.amount ? `${+(+ing.amount).toFixed(2)} ${ing.unit || ""}`.trim() : "";
        const line = amt ? `${amt}  ${ing.name}` : ing.name;
        const wrapped = wrapText(line, 10, 75);
        for (let i = 0; i < wrapped.length; i++) {
            textLine((i === 0 ? "\u2022  " : "    ") + wrapped[i], 10, i === 0 && amt ? "HB" : "H", ML + 4);
        }
    }

    y -= 4;
    hLine();

    // ── Instructions
    colorText("Instructions", 14, "HB", ...ACCENT.split(" ").map(Number));
    y -= 4;
    const steps = (recipe.instructions || "").split("\n").filter((s) => s.trim());
    for (const step of steps) {
        const wrapped = wrapText(step, 10, 75);
        for (const wl of wrapped) {
            textLine(wl, 10, "H", ML + 4);
        }
        y -= 3;
    }

    // ── Notes
    if (recipe.notes) {
        y -= 4;
        hLine();
        colorText("Notes", 14, "HB", ...ACCENT.split(" ").map(Number));
        y -= 4;
        const noteLines = wrapText(recipe.notes, 10, 75);
        for (const nl of noteLines) {
            textLine(nl, 10, "HI", ML + 4);
        }
    }

    // ── Tags
    if (recipe.tags?.length) {
        y -= 8;
        textLine(recipe.tags.map((t) => `#${t}`).join("  "), 9, "H");
    }

    // ── Footer
    y -= 16;
    const footerText = `From My Little Bakery`;
    colorText(footerText, 8, "H", 0.6, 0.55, 0.5);

    // Finish last page
    pageStreams.push(currentStream);

    // ── Assemble PDF
    let objIdx = 0;
    const addObj = (content) => { objIdx++; objects.push(content); return objIdx; };

    // 1: Catalog
    addObj("");
    // 2: Pages
    addObj("");
    // 3: Helvetica
    addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    // 4: Helvetica-Bold
    addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    // 5: Helvetica-Oblique
    addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");

    const pageObjIds = [];
    for (const stream of pageStreams) {
        const streamBytes = new TextEncoder().encode(stream);
        const streamId = addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`);
        const pageId = addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${streamId} 0 R /Resources << /Font << /H 3 0 R /HB 4 0 R /HI 5 0 R >> >> >>`);
        pageObjIds.push(pageId);
    }

    objects[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objects[1] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`;

    // Build raw PDF bytes
    let pdf = "%PDF-1.4\n";
    const offsets = [];
    for (let i = 0; i < objects.length; i++) {
        offsets.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
        pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Uint8Array([...new TextEncoder().encode(pdf)]);
};
