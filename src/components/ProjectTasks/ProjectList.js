import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { IoAdd, IoChevronDown, IoClose, IoCloudDownloadOutline } from 'react-icons/io5';
import { BsTrash } from 'react-icons/bs';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ProjectTasks.css';
import * as TaskUtils from './taskUtils';
import TaskDetailPanel from './TaskDetailPanel';
import AddTaskModal from './AddTaskModal';
import { DEFAULT_ICONS } from '../TaskComponents/IconSelector/defaultIcons';
import { useTaskCapsules } from '../../hooks/useTaskCapsules';
import { useTaskRepeat } from '../../hooks/useTaskRepeat';
import { useTaskTemplates } from '../../hooks/useTaskTemplates';
import { useTaskReminders } from '../../hooks/useTaskReminders';
import RepeatLogModal from './SubPanels/RepeatLogModal';
import TemplateModal from './SubPanels/TemplateModal';
import { PROJECT_TASKS_UPDATED_EVENT, TASK_TAGS_UPDATED_EVENT } from '../GlobalAddTaskModal';
import { resetTaskTreeIfNeeded, getLocalDateKeyForRepeat } from '../../utils/projectTaskRepeatUtils';

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
const LAYOUT_TEMPLATE_STORAGE_KEY = 'taskDetailLayout.templates.v1';
const TASK_LAYOUT_STORAGE_PREFIX = 'taskDetailLayout.v3.task';
const TYPE_LAYOUT_STORAGE_PREFIX = 'taskDetailLayout.v2';
const TASK_CAPSULE_STATES_KEY = 'taskCapsuleStates';
const TASK_INSERT_TOOLBAR_COLLAPSED_PREFIX = 'taskInsertToolbarCollapsed.v1.task';
const GANTT_DISPLAY_MODE_STORAGE_KEY = 'taskGanttDisplayMode.v1';
const GANTT_DAY_COLUMN_WIDTH_STORAGE_KEY = 'taskGanttDayColumnWidth.v1';
const GANTT_ZOOM_STORAGE_KEY = 'taskGanttZoom.v1';
const OPEN_PROJECT_TASK_KEY = 'unifiedCalendar.openProjectTask.v1';
const OVERVIEW_FILTER_STORAGE_KEY = 'taskOverviewFilters.v1';
const GANTT_FILTER_STORAGE_KEY = 'taskGanttFilters.v1';
const CALENDAR_FILTER_STORAGE_KEY = 'taskCalendarFilters.v1';
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

const CountdownTimer = ({ dueDate }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      let finalDueDateStr = dueDate;
      if (finalDueDateStr && finalDueDateStr.length === 10) {
        finalDueDateStr += 'T23:59:59';
      }
      const due = new Date(finalDueDateStr);
      const diff = due - now;

      if (diff <= 0) return '已到期';

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) return `剩餘 ${days} 天`;
      if (hours > 0) return `剩餘 ${hours} 小時 ${minutes} 分鐘`;
      if (minutes > 0) return `剩餘 ${minutes} 分鐘 ${seconds} 秒`;
        return `剩餘 ${seconds} 秒`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [dueDate]);

  return <div style={{ fontSize: '11px', color: '#52D0FF', fontWeight: 'bold', marginTop: '4px' }}>{timeLeft}</div>;
};

const TREE_INDENT_PX = 32;
const DROP_ZONE_TOP = 0.28;
const DROP_ZONE_BOTTOM = 0.72;
const NEST_RIGHT_THRESHOLD_PX = 36;

const flattenTree = (nodes, parentId = 'root', depth = 0) => {
  if (!Array.isArray(nodes)) return [];
  return nodes.reduce((acc, node) => {
    const id = String(node.id);
    acc.push({ id, parentId: String(parentId), depth, task: node });
    if (Array.isArray(node.children) && node.children.length > 0) {
      acc.push(...flattenTree(node.children, id, depth + 1));
    }
    return acc;
  }, []);
};

const filterVisibleFlat = (flatItems, expandedItems) => {
  const visible = [];
  let hiddenDepth = null;
  for (const item of flatItems) {
    if (hiddenDepth !== null) {
      if (item.depth > hiddenDepth) continue;
      hiddenDepth = null;
    }
    visible.push(item);
    const hasChildren = Array.isArray(item.task.children) && item.task.children.length > 0;
    if (hasChildren && !expandedItems.has(item.id)) {
      hiddenDepth = item.depth;
    }
  }
  return visible;
};

const buildTreeFromFlat = (flatItems) => {
  const nodeMap = new Map();
  const roots = [];

  flatItems.forEach((item) => {
    nodeMap.set(String(item.id), { ...item.task, children: [] });
  });

  flatItems.forEach((item) => {
    const id = String(item.id);
    const parentId = String(item.parentId || 'root');
    const node = nodeMap.get(id);
    if (!node) return;

    if (parentId === 'root') {
      roots.push(node);
      return;
    }

    const parentNode = nodeMap.get(parentId);
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      // 保底：若父節點不存在，放回根層避免任務消失
      roots.push(node);
    }
  });

  return roots;
};

const findSubtreeEndIndex = (flatItems, startIndex) => {
  const baseDepth = flatItems[startIndex]?.depth ?? 0;
  let end = startIndex;
  while (end + 1 < flatItems.length && flatItems[end + 1].depth > baseDepth) end += 1;
  return end;
};

const isDescendantOf = (flatItems, ancestorId, candidateId) => {
  const map = new Map(flatItems.map(item => [item.id, item.parentId]));
  let current = String(candidateId);
  const ancestor = String(ancestorId);
  while (map.has(current)) {
    const parent = map.get(current);
    if (!parent) return false;
    if (parent === ancestor) return true;
    if (parent === 'root') return false;
    current = parent;
  }
      return false;
};

const moveFlatSubtree = (flatItems, activeId, overId, mode = 'before') => {
  const activeIndex = flatItems.findIndex(item => item.id === String(activeId));
  const overIndex = flatItems.findIndex(item => item.id === String(overId));
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return flatItems;

  const activeDepth = flatItems[activeIndex].depth;
  let endIndex = activeIndex + 1;
  while (endIndex < flatItems.length && flatItems[endIndex].depth > activeDepth) endIndex += 1;

  const block = flatItems.slice(activeIndex, endIndex);
  const rest = [...flatItems.slice(0, activeIndex), ...flatItems.slice(endIndex)];
  const targetIndex = rest.findIndex(item => item.id === String(overId));
  if (targetIndex < 0) return flatItems;
  let insertIndex = targetIndex; // before
  if (mode === 'inside') {
    // 放入 over 作為其子任務時，必須緊跟在 over 後面，確保父節點先出現
    insertIndex = targetIndex + 1;
  } else if (mode === 'after') {
    const targetEndInRest = findSubtreeEndIndex(rest, targetIndex);
    insertIndex = targetEndInRest + 1;
  }
  return [...rest.slice(0, insertIndex), ...block, ...rest.slice(insertIndex)];
};

