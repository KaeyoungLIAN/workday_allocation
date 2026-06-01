const STORAGE_KEY = "wd_workers";
const POS_STORAGE_KEY = "wd_positions";

const DEFAULT_POSITIONS = [
  { id: "pos_dt", name: "大堂", minStaff: 2, maxStaff: 2 },
  { id: "pos_xj", name: "现金柜员", minStaff: 1, maxStaff: 1 },
  { id: "pos_pt", name: "普通柜员", minStaff: 1, maxStaff: 2 },
  { id: "pos_sq", name: "授权岗", minStaff: 1, maxStaff: 1 },
];

let nextPosId = Date.now();

export function loadPositions() {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  // 首次使用：写入默认值到 storage 并返回
  savePositions(DEFAULT_POSITIONS);
  return DEFAULT_POSITIONS;
}

export function savePositions(positions) {
  localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(positions));
}

export function resetPositions() {
  savePositions(DEFAULT_POSITIONS);
  return DEFAULT_POSITIONS;
}

export function generatePosId() {
  nextPosId += 1;
  return `pos_custom_${nextPosId}`;
}

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
