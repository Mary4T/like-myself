/**
 * Project Task 樹狀結構工具函數
 * 專門處理純邏輯運算，不涉及 React 狀態或 UI
 */

import { getLocalDateKeyForRepeat } from '../../utils/projectTaskRepeatUtils';

// 等級定義映射
export const generateLevelMap = () => {
  const map = { 'NONE': { next: 'A', prev: 'NONE' } };
  const levels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
 
  levels.forEach((level, index) => {
    const prevLevel = index > 0 ? levels[index - 1] : 'NONE';
    const nextLevel = index < levels.length - 1 ? levels[index + 1] : 'NONE';
    map[level] = { next: nextLevel, prev: prevLevel };
  });
 
  return map;
};

export const LEVEL_MAP = generateLevelMap();

/** 取得日期 key（與 ProjectList getLocalDateKey 格式一致） */
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

/** 從 repeatLog 取得指定 dateKey 的進度 */
const getRepeatProgressForDateKey = (task, dateKey) => {
  const log = task.details?.repeatLog || {};
  const entry = log[dateKey];
  if (!entry) return null;
  if (entry.completed === true || entry.completed === 'true') return 100;
  const p = Number(entry.maxProgress);
  return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0;
};

/** 取得期間內所有 dateKey（依 repeat unit） */
const getDateKeysInPeriod = (periodStart, periodEnd, unit) => {
  const keys = new Set();
  const d = new Date(periodStart);
  d.setHours(0, 0, 0, 0);
  const end = new Date(periodEnd);
  end.setHours(23, 59, 59, 999);
  while (d <= end) {
    keys.add(getLocalDateKey(d, unit));
    if (unit === 'day') d.setDate(d.getDate() + 1);
    else if (unit === 'week') d.setDate(d.getDate() + 7);
    else if (unit === 'month') d.setMonth(d.getMonth() + 1);
    else break;
  }
  return Array.from(keys);
};

/** 取得從開始到截止日為止的 period dateKeys（依 repeat unit + interval） */
const getPeriodKeysFromStartToDue = (startDate, dueDate, unit, interval = 1) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  if (start > end) return [];
  const step = Math.max(1, Number(interval) || 1);
  const keys = [];
  const d = new Date(start);
  while (d <= end) {
    keys.push(getLocalDateKey(d, unit));
    if (unit === 'day') d.setDate(d.getDate() + step);
    else if (unit === 'week') d.setDate(d.getDate() + step * 7);
    else if (unit === 'month') d.setMonth(d.getMonth() + step);
    else if (unit === 'year') d.setFullYear(d.getFullYear() + step);
    else d.setDate(d.getDate() + step);
  }
  return keys;
};

/**
 * 1. 計算任務進度 (全層級連動版)
 * @param {Object} task
 * @param {Object} [options] - { dateKey?: string } 指定日期時，重複任務用該日進度；{ periodStart?, periodEnd?, unit? } 指定期間時，用期間內 repeatLog 平均
 * @returns {number} 0-100
 */
