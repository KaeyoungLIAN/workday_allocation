const WORKERS_KEY = "wd_workers";
const POS_STORAGE_KEY = "wd_positions";
const PRIORITY_STORAGE_KEY = "wd_pos_priorities";

const DEFAULT_POSITIONS = [
  { id: "pos_dt", name: "大堂", minStaff: 2, maxStaff: 2 },
  { id: "pos_xj", name: "现金柜员", minStaff: 1, maxStaff: 1 },
  { id: "pos_pt", name: "普通柜员", minStaff: 1, maxStaff: 2 },
  { id: "pos_sq", name: "授权岗", minStaff: 1, maxStaff: 1 },
];

let nextPosId = Date.now();

/** 根据岗位列表生成默认的每日优先级表 */
export function getDefaultPriorities(positions) {
  const p = {};
  for (const pos of positions) {
    // [周一, 周二, 周三, 周四, 周五, 周六, 周日]
    const arr = new Array(7).fill(9);
    arr[5] = 0; // 周六全体休息
    if (pos.id === "pos_dt") {
      // 大堂优先最高，周日也是
      for (let i = 0; i < 5; i++) arr[i] = 1;
      arr[6] = 1;
    } else if (pos.id === "pos_xj") {
      for (let i = 0; i < 5; i++) arr[i] = 2;
      arr[6] = 2;
    } else if (pos.id === "pos_pt") {
      for (let i = 0; i < 5; i++) arr[i] = 3;
      arr[6] = 3;
    } else if (pos.id === "pos_sq") {
      // 授权岗周中 0（不需要），周日 3
      for (let i = 0; i < 5; i++) arr[i] = 0;
      arr[6] = 3;
    }
    p[pos.id] = arr;
  }
  return p;
}

export function loadPriorities(positions) {
  try {
    const raw = localStorage.getItem(PRIORITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 校验结构：确保每个岗位都有
      const result = { ...parsed };
      let needSave = false;
      for (const pos of positions) {
        if (!result[pos.id] || !Array.isArray(result[pos.id]) || result[pos.id].length !== 7) {
          needSave = true;
          break;
        }
      }
      if (!needSave) {
        // 确保多余的非当前岗位被清理？没必要，多余的只会在 bug 时残留
        return result;
      }
    }
  } catch {}
  // 首次或结构不对重新生成
  const def = getDefaultPriorities(positions);
  savePriorities(def);
  return def;
}

export function savePriorities(priorities) {
  localStorage.setItem(PRIORITY_STORAGE_KEY, JSON.stringify(priorities));
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

/**
 * 根据岗位配置生成预设职员（首次使用）
 * 每个岗位按 maxStaff 生成足量人员，每人只做一个岗
 */
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

/** Migrate legacy worker format */
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
