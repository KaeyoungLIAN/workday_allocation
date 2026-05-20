const STORAGE_KEY = "wd_workers";

/** Migrate legacy worker format (positionIds) to new format (positions array). */
function migrateWorker(w) {
  if (!w) return w;

  // v2 format already
  if (w.positions && Array.isArray(w.positions)) return w;

  // v1 format: positionIds string[] + optional positionPriorities map
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

export function loadWorkers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(migrateWorker);
    }
  } catch {}
  return [];
}

export function saveWorkers(workers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workers));
}

export function exportWorkers(workers) {
  const blob = new Blob([JSON.stringify(workers, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workday_workers.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function copyWorkers(workers) {
  navigator.clipboard.writeText(JSON.stringify(workers, null, 2));
}

export function importWorkers(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error("需为人员数组");
        resolve(data.map(migrateWorker));
      } catch (err) {
        reject(new Error("导入失败: " + err.message));
      }
    };
    reader.readAsText(file);
  });
}

export function importWorkersFromText(text) {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("需为人员数组");
    return data.map(migrateWorker);
  } catch (err) {
    throw err.message ? err : new Error("Invalid JSON");
  }
}
