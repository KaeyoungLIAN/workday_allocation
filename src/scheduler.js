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
    const daySchedule = {};
    const assignedToday = new Set(); // track workers already assigned today

    // Process positions with highest demand first (most constrained)
    const sorted = [...positions].sort((a, b) => b.minStaff - a.minStaff);

    for (const pos of sorted) {
      const available = workers.filter(
        (w) =>
          !w.offDays.includes(day) &&
          w.positionIds.includes(pos.id) &&
          !assignedToday.has(w.id)
      );
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const assigned = shuffled.slice(0, pos.minStaff);
      assigned.forEach((w) => assignedToday.add(w.id));
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
    for (const pos of config.positions) {
      const assigned = schedule[day]?.[pos.id]?.length || 0;
      if (assigned < pos.minStaff) {
        warnings.push(
          `${DAY_NAMES[day]} ${pos.name}岗: 需要${pos.minStaff}人, 仅分配到${assigned}人`
        );
      }
    }
  }
  return warnings;
}

export { DAY_NAMES };
