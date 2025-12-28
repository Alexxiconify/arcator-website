import {auth, COLLECTIONS, db, getDocs, query} from "./firebase-init.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let availableThemesCache = [];
const THEME_CACHE_KEY = "arcator_user_theme_preference";
const THEME_CACHE_TIMESTAMP_KEY = "arcator_theme_cache_timestamp";
const THEME_CACHE_DURATION = 24 * 60 * 60 * 1000;

const defaultThemes = [
  {
    id: "dark",
    name: "Dark Theme",
    description: "Default dark theme with blue accents",
    colors: {
      "--color-body-bg": "#1F2937",
      "--color-text-primary": "#E5E7EB",
      "--color-text-secondary": "#9CA3AF",
      "--color-bg-navbar": "#111827",
      "--color-bg-card": "#2D3748",
      "--color-bg-content-section": "#374151",
      "--color-bg-ip-box": "#1F2937",
      "--color-border-ip-box": "#4B5563",
      "--color-input-bg": "#374151",
      "--color-input-text": "#E5E7EB",
      "--color-input-border": "#4B5563",
      "--color-placeholder": "#9CA3AF",
      "--color-link": "#60A5FA",
      "--color-heading-main": "#F9FAFB",
      "--color-heading-card": "#E5E7EB",
      "--color-button-blue-bg": "#3B82F6",
      "--color-button-blue-hover": "#2563EB",
      "--color-button-green-bg": "#10B981",
      "--color-button-green-hover": "#059669",
      "--color-button-red-bg": "#EF4444",
      "--color-button-red-hover": "#DC2626",
      "--color-button-purple-bg": "#8B5CF6",
      "--color-button-purple-hover": "#7C3AED",
      "--color-button-yellow-bg": "#F59E0B",
      "--color-button-yellow-hover": "#D97706",
      "--color-button-indigo-bg": "#6366F1",
      "--color-button-indigo-hover": "#4F46E5",
      "--color-button-text": "#FFFFFF",
      "--color-table-th-bg": "#374151",
      "--color-table-th-text": "#F9FAFB",
      "--color-table-td-border": "#4B5563",
      "--color-table-row-even-bg": "#2D3748",
      "--color-modal-bg": "#374151",
      "--color-modal-text": "#E5E7EB",
      "--color-modal-input-bg": "#4B5563",
      "--color-modal-input-text": "#E5E7EB",
      "--color-message-box-bg-success": "#10B981",
      "--color-message-box-bg-error": "#EF4444",
      "--color-settings-card-bg": "#2D3748",
      "--color-settings-card-border": "#4B5563",
      "--color-table-col-even": "#374151",
      "--color-table-col-odd": "#2D3748",
    },
  },
  {
    id: "light",
    name: "Light Theme",
    description: "Clean light theme with dark text",
    colors: {
      "--color-body-bg": "#F3F4F6",
      "--color-text-primary": "#1F2937",
      "--color-text-secondary": "#6B7280",
      "--color-bg-navbar": "#FFFFFF",
      "--color-bg-card": "#FFFFFF",
      "--color-bg-content-section": "#F9FAFB",
      "--color-bg-ip-box": "#F3F4F6",
      "--color-border-ip-box": "#D1D5DB",
      "--color-input-bg": "#FFFFFF",
      "--color-input-text": "#1F2937",
      "--color-input-border": "#D1D5DB",
      "--color-placeholder": "#6B7280",
      "--color-link": "#3B82F6",
      "--color-heading-main": "#111827",
      "--color-heading-card": "#1F2937",
      "--color-button-blue-bg": "#3B82F6",
      "--color-button-blue-hover": "#2563EB",
      "--color-button-green-bg": "#10B981",
      "--color-button-green-hover": "#059669",
      "--color-button-red-bg": "#EF4444",
      "--color-button-red-hover": "#DC2626",
      "--color-button-purple-bg": "#8B5CF6",
      "--color-button-purple-hover": "#7C3AED",
      "--color-button-yellow-bg": "#F59E0B",
      "--color-button-yellow-hover": "#D97706",
      "--color-button-indigo-bg": "#6366F1",
      "--color-button-indigo-hover": "#4F46E5",
      "--color-button-text": "#FFFFFF",
      "--color-table-th-bg": "#F3F4F6",
      "--color-table-th-text": "#374151",
      "--color-table-td-border": "#E5E7EB",
      "--color-table-row-even-bg": "#F9FAFB",
      "--color-modal-bg": "#FFFFFF",
      "--color-modal-text": "#1F2937",
      "--color-modal-input-bg": "#F9FAFB",
      "--color-modal-input-text": "#1F2937",
      "--color-message-box-bg-success": "#10B981",
      "--color-message-box-bg-error": "#EF4444",
      "--color-settings-card-bg": "#FFFFFF",
      "--color-settings-card-border": "#E5E7EB",
      "--color-table-col-even": "#F3F4F6",
      "--color-table-col-odd": "#F9FAFB",
    },
  },
  {
    id: "arcator-green",
    name: "Arcator Green",
    description: "Arcator brand theme with green accents",
    colors: {
      "--color-body-bg": "#1a202c",
      "--color-text-primary": "#E2E8F0",
      "--color-text-secondary": "#94A3B8",
      "--color-bg-navbar": "#0f1419",
      "--color-bg-card": "#2b3b55",
      "--color-bg-content-section": "#374151",
      "--color-bg-ip-box": "#1a202c",
      "--color-border-ip-box": "#4B5563",
      "--color-input-bg": "#3b4d6b",
      "--color-input-text": "#E2E8F0",
      "--color-input-border": "#5a6e8f",
      "--color-placeholder": "#94A3B8",
      "--color-link": "#48BB78",
      "--color-heading-main": "#F9FAFB",
      "--color-heading-card": "#E2E8F0",
      "--color-button-blue-bg": "#48BB78",
      "--color-button-blue-hover": "#38A169",
      "--color-button-green-bg": "#48BB78",
      "--color-button-green-hover": "#38A169",
      "--color-button-red-bg": "#F56565",
      "--color-button-red-hover": "#E53E3E",
      "--color-button-purple-bg": "#9F7AEA",
      "--color-button-purple-hover": "#805AD5",
      "--color-button-yellow-bg": "#ED8936",
      "--color-button-yellow-hover": "#DD6B20",
      "--color-button-indigo-bg": "#667EEA",
      "--color-button-indigo-hover": "#5A67D8",
      "--color-button-text": "#FFFFFF",
      "--color-table-th-bg": "#374151",
      "--color-table-th-text": "#F9FAFB",
      "--color-table-td-border": "#4B5563",
      "--color-table-row-even-bg": "#2b3b55",
      "--color-modal-bg": "#374151",
      "--color-modal-text": "#E2E8F0",
      "--color-modal-input-bg": "#3b4d6b",
      "--color-modal-input-text": "#E2E8F0",
      "--color-message-box-bg-success": "#48BB78",
      "--color-message-box-bg-error": "#F56565",
      "--color-settings-card-bg": "#2b3b55",
      "--color-settings-card-border": "#4B5563",
      "--color-table-col-even": "#374151",
      "--color-table-col-odd": "#2b3b55",
    },
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    description: "Deep ocean theme with blue gradients",
    colors: {
      "--color-body-bg": "#0f172a",
      "--color-text-primary": "#E2E8F0",
      "--color-text-secondary": "#94A3B8",
      "--color-bg-navbar": "#020617",
      "--color-bg-card": "#1e293b",
      "--color-bg-content-section": "#334155",
      "--color-bg-ip-box": "#0f172a",
      "--color-border-ip-box": "#475569",
      "--color-input-bg": "#334155",
      "--color-input-text": "#E2E8F0",
      "--color-input-border": "#475569",
      "--color-placeholder": "#94A3B8",
      "--color-link": "#60A5FA",
      "--color-heading-main": "#F8FAFC",
      "--color-heading-card": "#E2E8F0",
      "--color-button-blue-bg": "#3B82F6",
      "--color-button-blue-hover": "#2563EB",
      "--color-button-green-bg": "#10B981",
      "--color-button-green-hover": "#059669",
      "--color-button-red-bg": "#EF4444",
      "--color-button-red-hover": "#DC2626",
      "--color-button-purple-bg": "#8B5CF6",
      "--color-button-purple-hover": "#7C3AED",
      "--color-button-yellow-bg": "#F59E0B",
      "--color-button-yellow-hover": "#D97706",
      "--color-button-indigo-bg": "#6366F1",
      "--color-button-indigo-hover": "#4F46E5",
      "--color-button-text": "#FFFFFF",
      "--color-table-th-bg": "#334155",
      "--color-table-th-text": "#F8FAFC",
      "--color-table-td-border": "#475569",
      "--color-table-row-even-bg": "#1e293b",
      "--color-modal-bg": "#334155",
      "--color-modal-text": "#E2E8F0",
      "--color-modal-input-bg": "#475569",
      "--color-modal-input-text": "#E2E8F0",
      "--color-message-box-bg-success": "#10B981",
      "--color-message-box-bg-error": "#EF4444",
      "--color-settings-card-bg": "#1e293b",
      "--color-settings-card-border": "#475569",
      "--color-table-col-even": "#334155",
      "--color-table-col-odd": "#1e293b",
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "High contrast theme for accessibility",
    colors: {
      "--color-body-bg": "#000000",
      "--color-text-primary": "#FFFFFF",
      "--color-text-secondary": "#CCCCCC",
      "--color-bg-navbar": "#000000",
      "--color-bg-card": "#1a1a1a",
      "--color-bg-content-section": "#2d2d2d",
      "--color-bg-ip-box": "#000000",
      "--color-border-ip-box": "#FFFFFF",
      "--color-input-bg": "#1a1a1a",
      "--color-input-text": "#FFFFFF",
      "--color-input-border": "#FFFFFF",
      "--color-placeholder": "#CCCCCC",
      "--color-link": "#FFFF00",
      "--color-heading-main": "#FFFFFF",
      "--color-heading-card": "#FFFFFF",
      "--color-button-blue-bg": "#0066CC",
      "--color-button-blue-hover": "#0052A3",
      "--color-button-green-bg": "#00CC00",
      "--color-button-green-hover": "#00A300",
      "--color-button-red-bg": "#CC0000",
      "--color-button-red-hover": "#A30000",
      "--color-button-purple-bg": "#6600CC",
      "--color-button-purple-hover": "#5200A3",
      "--color-button-yellow-bg": "#CCCC00",
      "--color-button-yellow-hover": "#A3A300",
      "--color-button-indigo-bg": "#0000CC",
      "--color-button-indigo-hover": "#0000A3",
      "--color-button-text": "#FFFFFF",
      "--color-table-th-bg": "#2d2d2d",
      "--color-table-th-text": "#FFFFFF",
      "--color-table-td-border": "#FFFFFF",
      "--color-table-row-even-bg": "#1a1a1a",
      "--color-modal-bg": "#2d2d2d",
      "--color-modal-text": "#FFFFFF",
      "--color-modal-input-bg": "#1a1a1a",
      "--color-modal-input-text": "#FFFFFF",
      "--color-message-box-bg-success": "#00CC00",
      "--color-message-box-bg-error": "#CC0000",
      "--color-settings-card-bg": "#1a1a1a",
      "--color-settings-card-border": "#FFFFFF",
      "--color-table-col-even": "#2d2d2d",
      "--color-table-col-odd": "#1a1a1a",
    },
  },
];

export function setupThemesFirebase() {

  return true;
}

async function fetchCustomThemes() {
  try {
    if (!db) return [];

      if (!db) {
          console.error("Firestore instance not initialized");
          return [];
      }

    const themesRef = collection(db, COLLECTIONS.THEMES);
    const customThemesQuery = query(
        themesRef,
      where("isActive", "==", true)
    );
    const querySnapshot = await getDocs(customThemesQuery);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isCustom: true
    }));
  } catch (error) {
    console.error("Error fetching custom themes:", error);
    return [];
  }
}

