export const STORAGE_KEY = 'leetcode-hot100-static-records-v1';
export const PREF_KEY = 'leetcode-hot100-static-preferences-v1';
export const TIMER_KEY = 'leetcode-hot100-active-timer-v2';
export const BACKUP_KEY = 'leetcode-hot100-import-backups-v2';

export const defaultPrefs = {
  dailyTarget: 3,
  maxToday: 6,
  maxReview: 4,
  maxNew: 3,
  hideHard: true,
  query: '',
  stage: '全部阶段',
  family: '全部 Pattern',
  level: '全部难度',
  status: '全部状态'
};

export function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeRecord(record = {}) {
  const elapsedSeconds = Number.isFinite(record.elapsedSeconds)
    ? record.elapsedSeconds
    : Math.max(0, Math.round(Number(record.minutes || 0) * 60));

  return {
    ...record,
    elapsedSeconds,
    mistakes: Array.isArray(record.mistakes) ? record.mistakes : [],
    attempts: Array.isArray(record.attempts) ? record.attempts : []
  };
}

export function normalizeRecords(records = {}) {
  return Object.fromEntries(
    Object.entries(records || {}).map(([id, record]) => [id, normalizeRecord(record)])
  );
}

export function makeExportPayload(records, prefs, app = 'leetcode-hot100-coach-lite') {
  return {
    app,
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    records,
    prefs
  };
}

export function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function validateImportPayload(data) {
  const records = data?.records || data;
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    throw new Error('没有找到 records 对象');
  }

  const ids = Object.keys(records).filter((id) => /^\d+$/.test(id));
  if (!ids.length) throw new Error('records 里没有有效题号记录');

  const normalized = normalizeRecords(Object.fromEntries(ids.map((id) => [id, records[id]])));
  const prefs = data?.prefs && typeof data.prefs === 'object' ? data.prefs : {};
  const noteCount = ids.filter((id) => String(normalized[id].note || '').trim()).length;
  const acCount = ids.filter((id) => normalized[id].status === 'ac').length;
  const weakCount = ids.filter((id) => ['hint', 'solution', 'bug'].includes(normalized[id].status)).length;

  return {
    records: normalized,
    prefs,
    summary: {
      recordCount: ids.length,
      noteCount,
      acCount,
      weakCount,
      exportedAt: data?.exportedAt || '未知'
    }
  };
}

export function rememberBackup(payload) {
  const backups = loadJson(BACKUP_KEY, []);
  const next = [payload, ...backups].slice(0, 5);
  saveJson(BACKUP_KEY, next);
}
