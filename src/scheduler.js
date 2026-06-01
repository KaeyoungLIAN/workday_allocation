const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/**
 * 岗位的全局优先级（数字越小越优先）。
 * 默认规则：大堂(1) > 现金柜员(2) > 普通柜员(3) > 授权岗(4)
 * 周日：大堂(1) > 现金柜员(2) > 普通柜员=授权岗(3)
 * 自定义岗位的默认优先级为 9（靠后）
 */
function getGlobalPriority(posId, positions, day) {
  const idx = positions.findIndex((p) => p.id === posId);
  const isWeekend = day === 6;

  // 前 4 个默认岗位用固定优先级
  const defaultIds = ["pos_dt", "pos_xj", "pos_pt", "pos_sq"];
  const defaultIdx = defaultIds.indexOf(posId);
  if (defaultIdx !== -1) {
    if (isWeekend) {
      const weekend = [1, 2, 3, 3]; // 大堂>现金柜员>普通柜员=授权
      return weekend[defaultIdx];
    }
    return defaultIdx + 1; // 1,2,3,4
  }

  // 自定义岗位按在列表中的顺序
  return 10 + idx;
}

/**
 * 授权岗是否在此日需要（周一~周五不需要，周六全体休息不处理，周日需要）
 */
function needPosOnDay(posId, day, positions) {
  const pos = positions.find((p) => p.id === posId);
  if (!pos) return false;
  // 周六全体休息
  if (day === 5) return false;
  // 授权岗（pos_sq）周一~周五不需要
  if (posId === "pos_sq" && day >= 0 && day <= 4) return false;
  return true;
}

/**
 * Generate a schedule for one week.
 * @param {object} config - { workers, positions }
 * @returns {object} { [dayIndex]: { [positionId]: [workerName, ...] } }
 */
export function generateSchedule(config) {
  const { workers, positions } = config;
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
    const sorted = [...positions].sort(
      (a, b) => getGlobalPriority(a.id, positions, day) - getGlobalPriority(b.id, positions, day)
    );

    for (const pos of sorted) {
      if (!needPosOnDay(pos.id, day, positions)) continue;
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
 * 大堂雷打不动必须满 minStaff，其他岗位建议即可。
 */
export function validateSchedule(config, schedule) {
  const { positions } = config;
  const warnings = [];
  for (let day = 0; day < 7; day++) {
    if (day === 5) continue;
    for (const pos of positions) {
      if (!needPosOnDay(pos.id, day, positions)) continue;
      const assigned = schedule[day]?.[pos.id]?.length || 0;
      // 大堂除周六外每天必须满 minStaff
      const isEssential = pos.id === "pos_dt" && day !== 5;
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
