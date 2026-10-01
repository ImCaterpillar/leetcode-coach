import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, ListChecks, RotateCcw, Timer, Zap } from 'lucide-react';
import {
  byId,
  families,
  levels,
  levelClass,
  mistakeOptions,
  problems,
  reviewFeedbacks,
  stages,
  statusButtons,
  statusMap
} from './data/problems.js';
import { formatDuration, formatSeconds, todayKey } from './lib/date.js';
import {
  defaultPrefs,
  downloadJson,
  loadJson,
  makeExportPayload,
  normalizeRecord,
  normalizeRecords,
  PREF_KEY,
  rememberBackup,
  saveJson,
  STORAGE_KEY,
  TIMER_KEY,
  validateImportPayload
} from './lib/storage.js';
import {
  getStats,
  getStatus,
  makeAttempt,
  nextReviewByFeedback,
  nextReviewByStatus,
  pickRecommended,
  recommendationReasons,
  weakSeverity
} from './lib/review.js';

function Chip({ children, tone = 'neutral', active = false, as: Tag = 'span', ...props }) {
  return (
    <Tag className={`chip ${tone} ${active ? 'active' : ''}`} {...props}>
      {children}
    </Tag>
  );
}

function Progress({ value }) {
  return (
    <div className="progress" aria-label={`进度 ${value}%`}>
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function elapsedOf(record = {}) {
  return Number.isFinite(record.elapsedSeconds)
    ? record.elapsedSeconds
    : Math.max(0, Math.round(Number(record.minutes || 0) * 60));
}

function makeRecordPatch(oldRecord, patch) {
  const normalized = normalizeRecord(oldRecord);
  return { ...normalized, ...patch, updatedAt: new Date().toISOString() };
}

export default function App() {
  const fileInputRef = useRef(null);
  const [records, setRecords] = useState(() => normalizeRecords(loadJson(STORAGE_KEY, {})));
  const [prefs, setPrefs] = useState(() => ({ ...defaultPrefs, ...loadJson(PREF_KEY, {}) }));
  const [selectedId, setSelectedId] = useState(null);
  const [activeTimer, setActiveTimer] = useState(() => loadJson(TIMER_KEY, null));
  const [tick, setTick] = useState(Date.now());
  const [toast, setToast] = useState('');

  const stats = useMemo(() => getStats(problems, records, prefs), [records, prefs]);
  const recommended = useMemo(() => pickRecommended(problems, records, prefs), [records, prefs]);
  const current = byId.get(selectedId) || recommended;
  const currentRecord = current ? normalizeRecord(records[current.id]) : {};
  const currentStatus = current ? getStatus(currentRecord) : 'new';
  const isTimingCurrent = activeTimer?.id === current?.id;
  const currentElapsed = isTimingCurrent ? Math.floor((tick - activeTimer.startedAt) / 1000) : 0;

  useEffect(() => saveJson(STORAGE_KEY, records), [records]);
  useEffect(() => saveJson(PREF_KEY, prefs), [prefs]);

  useEffect(() => {
    if (activeTimer) saveJson(TIMER_KEY, activeTimer);
    else localStorage.removeItem(TIMER_KEY);
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer) return undefined;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer]);

  useEffect(() => {
    if (!selectedId && recommended) setSelectedId(recommended.id);
  }, [recommended, selectedId]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  function showToast(message) {
    setToast(message);
  }

  function addSeconds(baseRecords, id, seconds) {
    if (!id || seconds < 10) return baseRecords;
    const old = normalizeRecord(baseRecords[id]);
    return {
      ...baseRecords,
      [id]: makeRecordPatch(old, { elapsedSeconds: elapsedOf(old) + seconds })
    };
  }

  function settleActiveTimer(baseRecords = records) {
    if (!activeTimer) return { records: baseRecords, seconds: 0, id: null, recorded: false };
    const seconds = Math.max(0, Math.floor((Date.now() - activeTimer.startedAt) / 1000));
    const nextRecords = addSeconds(baseRecords, activeTimer.id, seconds);
    return { records: nextRecords, seconds, id: activeTimer.id, recorded: seconds >= 10 };
  }

  function startTimer(id) {
    if (!id) return;
    if (activeTimer?.id === id) {
      showToast('这题已经在计时中');
      return;
    }

    let baseRecords = records;
    if (activeTimer) {
      const settled = settleActiveTimer(baseRecords);
      baseRecords = settled.records;
      setRecords(baseRecords);
      showToast(settled.recorded ? `已先保存上一题 ${formatDuration(settled.seconds)}` : '上一段计时少于 10 秒，已忽略');
    }

    setSelectedId(id);
    setActiveTimer({ id, startedAt: Date.now() });
    setTick(Date.now());
  }

  function stopTimer() {
    if (!activeTimer) {
      showToast('当前没有正在计时的题');
      return;
    }
    const settled = settleActiveTimer(records);
    setRecords(settled.records);
    setActiveTimer(null);
    showToast(settled.recorded ? `已保存计时 ${formatDuration(settled.seconds)}` : '计时少于 10 秒，已忽略');
  }

  function switchProblem(id) {
    if (!id || id === selectedId) return;
    if (activeTimer) {
      const settled = settleActiveTimer(records);
      setRecords(settled.records);
      setActiveTimer(null);
      showToast(settled.recorded ? `切题前已保存 ${formatDuration(settled.seconds)}` : '切题前短计时已忽略');
    }
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function chooseNext(excludedId, baseRecords = records) {
    const next = pickRecommended(problems, baseRecords, prefs, excludedId);
    setSelectedId(next?.id || null);
  }

  function markStatus(id, status) {
    if (!id) return;
    let baseRecords = records;
    let lastSeconds = 0;
    if (activeTimer?.id === id) {
      const settled = settleActiveTimer(baseRecords);
      baseRecords = settled.records;
      lastSeconds = settled.recorded ? settled.seconds : 0;
      setActiveTimer(null);
    }

    const old = normalizeRecord(baseRecords[id]);
    let nextRecord;
    if (status === 'new') {
      nextRecord = makeRecordPatch(old, {
        status: 'new',
        nextReview: undefined,
        lastDone: undefined,
        reviewCount: old.reviewCount || 0
      });
    } else {
      const reviewCount = (old.reviewCount || 0) + 1;
      const mistakes = old.mistakes || [];
      const attempt = makeAttempt({
        status,
        feedback: 'status',
        seconds: lastSeconds,
        note: old.note || '',
        mistakes
      });
      nextRecord = makeRecordPatch(old, {
        status,
        lastDone: todayKey(),
        reviewCount,
        nextReview: nextReviewByStatus(status, reviewCount),
        attempts: [...(old.attempts || []), attempt].slice(-80)
      });
    }

    const nextRecords = { ...baseRecords, [id]: nextRecord };
    setRecords(nextRecords);
    chooseNext(id, nextRecords);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`已标记为：${statusMap[status]?.label || status}，已切到下一题`);
  }

  function applyReviewFeedback(id, feedback) {
    if (!id) return;
    let baseRecords = records;
    let lastSeconds = 0;
    if (activeTimer?.id === id) {
      const settled = settleActiveTimer(baseRecords);
      baseRecords = settled.records;
      lastSeconds = settled.recorded ? settled.seconds : 0;
      setActiveTimer(null);
    }

    const old = normalizeRecord(baseRecords[id]);
    const oldStatus = getStatus(old);
    const nextStatus = feedback === 'again'
      ? 'solution'
      : feedback === 'hard' && oldStatus === 'ac'
        ? 'bug'
        : feedback === 'easy'
          ? 'ac'
          : oldStatus === 'new'
            ? 'hint'
            : oldStatus;
    const reviewCount = old.lastFeedbackDate === todayKey() ? (old.reviewCount || 0) : (old.reviewCount || 0) + 1;
    const attempt = makeAttempt({
      status: nextStatus,
      feedback,
      seconds: lastSeconds,
      note: old.note || '',
      mistakes: old.mistakes || []
    });
    const nextRecord = makeRecordPatch(old, {
      status: nextStatus,
      lastDone: todayKey(),
      lastFeedbackDate: todayKey(),
      reviewCount,
      nextReview: nextReviewByFeedback(feedback, reviewCount),
      attempts: [...(old.attempts || []), attempt].slice(-80)
    });

    const nextRecords = { ...baseRecords, [id]: nextRecord };
    setRecords(nextRecords);
    chooseNext(id, nextRecords);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`复习反馈 ${feedback.toUpperCase()} 已保存，已切到下一题`);
  }

  function updateNote(id, note) {
    const old = normalizeRecord(records[id]);
    setRecords({ ...records, [id]: makeRecordPatch(old, { note }) });
  }

  function insertReviewTemplate(id) {
    const old = normalizeRecord(records[id]);
    const template = `卡点：\n模板：\n边界：\n下次先想：`;
    const note = String(old.note || '').trim();
    const next = note.includes('卡点：') ? note : `${note ? `${note}\n\n` : ''}${template}`;
    setRecords({ ...records, [id]: makeRecordPatch(old, { note: next }) });
    showToast('已插入复盘模板');
  }

  function toggleMistake(id, label) {
    const old = normalizeRecord(records[id]);
    const currentMistakes = old.mistakes || [];
    const mistakes = currentMistakes.includes(label)
      ? currentMistakes.filter((item) => item !== label)
      : [...currentMistakes, label];
    setRecords({ ...records, [id]: makeRecordPatch(old, { mistakes }) });
  }

  function updatePref(key, value) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setPrefs((prev) => ({ ...prev, query: '', stage: '全部阶段', family: '全部 Pattern', level: '全部难度', status: '全部状态' }));
  }

  function exportData() {
    downloadJson(makeExportPayload(records, prefs), `hot100-records-${todayKey()}.json`);
    showToast('已导出数据');
  }

  async function importData(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = validateImportPayload(parsed);
      const summary = imported.summary;
      const ok = window.confirm(
        `导入预览：\n` +
        `记录数：${summary.recordCount}\n` +
        `独立 AC：${summary.acCount}\n` +
        `薄弱题：${summary.weakCount}\n` +
        `笔记数：${summary.noteCount}\n` +
        `导出时间：${summary.exportedAt}\n\n` +
        `继续导入会覆盖当前本地刷题数据。导入前会自动下载一份当前数据备份。是否继续？`
      );
      if (!ok) {
        showToast('已取消导入');
        return;
      }

      const backup = makeExportPayload(records, prefs, 'leetcode-hot100-coach-lite-before-import');
      rememberBackup(backup);
      downloadJson(backup, `hot100-backup-before-import-${todayKey()}.json`);

      const nextPrefs = { ...defaultPrefs, ...prefs, ...imported.prefs };
      setRecords(imported.records);
      setPrefs(nextPrefs);
      setActiveTimer(null);
      setSelectedId(pickRecommended(problems, imported.records, nextPrefs)?.id || null);
      showToast('导入完成，原数据已备份');
    } catch (error) {
      window.alert(`导入失败：${error.message || '不是有效 JSON 文件'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const filteredProblems = useMemo(() => {
    const query = String(prefs.query || '').trim().toLowerCase();
    return problems.filter((p) => {
      const record = records[p.id];
      const status = getStatus(record);
      const text = `${p.id} ${p.title} ${p.tag} ${p.family} ${p.finePattern} ${p.stage}`.toLowerCase();
      return (!query || text.includes(query))
        && (prefs.stage === '全部阶段' || p.stage === prefs.stage)
        && (prefs.family === '全部 Pattern' || p.family === prefs.family)
        && (prefs.level === '全部难度' || p.level === prefs.level)
        && (prefs.status === '全部状态' || status === prefs.status)
        && (!prefs.hideHard || p.level !== '困难' || status !== 'new');
    });
  }, [prefs, records]);

  const stageRows = useMemo(() => {
    return [...new Set(problems.map((p) => p.stage))].map((stage) => {
      const group = problems.filter((p) => p.stage === stage);
      const touched = group.filter((p) => getStatus(records[p.id]) !== 'new').length;
      const ac = group.filter((p) => getStatus(records[p.id]) === 'ac').length;
      return { stage, total: group.length, touched, ac };
    });
  }, [records]);

  const recReasons = current ? recommendationReasons(current, records, prefs) : [];
  const totalSeconds = elapsedOf(currentRecord) + currentElapsed;
  const touchedPct = percent(stats.touched.length, problems.length);
  const acPct = percent(stats.ac.length, problems.length);
  const weakPct = percent(stats.weak.length, Math.max(1, stats.touched.length));

  return (
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="application/json"
        onChange={(event) => event.target.files?.[0] && importData(event.target.files[0])}
      />

      <header className="hero">
        <div>
          <div className="eyebrow"><Zap size={15} /> Hot 100 Personal Coach</div>
          <h1>极简刷题台</h1>
          <p>只保留今天要做什么、这题做得怎样、下一步复习什么。</p>
        </div>
        <div className="hero-actions">
          <button className="button ghost" onClick={exportData}><Download size={16} /> 导出</button>
          <button className="button ghost" onClick={() => fileInputRef.current?.click()}><FileUp size={16} /> 导入</button>
          <a className="button primary" href="https://leetcode.cn/studyplan/top-100-liked/" target="_blank" rel="noreferrer">打开 Hot 100</a>
        </div>
      </header>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span>已接触</span>
          <strong>{stats.touched.length}/100</strong>
          <Progress value={touchedPct} />
        </article>
        <article className="kpi-card">
          <span>独立 AC</span>
          <strong>{stats.ac.length}/100</strong>
          <Progress value={acPct} />
        </article>
        <article className="kpi-card">
          <span>薄弱题</span>
          <strong>{stats.weak.length}</strong>
          <Progress value={weakPct} />
        </article>
        <article className="kpi-card">
          <span>今日队列</span>
          <strong>{stats.todayTasks.length}/{prefs.maxToday}</strong>
          <small>复习 {stats.reviewTasks.length} · 新题 {stats.newTasks.length}</small>
        </article>
      </section>

      <main className="main-flow">
        <section className="workspace card">
          <div className="section-head">
            <div>
              <h2>{stats.due.some((p) => p.id === current?.id) ? '先复习这题' : '推荐下一题'}</h2>
              <p>标记结果或提交复习反馈后，会自动切到下一题。</p>
            </div>
            <Chip tone="neutral">#{current?.id} · {current?.stage}</Chip>
          </div>

          {current && (
            <div className="problem-area">
              <div className="problem-main">
                <div className="problem-title-row">
                  <h3>{current.title}</h3>
                  <Chip tone={levelClass[current.level]}>{current.level}</Chip>
                  <Chip tone={statusMap[currentStatus]?.className}>{statusMap[currentStatus]?.label}</Chip>
                </div>
                <div className="subline">{current.family} · {current.finePattern} · {current.tag}</div>

                <div className="reason-box">
                  <strong>推荐原因</strong>
                  <ul>
                    {recReasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>

                <div className="action-strip">
                  <a className="button primary" href={current.url} target="_blank" rel="noreferrer">打开题目</a>
                  <button className="button ghost" onClick={() => startTimer(current.id)} disabled={isTimingCurrent}>
                    <Timer size={16} /> {isTimingCurrent ? '计时中' : '开始计时'}
                  </button>
                  <button className="button ghost" onClick={stopTimer} disabled={!activeTimer}>停止保存</button>
                  <button className="button subtle" onClick={() => markStatus(current.id, 'new')}><RotateCcw size={16} /> 重置</button>
                </div>

                <div className="status-panel">
                  <div className="panel-title">做题结果</div>
                  <div className="status-buttons">
                    {statusButtons.map(([key, label]) => (
                      <button key={key} className={`status-button ${key}`} onClick={() => markStatus(current.id, key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="status-panel review-panel">
                  <div className="panel-title">复习反馈</div>
                  <div className="feedback-grid">
                    {reviewFeedbacks.map(([key, label, desc]) => (
                      <button key={key} className={`feedback ${key}`} onClick={() => applyReviewFeedback(current.id, key)}>
                        <b>{label}</b><span>{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="timer-card">
                <span>本题计时</span>
                <strong>{formatSeconds(totalSeconds)}</strong>
                <small>累计 {formatDuration(elapsedOf(currentRecord))}</small>
                <small>{activeTimer ? `正在计时：#${activeTimer.id}` : '未计时'}</small>
              </aside>
            </div>
          )}
        </section>

        <section className="card note-card">
          <div className="section-head compact">
            <div>
              <h2>复盘笔记</h2>
              <p>写少一点，但要能提醒下次怎么想。</p>
            </div>
            <button className="button ghost" onClick={() => insertReviewTemplate(current.id)}>插入模板</button>
          </div>
          <textarea
            value={currentRecord.note || ''}
            onChange={(event) => updateNote(current.id, event.target.value)}
            placeholder="卡点：\n模板：\n边界：\n下次先想："
          />
          <div className="mistake-zone">
            <div className="panel-title">错因标签</div>
            <div className="chips-wrap">
              {mistakeOptions.map((label) => (
                <Chip
                  key={label}
                  as="button"
                  tone="mistake"
                  active={(currentRecord.mistakes || []).includes(label)}
                  onClick={() => toggleMistake(current.id, label)}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="card today-card">
          <div className="section-head compact">
            <div>
              <h2>今日队列</h2>
              <p>限制最大题数，防止复习堆爆。</p>
            </div>
            <Chip tone="neutral">最多 {prefs.maxToday} 题</Chip>
          </div>
          <div className="task-list">
            {stats.todayTasks.length ? stats.todayTasks.map((problem) => (
              <button key={problem.id} className="task-row" onClick={() => switchProblem(problem.id)}>
                <span>#{problem.id}</span>
                <b>{problem.title}</b>
                <em>{problem.family}</em>
                <Chip tone={statusMap[getStatus(records[problem.id])]?.className}>{statusMap[getStatus(records[problem.id])]?.short}</Chip>
              </button>
            )) : <div className="empty">今天没有强制待办，随便挑一题练习。</div>}
          </div>
        </section>

        <details className="card collapsible" open>
          <summary><ListChecks size={18} /> 题目列表 <span>{filteredProblems.length} 题</span></summary>
          <div className="filters">
            <input value={prefs.query} placeholder="搜索题号 / 名称 / 标签" onChange={(event) => updatePref('query', event.target.value)} />
            <select value={prefs.stage} onChange={(event) => updatePref('stage', event.target.value)}>
              {stages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
            <select value={prefs.family} onChange={(event) => updatePref('family', event.target.value)}>
              {families.map((family) => <option key={family}>{family}</option>)}
            </select>
            <select value={prefs.level} onChange={(event) => updatePref('level', event.target.value)}>
              {levels.map((level) => <option key={level}>{level}</option>)}
            </select>
            <select value={prefs.status} onChange={(event) => updatePref('status', event.target.value)}>
              <option value="全部状态">全部状态</option>
              {Object.entries(statusMap).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
            <button className="button ghost" onClick={resetFilters}>清空</button>
          </div>
          <div className="settings-row">
            <label><input type="checkbox" checked={prefs.hideHard} onChange={(event) => updatePref('hideHard', event.target.checked)} /> 未刷时隐藏困难题</label>
            <label>今日目标 <input type="number" min="1" max="10" value={prefs.dailyTarget} onChange={(event) => updatePref('dailyTarget', Number(event.target.value || 1))} /></label>
            <label>今日最多 <input type="number" min="1" max="12" value={prefs.maxToday} onChange={(event) => updatePref('maxToday', Number(event.target.value || 1))} /></label>
            <label>复习最多 <input type="number" min="0" max="12" value={prefs.maxReview} onChange={(event) => updatePref('maxReview', Number(event.target.value || 0))} /></label>
            <label>新题最多 <input type="number" min="0" max="12" value={prefs.maxNew} onChange={(event) => updatePref('maxNew', Number(event.target.value || 0))} /></label>
          </div>
          <div className="problem-list">
            {filteredProblems.map((problem) => {
              const record = normalizeRecord(records[problem.id]);
              const status = getStatus(record);
              return (
                <button key={problem.id} className={`problem-row ${selectedId === problem.id ? 'active' : ''}`} onClick={() => switchProblem(problem.id)}>
                  <span className="number">#{problem.id}</span>
                  <span className="name"><b>{problem.title}</b><small>{problem.family} · {problem.tag} · {problem.stage}</small></span>
                  <Chip tone={levelClass[problem.level]}>{problem.level}</Chip>
                  <Chip tone={statusMap[status]?.className}>{statusMap[status]?.short}</Chip>
                </button>
              );
            })}
          </div>
        </details>

        <section className="side-grid">
          <section className="card">
            <div className="section-head compact"><h2>薄弱题</h2><p>按严重程度排序</p></div>
            <div className="mini-list">
              {stats.weak.length ? stats.weak.slice(0, 8).map((problem) => (
                <button key={problem.id} className="mini-row" onClick={() => switchProblem(problem.id)}>
                  <b>#{problem.id} {problem.title}</b>
                  <span>{problem.family} · 严重度 {Math.round(weakSeverity(problem, records[problem.id]))}</span>
                </button>
              )) : <div className="empty">暂时没有薄弱题。</div>}
            </div>
          </section>

          <section className="card">
            <div className="section-head compact"><h2>阶段进度</h2><p>已接触 / 独立 AC</p></div>
            <div className="stage-list">
              {stageRows.map((row) => (
                <div className="stage-row" key={row.stage}>
                  <span>{row.stage.replace('第 ', 'S').replace(' 阶段', '')}</span>
                  <div>
                    <Progress value={percent(row.touched, row.total)} />
                    <small>接触 {row.touched}/{row.total} · AC {row.ac}/{row.total}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
