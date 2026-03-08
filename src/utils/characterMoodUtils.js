/**
 * 角色心情與今日推薦
 * - 每日首次開啟詢問心情
 * - 依心情推薦任務
 * - 簡單任務（腦袋很亂）獨立儲存
 */

import * as TaskUtils from '../components/ProjectTasks/taskUtils';

const MOOD_CHECK_DATE_KEY = 'characterMoodCheckDate.v1';
const TODAY_MOOD_KEY = 'characterTodayMood.v1';
const TODAY_RECOMMENDED_IDS_KEY = 'characterTodayRecommendedIds.v1';
const SIMPLE_TASKS_KEY = 'characterSimpleTasks.v1';

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 今日是否已問過心情（測試階段：每次開啟都詢問） */
export const isFirstOpenToday = () => {
  // 測試階段：改為 true 讓每次開啟頁面都觸發心情詢問
  const TESTING_ALWAYS_ASK = true;
  if (TESTING_ALWAYS_ASK) return true;
  try {
    const saved = localStorage.getItem(MOOD_CHECK_DATE_KEY);
    return saved !== getTodayKey();
  } catch {
    return true;
  }
};

/** 標記今日已問過 */
export const setMoodCheckedToday = () => {
  try {
    localStorage.setItem(MOOD_CHECK_DATE_KEY, getTodayKey());
  } catch (e) {
    console.error('Failed to set mood check date:', e);
  }
};

export const getTodayMood = () => {
  try {
    const saved = localStorage.getItem(TODAY_MOOD_KEY);
    const today = getTodayKey();
    const datePart = (saved || '').split(':')[0];
    if (datePart !== today) return null;
    return (saved || '').split(':')[1] || null;
  } catch {
    return null;
  }
};

export const setTodayMood = (mood) => {
  try {
    localStorage.setItem(TODAY_MOOD_KEY, `${getTodayKey()}:${mood || ''}`);
  } catch (e) {
    console.error('Failed to set today mood:', e);
  }
};

/** 今日推薦的任務 ID 列表 [{ source, id }] */
export const getTodayRecommendedIds = () => {
  try {
    const saved = localStorage.getItem(TODAY_RECOMMENDED_IDS_KEY);
    const today = getTodayKey();
    const parsed = saved ? JSON.parse(saved) : {};
    if (parsed.date !== today) return [];
    return Array.isArray(parsed.ids) ? parsed.ids : [];
  } catch {
    return [];
  }
};

export const setTodayRecommendedIds = (ids) => {
  try {
    localStorage.setItem(TODAY_RECOMMENDED_IDS_KEY, JSON.stringify({
      date: getTodayKey(),
      ids: Array.isArray(ids) ? ids : []
    }));
  } catch (e) {
    console.error('Failed to set recommended ids:', e);
  }
};

/** 是否為今日推薦任務（用於 2x XP） */
export const isTaskRecommendedToday = (source, taskId) => {
  const ids = getTodayRecommendedIds();
  return ids.some((recId) => {
    if (typeof recId !== 'string') return false;
    const [s, id] = recId.split(':');
    return s === source && String(id) === String(taskId);
  });
};

/** 相容：isTaskRecommended(taskId, source) */
export const isTaskRecommended = (taskId, source) => isTaskRecommendedToday(source, taskId);

/** 便條紙任務完成（從角色對話框觸發） */
export const completeNoteTaskFromDialog = (taskId, addXpNoteFn, addRecommendedBonusXpFn) => {
  try {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const completed = JSON.parse(localStorage.getItem('completedTasks') || '[]');
    const task = tasks.find((t) => String(t.id) === String(taskId));
    if (!task) return false;
    const newCompleted = { ...task, completed: true, completedAt: new Date().toISOString() };
    localStorage.setItem('tasks', JSON.stringify(tasks.filter((t) => String(t.id) !== String(taskId))));
    localStorage.setItem('completedTasks', JSON.stringify([...completed, newCompleted]));
    if (addXpNoteFn) addXpNoteFn();
    if (addRecommendedBonusXpFn && isTaskRecommended(taskId, 'note')) addRecommendedBonusXpFn(1);
    return true;
  } catch (e) {
    console.error('completeNoteTaskFromDialog:', e);
    return false;
  }
};

/** 項目任務完成（從角色對話框觸發）- 會傳播至父任務 repeatLog */
export const completeProjectTaskFromDialog = (taskId, addRecommendedBonusXpFn) => {
  try {
    const raw = localStorage.getItem('projectTasks');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed[0]?.children) return false;
    const task = TaskUtils.findTaskById(parsed[0].children, taskId);
    const rep = task?.details?.repeat;
    const isRepeat = rep && (rep.enabled === true || rep.enabled === 'true');
    const updated = TaskUtils.updateTaskInTreeWithRepeatLogPropagation(parsed[0].children, taskId, (t) => ({
      ...t,
      status: 'completed',
      completed: true
    }));
    localStorage.setItem('projectTasks', JSON.stringify([{ ...parsed[0], children: updated }]));
    if (addRecommendedBonusXpFn && isTaskRecommended(taskId, 'project')) {
      addRecommendedBonusXpFn(isRepeat ? 1 : 2);
    }
    return true;
  } catch (e) {
    console.error('completeProjectTaskFromDialog:', e);
    return false;
  }
};

