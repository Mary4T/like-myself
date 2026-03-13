/**
 * 項目任務重複邏輯（供 Home 載入時與 ProjectList 共用）
 * - resetProjectTasksIfNeeded: 檢查新週期並重置任務、補記 repeatLog
 */

export const getLocalDateKey = (d, unit = 'day') => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (unit === 'minute') {
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}-${minute}`;
  }
  if (unit === 'week') {
    const date = new Date(d);
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    return `W-${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }
  if (unit === 'month') return `M-${year}-${month}`;
  if (unit === 'year') return `Y-${year}`;
  return `${year}-${month}-${day}`;
};

/** 取得該日期所在週的週一 */
const getMondayOfWeek = (d) => {
  const date = new Date(d);
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * 依任務的 repeat 設定取得 dateKey（重置基準：開始日期+開始時間）
 * 每筆 key 對應一個週期，格式依 unit：day=YYYY-MM-DD, week=YYYY-MM-DD(週期起日), month=M-YYYY-MM, year=Y-YYYY, minute=YYYY-MM-DD-HH-mm
 */
export const getLocalDateKeyForRepeat = (task, d) => {
  const rep = task?.details?.repeat;
  const unit = rep?.unit || 'day';
  const periodStart = getPeriodStartForDate(task, d);
  if (!periodStart) return getLocalDateKey(d, unit);
  if (unit === 'minute') return getLocalDateKey(periodStart, unit);
  if (unit === 'month') return `M-${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
  if (unit === 'year') return `Y-${periodStart.getFullYear()}`;
  return `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-${String(periodStart.getDate()).padStart(2, '0')}`;
};

/**
 * 判斷重複任務的某次發生是否已完成（供篩選用）
 * @param {Object} task - 任務
 * @param {Date} occurrenceStart - 該次發生的開始時間
 * @returns {boolean} - 該次是否已完成
 */
export const isOccurrenceCompleted = (task, occurrenceStart) => {
  const rep = task?.details?.repeat;
  if (!rep || !(rep.enabled === true || rep.enabled === 'true')) {
    return task?.status === 'completed' || task?.completed === true;
  }
  const log = task.details?.repeatLog || {};
  const dateKey = getLocalDateKeyForRepeat(task, occurrenceStart);
  const entry = log[dateKey];
  return entry && (entry.completed === true || entry.completed === 'true');
};

/**
 * 將 dateKey 轉為 canonical 格式（與 getLocalDateKeyForRepeat 一致）
 * 用於合併重複日誌中相同週期的重複 key（如 W-2026-03-09 與 2026-03-11 可能為同一週期）
 */
export const getCanonicalDateKeyForRepeat = (task, dateKey) => {
  if (!task || !dateKey) return dateKey;
  const rep = task?.details?.repeat;
  const unit = rep?.unit || 'day';
  if (unit !== 'week' || !dateKey.startsWith('W-')) return dateKey;
  const match = dateKey.match(/^W-(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const monday = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  const startStr = task.details?.startDate;
  const targetWeekday = startStr ? new Date(startStr).getDay() : 1;
  const refDate = new Date(monday);
  refDate.setDate(monday.getDate() + (targetWeekday === 0 ? 6 : targetWeekday - 1));
  return getLocalDateKeyForRepeat(task, refDate);
};

/**
 * 將 repeatLog 正規化：合併相同週期的重複 key，回傳 canonical key 格式的 log
 */
export const normalizeRepeatLog = (task, log) => {
  if (!task || !log || typeof log !== 'object') return log;
  const merged = {};
  for (const [key, entry] of Object.entries(log)) {
    const canonical = getCanonicalDateKeyForRepeat(task, key);
    const existing = merged[canonical];
    if (!existing) {
      merged[canonical] = { ...entry };
    } else {
      merged[canonical] = {
        completed: existing.completed || entry.completed,
        completedAt: existing.completedAt || entry.completedAt,
        maxProgress: Math.max(existing.maxProgress || 0, entry.maxProgress || 0),
        recordedAt: (existing.recordedAt && entry.recordedAt && existing.recordedAt > entry.recordedAt) ? existing.recordedAt : (entry.recordedAt || existing.recordedAt),
        taskSnapshot: (existing.taskSnapshot?.length || 0) >= (entry.taskSnapshot?.length || 0) ? existing.taskSnapshot : entry.taskSnapshot
      };
    }
  }
  return merged;
};

/**
 * 將 dateKey 轉為顯示用日期字串（依 startDate 的星期幾）
 * 若任務有 startDate，顯示該週對應星期幾的日期（如每週五→顯示週五日期）
 * 若無 startDate，顯示該週週一日期（去掉 W- 前綴）
 */
export const formatDateKeyForDisplay = (dateKey, task) => {
  if (!dateKey || !dateKey.startsWith('W-')) return dateKey;
  const rep = task?.details?.repeat;
  if (rep?.unit !== 'week') return dateKey.replace(/^W-/, '') || dateKey;
  const startStr = task.details?.startDate;
  if (!startStr) return dateKey.replace(/^W-/, '') || dateKey;
  const startDate = new Date(startStr);
  const targetWeekday = startDate.getDay();
  const match = dateKey.match(/^W-(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const monday = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + (targetWeekday === 0 ? 6 : targetWeekday - 1));
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** 解析 startTime (HH:mm) 並套用到 Date，預設 00:00 */
const applyStartTimeToDate = (date, startTimeStr) => {
  const d = new Date(date.getTime());
  if (!startTimeStr || typeof startTimeStr !== 'string') {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const parts = startTimeStr.trim().split(':');
  const h = Math.max(0, Math.min(23, parseInt(parts[0], 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
  d.setHours(h, m, 0, 0);
  return d;
};

/** 取得錨點（開始日期+開始時間），作為重置基準 */
const getAnchorWithTime = (task) => {
  const rep = task?.details?.repeat;
  let anchor;
  if (task.details?.startDate) {
    anchor = new Date(task.details.startDate);
    anchor = applyStartTimeToDate(anchor, task.details?.startTime);
  } else if (rep?.anchorAt) {
    anchor = new Date(rep.anchorAt);
  } else if (task.created) {
    anchor = new Date(task.created);
    anchor = applyStartTimeToDate(anchor, task.details?.startTime);
  } else {
    anchor = new Date();
    anchor.setHours(0, 0, 0, 0);
  }
  return anchor;
};

const getInheritedDueDate = (allTasksState, task) => {
  const findParent = (list, targetId) => {
    for (const t of list) {
      if (t.children?.some((c) => c.id === targetId)) return t;
      const p = findParent(t.children || [], targetId);
      if (p) return p;
    }
    return null;
  };
  if (task.details?.dueDate) return new Date(task.details.dueDate);
  let current = task;
  while (true) {
    const parent = findParent(allTasksState, current.id);
    if (!parent) break;
    if (parent.details?.dueDate) return new Date(parent.details.dueDate);
    current = parent;
  }
  return null;
};

/** 取得當前週期的開始時間（重置基準：開始日期+開始時間） */
const getWindowStart = (task) => {
  const rep = task.details?.repeat;
  const unit = rep?.unit || 'day';
  const interval = Math.max(1, Number(rep?.interval || 1));
  const anchor = getAnchorWithTime(task);
  const now = new Date();
  if (now < anchor) return null;
  const addCycle = (base) => {
    const next = new Date(base);
    if (unit === 'minute') next.setMinutes(next.getMinutes() + interval);
    else if (unit === 'week') next.setDate(next.getDate() + interval * 7);
    else if (unit === 'month') next.setMonth(next.getMonth() + interval);
    else if (unit === 'year') next.setFullYear(next.getFullYear() + interval);
    else next.setDate(next.getDate() + interval);
    return next;
  };
  let current = new Date(anchor.getTime());
  let guard = 0;
  while (guard < 1000) {
    const next = addCycle(current);
    if (now < next) break;
    current = next;
    guard += 1;
  }
  return current;
};

/** 取得指定日期 d 所屬週期的開始時間（供 getLocalDateKeyForRepeat 使用） */
export const getPeriodStartForDate = (task, d) => {
  const rep = task?.details?.repeat;
  const unit = rep?.unit || 'day';
  const interval = Math.max(1, Number(rep?.interval || 1));
  const anchor = getAnchorWithTime(task);
  const target = new Date(d.getTime());
  if (target < anchor) return null;
  const addCycle = (base) => {
    const next = new Date(base);
    if (unit === 'minute') next.setMinutes(next.getMinutes() + interval);
    else if (unit === 'week') next.setDate(next.getDate() + interval * 7);
    else if (unit === 'month') next.setMonth(next.getMonth() + interval);
    else if (unit === 'year') next.setFullYear(next.getFullYear() + interval);
    else next.setDate(next.getDate() + interval);
    return next;
  };
  let current = new Date(anchor.getTime());
  let guard = 0;
  while (guard < 1000) {
    const next = addCycle(current);
    if (target < next) break;
    current = next;
    guard += 1;
  }
  return current;
};

/** 遞迴檢查並重置重複任務（新週期時重置狀態、補記 repeatLog） */
const resetTaskTreeIfNeeded = (task, allTasksState) => {
  if (!task || !task.id) return task;
  const createTaskSnapshot = (t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    completed: t.status === 'completed' || t.completed === true,
    children: t.children ? t.children.map(createTaskSnapshot) : []
  });
  const rep = task.details?.repeat;
  const updatedChildren = task.children
    ? task.children.map((child) => {
        if (child.details?.repeat?.enabled) return resetTaskTreeIfNeeded(child, allTasksState);
        return child;
      })
    : [];
  if (!rep || !rep.enabled) return { ...task, children: updatedChildren };
  const finalDueDate = getInheritedDueDate(allTasksState, task);
  const now = new Date();
  if (finalDueDate && now > finalDueDate) return { ...task, children: updatedChildren };
  const windowStart = getWindowStart(task);
  if (!windowStart) return { ...task, children: updatedChildren };
  const lastResetAt = rep.lastResetAt ? new Date(rep.lastResetAt) : null;
  if (!lastResetAt) {
    return {
      ...task,
      details: { ...task.details, repeat: { ...rep, lastResetAt: windowStart.toISOString() } },
      children: updatedChildren
    };
  }
  if (windowStart.getTime() > lastResetAt.getTime()) {
    const nextRepeatLog = { ...(task.details?.repeatLog || {}) };
    const unit = rep.unit || 'day';
    const interval = Math.max(1, Number(rep.interval || 1));
    const addCycle = (base) => {
      const next = new Date(base);
      if (unit === 'minute') next.setMinutes(next.getMinutes() + interval);
      else if (unit === 'week') next.setDate(next.getDate() + interval * 7);
      else if (unit === 'month') next.setMonth(next.getMonth() + interval);
      else if (unit === 'year') next.setFullYear(next.getFullYear() + interval);
      else next.setDate(next.getDate() + interval);
      return next;
    };
    let checkTime = new Date(lastResetAt.getTime());
    const anchor = getAnchorWithTime(task);
    if (checkTime < anchor) checkTime = new Date(anchor.getTime());
    let isFirstPeriod = true; // 只有第一個補記週期使用當前任務狀態（用戶最後一次互動的週期）
    while (checkTime.getTime() < windowStart.getTime()) {
      const key = getLocalDateKeyForRepeat(task, checkTime);
      if (!nextRepeatLog[key]) {
        const snapshot =
          task.children && task.children.length > 0 ? task.children.map(createTaskSnapshot) : [];
        const useCurrentStatus = isFirstPeriod;
        const isCompleted = useCurrentStatus ? (task.status === 'completed' || task.completed) : false;
        const progress = isCompleted ? 100 : (useCurrentStatus ? (task.details?.progress || 0) : 0);
        nextRepeatLog[key] = {
          completed: isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : null,
          maxProgress: progress,
          recordedAt: new Date().toISOString(),
          taskSnapshot: snapshot
        };
        isFirstPeriod = false;
      }
      checkTime = addCycle(checkTime);
    }
    const resetTaskStatusRecursive = (t) => ({
      ...t,
      status: 'pending',
      completed: false,
      details: { ...t.details, progress: 0 },
      children: t.children
        ? t.children.map((c) => {
            if (c.details?.repeat?.enabled) return c;
            return resetTaskStatusRecursive(c);
          })
        : []
    });
    const resetedTask = resetTaskStatusRecursive(task);
    return {
      ...resetedTask,
      details: {
        ...resetedTask.details,
        repeat: { ...rep, lastResetAt: windowStart.toISOString() },
        repeatLog: nextRepeatLog
      },
      children: updatedChildren.map((c) => {
        if (c.details?.repeat?.enabled) return c;
        return resetTaskStatusRecursive(c);
      })
    };
  }
  return { ...task, children: updatedChildren };
};

/** 對完整項目任務陣列執行重置（供 Home 載入時呼叫） */
export const resetProjectTasksIfNeeded = (projectTasks) => {
  if (!Array.isArray(projectTasks) || projectTasks.length === 0) return projectTasks;
  return projectTasks.map((t) => resetTaskTreeIfNeeded(t, projectTasks));
};

/** 取得從開始到截止日為止的 period dateKeys（與 getLocalDateKeyForRepeat 格式一致） */
export const getPeriodKeysFromStartToDueForTask = (task) => {
  const rep = task?.details?.repeat;
  const unit = rep?.unit || 'day';
  const interval = Math.max(1, Number(rep?.interval || 1));
  const anchor = getAnchorWithTime(task);
  const dueStr = task.details?.dueDate;
  if (!dueStr) return [];
  const due = new Date(dueStr);
  due.setHours(23, 59, 59, 999);
  if (anchor > due) return [];
  const addCycle = (base) => {
    const next = new Date(base);
    if (unit === 'minute') next.setMinutes(next.getMinutes() + interval);
    else if (unit === 'week') next.setDate(next.getDate() + interval * 7);
    else if (unit === 'month') next.setMonth(next.getMonth() + interval);
    else if (unit === 'year') next.setFullYear(next.getFullYear() + interval);
    else next.setDate(next.getDate() + interval);
    return next;
  };
  const keys = [];
  let current = new Date(anchor.getTime());
  let guard = 0;
  while (current <= due && guard < 1000) {
    keys.push(getLocalDateKeyForRepeat(task, current));
    current = addCycle(current);
    guard += 1;
  }
  return keys;
};

/** 單一任務重置（供 ProjectList 使用） */
export { resetTaskTreeIfNeeded };