export const calculateTaskProgress = (task, options = {}) => {
  const rep = task.details?.repeat;
  const enabled = rep && (rep.enabled === true || rep.enabled === 'true');
  const unit = rep?.unit || 'day';

  // 有子任務
  if (task.children && task.children.length > 0) {
    // 重複父任務 + 子任務：子任務每天被重置。進度條/總覽用 repeatLog；即時更新用子任務
    const hasPeriodContext = options.dateKey || (options.periodStart != null && options.periodEnd != null) || options.useRepeatLog;
    if (enabled && hasPeriodContext) {
      const log = task.details?.repeatLog || {};
      const entries = Object.entries(log);
      if (entries.length === 0) return 0;
      if (options.dateKey) {
        const p = getRepeatProgressForDateKey(task, options.dateKey);
        return p !== null ? p : 0;
      }
      if (options.periodStart != null && options.periodEnd != null) {
        const keys = getDateKeysInPeriod(options.periodStart, options.periodEnd, unit);
        const inPeriod = entries.filter(([k]) => keys.includes(k));
        if (inPeriod.length === 0) {
          const currentProgress = task.children.reduce((acc, child) => acc + calculateTaskProgress(child, options), 0);
          return Math.round(currentProgress / task.children.length);
        }
        const sum = inPeriod.reduce((acc, [, e]) => {
          const v = e?.completed === true || e?.completed === 'true' ? 100 : (Number(e?.maxProgress) || 0);
          return acc + Math.max(0, Math.min(100, v));
        }, 0);
        return Math.round(sum / inPeriod.length);
      }
      const completed = entries.filter(([, e]) => e && (e.completed === true || e.completed === 'true'));
      return Math.round((completed.length / entries.length) * 100);
    }
    if (enabled && !hasPeriodContext) {
      // 即時更新：用子任務的當前進度（updateCurrentWindowLog 會寫入 repeatLog）
      const sumProgress = task.children.reduce((acc, child) => acc + calculateTaskProgress(child, options), 0);
      return Math.round(sumProgress / task.children.length);
    }
    const sumProgress = task.children.reduce((acc, child) => acc + calculateTaskProgress(child, options), 0);
    return Math.round(sumProgress / task.children.length);
  }

  // 葉子任務
  if (enabled) {
    const log = task.details?.repeatLog || {};
    const entries = Object.entries(log);
    const hasDueDate = !!(task.details?.dueDate);
    if (entries.length === 0) return task.status === 'completed' ? 100 : 0;
    if (options.dateKey) {
      const p = getRepeatProgressForDateKey(task, options.dateKey);
      return p !== null ? p : (task.status === 'completed' ? 100 : 0);
    }
    if (options.periodStart != null && options.periodEnd != null) {
      const keys = getDateKeysInPeriod(options.periodStart, options.periodEnd, unit);
      const inPeriod = entries.filter(([k]) => keys.includes(k));
      if (inPeriod.length === 0) return task.status === 'completed' ? 100 : 0;
      const completed = inPeriod.filter(([, e]) => e && (e.completed === true || e.completed === 'true'));
      return Math.round((completed.length / inPeriod.length) * 100);
    }
    // 狀況二：無截止日的重複任務 → 根據當下完成與否顯示（100% 或 0%）
    if (!hasDueDate) {
      const currentKey = getLocalDateKeyForRepeat(task, new Date());
      const p = getRepeatProgressForDateKey(task, currentKey);
      return p !== null ? p : (task.status === 'completed' ? 100 : 0);
    }
    // 狀況一：有截止日的重複任務 → 顯示「當次完成度」（非整體完成率）
    if (!options.dateKey && !(options.periodStart != null && options.periodEnd != null)) {
      const currentKey = getLocalDateKeyForRepeat(task, new Date());
      const p = getRepeatProgressForDateKey(task, currentKey);
      return p !== null ? p : (task.status === 'completed' ? 100 : 0);
    }
    // 有明確 period 時才用整體完成率
    const startStr = task.details?.startDate;
    const dueStr = task.details?.dueDate;
    const interval = Math.max(1, Number(rep?.interval) || 1);
    const start = startStr ? new Date(startStr) : new Date();
    const due = dueStr ? new Date(dueStr) : new Date();
    const keysInRange = getPeriodKeysFromStartToDue(start, due, unit, interval);
    const totalCount = keysInRange.length;
    if (totalCount <= 0) return 0;
    const completedCount = entries.filter(([k, e]) => keysInRange.includes(k) && e && (e.completed === true || e.completed === 'true')).length;
    return Math.round((completedCount / totalCount) * 100);
  }
  return task.status === 'completed' ? 100 : 0;
};

/**
 * 是否為「當下完成度」風格（無截止日的重複任務）：進度條應使用更淺藍色
 * @param {Object} task
 * @returns {boolean}
 */