export async function getAvailableThemes(forceRefresh = false) {
  if (availableThemesCache.length > 0 && !forceRefresh) {
    return availableThemesCache;
  }

  const customThemes = await fetchCustomThemes();
  availableThemesCache = [...defaultThemes, ...customThemes];
  return availableThemesCache;
}

export function applyTheme(themeId, themeProperties) {
  if (!themeProperties || !themeProperties.colors) {
    console.error("Invalid theme properties provided");
    return false;
  }

  const root = document.documentElement;
  const colors = themeProperties.colors;

  if (themeProperties.backgroundPattern) {
    root.className = root.className.replace(/pattern-\w+/g, '');
    root.classList.add(`pattern-${themeProperties.backgroundPattern}`);
  }

  document.body.className = document.body.className.replace(/theme-\w+/g, '');
  document.body.classList.add(`theme-${themeId}`);

  localStorage.setItem(THEME_CACHE_KEY, themeId);
  localStorage.setItem(THEME_CACHE_TIMESTAMP_KEY, Date.now().toString());

  return true;
}

auth.currentUser = undefined;

export async function saveCustomTheme(themeData) {
  try {
    if (!db || !auth.currentUser) return false;

    const themeDoc = {
      ...themeData,
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.THEMES), themeDoc);

    availableThemesCache = [];
    return docRef.id;
  } catch (error) {
    console.error("Error saving custom theme:", error);
    return false;
  }
}

