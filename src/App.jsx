import { useState, useEffect, useCallback } from "react";
import {
  loadConfig,
  saveConfig,
  exportConfig,
  copyConfig,
  importConfig,
  importConfigFromText,
} from "./config";
import { generateSchedule, validateSchedule, DAY_NAMES } from "./scheduler";
import "./App.css";

/* ── Color palette for positions ── */
const POS_COLORS = ["#6c5ce7", "#00b894", "#fdcb6e", "#e17055", "#fd79a8"];

let nextWorkerId = Date.now();

export default function App() {
  const [tab, setTab] = useState("schedule");
  const [config, setConfig] = useState(() => loadConfig());
  const [schedule, setSchedule] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [workerModal, setWorkerModal] = useState(null); // null | 'add' | workerObj
  const [status, setStatus] = useState("");

  // Persist on change
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const doGenerate = useCallback(() => {
    const s = generateSchedule(config);
    setSchedule(s);
    const ws = validateSchedule(config, s);
    setWarnings(ws);
    if (ws.length === 0) setStatus("✅ 排班生成完成");
    else setStatus(`⚠️ 生成完成，但有${ws.length}条警告`);
  }, [config]);

  useEffect(() => {
    doGenerate();
  }, []);

  /* ── Worker CRUD ── */
  const addWorker = (data) => {
    if (config.workers.find((w) => w.name === data.name)) {
      setStatus(`⚠️ 人员 "${data.name}" 已存在`);
      return;
    }
    const worker = { id: nextWorkerId++, ...data };
    setConfig((c) => ({ ...c, workers: [...c.workers, worker] }));
    setWorkerModal(null);
    setStatus(`✅ 已添加人员: ${data.name}`);
  };

  const updateWorker = (id, data) => {
    setConfig((c) => ({
      ...c,
      workers: c.workers.map((w) => (w.id === id ? { ...w, ...data } : w)),
    }));
    setWorkerModal(null);
    setStatus("✅ 人员已更新");
  };

  const deleteWorker = (id) => {
    const w = config.workers.find((x) => x.id === id);
    setConfig((c) => ({
      ...c,
      workers: c.workers.filter((x) => x.id !== id),
    }));
    setStatus(`已删除: ${w?.name || "未知"}`);
  };

  /* ── Position CRUD ── */
  const updatePosition = (id, data) => {
    setConfig((c) => ({
      ...c,
      positions: c.positions.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    }));
  };

  /* ── Export/Import ── */
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importConfig(file);
      setConfig(data);
      setStatus("✅ 配置已导入");
    } catch (err) {
      setStatus(`❌ 导入失败: ${err.message}`);
    }
    e.target.value = "";
  };

  const workerCount = config.workers.length;
  const totalPosNeed = config.positions.reduce((s, p) => {
    // 周日专属岗位只计1天×1人
    if (p.sundayOnly) return s + 1;
    return s + p.minStaff * 6; // 6天（周六休息）
  }, 0);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header className="app-header">
        <div>
          <h1>📋 排班分配器</h1>
          <span>
            {workerCount} 人 · {config.positions.length} 岗位 · 周需 {totalPosNeed} 人次
            <span className="badge-info" style={{ marginLeft: 8 }}>周六固定休息</span>
          </span>
        </div>
        <div className="tabs">
          <button className={"tab-btn" + (tab === "schedule" ? " active" : "")} onClick={() => setTab("schedule")}>
            🗓 排班表
          </button>
          <button className={"tab-btn" + (tab === "workers" ? " active" : "")} onClick={() => setTab("workers")}>
            👥 人员
          </button>
          <button className={"tab-btn" + (tab === "positions" ? " active" : "")} onClick={() => setTab("positions")}>
            ⚙ 岗位
          </button>
          <button className={"tab-btn" + (tab === "export" ? " active" : "")} onClick={() => setTab("export")}>
            📦 导入导出
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="content" style={{ flex: 1 }}>
        {tab === "schedule" && (
          <ScheduleView
            config={config}
            schedule={schedule}
            warnings={warnings}
            onGenerate={doGenerate}
          />
        )}
        {tab === "workers" && (
          <WorkersPanel
            config={config}
            onAdd={() => setWorkerModal("add")}
            onEdit={(w) => setWorkerModal(w)}
            onDelete={deleteWorker}
          />
        )}
        {tab === "positions" && (
          <PositionsPanel config={config} onUpdate={updatePosition} />
        )}
        {tab === "export" && (
          <ExportImport config={config} onImport={handleImport} setStatus={setStatus} onImportFromText={(data) => { setConfig(data); setStatus("✅ 配置已导入"); }} />
        )}

        {/* Worker Modal */}
        {workerModal && (
          <WorkerModal
            config={config}
            initial={workerModal === "add" ? null : workerModal}
            onSave={(data) => {
              if (workerModal === "add") addWorker(data);
              else updateWorker(workerModal.id, data);
            }}
            onClose={() => setWorkerModal(null)}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">{status}</div>
    </div>
  );
}

