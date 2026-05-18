const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

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
    for (const pos of positions) {
      const available = workers.filter(
        (w) =>
          !w.offDays.includes(day) && w.positionIds.includes(pos.id)
      );
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const assigned = shuffled.slice(0, pos.minStaff);
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
