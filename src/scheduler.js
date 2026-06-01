const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/**
 * 授权岗是否在此日需要
 */
function needPosOnDay(posId, day, positions) {
  const pos = positions.find((p) => p.id === posId);
  if (!pos) return false;
  if (day === 5) return false;
  if (posId === "pos_sq" && day >= 0 && day <= 4) return false;
  return true;
}

/**
 * Generate a schedule for one week.
 * @param {object} config - { workers, positions, priorities }
 * @returns {object} { [dayIndex]: { [positionId]: [workerName, ...] } }
 */
export function generateSchedule(config) {
  const { workers, positions, priorities } = config;
  const schedule = {};

  for (let day = 0; day < 7; day++) {
    if (day === 5) {
      schedule[day] = {};
      continue;
    }

    const daySchedule = {};
    const assignedToday = new Set();

    // 按当天优先级排序（数字越小越优先，0=不需要）
    const sorted = [...positions]
      .filter((pos) => {
        const prio = priorities?.[pos.id]?.[day] ?? 9;
        return prio > 0 && needPosOnDay(pos.id, day, positions);
      })
      .sort((a, b) => {
        const pa = priorities?.[a.id]?.[day] ?? 9;
        const pb = priorities?.[b.id]?.[day] ?? 9;
        return pa - pb;
      });

    for (const pos of sorted) {
      const available = workers.filter(
        (w) =>
          !w.offDays.includes(day) &&
          w.positions &&
          w.positions.some((p) => p.id === pos.id) &&
          !assignedToday.has(w.id)
      );

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
 * 大堂必须满 minStaff，其他岗位建议即可。
 */
export function validateSchedule(config, schedule) {
  const { positions, priorities } = config;
  const warnings = [];
  for (let day = 0; day < 7; day++) {
    if (day === 5) continue;
    for (const pos of positions) {
      const prio = priorities?.[pos.id]?.[day] ?? 9;
      if (prio <= 0) continue;
      const assigned = schedule[day]?.[pos.id]?.length || 0;
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