export async function deleteCustomTheme(themeId) {
  try {
    if (!db) return false;

    await deleteDoc(doc(db, COLLECTIONS.THEMES, themeId));
    availableThemesCache = availableThemesCache.filter(theme => theme.id !== themeId);
    return true;
  } catch (error) {
    console.error("Error deleting custom theme:", error);
    return false;
  }
}

export async function initializeGlobalThemes() {
  try {
    if (!db) return false;

    const themesCollection = collection(db, COLLECTIONS.THEMES);
    const querySnapshot = await getDocs(themesCollection);

    if (querySnapshot.empty) {
      return true;
    }

    return true;
  } catch (error) {
    console.error("Error initializing global themes:", error);
    return false;
  }
}

export function cacheUserTheme(themeId, userId = null) {
  const cacheKey = userId ? `${THEME_CACHE_KEY}_${userId}` : THEME_CACHE_KEY;
  const timestampKey = userId ? `${THEME_CACHE_TIMESTAMP_KEY}_${userId}` : THEME_CACHE_TIMESTAMP_KEY;

  localStorage.setItem(cacheKey, themeId);
  localStorage.setItem(timestampKey, Date.now().toString());
}

export function getCachedTheme(userId = null) {
  const cacheKey = userId ? `${THEME_CACHE_KEY}_${userId}` : THEME_CACHE_KEY;
  const timestampKey = userId ? `${THEME_CACHE_TIMESTAMP_KEY}_${userId}` : THEME_CACHE_TIMESTAMP_KEY;

    const cachedTheme = localStorage.getItem(cacheKey);
  const timestamp = localStorage.getItem(timestampKey);

    if (!cachedTheme || !timestamp) return null;

    const age = Date.now() - parseInt(timestamp);
  if (age > THEME_CACHE_DURATION) {
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(timestampKey);
    return null;
  }

    return cachedTheme;
}

export function clearCachedTheme() {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(THEME_CACHE_KEY) || key.startsWith(THEME_CACHE_TIMESTAMP_KEY)) {
      localStorage.removeItem(key);
    }
  });
}

export function applyCachedTheme() {
  const cachedThemeId = getCachedTheme();
    if (!cachedThemeId) return Promise.resolve(false);
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            getAvailableThemes().then(themes => {
                const theme = themes.find(t => t.id === cachedThemeId);
                if (theme) applyTheme(theme.id, theme);
            });
        }, {timeout: 100});
    } else {
        setTimeout(() => {
            getAvailableThemes().then(themes => {
                const theme = themes.find(t => t.id === cachedThemeId);
                if (theme) applyTheme(theme.id, theme);
            });
        }, 0);
  }
    return Promise.resolve(true);
}