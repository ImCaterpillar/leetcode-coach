import { addDays, dateDiffInDays, todayKey } from './date.js';

export function getStatus(record = {}) {
  return record.status || 'new';
}

export function nextReviewByStatus(status, reviewCount = 0) {
  const table = {
    solution: [1, 3, 7, 14, 30],
    hint: [2, 4, 8, 16, 30],
    bug: [3, 7, 14, 30],
    ac: [14, 30, 60]
  };
  const intervals = table[status] || [1];
  return addDays(todayKey(), intervals[Math.min(reviewCount, intervals.length - 1)]);
}

export function nextReviewByFeedback(feedback, reviewCount = 0) {
  const intervals = {
    again: [1, 1, 2],
    hard: [2, 3, 5, 7],
    good: [7, 10, 14, 21],
    easy: [21, 30, 45, 60]
  };
  const list = intervals[feedback] || intervals.good;
  return addDays(todayKey(), list[Math.min(reviewCount, list.length - 1)]);
}

export function weakSeverity(problem, record = {}) {
  const statusScore = { solution: 80, hint: 60, bug: 70, ac: 0, new: 10 }[getStatus(record)] ?? 0;
  const overdue = record.nextReview ? Math.max(0, dateDiffInDays(record.nextReview)) * 8 : 0;
  const mistakeScore = (record.mistakes?.length || 0) * 6;
  const repeatScore = Math.min(30, (record.reviewCount || 0) * 3);
  const hardBonus = problem.level === '困难' ? 8 : 0;
  return statusScore + overdue + mistakeScore + repeatScore + hardBonus;
}

export function recommendationScore(problem, record = {}, familyWeakCount = 0, prefs = {}) {
  const status = getStatus(record);
  const overdue = record.nextReview ? Math.max(0, dateDiffInDays(record.nextReview)) : 0;
  const dueScore = overdue > 0 || record.nextReview === todayKey() ? 120 + overdue * 18 : 0;
  const statusScore = { solution: 95, hint: 80, bug: 90, new: 42, ac: -20 }[status] ?? 0;
  const familyScore = Math.min(35, familyWeakCount * 7);
  const difficultyScore = problem.level === '简单' ? 6 : problem.level === '中等' ? 12 : -8;
  const hardPenalty = prefs.hideHard && problem.level === '困难' && status === 'new' ? -1000 : 0;
  const todayPenalty = record.lastDone === todayKey() ? -140 : 0;
  return dueScore + statusScore + familyScore + difficultyScore + hardPenalty + todayPenalty - problem.order / 1000;
}

export function buildFamilyWeakMap(problems, records) {
  const map = new Map();
  problems.forEach((p) => {
    const status = getStatus(records[p.id]);
    if (['hint', 'solution', 'bug'].includes(status)) {
      map.set(p.family, (map.get(p.family) || 0) + 1);
    }
  });
  return map;
}

export function getStats(problems, records, prefs) {
  const today = todayKey();
  const touched = problems.filter((p) => getStatus(records[p.id]) !== 'new');
  const ac = problems.filter((p) => getStatus(records[p.id]) === 'ac');
  const weak = problems
    .filter((p) => ['hint', 'solution', 'bug'].includes(getStatus(records[p.id])))
    .sort((a, b) => weakSeverity(b, records[b.id]) - weakSeverity(a, records[a.id]) || a.order - b.order);

  const due = problems
    .filter((p) => records[p.id]?.nextReview && records[p.id].nextReview <= today)
    .sort((a, b) => {
      const ar = records[a.id];
      const br = records[b.id];
      return dateDiffInDays(br.nextReview) - dateDiffInDays(ar.nextReview) || weakSeverity(b, br) - weakSeverity(a, ar) || a.order - b.order;
    });

  const newQueue = problems.filter((p) => getStatus(records[p.id]) === 'new' && (!prefs.hideHard || p.level !== '困难'));
  const todayDone = problems.filter((p) => records[p.id]?.lastDone === today).length;

  const maxToday = Math.max(1, Number(prefs.maxToday || 6));
  const maxReview = Math.max(0, Number(prefs.maxReview || 4));
  const maxNew = Math.max(0, Number(prefs.maxNew || 3));
  const reviewTasks = due.slice(0, Math.min(maxReview, maxToday));
  const remaining = Math.max(0, maxToday - reviewTasks.length);
  const newTasks = newQueue.slice(0, Math.min(maxNew, remaining));
  const todayTasks = [...reviewTasks, ...newTasks];

  return { touched, ac, weak, due, newQueue, todayDone, todayTasks, reviewTasks, newTasks };
}

export function pickRecommended(problems, records, prefs, excludedId = null) {
  const familyWeakMap = buildFamilyWeakMap(problems, records);
  const candidates = problems
    .filter((p) => p.id !== excludedId)
    .map((p) => ({
      problem: p,
      score: recommendationScore(p, records[p.id], familyWeakMap.get(p.family) || 0, prefs)
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.problem || problems[0];
}

export function recommendationReasons(problem, records, prefs) {
  const record = records[problem.id] || {};
  const status = getStatus(record);
  const reasons = [];
  const overdue = record.nextReview ? dateDiffInDays(record.nextReview) : 0;

  if (record.nextReview && record.nextReview <= todayKey()) {
    reasons.push(overdue > 0 ? `复习已逾期 ${overdue} 天` : '今天到期复习');
  }
  if (status === 'solution') reasons.push('上次需要看题解，优先重新独立复现');
  if (status === 'hint') reasons.push('上次看提示才会，适合做主动回忆');
  if (status === 'bug') reasons.push('上次能做但有 bug，适合修实现细节');
  if (status === 'new') reasons.push('新题，按当前阶段顺序推进');
  if (record.mistakes?.length) reasons.push(`错因：${record.mistakes.slice(0, 2).join('、')}`);
  if (problem.level === '困难' && prefs.hideHard) reasons.push('困难题会延后，当前出现说明它已有复习价值');
  if (!reasons.length) reasons.push('综合进度、薄弱项和阶段顺序推荐');
  return reasons.slice(0, 3);
}

export function makeAttempt({ status, feedback, seconds = 0, note = '', mistakes = [] }) {
  return {
    date: todayKey(),
    at: new Date().toISOString(),
    status,
    feedback,
    seconds,
    noteSnapshot: note,
    mistakes: [...mistakes]
  };
}