export const isTaskProgressCurrentPeriodStyle = (task) => {
  const rep = task.details?.repeat;
  const enabled = rep && (rep.enabled === true || rep.enabled === 'true');
  const hasDueDate = !!(task.details?.dueDate);
  if (task.children && task.children.length > 0) {
    if (enabled && !hasDueDate) return true;
    if (!enabled) {
      const hasDescendantRepeatWithoutDue = (t) => {
        if (!t.children?.length) return false;
        return t.children.some((c) => {
          const cr = c.details?.repeat;
          const ce = cr && (cr.enabled === true || cr.enabled === 'true');
          const cDue = !!(c.details?.dueDate);
          if (ce && !cDue) return true;
          return hasDescendantRepeatWithoutDue(c);
        });
      };
      return hasDescendantRepeatWithoutDue(task);
    }
    return false;
  }
  return enabled && !hasDueDate;
};

/**
 * 更新任務並傳播至父任務的 repeatLog（供 completeProjectTaskFromDialog 等使用）
 * @param {Array} list - 任務列表
 * @param {string|number} taskId - 目標任務 ID
 * @param {Function} updater - (task) => updatedTask
 * @returns {Array} 更新後的列表
 */
export const updateTaskInTreeWithRepeatLogPropagation = (list, taskId, updater) => {
  if (!Array.isArray(list)) return list;
  const targetStr = String(taskId);
  const updateRepeatLogForTask = (t) => {
    const rep = t.details?.repeat;
    const enabled = rep && (rep.enabled === true || rep.enabled === 'true');
    if (!enabled) return t;
    const now = new Date();
    const currentKey = getLocalDateKeyForRepeat(t, now);
    const nextLog = { ...(t.details?.repeatLog || {}) };
    const isCompleted = t.status === 'completed' || t.completed === true;
    /* 當次完成時 maxProgress 必為 100 */
    const progressVal = isCompleted ? 100 : (typeof t.details?.progress === 'number' ? t.details.progress : 0);
    const createSnapshot = (x) => ({
      id: x.id, title: x.title, status: x.status,
      completed: x.status === 'completed' || x.completed === true,
      children: x.children ? x.children.map(createSnapshot) : []
    });
    const snapshot = (t.children?.length) ? t.children.map(createSnapshot) : [];
    const existing = nextLog[currentKey];
    const effectiveProgress = isCompleted ? 100 : Math.max(0, Math.min(100, progressVal));
    nextLog[currentKey] = {
      completed: isCompleted || (existing?.completed || false),
      completedAt: isCompleted ? (existing?.completedAt || new Date().toISOString()) : (existing?.completedAt || null),
      maxProgress: Math.max(existing?.maxProgress || 0, effectiveProgress),
      recordedAt: existing?.recordedAt || new Date().toISOString(),
      taskSnapshot: snapshot
    };
    return { ...t, details: { ...t.details, repeatLog: nextLog } };
  };

  return list.map((task) => {
    if (String(task.id) === targetStr) {
      let updated = updater(task);
      if (updated.details) updated.details.progress = calculateTaskProgress(updated);
      return updateRepeatLogForTask(updated);
    }
    if (task.children?.length) {
      const updatedChildren = updateTaskInTreeWithRepeatLogPropagation(task.children, taskId, updater);
      if (updatedChildren === task.children) return task;
      let newTask = { ...task, children: updatedChildren };
      if (newTask.details) newTask.details.progress = calculateTaskProgress(newTask);
      const rep = newTask.details?.repeat;
      const enabled = rep && (rep.enabled === true || rep.enabled === 'true');
      if (enabled) {
        const now = new Date();
        const currentKey = getLocalDateKeyForRepeat(newTask, now);
        const nextLog = { ...(newTask.details?.repeatLog || {}) };
        const isCompleted = newTask.status === 'completed' || newTask.completed === true;
        const progressVal = isCompleted ? 100 : (typeof newTask.details?.progress === 'number' ? newTask.details.progress : 0);
        const createSnapshot = (t) => ({
          id: t.id, title: t.title, status: t.status,
          completed: t.status === 'completed' || t.completed === true,
          children: t.children ? t.children.map(createSnapshot) : []
        });
        const snapshot = (newTask.children?.length) ? newTask.children.map(createSnapshot) : [];
        const existing = nextLog[currentKey];
        nextLog[currentKey] = {
          completed: isCompleted || (existing?.completed || false),
          completedAt: isCompleted ? (existing?.completedAt || new Date().toISOString()) : (existing?.completedAt || null),
          maxProgress: Math.max(existing?.maxProgress || 0, Math.max(0, Math.min(100, progressVal))),
          recordedAt: existing?.recordedAt || new Date().toISOString(),
          taskSnapshot: snapshot
        };
        newTask = { ...newTask, details: { ...newTask.details, repeatLog: nextLog } };
      }
      return newTask;
    }
    return task;
  });
};

