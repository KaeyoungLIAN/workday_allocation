const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 固定 4 个岗位（不可变） */
export const FIXED_POSITIONS = [
  { id: "pos_dt", name: "大堂", minStaff: 2, maxStaff: 3 },
  { id: "pos_xj", name: "现金柜员", minStaff: 1, maxStaff: 1 },
  { id: "pos_pt", name: "普通柜员", minStaff: 1, maxStaff: 2 },
  { id: "pos_sq", name: "授权岗", minStaff: 1, maxStaff: 1 },
];

/** 雷打不动岗位（平日必须满 minStaff） */
const ESSENTIAL_IDS = new Set(["pos_dt", "pos_xj"]);

/**
 * 岗位的全局优先级（数字越小越优先）。
 * 注意：这里是"全局"优先级，决定先处理哪个岗位。
 * 同岗位内的人员选择由 per-worker priority 决定。
 */
function getGlobalPriority(posId, day) {
  const isWeekend = day === 6; // 周日
  const weekday = { pos_dt: 1, pos_xj: 1, pos_pt: 2, pos_sq: 3 };
  const weekend = { pos_dt: 1, pos_xj: 1, pos_sq: 1, pos_pt: 2 };
  return isWeekend ? (weekend[posId] ?? 9) : (weekday[posId] ?? 9);
}

/**
 * Generate a schedule for one week.
 * @param {object} config - { workers }
 * @returns {object} { [dayIndex]: { [positionId]: [workerName, ...] } }
 */
export function generateSchedule(config) {
  const { workers } = config;
  const schedule = {};

  for (let day = 0; day < 7; day++) {
    // 周六固定全体休息
    if (day === 5) {
      schedule[day] = {};
      continue;
    }

    const daySchedule = {};
    const assignedToday = new Set();

    // 按全局优先级排序
    const sorted = [...FIXED_POSITIONS].sort(
      (a, b) => getGlobalPriority(a.id, day) - getGlobalPriority(b.id, day)
    );

    for (const pos of sorted) {
      const available = workers.filter(
        (w) =>
          !w.offDays.includes(day) &&
          w.positions &&
          w.positions.some((p) => p.id === pos.id) &&
          !assignedToday.has(w.id)
      );

      // 按个人优先级（数字越小优先级越高，默认 3）
      available.sort((a, b) => {
        const priA = (a.positions || []).find((p) => p.id === pos.id)?.priority ?? 3;
        const priB = (b.positions || []).find((p) => p.id === pos.id)?.priority ?? 3;
        return priA - priB;
      });

      // 先尽量排满 maxStaff
      const assigned = available.slice(0, pos.maxStaff);
      assigned.forEach((w) => assignedToday.add(w.id));
      daySchedule[pos.id] = assigned.map((w) => w.name);
    }

    schedule[day] = daySchedule;
  }

  return schedule;
}

/**
 * 检查排班是否满足最低要求。
 * 雷打不动岗位（大堂、现金柜员）未满 minStaff 时报警。
 */
export function validateSchedule(config, schedule) {
  const warnings = [];
  for (let day = 0; day < 7; day++) {
    if (day === 5) continue; // 周六不检查
    for (const pos of FIXED_POSITIONS) {
      const assigned = schedule[day]?.[pos.id]?.length || 0;
      const isEssential = ESSENTIAL_IDS.has(pos.id);
      const minOk = assigned >= pos.minStaff;

      if (!minOk && isEssential) {
        warnings.push(
          `${DAY_NAMES[day]} ${pos.name}岗: 雷打不动需${pos.minStaff}人, 但仅分配到${assigned}人 ❗`
        );
      } else if (!minOk) {
        warnings.push(
          `${DAY_NAMES[day]} ${pos.name}岗: 建议${pos.minStaff}人, 仅分配到${assigned}人`
        );
      }
    }
  }
  return warnings;
}

export { DAY_NAMES };
