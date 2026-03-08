import React from 'react';
import { useNavigate } from 'react-router-dom';
import SubCalendarTabs from './SubCalendarTabs';
import SubCalendarEditorModal from './SubCalendarEditorModal';
import AddTaskModal from '../ProjectTasks/AddTaskModal';
import {
  loadSubCalendars,
  saveSubCalendars,
  loadLastViewedCalendarId,
  saveLastViewedCalendarId
} from '../../features/unifiedCalendar/storage';
import { isOccurrenceCompleted } from '../../utils/projectTaskRepeatUtils';
import { PROJECT_TASKS_UPDATED_EVENT, TASK_TAGS_UPDATED_EVENT } from '../GlobalAddTaskModal';
import './UnifiedCalendar.css';

const UNIFIED_CALENDAR_STYLE_KEY = 'unifiedCalendar.style.v1';
const UNIFIED_CALENDAR_FILTERS_KEY = 'unifiedCalendar.filters.v1';
const UNIFIED_CALENDAR_DISPLAY_MODE_KEY = 'unifiedCalendar.taskDisplayMode.v1';
const OPEN_PROJECT_TASK_KEY = 'unifiedCalendar.openProjectTask.v1';
const OPEN_NOTE_TASK_KEY = 'unifiedCalendar.openNoteTask.v1';
const LAYOUT_TEMPLATE_STORAGE_KEY = 'taskDetailLayout.templates.v1';
const TASK_LAYOUT_STORAGE_PREFIX = 'taskDetailLayout.v3.task';
const DEFAULT_REPEAT = {
  enabled: false,
  interval: 1,
  unit: 'day',
  base: 'startDate',
  lastResetAt: null,
  anchorAt: null,
  durationValue: 1,
  durationUnit: 'hour'
};
const createEmptyNewTask = () => ({
  title: '',
  description: '',
  layoutTemplateId: '',
  tagId: '__inherit__',
  startDate: '',
  startTime: '00:00',
  dueDate: '',
  dueTime: '23:59'
});

const flattenProjectTasks = (list, depth = 0, result = [], ancestors = []) => {
  (list || []).forEach((task) => {
    const id = `project:${task.id}`;
    const groupId = `group:${task.id}`;
    result.push({
      id,
      rawId: String(task.id),
      groupId,
      title: task.title || '未命名任務',
      depth,
      ancestors,
      type: 'project',
      task
    });
    flattenProjectTasks(task.children || [], depth + 1, result, [...ancestors, groupId]);
  });
  return result;
};

const flattenNoteTasks = (list) => {
  const normalizeNoteRepeat = (rawRepeat) => {
    if (!rawRepeat) return { enabled: false };
    if (typeof rawRepeat === 'string') {
      if (rawRepeat === 'daily') return { enabled: true, interval: 1, unit: 'day', durationValue: 1, durationUnit: 'hour' };
      if (rawRepeat === 'weekly') return { enabled: true, interval: 1, unit: 'week', durationValue: 1, durationUnit: 'hour' };
      if (rawRepeat === 'monthly') return { enabled: true, interval: 1, unit: 'month', durationValue: 1, durationUnit: 'hour' };
      return { enabled: false };
    }
    if (typeof rawRepeat === 'object') {
      return {
        ...rawRepeat,
        enabled: Boolean(rawRepeat.enabled),
        interval: rawRepeat.interval || 1,
        unit: rawRepeat.unit || 'day',
        durationValue: rawRepeat.durationValue || 1,
        durationUnit: rawRepeat.durationUnit || 'hour'
      };
    }
    return { enabled: false };
  };

  return (list || []).map((task) => {
    const details = task.details || {};
    const noteTitle = task.text || task.title || '未命名便條紙';
    const normalized = {
      ...task,
      title: noteTitle,
      details: {
        ...details,
        startDate: details.startDate || '',
        startTime: details.startTime || '',
        dueDate: details.dueDate || details.date || '',
        dueTime: details.dueTime || details.time || '',
        repeat: normalizeNoteRepeat(details.repeat)
      },
      status: task.completed ? 'completed' : (task.status || 'pending'),
      priority: task.priority || 'none',
      tagId: task.tagId || details.tagId || 'none',
      levelType: task.levelType || 'NONE',
      _sourceType: 'note'
    };
    return {
      id: `note:${task.id}`,
      rawId: String(task.id),
      title: noteTitle,
      type: 'note',
      task: normalized
    };
  });
};