/** 便條紙任務取消完成（從進度彈窗觸發） */
export const uncompleteNoteTaskFromDialog = (taskId) => {
  try {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const completed = JSON.parse(localStorage.getItem('completedTasks') || '[]');
    const task = completed.find((t) => String(t.id) === String(taskId));
    if (!task) return false;
    const restored = { ...task, completed: false, completedAt: null };
    localStorage.setItem('tasks', JSON.stringify([...tasks, restored]));
    localStorage.setItem('completedTasks', JSON.stringify(completed.filter((t) => String(t.id) !== String(taskId))));
    return true;
  } catch (e) {
    console.error('uncompleteNoteTaskFromDialog:', e);
    return false;
  }
};

/** 項目任務取消完成（從進度彈窗觸發）- 會傳播至父任務 repeatLog */
export const uncompleteProjectTaskFromDialog = (taskId) => {
  try {
    const raw = localStorage.getItem('projectTasks');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed[0]?.children) return false;
    const updated = TaskUtils.updateTaskInTreeWithRepeatLogPropagation(parsed[0].children, taskId, (t) => ({
      ...t,
      status: 'pending',
      completed: false
    }));
    localStorage.setItem('projectTasks', JSON.stringify([{ ...parsed[0], children: updated }]));
    return true;
  } catch (e) {
    console.error('uncompleteProjectTaskFromDialog:', e);
    return false;
  }
};

export const HOME_TASKS_REFRESH_EVENT = 'homeTasksRefresh';

/** 從今日推薦等處點擊任務時，請求打開任務詳情彈窗。payload: { task, source: 'note'|'project' } */
export const OPEN_TASK_DETAIL_EVENT = 'openTaskDetail';