const insertSiblingAfterTask = (nodes, targetId, newTask) => {
  if (!Array.isArray(nodes) || !newTask) return nodes;
  const target = String(targetId);
  const directIndex = nodes.findIndex(item => String(item.id) === target);
  if (directIndex >= 0) {
    const next = [...nodes];
    next.splice(directIndex + 1, 0, newTask);
    return next;
  }
  let changed = false;
  const next = nodes.map((node) => {
    if (!Array.isArray(node.children) || node.children.length === 0) return node;
    const updatedChildren = insertSiblingAfterTask(node.children, targetId, newTask);
    if (updatedChildren !== node.children) {
      changed = true;
      return { ...node, children: updatedChildren };
    }
    return node;
  });
  return changed ? next : nodes;
};

const cloneTaskSubtreeWithNewIds = (task, idMap = new Map()) => {
  if (!task) return null;
  const cloned = JSON.parse(JSON.stringify(task));
  let seed = 0;
  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${seed++}`;
  const remap = (node) => {
    const oldId = String(node.id);
    const nextId = genId();
    node.id = nextId;
    idMap.set(oldId, nextId);
    node.children = Array.isArray(node.children) ? node.children.map(remap) : [];
    return node;
  };
  const clonedRoot = remap(cloned);
  return { clonedRoot, idMap };
};

const buildTaskMetaMap = (task, map = new Map()) => {
  if (!task) return map;
  const id = String(task.id);
  map.set(id, { taskType: task.taskType || 'default' });
  (task.children || []).forEach(child => buildTaskMetaMap(child, map));
  return map;
};

const SortableTaskRow = ({ item, isDraggingTree, renderTaskVisual }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${item.depth * TREE_INDENT_PX}px`
  };
    return (
      <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`project-item level-${String(item.task.level || 'A').toLowerCase()} ${isDragging ? 'is-phantom' : ''}`}
    >
      {renderTaskVisual(item.task, isDraggingTree)}
      </div>
    );
  };
  
