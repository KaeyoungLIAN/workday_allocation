const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/**
 * Generate a schedule for one week.
 * @param {object} config - { workers, positions, orders }
 *   orders: { "0": ["pos_dt","pos_xj","pos_pt"], "1": [...], ... }
 * @returns {object} { [dayIndex]: { [positionId]: [workerName, ...] } }
 */
export function generateSchedule(config) {
  const { workers, positions, orders } = config;
  const schedule = {};

  for (let day = 0; day < 7; day++) {
    if (day === 5) {
      schedule[day] = {};
      continue;
    }

    const daySchedule = {};
    const assignedToday = new Set();
    const order = orders?.[String(day)] || [];

    for (const posId of order) {
      const pos = positions.find((p) => p.id === posId);
      if (!pos) continue;

      const available = workers.filter(
        (w) =>
          !w.offDays.includes(day) &&
          w.positions &&
          w.positions.some((p) => p.id === posId) &&
          !assignedToday.has(w.id)
      );

      available.sort((a, b) => {
        const priA = (a.positions || []).find((p) => p.id === posId)?.priority ?? 3;
        const priB = (b.positions || []).find((p) => p.id === posId)?.priority ?? 3;
        return priA - priB;
      });

      const assigned = available.slice(0, pos.maxStaff);
      assigned.forEach((w) => assignedToday.add(w.id));
      daySchedule[posId] = assigned.map((w) => w.name);
    }

    schedule[day] = daySchedule;
  }

  return schedule;
}

/**
 * 检查排班是否满足最低要求。
 */
export function validateSchedule(config, schedule) {
  const { positions, orders } = config;
  const warnings = [];
  for (let day = 0; day < 7; day++) {
    if (day === 5) continue;
    const order = orders?.[String(day)] || [];
    for (const posId of order) {
      const pos = positions.find((p) => p.id === posId);
      if (!pos) continue;
      const assigned = schedule[day]?.[posId]?.length || 0;
      const isEssential = pos.id === "pos_dt";
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
