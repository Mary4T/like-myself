/**
 * 項目任務重複邏輯（供 Home 載入時與 ProjectList 共用）
 * - resetProjectTasksIfNeeded: 檢查新週期並重置任務、補記 repeatLog
 */

const getLocalDateKey = (d, unit = 'day') => {
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
 * 依任務的 repeat 設定取得 dateKey（支援 interval、anchor）
 * 每 N 週任務會產生 N 週間隔的 key（如 W-2026-02-23, W-2026-03-09）
 */
export const getLocalDateKeyForRepeat = (task, d) => {
  const rep = task?.details?.repeat;
  const unit = rep?.unit || 'day';
  const interval = Math.max(1, Number(rep?.interval || 1));
  if (unit !== 'week' || interval <= 1) return getLocalDateKey(d, unit);
  const anchor = task.details?.startDate
    ? new Date(task.details.startDate)
    : rep?.anchorAt
      ? new Date(rep.anchorAt)
      : task.created
        ? new Date(task.created)
        : new Date();
  const anchorMonday = getMondayOfWeek(anchor);
  const mondayOfD = getMondayOfWeek(d);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceAnchor = (mondayOfD.getTime() - anchorMonday.getTime()) / msPerWeek;
  const periodIndex = Math.floor(weeksSinceAnchor / interval);
  const periodStartMonday = new Date(anchorMonday.getTime() + periodIndex * interval * msPerWeek);
  return `W-${periodStartMonday.getFullYear()}-${String(periodStartMonday.getMonth() + 1).padStart(2, '0')}-${String(periodStartMonday.getDate()).padStart(2, '0')}`;
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

const getWindowStart = (task) => {
  const rep = task.details?.repeat;
  const unit = rep?.unit || 'day';
  const interval = Math.max(1, Number(rep?.interval || 1));
  const anchor = task.details?.startDate
    ? new Date(task.details.startDate)
    : (rep?.anchorAt ? new Date(rep.anchorAt) : (task.created ? new Date(task.created) : new Date()));
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
  if (unit !== 'minute') {
    anchor.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
  }
  let current = new Date(anchor);
  let guard = 0;
  while (guard < 1000) {
    const next = addCycle(current);
    if (now < next) break;
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
    const anchor = task.details?.startDate
      ? new Date(task.details.startDate)
      : rep.anchorAt
        ? new Date(rep.anchorAt)
        : task.created
          ? new Date(task.created)
          : new Date();
    if (checkTime < anchor) checkTime = new Date(anchor.getTime());
    while (checkTime.getTime() < windowStart.getTime()) {
      const key = getLocalDateKeyForRepeat(task, checkTime);
      if (!nextRepeatLog[key]) {
        const nextCheckTime = addCycle(checkTime);
        const isJustFinished = nextCheckTime.getTime() >= windowStart.getTime();
        const snapshot =
          task.children && task.children.length > 0 ? task.children.map(createTaskSnapshot) : [];
        const isCompleted = isJustFinished ? task.status === 'completed' || task.completed : false;
        const progress = isJustFinished ? task.details?.progress || 0 : 0;
        nextRepeatLog[key] = {
          completed: isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : null,
          maxProgress: progress,
          recordedAt: new Date().toISOString(),
          taskSnapshot: snapshot
        };
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

/** 單一任務重置（供 ProjectList 使用） */
export { resetTaskTreeIfNeeded };
