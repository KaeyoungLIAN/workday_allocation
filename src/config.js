const DEFAULT_CONFIG = {
  positions: [
    { id: "pos_a", name: "A", minStaff: 2 },
    { id: "pos_b", name: "B", minStaff: 2 },
    { id: "pos_c", name: "C", minStaff: 1 },
    { id: "pos_d", name: "D", minStaff: 1 },
  ],
  workers: [],
};

const STORAGE_KEY = "wd_alloc_config";

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
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

export function importConfig(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.positions || !data.workers) {
          reject(new Error("Invalid config format"));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error("Invalid JSON"));
      }
    };
    reader.readAsText(file);
  });
}
