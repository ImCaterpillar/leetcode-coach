import { problems } from '../src/data/problems.js';
import { getStats, pickRecommended } from '../src/lib/review.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ids = new Set(problems.map((p) => p.id));
assert(problems.length === 100, `题库数量应为 100，实际 ${problems.length}`);
assert(ids.size === problems.length, '题号不应重复');
assert(problems.every((p) => p.title && p.slug && p.family && p.stage), '题目数据字段不完整');

const prefs = { hideHard: true, maxToday: 6, maxReview: 4, maxNew: 3 };
const records = {
  1: { status: 'ac', nextReview: '2099-01-01' },
  49: { status: 'solution', nextReview: '2000-01-01', reviewCount: 2 },
  128: { status: 'bug', nextReview: '2000-01-01', mistakes: ['边界条件错'] }
};
const stats = getStats(problems, records, prefs);
assert(stats.touched.length === 3, '已接触统计错误');
assert(stats.ac.length === 1, 'AC 统计错误');
assert(stats.weak.length === 2, '薄弱题统计错误');
assert(stats.todayTasks.length <= prefs.maxToday, '今日队列超过上限');
assert(stats.reviewTasks.length <= prefs.maxReview, '复习队列超过上限');
assert(pickRecommended(problems, records, prefs)?.id, '推荐题不能为空');

console.log('basic-check passed');
