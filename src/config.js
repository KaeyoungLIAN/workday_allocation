const DEFAULT_CONFIG = {
  positions: [
    { id: "pos_a", name: "A", minStaff: 2, importance: 3, sundayOnly: false },
    { id: "pos_b", name: "B", minStaff: 2, importance: 2, sundayOnly: false },
    { id: "pos_c", name: "C", minStaff: 1, importance: 1, sundayOnly: false },
    { id: "pos_d", name: "D", minStaff: 1, importance: 1, sundayOnly: false },
    { id: "pos_e", name: "E", minStaff: 1, importance: 5, sundayOnly: true },
  ],
  workers: [],
};

const STORAGE_KEY = "wd_alloc_config";

/** Migrate legacy worker format (positionIds + positionPriorities) to new format (positions array). */
function migrateWorker(w) {
  if (!w) return w;
  if (w.positions && Array.isArray(w.positions)) return w; // already new format
  const oldPosIds = w.positionIds || [];
  const oldPriorities = w.positionPriorities || {};
  w.positions = oldPosIds.map((id) => ({
    id,
    priority: oldPriorities[id] ?? 3,
  }));
  delete w.positionIds;
  delete w.positionPriorities;
  return w;
}

/** Migrate legacy position format (missing importance/sundayOnly). */
function migratePosition(p) {
  return {
    ...p,
    importance: p.importance ?? 1,
    sundayOnly: p.sundayOnly ?? false,
  };
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.positions = (data.positions || []).map(migratePosition);
      data.workers = (data.workers || []).map(migrateWorker);
      return data;
    }
  } catch {}
  return structuredClone(DEFAULT_CONFIG);
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function exportConfig(config) {
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workday_allocation_config.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function copyConfig(config) {
  navigator.clipboard.writeText(JSON.stringify(config, null, 2));
}

export function importConfig(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(validateAndResolve(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    };
    reader.readAsText(file);
  });
}

export function importConfigFromText(text) {
  try {
    const data = JSON.parse(text);
    return validateAndResolve(data);
  } catch (err) {
    throw err.message ? err : new Error("Invalid JSON");
  }
}

function validateAndResolve(data) {
  if (!data.positions || !data.workers) {
    throw new Error("Invalid config format");
  }
  data.positions = (data.positions || []).map(migratePosition);
  data.workers = (data.workers || []).map(migrateWorker);
  return data;
}