const ProjectList = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // --- 1. 核心數據狀態 ---
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('projectTasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error("Error loading tasks", e); }
    }
    return [{ id: 'root', title: 'Root', children: [], isHidden: true, details: { repeat: { ...DEFAULT_REPEAT } } }];
  });

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set(['root']));
  const [activeTab, setActiveTab] = useState('details');
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsedState] = useState(false);
  const setToolbarCollapsed = useCallback((valueOrUpdater) => {
    setToolbarCollapsedState(prev => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      if (selectedTaskId) {
        try { localStorage.setItem(`${TASK_INSERT_TOOLBAR_COLLAPSED_PREFIX}.${selectedTaskId}`, String(next)); } catch (e) { /* ignore */ }
      }
      return next;
    });
  }, [selectedTaskId]);

  useEffect(() => {
    if (!selectedTaskId) return;
    try {
      const saved = localStorage.getItem(`${TASK_INSERT_TOOLBAR_COLLAPSED_PREFIX}.${selectedTaskId}`);
      setToolbarCollapsedState(saved === 'true');
    } catch (e) { setToolbarCollapsedState(false); }
  }, [selectedTaskId]);

  // 拖曳與右鍵狀態
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  const [overDragId, setOverDragId] = useState(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dropPosition, setDropPosition] = useState('before');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, taskId: null, taskTitle: '' });

  // 篩選與排序
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [tagFilterDropdownOpen, setTagFilterDropdownOpen] = useState(false);
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  
  // 屬性與標籤
  const [taskTags, setTaskTags] = useState(() => {
    const saved = localStorage.getItem('taskTags');
    const parsed = saved ? JSON.parse(saved) : [
      { id: 'tag-1', name: '工作', color: 'rgb(156, 39, 176)' },
      { id: 'tag-2', name: '遊玩', color: 'rgb(255, 193, 7)' },
      { id: 'tag-3', name: '學習', color: 'rgb(33, 150, 243)' }
    ];
    return Array.isArray(parsed) ? parsed.map(t => ({ ...t, includeInViews: t.includeInViews !== false })) : parsed;
  });
  const [overviewFilters, setOverviewFilters] = useState(() => {
    const tagList = (() => { try { const s = localStorage.getItem('taskTags'); return s ? JSON.parse(s) : []; } catch (e) { return []; } })();
    const defaults = { statuses: ['pending', 'completed'], priorities: ['none', 'high', 'medium', 'low'], tags: ['none', ...tagList.map(t => t.id)] };
    try {
      const saved = localStorage.getItem(OVERVIEW_FILTER_STORAGE_KEY);
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return defaults;
      return { statuses: Array.isArray(parsed.statuses) ? parsed.statuses : defaults.statuses, priorities: Array.isArray(parsed.priorities) ? parsed.priorities : defaults.priorities, tags: Array.isArray(parsed.tags) ? parsed.tags : defaults.tags };
    } catch (e) { return defaults; }
  });
  const [ganttFilters, setGanttFilters] = useState(() => {
    const tagList = (() => { try { const s = localStorage.getItem('taskTags'); return s ? JSON.parse(s) : []; } catch (e) { return []; } })();
    const defaults = { statuses: ['pending', 'completed'], priorities: ['none', 'high', 'medium', 'low'], tags: ['none', ...tagList.map(t => t.id)] };
    try {
      const saved = localStorage.getItem(GANTT_FILTER_STORAGE_KEY);
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return defaults;
      return { statuses: Array.isArray(parsed.statuses) ? parsed.statuses : defaults.statuses, priorities: Array.isArray(parsed.priorities) ? parsed.priorities : defaults.priorities, tags: Array.isArray(parsed.tags) ? parsed.tags : defaults.tags };
    } catch (e) { return defaults; }
  });
  const [calendarFilters, setCalendarFilters] = useState(() => {
    const tagList = (() => { try { const s = localStorage.getItem('taskTags'); return s ? JSON.parse(s) : []; } catch (e) { return []; } })();
    const defaults = { statuses: ['pending', 'completed'], priorities: ['none', 'high', 'medium', 'low'], tags: ['none', ...tagList.map(t => t.id)] };
    try {
      const saved = localStorage.getItem(CALENDAR_FILTER_STORAGE_KEY);
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return defaults;
      return { statuses: Array.isArray(parsed.statuses) ? parsed.statuses : defaults.statuses, priorities: Array.isArray(parsed.priorities) ? parsed.priorities : defaults.priorities, tags: Array.isArray(parsed.tags) ? parsed.tags : defaults.tags };
    } catch (e) { return defaults; }
  });
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('rgb(156, 39, 176)');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('');

  // 視圖狀態
  const [ganttZoom, setGanttZoom] = useState(() => {
    try {
      const saved = localStorage.getItem(GANTT_ZOOM_STORAGE_KEY);
      if (saved && ['day', 'week', 'month'].includes(saved)) return saved;
    } catch (error) {
      console.error('Error loading gantt zoom mode:', error);
    }
    return 'month';
  });
  const [ganttTaskDisplayMode, setGanttTaskDisplayMode] = useState(() => {
    try {
      const saved = localStorage.getItem(GANTT_DISPLAY_MODE_STORAGE_KEY);
      if (saved && ['default', 'level', 'priority', 'custom'].includes(saved)) return saved;
    } catch (error) {
      console.error('Error loading gantt display mode:', error);
    }
    return 'default';
  });
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [dayViewDate, setDayViewDate] = useState(new Date());
  const [ganttColumnWidth, setGanttColumnWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(GANTT_DAY_COLUMN_WIDTH_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 20 && saved <= 160) return saved;
    } catch (error) {
      console.error('Error loading gantt day column width:', error);
    }
    return 100;
  });

  // --- 2. 基礎工具函數 ---
  const getLocalDateKey = useCallback((d, unit = 'day') => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    if (unit === 'minute') {
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}-${hour}-${minute}`;
    }
    if (unit === 'week') {
      // 獲取該日期所在週的週一
      const date = new Date(d);
      const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 調整到週一
      const monday = new Date(date.setDate(diff));
      return `W-${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    }
    if (unit === 'month') {
      return `M-${year}-${month}`;
    }
    if (unit === 'year') {
      return `Y-${year}`;
    }
    return `${year}-${month}-${day}`;
  }, []);

  const updateTasksAndSave = useCallback((updateFn) => {
    setTasks(prev => {
      const next = typeof updateFn === 'function' ? updateFn(prev) : updateFn;
      localStorage.setItem('projectTasks', JSON.stringify(next));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PROJECT_TASKS_UPDATED_EVENT));
      }
      return next;
    });
  }, []);

  // 初次載入時執行重複任務重置（跨日後即時更新）
  useEffect(() => {
    const saved = localStorage.getItem('projectTasks');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const reset = parsed.map(t => resetTaskTreeIfNeeded(t, parsed));
      if (JSON.stringify(reset) !== JSON.stringify(parsed)) {
        localStorage.setItem('projectTasks', JSON.stringify(reset));
        window.dispatchEvent(new CustomEvent(PROJECT_TASKS_UPDATED_EVENT));
        setTasks(reset);
      }
    } catch (e) {
      console.error('Error applying reset on load:', e);
    }
  }, []);

  // --- 3. 封包化 Hooks ---
  const selectedTask = useMemo(() => TaskUtils.findTaskById(tasks, selectedTaskId), [tasks, selectedTaskId]);
  const capsuleManager = useTaskCapsules(selectedTaskId, updateTasksAndSave);
  const repeatManager = useTaskRepeat(selectedTask, updateTasksAndSave, getLocalDateKey);
  const templateManager = useTaskTemplates(updateTasksAndSave, selectedTask);
  const reminderManager = useTaskReminders(tasks, updateTasksAndSave);

  // 其他狀態
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState('root');
  const [newTask, setNewTask] = useState(() => createEmptyNewTask());
  const [layoutTemplates, setLayoutTemplates] = useState([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(null);
  const [hoverTooltip, setHoverTooltip] = useState({ visible: false, task: null, x: 0, y: 0 });
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isStartTimePicker, setIsStartTimePicker] = useState(false);
  const [tpHour, setTpHour] = useState(0);
  const [tpMinute, setTpMinute] = useState(0);

  // Refs
  const startDateInputRef = useRef(null);
  const startTimeInputRef = useRef(null);
  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);
  const ganttTimelineRef = useRef(null);

  // --- 4. 重複任務引擎 (保持在主組件，因為需要全局掃描) ---
  const updateCurrentWindowLog = useCallback((task) => {
    const rep = task?.details?.repeat || DEFAULT_REPEAT;
    if (!rep || !rep.enabled) return task;
    const now = new Date();
    const currentKey = getLocalDateKeyForRepeat(task, now);
    const nextRepeatLog = { ...(task.details?.repeatLog || {}) };
    const isCompleted = task.status === 'completed' || task.completed === true;
    const progressVal = typeof task.details?.progress === 'number' ? task.details.progress : (isCompleted ? 100 : 0);
    const createTaskSnapshot = (t) => ({
      id: t.id, title: t.title, status: t.status,
      completed: t.status === 'completed' || t.completed === true,
      children: t.children ? t.children.map(createTaskSnapshot) : []
    });
    const currentSnapshot = (task.children && task.children.length > 0) ? task.children.map(createTaskSnapshot) : [];
    const existingLog = nextRepeatLog[currentKey];
    nextRepeatLog[currentKey] = {
      completed: isCompleted || (existingLog?.completed || false),
      completedAt: isCompleted ? (existingLog?.completedAt || new Date().toISOString()) : (existingLog?.completedAt || null),
      maxProgress: Math.max(existingLog?.maxProgress || 0, Math.max(0, Math.min(100, progressVal))),
      recordedAt: existingLog?.recordedAt || new Date().toISOString(),
      taskSnapshot: currentSnapshot
    };
    return { ...task, details: { ...task.details, repeatLog: nextRepeatLog } };
  }, []);

  // --- 5. 核心操作函數 ---
  const handleStatusChange = (taskId, newStatus) => {
    const updateTaskStatusRecursive = (taskList, targetId, status) => {
      return taskList.map(task => {
        if (task.id === targetId) {
          const updateAll = (t) => ({
            ...t, status: status, completed: status === 'completed',
            children: t.children ? t.children.map(updateAll) : []
          });
          let updatedTask = updateAll(task);
          if (updatedTask.details) updatedTask.details.progress = TaskUtils.calculateTaskProgress(updatedTask);
          updatedTask = updateCurrentWindowLog(updatedTask);
          return updatedTask;
        }
        if (task.children) {
          const updatedChildren = updateTaskStatusRecursive(task.children, targetId, status);
          if (updatedChildren !== task.children) {
            let newTask = { ...task, children: updatedChildren };
            if (newTask.details) newTask.details.progress = TaskUtils.calculateTaskProgress(newTask);
            newTask = updateCurrentWindowLog(newTask);
            const realChildren = (newTask.children || []).filter(c => c && !c.isPlaceholder && !c.isPlaceholderHeader);
            if (realChildren.length > 0 && realChildren.every(c => c.status === 'completed' || c.completed)) {
              newTask = { ...newTask, status: 'completed', completed: true };
            }
            return newTask;
          }
        }
      return task;
    });
  };
    updateTasksAndSave(prev => {
      const currentTask = TaskUtils.findTaskById(prev, taskId);
      if (!currentTask) return prev;
      const nextStatus = newStatus || ((currentTask.status === 'completed' || currentTask.completed) ? 'pending' : 'completed');
      return updateTaskStatusRecursive(prev, taskId, nextStatus);
    });
  };

  const handleTaskDetailUpdate = (taskId, field, value) => {
    updateTasksAndSave(prev => {
      const task = TaskUtils.findTaskById(prev, taskId);
      if (!task) return prev;
      
      // 處理佔位符邏輯：如果標題包含 [膠囊佔位]，則記錄該任務 ID
      if (field === 'title' && value.includes('[膠囊佔位]')) {
        capsuleManager.updateState({ 
          placeholderEnabled: true, 
          placeholderTaskId: taskId 
        });
      }

      let updates = { [field]: value };
      const detailFields = ['startDate', 'dueDate', 'startTime', 'dueTime', 'reminders', 'repeat', 'repeatLog'];
      if (detailFields.includes(field)) {
        const newDetails = { ...(task.details || {}), [field]: value };
        if (field === 'repeat') {
          const prevRepeat = task.details?.repeat || DEFAULT_REPEAT;
          const nextRepeat = value || DEFAULT_REPEAT;
          const enabling = !prevRepeat.enabled && !!nextRepeat.enabled;
          if (enabling) {
            const anchorAt = new Date().toISOString();
            const currentWindowStart = (() => {
              const unit = nextRepeat.unit || 'day';
              const interval = Math.max(1, Number(nextRepeat.interval || 1));
              const anchor = task.details?.startDate ? new Date(task.details.startDate) : new Date(anchorAt);
              const nowForCalc = new Date();
              const addCycle = (base) => {
                const next = new Date(base);
                if (unit === 'minute') next.setMinutes(next.getMinutes() + interval);
                else if (unit === 'week') next.setDate(next.getDate() + (interval * 7));
                else if (unit === 'month') next.setMonth(next.getMonth() + interval);
                else if (unit === 'year') next.setFullYear(next.getFullYear() + interval);
                else next.setDate(next.getDate() + interval);
                return next;
              };
              if (unit !== 'minute') {
                anchor.setHours(0, 0, 0, 0);
                nowForCalc.setHours(0, 0, 0, 0);
              }
              let current = new Date(anchor);
              let guard = 0;
              while (guard < 1000) {
                const next = addCycle(current);
                if (nowForCalc < next) break;
                current = next;
                guard += 1;
              }
              return current.toISOString();
            })();
            newDetails.repeat = {
              ...nextRepeat,
              anchorAt,
              lastResetAt: currentWindowStart,
              disabledByUser: false
            };
      } else {
            newDetails.repeat = nextRepeat;
          }
        }
        const getCombinedISO = (dateStr, timeStr) => {
              if (!dateStr) return null;
          if (!timeStr || timeStr === '00:00') return dateStr;
          const [hh = '00', mm = '00'] = timeStr.split(':');
          return `${dateStr}T${hh}:${mm}:00`;
        };
        if (field === 'startDate' || field === 'startTime') {
          const dateStr = field === 'startDate' ? value : (task.details?.startDate ? new Date(task.details.startDate).toISOString().split('T')[0] : '');
          const timeStr = field === 'startTime' ? value : (task.details?.startTime || '00:00');
          newDetails.startDate = getCombinedISO(dateStr, timeStr);
          if (field === 'startDate' && dateStr) {
            const dueTimeStr = task.details?.dueTime || '23:59';
            newDetails.dueDate = getCombinedISO(dateStr, dueTimeStr);
          }
        }
        if (field === 'dueDate' || field === 'dueTime') {
          const dateStr = field === 'dueDate' ? value : (task.details?.dueDate ? new Date(task.details.dueDate).toISOString().split('T')[0] : '');
          const timeStr = field === 'dueTime' ? value : (task.details?.dueTime || '00:00');
          newDetails.dueDate = getCombinedISO(dateStr, timeStr);
        }
        updates = { details: newDetails };
      }
      return TaskUtils.updateTaskInTree(prev, taskId, updates);
    });
  };

  // --- 6. 其他 UI 邏輯 ---
  const handleContextMenu = (e, taskId, taskTitle) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, taskId, taskTitle });
  };
  const hideContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, taskId: null, taskTitle: '' });
  const handleDragStart = (event) => {
    const activeId = String(event.active.id);
    document.body.classList.add('is-dragging-task');
    setDraggedTaskId(activeId);
    setActiveDragId(activeId);
    setOverDragId(activeId);
    setDragOffsetX(0);
    setDropPosition('before');
  };
  const handleDragMove = (event) => {
    setDragOffsetX(event.delta.x);
    if (event.over) setOverDragId(String(event.over.id));
  };
  const handleDragOver = (event) => {
    if (!event.over) return;
    const nextOverId = String(event.over.id);
    const activeId = String(event.active?.id || '');
    setOverDragId(nextOverId);

    const translated = event.active?.rect?.current?.translated;
    const overRect = event.over?.rect;
    if (!translated || !overRect || !overRect.height) return;
    const pointerY = translated.top + (translated.height / 2);
    const ratio = (pointerY - overRect.top) / overRect.height;
    const activeVisibleIndex = visibleFlatTreeItems.findIndex(item => item.id === activeId);
    const overVisibleIndex = visibleFlatTreeItems.findIndex(item => item.id === nextOverId);
    const isMovingDown = activeVisibleIndex >= 0 && overVisibleIndex >= 0 && overVisibleIndex > activeVisibleIndex;
    const isMovingUp = activeVisibleIndex >= 0 && overVisibleIndex >= 0 && overVisibleIndex < activeVisibleIndex;
    if (ratio <= DROP_ZONE_TOP) {
      setDropPosition('before');
      return;
    }
    if (ratio >= DROP_ZONE_BOTTOM) {
      setDropPosition('after');
        return;
      }
    const offsetX = event.delta?.x ?? dragOffsetX;
    const allowInside = canNestIntoTarget(nextOverId, activeId, offsetX);
    if (allowInside) {
      setDropPosition('inside');
    } else {
      // 中間區不吃進去時，依拖曳方向給出更好用的排序判定
      if (isMovingDown) setDropPosition('after');
      else if (isMovingUp) setDropPosition('before');
      else setDropPosition(ratio < 0.5 ? 'before' : 'after');
    }
  };
  const handleDragCancel = () => {
    document.body.classList.remove('is-dragging-task');
    setDraggedTaskId(null);
    setActiveDragId(null);
    setOverDragId(null);
    setDragOffsetX(0);
    setDropPosition('before');
  };
  const handleDragEnd = (event) => {
    document.body.classList.remove('is-dragging-task');
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : (overDragId ? String(overDragId) : null);
    const allowInside = overId ? canNestIntoTarget(overId, activeId, dragOffsetX) : false;
    const moveMode = (dropPosition === 'inside' && allowInside) ? 'inside' : (dropPosition === 'after' ? 'after' : 'before');
    setDraggedTaskId(null);
    setActiveDragId(null);
    setOverDragId(null);
    setDragOffsetX(0);
    setDropPosition('before');
    if (!overId || activeId === overId) return;
    if (moveMode === 'inside' && overId) {
      setExpandedItems(prevSet => {
        const nextSet = new Set(prevSet);
        nextSet.add(String(overId));
        return nextSet;
      });
    }

    updateTasksAndSave(prev => {
      const rootNode = prev.find(item => String(item.id) === 'root');
      if (!rootNode) return prev;

      const allFlat = flattenTree(rootNode.children || []);
      if (isDescendantOf(allFlat, activeId, overId)) return prev;
      const reordered = moveFlatSubtree(allFlat, activeId, overId, moveMode);
      if (reordered === allFlat) return prev;

      const activeIndex = reordered.findIndex(item => item.id === activeId);
      if (activeIndex < 0) return prev;

      const overItem = reordered.find(item => item.id === overId);
      if (!overItem) return prev;
      const targetProjection = moveMode === 'inside'
        ? { depth: overItem.depth + 1, parentId: overItem.id }
        : { depth: overItem.depth, parentId: overItem.parentId };
      if (!targetProjection) return prev;

      const depthDelta = targetProjection.depth - reordered[activeIndex].depth;
      const nextFlat = reordered.map((item, index) => {
        if (index === activeIndex) return { ...item, depth: targetProjection.depth, parentId: targetProjection.parentId };
        if (index > activeIndex && item.depth > reordered[activeIndex].depth) {
          return { ...item, depth: Math.max(targetProjection.depth + 1, item.depth + depthDelta) };
        }
        return item;
      });

      const rebuiltChildren = buildTreeFromFlat(nextFlat).map(task => TaskUtils.adjustTaskLevels(task, 'NONE'));
      return prev.map(item => (
        String(item.id) === 'root'
          ? {
              ...item,
              children: rebuiltChildren,
              details: {
                ...item.details,
                progress: TaskUtils.calculateTaskProgress({ ...item, children: rebuiltChildren })
              }
            }
          : item
      ));
        });
      };
  const handleTaskDelete = (taskId) => {
    if (window.confirm('確定要刪除此任務嗎？')) {
      updateTasksAndSave(prev => TaskUtils.removeTaskFromTree(prev, taskId).tasks);
      if (selectedTaskId === taskId) setSelectedTaskId(null);
    }
  };
  const handleTaskDuplicate = (taskId) => {
    if (!taskId) return;
    let duplicatedRootId = null;
    let duplicatedIdMap = new Map();
    let taskMetaMap = new Map();
    flushSync(() => {
      updateTasksAndSave((prev) => {
        const sourceTask = TaskUtils.findTaskById(prev, taskId);
        if (!sourceTask) return prev;
        taskMetaMap = buildTaskMetaMap(sourceTask);
        const result = cloneTaskSubtreeWithNewIds(sourceTask, new Map());
        if (!result?.clonedRoot) return prev;
        duplicatedRootId = String(result.clonedRoot.id);
        duplicatedIdMap = result.idMap;
        const next = insertSiblingAfterTask(prev, taskId, result.clonedRoot);
        return next;
      });
    });
    if (duplicatedIdMap.size > 0) {
      duplicatedIdMap.forEach((newId, oldId) => {
        try {
          let layoutToCopy = localStorage.getItem(`${TASK_LAYOUT_STORAGE_PREFIX}.${oldId}`);
          if (!layoutToCopy) {
            const meta = taskMetaMap.get(oldId);
            const taskType = meta?.taskType || 'default';
            layoutToCopy = localStorage.getItem(`${TYPE_LAYOUT_STORAGE_PREFIX}.${taskType}`);
          }
          if (layoutToCopy) localStorage.setItem(`${TASK_LAYOUT_STORAGE_PREFIX}.${newId}`, layoutToCopy);
          const toolbarCollapsedVal = localStorage.getItem(`${TASK_INSERT_TOOLBAR_COLLAPSED_PREFIX}.${oldId}`);
          if (toolbarCollapsedVal !== null) localStorage.setItem(`${TASK_INSERT_TOOLBAR_COLLAPSED_PREFIX}.${newId}`, toolbarCollapsedVal);
    } catch (error) {
          console.error('Failed to duplicate task layout setting:', error);
        }
      });
      try {
        const capsuleStatesRaw = localStorage.getItem(TASK_CAPSULE_STATES_KEY);
        const capsuleStates = capsuleStatesRaw ? JSON.parse(capsuleStatesRaw) : {};
        const updates = {};
        duplicatedIdMap.forEach((newId, oldId) => {
          const oldState = capsuleStates[oldId];
          if (oldState && typeof oldState === 'object') {
            let copied = { ...oldState };
            if (copied.placeholderTaskId && duplicatedIdMap.has(copied.placeholderTaskId)) {
              copied = { ...copied, placeholderTaskId: duplicatedIdMap.get(copied.placeholderTaskId) };
            }
            if (copied.targetParentId && duplicatedIdMap.has(copied.targetParentId)) {
              copied = { ...copied, targetParentId: duplicatedIdMap.get(copied.targetParentId) };
            }
            updates[newId] = copied;
          }
        });
        if (Object.keys(updates).length > 0) {
          const merged = { ...capsuleStates, ...updates };
          localStorage.setItem(TASK_CAPSULE_STATES_KEY, JSON.stringify(merged));
          if (capsuleManager.mergeCapsuleStates) {
            capsuleManager.mergeCapsuleStates(updates);
          }
        }
    } catch (error) {
        console.error('Failed to duplicate task capsule states:', error);
      }
    }
    if (duplicatedRootId) {
      setSelectedTaskId(duplicatedRootId);
      setActiveTab('details');
    }
  };
  const handleAddTask = () => {
    if (!newTask.title.trim()) return;
    const parentTask = selectedParent === 'root' ? null : TaskUtils.findTaskById(tasks, selectedParent);
    const levelScale = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const parentLevel = parentTask?.level || 'A';
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
      id: newTaskId, title: newTask.title, description: newTask.description,
      level: autoLevel, status: 'pending', created: new Date().toISOString(),
      tagId: resolvedTagId,
      children: [],
      details: {
        ...DEFAULT_REPEAT,
        progress: 0,
        startDate: startDateISO,
        startTime: newTask.startTime || '00:00',
        dueDate: dueDateISO,
        dueTime: newTask.dueTime || '23:59'
      }
    };
    updateTasksAndSave(prev => TaskUtils.addChildToTask(prev, selectedParent, newTaskObj));

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
          console.error('Failed to apply layout template on create:', error);
        }
      }
    }

    setShowAddModal(false);
    setSelectedParent('root');
    setNewTask(createEmptyNewTask());
  };

  const openAddTaskFromCalendar = (date) => {
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
  };
  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    setTaskTags(prev => [...prev, { id: `tag-${Date.now()}`, name: newTagName.trim(), color: newTagColor, includeInViews: true }]);
    setNewTagName('');
  };
  const handleEditTag = (tagId, name, color) => {
    setTaskTags(prev => prev.map(t => t.id === tagId ? { ...t, name, color } : t));
    setEditingTagId(null);
  };
  const handleToggleTagIncludeInViews = (tagId) => {
    setTaskTags(prev => prev.map(t => t.id === tagId ? { ...t, includeInViews: !(t.includeInViews !== false) } : t));
  };
  const handleDeleteTag = (tagId) => {
    if (window.confirm('確定刪除此屬性？')) {
      setTaskTags(prev => prev.filter(t => t.id !== tagId));
      updateTasksAndSave(prev => {
        const clear = (list) => list.map(t => ({ ...t, tagId: t.tagId === tagId ? null : t.tagId, children: clear(t.children || []) }));
        return clear(prev);
      });
    }
  };

  // --- 7. Memos ---
  const allTasks = useMemo(() => {
    const flatten = (list, path = []) => list.reduce((acc, t) => {
      const currentPath = [...path, { id: t.id, title: t.title, level: t.level }];
      acc.push({ ...t, parentPath: currentPath });
      if (t.children) acc.push(...flatten(t.children, currentPath));
      return acc;
    }, []);
    return flatten(tasks[0]?.children || []);
  }, [tasks]);
  
  const filteredTasks = useMemo(() => {
    let res = allTasks;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      res = res.filter(t => t.title.toLowerCase().includes(s) || (t.description && t.description.toLowerCase().includes(s)));
    }
    if (levelFilter !== 'all') res = res.filter(t => t.level === levelFilter);
    if (statusFilter !== 'all') res = res.filter(t => t.status === statusFilter);
    if (priorityFilter !== 'all') res = res.filter(t => t.priority === priorityFilter);
    if (tagFilter !== 'all') {
      if (tagFilter === 'none') res = res.filter(t => !t.tagId);
      else res = res.filter(t => t.tagId === tagFilter);
    }
    return res;
  }, [allTasks, searchTerm, levelFilter, statusFilter, priorityFilter, tagFilter]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const treeRoot = tasks.find(t => String(t.id) === 'root');
  const flatTreeItems = useMemo(() => flattenTree(treeRoot?.children || []), [treeRoot?.children]);
  const visibleFlatTreeItems = useMemo(() => filterVisibleFlat(flatTreeItems, expandedItems), [flatTreeItems, expandedItems]);
  const activeDragItem = useMemo(
    () => visibleFlatTreeItems.find(item => item.id === String(activeDragId)) || null,
    [visibleFlatTreeItems, activeDragId]
  );
  const canNestIntoTarget = useCallback((targetId, activeId, offsetX) => {
    if (!targetId || !activeId) return false;
    if (String(targetId) === String(activeId)) return false;
    if (offsetX < NEST_RIGHT_THRESHOLD_PX) return false;
    const targetItem = visibleFlatTreeItems.find(item => item.id === String(targetId));
    if (!targetItem) return false;
    const hasChildren = Array.isArray(targetItem.task.children) && targetItem.task.children.length > 0;
    const isExpanded = expandedItems.has(String(targetId));
    return !hasChildren || !isExpanded;
  }, [visibleFlatTreeItems, expandedItems]);

  // --- 8. 副作用 ---
  useEffect(() => {
    localStorage.setItem('taskTags', JSON.stringify(taskTags));
    window.dispatchEvent(new CustomEvent(TASK_TAGS_UPDATED_EVENT));
  }, [taskTags]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OPEN_PROJECT_TASK_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const targetId = String(parsed?.taskId || '');
      if (!targetId) {
        localStorage.removeItem(OPEN_PROJECT_TASK_KEY);
        return;
      }
      const targetTask = TaskUtils.findTaskById(tasks, targetId);
      if (!targetTask) return;
      setSelectedTaskId(targetId);
      setActiveTab('details');
      localStorage.removeItem(OPEN_PROJECT_TASK_KEY);
    } catch (error) {
      console.error('Failed to open project task from unified calendar:', error);
      localStorage.removeItem(OPEN_PROJECT_TASK_KEY);
    }
  }, [tasks]);
  useEffect(() => {
    try {
      localStorage.setItem(GANTT_DISPLAY_MODE_STORAGE_KEY, ganttTaskDisplayMode);
                              } catch (error) {
      console.error('Error saving gantt display mode:', error);
    }
  }, [ganttTaskDisplayMode]);
  useEffect(() => {
    try {
      localStorage.setItem(GANTT_DAY_COLUMN_WIDTH_STORAGE_KEY, String(ganttColumnWidth));
                                    } catch (error) {
      console.error('Error saving gantt day column width:', error);
    }
  }, [ganttColumnWidth]);
  useEffect(() => {
    try {
      localStorage.setItem(GANTT_ZOOM_STORAGE_KEY, ganttZoom);
                                        } catch (error) {
      console.error('Error saving gantt zoom mode:', error);
    }
  }, [ganttZoom]);
  useEffect(() => {
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

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('projectTasks');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setTasks(parsed);
        } catch (e) {
          console.error('Error refreshing tasks', e);
        }
      }
    };
    window.addEventListener(PROJECT_TASKS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROJECT_TASKS_UPDATED_EVENT, handler);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(OVERVIEW_FILTER_STORAGE_KEY, JSON.stringify(overviewFilters)); } catch (e) { console.error('Failed to save overview filters:', e); }
  }, [overviewFilters]);
  useEffect(() => {
    try { localStorage.setItem(GANTT_FILTER_STORAGE_KEY, JSON.stringify(ganttFilters)); } catch (e) { console.error('Failed to save gantt filters:', e); }
  }, [ganttFilters]);
  useEffect(() => {
    try { localStorage.setItem(CALENDAR_FILTER_STORAGE_KEY, JSON.stringify(calendarFilters)); } catch (e) { console.error('Failed to save calendar filters:', e); }
  }, [calendarFilters]);
  const prevTagCountRef = useRef(0);
  useEffect(() => {
    const currentCount = (taskTags || []).length;
    const prevCount = prevTagCountRef.current;
    prevTagCountRef.current = currentCount;
    if (currentCount <= prevCount) return;
    if (prevCount === 0) return;
    const allTags = ['none', ...(taskTags || []).map(t => t.id)];
    const norm = (f) => {
      const next = { ...f };
      const missingTags = allTags.filter(v => !(next.tags || []).includes(v));
      if (missingTags.length > 0) {
        next.tags = [...(next.tags || []).filter(v => allTags.includes(v)), ...missingTags];
        return next;
      }
      return null;
    };
    setOverviewFilters(prev => { const n = norm(prev); return n || prev; });
    setGanttFilters(prev => { const n = norm(prev); return n || prev; });
    setCalendarFilters(prev => { const n = norm(prev); return n || prev; });
  }, [taskTags]);
  useEffect(() => {
    const handleClickOutside = () => hideContextMenu();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);
  useEffect(() => () => { document.body.classList.remove('is-dragging-task'); }, []);
  useEffect(() => {
    const runReset = () => updateTasksAndSave(prev => prev.map(t => resetTaskTreeIfNeeded(t, prev)));
    const timer = setInterval(runReset, 10000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runReset();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [updateTasksAndSave]);

  // --- 9. 渲染輔助 ---
  const renderTaskVisual = (task) => {
    const isSelected = selectedTaskId === task.id, hasChildren = task.children && task.children.length > 0, progress = TaskUtils.calculateTaskProgress(task), isCurrentPeriodStyle = TaskUtils.isTaskProgressCurrentPeriodStyle(task);
    
    // 處理佔位符視覺樣式
    if (task.isPlaceholder) {
                                  return (
        <div className={`project-item-header placeholder-item`} style={{ color: '#999', fontStyle: 'italic', padding: '8px 12px' }}>
          <span className="project-title">{task.title}</span>
                                    </div>
                                  );
    }

    let displayIcon = null;
    if (task.icon) {
      if (typeof task.icon === 'string') displayIcon = <span className="task-icon" style={{ marginRight: '4px' }}>{task.icon}</span>;
      else if (typeof task.icon === 'object') {
        if (task.icon.type === 'custom' && task.icon.url) displayIcon = <img src={task.icon.url} alt="" style={{ width: '16px', height: '16px', marginRight: '4px', objectFit: 'contain' }} />;
        else if (task.icon.type === 'default' && task.icon.name) {
          const iconDef = DEFAULT_ICONS.find(i => i.name === task.icon.name);
          if (iconDef) displayIcon = <span className="task-icon" style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center', color: '#666' }}>{React.createElement(iconDef.icon, { size: 14 })}</span>;
        }
      }
    }
                            return (
      <div className={`project-item-header ${task.status === 'completed' ? 'completed' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => { setSelectedTaskId(task.id); setActiveTab('details'); }} onContextMenu={(e) => handleContextMenu(e, task.id, task.title)}>
        <div className="task-info-left">
          <IoChevronDown className={`expand-icon ${expandedItems.has(task.id) ? 'expanded' : ''}`} style={{ cursor: 'pointer', transition: 'transform 0.2s', transform: expandedItems.has(task.id) ? 'rotate(0deg)' : 'rotate(-90deg)', visibility: hasChildren ? 'visible' : 'hidden' }} onClick={(e) => { e.stopPropagation(); setExpandedItems(prev => { const next = new Set(prev); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next; }); }} />
          <span className={`level-badge level-${String(task.levelType || task.level).toLowerCase()}`}>{task.levelType || task.level}</span>
          {displayIcon}
          <span className="project-title">{task.title}</span>
                                </div>
        <div className="task-actions-right">
          {hasChildren && <div className="progress-mini-container" style={{ width: '40px', height: '4px', background: '#eee', borderRadius: '2px', overflow: 'hidden', marginRight: '8px' }}><div className="progress-mini-bar" style={{ width: `${progress}%`, height: '100%', background: isCurrentPeriodStyle ? '#9DD9F5' : '#52D0FF' }} /></div>}
          <button className="add-subtask-btn" style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); setSelectedParent(task.id); setShowAddModal(true); }}><IoAdd /></button>
                                  </div>
                              </div>
                            );
    };
                                  
                                  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="project-container">
      <div className="project-sidebar">
        <div className="project-header">
          <div className="header-buttons">
              <button className="add-project-btn" onClick={() => { setSelectedParent('root'); setNewTask(createEmptyNewTask()); setShowAddModal(true); }}><IoAdd /> 新增任務</button>
              <button className="template-btn" onClick={() => setShowTemplateModal(true)}><IoCloudDownloadOutline /> 內容模板</button>
                              </div>
                            </div>
        <div className="project-tree">
          <SortableContext items={visibleFlatTreeItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="root-droppable">
              {visibleFlatTreeItems.map((item) => (
                <SortableTaskRow key={item.id} item={item} isDraggingTree={!!draggedTaskId} renderTaskVisual={renderTaskVisual} />
              ))}
                </div>
          </SortableContext>
                </div>
              </div>
        <div className="project-content" style={{ display: 'block', padding: '16px 30px 30px 16px' }}>
          <TaskDetailPanel key={selectedTaskId || 'no-task'} {...{
            selectedTask, tasks, setTasks, updateTasksAndSave, taskTags, setTaskTags, getTagColor: (id) => taskTags.find(t => t.id === id)?.color,
            overviewFilters, setOverviewFilters, ganttFilters, setGanttFilters, calendarFilters, setCalendarFilters,
            handleTaskDelete, handleTaskDetailUpdate, isLayoutEditing, setIsLayoutEditing, activeTab, setActiveTab, isEditing, setIsEditing,
            formatDateForInput: (d) => { if (!d) return ''; const date = new Date(d); return isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; },
            handleStatusChange, capsuleManager, repeatManager, reminderManager,
            handleDueDateChange: (date) => handleTaskDetailUpdate(selectedTaskId, 'dueDate', date),
            handleStartDateChange: (date) => handleTaskDetailUpdate(selectedTaskId, 'startDate', date),
            toolbarCollapsed, setToolbarCollapsed, handleBreadcrumbClick: (id) => { setSelectedTaskId(id); setActiveTab('details'); }, handleEditorChange: (c) => handleTaskDetailUpdate(selectedTaskId, 'description', c),
            modules: {
              toolbar: [
                [{ size: ['small', false, 'large', 'huge'] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
                [{ color: [] }, { background: [] }],
                ['link', 'image', 'video'],
                ['clean']
              ]
            },
            formats: [
              'size',
              'bold',
              'italic',
              'underline',
              'strike',
              'list',
              'bullet',
              'indent',
              'color',
              'background',
              'link',
              'image',
              'video'
            ],
            editingTaskId, editingText, setEditingText, handleEditKeyPress: (e) => e.key === 'Enter' && setEditingTaskId(null),
            saveEditTask: () => { handleTaskDetailUpdate(editingTaskId, 'title', editingText); setEditingTaskId(null); },
            startEditTask: (id, text) => { setEditingTaskId(id); setEditingText(text); },
            isGeneratedTask: (id) => !!allTasks.find(t => t.id === id)?.originalTaskId,
            handleBackToOriginalTask: (id) => setSelectedTaskId(allTasks.find(t => t.id === id)?.originalTaskId),
            startDateInputRef, startTimeInputRef, dateInputRef, timeInputRef, allTasks, searchTerm, setSearchTerm, levelFilter, setLevelFilter, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, tagFilter, setTagFilter, tagFilterDropdownOpen, setTagFilterDropdownOpen, sortBy, setSortBy, sortOrder, setSortOrder, filteredTasks, selectedTasks, setSelectedTasks, handleTaskSelect: (id) => setSelectedTasks(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
            handleSelectAll: () => setSelectedTasks(prev => prev.size === filteredTasks.length ? new Set() : new Set(filteredTasks.map(t => t.id))),
            handleBulkStatusChange: (s) => { updateTasksAndSave(prev => { let n = prev; selectedTasks.forEach(id => n = TaskUtils.updateTaskInTree(n, id, { status: s, completed: s === 'completed' })); return n; }); setSelectedTasks(new Set()); },
            handleBulkDelete: () => { if (window.confirm(`確定刪除 ${selectedTasks.size} 個任務？`)) { updateTasksAndSave(prev => { let n = prev; selectedTasks.forEach(id => n = TaskUtils.removeTaskFromTree(n, id).tasks); return n; }); setSelectedTasks(new Set()); } },
            handleOverviewTaskClick: (id) => { setSelectedTaskId(id); setHoverTooltip({ visible: false, task: null, x: 0, y: 0 }); },
            handleTaskStatusToggle: handleStatusChange, newTagName, setNewTagName, newTagColor, setNewTagColor, handleAddTag, editingTagId, setEditingTagId, editingTagName, setEditingTagName, editingTagColor, setEditingTagColor, handleEditTag, handleDeleteTag, handleToggleTagIncludeInViews,
            ganttZoom, setGanttZoom, ganttTaskDisplayMode, setGanttTaskDisplayMode, calendarDate, setCalendarDate, ganttTimelineRef, ganttColumnWidth, setGanttColumnWidth, dayViewDate, setDayViewDate, rgbToHex: (rgb) => { if (!rgb) return '#52D0FF'; const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); if (!m) return rgb; return "#" + ((1 << 24) + (parseInt(m[1]) << 16) + (parseInt(m[2]) << 8) + parseInt(m[3])).toString(16).slice(1); },
            hexToRgb: (hex) => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? `rgb(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)})` : hex; },
            setShowTimePicker, setIsStartTimePicker, setTpHour, setTpMinute, setTagDropdownOpen, tagDropdownOpen,
            openTimePicker: (id) => { const t = allTasks.find(x => x.id === id); const [h, m] = (t?.details?.dueTime || '00:00').split(':').map(Number); setTpHour(h); setTpMinute(m); setIsStartTimePicker(false); setShowTimePicker(true); },
            openStartTimePicker: (id) => { const t = allTasks.find(x => x.id === id); const [h, m] = (t?.details?.startTime || '00:00').split(':').map(Number); setTpHour(h); setTpMinute(m); setIsStartTimePicker(true); setShowTimePicker(true); },
            tpHour, tpMinute, handleTaskHover: (e, task) => setHoverTooltip({ visible: true, task, x: e.clientX, y: e.clientY }), handleTaskHoverLeave: () => setHoverTooltip({ visible: false, task: null, x: 0, y: 0 }), hoverTooltip,
            setHoveredTaskId, hoveredTaskId,
            handleColumnWidthChange: (w) => setGanttColumnWidth(Math.max(20, Math.min(160, w))),
            templateManager,
            tasks: tasks, // 確保傳遞 tasks
            onCalendarDateClickForAddTask: openAddTaskFromCalendar
          }} />
            </div>
        </div>
      <DragOverlay>
        {activeDragItem ? (
          <div style={{ minWidth: '240px', marginLeft: `${activeDragItem.depth * TREE_INDENT_PX}px`, opacity: 0.95 }}>
            {renderTaskVisual(activeDragItem.task)}
              </div>
        ) : null}
      </DragOverlay>
      <AddTaskModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTask}
        newTask={newTask}
        setNewTask={setNewTask}
        selectedParent={selectedParent}
        setSelectedParent={setSelectedParent}
        tasks={tasks}
        taskTags={taskTags}
        layoutTemplates={layoutTemplates}
      />
      <TemplateModal 
        isOpen={showTemplateModal} 
        onClose={() => setShowTemplateModal(false)} 
        manager={templateManager} 
        selectedTask={selectedTask}
      />
      <RepeatLogModal selectedTask={selectedTask} repeatManager={repeatManager} />

      {/* 提醒選擇器 (對齊舊版樣式) */}
      {reminderManager.showReminderPicker && (
        <div className="time-picker-overlay" onClick={() => reminderManager.setShowReminderPicker(false)}>
          <div className="time-picker" onClick={(e)=>e.stopPropagation()}>
            <div className="time-picker-wheels">
              <div className="wheel">
                <div className="wheel-item custom-input">
                  <span>自填天數</span>
                  <input 
                    type="number" 
                    min={0} 
                    value={reminderManager.rpDaysCustom} 
                    onChange={(e)=>reminderManager.setRpDaysCustom(e.target.value.replace(/[^\d]/g,''))} 
                  />
                  <button className="mini-apply" onClick={()=>reminderManager.setRpDays(Math.max(0, parseInt(reminderManager.rpDaysCustom || '0',10)))}>套用</button>
                </div>
                {[...Array(200)].map((_,i)=> (
                  <div key={i} className={`wheel-item ${reminderManager.rpDays===i?'active':''}`} onClick={()=>reminderManager.setRpDays(i)}>{i} 天</div>
                ))}
              </div>
              <div className="wheel">
                {[...Array(25)].map((_,i)=> (
                  <div key={i} className={`wheel-item ${reminderManager.rpHours===i?'active':''}`} onClick={()=>reminderManager.setRpHours(i)}>{i} 小時</div>
                ))}
              </div>
              <div className="wheel">
                {[...Array(61)].map((_,i)=> (
                  <div key={i} className={`wheel-item ${reminderManager.rpMinutes===i?'active':''}`} onClick={()=>reminderManager.setRpMinutes(i)}>{String(i).padStart(2,'0')} 分</div>
                ))}
              </div>
            </div>
            <div className="time-picker-actions">
              <button className="cancel-btn" onClick={()=>reminderManager.setShowReminderPicker(false)}>取消</button>
              <button className="save-btn" onClick={() => reminderManager.confirmReminderPicker(selectedTaskId)}>確定</button>
            </div>
          </div>
        </div>
      )}
      {showTimePicker && (
        <div className="time-picker-overlay" onClick={() => setShowTimePicker(false)}>
          <div className="time-picker" onClick={(e) => e.stopPropagation()}>
            <div className="time-picker-wheels">
              <div className="wheel">{[...Array(24)].map((_, i) => <div key={i} className={`wheel-item ${tpHour === i ? 'active' : ''}`} onClick={() => setTpHour(i)}>{String(i).padStart(2, '0')}</div>)}</div>
              <div className="wheel">{[...Array(12)].map((_, i) => { const v = i * 5; return <div key={v} className={`wheel-item ${tpMinute === v ? 'active' : ''}`} onClick={() => setTpMinute(v)}>{String(v).padStart(2, '0')}</div>; })}</div>
            </div>
            <div className="time-picker-actions">
              <button className="cancel-btn" onClick={() => setShowTimePicker(false)}>取消</button>
              <button className="save-btn" onClick={() => {
                const timeStr = `${String(tpHour).padStart(2, '0')}:${String(tpMinute).padStart(2, '0')}`;
                handleTaskDetailUpdate(selectedTaskId, isStartTimePicker ? 'startTime' : 'dueTime', timeStr);
                setShowTimePicker(false);
              }}>確定</button>
                </div>
                  </div>
              </div>
      )}
      {hoverTooltip.visible && hoverTooltip.task && (
        <div className="task-hover-tooltip" style={{ position: 'fixed', left: `${hoverTooltip.x + 15}px`, top: `${hoverTooltip.y + 15}px`, zIndex: 10000, pointerEvents: 'none' }}>
          <div className="tooltip-content" style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '12px', width: '240px', fontSize: '12px' }}>
            <div className="tooltip-header" style={{ fontWeight: 'bold', marginBottom: '4px' }}>{hoverTooltip.task.title}</div>
            {hoverTooltip.task.details?.dueDate && <div className="tooltip-date" style={{ color: '#666', fontSize: '11px' }}>截止: {new Date(hoverTooltip.task.details.dueDate).toLocaleString()}</div>}
            {hoverTooltip.task.description && <div className="tooltip-description" style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px', color: '#555', maxHeight: '80px', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: hoverTooltip.task.description }} />}
          </div>
        </div>
      )}
      {contextMenu.visible && (
        <div className="task-context-menu" style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 11000, padding: '8px 0', minWidth: '160px' }} onClick={(e) => e.stopPropagation()}>
          <div className="menu-item" style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setSelectedParent(contextMenu.taskId); setShowAddModal(true); hideContextMenu(); }}><IoAdd /> 新增子任務</div>
          <div className="menu-item" style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { handleTaskDuplicate(contextMenu.taskId); hideContextMenu(); }}>📄 複製任務</div>
          <div className="menu-item" style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4444' }} onClick={() => { handleTaskDelete(contextMenu.taskId); hideContextMenu(); }}><BsTrash /> 刪除任務</div>
          <div className="menu-item" style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #eee' }} onClick={() => { navigator.clipboard.writeText(contextMenu.taskId); alert('ID 已複製'); hideContextMenu(); }}>📋 複製 ID</div>
        </div>
      )}

      {/* 應用程式內通知 (Toast) */}
      <div className="app-notifications-container" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 20000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {reminderManager.appNotifications.map(notification => (
          <div key={notification.id} className="app-toast" style={{ 
            background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            borderLeft: `6px solid ${notification.type === 'expired' ? '#ff4d4f' : '#52D0FF'}`,
            width: '300px', display: 'flex', flexDirection: 'column', gap: '4px',
            animation: 'slideIn 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <strong style={{ fontSize: '14px', color: '#333' }}>{notification.title}</strong>
              <button onClick={() => reminderManager.dismissToast(notification.id)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: '13px', color: '#666' }}>{notification.message}</div>
            {notification.type === 'reminder' && (
              <CountdownTimer dueDate={TaskUtils.findTaskById(tasks, notification.taskId)?.details?.dueDate} />
            )}
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setSelectedTaskId(notification.taskId); setActiveTab('details'); reminderManager.dismissToast(notification.id); }}
                style={{ background: '#f0f7ff', border: 'none', color: '#00A3FF', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                查看詳情
              </button>
            </div>
            </div>
        ))}
            </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </DndContext>
  );
};

export default ProjectList;
