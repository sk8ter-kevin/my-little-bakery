import { STORAGE_KEY } from "../utils/constants";

export const loadData = async () => {
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

export const saveData = async (data) => {
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
