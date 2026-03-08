/**
 * 總覽頁面：使用者資料、經驗值、等級計算
 * - 便條紙完成 +1
 * - 項目重複任務 repeatLog 每筆 +1
 * - 項目非重複任務完成 +5（不扣回）
 * - LV1:20, LV2:30, LV3:40... LV9:100, LV10+ 每級 100
 */

const USER_OVERVIEW_USER_ID_KEY = 'userOverviewUserId.v1';
const USER_OVERVIEW_AVATAR_KEY = 'userOverviewAvatar.v1';
const USER_OVERVIEW_XP_NOTE_KEY = 'userOverviewXpNote.v1';
const USER_OVERVIEW_PROJECT_NON_REPEAT_IDS_KEY = 'userOverviewXpProjectNonRepeatIds.v1';
const USER_OVERVIEW_RECOMMENDED_BONUS_KEY = 'userOverviewXpRecommendedBonus.v1';

// LV1:20, LV2:30, LV3:40, LV4:50, LV5:60, LV6:70, LV7:80, LV8:90, LV9:100, LV10+:100
const LEVEL_REQUIREMENTS = [20, 30, 40, 50, 60, 70, 80, 90, 100];
const LEVEL_10_PLUS_REQUIREMENT = 100;

export const getDefaultUserId = () => {
  try {
    const s = localStorage.getItem(USER_OVERVIEW_USER_ID_KEY);
    return s || '系頭發光體';
  } catch {
    return '系頭發光體';
  }
};

export const setUserId = (id) => {
  try {
    localStorage.setItem(USER_OVERVIEW_USER_ID_KEY, String(id || '').trim() || '系頭發光體');
  } catch (e) {
    console.error('Failed to save user ID:', e);
  }
};

export const getAvatar = () => {
  try {
    const s = localStorage.getItem(USER_OVERVIEW_AVATAR_KEY);
    return s || null;
  } catch {
    return null;
  }
};

export const setAvatar = (dataUrl) => {
  try {
    if (!dataUrl) {
      localStorage.removeItem(USER_OVERVIEW_AVATAR_KEY);
      return;
    }
    localStorage.setItem(USER_OVERVIEW_AVATAR_KEY, dataUrl);
  } catch (e) {
    console.error('Failed to save avatar:', e);
  }
};