const toDateTime = (dateValue, timeValue, fallback = 'start') => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const [hours, minutes] = String(timeValue || '').split(':').map(v => parseInt(v, 10));
  const hasValidTime = Number.isFinite(hours) && Number.isFinite(minutes);
  if (hasValidTime) {
    date.setHours(hours, minutes, 0, 0);
  } else if (fallback === 'end') {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

const toEndOfDay = (baseDate) => {
  const end = new Date(baseDate);
  end.setHours(23, 59, 59, 999);
  return end;
};

const addDuration = (baseDate, value, unit) => {
  const start = new Date(baseDate);
  const amount = Math.max(1, Number.isFinite(Number(value)) ? Number(value) : 1);
  if (unit === 'minute') return new Date(start.getTime() + amount * 60 * 1000);
  if (unit === 'hour') return new Date(start.getTime() + amount * 60 * 60 * 1000);
  return new Date(start.getTime() + amount * 24 * 60 * 60 * 1000);
};

const advanceByRepeat = (baseDate, interval, unit) => {
  const next = new Date(baseDate);
  const step = Math.max(1, Number.isFinite(Number(interval)) ? Number(interval) : 1);
  if (unit === 'minute') next.setMinutes(next.getMinutes() + step);
  else if (unit === 'week') next.setDate(next.getDate() + (step * 7));
  else if (unit === 'month') next.setMonth(next.getMonth() + step);
  else if (unit === 'year') next.setFullYear(next.getFullYear() + step);
  else next.setDate(next.getDate() + step);
  return next;
};

const retreatByRepeat = (baseDate, interval, unit) => {
  const prev = new Date(baseDate);
  const step = Math.max(1, Number.isFinite(Number(interval)) ? Number(interval) : 1);
  if (unit === 'minute') prev.setMinutes(prev.getMinutes() - step);
  else if (unit === 'week') prev.setDate(prev.getDate() - (step * 7));
  else if (unit === 'month') prev.setMonth(prev.getMonth() - step);
  else if (unit === 'year') prev.setFullYear(prev.getFullYear() - step);
  else prev.setDate(prev.getDate() - step);
  return prev;
};

const getTaskDisplayWindows = (task, rangeStart, rangeEnd) => {
  const details = task?.details || {};
  const repeat = details.repeat || {};
  const start = toDateTime(details.startDate, details.startTime, 'start');
  const due = toDateTime(details.dueDate, details.dueTime, 'end');
  const isNoteTask = task?._sourceType === 'note';

  if (!repeat.enabled) {
    if (repeat.disabledByUser) return [];
    if (!start && !due) return [];
    if (isNoteTask && !start && due) {
      const sameDayEnd = toEndOfDay(due);
      return due <= rangeEnd && sameDayEnd >= rangeStart ? [{ start: due, end: sameDayEnd }] : [];
    }
    const winStart = start || rangeStart;
    const winEnd = due || rangeEnd;
    return winStart && winEnd && winStart <= rangeEnd && winEnd >= rangeStart ? [{ start: winStart, end: winEnd }] : [];
  }

  const durationValue = repeat.durationValue ?? 1;
  const durationUnit = repeat.durationUnit || 'hour';
  if (!start && !due) return [];

  const windows = [];
  let guard = 0;

  if (start && due) {
    if (due < start) return [];
    let cursor = new Date(start);
    while (cursor <= due && guard < 500) {
      const occurrenceStart = new Date(cursor);
      const occurrenceEnd = addDuration(occurrenceStart, durationValue, durationUnit);
      if (occurrenceStart <= rangeEnd && occurrenceEnd >= rangeStart) windows.push({ start: occurrenceStart, end: occurrenceEnd });
      const nextCursor = advanceByRepeat(cursor, repeat.interval, repeat.unit);
      if (nextCursor.getTime() === cursor.getTime()) break;
      cursor = nextCursor;
      guard += 1;
    }
    return windows;
  }

  if (start && !due) {
    let cursor = new Date(start);
    while (cursor <= rangeEnd && guard < 500) {
      const occurrenceStart = new Date(cursor);
      const occurrenceEnd = addDuration(occurrenceStart, durationValue, durationUnit);
      if (occurrenceStart <= rangeEnd && occurrenceEnd >= rangeStart) windows.push({ start: occurrenceStart, end: occurrenceEnd });
      const nextCursor = advanceByRepeat(cursor, repeat.interval, repeat.unit);
      if (nextCursor.getTime() === cursor.getTime()) break;
      cursor = nextCursor;
      guard += 1;
    }
    return windows;
  }

  if (!start && due) {
    if (isNoteTask) {
      // 便條紙重複規則：以截止日期為 anchor，向後持續生成（無停止），僅以可視範圍裁切。
      let cursor = new Date(due);
      while (cursor <= rangeEnd && guard < 1000) {
        const occurrenceStart = new Date(cursor);
        const occurrenceEnd = toEndOfDay(occurrenceStart);
        if (occurrenceStart <= rangeEnd && occurrenceEnd >= rangeStart) windows.push({ start: occurrenceStart, end: occurrenceEnd });
        const nextCursor = advanceByRepeat(cursor, repeat.interval, repeat.unit);
        if (nextCursor.getTime() === cursor.getTime()) break;
        cursor = nextCursor;
        guard += 1;
      }
      return windows;
    }
    let cursor = new Date(due);
    while (cursor >= rangeStart && guard < 500) {
      const occurrenceStart = new Date(cursor);
      const occurrenceEnd = addDuration(occurrenceStart, durationValue, durationUnit);
      if (occurrenceStart <= rangeEnd && occurrenceEnd >= rangeStart) windows.push({ start: occurrenceStart, end: occurrenceEnd });
      const prevCursor = retreatByRepeat(cursor, repeat.interval, repeat.unit);
      if (prevCursor.getTime() === cursor.getTime()) break;
      cursor = prevCursor;
      guard += 1;
    }
    return windows.sort((a, b) => a.start - b.start);
  }

  return [];
};

const getTaskBarColor = (task, mode, getTagColor) => {
  if (mode === 'level') {
    const colors = { A: '#ff4d4d', B: '#ffa64d', C: '#4da6ff', D: '#4dff4d', NONE: '#808080' };
    return colors[task.levelType || task.level] || '#808080';
  }
  if (mode === 'priority') {
    if (task.priority === 'high') return '#f44336';
    if (task.priority === 'medium') return '#FF9800';
    if (task.priority === 'low') return '#4CAF50';
    return '#E0E0E0';
  }
  if (mode === 'custom' && task.tagId) return getTagColor(task.tagId) || '#E0E0E0';
  return task.status === 'completed' ? '#4CAF50' : '#E0E0E0';
};

/** 一次性任務邊框色（與項目管理日曆一致） */
const getBorderColor = (baseColor) => {
  if (!baseColor) return '#4fc8f5';
  let r, g, b;
  if (baseColor.startsWith('#')) {
    r = parseInt(baseColor.slice(1, 3), 16); g = parseInt(baseColor.slice(3, 5), 16); b = parseInt(baseColor.slice(5, 7), 16);
  } else if (baseColor.startsWith('rgb')) {
    const match = baseColor.match(/\d+/g); if (match) [r, g, b] = match.map(Number);
  }
  return r !== undefined ? `rgb(${Math.max(0, Math.floor(r * 0.85))}, ${Math.max(0, Math.floor(g * 0.85))}, ${Math.max(0, Math.floor(b * 0.85))})` : '#4fc8f5';
};

const loadUnifiedFilters = () => {
  try {
    const raw = localStorage.getItem(UNIFIED_CALENDAR_FILTERS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      statuses: Array.isArray(parsed.statuses) ? parsed.statuses.map(String) : [],
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities.map(String) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : []
    };
  } catch {
    return null;
  }
};

const getTooltipPosition = (mouseX, mouseY, tooltipWidth = 240, tooltipHeight = 140) => {
  const margin = 12;
  const offset = 15;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  let left = mouseX + offset;
  let top = mouseY + offset;

  if (left + tooltipWidth + margin > viewportWidth) {
    left = mouseX - tooltipWidth - offset;
  }
  if (top + tooltipHeight + margin > viewportHeight) {
    top = mouseY - tooltipHeight - offset;
  }

  left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));
  top = Math.max(margin, Math.min(top, viewportHeight - tooltipHeight - margin));
  return { left, top };
};

