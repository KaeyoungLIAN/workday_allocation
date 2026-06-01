import { useState, useEffect, useCallback } from "react";
import {
  loadWorkers,
  saveWorkers,
  exportWorkers,
  copyWorkers,
  importWorkers,
  importWorkersFromText,
  loadPositions,
  savePositions,
  resetPositions,
  generatePosId,
} from "./config";
import { generateSchedule, validateSchedule, DAY_NAMES } from "./scheduler";
import "./App.css";

const POS_COLORS = ["#6c5ce7", "#00b894", "#fdcb6e", "#e17055", "#fd79a8", "#a29bfe", "#fab1a0", "#55efc4"];

let nextWorkerId = Date.now();

export default function App() {
  const [tab, setTab] = useState("schedule");
  const [workers, setWorkers] = useState(() => loadWorkers());
  const [positions, setPositions] = useState(() => loadPositions());
  const [schedule, setSchedule] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [workerModal, setWorkerModal] = useState(null);
  const [status, setStatus] = useState("");
  const [showWarnings, setShowWarnings] = useState(false); // 点击排班后才显示

  useEffect(() => { saveWorkers(workers); }, [workers]);
  useEffect(() => { savePositions(positions); }, [positions]);

  const doGenerate = useCallback(() => {
    const s = generateSchedule({ workers, positions });
    setSchedule(s);
    const ws = validateSchedule({ workers, positions }, s);
    setWarnings(ws);
    setShowWarnings(true);
    setStatus(ws.length === 0 ? "✅ 排班生成完成" : `⚠️ 完成，但有${ws.length}条警告`);
  }, [workers, positions]);

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
    setShowWarnings(false);
  };

  const totalNeed = positions.reduce((s, p) => s + p.minStaff * 6, 0);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="app-header">
        <div>
          <h1>📋 排班分配器</h1>
          <span>{workers.length} 人 · {positions.length} 岗位 · 周需 {totalNeed} 人次 · 周六固定休息</span>
        </div>
        <div className="tabs">
          <button className={"tab-btn" + (tab === "schedule" ? " active" : "")} onClick={() => setTab("schedule")}>🗓 排班表</button>
          <button className={"tab-btn" + (tab === "workers" ? " active" : "")} onClick={() => setTab("workers")}>👥 人员</button>
          <button className={"tab-btn" + (tab === "positions" ? " active" : "")} onClick={() => setTab("positions")}>🏢 岗位</button>
          <button className={"tab-btn" + (tab === "export" ? " active" : "")} onClick={() => setTab("export")}>📦 导出</button>
        </div>
      </header>

      <div className="content" style={{ flex: 1 }}>
        {tab === "schedule" && (
          <ScheduleView
            schedule={schedule}
            warnings={warnings}
            showWarnings={showWarnings}
            onGenerate={doGenerate}
            positions={positions}
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
          <PositionsView positions={positions} onChange={updatePositions} setStatus={setStatus} />
        )}
        {tab === "export" && <ExportView workers={workers} setStatus={setStatus} onImport={(data) => { setWorkers(data); setStatus("✅ 人员已导入"); }} />}

        {workerModal && (
          <WorkerModal
            initial={workerModal === "add" ? null : workerModal}
            positions={positions}
            onSave={(data) => { workerModal === "add" ? addWorker(data) : updateWorker(workerModal.id, data); }}
            onClose={() => setWorkerModal(null)}
          />
        )}
      </div>

      <div className="status-bar">{status}</div>
    </div>
  );
}

/* ════════════════════════════════════════
   Schedule View
   ════════════════════════════════════════ */
