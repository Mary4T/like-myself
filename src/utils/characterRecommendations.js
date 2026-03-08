/**
 * 任務推薦邏輯
 *
 * 【推薦數量】
 * - 心情推薦：至少 5 個（若符合心情條件的不足 5 個，用鄰近截止日任務補足）
 * - 鄰近截止日：2 個（排在心情推薦之後，去重）
 * - 合計：5～7 個
 *
 * 【推薦順序】
 * 1. 心情推薦的任務（5 個，不足時以鄰近截止日補足）
 * 2. 其後為鄰近截止日任務（2 個）
 *
 * 【心情選項與對應邏輯】
 * - 活力滿滿：複雜任務（子任務多或標題長）、便條紙任務
 * - 穩穩當當：總子任務數（含旗下）少於 5 的任務，結構簡單易掌控
 * - 電量偏低：完成度最高（易收尾）的項目任務 + 便條紙
 * - 腦袋很亂：簡單任務、關鍵字匹配、每日重複任務
 * - 不想思考：隨機 + 一日內截止的任務
 */

import * as TaskUtils from '../components/ProjectTasks/taskUtils';
import { getLeafProjectTasksForPeriod } from './userOverviewUtils';
import {
  getSimpleTasks,
  ensureSimpleTasksForChaotic,
  setTodayRecommendedIds,
  getTodayRecommendedIds,
  getTodayMood,
  getSimpleTaskTemplates
} from './characterMoodUtils';

/** 依 taskTags.includeInViews 過濾：排除 tag 為 includeInViews=false 的任務 */
const filterProjectTreeByIncludeInViews = (tree, taskTags) => {
  const excluded = new Set((taskTags || []).filter((t) => t.includeInViews === false).map((t) => t.id));
  if (excluded.size === 0) return tree;
  const filterTree = (list, parentResolvedTagId = null) => {
    if (!list || list.length === 0) return [];
    return list
      .map((task) => {
        const resolved = !task.tagId || task.tagId === '__inherit__' ? parentResolvedTagId : (task.tagId === '__none__' ? null : task.tagId);
        if (resolved && excluded.has(resolved)) return null;
        return {
          ...task,
          children: filterTree(task.children || [], resolved)
        };
      })
      .filter(Boolean);
  };
  return filterTree(tree);
};