const findTaskByIdInTree = (nodes, taskId) => {
  const target = String(taskId);
  for (const node of (nodes || [])) {
    if (String(node.id) === target) return node;
    const found = findTaskByIdInTree(node.children || [], taskId);
    if (found) return found;
  }
  return null;
};

const addChildInTree = (nodes, parentId, childTask) => {
  if (String(parentId) === 'root') return [...(nodes || []), childTask];
  return (nodes || []).map((node) => {
    if (String(node.id) === String(parentId)) {
      return { ...node, children: [...(node.children || []), childTask] };
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      return { ...node, children: addChildInTree(node.children, parentId, childTask) };
    }
    return node;
  });
};

const UnifiedCalendarView = () => {
  const navigate = useNavigate();
  const [subCalendars, setSubCalendars] = React.useState(() => loadSubCalendars());
  const [selectedCalendarId, setSelectedCalendarId] = React.useState(() => loadLastViewedCalendarId());
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);
  const filterRef = React.useRef(null);
  const [hoverTooltip, setHoverTooltip] = React.useState({ visible: false, x: 0, y: 0, task: null });
  const [hoveredTaskId, setHoveredTaskId] = React.useState(null);
  const [projectTree, setProjectTree] = React.useState([]);
  const [noteTasks, setNoteTasks] = React.useState([]);
  const [taskTags, setTaskTags] = React.useState([]);
  const [hasLoadedInitialData, setHasLoadedInitialData] = React.useState(false);
  const [calendarDate, setCalendarDate] = React.useState(() => new Date());
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [selectedParent, setSelectedParent] = React.useState('root');
  const [newTask, setNewTask] = React.useState(() => createEmptyNewTask());
  const [layoutTemplates, setLayoutTemplates] = React.useState([]);
  const [calendarStyleMode, setCalendarStyleMode] = React.useState(() => {
    try {
      return localStorage.getItem(UNIFIED_CALENDAR_STYLE_KEY) === 'planner' ? 'planner' : 'monthly';
    } catch {
      return 'monthly';
    }
  });
  const [taskDisplayMode, setTaskDisplayMode] = React.useState(() => {
    try {
      return localStorage.getItem(UNIFIED_CALENDAR_DISPLAY_MODE_KEY) || 'default';
    } catch {
      return 'default';
    }
  });
  const initialStoredFiltersRef = React.useRef(loadUnifiedFilters());
  const hasInitializedDefaultFiltersRef = React.useRef(Boolean(initialStoredFiltersRef.current));
  const [calendarFilters, setCalendarFilters] = React.useState(() => initialStoredFiltersRef.current || {
    statuses: ['pending', 'completed'],
    priorities: ['none', 'high', 'medium', 'low'],
    tags: ['none']
  });

  React.useEffect(() => {
    const load = () => {
      try {
        const rawProject = localStorage.getItem('projectTasks');
        const parsedProject = rawProject ? JSON.parse(rawProject) : [];
        setProjectTree(Array.isArray(parsedProject) && parsedProject[0]?.children ? parsedProject[0].children : []);
      } catch {
        setProjectTree([]);
      }
      try {
        const rawNotes = localStorage.getItem('tasks');
        const parsedNotes = rawNotes ? JSON.parse(rawNotes) : [];
        setNoteTasks(Array.isArray(parsedNotes) ? parsedNotes : []);
      } catch {
        setNoteTasks([]);
      }
      try {
        const rawTags = localStorage.getItem('taskTags');
        const parsedTags = rawTags ? JSON.parse(rawTags) : [];
        setTaskTags(Array.isArray(parsedTags) ? parsedTags : []);
      } catch {
        setTaskTags([]);
      }
      setHasLoadedInitialData(true);
    };
    load();
    window.addEventListener('storage', load);
    window.addEventListener(PROJECT_TASKS_UPDATED_EVENT, load);
    window.addEventListener(TASK_TAGS_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(PROJECT_TASKS_UPDATED_EVENT, load);
      window.removeEventListener(TASK_TAGS_UPDATED_EVENT, load);
    };
  }, []);

  React.useEffect(() => { saveSubCalendars(subCalendars); }, [subCalendars]);
  React.useEffect(() => { saveLastViewedCalendarId(selectedCalendarId); }, [selectedCalendarId]);
  React.useEffect(() => { localStorage.setItem(UNIFIED_CALENDAR_STYLE_KEY, calendarStyleMode); }, [calendarStyleMode]);
  React.useEffect(() => { localStorage.setItem(UNIFIED_CALENDAR_DISPLAY_MODE_KEY, taskDisplayMode); }, [taskDisplayMode]);
  React.useEffect(() => { localStorage.setItem(UNIFIED_CALENDAR_FILTERS_KEY, JSON.stringify(calendarFilters)); }, [calendarFilters]);
  React.useEffect(() => {
    const loadLayoutTemplates = () => {
      try {
        const saved = localStorage.getItem(LAYOUT_TEMPLATE_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        setLayoutTemplates(Array.isArray(parsed) ? parsed : []);
      } catch {
        setLayoutTemplates([]);
      }
    };
    loadLayoutTemplates();
    if (showAddModal) loadLayoutTemplates();
  }, [showAddModal]);

  // 日曆不依 includeInViews 排除任務，顯示全部
  const projectTaskItems = React.useMemo(() => flattenProjectTasks(projectTree), [projectTree]);
  const noteTaskItems = React.useMemo(() => flattenNoteTasks(noteTasks), [noteTasks]);
  const allTaskItems = React.useMemo(() => [...projectTaskItems, ...noteTaskItems], [projectTaskItems, noteTaskItems]);
  const groupOptions = React.useMemo(
    () => projectTaskItems.map((item) => ({ id: item.groupId, title: item.title, depth: item.depth })),
    [projectTaskItems]
  );
  const taskOptions = React.useMemo(
    () => allTaskItems.map((item) => ({
      id: item.id,
      title: item.title,
      depth: Number.isFinite(item.depth) ? item.depth : 0,
      type: item.type
    })),
    [allTaskItems]
  );
  const statusFilterOptions = React.useMemo(() => ([
    { key: 'pending', label: '未完成' },
    { key: 'completed', label: '已完成' }
  ]), []);
  const priorityFilterOptions = React.useMemo(() => ([
    { key: 'none', label: '無優先級' },
    { key: 'high', label: '高' },
    { key: 'medium', label: '中' },
    { key: 'low', label: '低' }
  ]), []);
  const tagFilterOptions = React.useMemo(() => ([
    { key: 'none', label: '無屬性' },
    ...taskTags.map(tag => ({ key: String(tag.id), label: tag.name }))
  ]), [taskTags]);

  React.useEffect(() => {
    if (selectedCalendarId === 'all') return;
    if (!subCalendars.some((item) => item.id === selectedCalendarId)) {
      setSelectedCalendarId('all');
    }
  }, [selectedCalendarId, subCalendars]);

  React.useEffect(() => {
    if (!hasLoadedInitialData) return;
    const tagKeys = tagFilterOptions.map(opt => opt.key);
    setCalendarFilters((prev) => {
      const currentTags = Array.isArray(prev.tags) ? prev.tags.map(String) : [];
      const normalizedTags = currentTags.filter((tagId) => tagKeys.includes(tagId));
      if (!hasInitializedDefaultFiltersRef.current) {
        hasInitializedDefaultFiltersRef.current = true;
        return {
          statuses: ['pending', 'completed'],
          priorities: ['none', 'high', 'medium', 'low'],
          tags: [...tagKeys]
        };
      }
      if (normalizedTags.length === currentTags.length) return prev;
      return { ...prev, tags: normalizedTags };
    });
  }, [hasLoadedInitialData, tagFilterOptions]);

  React.useEffect(() => {
    if (!showFilterPanel) return undefined;
    const handleOutsideClick = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setShowFilterPanel(false);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showFilterPanel]);

  const activeSubCalendar = subCalendars.find((item) => item.id === selectedCalendarId);
  const subCalendarVisibleTasks = React.useMemo(() => {
    if (selectedCalendarId === 'all' || !activeSubCalendar) return allTaskItems;
    const groupSet = new Set(activeSubCalendar.selectedGroupIds || []);
    const taskSet = new Set(activeSubCalendar.selectedTaskIds || []);
    return allTaskItems.filter((item) => {
      if (taskSet.has(item.id)) return true;
      if (item.type !== 'project') return false;
      const inGroup = [item.groupId, ...(item.ancestors || [])].some((groupId) => groupSet.has(groupId));
      return inGroup;
    });
  }, [activeSubCalendar, allTaskItems, selectedCalendarId]);
  const getTagColor = React.useCallback((tagId) => {
    const tag = taskTags.find(item => String(item.id) === String(tagId));
    return tag?.color || '#E0E0E0';
  }, [taskTags]);
  const visibleTasks = React.useMemo(() => {
    return subCalendarVisibleTasks.filter((item) => {
      const task = item.task || {};
      const priority = String(task.priority || 'none');
      const tag = String(task.tagId || 'none');
      return (calendarFilters.priorities || []).map(String).includes(priority)
        && (calendarFilters.tags || []).map(String).includes(tag);
    });
  }, [subCalendarVisibleTasks, calendarFilters]);

  const occurrenceMatchesStatusFilter = React.useCallback((task, occurrenceStart, statuses) => {
    const s = (statuses || []).map(String);
    if (s.length === 0 || (s.includes('completed') && s.includes('pending'))) return true;
    const completed = isOccurrenceCompleted(task, occurrenceStart);
    return (completed && s.includes('completed')) || (!completed && s.includes('pending'));
  }, []);
  const allFilterValues = React.useMemo(() => ({
    statuses: statusFilterOptions.map(opt => String(opt.key)),
    priorities: priorityFilterOptions.map(opt => String(opt.key)),
    tags: tagFilterOptions.map(opt => String(opt.key))
  }), [priorityFilterOptions, statusFilterOptions, tagFilterOptions]);

  const matchesFilters = React.useCallback((task, filters) => {
    const status = String(task.status || 'pending');
    const priority = String(task.priority || 'none');
    const tag = String(task.tagId || 'none');
    return (filters.statuses || []).map(String).includes(status)
      && (filters.priorities || []).map(String).includes(priority)
      && (filters.tags || []).map(String).includes(tag);
  }, []);

  const getLinkedCount = React.useCallback((field, value) => {
    const target = String(value);
    return subCalendarVisibleTasks.filter((item) => {
      const task = item.task || {};
      const effectiveFilters = {
        statuses: field === 'statuses' ? allFilterValues.statuses : (calendarFilters.statuses || []).map(String),
        priorities: field === 'priorities' ? allFilterValues.priorities : (calendarFilters.priorities || []).map(String),
        tags: field === 'tags' ? allFilterValues.tags : (calendarFilters.tags || []).map(String)
      };
      if (!matchesFilters(task, effectiveFilters)) return false;
      if (field === 'statuses') return String(task.status || 'pending') === target;
      if (field === 'priorities') return String(task.priority || 'none') === target;
      return String(task.tagId || 'none') === target;
    }).length;
  }, [allFilterValues, calendarFilters.priorities, calendarFilters.statuses, calendarFilters.tags, matchesFilters, subCalendarVisibleTasks]);

  const toggleFilterValue = (field, value) => {
    setCalendarFilters(prev => {
      const current = prev[field] || [];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  };
  const selectAllFilters = () => {
    setCalendarFilters({
      statuses: allFilterValues.statuses,
      priorities: allFilterValues.priorities,
      tags: allFilterValues.tags
    });
  };
  const clearFilters = () => setCalendarFilters({ statuses: [], priorities: [], tags: [] });
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  const renderFilterPanel = () => (
    <div style={{ position: 'absolute', top: 34, right: 0, width: 320, background: '#fff', border: '1px solid #e1e5e9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', zIndex: 20, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: 13, color: '#333' }}>篩選</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={selectAllFilters} style={{ border: 'none', background: 'transparent', color: '#52D0FF', cursor: 'pointer', fontSize: 12 }}>全選</button>
          <button onClick={clearFilters} style={{ border: 'none', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: 12 }}>清除</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>狀態</div>
          {statusFilterOptions.map(opt => {
            const count = getLinkedCount('statuses', opt.key);
            const checked = (calendarFilters.statuses || []).map(String).includes(String(opt.key));
            return (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: count > 0 || checked ? '#333' : '#bbb', marginBottom: 4 }}>
                <input className="chart-filter-checkbox" type="checkbox" checked={checked} onChange={() => toggleFilterValue('statuses', String(opt.key))} disabled={!count && !checked} />
                <span>{opt.label} ({count})</span>
              </label>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>優先級</div>
          {priorityFilterOptions.map(opt => {
            const count = getLinkedCount('priorities', opt.key);
            const checked = (calendarFilters.priorities || []).map(String).includes(String(opt.key));
            return (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: count > 0 || checked ? '#333' : '#bbb', marginBottom: 4 }}>
                <input className="chart-filter-checkbox" type="checkbox" checked={checked} onChange={() => toggleFilterValue('priorities', String(opt.key))} disabled={!count && !checked} />
                <span>{opt.label} ({count})</span>
              </label>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>屬性</div>
          {tagFilterOptions.map(opt => {
            const count = getLinkedCount('tags', opt.key);
            const checked = (calendarFilters.tags || []).map(String).includes(String(opt.key));
            return (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: count > 0 || checked ? '#333' : '#bbb', marginBottom: 4 }}>
                <input className="chart-filter-checkbox" type="checkbox" checked={checked} onChange={() => toggleFilterValue('tags', String(opt.key))} disabled={!count && !checked} />
                <span>{opt.label} ({count})</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderCalendar = () => {
    const handleTaskBarClick = (event, task) => {
      event.stopPropagation();
      if (!task || !task.id) return;
      if (task._sourceType === 'note') {
        localStorage.setItem(OPEN_NOTE_TASK_KEY, JSON.stringify({ taskId: String(task.id), at: Date.now() }));
        navigate('/');
        return;
      }
      localStorage.setItem(OPEN_PROJECT_TASK_KEY, JSON.stringify({ taskId: String(task.id), at: Date.now() }));
      navigate('/projects');
    };
    const handleTaskMouseEnter = (event, task) => {
      setHoverTooltip({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        task
      });
      setHoveredTaskId(task?.id != null ? String(task.id) : null);
    };
    const handleTaskMouseMove = (event) => {
      setHoverTooltip((prev) => prev.visible ? { ...prev, x: event.clientX, y: event.clientY } : prev);
    };
    const handleTaskMouseLeave = () => {
      setHoverTooltip({ visible: false, x: 0, y: 0, task: null });
      setHoveredTaskId(null);
    };

    const tasks = visibleTasks.map(item => item.task);
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const gridStart = new Date(year, month, 1 - firstDayOfWeek);
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
    const calendarDays = Array.from({ length: totalCells }, (_, idx) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + idx);
      return { day: date.getDate(), date, isToday: date.toDateString() === new Date().toDateString(), isCurrentMonth: date.getMonth() === month };
    });
    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7));

    if (calendarStyleMode === 'planner') {
      const plannerMonths = Array.from({ length: 6 }, (_, idx) => new Date(year, month + idx, 1));
      const plannerStart = new Date(plannerMonths[0].getFullYear(), plannerMonths[0].getMonth(), 1, 0, 0, 0, 0);
      const plannerEnd = new Date(plannerMonths[5].getFullYear(), plannerMonths[5].getMonth() + 1, 0, 23, 59, 59, 999);
      const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
      const getDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayTaskMap = new Map();
      const calStatuses = (calendarFilters?.statuses || []).map(String);
      tasks.forEach((task) => {
        const windows = getTaskDisplayWindows(task, plannerStart, plannerEnd);
        windows.forEach((window, idx) => {
          if (!occurrenceMatchesStatusFilter(task, window.start, calStatuses)) return;
          const startDay = new Date(window.start);
          startDay.setHours(0, 0, 0, 0);
          const endDay = new Date(window.end);
          endDay.setHours(0, 0, 0, 0);
          let cursor = new Date(startDay);
          let guard = 0;
          while (cursor <= endDay && guard < 370) {
            if (cursor >= plannerStart && cursor <= plannerEnd) {
              const key = getDateKey(cursor);
              const list = dayTaskMap.get(key) || [];
              list.push({
                ...task,
                _instanceKey: `${task.id}-planner-${window.start.getTime()}-${idx}`,
                _plannerColor: getTaskBarColor(task, taskDisplayMode, getTagColor)
              });
              dayTaskMap.set(key, list);
            }
            cursor.setDate(cursor.getDate() + 1);
            guard += 1;
          }
        });
      });
      const plannerMonthMeta = plannerMonths.map((mDate) => {
        const y = mDate.getFullYear();
        const m = mDate.getMonth();
        return { year: y, month: m, startDow: new Date(y, m, 1).getDay(), daysInMonth: new Date(y, m + 1, 0).getDate() };
      });
      const plannerRowCount = Math.max(...plannerMonthMeta.map(meta => meta.startDow + meta.daysInMonth));

      return (
        <div style={{ border: '1px solid #d8dde3', background: '#fff', borderRadius: 6, overflowX: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, minmax(0, 1fr))', borderBottom: '1px solid #d8dde3', background: '#f8f9fb' }}>
            <div style={{ height: 36, borderRight: '1px solid #d8dde3' }} />
            {plannerMonths.map((mDate) => (
              <div key={`${mDate.getFullYear()}-${mDate.getMonth()}`} style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#3a4350', borderRight: '1px solid #d8dde3' }}>
                {monthNames[mDate.getMonth()]}
              </div>
            ))}
          </div>
          {Array.from({ length: plannerRowCount }, (_, rowIdx) => {
            const rowTaskMax = Math.max(1, ...plannerMonthMeta.map((meta) => {
              const dayNum = rowIdx - meta.startDow + 1;
              if (dayNum < 1 || dayNum > meta.daysInMonth) return 0;
              const candidate = new Date(meta.year, meta.month, dayNum);
              return (dayTaskMap.get(getDateKey(candidate)) || []).length;
            }));
            const rowHeight = 22 + (rowTaskMax * 22);
            return (
              <div key={`planner-row-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, minmax(0, 1fr))', borderBottom: rowIdx < plannerRowCount - 1 ? '1px solid #eef1f4' : 'none' }}>
                <div style={{ minHeight: rowHeight, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontSize: 12, color: '#5d6775', borderRight: '1px solid #d8dde3', background: rowIdx % 2 === 0 ? '#fbfcfd' : '#fff', paddingTop: 8, boxSizing: 'border-box' }}>
                  <span style={{ width: 12, textAlign: 'center', fontWeight: 600 }}>{weekdayNames[rowIdx % 7]}</span>
                </div>
                {plannerMonthMeta.map((meta, colIdx) => {
                  const dayNum = rowIdx - meta.startDow + 1;
                  const inMonth = dayNum >= 1 && dayNum <= meta.daysInMonth;
                  const candidate = inMonth ? new Date(meta.year, meta.month, dayNum) : null;
                  const dayTasks = inMonth ? (dayTaskMap.get(getDateKey(candidate)) || []) : [];
                  return (
                    <div key={`planner-cell-${rowIdx}-${colIdx}`} style={{ minHeight: rowHeight, borderRight: colIdx < plannerMonths.length - 1 ? '1px solid #eef1f4' : 'none', padding: '3px 5px', background: inMonth ? '#fff' : '#f7f8fa', boxSizing: 'border-box' }}>
                      {inMonth ? (
                        <div onClick={() => openAddTaskFromCalendar(candidate)} style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', cursor: 'pointer' }}>
                          <div style={{ fontSize: 11, color: candidate.toDateString() === new Date().toDateString() ? '#52D0FF' : '#637086', fontWeight: candidate.toDateString() === new Date().toDateString() ? 700 : 500 }}>{dayNum}</div>
                          {dayTasks.map(task => (
                            (() => {
                              const isHovered = hoveredTaskId != null && String(task.id) === hoveredTaskId;
                              const color = task._plannerColor;
                              const isOneTime = task.taskType === 'one-time';
                              return (
                            <div
                              key={`${task._instanceKey}-${task.id}`}
                              onClick={(event) => handleTaskBarClick(event, task)}
                              onMouseEnter={(event) => handleTaskMouseEnter(event, task)}
                              onMouseMove={handleTaskMouseMove}
                              onMouseLeave={handleTaskMouseLeave}
                              style={{ fontSize: 11, lineHeight: '16px', borderRadius: 3, padding: '0 4px', background: color, border: isOneTime ? `2px solid ${getBorderColor(color)}` : 'none', color: color === '#E0E0E0' ? '#333' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: isHovered ? '0 4px 8px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)', filter: isHovered ? 'brightness(1.1)' : 'none', transform: isHovered ? 'scaleY(1.08)' : 'none', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                              );
                            })()
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    }

    const weekData = weeks.map((week) => {
      const weekStart = new Date(week[0].date);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const calStatuses = (calendarFilters?.statuses || []).map(String);
      const visibleInWeek = tasks.flatMap((task) =>
        getTaskDisplayWindows(task, weekStart, weekEnd)
          .filter((window) => occurrenceMatchesStatusFilter(task, window.start, calStatuses))
          .map((window, idx) => ({
            ...task,
            startDate: window.start,
            endDate: window.end,
            _instanceKey: `${task.id}-cal-${window.start.getTime()}-${idx}`
          }))
      ).filter(t => t.startDate <= weekEnd && t.endDate >= weekStart);
      const usedLayers = new Map();
      const layeredSegments = visibleInWeek.sort((a, b) => a.startDate - b.startDate).map(task => {
        const actualStart = task.startDate < weekStart ? weekStart : task.startDate;
        const actualEnd = task.endDate > weekEnd ? weekEnd : task.endDate;
        const startCol = actualStart.getDay();
        const endCol = actualEnd.getDay();
        const span = endCol - startCol + 1;
        let layer = 0;
        while (true) {
          let canUse = true;
          for (let c = startCol; c <= endCol; c++) {
            if (usedLayers.has(`${c}-${layer}`)) { canUse = false; break; }
          }
          if (canUse) {
            for (let c = startCol; c <= endCol; c++) usedLayers.set(`${c}-${layer}`, true);
            return { ...task, startCol, span, layer };
          }
          layer += 1;
        }
      });
      const maxLayer = layeredSegments.length > 0 ? Math.max(...layeredSegments.map(s => s.layer)) + 1 : 0;
      return { week, layeredSegments, rowHeight: maxLayer <= 3 ? 100 : 30 + (maxLayer * 24) + 10 };
    });

    return (
      <div style={{ border: '1px solid #d8dde3', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f9fb', borderBottom: '1px solid #d8dde3' }}>
          {['日', '一', '二', '三', '四', '五', '六'].map(name => <div key={name} style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: '#667' }}>{name}</div>)}
        </div>
        {weekData.map((row, rowIdx) => (
          <div key={`week-${rowIdx}`} style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: row.rowHeight, borderBottom: rowIdx < weekData.length - 1 ? '1px solid #edf1f5' : 'none' }}>
            {row.week.map((cell) => (
              <div key={cell.date.toISOString()} onClick={() => openAddTaskFromCalendar(cell.date)} style={{ borderRight: '1px solid #f2f5f8', padding: '4px 6px', background: cell.isCurrentMonth ? '#fff' : '#f7f8fa', cursor: 'pointer' }}>
                <div style={{ fontSize: 12, color: cell.isToday ? '#52D0FF' : (cell.isCurrentMonth ? '#4b5563' : '#9aa4b2'), fontWeight: cell.isToday ? 700 : 500 }}>{cell.day}</div>
              </div>
            ))}
            {row.layeredSegments.map((seg) => (
              (() => {
                const isHovered = hoveredTaskId != null && String(seg.id) === hoveredTaskId;
                const color = getTaskBarColor(seg, taskDisplayMode, getTagColor);
                const isOneTime = seg.taskType === 'one-time';
                return (
              <div key={seg._instanceKey} style={{ position: 'absolute', left: `${(seg.startCol / 7) * 100}%`, width: `${(seg.span / 7) * 100}%`, top: 24 + seg.layer * 22, padding: '0 4px', boxSizing: 'border-box' }}>
                <div
                  onClick={(event) => handleTaskBarClick(event, seg)}
                  onMouseEnter={(event) => handleTaskMouseEnter(event, seg)}
                  onMouseMove={handleTaskMouseMove}
                  onMouseLeave={handleTaskMouseLeave}
                  style={{ height: 18, borderRadius: 4, fontSize: 11, lineHeight: '18px', padding: '0 6px', background: color, border: isOneTime ? `2px solid ${getBorderColor(color)}` : 'none', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: isHovered ? '0 4px 8px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)', filter: isHovered ? 'brightness(1.1)' : 'none', transform: isHovered ? 'scaleY(1.1)' : 'none', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                  title={seg.title}
                >
                  {seg.title}
                </div>
              </div>
                );
              })()
            ))}
          </div>
        ))}
      </div>
    );
  };

  const saveProjectChildren = React.useCallback((nextChildren) => {
    try {
      const raw = localStorage.getItem('projectTasks');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const rootIndex = parsed.findIndex(item => String(item.id) === 'root');
        if (rootIndex >= 0) {
          const next = [...parsed];
          next[rootIndex] = { ...next[rootIndex], children: nextChildren };
          localStorage.setItem('projectTasks', JSON.stringify(next));
        } else {
          localStorage.setItem('projectTasks', JSON.stringify([{ id: 'root', title: 'Root', isHidden: true, children: nextChildren }]));
        }
      } else {
        localStorage.setItem('projectTasks', JSON.stringify([{ id: 'root', title: 'Root', isHidden: true, children: nextChildren }]));
      }
    } catch (error) {
      console.error('Failed to save project tasks from unified calendar:', error);
    }
    setProjectTree(nextChildren);
  }, []);

  const handleAddTask = React.useCallback(() => {
    if (!newTask.title.trim()) return;
    const parentTask = selectedParent === 'root' ? null : findTaskByIdInTree(projectTree, selectedParent);
    const levelScale = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const parentLevel = parentTask?.level || parentTask?.levelType || 'A';
    const parentIdx = Math.max(0, levelScale.indexOf(parentLevel));
    const autoLevel = selectedParent === 'root' ? 'A' : (levelScale[Math.min(levelScale.length - 1, parentIdx + 1)] || 'A');
    const newTaskId = Date.now().toString();
    const combineDateTime = (dateStr, timeStr, fallbackTime) => {
      if (!dateStr) return null;
      const finalTime = timeStr || fallbackTime;
      if (!finalTime) return dateStr;
      const [hh = '00', mm = '00'] = finalTime.split(':');
      return `${dateStr}T${hh}:${mm}:00`;
    };
    const startDateISO = combineDateTime(newTask.startDate, newTask.startTime, '00:00');
    const dueDateISO = combineDateTime(newTask.dueDate, newTask.dueTime, '23:59');
    const resolvedTagId = (() => {
      if (!newTask.tagId || newTask.tagId === '__inherit__') return parentTask?.tagId || null;
      if (newTask.tagId === '__none__') return null;
      return newTask.tagId;
    })();
    const newTaskObj = {
      id: newTaskId,
      title: newTask.title,
      description: newTask.description,
      level: autoLevel,
      levelType: autoLevel,
      status: 'pending',
      created: new Date().toISOString(),
      tagId: resolvedTagId,
      children: [],
      details: {
        progress: 0,
        repeat: { ...DEFAULT_REPEAT },
        startDate: startDateISO,
        startTime: newTask.startTime || '00:00',
        dueDate: dueDateISO,
        dueTime: newTask.dueTime || '23:59'
      }
    };
    const nextChildren = addChildInTree(projectTree, selectedParent, newTaskObj);
    saveProjectChildren(nextChildren);
    if (selectedCalendarId !== 'all') {
      const newTaskSelectionId = `project:${newTaskId}`;
      setSubCalendars((prev) => prev.map((calendar) => {
        if (calendar.id !== selectedCalendarId) return calendar;
        const selectedTaskIds = Array.isArray(calendar.selectedTaskIds) ? calendar.selectedTaskIds : [];
        if (selectedTaskIds.includes(newTaskSelectionId)) return calendar;
        return { ...calendar, selectedTaskIds: [...selectedTaskIds, newTaskSelectionId] };
      }));
    }
    if (newTask.layoutTemplateId) {
      const selectedLayoutTemplate = layoutTemplates.find(t => t.id === newTask.layoutTemplateId);
      if (selectedLayoutTemplate) {
        try {
          localStorage.setItem(
            `${TASK_LAYOUT_STORAGE_PREFIX}.${newTaskId}`,
            JSON.stringify({
              order: selectedLayoutTemplate.order || [],
              hidden: selectedLayoutTemplate.hidden || []
            })
          );
        } catch (error) {
          console.error('Failed to apply layout template on create (unified calendar):', error);
        }
      }
    }
    setShowAddModal(false);
    setSelectedParent('root');
    setNewTask(createEmptyNewTask());
  }, [layoutTemplates, newTask, projectTree, saveProjectChildren, selectedCalendarId, selectedParent]);

  const openAddTaskFromCalendar = React.useCallback((date) => {
    if (!date) return;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    setSelectedParent('root');
    setNewTask({
      ...createEmptyNewTask(),
      startDate: dateStr,
      startTime: '00:00',
      dueDate: dateStr,
      dueTime: '23:59'
    });
    setShowAddModal(true);
  }, []);

  return (
    <div className="unified-calendar-page">
      <div className="unified-calendar-card">
        <h2 style={{ margin: '0 0 8px 0' }}>總日曆</h2>
        <SubCalendarTabs
          subCalendars={subCalendars}
          selectedId={selectedCalendarId}
          onSelect={setSelectedCalendarId}
          onOpenManage={() => setEditorOpen(true)}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - (calendarStyleMode === 'planner' ? 6 : 1), 1))} style={{ background: '#52D0FF', color: '#fff', border: 'none', borderRadius: 4, width: 32, height: 32, cursor: 'pointer' }}>←</button>
            <div style={{ minWidth: 210, textAlign: 'center', fontWeight: 600 }}>
              {calendarStyleMode === 'planner'
                ? `${calendarDate.getFullYear()}年${calendarDate.getMonth() + 1}月 - ${new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 5, 1).getFullYear()}年${new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 5, 1).getMonth() + 1}月`
                : `${calendarDate.getFullYear()}年${calendarDate.getMonth() + 1}月`}
            </div>
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + (calendarStyleMode === 'planner' ? 6 : 1), 1))} style={{ background: '#52D0FF', color: '#fff', border: 'none', borderRadius: 4, width: 32, height: 32, cursor: 'pointer' }}>→</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => setCalendarStyleMode(prev => prev === 'planner' ? 'monthly' : 'planner')} style={{ border: '1px solid #dbe3ec', borderRadius: 8, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>
              樣式：{calendarStyleMode === 'planner' ? '年計畫表' : '月格'}
            </button>
            <button type="button" onClick={() => setShowFilterPanel(prev => !prev)} style={{ border: '1px solid #dbe3ec', borderRadius: 8, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>
              篩選
            </button>
            <div className="gantt-display-mode-control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: '#666' }}>任務條顯示:</label>
              <select value={taskDisplayMode} onChange={(e) => setTaskDisplayMode(e.target.value)} style={{ padding: '4px 12px', border: '1px solid #E8EDF2', borderRadius: 4, fontSize: 12, cursor: 'pointer', backgroundColor: 'white' }}>
                <option value="default">預設</option>
                <option value="level">層級</option>
                <option value="priority">優先級</option>
                <option value="custom">屬性</option>
              </select>
            </div>
          </div>
          {showFilterPanel && (
            <div ref={filterRef}>
              {renderFilterPanel()}
            </div>
          )}
        </div>
        {visibleTasks.length > 0 ? renderCalendar() : <div className="unified-calendar-empty">目前子日曆沒有選到任務。</div>}
      </div>

      <SubCalendarEditorModal
        open={editorOpen}
        subCalendars={subCalendars}
        setSubCalendars={setSubCalendars}
        onClose={() => setEditorOpen(false)}
        groupOptions={groupOptions}
        taskOptions={taskOptions}
      />
      {hoverTooltip.visible && hoverTooltip.task && (
        (() => {
          const pos = getTooltipPosition(hoverTooltip.x, hoverTooltip.y, 240, 150);
          const tooltipDescription = hoverTooltip.task.description || hoverTooltip.task?.details?.description || '';
          return (
            <div className="task-hover-tooltip" style={{ position: 'fixed', left: `${pos.left}px`, top: `${pos.top}px`, zIndex: 10000, pointerEvents: 'none' }}>
              <div className="tooltip-content" style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '12px', width: '240px', fontSize: '12px' }}>
                <div className="tooltip-header" style={{ fontWeight: 'bold', marginBottom: '4px' }}>{hoverTooltip.task.title || '未命名任務'}</div>
                {hoverTooltip.task?.details?.dueDate && (
                  <div className="tooltip-date" style={{ color: '#666', fontSize: '11px' }}>
                    截止: {new Date(hoverTooltip.task.details.dueDate).toLocaleString()}
                  </div>
                )}
                {tooltipDescription && (
                  <div
                    className="tooltip-description"
                    style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px', color: '#555', maxHeight: '80px', overflow: 'hidden' }}
                    dangerouslySetInnerHTML={{ __html: tooltipDescription }}
                  />
                )}
              </div>
            </div>
          );
        })()
      )}
      <AddTaskModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTask}
        newTask={newTask}
        setNewTask={setNewTask}
        selectedParent={selectedParent}
        setSelectedParent={setSelectedParent}
        tasks={[{ id: 'root', title: 'Root', children: projectTree, isHidden: true }]}
        taskTags={taskTags}
        layoutTemplates={layoutTemplates}
      />
    </div>
  );
};

export default UnifiedCalendarView;