function ScheduleView({ schedule, warnings, showWarnings, onGenerate, positions }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
        <strong>平日优先级：</strong>大堂 &gt; 现金柜员 &gt; 普通柜员 &nbsp;|&nbsp;
        <strong>周日：</strong>大堂 &gt; 现金柜员 &gt; 普通柜员=授权岗
      </p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onGenerate}>🔄 随机生成排班</button>
      </div>
      {showWarnings && warnings.length > 0 && (
        <div className="warning-panel" style={{ marginTop: 12 }}>
          <div className="warning-title">⚠️ 排班警告 ({warnings.length})</div>
          {warnings.map((w, i) => <div key={i} className="warning-badge" style={{ marginTop: 4 }}>⚠️ {w}</div>)}
        </div>
      )}
      {schedule ? (
        <div className="schedule-grid">
          {DAY_NAMES.map((dayName, day) => (
            <div key={day} className={"day-col" + (day === 5 ? " day-off" : "")}>
              <h3>{dayName}{day === 5 && <span className="rest-badge">固定休息</span>}</h3>
              {day === 5 ? (
                <div className="rest-msg">😴 全体休息</div>
              ) : (
                positions.map((pos, pi) => {
                  if (!needPosOnDay(pos.id, day, positions)) return null;
                  const assigned = schedule[day]?.[pos.id] || [];
                  const short = assigned.length < pos.minStaff;
                  return (
                    <div key={pos.id} className="pos-block">
                      <div className="pos-label" style={{ color: POS_COLORS[pi % POS_COLORS.length] }}>
                        {pos.name} ({assigned.length}/{pos.minStaff}{pos.maxStaff !== pos.minStaff ? `~${pos.maxStaff}` : ''})
                      </div>
                      {assigned.length > 0 ? assigned.map((name, i) => (
                        <div key={i} className={"pos-worker" + (short ? " short" : "")}>{name}</div>
                      )) : (
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
        <p style={{ marginTop: 24, color: "var(--text-secondary)" }}>点击"随机生成排班"按钮生成一周排班</p>
      )}
    </div>
  );
}

function needPosOnDay(posId, day, positions) {
  if (day === 5) return false;
  if (posId === "pos_sq" && day >= 0 && day <= 4) return false;
  return true;
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
  const posInfos = (w.positions || []).map((pw) => {
    const pos = positions.find((p) => p.id === pw.id);
    return { name: pos?.name || pw.id, priority: pw.priority ?? 3 };
  });
  return (
    <div className="worker-card">
      <div className="name">{w.name}</div>
      <div className="tags">
        {posInfos.map((pi) => (
          <span key={pi.name} className="tag green" title={`优先级 ${pi.priority}（越小越高）`}>
            {pi.name} ⭐{pi.priority}
          </span>
        ))}
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
   Positions View — 自定义岗位管理
   ════════════════════════════════════════ */
function PositionsView({ positions, onChange, setStatus }) {
  const [editName, setEditName] = useState(() => positions.map((p) => p.name));

  // 同步 editName 当 positions 从外部改变时
  useEffect(() => {
    setEditName(positions.map((p) => p.name));
  }, [positions]);

  const updatePos = (index, field, value) => {
    const next = positions.map((p, i) => {
      if (i !== index) return p;
      let v = value;
      if (field === "minStaff" || field === "maxStaff") {
        v = Math.max(1, parseInt(value) || 1);
      }
      return { ...p, [field]: v };
    });
    onChange(next);
  };

  const addPos = () => {
    const id = generatePosId();
    const next = [...positions, { id, name: "新岗位", minStaff: 1, maxStaff: 1 }];
    onChange(next);
    setEditName(next.map((p) => p.name));
    setStatus("✅ 已添加新岗位");
  };

  const deletePos = (index) => {
    if (positions.length <= 1) {
      setStatus("⚠️ 至少保留一个岗位");
      return;
    }
    const next = positions.filter((_, i) => i !== index);
    onChange(next);
    setStatus("✅ 已删除岗位");
  };

  const applyName = (index) => {
    const next = positions.map((p, i) =>
      i === index ? { ...p, name: editName[i] || p.name } : p
    );
    onChange(next);
  };

  const handleReset = () => {
    const next = resetPositions();
    onChange(next);
    setStatus("✅ 已重置为默认岗位");
  };

  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={addPos}>+ 添加岗位</button>
        <button className="btn btn-danger" onClick={handleReset}>↺ 恢复默认</button>
      </div>
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
    </div>
  );
}

/* ════════════════════════════════════════
   Export View — workers only
   ════════════════════════════════════════ */
function ExportView({ workers, setStatus }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const handleCopy = () => { copyWorkers(workers); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleDownload = () => { exportWorkers(workers); setDownloaded(true); setTimeout(() => setDownloaded(false), 2000); };

  const handlePasteImport = () => {
    try {
      const data = importWorkersFromText(pasteText);
      localStorage.setItem("wd_workers", JSON.stringify(data));
      setStatus("✅ 人员已导入，请刷新页面");
      setPasteText("");
    } catch (err) {
      setStatus(`❌ 导入失败: ${err.message}`);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importWorkers(file);
      localStorage.setItem("wd_workers", JSON.stringify(data));
      setStatus("✅ 人员已导入，请刷新页面");
    } catch (err) {
      setStatus(`❌ ${err.message}`);
    }
    e.target.value = "";
  };

  return (
    <div className="export-section">
      <p>岗位和人员都是可自定义的，导出数据包含人员信息。</p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleCopy}>{copied ? "✅ 已复制" : "📋 复制人员"}</button>
        <button className="btn" onClick={handleDownload}>{downloaded ? "✅ 已下载" : "📥 下载人员"}</button>
      </div>
      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>当前人员 ({workers.length} 人)</h3>
      <pre>{JSON.stringify(workers, null, 2)}</pre>

      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>导入人员数据</h3>
      <textarea className="import-textarea" rows={6} placeholder="在此粘贴人员 JSON..." value={pasteText}
        onChange={(e) => setPasteText(e.target.value)} />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handlePasteImport} disabled={!pasteText.trim()}>📥 从粘贴导入</button>
      </div>
      <div className="import-area" style={{ marginTop: 12 }}>
        <input type="file" accept=".json" onChange={handleFileImport} id="import-input" />
        <label htmlFor="import-input" style={{ cursor: "pointer", display: "block" }}>
          <p style={{ fontSize: 32, marginBottom: 4 }}>📂</p>
          <p>或点击选择人员 JSON 文件</p>
        </label>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Worker Modal — with priority per position
   ════════════════════════════════════════ */
function WorkerModal({ initial, positions, onSave, onClose }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [workerPos, setWorkerPos] = useState(initial?.positions || []);
  const [offDays, setOffDays] = useState(initial?.offDays || []);

  const togglePos = (posId) => {
    setWorkerPos((prev) => {
      const existing = prev.find((p) => p.id === posId);
      return existing ? prev.filter((p) => p.id !== posId) : [...prev, { id: posId, priority: 3 }];
    });
  };

  const setPriority = (posId, delta) => {
    setWorkerPos((prev) => prev.map((p) =>
      p.id === posId ? { ...p, priority: Math.max(1, Math.min(10, (p.priority || 3) + delta)) } : p
    ));
  };

  const toggleOff = (d) => {
    if (d === 5) return;
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
            <label>岗位与优先级（数字越小优先级越高，至少选一个）</label>
            <div className="pos-priority-grid">
              {positions.map((p, i) => {
                const entry = workerPos.find((ep) => ep.id === p.id);
                const selected = !!entry;
                return (
                  <div key={p.id} className="pos-priority-row"
                    style={selected ? { borderColor: POS_COLORS[i % POS_COLORS.length], background: POS_COLORS[i % POS_COLORS.length] + "15" } : {}}
                    onClick={() => togglePos(p.id)}>
                    <span className="pos-prio-name" style={selected ? { color: POS_COLORS[i % POS_COLORS.length] } : {}}>{p.name} ({p.minStaff}{p.maxStaff !== p.minStaff ? `~${p.maxStaff}` : ''}人)</span>
                    {selected && (
                      <div className="prio-control" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="prio-btn" onClick={() => setPriority(p.id, -1)}>-</button>
                        <span className="prio-value">{entry.priority ?? 3}</span>
                        <button type="button" className="prio-btn" onClick={() => setPriority(p.id, +1)}>+</button>
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
                <button key={i} type="button"
                  className={"checkbox-btn" + (offDays.includes(i) ? " selected" : "") + (i === 5 ? " auto-off" : "")}
                  style={i === 5 ? { borderColor: "var(--text-muted)", opacity: 0.5, cursor: "default" }
                    : offDays.includes(i) ? { borderColor: "var(--red)", background: "var(--red-light)", color: "var(--red)" } : {}}
                  onClick={() => i !== 5 && toggleOff(i)}>
                  {d}{i === 5 ? " (自动)" : ""}
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
