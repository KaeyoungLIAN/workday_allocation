import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadWorkers,
  saveWorkers,
  exportWorkers,
  copyWorkers,
  importWorkers,
  importWorkersFromText,
  loadPositions,
  savePositions,
  loadPriorities,
  savePriorities,
  getDefaultWorkers,
  generatePosId,
} from "./config";
import { generateSchedule, validateSchedule, DAY_NAMES } from "./scheduler";
import "./App.css";

const POS_COLORS = ["#6c5ce7", "#00b894", "#fdcb6e", "#e17055", "#fd79a8", "#a29bfe", "#fab1a0", "#55efc4"];

let nextWorkerId = Date.now();

export default function App() {
  const [positions] = useState(() => loadPositions());
  const [priorities, setPriorities] = useState(() => loadPriorities(loadPositions()));
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

  useEffect(() => { saveWorkers(workers); }, [workers]);
  useEffect(() => { savePositions(positions); }, [positions]);
  useEffect(() => { savePriorities(priorities); }, [priorities]);

  const totalNeed = positions.reduce((s, p) => s + p.minStaff * 6, 0);

  // 排班 tab
  const [tab, setTab] = useState("schedule");

  const doGenerate = useCallback(() => {
    const s = generateSchedule({ workers, positions, priorities });
    setSchedule(s);
    const ws = validateSchedule({ workers, positions, priorities }, s);
    setWarnings(ws);
    setStatus(ws.length === 0 ? "✅ 排班生成完成" : `⚠️ 完成，但有${ws.length}条警告`);
  }, [workers, positions, priorities]);

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

  const updatePriorities = (newPrios) => {
    setPriorities(newPrios);
    setSchedule(null);
    setWarnings([]);
  };

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
            onGenerate={doGenerate}
            positions={positions}
            priorities={priorities}
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
            priorities={priorities}
            onPositionsChange={updatePositions}
            onPrioritiesChange={updatePriorities}
            setStatus={setStatus}
          />
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
   Schedule View — 始终显示岗位日历，点击按钮才排人
   ════════════════════════════════════════ */
function ScheduleView({ schedule, warnings, onGenerate, positions, priorities }) {
  const warningRef = useRef(null);

  const handleGenerate = () => {
    onGenerate();
    // 滚到警告区域
    setTimeout(() => {
      warningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // 某岗位某天是否需要
  const needOnDay = (posId, day) => {
    if (day === 5) return false;
    const prio = priorities?.[posId]?.[day] ?? 9;
    if (prio <= 0) return false;
    // 授权岗周一~周五
    if (posId === "pos_sq" && day >= 0 && day <= 4) return false;
    return true;
  };

  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleGenerate}>🔄 随机生成排班</button>
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
          <div key={day} className={"day-col" + (day === 5 ? " day-off" : "")}>
            <h3>{dayName}{day === 5 && <span className="rest-badge">固定休息</span>}</h3>
            {day === 5 ? (
              <div className="rest-msg">😴 全体休息</div>
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
   Positions View — 岗位管理 + 每日优先级
   ════════════════════════════════════════ */
function PositionsView({ positions, priorities, onPositionsChange, onPrioritiesChange, setStatus }) {
  const [editName, setEditName] = useState(() => positions.map((p) => p.name));

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
    onPositionsChange(next);
  };

  const addPos = () => {
    const id = generatePosId();
    const next = [...positions, { id, name: "新岗位", minStaff: 1, maxStaff: 1 }];
    onPositionsChange(next);
    // 为新岗位生成默认优先级
    const newP = { ...priorities };
    newP[id] = new Array(7).fill(9);
    newP[id][5] = 0;
    onPrioritiesChange(newP);
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
    // 同时清理优先级
    const newP = { ...priorities };
    delete newP[pos.id];
    onPrioritiesChange(newP);
    setStatus("✅ 已删除岗位");
  };

  const applyName = (index) => {
    const next = positions.map((p, i) =>
      i === index ? { ...p, name: editName[i] || p.name } : p
    );
    onPositionsChange(next);
  };

  // 优先级编辑
  const setDayPriority = (posId, day, value) => {
    const v = Math.max(0, Math.min(99, parseInt(value) || 0));
    const newP = { ...priorities, [posId]: [...(priorities[posId] || new Array(7).fill(9))] };
    newP[posId][day] = v;
    onPrioritiesChange(newP);
  };

  const adjustPrio = (posId, day, delta) => {
    const cur = priorities?.[posId]?.[day] ?? 9;
    setDayPriority(posId, day, cur + delta);
  };

  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={addPos}>+ 添加岗位</button>
      </div>

      {/* 岗位配置列表 */}
      <div className="pos-config-list">
        <div className="pos-config-header">
          <span style={{ flexBasis: 120 }}>岗位</span>
          <span style={{ flexBasis: 80 }}>最少</span>
          <span style={{ flexBasis: 80 }}>最多</span>
        </div>
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

      {/* 每日优先级编辑 */}
      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>每日岗位优先级（数字越小越优先，0=当天不需要）</h3>
      <div className="priority-grid">
        <div className="prio-grid-header">
          <span className="prio-cell empty"></span>
          {DAY_NAMES.map((d, i) => (
            <span key={i} className={"prio-cell day" + (i === 5 ? " off" : "")}>{d}</span>
          ))}
        </div>
        {positions.map((pos, pi) => (
          <div key={pos.id} className="prio-row">
            <span className="prio-cell name" style={{ color: POS_COLORS[pi % POS_COLORS.length] }}>{pos.name}</span>
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const val = priorities?.[pos.id]?.[day] ?? 9;
              return day === 5 ? (
                <span key={day} className="prio-cell off">—</span>
              ) : (
                <span key={day} className="prio-cell">
                  <button className="prio-btn" onClick={() => adjustPrio(pos.id, day, -1)}>−</button>
                  <input
                    className="prio-input"
                    type="number"
                    min={0}
                    max={99}
                    value={val}
                    onChange={(e) => setDayPriority(pos.id, day, e.target.value)}
                  />
                  <button className="prio-btn" onClick={() => adjustPrio(pos.id, day, +1)}>+</button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Export View
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
      <p>岗位和人员都是可自定义的。导出数据包含人员信息。</p>
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
   Worker Modal
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
                    <span className="pos-prio-name" style={selected ? { color: POS_COLORS[i % POS_COLORS.length] } : {}}>{p.name}</span>
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