/**
 * 2. 遞歸查找任務
 * @param {Array} tasks 
 * @param {string|number} taskId 
 * @returns {Object|null}
 */
export const findTaskById = (tasks, taskId) => {
  if (!Array.isArray(tasks)) return null;
  const taskIdStr = String(taskId);
  for (const task of tasks) {
    if (String(task.id) === taskIdStr) return task;
    if (task.children?.length > 0) {
      const found = findTaskById(task.children, taskId);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 3. 遞歸查找父任務 ID
 * @param {Array} tasks 
 * @param {string|number} taskId 
 * @returns {string|number|null}
 */
export const findParentId = (tasks, taskId) => {
  if (!Array.isArray(tasks)) return null;
  const taskIdStr = String(taskId);
  for (const task of tasks) {
    if (task.children?.some(child => String(child.id) === taskIdStr)) {
      return task.id;
    }
    if (task.children?.length > 0) {
      const found = findParentId(task.children, taskId);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 4. 檢查是否為子孫任務
 * @param {Object} parent 
 * @param {string|number} taskId 
 * @returns {boolean}
 */
export const isChildTask = (parent, taskId) => {
  if (!parent.children) return false;
  const taskIdStr = String(taskId);
  if (parent.children.some(child => String(child.id) === taskIdStr)) return true;
  return parent.children.some(child => isChildTask(child, taskId));
};

/**
 * 5. 調整任務及其子孫的等級
 * @param {Object} task 
 * @param {string} parentLevel 
 * @returns {Object}
 */
export const adjustTaskLevels = (task, parentLevel) => {
  const currentLevel = LEVEL_MAP[parentLevel]?.next || 'A';
  const updatedTask = { ...task, level: currentLevel };
  
  if (updatedTask.children?.length > 0) {
    updatedTask.children = updatedTask.children.map(child => 
      adjustTaskLevels(child, currentLevel)
    );
  }
  return updatedTask;
};

/**
 * 6. 從樹中移除任務
 * 返回 { tasks: 新樹, task: 被移除的對象 }
 */
export const removeTaskFromTree = (tasks, taskId) => {
  let removedTask = null;
  const taskIdStr = String(taskId);

  const process = (items) => {
    if (!Array.isArray(items)) return [];
    
    const nextItems = [];
    let hasChanged = false;

    for (const item of items) {
      if (String(item.id) === taskIdStr) {
        removedTask = { ...item };
        hasChanged = true;
        continue;
      }

      if (item.children && item.children.length > 0) {
        const updatedChildren = process(item.children);
        if (updatedChildren !== item.children) {
          nextItems.push({
            ...item,
            children: updatedChildren,
            details: {
              ...item.details,
              progress: calculateTaskProgress({ ...item, children: updatedChildren })
            }
          });
          hasChanged = true;
          continue;
        }
      }
      nextItems.push(item);
    }

    return hasChanged ? nextItems : items;
  };

  const newTasks = process(tasks);
  return { tasks: newTasks, task: removedTask };
};

/**
 * 7. 添加任務到樹的特定位置
 */
export const addChildToTask = (tasks, parentId, newChild, index = -1, options = {}) => {
  const { preserveLevel = false } = options;
  const parentIdStr = String(parentId);

  const process = (items) => {
    if (!Array.isArray(items)) return items;

    let hasChanged = false;
    const nextItems = items.map(item => {
      if (String(item.id) === parentIdStr) {
        hasChanged = true;
        const children = Array.isArray(item.children) ? [...item.children] : [];
        const adjustedChild = preserveLevel ? newChild : adjustTaskLevels(newChild, item.level);
        
        if (index >= 0 && index <= children.length) {
          children.splice(index, 0, adjustedChild);
        } else {
          children.push(adjustedChild);
        }

        return {
          ...item,
          children,
          details: {
            ...item.details,
            progress: calculateTaskProgress({ ...item, children })
          }
        };
      }

      if (item.children && item.children.length > 0) {
        const updatedChildren = process(item.children);
        if (updatedChildren !== item.children) {
          hasChanged = true;
          return {
            ...item,
            children: updatedChildren,
            details: {
              ...item.details,
              progress: calculateTaskProgress({ ...item, children: updatedChildren })
            }
          };
        }
      }
      return item;
    });

    return hasChanged ? nextItems : items;
  };

  // 處理 root 情況：如果 tasks 陣列中直接包含 root 物件
  if (parentIdStr === 'root') {
    return tasks.map(item => {
      if (String(item.id) === 'root') {
        const children = Array.isArray(item.children) ? [...item.children] : [];
        const adjustedChild = preserveLevel ? newChild : adjustTaskLevels(newChild, 'NONE');
        
        if (index >= 0 && index <= children.length) {
          children.splice(index, 0, adjustedChild);
        } else {
          children.push(adjustedChild);
        }

        return {
          ...item,
          children,
          details: {
            ...item.details,
            progress: calculateTaskProgress({ ...item, children })
          }
        };
      }
      return item;
    });
  }

  return process(tasks);
};

/**
 * 8. 遞歸更新任務詳情
 */
export const updateTaskDetails = (tasks, taskId, field, value) => {
  if (!Array.isArray(tasks)) return [];
  const taskIdStr = String(taskId);

  let hasChanged = false;
  const nextItems = tasks.map(task => {
    if (String(task.id) === taskIdStr) {
      hasChanged = true;
      if (field === 'description' || field === 'drawingData' || field === 'title') {
        return { ...task, [field]: value };
      }
      return {
        ...task,
        details: { ...task.details, [field]: value }
      };
    }
    
    if (task.children?.length > 0) {
      const updatedChildren = updateTaskDetails(task.children, taskId, field, value);
      if (updatedChildren !== task.children) {
        hasChanged = true;
        return { ...task, children: updatedChildren };
      }
    }
    return task;
  });

  return hasChanged ? nextItems : tasks;
};

/**
 * 9. 通用更新任務
 */
export const updateTaskInTree = (tasks, taskId, updates) => {
  if (!Array.isArray(tasks)) return [];
  const taskIdStr = String(taskId);

  let hasChanged = false;
  const nextItems = tasks.map(task => {
    if (String(task.id) === taskIdStr) {
      hasChanged = true;
      return {
        ...task,
        ...updates,
        details: updates.details ? { ...task.details, ...updates.details } : task.details
      };
    }
    
    if (task.children?.length > 0) {
      const updatedChildren = updateTaskInTree(task.children, taskId, updates);
      if (updatedChildren !== task.children) {
        hasChanged = true;
        return { ...task, children: updatedChildren };
      }
    }
    return task;
  });

  return hasChanged ? nextItems : tasks;
};

/**
 * 處理超過 A-Z 範圍的擴展等級
 */
export const getExtendedLevel = (parentLevel) => {
  if (!parentLevel || parentLevel === 'NONE') return 'A';
  if (parentLevel.length === 1) {
    return 'Z' === parentLevel ? 'AA' : String.fromCharCode(parentLevel.charCodeAt(0) + 1);
  }
  const lastChar = parentLevel.charAt(parentLevel.length - 1);
  const prefix = parentLevel.slice(0, -1);
  if (lastChar === 'Z') {
    return getExtendedLevel(prefix) + 'A';
  } else {
    return prefix + String.fromCharCode(lastChar.charCodeAt(0) + 1);
  }
};