/** 簡單任務（腦袋很亂）- 獨立一類 */
export const getSimpleTasks = () => {
  try {
    const saved = localStorage.getItem(SIMPLE_TASKS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const setSimpleTasks = (tasks) => {
  try {
    localStorage.setItem(SIMPLE_TASKS_KEY, JSON.stringify(Array.isArray(tasks) ? tasks : []));
  } catch (e) {
    console.error('Failed to set simple tasks:', e);
  }
};

/** 簡單任務模板 */
export const SIMPLE_TASK_TEMPLATES = [
  { title: '起床' },
  { title: '刷牙' },
  { title: '吃早餐' },
  { title: '喝水' },
  { title: '整理桌面' }
];

export const getSimpleTaskTemplates = () => SIMPLE_TASK_TEMPLATES;

/** 心情選項 */
export const getMoodOptions = () => [
  { id: 'energetic', label: '🔥 活力滿滿，想挑戰一下' },
  { id: 'steady', label: '😊 穩穩當當，準備就緒' },
  { id: 'low', label: '🔋 電量偏低，有點累了' },
  { id: 'chaotic', label: '🌪️ 腦袋很亂，感到焦慮' },
  { id: 'random', label: '🎲 不想思考，幫我決定' }
];

/** 完成簡單任務 */
export const completeSimpleTask = (taskId) => {
  const tasks = getSimpleTasks();
  const updated = tasks.map((t) =>
    String(t.id) === String(taskId) ? { ...t, completed: true } : t
  );
  setSimpleTasks(updated);
};

/** 腦袋很亂時確保有簡單任務可推薦 */
export const ensureSimpleTasksForChaotic = () => {
  const simple = getSimpleTasks();
  const titleOrText = (t) => t.title || t.text || '';
  const toAdd = [];
  for (const t of SIMPLE_TASK_TEMPLATES) {
    const exists = simple.some((s) => titleOrText(s).includes(t.title));
    if (!exists) {
      toAdd.push({
        id: `simple-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: t.title,
        completed: false
      });
    }
  }
  if (toAdd.length > 0) setSimpleTasks([...simple, ...toAdd]);
};

const flattenProjectTasks = (list, result = []) => {
  if (!Array.isArray(list)) return result;
  for (const t of list) {
    if (t.id === 'root') continue;
    result.push(t);
    if (t.children?.length) flattenProjectTasks(t.children, result);
  }
  return result;
};

const parseDueDate = (task) => {
  const d = task?.details?.dueDate || task?.details?.startDate;
  if (!d) return null;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const daysUntilDue = (task) => {
  const due = parseDueDate(task);
  if (!due) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - now) / (24 * 60 * 60 * 1000));
};

/** 依心情推薦任務，回傳 [{ source, id, task, ... }] */
export const getRecommendedTasks = (mood) => {
  const noteTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
  const projectRaw = localStorage.getItem('projectTasks');
  let projectTree = [];
  if (projectRaw) {
    try {
      const parsed = JSON.parse(projectRaw);
      if (Array.isArray(parsed) && parsed[0]?.children) projectTree = parsed[0].children;
    } catch {}
  }
  const projectTasks = flattenProjectTasks(projectTree);
  const simpleTasks = getSimpleTasks();

  const noteItems = noteTasks.map((t) => ({ source: 'note', id: t.id, task: t }));
  const projectItems = projectTasks.map((t) => ({ source: 'project', id: t.id, task: t }));
  const simpleItems = simpleTasks.map((t) => ({ source: 'simple', id: t.id, task: t }));

  const allItems = [...noteItems, ...projectItems];
  const pendingNote = noteItems.filter((i) => !i.task.completed);
  const pendingProject = projectItems.filter((i) => i.task.status !== 'completed' && !i.task.completed);
  const pendingSimple = simpleItems.filter((i) => !i.task.completed);

  const getCloseToDeadline = (items, limit = 2) => {
    const withDue = items
      .filter((i) => parseDueDate(i.task))
      .map((i) => ({ ...i, days: daysUntilDue(i.task) }))
      .filter((i) => i.days >= 0)
      .sort((a, b) => a.days - b.days);
    const within1Day = withDue.filter((i) => i.days <= 1);
    if (within1Day.length > limit) return within1Day.map(({ source, id, task }) => ({ source, id, task }));
    return withDue.slice(0, limit).map(({ source, id, task }) => ({ source, id, task }));
  };

  const closeToDeadline = getCloseToDeadline([...pendingNote, ...pendingProject], 999);

  switch (mood) {
    case 'energy': {
      const byComplexity = [...pendingProject]
        .map((i) => ({
          ...i,
          score: (i.task.children?.length || 0) * 2 + (i.task.title?.length || 0) / 10
        }))
        .sort((a, b) => b.score - a.score);
      const byRarely = [...pendingNote, ...pendingProject].sort(() => Math.random() - 0.5);
      const picked = new Set();
      const result = [];
      for (const i of byComplexity) {
        if (result.length >= 3) break;
        const key = `${i.source}-${i.id}`;
        if (!picked.has(key)) {
          picked.add(key);
          result.push(i);
        }
      }
      for (const i of byRarely) {
        if (result.length >= 3) break;
        const key = `${i.source}-${i.id}`;
        if (!picked.has(key)) {
          picked.add(key);
          result.push(i);
        }
      }
      return result;
    }
    case 'steady': {
      return getCloseToDeadline([...pendingNote, ...pendingProject], 3);
    }
    case 'low': {
      const calcProgress = (t) => {
        if (!t.children?.length) return t.status === 'completed' ? 100 : 0;
        const sum = t.children.reduce((a, c) => a + calcProgress(c), 0);
        return sum / t.children.length;
      };
      const withProgress = [...pendingProject].map((i) => ({
        ...i,
        progress: calcProgress(i.task)
      }));
      return withProgress
        .filter((i) => i.progress > 0 && i.progress < 100)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 3);
    }
    case 'chaos': {
      const keywords = ['起床', '刷牙', '早餐', '吃早餐', '喝水', '整理'];
      const titleOrText = (t) => t.title || t.text || '';
      const matched = [...pendingNote, ...pendingProject, ...pendingSimple].filter((i) =>
        keywords.some((k) => titleOrText(i.task).includes(k))
      );
      if (matched.length >= 3) return matched.slice(0, 3);
      let simple = getSimpleTasks();
      const toAdd = [];
      for (const t of SIMPLE_TASK_TEMPLATES) {
        if (matched.length + toAdd.length >= 3) break;
        const exists = simple.some((s) => titleOrText(s).includes(t.title)) ||
          matched.some((m) => titleOrText(m.task).includes(t.title));
        if (!exists) {
          const newTask = {
            id: `simple-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: t.title,
            completed: false
          };
          toAdd.push(newTask);
          matched.push({ source: 'simple', id: newTask.id, task: newTask });
        }
      }
      if (toAdd.length > 0) setSimpleTasks([...simple, ...toAdd]);
      return matched.slice(0, 3);
    }
    case 'random': {
      const shuffled = [...pendingNote, ...pendingProject].sort(() => Math.random() - 0.5);
      const random3 = shuffled.slice(0, 3);
      const deadline2 = closeToDeadline.filter(
        (d) => !random3.some((r) => r.source === d.source && String(r.id) === String(d.id))
      );
      const combined = [...random3];
      for (const d of deadline2) {
        if (combined.length >= 5) break;
        if (!combined.some((c) => c.source === d.source && String(c.id) === String(d.id))) {
          combined.push(d);
        }
      }
      return combined.slice(0, 5);
    }
    default:
      return getCloseToDeadline([...pendingNote, ...pendingProject], 3);
  }
};
