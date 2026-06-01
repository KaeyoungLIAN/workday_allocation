const WORKERS_KEY = "wd_workers";
const POS_STORAGE_KEY = "wd_positions";
const ORDER_STORAGE_KEY = "wd_pos_order";

const DEFAULT_POSITIONS = [
  { id: "pos_dt", name: "大堂", minStaff: 2, maxStaff: 2 },
  { id: "pos_xj", name: "现金柜员", minStaff: 1, maxStaff: 1 },
  { id: "pos_pt", name: "普通柜员", minStaff: 1, maxStaff: 2 },
  { id: "pos_sq", name: "授权岗", minStaff: 1, maxStaff: 1 },
];

let nextPosId = Date.now();

/** 生成默认排序：周中岗位列表、周日岗位列表 */
export function getDefaultOrders(positions) {
  const orders = {};
  for (let day = 0; day < 7; day++) {
    if (day === 5) continue; // 周六跳过
    const list = [];
    for (const pos of positions) {
      if (pos.id === "pos_sq" && day >= 0 && day <= 4) continue; // 授权周中不需要
      list.push(pos.id);
    }
    orders[String(day)] = list;
  }
  return orders;
}

export function loadOrders(positions) {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 校验：每个工作日都存在且有内容
      const valid = [0, 1, 2, 3, 4, 6].every((d) => {
        const arr = parsed[String(d)];
        return Array.isArray(arr) && arr.length > 0;
      });
      if (valid) return parsed;
    }
  } catch {}
  const def = getDefaultOrders(positions);
  saveOrders(def);
  return def;
}

export function saveOrders(orders) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
}

export function loadPositions() {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  savePositions(DEFAULT_POSITIONS);
  return [...DEFAULT_POSITIONS];
}

export function savePositions(positions) {
  localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(positions));
}

export function generatePosId() {
  nextPosId += 1;
  return `pos_custom_${nextPosId}`;
}

export function getDefaultWorkers(positions) {
  const workers = [];
  let id = Date.now();
  for (const pos of positions) {
    for (let i = 0; i < pos.maxStaff; i++) {
      const name = pos.name === "授权岗" && i === 0
        ? "授权岗"
        : `${pos.name}${i + 1}`;
      workers.push({
        id: id++,
        name,
        positions: [{ id: pos.id, priority: 1 }],
        offDays: [],
      });
    }
  }
  return workers;
}

function migrateWorker(w) {
  if (!w) return w;
  if (w.positions && Array.isArray(w.positions)) return w;
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
    const raw = localStorage.getItem(WORKERS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(migrateWorker);
    }
  } catch {}
  return [];
}

export function saveWorkers(workers) {
  localStorage.setItem(WORKERS_KEY, JSON.stringify(workers));
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