export const getXpNoteCount = () => {
  try {
    const s = localStorage.getItem(USER_OVERVIEW_XP_NOTE_KEY);
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
};

export const addXpNote = () => {
  try {
    const next = getXpNoteCount() + 1;
    localStorage.setItem(USER_OVERVIEW_XP_NOTE_KEY, String(next));
    return next;
  } catch (e) {
    console.error('Failed to add note XP:', e);
    return getXpNoteCount();
  }
};

const getProjectNonRepeatIds = () => {
  try {
    const s = localStorage.getItem(USER_OVERVIEW_PROJECT_NON_REPEAT_IDS_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const setProjectNonRepeatIds = (ids) => {
  try {
    localStorage.setItem(USER_OVERVIEW_PROJECT_NON_REPEAT_IDS_KEY, JSON.stringify([...new Set(ids)]));
  } catch (e) {
    console.error('Failed to save project non-repeat IDs:', e);
  }
};

/** 從項目任務樹計算 repeatLog 總完成次數 */
const countRepeatLogCompletions = (tasks) => {
  if (!Array.isArray(tasks)) return 0;
  let sum = 0;
  for (const task of tasks) {
    const rep = task.details?.repeat;
    const enabled = rep && (rep.enabled === true || rep.enabled === 'true');
    if (enabled) {
      const log = task.details?.repeatLog || {};
      sum += Object.values(log).filter((e) => e && (e.completed === true || e.completed === 'true')).length;
    }
    if (task.children?.length) {
      sum += countRepeatLogCompletions(task.children);
    }
  }
  return sum;
};

/** 從項目任務樹找出已完成的非重複任務 ID */
const getCompletedNonRepeatTaskIds = (tasks) => {
  if (!Array.isArray(tasks)) return [];
  const ids = [];
  for (const task of tasks) {
    const rep = task.details?.repeat;
    const enabled = rep && (rep.enabled === true || rep.enabled === 'true');
    const isCompleted = task.status === 'completed' || task.completed === true;
    if (!enabled && isCompleted) {
      ids.push(String(task.id));
    }
    if (task.children?.length) {
      ids.push(...getCompletedNonRepeatTaskIds(task.children));
    }
  }
  return ids;
};

/** 同步非重複完成 ID 並回傳總 XP */
export const syncProjectXpAndGetTotal = (projectTaskTree) => {
  const completedIds = getCompletedNonRepeatTaskIds(projectTaskTree || []);
  const storedIds = getProjectNonRepeatIds();
  const newIds = completedIds.filter((id) => !storedIds.includes(id));
  const allIds = newIds.length > 0 ? [...storedIds, ...newIds] : storedIds;
  if (newIds.length > 0) {
    setProjectNonRepeatIds(allIds);
  }
  const repeatXp = countRepeatLogCompletions(projectTaskTree || []);
  const nonRepeatXp = allIds.length * 5;
  return { repeatXp, nonRepeatXp, totalProjectXp: repeatXp + nonRepeatXp };
};

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getRecommendedBonusXp = () => {
  try {
    const s = localStorage.getItem(USER_OVERVIEW_RECOMMENDED_BONUS_KEY);
    const parsed = s ? JSON.parse(s) : null;
    const today = getTodayKey();
    if (!parsed || parsed.date !== today) return 0;
    const n = parseInt(parsed.bonus, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
};

export const XP_INVALIDATE_EVENT = 'userOverviewXpInvalidate';

export const addRecommendedBonusXp = (amount) => {
  try {
    const today = getTodayKey();
    const current = getRecommendedBonusXp();
    const next = current + (amount || 0);
    localStorage.setItem(USER_OVERVIEW_RECOMMENDED_BONUS_KEY, JSON.stringify({ date: today, bonus: next }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(XP_INVALIDATE_EVENT));
    }
    return next;
  } catch (e) {
    console.error('Failed to add recommended bonus XP:', e);
    return getRecommendedBonusXp();
  }
};

/** 計算總 XP */
export const getTotalXp = (projectTaskTree) => {
  const noteXp = getXpNoteCount();
  const { totalProjectXp } = syncProjectXpAndGetTotal(projectTaskTree);
  const bonus = getRecommendedBonusXp();
  return noteXp + totalProjectXp + bonus;
};

/** 根據總 XP 計算等級與進度
 * LV1: 0-19, LV2: 20-49, LV3: 50-89, ... LV9: 440-539, LV10: 540-639, LV11: 640-739...
 */
export const getLevelAndProgress = (totalXp) => {
  const xp = Math.max(0, Math.floor(totalXp));
  const thresholds = [0, 20, 50, 90, 140, 200, 270, 350, 440, 540]; // 累積門檻
  let level = 1;
  let xpInLevel = xp;
  let xpNeededForLevel = 20;

  for (let i = 0; i < thresholds.length - 1; i++) {
    const next = thresholds[i + 1];
    if (xp < next) {
      level = i + 1;
      xpInLevel = xp - thresholds[i];
      xpNeededForLevel = next - thresholds[i];
      break;
    }
    level = i + 2;
  }

  if (level >= 10) {
    const base = 540;
    const xpAboveBase = xp - base;
    xpInLevel = xpAboveBase % LEVEL_10_PLUS_REQUIREMENT;
    xpNeededForLevel = LEVEL_10_PLUS_REQUIREMENT;
    level = 10 + Math.floor(xpAboveBase / LEVEL_10_PLUS_REQUIREMENT);
  }

  const progressPercent = Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));
  return { level, xpInLevel, xpNeededForLevel, progressPercent };
};

/** 計算總體任務完成加權平均 (0-100)
 * 便條紙：每個 0 或 100
 * 項目：用 calculateTaskProgress 遞迴平均
 */
export const getWeightedCompletionPercent = (tasks, completedTasks, projectTaskTree, calculateTaskProgress) => {
  const noteTasks = [...(tasks || []), ...(completedTasks || [])];
  const noteCount = noteTasks.length;
  const noteSum = (completedTasks || []).length * 100;

  let projectSum = 0;
  let projectCount = 0;
  const totalOptions = { useRepeatLog: true };
  if (Array.isArray(projectTaskTree) && projectTaskTree.length > 0 && calculateTaskProgress) {
    for (const t of projectTaskTree) {
      projectSum += calculateTaskProgress(t, totalOptions);
      projectCount += 1;
    }
  }

  const totalCount = noteCount + projectCount;
  if (totalCount === 0) return 0;
  return Math.round((noteSum + projectSum) / totalCount);
};

/** 取得便條紙的日期（details.date 或 details.dueDate），無則 null */
const getNoteTaskDate = (task) => {
  const d = task.details?.date || task.details?.dueDate;
  if (!d) return null;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** 取得項目任務的 start～due 範圍，無日期則 null */
const getProjectTaskRange = (task) => {
  const startStr = task.details?.startDate || task.details?.dueDate;
  const endStr = task.details?.dueDate || task.details?.startDate;
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
};

/** 項目任務或其子任務是否與期間重疊（遞迴）
 * - 有 startDate/dueDate：依日期範圍判斷
 * - 無日期但啟用每日重複：視為與本日重疊（每日日常型任務）
 */
const projectTaskOverlapsPeriod = (task, periodStart, periodEnd) => {
  const range = getProjectTaskRange(task);
  if (range) {
    if (range.start <= periodEnd && range.end >= periodStart) return true;
  }
  // 無日期範圍但啟用每日重複：每日任務應計入本日/本週/本月進度
  const rep = task.details?.repeat;
  const repeatEnabled = rep && (rep.enabled === true || rep.enabled === 'true');
  const unit = rep?.unit || 'day';
  if (repeatEnabled && (unit === 'day' || unit === 'week' || unit === 'month')) {
    return true;
  }
  if (Array.isArray(task.children)) {
    return task.children.some((c) => projectTaskOverlapsPeriod(c, periodStart, periodEnd));
  }
  return false;
};

/** 取得本日、本週、本月的期間邊界（週一～週日） */
const getPeriodBounds = (period) => {
  const now = new Date();
  if (period === 'day') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'week') {
    const d = now.getDay();
    const mondayOffset = d === 0 ? -6 : 1 - d;
    const start = new Date(now);
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
};

/** 計算指定期間的任務完成加權平均 (0-100)
 * 方案 B：依 startDate～dueDate 與期間重疊篩選，無日期排除
 * 某期間沒有任務時回傳 100%
 */
export const getWeightedCompletionPercentForPeriod = (
  tasks,
  completedTasks,
  projectTaskTree,
  calculateTaskProgress,
  period
) => {
  const bounds = getPeriodBounds(period);
  if (!bounds) return 0;

  const { start: periodStart, end: periodEnd } = bounds;

  const allNotes = [...(tasks || []), ...(completedTasks || [])];
  const noteTasksInPeriod = allNotes.filter((t) => {
    const d = getNoteTaskDate(t);
    if (!d) return false;
    d.setHours(12, 0, 0, 0);
    const pStart = new Date(periodStart);
    pStart.setHours(0, 0, 0, 0);
    const pEnd = new Date(periodEnd);
    pEnd.setHours(23, 59, 59, 999);
    return d >= pStart && d <= pEnd;
  });
  const completedInPeriod = noteTasksInPeriod.filter((t) => t.completed);
  const noteSum = completedInPeriod.length * 100;
  const noteCount = noteTasksInPeriod.length;

  let projectSum = 0;
  let projectCount = 0;
  const periodOptions = { periodStart, periodEnd };
  if (Array.isArray(projectTaskTree) && projectTaskTree.length > 0 && calculateTaskProgress) {
    for (const t of projectTaskTree) {
      if (!projectTaskOverlapsPeriod(t, periodStart, periodEnd)) continue;
      projectSum += calculateTaskProgress(t, periodOptions);
      projectCount += 1;
    }
  }

  const totalCount = noteCount + projectCount;
  if (totalCount === 0) return 100;
  return Math.round((noteSum + projectSum) / totalCount);
};

const getLocalDateKey = (d, unit = 'day') => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (unit === 'week') {
    const date = new Date(d);
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    return `W-${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }
  if (unit === 'month') return `M-${year}-${month}`;
  return `${year}-${month}-${day}`;
};


const findInSnapshot = (snapshot, id) => {
  if (!snapshot || !Array.isArray(snapshot)) return null;
  for (const node of snapshot) {
    if (String(node.id) === String(id)) return node;
    const found = findInSnapshot(node.children, id);
    if (found) return found;
  }
  return null;
};

/** 取得重複任務的錨點日期（用於判斷每週/每月重複的具體日） */
const getRepeatAnchor = (task) => {
  const rep = task?.details?.repeat;
  const d = task?.details?.startDate || rep?.anchorAt || task?.created;
  if (!d) return null;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** 遞迴收集項目任務樹中的葉子任務，標記是否為重複父任務的子孫，並附上今日完成狀態 */
const collectLeafProjectTasks = (
  tasks,
  result = [],
  ancestorHasRepeat = false,
  ancestorRepeatLog = null,
  ancestorUnit = 'day',
  ancestorRepeatWeekday = null,
  ancestorRepeatDayOfMonth = null
) => {
  if (!Array.isArray(tasks)) return result;
  for (const t of tasks) {
    const rep = t.details?.repeat;
    const repeatEnabled = rep && (rep.enabled === true || rep.enabled === 'true');
    const unit = rep?.unit || 'day';
    const hasRepeat = repeatEnabled && (unit === 'day' || unit === 'week' || unit === 'month');
    const nextAncestor = ancestorHasRepeat || hasRepeat;
    const nextLog = hasRepeat ? (t.details?.repeatLog || {}) : ancestorRepeatLog;
    const nextUnit = hasRepeat ? unit : ancestorUnit;
    const anchor = hasRepeat ? getRepeatAnchor(t) : null;
    const nextWeekday = hasRepeat && unit === 'week' && anchor ? anchor.getDay() : ancestorRepeatWeekday;
    const nextDayOfMonth = hasRepeat && unit === 'month' && anchor ? anchor.getDate() : ancestorRepeatDayOfMonth;

    const children = t.children || [];
    if (children.length === 0) {
      let _todayCompletedFromRepeat = undefined;
      if (nextAncestor && nextLog) {
        const now = new Date();
        const todayKey = getLocalDateKey(now, nextUnit);
        const entry = nextLog[todayKey];
        const snap = entry?.taskSnapshot ? findInSnapshot(entry.taskSnapshot, t.id) : null;
        if (snap) _todayCompletedFromRepeat = snap.completed === true || snap.completed === 'true';
      }
      result.push({
        ...t,
        _source: 'project',
        _rawId: t.id,
        _fromRepeatParent: nextAncestor,
        _ancestorRepeatUnit: nextUnit,
        _ancestorRepeatWeekday: nextWeekday,
        _ancestorRepeatDayOfMonth: nextDayOfMonth,
        _todayCompletedFromRepeat
      });
    } else {
      collectLeafProjectTasks(children, result, nextAncestor, nextLog, nextUnit, nextWeekday, nextDayOfMonth);
    }
  }
  return result;
};

/** 葉子項目任務是否與期間重疊（含：無日期但來自重複父任務）
 * - 本日：每日重複=每天；每週重複=僅錨點星期幾匹配今天；每月重複=僅錨點日期匹配今天
 * - 有日期範圍：依 startDate～dueDate 判斷；已逾期（dueDate < 今日）也納入本日
 * - 本週/本月：含每日/每週/每月重複
 */
const leafProjectTaskOverlapsPeriod = (task, periodStart, periodEnd, period) => {
  const range = getProjectTaskRange(task);
  if (range) {
    if (range.start <= periodEnd && range.end >= periodStart) return true;
    if (period === 'day' && range.end < periodStart) return true;
    return false;
  }
  if (task._fromRepeatParent && period === 'day') {
    const unit = task._ancestorRepeatUnit || 'day';
    if (unit === 'day') {
      // 每日重複：每天都計入
    } else if (unit === 'week') {
      const targetWeekday = task._ancestorRepeatWeekday;
      if (targetWeekday == null) return false;
      const todayWeekday = periodStart.getDay();
      if (todayWeekday !== targetWeekday) return false;
    } else if (unit === 'month') {
      const targetDay = task._ancestorRepeatDayOfMonth;
      if (targetDay == null) return false;
      if (periodStart.getDate() !== targetDay) return false;
    } else {
      return false;
    }
  }
  if (task._fromRepeatParent) {
    const unit = task._ancestorRepeatUnit || 'day';
    if (period === 'day') {
      if (unit === 'day') return true;
      if (unit === 'week') return task._ancestorRepeatWeekday != null && periodStart.getDay() === task._ancestorRepeatWeekday;
      if (unit === 'month') return task._ancestorRepeatDayOfMonth != null && periodStart.getDate() === task._ancestorRepeatDayOfMonth;
      return false;
    }
    if (period === 'week') return unit === 'day' || unit === 'week';
    if (period === 'month') return unit === 'day' || unit === 'week' || unit === 'month';
  }
  return false;
};


/** 取得指定期間的項目葉子任務（用於今日推薦等）
 * period: 'total' | 'month' | 'week' | 'day'
 * 回傳 [{ ...task, _source, _rawId }]，重複任務僅在執行日/時長壓到今日時納入
 */
export const getLeafProjectTasksForPeriod = (projectTaskTree, period) => {
  const leafProjects = collectLeafProjectTasks(projectTaskTree || []);
  if (period === 'total') return leafProjects;
  const bounds = getPeriodBounds(period);
  if (!bounds) return [];
  const { start: periodStart, end: periodEnd } = bounds;
  return leafProjects.filter((t) =>
    leafProjectTaskOverlapsPeriod(t, periodStart, periodEnd, period)
  );
};

/** 取得指定期間的葉子任務列表（最小任務單位）
 * period: 'total' | 'month' | 'week' | 'day'
 * 回傳 [{ ...task, _source, _rawId }]
 */
export const getLeafTasksForPeriod = (tasks, completedTasks, projectTaskTree, period) => {
  const allNotes = [...(tasks || []), ...(completedTasks || [])];
  const leafProjects = collectLeafProjectTasks(projectTaskTree || []);

  if (period === 'total') {
    const noteItems = allNotes.map((t) => ({ ...t, _source: 'note', _rawId: t.id }));
    return [...noteItems, ...leafProjects];
  }

  const bounds = getPeriodBounds(period);
  if (!bounds) return [];

  const { start: periodStart, end: periodEnd } = bounds;

  const noteTasksInPeriod = allNotes.filter((t) => {
    const d = getNoteTaskDate(t);
    if (!d) return false;
    const dNorm = new Date(d);
    dNorm.setHours(12, 0, 0, 0);
    const pStart = new Date(periodStart);
    pStart.setHours(0, 0, 0, 0);
    const pEnd = new Date(periodEnd);
    pEnd.setHours(23, 59, 59, 999);
    return dNorm >= pStart && dNorm <= pEnd;
  });

  const projectTasksInPeriod = leafProjects.filter((t) =>
    leafProjectTaskOverlapsPeriod(t, periodStart, periodEnd, period)
  );

  return [...noteTasksInPeriod.map((t) => ({ ...t, _source: 'note', _rawId: t.id })), ...projectTasksInPeriod];
};

/** 判斷任務是否已完成（與進度彈窗顯示一致） */
const isTaskCompleted = (t) => {
  if (t._source === 'note') return !!t.completed;
  if (t._todayCompletedFromRepeat !== undefined) return t._todayCompletedFromRepeat;
  return t.status === 'completed' || t.completed === true;
};

/** 取得指定期間的完成數與總數（與進度彈窗任務列表一致）
 * 進度 = 已完成任務數 / 所有任務數
 */
export const getCompletionCountForPeriod = (tasks, completedTasks, projectTaskTree, period) => {
  const list = getLeafTasksForPeriod(tasks, completedTasks, projectTaskTree, period);
  const total = list.length;
  const completed = list.filter(isTaskCompleted).length;
  return { completed, total };
};

/** 取得指定期間的完成百分比 (0-100)，基於 已完成/總數
 * 無任務時：總進度 0%，期間進度 100%
 */
export const getCompletionPercentForPeriod = (tasks, completedTasks, projectTaskTree, period) => {
  const { completed, total } = getCompletionCountForPeriod(tasks, completedTasks, projectTaskTree, period);
  if (total === 0) return period === 'total' ? 0 : 100;
  return Math.round((completed / total) * 100);
};
