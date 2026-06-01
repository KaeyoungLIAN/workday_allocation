import { useState, useEffect, useCallback, useRef } from "react";
import { useTouchDrag } from "./touchDrag";
import {
  loadWorkers,
  saveWorkers,
  exportWorkers,
  copyWorkers,
  importWorkers,
  importWorkersFromText,
  loadPositions,
  savePositions,
  loadOrders,
  saveOrders,
  loadWorkdays,
  saveWorkdays,
  getDefaultOrders,
  getDefaultWorkers,
  generatePosId,
  ALL_DAYS,
} from "./config";
import { generateSchedule, validateSchedule, DAY_NAMES } from "./scheduler";
import { exportScheduleXlsx, exportAllData, copyAllData } from "./export";
import "./App.css";

const POS_COLORS = ["#6c5ce7", "#00b894", "#fdcb6e", "#e17055", "#fd79a8", "#a29bfe", "#fab1a0", "#55efc4"];

let nextWorkerId = Date.now();

export default function App() {
  const [positions] = useState(() => loadPositions());
  const [workdays, setWorkdays] = useState(() => loadWorkdays());
  const [orders, setOrders] = useState(() => loadOrders(loadPositions(), loadWorkdays()));
  const [workers, setWorkers] = useState(() => {
    const loaded = loadWorkers();
    if (loaded.length > 0) return loaded;
    const def = getDefaultWorkers(loadPositions());
    saveWorkers(def);
    return def;
  });
  const [schedule, setSchedule] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [workerModal, setWorkerModal] = useState(null);
  const [status, setStatus] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  // 首次打开自动显示使用说明
  useEffect(() => {
    const shown = localStorage.getItem("wd_guide_shown");
    if (!shown) {
      setGuideOpen(true);
      localStorage.setItem("wd_guide_shown", "1");
    }
  }, []);

  useEffect(() => { saveWorkers(workers); }, [workers]);
  useEffect(() => { savePositions(positions); }, [positions]);
  useEffect(() => { saveOrders(orders); }, [orders]);
  useEffect(() => { saveWorkdays(workdays); }, [workdays]);

  const totalNeed = positions.reduce((s, p) => s + p.minStaff * workdays.length, 0);

  // 排班 tab
  const [tab, setTab] = useState("schedule");

  const doGenerate = useCallback(() => {
    const s = generateSchedule({ workers, positions, orders, workdays });
    setSchedule(s);
    const ws = validateSchedule({ workers, positions, orders, workdays }, s);
    setWarnings(ws);
    setStatus(ws.length === 0 ? "✅ 排班生成完成" : `⚠️ 完成，但有${ws.length}条警告`);
  }, [workers, positions, orders, workdays]);

  const addWorker = (data) => {
    if (workers.find((w) => w.name === data.name)) {
      setStatus(`⚠️ 人员 "${data.name}" 已存在`); return;
    }
    setWorkers((p) => [...p, { id: nextWorkerId++, ...data }]);
    setWorkerModal(null);
    setStatus(`✅ 已添加: ${data.name}`);
  };

  const updateWorker = (id, data) => {
    setWorkers((p) => p.map((w) => (w.id === id ? { ...w, ...data } : w)));
    setWorkerModal(null);
    setStatus("✅ 已更新");
  };

  const deleteWorker = (id) => {
    const w = workers.find((x) => x.id === id);
    setWorkers((p) => p.filter((x) => x.id !== id));
    setStatus(`已删除: ${w?.name || "未知"}`);
  };

  const updatePositions = (newPos) => {
    setPositions(newPos);
    setSchedule(null);
    setWarnings([]);
  };

  const updateOrders = (newOrders) => {
    setOrders(newOrders);
    setSchedule(null);
    setWarnings([]);
  };

  return (
    <div>
      <header className="app-header">
        <div>
          <h1>📋 排班分配器</h1>
          <span>{workers.length} 人 · {positions.length} 岗位 · 周需 {totalNeed} 人次 · {workdays.length}工作日</span>
        </div>
        <div className="tabs">
          <button className={"tab-btn" + (tab === "schedule" ? " active" : "")} onClick={() => setTab("schedule")}>🗓 排班表</button>
          <button className={"tab-btn" + (tab === "workers" ? " active" : "")} onClick={() => setTab("workers")}>👥 人员</button>
          <button className={"tab-btn" + (tab === "positions" ? " active" : "")} onClick={() => setTab("positions")}>🏢 岗位</button>
          <button className={"tab-btn" + (tab === "export" ? " active" : "")} onClick={() => setTab("export")}>📦 导出</button>
          <button className="tab-btn help-btn" onClick={() => setGuideOpen(true)} title="使用说明">?</button>
        </div>
      </header>

      <div className="content">
        {tab === "schedule" && (
          <ScheduleView
            schedule={schedule}
            warnings={warnings}
            onGenerate={doGenerate}
            positions={positions}
            orders={orders}
            workdays={workdays}
          />
        )}
        {tab === "workers" && (
          <WorkersView
            workers={workers}
            positions={positions}
            onAdd={() => setWorkerModal("add")}
            onEdit={(w) => setWorkerModal(w)}
            onDelete={deleteWorker}
          />
        )}
        {tab === "positions" && (
          <PositionsView
            positions={positions}
            orders={orders}
            workdays={workdays}
            onPositionsChange={updatePositions}
            onOrdersChange={updateOrders}
            onWorkdaysChange={setWorkdays}
            setStatus={setStatus}
          />
        )}
        {tab === "export" && <ExportView workers={workers} positions={positions} orders={orders} workdays={workdays} setStatus={setStatus} onImport={(data) => { setWorkers(data); setStatus("✅ 人员已导入"); }} />}

        {workerModal && (
          <WorkerModal
            initial={workerModal === "add" ? null : workerModal}
            positions={positions}
            onSave={(data) => { workerModal === "add" ? addWorker(data) : updateWorker(workerModal.id, data); }}
            onClose={() => setWorkerModal(null)}
          />
        )}

        {/* 使用说明 */}
        {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
      </div>

      <div className="status-bar">{status}</div>
    </div>
  );
}

/* ════════════════════════════════════════
   Schedule View — 始终显示岗位日历，点击按钮才排人
   ════════════════════════════════════════ */
function ScheduleView({ schedule, warnings, onGenerate, positions, orders, workdays }) {
  const warningRef = useRef(null);

  const handleGenerate = () => {
    onGenerate();
    setTimeout(() => {
      warningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const isOffDay = (day) => !workdays.includes(day);

  // 某岗位某天是否在排序中
  const needOnDay = (posId, day) => {
    if (!workdays.includes(day)) return false;
    const order = orders?.[String(day)] || [];
    return order.includes(posId);
  };

  const handleExportXlsx = () => {
    if (!schedule) { setStatus("请先生成排班"); return; }
    exportScheduleXlsx(schedule, positions, orders, workdays);
    setStatus("✅ 排班表已导出");
  };

  return (
    <div>
      <div className="btn-row" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-primary" onClick={handleGenerate}>🔄 随机生成排班</button>
        <button className="btn" onClick={handleExportXlsx} disabled={!schedule}>📥 导出排班</button>
      </div>

      {/* 警告区域 */}
      {warnings.length > 0 && (
        <div ref={warningRef} className="warning-panel" style={{ marginTop: 12 }}>
          <div className="warning-title">⚠️ 排班警告 ({warnings.length})</div>
          {warnings.map((w, i) => <div key={i} className="warning-badge" style={{ marginTop: 4 }}>⚠️ {w}</div>)}
        </div>
      )}

      {/* 日历始终显示 */}
      <div className="schedule-grid" style={{ marginTop: 16 }}>
        {DAY_NAMES.map((dayName, day) => (
          <div key={day} className={"day-col" + (isOffDay(day) ? " day-off" : "")}>
            <h3>{dayName}{isOffDay(day) && <span className="rest-badge">休息</span>}</h3>
            {isOffDay(day) ? (
              <div className="rest-msg">😴 休息</div>
            ) : (
              positions.map((pos, pi) => {
                if (!needOnDay(pos.id, day)) return null;
                const assigned = schedule?.[day]?.[pos.id] || [];
                const hasData = !!schedule;
                const short = hasData && assigned.length < pos.minStaff;
                return (
                  <div key={pos.id} className="pos-block">
                    <div className="pos-label" style={{ color: POS_COLORS[pi % POS_COLORS.length] }}>
                      {pos.name} ({hasData ? assigned.length : "—"}/{pos.minStaff}{pos.maxStaff !== pos.minStaff ? `~${pos.maxStaff}` : ''})
                    </div>
                    {hasData ? (
                      assigned.length > 0 ? assigned.map((name, i) => (
                        <div key={i} className={"pos-worker" + (short ? " short" : "")}>{name}</div>
                      )) : (
                        <div className="pos-worker short">— 无人 —</div>
                      )
                    ) : (
                      <div className="pos-worker placeholder">— 待分配 —</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Workers View
   ════════════════════════════════════════ */
function WorkersView({ workers, positions, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onAdd}>+ 添加人员</button>
      </div>
      {workers.length === 0 ? (
        <p style={{ marginTop: 24, color: "var(--text-secondary)" }}>暂无人员，点击上方按钮添加</p>
      ) : (
        <div className="worker-list">
          {workers.map((w) => (
            <WorkerCard key={w.id} worker={w} positions={positions} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerCard({ worker: w, positions, onEdit, onDelete }) {
  return (
    <div className="worker-card">
      <div className="name">{w.name}</div>
      <div className="tags">
        {(w.positions || []).map((pw) => {
          const pos = positions.find((p) => p.id === pw.id);
          return (
            <span key={pw.id} className="tag green">
              {pos?.name || pw.id}
            </span>
          );
        })}
        {w.offDays.length > 0 && (
          <span className="tag off">休{DAY_NAMES.filter((_, d) => w.offDays.includes(d)).join("、")}</span>
        )}
      </div>
      <div className="actions">
        <button className="btn btn-sm" onClick={() => onEdit(w)}>编辑</button>
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(w.id)}>删除</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Positions View — 岗位管理 + 每日拖拽排序 + 工作日配置
   ════════════════════════════════════════ */
function PositionsView({ positions, orders, workdays, onPositionsChange, onOrdersChange, onWorkdaysChange, setStatus }) {
  const [editName, setEditName] = useState(() => positions.map((p) => p.name));
  const [expandedDay, setExpandedDay] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    setEditName(positions.map((p) => p.name));
  }, [positions]);

  const updatePos = (index, field, value) => {
    const next = positions.map((p, i) => {
      if (i !== index) return p;
      let v = value;
      if (field === "minStaff" || field === "maxStaff") {
        v = Math.max(1, parseInt(value) || 1);
        if (v > 20) v = 20;
      }
      return { ...p, [field]: v };
    });
    onPositionsChange(next);
  };

  const addPos = () => {
    const id = generatePosId();
    const next = [...positions, { id, name: "新岗位", minStaff: 1, maxStaff: 1 }];
    onPositionsChange(next);
    const newO = { ...orders };
    for (const day of workdays) {
      newO[String(day)] = [...(newO[String(day)] || []), id];
    }
    onOrdersChange(newO);
    setEditName(next.map((p) => p.name));
    setStatus("✅ 已添加新岗位");
  };

  const deletePos = (index) => {
    if (positions.length <= 1) {
      setStatus("⚠️ 至少保留一个岗位");
      return;
    }
    const pos = positions[index];
    const next = positions.filter((_, i) => i !== index);
    onPositionsChange(next);
    const newO = { ...orders };
    for (const day of ALL_DAYS) {
      if (newO[String(day)]) {
        newO[String(day)] = newO[String(day)].filter((id) => id !== pos.id);
      }
    }
    onOrdersChange(newO);
    setStatus("✅ 已删除岗位");
  };

  const applyName = (index) => {
    const next = positions.map((p, i) =>
      i === index ? { ...p, name: editName[i] || p.name } : p
    );
    onPositionsChange(next);
  };

  // ── 工作日切换 ──
  const toggleWorkday = (day) => {
    let next;
    if (workdays.includes(day)) {
      if (workdays.length <= 1) {
        setStatus("⚠️ 至少保留一个工作日");
        return;
      }
      next = workdays.filter((d) => d !== day);
    } else {
      next = [...workdays, day].sort();
    }
    onWorkdaysChange(next);
    // 新工作日如果没有排序数据，生成默认
    const newO = { ...orders };
    for (const d of next) {
      if (!newO[String(d)] || newO[String(d)].length === 0) {
        newO[String(d)] = positions.map((p) => p.id);
      }
    }
    onOrdersChange(newO);
  };

  // ── 拖拽排序逻辑 ──
  const handleDragStart = (dayStr, index) => { setDragIdx(index); };
  const handleDragOver = (e, dayStr, index) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === index) return;
    const list = [...(orders[dayStr] || [])];
    const [moved] = list.splice(dragIdx, 1);
    list.splice(index, 0, moved);
    onOrdersChange({ ...orders, [dayStr]: list });
    setDragIdx(index);
  };
  const handleDragEnd = () => { setDragIdx(null); };

  const togglePosDay = (posId, dayStr) => {
    const list = [...(orders[dayStr] || [])];
    const idx = list.indexOf(posId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(posId);
    onOrdersChange({ ...orders, [dayStr]: list });
  };

  const fillDay = (dayStr) => {
    onOrdersChange({ ...orders, [dayStr]: positions.map((p) => p.id) });
  };
  const clearDay = (dayStr) => {
    onOrdersChange({ ...orders, [dayStr]: [] });
  };

  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={addPos}>+ 添加岗位</button>
      </div>

      {/* 岗位配置列表 */}
      <div className="pos-config-list">
        {positions.map((pos, i) => (
          <div key={pos.id} className="pos-config-card">
            <div className="color-dot" style={{ background: POS_COLORS[i % POS_COLORS.length] }} />
            <input
              className="name-input"
              value={editName[i] ?? ""}
              onChange={(e) => setEditName(editName.map((n, j) => (j === i ? e.target.value : n)))}
              onBlur={() => applyName(i)}
              placeholder="岗位名称"
            />
            <span className="label-text">最少</span>
            <input
              className="staff-input"
              type="number"
              min={1}
              value={pos.minStaff}
              onChange={(e) => updatePos(i, "minStaff", e.target.value)}
            />
            <span className="label-text">最多</span>
            <input
              className="staff-input"
              type="number"
              min={1}
              value={pos.maxStaff}
              onChange={(e) => updatePos(i, "maxStaff", e.target.value)}
            />
            <button className="btn btn-sm btn-danger" onClick={() => deletePos(i)} style={{ marginLeft: "auto" }}>删除</button>
          </div>
        ))}
      </div>

      {/* 工作日配置 */}
      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>工作日（点击切换）</h3>
      <div className="checkbox-group">
        {ALL_DAYS.map((d) => (
          <button
            key={d}
            className={"checkbox-btn" + (workdays.includes(d) ? " selected" : "")}
            onClick={() => toggleWorkday(d)}
          >
            {DAY_NAMES[d]}
          </button>
        ))}
      </div>

      {/* 每日排序卡片 — 只显示工作日 */}
      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>每日岗位顺序（拖拽调整优先级）</h3>
      {workdays.sort().map((day) => (
        <DayOrderCard
          key={day}
          day={day}
          name={DAY_NAMES[day]}
          orders={orders}
          positions={positions}
          onToggle={togglePosDay}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          dragIdx={dragIdx}
          expandedDay={expandedDay}
          setExpandedDay={setExpandedDay}
          onFill={fillDay}
          onClear={clearDay}
        />
      ))}
    </div>
  );
}

/* ── 单日排序卡片 ── */
function DayOrderCard({
  day, name, orders, positions, onToggle,
  onDragStart, onDragOver, onDragEnd,
  dragIdx, expandedDay, setExpandedDay,
  onFill, onClear
}) {
  const dayStr = String(day);
  const isExpanded = expandedDay === day;
  const list = orders[dayStr] || [];
  const activeCount = list.length;
  const listRef = useRef(null);

  // 移动端 touch 拖拽
  useTouchDrag(listRef, {
    onDragStart: (idx) => onDragStart(dayStr, idx),
    onDragOver: (e, _, idx) => onDragOver(e, dayStr, idx),
    onDragEnd,
  });

  const toggleExpand = () => {
    setExpandedDay(isExpanded ? null : day);
  };

  const handleDragStartInner = (e, idx) => {
    e.dataTransfer.effectAllowed = "move";
    onDragStart(dayStr, idx);
  };

  return (
    <div className={"day-order-card" + (isExpanded ? " expanded" : "")}>
      <div className="day-order-header" onClick={toggleExpand}>
        <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className="day-name">{name}</span>
        <span className="day-count">{activeCount} 岗</span>
        <span className="day-preview">
          {!isExpanded && list.map((id, i) => {
            const pos = positions.find((p) => p.id === id);
            return (
              <span key={id} className="pos-tag" style={{ background: POS_COLORS[positions.indexOf(pos) % POS_COLORS.length] + "30" }}>
                {pos?.name || id}
              </span>
            );
          })}
        </span>
      </div>
      {isExpanded && (
        <div className="day-order-body">
          <div className="day-order-actions">
            <button className="btn btn-sm" onClick={() => onFill(dayStr)}>全选</button>
            <button className="btn btn-sm" onClick={() => onClear(dayStr)}>清空</button>
          </div>
          {/* 已选中的岗位列表（可拖拽排序） */}
          <div className="pos-order-list" ref={listRef}>
            {list.map((id, idx) => {
              const pos = positions.find((p) => p.id === id);
              const pi = positions.indexOf(pos);
              return (
                <div
                  key={id}
                  className={"pos-order-item" + (dragIdx === idx ? " dragging" : "")}
                  draggable
                  onDragStart={(e) => handleDragStartInner(e, idx)}
                  onDragOver={(e) => onDragOver(e, dayStr, idx)}
                  onDragEnd={onDragEnd}
                  data-sort-idx={idx}
                  style={{ borderLeftColor: POS_COLORS[pi % POS_COLORS.length] }}
                >
                  <span className="drag-handle">⠿</span>
                  <span className="pos-order-name" style={{ color: POS_COLORS[pi % POS_COLORS.length] }}>
                    {pos?.name || id}
                  </span>
                  <button className="btn-remove" onClick={() => onToggle(id, dayStr)}>✕</button>
                </div>
              );
            })}
          </div>
          {/* 未选中的岗位（点击添加） */}
          <div className="pos-unselected">
            <div className="unselected-label">未选中：</div>
            <div className="unselected-list">
              {positions.filter((p) => !list.includes(p.id)).map((pos, pi) => (
                <span
                  key={pos.id}
                  className="pos-tag-clickable"
                  style={{ borderColor: POS_COLORS[pi % POS_COLORS.length], color: POS_COLORS[pi % POS_COLORS.length] }}
                  onClick={() => onToggle(pos.id, dayStr)}
                >
                  + {pos.name}
                </span>
              ))}
              {positions.filter((p) => !list.includes(p.id)).length === 0 && (
                <span className="unselected-empty">全部已选中</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   使用说明 Modal
   ════════════════════════════════════════ */
function GuideModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal guide-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h2>使用说明</h2>
        <div className="guide-modal-scroll">
          <section>
            <h3>排班表</h3>
            <ul>
              <li>页面默认显示一周七天的岗位日历，标记了每个岗位需要的人数。</li>
              <li>点击【随机生成排班】自动分配人员到各岗位。</li>
              <li>生成后如有人员不足会显示警告。点击右侧【导出排班】可下载 Excel。</li>
            </ul>
          </section>
          <section>
            <h3>人员</h3>
            <ul>
              <li>添加/编辑人员：设置姓名、所属岗位、休息日。</li>
              <li>每人可选择多个岗位，拖拽排序决定优先顺序（越靠上越优先去该岗位）。</li>
            </ul>
          </section>
          <section>
            <h3>岗位</h3>
            <ul>
              <li>自定义岗位名称和每个岗位最少/最多需要的人数。</li>
              <li>点击日期按钮切换工作日（默认周一~周五 + 周日工作，周六休息）。</li>
              <li>展开每日卡片，拖拽调整当天各岗位的优先级（越靠上越优先分配人员）。</li>
            </ul>
          </section>
          <section>
            <h3>导出 / 导入</h3>
            <ul>
              <li>【导出文件】下载全部配置（岗位、人员、排序、工作日）为 .json。</li>
              <li>【复制数据】将相同内容复制到剪贴板。</li>
              <li>导入：粘贴数据或选择文件后，点击【确定导入】，刷新页面生效。</li>
            </ul>
          </section>
        </div>
        <div className="guide-modal-footer">
          <p className="guide-modal-note">数据全部保存在浏览器本地，不会上传任何服务器。</p>
          <button className="btn btn-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Export View — 导入/导出全部
   ════════════════════════════════════════ */
function ExportView({ workers, positions, orders, workdays, setStatus }) {
  const [importSource, setImportSource] = useState(""); // 粘贴文本或文件读取后的内容
  const [importFileName, setImportFileName] = useState("");

  // 通用的导入逻辑
  const doImport = (jsonText) => {
    try {
      const data = JSON.parse(jsonText);
      if (!data.version || !data.workers || !data.positions || !data.orders) {
        throw new Error("数据格式不正确，请使用导出全部生成的文件");
      }
      localStorage.setItem("wd_positions", JSON.stringify(data.positions));
      localStorage.setItem("wd_pos_order", JSON.stringify(data.orders));
      localStorage.setItem("wd_workers", JSON.stringify(data.workers));
      if (data.workdays) localStorage.setItem("wd_workdays", JSON.stringify(data.workdays));
      setStatus("✅ 数据已导入，请刷新页面");
      setImportSource("");
      setImportFileName("");
    } catch (err) {
      setStatus(`❌ 导入失败: ${err.message}`);
    }
  };

  const handleAllExport = () => {
    exportAllData(positions, workers, orders, workdays);
    setStatus("✅ 数据已导出");
  };

  const handleCopy = () => {
    copyAllData(positions, workers, orders, workdays);
    setStatus("✅ 已复制到剪贴板");
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setImportSource(text);
      setImportFileName(file.name);
    } catch (err) {
      setStatus(`❌ 读取文件失败: ${err.message}`);
    }
    e.target.value = "";
  };

  return (
    <div className="export-section">
      <h3 style={{ fontSize: 15, marginBottom: 12, fontWeight: 600 }}>导出</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
        导出全部配置（岗位、人员、排序、工作日），导入时恢复完整设置。
      </p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleAllExport}>📥 导出文件</button>
        <button className="btn" onClick={handleCopy}>📋 复制数据</button>
      </div>

      <h3 style={{ fontSize: 15, marginTop: 32, marginBottom: 12, fontWeight: 600 }}>导入</h3>
      <textarea className="import-textarea" rows={5} placeholder="粘贴导出的 JSON 数据..." value={importSource}
        onChange={(e) => { setImportSource(e.target.value); setImportFileName(""); }} />
      <div className="import-area" style={{ marginTop: 8 }}>
        <input type="file" accept=".json" onChange={handleFileSelect} id="import-input" />
        <label htmlFor="import-input" style={{ cursor: "pointer", display: "block", padding: "16px 20px" }}>
          {importFileName
            ? <span style={{ color: "var(--accent)", fontSize: 13 }}>已选择: {importFileName}</span>
            : <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>📂 选择 JSON 文件</span>
          }
        </label>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => doImport(importSource)} disabled={!importSource.trim()}>
          确定导入
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Worker Modal — 拖拽排序岗位
   ════════════════════════════════════════ */
function WorkerModal({ initial, positions, onSave, onClose }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [workerPos, setWorkerPos] = useState(initial?.positions || []);
  const [offDays, setOffDays] = useState(initial?.offDays || []);
  const [dragIdx, setDragIdx] = useState(null);
  const workerListRef = useRef(null);

  // 移动端 touch 拖拽
  useTouchDrag(workerListRef, {
    onDragStart: (idx) => { setDragIdx(idx); },
    onDragOver: (e, fromIdx, toIdx) => {
      if (dragIdx === null || dragIdx === toIdx) return;
      const list = [...workerPos];
      const [moved] = list.splice(dragIdx, 1);
      list.splice(toIdx, 0, moved);
      setWorkerPos(list);
      setDragIdx(toIdx);
    },
    onDragEnd: () => setDragIdx(null),
  });

  const togglePos = (posId) => {
    setWorkerPos((prev) => {
      const existing = prev.find((p) => p.id === posId);
      if (existing) return prev.filter((p) => p.id !== posId);
      return [...prev, { id: posId }];
    });
  };

  const handleDragStart = (e, idx) => {
    e.dataTransfer.effectAllowed = "move";
    setDragIdx(idx);
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const list = [...workerPos];
    const [moved] = list.splice(dragIdx, 1);
    list.splice(idx, 0, moved);
    setWorkerPos(list);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const toggleOff = (d) => {
    setOffDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || workerPos.length === 0) return;
    onSave({ name: name.trim(), positions: workerPos, offDays });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "编辑人员" : "添加人员"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>姓名</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" autoFocus />
          </div>
          <div className="form-group">
            <label>岗位（拖拽排序，越靠上越优先）</label>
            <div className="worker-pos-drag">
              {workerPos.length > 0 && (
                <>
                  <div className="unselected-label">已选中：</div>
                  <div className="pos-order-list" style={{ marginBottom: 6 }} ref={workerListRef}>
                    {workerPos.map((pw, idx) => {
                      const pos = positions.find((p) => p.id === pw.id);
                      const pi = positions.indexOf(pos);
                      return (
                        <div
                          key={pw.id}
                          className={"pos-order-item" + (dragIdx === idx ? " dragging" : "")}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          data-sort-idx={idx}
                          style={{ borderLeftColor: POS_COLORS[pi % POS_COLORS.length] }}
                        >
                          <span className="drag-handle">⠿</span>
                          <span className="pos-order-name" style={{ color: POS_COLORS[pi % POS_COLORS.length] }}>
                            {pos?.name || pw.id}
                          </span>
                          <span className="prio-value">{idx + 1}</span>
                          <button className="btn-remove" onClick={() => togglePos(pw.id)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="unselected-label">可选：</div>
              <div className="unselected-list">
                {positions.filter((p) => !workerPos.find((wp) => wp.id === p.id)).map((pos, pi) => (
                  <span
                    key={pos.id}
                    className="pos-tag-clickable"
                    style={{ borderColor: POS_COLORS[pi % POS_COLORS.length], color: POS_COLORS[pi % POS_COLORS.length] }}
                    onClick={() => togglePos(pos.id)}
                  >
                    + {pos.name}
                  </span>
                ))}
                {positions.filter((p) => !workerPos.find((wp) => wp.id === p.id)).length === 0 && (
                  <span className="unselected-empty">已选择所有岗位</span>
                )}
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>休息日（可多选）</label>
            <div className="checkbox-group">
              {DAY_NAMES.map((d, i) => (
                <button key={i} type="button"
                  className={"checkbox-btn" + (offDays.includes(i) ? " selected" : "")}
                  style={offDays.includes(i) ? { borderColor: "var(--danger)", background: "var(--danger-dim)", color: "var(--danger)" } : {}}
                  onClick={() => toggleOff(i)}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="hint">休息日当天不会被排班</div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || workerPos.length === 0}>
              {isEdit ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
