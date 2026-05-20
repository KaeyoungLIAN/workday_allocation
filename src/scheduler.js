const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/**
 * Generate a schedule for one week.
 * @param {object} config - { positions, workers }
 * @returns {object} { [dayIndex]: { [positionId]: [workerName, ...] } }
 */
export function generateSchedule(config) {
  const { positions, workers } = config;
  const schedule = {};

  for (let day = 0; day < 7; day++) {
    // 周六固定全体休息
    if (day === 5) {
      schedule[day] = {};
      continue;
    }

    const daySchedule = {};
    const assignedToday = new Set(); // workers already assigned today

    // Sort: sundayOnly positions first, then by importance descending
    const sorted = [...positions].sort((a, b) => {
      if (b.sundayOnly !== a.sundayOnly) return b.sundayOnly ? 1 : -1;
      return (b.importance || 1) - (a.importance || 1);
    });

    for (const pos of sorted) {
      // 周日专属岗位只在周日开放
      if (pos.sundayOnly && day !== 6) continue;

      const available = workers.filter(
        (w) =>
          !w.offDays.includes(day) &&
          w.positions &&
          w.positions.some((p) => p.id === pos.id) &&
          !assignedToday.has(w.id)
      );

      // Sort by priority (lower number = higher priority, default 3)
      available.sort((a, b) => {
        const priA = (a.positions || []).find((p) => p.id === pos.id)?.priority ?? 3;
        const priB = (b.positions || []).find((p) => p.id === pos.id)?.priority ?? 3;
        return priA - priB;
      });

      const need = pos.sundayOnly ? 1 : pos.minStaff;
      const assigned = available.slice(0, need);
      assigned.forEach((w) => assignedToday.add(w.id));

      // 周日专属：如果没人排到也不能强行安排，该岗位当天留空
      daySchedule[pos.id] = assigned.map((w) => w.name);
    }

    schedule[day] = daySchedule;
  }

  return schedule;
}

/**
 * Check if a schedule meets minimum staffing for all positions on all days.
 */
export function validateSchedule(config, schedule) {
  const warnings = [];
  for (let day = 0; day < 7; day++) {
    // 周六不检查
    if (day === 5) continue;

    for (const pos of config.positions) {
      // 周日专属岗位在非周日不检查
      if (pos.sundayOnly && day !== 6) continue;

      const assigned = schedule[day]?.[pos.id]?.length || 0;
      const need = pos.sundayOnly ? 1 : pos.minStaff;
      if (assigned < need) {
        warnings.push(
          `${DAY_NAMES[day]} ${pos.name}岗: 需要${need}人, 仅分配到${assigned}人`
        );
      }
    }
  }
  return warnings;
}

export { DAY_NAMES };
