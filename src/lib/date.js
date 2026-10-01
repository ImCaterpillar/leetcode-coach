export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(key, days) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

export function dateDiffInDays(fromKey, toKey = todayKey()) {
  if (!fromKey) return 0;
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd).getTime();
  const to = new Date(ty, tm - 1, td).getTime();
  return Math.floor((to - from) / 86400000);
}

export function formatSeconds(totalSeconds = 0) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(seconds / 60);
  const left = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(left).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds = 0) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const left = seconds % 60;
  return left ? `${minutes} 分 ${left} 秒` : `${minutes} 分钟`;
}
