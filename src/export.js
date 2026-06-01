import * as XLSX from "xlsx";
import { DAY_NAMES } from "./scheduler";

/**
 * 导出排班表为 .xlsx 文件
 */
export function exportScheduleXlsx(schedule, positions, orders, workdays) {
  const wb = XLSX.utils.book_new();

  for (const day of workdays.sort()) {
    const order = orders?.[String(day)] || [];
    const data = [];
    // 表头：岗位名
    const header = ["姓名"];
    for (const posId of order) {
      const pos = positions.find((p) => p.id === posId);
      if (pos) header.push(pos.name);
    }
    data.push(header);

    // 收集该天所有被排的人
    const assignedSet = new Set();
    for (const posId of order) {
      const names = schedule?.[day]?.[posId] || [];
      names.forEach((n) => assignedSet.add(n));
    }
    const allNames = Array.from(assignedSet).sort();

    for (const name of allNames) {
      const row = [name];
      for (const posId of order) {
        const names = schedule?.[day]?.[posId] || [];
        row.push(names.includes(name) ? "●" : "");
      }
      data.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    // 列宽
    ws["!cols"] = [
      { wch: 10 },
      ...order.map(() => ({ wch: 10 })),
    ];
    XLSX.utils.book_append_sheet(wb, ws, DAY_NAMES[day]);
  }

  XLSX.writeFile(wb, "排班表.xlsx");
}

/**
 * 导出全量数据（岗位 + 人员 + 排序）为 JSON
 */
export function exportAllData(positions, workers, orders, workdays) {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    positions,
    workers,
    orders,
    workdays,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workday_all_data.json";
  a.click();
  URL.revokeObjectURL(url);
}