export const getDueDate = (task) => {
  const d = task.details?.dueDate || task.details?.date || task.details?.startDate;
  if (!d) return null;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getDaysUntilDue = (task) => {
  const due = getDueDate(task);
  if (!due) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
};

const loadNoteTasks = () => {
  try {
    const t = localStorage.getItem('tasks');
    const c = localStorage.getItem('completedTasks');
    const tasks = t ? JSON.parse(t) : [];
    const completed = c ? JSON.parse(c) : [];
    return [...tasks, ...completed].map((x) => ({
      ...x,
      _recId: `note:${x.id}`,
      _source: 'note',
      _rawId: x.id
    }));
  } catch {
    return [];
  }
};

const loadTaskTags = () => {
  try {
    const saved = localStorage.getItem('taskTags');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** 載入今日推薦用的項目任務：過濾 includeInViews，且重複任務僅在執行日/時長壓到今日時納入 */
const loadProjectTasksForToday = () => {
  try {
    const saved = localStorage.getItem('projectTasks');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    const root = Array.isArray(parsed) && parsed[0] ? parsed[0] : null;
    if (!root?.children) return [];
    const taskTags = loadTaskTags();
    const filtered = filterProjectTreeByIncludeInViews(root.children, taskTags);
    return getLeafProjectTasksForPeriod(filtered, 'day').map((t) => ({
      ...t,
      _recId: `project:${t.id}`,
      _source: 'project',
      _rawId: t.id
    }));
  } catch {
    return [];
  }
};

const getTaskTitle = (t) => t.title || t.text || '';

const isTaskCompleted = (t) => {
  if (t._source === 'note') return !!t.completed;
  if (t._source === 'project') return t._todayCompletedFromRepeat === true || t.status === 'completed';
  return !!t.completed;
};

/** 已逾期的任務排到最下面 */
const sortOverdueToBottom = (list) => {
  const notOverdue = list.filter((t) => {
    const days = getDaysUntilDue(t);
    return days == null || days >= 0;
  });
  const overdue = list.filter((t) => {
    const days = getDaysUntilDue(t);
    return days != null && days < 0;
  });
  return [...notOverdue, ...overdue];
};

/** 鄰近截止日：未完成且有截止日的任務，依最近截止日排序 */
const getNearDeadlineTasks = (noteTasks, projectTasks, limit = 5) => {
  const withDue = [...noteTasks, ...projectTasks]
    .filter((t) => getDueDate(t) != null && !isTaskCompleted(t))
    .sort((a, b) => {
      const da = getDaysUntilDue(a);
      const db = getDaysUntilDue(b);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  return withDue.slice(0, limit);
};

const keywordMatch = (task, keywords) => {
  const t = getTaskTitle(task).toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
};

const SIMPLE_KEYWORDS = ['起床', '刷牙', '早餐', '吃早餐', '喝水', '整理', '洗臉'];

/** 活力滿滿：很少執行或看起來麻煩的任務 */
const recommendEnergetic = (noteTasks, projectTasks) => {
  const project = projectTasks
    .filter((t) => {
      const childCount = (t.children || []).length;
      const isComplex = childCount >= 2 || getTaskTitle(t).length > 15;
      return isComplex && !isTaskCompleted(t);
    })
    .sort((a, b) => {
      const aChild = (a.children || []).length;
      const bChild = (b.children || []).length;
      return bChild - aChild;
    })
    .slice(0, 5);
  const note = noteTasks.filter((t) => !t.completed).slice(0, 5 - project.length);
  return [...project, ...note].slice(0, 5);
};

/** 總子任務數（含旗下所有層級） */
const countAllSubtasks = (task) => {
  const children = task.children || [];
  return children.length + children.reduce((sum, c) => sum + countAllSubtasks(c), 0);
};

/** 穩穩當當：總子任務數少於 5 的任務（結構簡單、易掌控） */
const recommendSteady = (noteTasks, projectTasks) => {
  const project = projectTasks
    .filter((t) => !isTaskCompleted(t) && countAllSubtasks(t) < 5)
    .sort((a, b) => countAllSubtasks(a) - countAllSubtasks(b))
    .slice(0, 5);
  const note = noteTasks.filter((t) => !t.completed).slice(0, 5 - project.length);
  return [...project, ...note].slice(0, 5);
};

/** 電量偏低：完成度最高的任務（容易收尾） */
const recommendLow = (noteTasks, projectTasks) => {
  const project = projectTasks
    .map((t) => ({ ...t, progress: TaskUtils.calculateTaskProgress(t) }))
    .filter((t) => t.progress > 0 && t.progress < 100 && !isTaskCompleted(t))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);
  const note = noteTasks.filter((t) => !t.completed).slice(0, 5 - project.length);
  return [...project, ...note].slice(0, 5);
};

/** 腦袋很亂：簡單任務、關鍵字匹配、每日重複任務 */
const recommendChaotic = (noteTasks, projectTasks) => {
  const templates = getSimpleTaskTemplates();
  const similarNote = noteTasks.filter((t) => !t.completed && keywordMatch(t, SIMPLE_KEYWORDS));
  const similarProject = projectTasks.filter((t) => t.status !== 'completed' && keywordMatch(t, SIMPLE_KEYWORDS));
  const repeatTasks = projectTasks.filter((t) => {
    const rep = t.details?.repeat;
    return rep && (rep.enabled === true || rep.enabled === 'true');
  }).filter((t) => t.status !== 'completed');
  const similar = [...similarNote, ...similarProject].slice(0, 3);
  ensureSimpleTasksForChaotic();
  const simple = getSimpleTasks()
    .filter((t) => !t.completed)
    .map((t) => ({ ...t, _recId: `simple:${t.id}`, _source: 'simple', _rawId: t.id }))
    .filter((t) => templates.some((tmpl) => getTaskTitle(t).includes(tmpl.title || tmpl)));
  const combined = [...similar];
  for (const s of simple) {
    if (combined.length >= 5) break;
    if (!combined.some((c) => c._recId === s._recId)) combined.push(s);
  }
  for (const r of repeatTasks) {
    if (combined.length >= 5) break;
    const recId = `project:${r.id}`;
    if (!combined.some((c) => (c._recId || c.id) === recId)) {
      combined.push({ ...r, _recId: recId, _source: 'project', _rawId: r.id });
    }
  }
  return combined.slice(0, 5);
};

/** 不想思考：隨機 + 一日內截止的任務，目標 5 個 */
const recommendRandom = (noteTasks, projectTasks) => {
  const all = [...noteTasks, ...projectTasks].filter((t) => !isTaskCompleted(t));
  const dueSoon = all
    .filter((t) => {
      const days = getDaysUntilDue(t);
      return days != null && days >= 0 && days <= 1;
    })
    .sort((a, b) => (getDaysUntilDue(a) ?? Infinity) - (getDaysUntilDue(b) ?? Infinity));
  const shuffled = all.filter((t) => !dueSoon.some((d) => (d._recId || d.id) === (t._recId || t.id)));
  shuffled.sort(() => Math.random() - 0.5);
  const combined = [...dueSoon, ...shuffled];
  return combined.slice(0, 5);
};

const TARGET_MOOD_COUNT = 5;
const NEAR_DEADLINE_EXTRA = 2;

/** 若心情推薦不足 5 個，用鄰近截止日任務補足 */
const fillMoodWithNearDeadline = (moodBased, nearDeadline, target = TARGET_MOOD_COUNT) => {
  if (moodBased.length >= target) return moodBased;
  const moodIds = new Set(moodBased.map((t) => t._recId || t.id));
  const toAdd = nearDeadline.filter((t) => !moodIds.has(t._recId || t.id));
  const result = [...moodBased];
  for (const t of toAdd) {
    if (result.length >= target) break;
    result.push(t);
  }
  return result;
};

/** 心情推薦（5 個）＋鄰近截止日（2 個） */
const mergeNearDeadlineWithMood = (nearDeadline, moodBased, limitNear = NEAR_DEADLINE_EXTRA) => {
  const moodIds = new Set(moodBased.map((t) => t._recId || t.id));
  const nearFiltered = nearDeadline
    .filter((t) => !moodIds.has(t._recId || t.id))
    .slice(0, limitNear);
  return [...moodBased, ...nearFiltered];
};

export const computeRecommendations = (moodId) => {
  const noteTasks = loadNoteTasks();
  const projectTasks = loadProjectTasksForToday();
  const nearDeadline = getNearDeadlineTasks(noteTasks, projectTasks, 10);

  let moodBased = [];
  switch (moodId) {
    case 'energetic':
      moodBased = recommendEnergetic(noteTasks, projectTasks);
      break;
    case 'steady':
      moodBased = recommendSteady(noteTasks, projectTasks);
      break;
    case 'low':
      moodBased = recommendLow(noteTasks, projectTasks);
      break;
    case 'chaotic':
      moodBased = recommendChaotic(noteTasks, projectTasks);
      break;
    case 'random':
      moodBased = recommendRandom(noteTasks, projectTasks);
      break;
    default:
      moodBased = recommendRandom(noteTasks, projectTasks);
  }

  moodBased = fillMoodWithNearDeadline(moodBased, nearDeadline);
  const recommended = sortOverdueToBottom(mergeNearDeadlineWithMood(nearDeadline, moodBased));
  const ids = recommended.map((t) => t._recId || t.id);
  setTodayRecommendedIds(ids);
  return recommended;
};

export const getRecommendedTasksForDisplay = () => {
  const noteTasks = loadNoteTasks();
  const projectTasks = loadProjectTasksForToday();
  const simpleTasks = getSimpleTasks().map((t) => ({
    ...t,
    _recId: `simple:${t.id}`,
    _source: 'simple',
    _rawId: t.id,
    title: t.title
  }));
  const all = [...noteTasks, ...projectTasks, ...simpleTasks];

  const ids = getTodayRecommendedIds();
  if (ids.length === 0) {
    return computeRecommendations(getTodayMood() || 'random');
  }

  const recommended = sortOverdueToBottom(
    ids
      .map((id) => all.find((t) => (t._recId || `note:${t.id}`) === id))
      .filter(Boolean)
  );
  return recommended;
};
