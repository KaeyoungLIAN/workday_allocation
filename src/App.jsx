import { useState, useEffect, useCallback } from "react";
import {
  loadConfig,
  saveConfig,
  exportConfig,
  importConfig,
} from "./config";
import { generateSchedule, validateSchedule, DAY_NAMES } from "./scheduler";
import "./App.css";

/* ── Color palette for positions ── */
const POS_COLORS = ["#6c5ce7", "#00b894", "#fdcb6e", "#e17055"];

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
  const totalPosNeed = config.positions.reduce((s, p) => s + p.minStaff * 7, 0);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header className="app-header">
        <div>
          <h1>📋 排班分配器</h1>
          <span>
            {workerCount} 人 · {config.positions.length} 岗位 · 周需 {totalPosNeed} 人次
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
          <ExportImport config={config} onImport={handleImport} />
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
  const posMap = {};
  config.positions.forEach((p) => {
    posMap[p.id] = p;
  });

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
            <div key={day} className="day-col">
              <h3>{dayName}</h3>
              {config.positions.map((pos) => {
                const assigned = schedule[day]?.[pos.id] || [];
                const short = assigned.length < pos.minStaff;
                return (
                  <div key={pos.id} className="pos-block">
                    <div className="pos-label" style={{ color: POS_COLORS[config.positions.indexOf(pos)] }}>
                      {pos.name} ({assigned.length}/{pos.minStaff})
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
              })}
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
            const posNames = w.positionIds.map(
              (pid) => config.positions.find((p) => p.id === pid)?.name || pid
            );
            return (
              <div key={w.id} className="worker-card">
                <div className="name">{w.name}</div>
                <div className="tags">
                  {posNames.map((n) => (
                    <span key={n} className="tag green">{n}</span>
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
        修改岗位名称和每日最低人数需求。名称修改后，人员中的岗位关联会自动更新。
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
            <span className="label-text">人</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Export / Import
   ════════════════════════════════════════ */
function ExportImport({ config, onImport }) {
  const json = JSON.stringify(config, null, 2);
  return (
    <div className="export-section">
      <p>将配置导出为 JSON 文件，或从之前导出的文件导入恢复配置。</p>
      <button className="btn btn-primary" onClick={() => exportConfig(config)}>
        📥 导出配置
      </button>

      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>当前配置预览</h3>
      <pre>{json}</pre>

      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>导入配置</h3>
      <div className="import-area">
        <input type="file" accept=".json" onChange={onImport} id="import-input" />
        <label htmlFor="import-input" style={{ cursor: "pointer", display: "block" }}>
          <p style={{ fontSize: 32, marginBottom: 4 }}>📂</p>
          <p>点击选择 JSON 配置文件</p>
        </label>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Worker Modal (Add / Edit)
   ════════════════════════════════════════ */
function WorkerModal({ config, initial, onSave, onClose }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [posIds, setPosIds] = useState(initial?.positionIds || []);
  const [offDays, setOffDays] = useState(initial?.offDays || []);

  const togglePos = (id) => {
    setPosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleOff = (d) => {
    setOffDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (posIds.length === 0) return;
    onSave({ name: name.trim(), positionIds: posIds, offDays });
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
            <label>可担任岗位（至少选一个）</label>
            <div className="checkbox-group">
              {config.positions.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={"checkbox-btn" + (posIds.includes(p.id) ? " selected" : "")}
                  style={posIds.includes(p.id) ? { borderColor: POS_COLORS[i], background: POS_COLORS[i] + "22", color: POS_COLORS[i] } : {}}
                  onClick={() => togglePos(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>休息日（可多选）</label>
            <div className="checkbox-group">
              {DAY_NAMES.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className={"checkbox-btn" + (offDays.includes(i) ? " selected" : "")}
                  style={offDays.includes(i) ? { borderColor: "var(--red)", background: "var(--red-light)", color: "var(--red)" } : {}}
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || posIds.length === 0}
            >
              {isEdit ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