/* ════════════════════════════════════════
   Schedule View
   ════════════════════════════════════════ */
function ScheduleView({ config, schedule, warnings, onGenerate }) {
  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onGenerate}>
          🔄 随机生成排班
        </button>
      </div>
      {warnings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {warnings.map((w, i) => (
            <div key={i} className="warning-badge" style={{ marginTop: 4 }}>
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}
      {schedule ? (
        <div className="schedule-grid">
          {DAY_NAMES.map((dayName, day) => (
            <div key={day} className={"day-col" + (day === 5 ? " day-off" : "")}>
              <h3>{dayName}
                {day === 5 && <span className="rest-badge">固定休息</span>}
                {day === 6 && <span className="rest-badge sun" style={{ marginLeft: 4 }}>周日</span>}
              </h3>
              {day === 5 ? (
                <div className="rest-msg">😴 全体休息</div>
              ) : (
                config.positions.map((pos) => {
                  const assigned = schedule[day]?.[pos.id] || [];
                  const need = pos.sundayOnly ? 1 : pos.minStaff;
                  const short = assigned.length < need;
                  // Skip showing sundayOnly positions on non-Sunday days
                  if (pos.sundayOnly && day !== 6) return null;
                  return (
                    <div key={pos.id} className="pos-block">
                      <div className="pos-label" style={{ color: POS_COLORS[config.positions.indexOf(pos)] }}>
                        {pos.name}
                        {pos.sundayOnly && <span className="sun-badge">周日专</span>}
                        {" "}({assigned.length}/{need})
                      </div>
                      {assigned.length > 0 ? (
                        assigned.map((name, i) => (
                          <div key={i} className={"pos-worker" + (short ? " short" : "")}>
                            {name}
                          </div>
                        ))
                      ) : (
                        <div className="pos-worker short">— 无人 —</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: 24, color: "var(--text-secondary)" }}>
          点击"随机生成排班"按钮生成一周排班
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   Workers Panel
   ════════════════════════════════════════ */
function WorkersPanel({ config, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onAdd}>
          + 添加人员
        </button>
      </div>
      {config.workers.length === 0 ? (
        <p style={{ marginTop: 24, color: "var(--text-secondary)" }}>
          暂无人员，点击上方按钮添加
        </p>
      ) : (
        <div className="worker-list">
          {config.workers.map((w) => {
            const posInfos = (w.positions || []).map((pw) => {
              const pos = config.positions.find((p) => p.id === pw.id);
              return { name: pos?.name || pw.id, priority: pw.priority ?? 3 };
            });
            return (
              <div key={w.id} className="worker-card">
                <div className="name">{w.name}</div>
                <div className="tags">
                  {posInfos.map((pi) => (
                    <span key={pi.name} className="tag green" title={`优先级: ${pi.priority}（越小越高）`}>
                      {pi.name} ⭐{pi.priority}
                    </span>
                  ))}
                  {w.offDays.length > 0 && (
                    <span className="tag off">
                      休{DAY_NAMES.filter((_, d) => w.offDays.includes(d)).join("、")}
                    </span>
                  )}
                </div>
                <div className="actions">
                  <button className="btn btn-sm" onClick={() => onEdit(w)}>编辑</button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(w.id)}>删除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   Positions Panel
   ════════════════════════════════════════ */
function PositionsPanel({ config, onUpdate }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
        修改岗位配置。重要性越高，排班时优先满足。周日专属岗位仅周日需要1人，且该人当天不能兼任其他岗。
      </p>
      <div className="pos-config-list">
        {config.positions.map((pos, i) => (
          <div key={pos.id} className="pos-config-card">
            <div className="color-dot" style={{ background: POS_COLORS[i] }} />
            <input
              className="name-input"
              value={pos.name}
              onChange={(e) => onUpdate(pos.id, { name: e.target.value })}
            />
            <span className="label-text">每日最少</span>
            <input
              className="staff-input"
              type="number"
              min={0}
              max={20}
              value={pos.minStaff}
              onChange={(e) =>
                onUpdate(pos.id, { minStaff: Math.max(0, parseInt(e.target.value) || 0) })
              }
            />
            <span className="label-text">人 · 重要性</span>
            <input
              className="staff-input"
              type="number"
              min={1}
              max={10}
              value={pos.importance ?? 1}
              onChange={(e) =>
                onUpdate(pos.id, { importance: Math.max(1, parseInt(e.target.value) || 1) })
              }
            />
            <label className="sun-toggle" title="周日专属：仅周日照排1人，该人当天不可做其他岗">
              <input
                type="checkbox"
                checked={pos.sundayOnly || false}
                onChange={(e) => onUpdate(pos.id, { sundayOnly: e.target.checked })}
              />
              <span>周日专</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Export / Import
   ════════════════════════════════════════ */
function ExportImport({ config, onImport, onImportFromText, setStatus }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const json = JSON.stringify(config, null, 2);

  const handleCopy = () => {
    copyConfig(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    exportConfig(config);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handlePasteImport = () => {
    try {
      const data = importConfigFromText(pasteText);
      onImportFromText(data);
      setPasteText("");
    } catch (err) {
      setStatus(`❌ 导入失败: ${err.message}`);
    }
  };

  return (
    <div className="export-section">
      <p>将配置复制到剪贴板或下载为 JSON 文件，也可从文件导入恢复。</p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleCopy}>
          {copied ? "✅ 已复制" : "📋 复制配置"}
        </button>
        <button className="btn" onClick={handleDownload}>
          {downloaded ? "✅ 已下载" : "📥 下载配置"}
        </button>
      </div>

      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>当前配置预览</h3>
      <pre>{json}</pre>

      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>导入配置</h3>
      <textarea
        className="import-textarea"
        rows={6}
        placeholder="在此粘贴 JSON 配置，或从下方选择文件..."
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handlePasteImport} disabled={!pasteText.trim()}>
          📥 从粘贴导入
        </button>
      </div>
      <div className="import-area" style={{ marginTop: 12 }}>
        <input type="file" accept=".json" onChange={onImport} id="import-input" />
        <label htmlFor="import-input" style={{ cursor: "pointer", display: "block" }}>
          <p style={{ fontSize: 32, marginBottom: 4 }}>📂</p>
          <p>或点击选择 JSON 配置文件</p>
        </label>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Worker Modal (Add / Edit) — with priority
   ════════════════════════════════════════ */
function WorkerModal({ config, initial, onSave, onClose }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || "");
  // positions: [{ id, priority }]
  const [positions, setPositions] = useState(initial?.positions || []);
  const [offDays, setOffDays] = useState(initial?.offDays || []);

  const setPriority = (posId, priority) => {
    setPositions((prev) => {
      const existing = prev.find((p) => p.id === posId);
      if (existing) {
        return prev.map((p) =>
          p.id === posId ? { ...p, priority: Math.max(1, Math.min(10, priority || 3)) } : p
        );
      }
      return [...prev, { id: posId, priority: Math.max(1, Math.min(10, priority || 3)) }];
    });
  };

  const togglePos = (posId) => {
    setPositions((prev) => {
      const existing = prev.find((p) => p.id === posId);
      if (existing) return prev.filter((p) => p.id !== posId);
      return [...prev, { id: posId, priority: 3 }];
    });
  };

  const toggleOff = (d) => {
    setOffDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (positions.length === 0) return;
    onSave({ name: name.trim(), positions, offDays });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "编辑人员" : "添加人员"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入姓名"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>岗位与优先级（数字越小优先级越高，至少选一个）</label>
            <div className="pos-priority-grid">
              {config.positions.map((p, i) => {
                const entry = positions.find((ep) => ep.id === p.id);
                const selected = !!entry;
                return (
                  <div key={p.id} className="pos-priority-row"
                    style={selected ? { borderColor: POS_COLORS[i], background: POS_COLORS[i] + "15" } : {}}
                    onClick={() => togglePos(p.id)}
                  >
                    <span className="pos-prio-name" style={selected ? { color: POS_COLORS[i] } : {}}>
                      {p.name}
                      {p.sundayOnly && <span className="sun-badge-sm">周日专</span>}
                    </span>
                    {selected && (
                      <div className="prio-control" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="prio-btn" onClick={() => setPriority(p.id, (entry.priority ?? 3) - 1)}>-</button>
                        <span className="prio-value">{entry.priority ?? 3}</span>
                        <button type="button" className="prio-btn" onClick={() => setPriority(p.id, (entry.priority ?? 3) + 1)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="form-group">
            <label>休息日（可多选，周六固定休息自动安排）</label>
            <div className="checkbox-group">
              {DAY_NAMES.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className={"checkbox-btn" + (offDays.includes(i) ? " selected" : "") + (i === 5 ? " auto-off" : "")}
                  style={
                    i === 5
                      ? { borderColor: "var(--text-muted)", opacity: 0.5, cursor: "default" }
                      : offDays.includes(i)
                        ? { borderColor: "var(--red)", background: "var(--red-light)", color: "var(--red)" }
                        : {}
                  }
                  onClick={() => i !== 5 && toggleOff(i)}
                >
                  {d}{i === 5 ? " (自动)" : ""}
                </button>
              ))}
            </div>
            <div className="hint">休息日当天不会被排班</div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || positions.length === 0}
            >
              {isEdit ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
