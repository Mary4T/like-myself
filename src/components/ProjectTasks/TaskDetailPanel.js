import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { IoAdd, IoCloudDownloadOutline, IoList } from 'react-icons/io5';
import { DEFAULT_ICONS } from '../TaskComponents/IconSelector/defaultIcons';
import { isOccurrenceCompleted } from '../../utils/projectTaskRepeatUtils';
import ReminderPanel from './SubPanels/ReminderPanel';
import TaskHeaderSection from './sections/TaskHeaderSection';
import StartDateSection from './sections/StartDateSection';
import CreatedAtSection from './sections/CreatedAtSection';
import TaskPropertiesSection from './sections/TaskPropertiesSection';
import DescriptionSection from './sections/DescriptionSection';
import { DEFAULT_SECTION_ORDER, DRAGGABLE_SECTION_IDS, REMOVABLE_SECTION_IDS, SECTION_LABELS } from './sections/layoutRegistry';

const CALENDAR_STYLE_STORAGE_KEY = 'taskCalendarStyle.v1';

const TaskDetailPanel = (props) => {
  const quillRef = useRef(null);

  // 將插入函數暴露給全域，方便 CapsulePanel 呼叫
  useEffect(() => {
    window.insertToQuill = (text) => {
      const editor = quillRef.current?.getEditor();
      if (editor) {
        const range = editor.getSelection();
        const index = range ? range.index : editor.getLength();
        editor.insertText(index, text);
        editor.setSelection(index + text.length);
      }
    };
    return () => { delete window.insertToQuill; };
  }, []);

  const {
    selectedTask, tasks, updateTasksAndSave, taskTags, setTaskTags, getTagColor,
    overviewFilters, setOverviewFilters, ganttFilters, setGanttFilters, calendarFilters, setCalendarFilters,
    handleTaskDelete, handleTaskDetailUpdate, isLayoutEditing, setIsLayoutEditing, activeTab, setActiveTab,
    formatDateForInput, handleDueDateChange, handleStatusChange, capsuleManager, repeatManager, reminderManager,
    toolbarCollapsed, setToolbarCollapsed, handleBreadcrumbClick,
    handleEditorChange, modules, formats,
    editingTaskId, editingText, setEditingText, handleEditKeyPress, saveEditTask, startEditTask,
    isGeneratedTask, handleBackToOriginalTask,
    startDateInputRef, startTimeInputRef, dateInputRef, timeInputRef,
    allTasks, searchTerm, setSearchTerm, levelFilter, setLevelFilter, statusFilter, setStatusFilter,
    priorityFilter, setPriorityFilter, tagFilter, setTagFilter, tagFilterDropdownOpen, setTagFilterDropdownOpen,
    sortBy, setSortBy, sortOrder, setSortOrder, filteredTasks,
    selectedTasks, setSelectedTasks, handleTaskSelect,
    repeatLogAnalysis, handleSelectAll,
    handleBulkStatusChange, handleBulkDelete,
    handleOverviewTaskClick, handleTaskStatusToggle,
    newTagName, setNewTagName, newTagColor, setNewTagColor, handleAddTag,
    editingTagId, setEditingTagId, editingTagName, setEditingTagName, editingTagColor, setEditingTagColor,
    handleEditTag, handleDeleteTag, handleToggleTagIncludeInViews,
    ganttZoom, setGanttZoom, ganttTaskDisplayMode, setGanttTaskDisplayMode, calendarDate, setCalendarDate,
    ganttTimelineRef, ganttColumnWidth, dayViewDate, setDayViewDate,
    rgbToHex, hexToRgb,
    setTagDropdownOpen, tagDropdownOpen,
    openTimePicker, openStartTimePicker,
    handleTaskHover, handleTaskHoverLeave, hoveredTaskId, setHoveredTaskId,     handleColumnWidthChange,
    templateManager,
    onCalendarDateClickForAddTask,
    isMobile,
    onAddTaskClick,
    onTemplateClick,
    onTreeToggle
  } = props;

  // Internal Gantt/Calendar Helpers
  const ganttTimelineBase = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = ganttZoom === 'month'
      ? new Date(now.getFullYear(), now.getMonth() + 60, 0) // 月視圖：五年
      : new Date(now.getFullYear(), now.getMonth() + 6, 0); // 日/週視圖：六個月
    return { startDate, endDate };
  }, [tasks, ganttZoom]);

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

  const getTaskDisplayWindows = useCallback((task, rangeStart, rangeEnd) => {
    const details = task?.details || {};
    const repeat = details.repeat || {};
    const start = toDateTime(details.startDate, details.startTime, 'start');
    const due = toDateTime(details.dueDate, details.dueTime, 'end');

    if (!repeat.enabled) {
      if (repeat.disabledByUser) return [];
      if (!start && !due) return [];
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
        if (occurrenceStart <= rangeEnd && occurrenceEnd >= rangeStart) {
          windows.push({ start: occurrenceStart, end: occurrenceEnd });
        }
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
        if (occurrenceStart <= rangeEnd && occurrenceEnd >= rangeStart) {
          windows.push({ start: occurrenceStart, end: occurrenceEnd });
        }
        const nextCursor = advanceByRepeat(cursor, repeat.interval, repeat.unit);
        if (nextCursor.getTime() === cursor.getTime()) break;
        cursor = nextCursor;
        guard += 1;
      }
      return windows;
    }

    if (!start && due) {
      let cursor = new Date(due);
      while (cursor >= rangeStart && guard < 500) {
        const occurrenceStart = new Date(cursor);
        const occurrenceEnd = addDuration(occurrenceStart, durationValue, durationUnit);
        if (occurrenceStart <= rangeEnd && occurrenceEnd >= rangeStart) {
          windows.push({ start: occurrenceStart, end: occurrenceEnd });
        }
        const prevCursor = retreatByRepeat(cursor, repeat.interval, repeat.unit);
        if (prevCursor.getTime() === cursor.getTime()) break;
        cursor = prevCursor;
        guard += 1;
      }
      return windows.sort((a, b) => a.start - b.start);
    }

    return [];
  }, []);

  const [showChartFilterPanel, setShowChartFilterPanel] = useState(false);
  const chartFilterRef = useRef(null);
  const dayViewDateInputRef = useRef(null);
  const [calendarStyleMode, setCalendarStyleMode] = useState(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_STYLE_STORAGE_KEY);
      return saved === 'planner' ? 'planner' : 'monthly';
    } catch (error) {
      console.error('Failed to load calendar style mode:', error);
      return 'monthly';
    }
  });
  const statusFilterOptions = useMemo(() => ([
    { key: 'pending', label: '未完成' },
    { key: 'completed', label: '已完成' }
  ]), []);
  const priorityFilterOptions = useMemo(() => ([
    { key: 'none', label: '無優先級' },
    { key: 'high', label: '高' },
    { key: 'medium', label: '中' },
    { key: 'low', label: '低' }
  ]), []);
  const tagFilterOptionsAll = useMemo(() => ([
    { key: 'none', label: '無屬性' },
    ...(taskTags || []).map(tag => ({ key: tag.id, label: tag.name }))
  ]), [taskTags]);
  const tagFilterOptionsIncluded = useMemo(() => ([
    { key: 'none', label: '無屬性' },
    ...(taskTags || []).filter(t => t.includeInViews !== false).map(tag => ({ key: tag.id, label: tag.name }))
  ]), [taskTags]);
  const tagFilterOptions = useMemo(() =>
    activeTab === 'calendar' ? tagFilterOptionsAll : tagFilterOptionsIncluded,
    [activeTab, tagFilterOptionsAll, tagFilterOptionsIncluded]
  );
  const getAllChartFilterValues = useCallback(() => ({
    statuses: statusFilterOptions.map(opt => opt.key),
    priorities: priorityFilterOptions.map(opt => opt.key),
    tags: tagFilterOptions.map(opt => opt.key)
  }), [statusFilterOptions, priorityFilterOptions, tagFilterOptions]);

  const getDefaultChartFilters = useCallback(() => ({
    statuses: ['pending', 'completed'],
    priorities: ['none', 'high', 'medium', 'low'],
    tags: ['none', ...(taskTags || []).map(tag => tag.id)]
  }), [taskTags]);

  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_STYLE_STORAGE_KEY, calendarStyleMode);
    } catch (error) {
      console.error('Failed to save calendar style mode:', error);
    }
  }, [calendarStyleMode]);

  useEffect(() => {
    if (!showChartFilterPanel) return undefined;
    const handleOutsideClick = (event) => {
      if (chartFilterRef.current && !chartFilterRef.current.contains(event.target)) {
        setShowChartFilterPanel(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showChartFilterPanel]);

  const getTaskPriorityKey = useCallback((task) => task?.priority || 'none', []);
  const getTaskTagKey = useCallback((task) => task?.tagId || 'none', []);

  const currentTabFilterKey = activeTab === 'overview'
    ? 'overview'
    : (activeTab === 'gantt' ? 'gantt' : 'calendar');
  const currentTabFilters = currentTabFilterKey === 'overview'
    ? overviewFilters
    : (currentTabFilterKey === 'gantt' ? ganttFilters : calendarFilters);
  const setCurrentTabFilters = useCallback((updater) => {
    if (currentTabFilterKey === 'overview') setOverviewFilters(updater);
    else if (currentTabFilterKey === 'gantt') setGanttFilters(updater);
    else setCalendarFilters(updater);
  }, [currentTabFilterKey]);

  const excludedTagIds = useMemo(
    () => new Set((taskTags || []).filter(t => t.includeInViews === false).map(t => t.id)),
    [taskTags]
  );
  const isTaskExcludedByTag = useCallback((task) => {
    if (!task?.tagId) return false;
    return excludedTagIds.has(task.tagId);
  }, [excludedTagIds]);
  const tasksIncludedInViews = useMemo(
    () => allTasks.filter(task => !isTaskExcludedByTag(task)),
    [allTasks, isTaskExcludedByTag]
  );
  const matchesChartFilters = useCallback((task, filters) => {
    const activeFilters = filters || getDefaultChartFilters();
    const statusMatch = (activeFilters.statuses || []).includes(task?.status || 'pending');
    const priorityMatch = (activeFilters.priorities || []).includes(getTaskPriorityKey(task));
    const tagMatch = (activeFilters.tags || []).includes(getTaskTagKey(task));
    return statusMatch && priorityMatch && tagMatch;
  }, [getDefaultChartFilters, getTaskPriorityKey, getTaskTagKey]);

  /** 僅檢查 priority、tag（status 改為 occurrence 層級篩選） */
  const matchesChartFiltersExceptStatus = useCallback((task, filters) => {
    const activeFilters = filters || getDefaultChartFilters();
    const priorityMatch = (activeFilters.priorities || []).includes(getTaskPriorityKey(task));
    const tagMatch = (activeFilters.tags || []).includes(getTaskTagKey(task));
    return priorityMatch && tagMatch;
  }, [getDefaultChartFilters, getTaskPriorityKey, getTaskTagKey]);

  /** 該 occurrence 是否符合狀態篩選（重複任務用 occurrence 完成狀態，非重複用 task.status） */
  const occurrenceMatchesStatusFilter = useCallback((task, occurrenceStart, statuses) => {
    const s = (statuses || []).map(String);
    if (s.length === 0 || (s.includes('completed') && s.includes('pending'))) return true;
    const completed = isOccurrenceCompleted(task, occurrenceStart);
    return (completed && s.includes('completed')) || (!completed && s.includes('pending'));
  }, [isOccurrenceCompleted]);

  const overviewFilteredTasks = useMemo(
    () => tasksIncludedInViews.filter(task => matchesChartFilters(task, overviewFilters)),
    [tasksIncludedInViews, matchesChartFilters, overviewFilters]
  );
  const ganttFilteredTasks = useMemo(
    () => tasksIncludedInViews.filter(task => matchesChartFiltersExceptStatus(task, ganttFilters)),
    [tasksIncludedInViews, ganttFilters, matchesChartFiltersExceptStatus]
  );
  const calendarFilteredTasks = useMemo(
    () => allTasks.filter(task => matchesChartFiltersExceptStatus(task, calendarFilters)),
    [allTasks, calendarFilters, matchesChartFiltersExceptStatus]
  );
  const visibleSelectedInOverview = useMemo(
    () => overviewFilteredTasks.filter(task => selectedTasks.has(task.id)).length,
    [overviewFilteredTasks, selectedTasks]
  );
  const toggleSelectAllInOverview = useCallback(() => {
    const visibleIds = overviewFilteredTasks.map(task => task.id);
    setSelectedTasks(prev => {
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach(id => next.add(id));
      return next;
    });
  }, [overviewFilteredTasks, setSelectedTasks]);
  const [activeDescriptionTag, setActiveDescriptionTag] = useState('');
  const [tagPageQuery, setTagPageQuery] = useState('');
  const [draggingTagId, setDraggingTagId] = useState(null);
  const [dragOverTagId, setDragOverTagId] = useState(null);
  const [dragOverTagSide, setDragOverTagSide] = useState('before');

  const extractDescriptionTags = useCallback((content) => {
    const plainText = String(content || '').replace(/<[^>]*>/g, ' ');
    const pattern = /#([A-Za-z0-9_\u4e00-\u9fff-]+)/g;
    const seen = new Set();
    const result = [];
    let match;
    while ((match = pattern.exec(plainText)) !== null) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      const normalized = raw.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push({ raw, normalized });
    }
    return result;
  }, []);
  const extractDescriptionLinks = useCallback((content) => {
    const html = String(content || '');
    const links = [];
    const anchorUrls = new Set();

    // 先抓 Quill 產生的 <a href="...">文字</a>
    const anchorPattern = /<a\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let anchorMatch;
    while ((anchorMatch = anchorPattern.exec(html)) !== null) {
      const url = anchorMatch[1]?.trim();
      if (!url) continue;
      anchorUrls.add(url.toLowerCase());
      const inner = String(anchorMatch[2] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const label = inner || '連結';
      links.push({ url, label });
    }

    // 再補抓純文字中的 http/https
    const plain = html.replace(/<[^>]*>/g, ' ');
    const textPattern = /(https?:\/\/[^\s<>"']+)/gi;
    let textMatch;
    while ((textMatch = textPattern.exec(plain)) !== null) {
      const cleaned = textMatch[1].replace(/[),.;!?]+$/g, '').trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (anchorUrls.has(key)) continue;
      links.push({ url: cleaned, label: '連結' });
    }

    return links;
  }, []);

  const descriptionTags = useMemo(
    () => extractDescriptionTags(selectedTask?.description || ''),
    [extractDescriptionTags, selectedTask?.description]
  );
  const descriptionLinks = useMemo(
    () => extractDescriptionLinks(selectedTask?.description || ''),
    [extractDescriptionLinks, selectedTask?.description]
  );

  const tagPageTasks = useMemo(() => {
    const normalizedTag = activeDescriptionTag.toLowerCase();
    if (!normalizedTag) return [];
    return (allTasks || []).filter((task) => {
      const taskTags = extractDescriptionTags(task?.description || '');
      return taskTags.some((tag) => tag.normalized === normalizedTag);
    });
  }, [activeDescriptionTag, allTasks, extractDescriptionTags]);
  const tagPageQueryTags = useMemo(() => {
    const parsed = String(tagPageQuery || '')
      .split(/[\s,，]+/)
      .map(v => v.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(parsed));
  }, [tagPageQuery]);
  const filteredTagPageTasks = useMemo(() => {
    if (!tagPageQueryTags.length) return tagPageTasks;
    return tagPageTasks.filter((task) => {
      const taskTagSet = new Set(extractDescriptionTags(task?.description || '').map(tag => tag.normalized));
      return tagPageQueryTags.every(tag => taskTagSet.has(tag));
    });
  }, [extractDescriptionTags, tagPageQueryTags, tagPageTasks]);

  const openDescriptionTagPage = useCallback((tagValue) => {
    const normalized = String(tagValue || '').replace(/^#/, '').trim().toLowerCase();
    if (!normalized) return;
    setActiveDescriptionTag(normalized);
    setTagPageQuery('');
    setActiveTab('tag-label');
  }, [setActiveTab]);
  const closeDescriptionTagPage = useCallback(() => {
    setActiveDescriptionTag('');
    setTagPageQuery('');
    if (activeTab === 'tag-label') setActiveTab('details');
  }, [activeTab, setActiveTab]);

  const resetTagDragState = useCallback(() => {
    setDraggingTagId(null);
    setDragOverTagId(null);
    setDragOverTagSide('before');
  }, []);

  const reorderTagItems = useCallback((list, sourceId, targetId, side) => {
    const sourceIndex = list.findIndex(tag => String(tag.id) === String(sourceId));
    const targetIndex = list.findIndex(tag => String(tag.id) === String(targetId));
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return list;
    const next = [...list];
    const [moved] = next.splice(sourceIndex, 1);
    const baseIndex = next.findIndex(tag => String(tag.id) === String(targetId));
    const insertIndex = side === 'after' ? baseIndex + 1 : baseIndex;
    next.splice(insertIndex, 0, moved);
    return next;
  }, []);

  const handleTagDragStart = useCallback((event, tagId) => {
    const id = String(tagId);
    setDraggingTagId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  }, []);

  const handleTagDragOver = useCallback((event, tagId) => {
    if (!draggingTagId) return;
    event.preventDefault();
    const nextId = String(tagId);
    if (nextId === draggingTagId) {
      setDragOverTagId(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const side = (event.clientY - rect.top) < (rect.height / 2) ? 'before' : 'after';
    setDragOverTagId(nextId);
    setDragOverTagSide(side);
  }, [draggingTagId]);

  const handleTagDrop = useCallback((event, targetId) => {
    event.preventDefault();
    const target = String(targetId);
    if (!draggingTagId || draggingTagId === target) {
      resetTagDragState();
      return;
    }
    setTaskTags(prev => reorderTagItems(prev, draggingTagId, target, dragOverTagSide));
    resetTagDragState();
  }, [dragOverTagSide, draggingTagId, reorderTagItems, resetTagDragState, setTaskTags]);

  const ganttTaskRows = useMemo(() => {
    if (!ganttTimelineBase) return [];
    const rangeStart = new Date(ganttTimelineBase.startDate);
    const rangeEnd = new Date(ganttTimelineBase.endDate);
    rangeEnd.setHours(23, 59, 59, 999);
    const statuses = ganttFilters?.statuses || [];
    return ganttFilteredTasks
      .map((task) => {
        const allWindows = getTaskDisplayWindows(task, rangeStart, rangeEnd);
        const windows = allWindows
          .filter((window) => occurrenceMatchesStatusFilter(task, window.start, statuses))
          .map((window, idx) => ({
            start: window.start,
            end: window.end,
            key: `${task.id}-${window.start.getTime()}-${idx}`
          }));
        return windows.length ? { ...task, _windows: windows } : null;
      })
      .filter(Boolean);
  }, [ganttFilteredTasks, ganttTimelineBase, ganttFilters?.statuses, getTaskDisplayWindows, occurrenceMatchesStatusFilter]);

  const dayViewTasks = useMemo(() => {
    if (!dayViewDate) return [];
    const rangeStart = new Date(dayViewDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(dayViewDate);
    rangeEnd.setHours(23, 59, 59, 999);
    const statuses = ganttFilters?.statuses || [];
    return ganttFilteredTasks.filter((task) => {
      const windows = getTaskDisplayWindows(task, rangeStart, rangeEnd);
      return windows.some((w) => occurrenceMatchesStatusFilter(task, w.start, statuses));
    });
  }, [ganttFilteredTasks, dayViewDate, ganttFilters?.statuses, getTaskDisplayWindows, occurrenceMatchesStatusFilter]);

  const getLinkedCount = (field, value) => {
    const all = getAllChartFilterValues();
    const countSource = activeTab === 'calendar' ? allTasks : tasksIncludedInViews;
    return countSource.filter(task => {
      const tempFilters = {
        statuses: field === 'statuses' ? all.statuses : currentTabFilters.statuses,
        priorities: field === 'priorities' ? all.priorities : currentTabFilters.priorities,
        tags: field === 'tags' ? all.tags : currentTabFilters.tags
      };
      if (!matchesChartFilters(task, tempFilters)) return false;
      if (field === 'statuses') return (task?.status || 'pending') === value;
      if (field === 'priorities') return getTaskPriorityKey(task) === value;
      return getTaskTagKey(task) === value;
    }).length;
  };

  const toggleChartFilterValue = (field, value) => {
    setCurrentTabFilters(prev => {
      const current = prev[field] || [];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  };

  const clearChartFilters = () => {
    setCurrentTabFilters({ statuses: [], priorities: [], tags: [] });
  };
  const selectAllChartFilters = () => {
    setCurrentTabFilters(getAllChartFilterValues());
  };

  const renderChartFilterPanel = () => (
    <div style={{ position: 'absolute', top: '34px', right: 0, width: '320px', background: '#fff', border: '1px solid #e1e5e9', borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', zIndex: 20, padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong style={{ fontSize: '13px', color: '#333' }}>篩選</strong>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={selectAllChartFilters} style={{ border: 'none', background: 'transparent', color: '#52D0FF', cursor: 'pointer', fontSize: '12px' }}>全選</button>
          <button onClick={clearChartFilters} style={{ border: 'none', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px' }}>清除</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>狀態</div>
          {statusFilterOptions.map(opt => {
            const count = getLinkedCount('statuses', opt.key);
            const checked = currentTabFilters.statuses.includes(opt.key);
            return (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: count > 0 || checked ? '#333' : '#bbb', marginBottom: '4px' }}>
                <input className="chart-filter-checkbox" type="checkbox" checked={checked} onChange={() => toggleChartFilterValue('statuses', opt.key)} disabled={!count && !checked} />
                <span>{opt.label} ({count})</span>
              </label>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>優先級</div>
          {priorityFilterOptions.map(opt => {
            const count = getLinkedCount('priorities', opt.key);
            const checked = currentTabFilters.priorities.includes(opt.key);
            return (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: count > 0 || checked ? '#333' : '#bbb', marginBottom: '4px' }}>
                <input className="chart-filter-checkbox" type="checkbox" checked={checked} onChange={() => toggleChartFilterValue('priorities', opt.key)} disabled={!count && !checked} />
                <span>{opt.label} ({count})</span>
              </label>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>屬性</div>
          {tagFilterOptions.map(opt => {
            const count = getLinkedCount('tags', opt.key);
            const checked = currentTabFilters.tags.includes(opt.key);
            return (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: count > 0 || checked ? '#333' : '#bbb', marginBottom: '4px' }}>
                <input className="chart-filter-checkbox" type="checkbox" checked={checked} onChange={() => toggleChartFilterValue('tags', opt.key)} disabled={!count && !checked} />
                <span>{opt.label} ({count})</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  const getPosition = (date) => {
    if (!ganttTimelineBase || !date) return 0;
    const { startDate } = ganttTimelineBase;
    const d = new Date(date);
    if (ganttZoom === 'day') return ((d - startDate) / (1000 * 60 * 60)) * ganttColumnWidth;
    if (ganttZoom === 'week') return Math.floor((d - startDate) / (1000 * 60 * 60 * 24)) * 41;
    const monthsDiff = (d.getFullYear() - startDate.getFullYear()) * 12 + (d.getMonth() - startDate.getMonth());
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return monthsDiff * 41 + (Math.min(Math.max(0, Math.floor((d - monthStart) / (1000 * 60 * 60 * 24))), daysInMonth) / daysInMonth) * 41;
  };

  const getTaskBarColor = (task) => {
    if (ganttTaskDisplayMode === 'level') {
      const colors = { 'A': '#ff4d4d', 'B': '#ffa64d', 'C': '#4da6ff', 'D': '#4dff4d', 'NONE': '#808080' };
      return colors[task.levelType || task.level] || '#808080';
    }
    if (ganttTaskDisplayMode === 'priority') {
      if (task.priority === 'high') return '#f44336';
      if (task.priority === 'medium') return '#FF9800';
      if (task.priority === 'low') return '#4CAF50';
      return '#E0E0E0';
    }
    if (ganttTaskDisplayMode === 'custom' && task.tagId) return getTagColor(task.tagId) || '#E0E0E0';
    return task.status === 'completed' ? '#4CAF50' : '#E0E0E0';
  };

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

  const TASK_LAYOUT_STORAGE_PREFIX = 'taskDetailLayout.v3.task';
  const TYPE_LAYOUT_STORAGE_PREFIX = 'taskDetailLayout.v2';
  const LEGACY_LAYOUT_STORAGE_KEY = 'taskDetailLayout.v1';
  const LAYOUT_TEMPLATE_STORAGE_KEY = 'taskDetailLayout.templates.v1';

  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER);
  const [hiddenSections, setHiddenSections] = useState([]);
  const [draggingSectionId, setDraggingSectionId] = useState(null);
  const [dragOverSectionId, setDragOverSectionId] = useState(null);
  const [layoutInitialized, setLayoutInitialized] = useState(false);
  const [layoutTemplates, setLayoutTemplates] = useState([]);
  const [layoutTemplatesInitialized, setLayoutTemplatesInitialized] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const currentTaskId = selectedTask?.id || 'default';
  const currentTaskType = selectedTask?.taskType || 'default';
  const currentLayoutStorageKey = `${TASK_LAYOUT_STORAGE_PREFIX}.${currentTaskId}`;
  const currentTypeLayoutStorageKey = `${TYPE_LAYOUT_STORAGE_PREFIX}.${currentTaskType}`;

  useLayoutEffect(() => {
    setLayoutInitialized(false);
    try {
      const saved = localStorage.getItem(currentLayoutStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const nextOrder = Array.isArray(parsed?.order) ? parsed.order : DEFAULT_SECTION_ORDER;
        const normalizedOrder = nextOrder.filter(id => DEFAULT_SECTION_ORDER.includes(id));
        DEFAULT_SECTION_ORDER.forEach(id => {
          if (!normalizedOrder.includes(id)) normalizedOrder.push(id);
        });
        setSectionOrder(normalizedOrder);
        setHiddenSections(Array.isArray(parsed?.hidden) ? parsed.hidden : []);
      } else {
        const typeSaved = localStorage.getItem(currentTypeLayoutStorageKey);
        if (typeSaved) {
          const parsedType = JSON.parse(typeSaved);
          const nextOrder = Array.isArray(parsedType?.order) ? parsedType.order : DEFAULT_SECTION_ORDER;
          const normalizedOrder = nextOrder.filter(id => DEFAULT_SECTION_ORDER.includes(id));
          DEFAULT_SECTION_ORDER.forEach(id => {
            if (!normalizedOrder.includes(id)) normalizedOrder.push(id);
          });
          setSectionOrder(normalizedOrder);
          setHiddenSections(Array.isArray(parsedType?.hidden) ? parsedType.hidden : []);
        } else {
          // 兼容舊版全域布局資料：若新 key 尚無資料，先嘗試沿用 v1。
          const legacySaved = localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
          if (legacySaved) {
            const parsedLegacy = JSON.parse(legacySaved);
            const nextOrder = Array.isArray(parsedLegacy?.order) ? parsedLegacy.order : DEFAULT_SECTION_ORDER;
            const normalizedOrder = nextOrder.filter(id => DEFAULT_SECTION_ORDER.includes(id));
            DEFAULT_SECTION_ORDER.forEach(id => {
              if (!normalizedOrder.includes(id)) normalizedOrder.push(id);
            });
            setSectionOrder(normalizedOrder);
            setHiddenSections(Array.isArray(parsedLegacy?.hidden) ? parsedLegacy.hidden : []);
          } else {
            setSectionOrder(DEFAULT_SECTION_ORDER);
            setHiddenSections([]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load task detail layout:', error);
      setSectionOrder(DEFAULT_SECTION_ORDER);
      setHiddenSections([]);
    } finally {
      setLayoutInitialized(true);
    }
  }, [currentLayoutStorageKey, currentTypeLayoutStorageKey]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_TEMPLATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLayoutTemplates(Array.isArray(parsed) ? parsed : []);
      } else {
        setLayoutTemplates([]);
      }
    } catch (error) {
      console.error('Failed to load layout templates:', error);
      setLayoutTemplates([]);
    } finally {
      setLayoutTemplatesInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!layoutTemplatesInitialized) return;
    try {
      localStorage.setItem(LAYOUT_TEMPLATE_STORAGE_KEY, JSON.stringify(layoutTemplates));
    } catch (error) {
      console.error('Failed to save layout templates:', error);
    }
  }, [layoutTemplates, layoutTemplatesInitialized]);

  useEffect(() => {
    if (activeTab !== 'gantt' && activeTab !== 'calendar') {
      setShowChartFilterPanel(false);
    }
  }, [activeTab]);

  const getSectionOrder = (id) => {
    const idx = sectionOrder.indexOf(id);
    return idx === -1 ? DEFAULT_SECTION_ORDER.length + 1 : idx;
  };

  const persistLayout = (nextOrder, nextHidden) => {
    try {
      localStorage.setItem(currentLayoutStorageKey, JSON.stringify({ order: nextOrder, hidden: nextHidden }));
    } catch (error) {
      console.error('Failed to persist task detail layout:', error);
    }
  };

  const isSectionVisible = (id) => !hiddenSections.includes(id);
  const isSectionAvailable = (id) => {
    if (id === 'subtasks') return !!(selectedTask?.children && selectedTask.children.length > 0);
    return true;
  };

  const handleHideSection = (id) => {
    if (!REMOVABLE_SECTION_IDS.has(id)) return;
    setHiddenSections(prev => {
      const nextHidden = prev.includes(id) ? prev : [...prev, id];
      persistLayout(sectionOrder, nextHidden);
      return nextHidden;
    });
  };

  const handleShowSection = (id) => {
    setHiddenSections(prev => {
      const nextHidden = prev.filter(item => item !== id);
      persistLayout(sectionOrder, nextHidden);
      return nextHidden;
    });
  };

  const handleResetLayout = () => {
    setSectionOrder(DEFAULT_SECTION_ORDER);
    setHiddenSections([]);
    persistLayout(DEFAULT_SECTION_ORDER, []);
  };

  const handleSaveLayoutTemplate = () => {
    const name = window.prompt('請輸入版面模板名稱');
    if (!name || !name.trim()) return;
    const trimmedName = name.trim();
    setLayoutTemplates(prev => {
      const next = prev.filter(t => t.name !== trimmedName);
      next.push({
        id: `tpl-${Date.now()}`,
        name: trimmedName,
        order: [...sectionOrder],
        hidden: [...hiddenSections],
        createdAt: new Date().toISOString()
      });
      try {
        localStorage.setItem(LAYOUT_TEMPLATE_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Failed to save layout templates immediately:', error);
      }
      return next;
    });
  };

  const handleApplyLayoutTemplate = () => {
    if (!selectedTemplateId) return;
    const target = layoutTemplates.find(t => t.id === selectedTemplateId);
    if (!target) return;
    const normalizedOrder = target.order.filter(id => DEFAULT_SECTION_ORDER.includes(id));
    DEFAULT_SECTION_ORDER.forEach(id => {
      if (!normalizedOrder.includes(id)) normalizedOrder.push(id);
    });
    setSectionOrder(normalizedOrder);
    const nextHidden = Array.isArray(target.hidden) ? target.hidden : [];
    setHiddenSections(nextHidden);
    persistLayout(normalizedOrder, nextHidden);
  };

  const handleDeleteLayoutTemplate = () => {
    if (!selectedTemplateId) return;
    const target = layoutTemplates.find(t => t.id === selectedTemplateId);
    if (!target) return;
    if (!window.confirm(`確定刪除版面模板「${target.name}」？`)) return;
    setLayoutTemplates(prev => {
      const next = prev.filter(t => t.id !== selectedTemplateId);
      try {
        localStorage.setItem(LAYOUT_TEMPLATE_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Failed to delete layout template immediately:', error);
      }
      return next;
    });
    setSelectedTemplateId('');
  };

  const handleSectionDragStart = (id) => {
    if (!isLayoutEditing || !DRAGGABLE_SECTION_IDS.has(id)) return;
    setDraggingSectionId(id);
  };

  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
  };

  const handleSectionDragOver = (e, id) => {
    if (!isLayoutEditing || !draggingSectionId || draggingSectionId === id) return;
    if (!DRAGGABLE_SECTION_IDS.has(id)) return;
    e.preventDefault();
    setDragOverSectionId(id);
  };

  const handleSectionDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingSectionId || draggingSectionId === targetId) {
      setDragOverSectionId(null);
      return;
    }
    if (!DRAGGABLE_SECTION_IDS.has(draggingSectionId) || !DRAGGABLE_SECTION_IDS.has(targetId)) {
      setDragOverSectionId(null);
      return;
    }

    const next = sectionOrder.filter(id => id !== draggingSectionId);
    const targetIndex = next.indexOf(targetId);
    next.splice(targetIndex, 0, draggingSectionId);
    setSectionOrder(next);
    persistLayout(next, hiddenSections);
    setDragOverSectionId(null);
  };

  const getLayoutItemProps = (id, options = {}) => {
    const { hideable = false, draggable = true } = options;
    const canDrag = isLayoutEditing && draggable && DRAGGABLE_SECTION_IDS.has(id);
    return {
      className: `layout-item ${canDrag ? 'draggable-item' : ''} ${draggingSectionId === id ? 'dragging' : ''} ${dragOverSectionId === id ? 'drag-over' : ''}`.trim(),
      'data-layout-id': id,
      style: {
        order: getSectionOrder(id),
        display: hideable && !isSectionVisible(id) ? 'none' : undefined
      },
      draggable: canDrag,
      onDragStart: () => handleSectionDragStart(id),
      onDragEnd: handleSectionDragEnd,
      onDragOver: (e) => handleSectionDragOver(e, id),
      onDrop: (e) => handleSectionDrop(e, id)
    };
  };

  const toolbarToggleSectionIds = ['task-properties', 'start-date', 'reminders', 'repeat-settings', 'description', 'subtasks', 'created-at'];
  const toggleSectionVisibility = (id) => {
    if (!REMOVABLE_SECTION_IDS.has(id)) return;
    if (isSectionVisible(id)) handleHideSection(id);
    else handleShowSection(id);
  };

  const renderTimelineHeader = () => {
    if (!ganttTimelineBase) return null;
    const { startDate, endDate } = ganttTimelineBase;
    if (ganttZoom === 'day') {
      return (
        <div className="gantt-timeline-header-container day-view-header">
          <div className="gantt-task-header-row">
            <div className="gantt-time-label-cell">時間</div>
            {dayViewTasks.map(task => <div key={task.id} className="gantt-task-header-cell" style={{ width: `${ganttColumnWidth}px`, flex: `0 0 ${ganttColumnWidth}px` }} onClick={() => { handleOverviewTaskClick(task.id); setActiveTab('details'); }}><span className="task-title-truncated">{task.title}</span></div>)}
          </div>
        </div>
      );
    }
    const dates = []; let curr = new Date(startDate);
    while (curr <= endDate) { dates.push(new Date(curr)); if (ganttZoom === 'week') curr.setDate(curr.getDate() + 1); else curr.setMonth(curr.getMonth() + 1); }
    return (
      <div className="gantt-timeline-header-container">
        <div className="gantt-year-row">{dates.map((d, i) => <div key={i} className="gantt-year-cell" style={{ width: '41px', flex: '0 0 41px' }}>{(ganttZoom === 'week' ? (d.getMonth() === 0 && d.getDate() === 1) : d.getMonth() === 0) ? d.getFullYear() : ''}</div>)}</div>
        {ganttZoom === 'week' && <div className="gantt-weekday-row">{dates.map((d, i) => <div key={i} className="gantt-weekday-cell" style={{ width: '41px', flex: '0 0 41px', backgroundColor: d.toDateString() === new Date().toDateString() ? '#52D0FF' : (d.getFullYear() % 2 === 0 ? '#e9ecef' : '#d6d9dc') }}>{['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}</div>)}</div>}
        <div className="gantt-date-row">{dates.map((d, i) => <div key={i} className="gantt-timeline-cell" style={{ width: '41px', flex: '0 0 41px', backgroundColor: d.toDateString() === new Date().toDateString() ? '#52D0FF' : (d.getFullYear() % 2 === 0 ? '#e9ecef' : '#d6d9dc') }}>{ganttZoom === 'week' ? `${d.getMonth() + 1}/${d.getDate()}` : d.toLocaleDateString('zh-TW', { month: 'short' })}</div>)}</div>
      </div>
    );
  };

  const renderDayTaskBar = (task, hourIndex) => {
    if (hourIndex !== 0) return null;
    const dayStart = new Date(dayViewDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayViewDate);
    dayEnd.setHours(23, 59, 59, 999);
    const windows = getTaskDisplayWindows(task, dayStart, dayEnd);
    if (!windows.length) return null;
    const start = windows[0].start;
    const due = windows[0].end;
    let taskStartTime = 0, taskEndTime = 1440; const currentStr = dayViewDate.toDateString();
    if (start && due) {
      if (start.toDateString() === currentStr && due.toDateString() === currentStr) { taskStartTime = start.getHours() * 60 + start.getMinutes(); taskEndTime = due.getHours() * 60 + due.getMinutes(); }
      else if (start.toDateString() === currentStr) { taskStartTime = start.getHours() * 60 + start.getMinutes(); }
      else if (due.toDateString() === currentStr) { taskEndTime = due.getHours() * 60 + due.getMinutes(); }
    } else if (start && start.toDateString() === currentStr) taskStartTime = start.getHours() * 60 + start.getMinutes();
    else if (due && due.toDateString() === currentStr) taskEndTime = due.getHours() * 60 + due.getMinutes();
    else return null;
    const heightPerMinute = 30 / 60, height = (taskEndTime - taskStartTime) * heightPerMinute;
    let topOffset = taskStartTime * heightPerMinute + Math.floor(taskStartTime / 60);
    const color = getTaskBarColor(task);
    return (
      <div className="gantt-task-bar day-task-bar" style={{ position: 'absolute', left: 0, top: `${topOffset}px`, width: `${ganttColumnWidth}px`, height: `${height}px`, backgroundColor: color, border: task.taskType === 'one-time' ? `2px solid ${getBorderColor(color)}` : 'none', cursor: 'pointer', zIndex: 10, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 'bold', boxSizing: 'border-box', padding: '0 4px' }} onClick={() => { handleOverviewTaskClick(task.id); setActiveTab('details'); handleTaskHoverLeave(); }} onMouseEnter={(e) => handleTaskHover(e, task)} onMouseMove={(e) => handleTaskHover(e, task)} onMouseLeave={handleTaskHoverLeave}>
        <span className="task-title-vertical">{task.title.split('').map((c, i) => <span key={i}>{c}</span>)}</span>
      </div>
    );
  };

  const renderTaskBar = (task) => {
    const start = task._windowStart ? new Date(task._windowStart) : (task.details?.startDate ? new Date(task.details.startDate) : (ganttTimelineBase ? new Date(ganttTimelineBase.startDate) : null));
    const due = task._windowEnd ? new Date(task._windowEnd) : (task.details?.dueDate ? new Date(task.details.dueDate) : (ganttTimelineBase ? new Date(ganttTimelineBase.endDate) : null));
    if (!start || !due) return null;
    const left = getPosition(start), width = Math.max(20, getPosition(due) - left + (ganttZoom === 'week' ? 41 : 0)), color = getTaskBarColor(task);
    return <div key={task._instanceKey || `${task.id}-${start.getTime()}`} className="gantt-task-bar" style={{ left: `${left}px`, width: `${width}px`, backgroundColor: color, border: task.taskType === 'one-time' ? `2px solid ${getBorderColor(color)}` : 'none', cursor: 'pointer', zIndex: 10 }} onClick={() => { handleOverviewTaskClick(task.id); setActiveTab('details'); handleTaskHoverLeave(); }} onMouseEnter={(e) => handleTaskHover(e, task)} onMouseMove={(e) => handleTaskHover(e, task)} onMouseLeave={handleTaskHoverLeave}><span className="gantt-task-title">{task.title}</span></div>;
  };

  const handleCalendarDateCreate = useCallback((date) => {
    if (typeof onCalendarDateClickForAddTask === 'function') {
      onCalendarDateClickForAddTask(date);
    }
  }, [onCalendarDateClickForAddTask]);

  const getRowWindowsForGantt = (row) => {
    const windows = row?._windows || [];
    if (!windows.length) return [];
    if (ganttZoom !== 'month') return windows;
    const sorted = [...windows].sort((a, b) => new Date(a.start) - new Date(b.start));
    return [{
      start: sorted[0].start,
      end: sorted[sorted.length - 1].end,
      key: `${row.id}-month-merged`
    }];
  };

  useEffect(() => {
    if (activeTab !== 'gantt' || !ganttTimelineBase) return;
    const host = ganttTimelineRef?.current;
    if (!host) return;
    const timeline = host.querySelector('.gantt-timeline');
    if (!timeline) return;
    if (ganttZoom === 'week') {
      const todayPos = Math.max(0, getPosition(new Date()) - 120);
      timeline.scrollLeft = todayPos;
      return;
    }
    if (ganttZoom === 'month') {
      timeline.scrollLeft = 0;
    }
  }, [activeTab, ganttZoom, ganttTimelineBase, ganttTimelineRef]);

  const renderCalendarView = () => {
    const year = calendarDate.getFullYear(), month = calendarDate.getMonth(), firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0), firstDayOfWeek = firstDay.getDay(), daysInMonth = lastDay.getDate();
    const gridStart = new Date(year, month, 1 - firstDayOfWeek);
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
    const calendarDays = Array.from({ length: totalCells }, (_, idx) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + idx);
      return {
        day: date.getDate(),
        date,
        isToday: date.toDateString() === new Date().toDateString(),
        isCurrentMonth: date.getMonth() === month
      };
    });
    const weeks = []; for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7));
    const weekData = weeks.map((week) => {
      let weekStart = new Date(week[0].date);
      weekStart.setHours(0,0,0,0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23,59,59,999);
      const calStatuses = calendarFilters?.statuses || [];
      const visibleInWeek = calendarFilteredTasks.flatMap((task) =>
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
        const actualStart = task.startDate < weekStart ? weekStart : task.startDate, actualEnd = task.endDate > weekEnd ? weekEnd : task.endDate, startCol = actualStart.getDay(), endCol = actualEnd.getDay(), span = endCol - startCol + 1;
        let layer = 0; while (true) { let canUse = true; for (let c = startCol; c <= endCol; c++) { if (usedLayers.has(`${c}-${layer}`)) { canUse = false; break; } } if (canUse) { for (let c = startCol; c <= endCol; c++) usedLayers.set(`${c}-${layer}`, true); return { ...task, startCol, span, layer }; } layer++; }
      });
      const maxLayer = layeredSegments.length > 0 ? Math.max(...layeredSegments.map(s => s.layer)) + 1 : 0;
      return { week, layeredSegments, rowHeight: maxLayer <= 3 ? 100 : 30 + (maxLayer * 24) + 10, weekStart, weekEnd };
    });
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    if (calendarStyleMode === 'planner') {
      const plannerMonths = Array.from({ length: 6 }, (_, idx) => new Date(year, month + idx, 1));
      const plannerStart = new Date(plannerMonths[0].getFullYear(), plannerMonths[0].getMonth(), 1, 0, 0, 0, 0);
      const plannerEnd = new Date(plannerMonths[5].getFullYear(), plannerMonths[5].getMonth() + 1, 0, 23, 59, 59, 999);
      const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
      const getDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      const dayTaskMap = new Map();
      const calStatuses = calendarFilters?.statuses || [];
      calendarFilteredTasks.forEach((task) => {
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
                _plannerColor: getTaskBarColor(task)
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
        return {
          year: y,
          month: m,
          startDow: new Date(y, m, 1).getDay(),
          daysInMonth: new Date(y, m + 1, 0).getDate()
        };
      });
      const plannerRowCount = Math.max(...plannerMonthMeta.map(meta => meta.startDow + meta.daysInMonth));

      return (
        <div className="calendar-view" style={{ width: '100%', margin: 0, padding: 0, background: 'transparent' }}>
          <div className="calendar-header" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: isMobile ? '0 0 16px 0' : '0 0 44px 0', width: '100%', boxSizing: 'border-box', zIndex: 2 }}>
            <button onClick={() => setCalendarDate(new Date(year, month - 6, 1))} style={{ position: 'absolute', left: '20px', background: '#52D0FF', color: 'white', border: 'none', borderRadius: '4px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', zIndex: 5 }}>←</button>
            <h3 style={{ margin: 0, fontSize: '20px', textAlign: 'center' }}>
              {plannerMonths[0].getFullYear()}年{plannerMonths[0].getMonth() + 1}月 - {plannerMonths[5].getFullYear()}年{plannerMonths[5].getMonth() + 1}月
            </h3>
            <div className="calendar-header-right" style={{ position: 'absolute', top: '0', right: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <button onClick={() => setCalendarDate(new Date(year, month + 6, 1))} style={{ background: '#52D0FF', color: 'white', border: 'none', borderRadius: '4px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>→</button>
            </div>
          </div>
          <div style={{ border: '1px solid #d8dde3', background: '#fff', borderRadius: '6px', overflowX: 'hidden' }}>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, minmax(0, 1fr))', borderBottom: '1px solid #d8dde3', background: '#f8f9fb' }}>
                <div style={{ height: '36px', borderRight: '1px solid #d8dde3' }} />
                {plannerMonths.map((mDate) => (
                  <div key={`${mDate.getFullYear()}-${mDate.getMonth()}`} style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#3a4350', borderRight: '1px solid #d8dde3' }}>
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
                    <div style={{ minHeight: `${rowHeight}px`, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontSize: '12px', color: '#5d6775', borderRight: '1px solid #d8dde3', background: rowIdx % 2 === 0 ? '#fbfcfd' : '#fff', paddingTop: '8px', boxSizing: 'border-box' }}>
                      <span style={{ width: '12px', textAlign: 'center', fontWeight: 600 }}>{weekdayNames[rowIdx % 7]}</span>
                    </div>
                    {plannerMonthMeta.map((meta, colIdx) => {
                      const dayNum = rowIdx - meta.startDow + 1;
                      const inMonth = dayNum >= 1 && dayNum <= meta.daysInMonth;
                      const candidate = inMonth ? new Date(meta.year, meta.month, dayNum) : null;
                      const dayTasks = inMonth ? (dayTaskMap.get(getDateKey(candidate)) || []) : [];
                      return (
                        <div key={`planner-cell-${rowIdx}-${colIdx}`} style={{ minHeight: `${rowHeight}px`, borderRight: colIdx < plannerMonths.length - 1 ? '1px solid #eef1f4' : 'none', padding: '3px 5px', background: inMonth ? '#fff' : '#f7f8fa', boxSizing: 'border-box' }}>
                          {inMonth ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                              <button
                                onClick={() => handleCalendarDateCreate(candidate)}
                                style={{ border: 'none', background: 'transparent', color: '#9aa3af', fontSize: '11px', lineHeight: '14px', cursor: 'pointer', textAlign: 'left', padding: 0, width: 'fit-content' }}
                              >
                                {dayNum}
                              </button>
                              {dayTasks.map((taskItem, taskIdx) => (
                                <button
                                  key={taskItem._instanceKey || `${taskItem.id}-${taskIdx}`}
                                  onClick={(e) => { e.stopPropagation(); handleOverviewTaskClick(taskItem.id); setActiveTab('details'); handleTaskHoverLeave(); }}
                                  onMouseEnter={(e) => handleTaskHover(e, taskItem)}
                                  onMouseMove={(e) => handleTaskHover(e, taskItem)}
                                  onMouseLeave={handleTaskHoverLeave}
                                  style={{ width: '100%', border: 'none', background: taskItem._plannerColor, color: taskItem._plannerColor === '#E0E0E0' ? '#333' : '#fff', borderRadius: '3px', height: '20px', fontSize: '10px', fontWeight: 600, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  {taskItem.title}
                                </button>
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
          </div>
        </div>
      );
    }
    return (
      <div className="calendar-view" style={{ width: '100%', margin: 0, padding: 0, background: 'transparent' }}>
        <div className="calendar-header" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: isMobile ? '0 0 16px 0' : '0 0 44px 0', width: '100%', boxSizing: 'border-box', zIndex: 2 }}>
          <button onClick={() => setCalendarDate(new Date(year, month - 1, 1))} style={{ position: 'absolute', left: '20px', background: '#52D0FF', color: 'white', border: 'none', borderRadius: '4px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', zIndex: 5 }}>←</button>
          <h3 style={{ margin: 0, fontSize: '20px', textAlign: 'center' }}>{year}年 {monthNames[month]}</h3>
          <div className="calendar-header-right" style={{ position: 'absolute', top: '0', right: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <button onClick={() => setCalendarDate(new Date(year, month + 1, 1))} style={{ background: '#52D0FF', color: 'white', border: 'none', borderRadius: '4px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>→</button>
          </div>
        </div>
        <div className="calendar-grid" style={{ border: '1px solid #eee', background: '#fff', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f9fa', borderBottom: '1px solid #eee', width: '100%', boxSizing: 'border-box' }}>{['日', '一', '二', '三', '四', '五', '六'].map((w, i) => <div key={w} style={{ height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#666', borderRight: i < 6 ? '1px solid #eee' : 'none', boxSizing: 'border-box' }}>{w}</div>)}</div>
          <div className="calendar-rows-container" style={{ width: '100%', boxSizing: 'border-box' }}>
            {weekData.map((week, wIdx) => (
              <div key={wIdx} style={{ position: 'relative', height: `${week.rowHeight}px`, borderBottom: '1px solid #eee', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, boxSizing: 'border-box' }}>
                  {week.week.map((d, dIdx) => (
                    <div
                      key={dIdx}
                      onClick={() => d && handleCalendarDateCreate(d.date)}
                      style={{ borderRight: dIdx < 6 ? '1px solid #eee' : 'none', position: 'relative', background: d?.isToday ? 'rgba(82, 208, 255, 0.02)' : 'transparent', boxSizing: 'border-box', cursor: d ? 'pointer' : 'default' }}
                    >
                      {d && <div style={{ height: '30px', padding: '4px 8px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', boxSizing: 'border-box' }}><span style={{ fontSize: '13px', color: d.isCurrentMonth ? (d.isToday ? '#52D0FF' : '#666') : '#b0b5bd', fontWeight: d.isToday ? 'bold' : 'normal', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: d.isToday ? 'rgba(82, 208, 255, 0.1)' : 'transparent' }}>{d.day}</span></div>}
                    </div>
                  ))}
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', boxSizing: 'border-box' }}>
                  {week.layeredSegments.map((seg, sIdx) => {
                    const color = getTaskBarColor(seg), isTrueStart = seg.startDate >= week.weekStart, isTrueEnd = seg.endDate >= week.weekEnd, isHovered = hoveredTaskId === seg.id;
                    return (
                      <div key={seg._instanceKey || sIdx} style={{ position: 'absolute', left: `${(seg.startCol / 7) * 100}%`, width: `${(seg.span / 7) * 100}%`, top: `${30 + (seg.layer * 24)}px`, height: '20px', padding: '0 4px', boxSizing: 'border-box', zIndex: isHovered ? 20 : 10, pointerEvents: 'auto' }}>
                        <div style={{ width: '100%', height: '100%', backgroundColor: color, border: seg.taskType === 'one-time' ? `2px solid ${getBorderColor(color)}` : 'none', color: color === '#E0E0E0' ? '#333' : 'white', borderTopLeftRadius: isTrueStart ? '3px' : '0', borderBottomLeftRadius: isTrueStart ? '3px' : '0', borderTopRightRadius: isTrueEnd ? '3px' : '0', borderBottomRightRadius: isTrueEnd ? '3px' : '0', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', padding: '0 6px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxShadow: isHovered ? '0 4px 8px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)', boxSizing: 'border-box', filter: isHovered ? 'brightness(1.1)' : 'none', transform: isHovered ? 'scaleY(1.1)' : 'none', transition: 'all 0.15s ease' }} onClick={(e) => { e.stopPropagation(); handleOverviewTaskClick(seg.id); setActiveTab('details'); handleTaskHoverLeave(); }} onMouseEnter={(e) => { handleTaskHover(e, seg); setHoveredTaskId(seg.id); }} onMouseMove={(e) => handleTaskHover(e, seg)} onMouseLeave={() => { handleTaskHoverLeave(); setHoveredTaskId(null); }}>{seg.title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (!selectedTask && activeTab === 'details') {
    return (
      <div className={`task-details-container ${isLayoutEditing ? 'editing-mode' : ''}`}>
        <div className="layout-control">
          {isMobile && onTreeToggle && (
            <button type="button" className="project-tree-toggle layout-control-tree-toggle" onClick={onTreeToggle} aria-label="開啟任務樹">
              <IoList size={24} />
            </button>
          )}
          {isMobile && onTemplateClick && (
            <button type="button" className="template-btn layout-control-btn layout-control-btn-right" onClick={onTemplateClick}><IoCloudDownloadOutline /> 任務模板</button>
          )}
          <button className={`layout-edit-btn ${isLayoutEditing ? 'active' : ''}`} onClick={() => setIsLayoutEditing(!isLayoutEditing)}>版面布局</button>
        </div>
        <div className="task-content-layout">
          <div className="task-details">
            <div className="task-tabs" style={{ marginBottom: '20px' }}>
              {['details', 'overview', 'tags', 'gantt', 'calendar'].map(tab => (
                <button key={tab} className={`tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab === 'details' ? (isMobile ? '詳細' : '任務詳細') : tab === 'overview' ? (isMobile ? '概覽' : '任務概覽') : tab === 'tags' ? (isMobile ? '屬性' : '任務屬性') : tab === 'gantt' ? '甘特圖' : '日曆'}
                </button>
              ))}
            </div>
            <div className="task-tab-content" style={{ padding: '24px 0', color: '#666', fontSize: '14px' }}>
              請從左側選單選擇或新增任務
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-details-container ${isLayoutEditing ? 'editing-mode' : ''}`}>
      <div className="layout-control">
        {isMobile && onTreeToggle && (
          <button type="button" className="project-tree-toggle layout-control-tree-toggle" onClick={onTreeToggle} aria-label="開啟任務樹">
            <IoList size={24} />
          </button>
        )}
        {isMobile && onTemplateClick && (
          <button type="button" className="template-btn layout-control-btn layout-control-btn-right" onClick={onTemplateClick}><IoCloudDownloadOutline /> 任務模板</button>
        )}
        <button className={`layout-edit-btn ${isLayoutEditing ? 'active' : ''}`} onClick={() => setIsLayoutEditing(!isLayoutEditing)}>版面布局</button>
      </div>
      <div className={`task-content-layout ${toolbarCollapsed ? 'toolbar-collapsed' : ''}`}>
        <div className="task-details">
          <div className="task-tabs" style={{ marginBottom: '20px' }}>
            {['details', 'overview', 'tags', 'gantt', 'calendar'].map(tab => (
              <button key={tab} className={`tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab === 'details' ? (isMobile ? '詳細' : '任務詳細') : tab === 'overview' ? (isMobile ? '概覽' : '任務概覽') : tab === 'tags' ? (isMobile ? '屬性' : '任務屬性') : tab === 'gantt' ? '甘特圖' : '日曆'}
              </button>
            ))}
            {activeDescriptionTag && (
              <button
                className={`tab-button ${activeTab === 'tag-label' ? 'active' : ''}`}
                onClick={() => setActiveTab('tag-label')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Tag標籤頁</span>
                <span style={{ color: '#52D0FF', fontWeight: 700 }}>#{activeDescriptionTag}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); closeDescriptionTagPage(); }}
                  style={{ marginLeft: '2px', color: '#999', fontWeight: 700, cursor: 'pointer' }}
                >
                  ×
                </span>
              </button>
            )}
          </div>
          <div className="task-tab-content" style={{ width: '100%', display: 'block' }}>
            {activeTab === 'details' && selectedTask && layoutInitialized && (
              <div className="task-details" style={{ width: '100%', maxWidth: '1600px', background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', boxSizing: 'border-box', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
                <div {...getLayoutItemProps('task-header')}>
                  <TaskHeaderSection
                    selectedTask={selectedTask}
                    isGeneratedTask={isGeneratedTask}
                    handleBackToOriginalTask={handleBackToOriginalTask}
                    editingTaskId={editingTaskId}
                    editingText={editingText}
                    setEditingText={setEditingText}
                    handleEditKeyPress={handleEditKeyPress}
                    saveEditTask={saveEditTask}
                    startEditTask={startEditTask}
                    handleTaskDetailUpdate={handleTaskDetailUpdate}
                    handleTaskDelete={handleTaskDelete}
                  />
                </div>
                <div {...getLayoutItemProps('task-properties', { hideable: true })}>
                  <TaskPropertiesSection
                    selectedTask={selectedTask}
                    taskTags={taskTags}
                    getTagColor={getTagColor}
                    tagDropdownOpen={tagDropdownOpen}
                    setTagDropdownOpen={setTagDropdownOpen}
                    handleTaskDetailUpdate={handleTaskDetailUpdate}
                    isMobile={isMobile}
                  />
                </div>
                <div {...getLayoutItemProps('start-date', { hideable: true })}>
                  <StartDateSection
                    selectedTask={selectedTask}
                    formatDateForInput={formatDateForInput}
                    startDateInputRef={startDateInputRef}
                    dateInputRef={dateInputRef}
                    handleTaskDetailUpdate={handleTaskDetailUpdate}
                    handleDueDateChange={handleDueDateChange}
                    openStartTimePicker={openStartTimePicker}
                    openTimePicker={openTimePicker}
                    showRepeatPeriodHint={Boolean(selectedTask.details?.repeat?.enabled)}
                    isMobile={isMobile}
                  />
                </div>
                <div {...getLayoutItemProps('reminders', { hideable: true })}>
                  <ReminderPanel selectedTask={selectedTask} reminderManager={reminderManager} />
                </div>
                <div {...getLayoutItemProps('task-status')}>
                  <div className="task-status"><button className={`header-complete-btn ${selectedTask.status === 'completed' ? 'completed' : ''}`} onClick={() => handleStatusChange(selectedTask.id, selectedTask.status === 'completed' ? 'pending' : 'completed')}>{selectedTask.status === 'completed' ? '已完成' : '未完成'}</button></div>
                </div>
                <div {...getLayoutItemProps('repeat-settings', { hideable: true })}>
                  <div className="task-properties-section" style={{ background: '#f5f7fa', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label>重複：</label>
                        <button
                          className={`header-progress-btn ${selectedTask.details?.repeat?.enabled ? 'enabled' : 'disabled'}`}
                          onClick={() => {
                            const nextEnabled = !selectedTask.details?.repeat?.enabled;
                            handleTaskDetailUpdate(selectedTask.id, 'repeat', {
                              ...selectedTask.details.repeat,
                              enabled: nextEnabled,
                              disabledByUser: !nextEnabled
                            });
                          }}
                        >
                          {selectedTask.details?.repeat?.enabled ? '已啟用' : '未啟用'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          min="1"
                          value={selectedTask.details?.repeat?.interval || 1}
                          onChange={(e) => handleTaskDetailUpdate(selectedTask.id, 'repeat', { ...selectedTask.details.repeat, interval: parseInt(e.target.value, 10) || 1 })}
                          style={{ width: '50px', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <select
                          className="repeat-unit-select"
                          value={selectedTask.details?.repeat?.unit || 'day'}
                          onChange={(e) => handleTaskDetailUpdate(selectedTask.id, 'repeat', { ...selectedTask.details.repeat, unit: e.target.value })}
                          style={{ padding: '6px 12px', border: '1px solid #E8EDF2', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                        >
                          <option value="minute">分鐘</option>
                          <option value="day">天</option>
                          <option value="week">週</option>
                          <option value="month">月</option>
                          <option value="year">年</option>
                        </select>
                      </div>

                      {selectedTask.details?.repeat?.enabled && (
                        <div className="repeat-duration-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <label style={{ marginBottom: 0 }}>每次執行時長：</label>
                          <input
                            type="number"
                            min="1"
                            value={selectedTask.details?.repeat?.durationValue || 1}
                            onChange={(e) => handleTaskDetailUpdate(selectedTask.id, 'repeat', { ...selectedTask.details.repeat, durationValue: parseInt(e.target.value, 10) || 1 })}
                            style={{ width: '60px', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                          />
                          <select
                            className="repeat-unit-select"
                            value={selectedTask.details?.repeat?.durationUnit || 'hour'}
                            onChange={(e) => handleTaskDetailUpdate(selectedTask.id, 'repeat', { ...selectedTask.details.repeat, durationUnit: e.target.value })}
                            style={{ padding: '6px 12px', border: '1px solid #E8EDF2', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                          >
                            <option value="minute">分鐘</option>
                            <option value="hour">小時</option>
                            <option value="day">天</option>
                          </select>
                          <button
                            className="repeat-log-btn"
                            onClick={() => repeatManager.setShowModal(true)}
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                          >
                            📊 任務日誌
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div {...getLayoutItemProps('description', { hideable: true })}>
                  <DescriptionSection
                    quillRef={quillRef}
                    selectedTask={selectedTask}
                    handleEditorChange={handleEditorChange}
                    modules={modules}
                    formats={formats}
                    capsuleManager={capsuleManager}
                    templateManager={templateManager}
                    tasks={tasks}
                    descriptionTags={descriptionTags}
                    descriptionLinks={descriptionLinks}
                    onDescriptionTagClick={openDescriptionTagPage}
                  />
                </div>

                {/* 子任務清單區域：移至最下方，並改為三欄佈局 */}
                {selectedTask.children && selectedTask.children.length > 0 && (
                  <div {...getLayoutItemProps('subtasks', { hideable: true })}>
                    <div className="subtasks-list" style={{ marginTop: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>子任務清單</h3>
                      <div className="subtasks-container" style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '10px' 
                      }}>
                        {selectedTask.children.filter(subtask => subtask && subtask.id && !subtask.isPlaceholder && !subtask.isPlaceholderHeader).map(subtask => (
                          <div 
                            key={subtask.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              padding: '8px 10px', 
                              background: 'white', 
                              borderRadius: '6px', 
                              border: '1px solid #eee',
                              opacity: 1,
                              minWidth: 0 // 確保文字溢出能正常處理
                            }}
                          >
                            <div className="subtask-icon" style={{ display: 'flex', alignItems: 'center', color: subtask.status === 'completed' ? '#52D0FF' : '#666', minWidth: subtask.icon ? '18px' : '0' }}>
                              {subtask.icon ? (
                                subtask.icon.type === 'custom' ? (
                                  <img src={subtask.icon.url} alt="" style={{ width: '18px', height: '18px' }} />
                                ) : (
                                  React.createElement(
                                    DEFAULT_ICONS.find(i => i.name === subtask.icon.name)?.icon || DEFAULT_ICONS[0].icon,
                                    { size: 16 }
                                  )
                                )
                              ) : null}
                            </div>
                            
                            <span style={{ 
                              flex: 1, 
                              fontSize: '13px', 
                              color: subtask.status === 'completed' ? '#52D0FF' : '#333',
                              textDecoration: 'none',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {subtask.title}
                            </span>
                            
                            <button
                              onClick={() => handleStatusChange(
                                subtask.id,
                                subtask.status === 'completed' ? 'pending' : 'completed'
                              )}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                              aria-label={subtask.status === 'completed' ? '標記為未完成' : '標記為已完成'}
                            >
                              <span
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '3px',
                                  border: `2px solid ${subtask.status === 'completed' ? '#52D0FF' : '#cfd8dc'}`,
                                  background: subtask.status === 'completed' ? '#52D0FF' : '#fff',
                                  color: '#fff',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  lineHeight: '1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {subtask.status === 'completed' ? '✓' : ''}
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div {...getLayoutItemProps('created-at', { hideable: true })}>
                  <CreatedAtSection created={selectedTask.created} />
                </div>
              </div>
            )}
            {(activeTab === 'calendar' || activeTab === 'overview') && (
              <div ref={chartFilterRef} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '10px', position: 'relative' }}>
                {activeTab === 'calendar' && (
                  <button
                    onClick={() => setCalendarStyleMode(prev => (prev === 'monthly' ? 'planner' : 'monthly'))}
                    style={{ padding: '6px 10px', border: '1px solid #E8EDF2', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
                  >
                    樣式：{calendarStyleMode === 'planner' ? '年計畫表' : '月格'}
                  </button>
                )}
                {activeTab === 'calendar' && (
                  <select value={ganttTaskDisplayMode} onChange={(e) => setGanttTaskDisplayMode(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #E8EDF2', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                    <option value="default">預設</option>
                    <option value="level">層級</option>
                    <option value="priority">優先級</option>
                    <option value="custom">屬性</option>
                  </select>
                )}
                <button
                  onClick={() => setShowChartFilterPanel(prev => !prev)}
                  style={{ padding: '6px 10px', border: '1px solid #E8EDF2', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
                >
                  篩選
                </button>
                {showChartFilterPanel && renderChartFilterPanel()}
              </div>
            )}
            {activeTab === 'overview' && (
              <div className="task-details" style={{ width: '100%', maxWidth: '1600px', background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', boxSizing: 'border-box', margin: '0 auto' }}>
                <div className="task-overview-panel" style={{ width: '100%' }}>
                  <div className="overview-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                    <div className="overview-stats">
                      <span>
                        整體進度: {allTasks.filter(t => t.completed).length}/{allTasks.length} 任務 ({allTasks.length ? Math.round((allTasks.filter(t => t.completed).length / allTasks.length) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end', gap: '8px', marginBottom: '12px' }}>
                    <button onClick={toggleSelectAllInOverview} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
                      {visibleSelectedInOverview === overviewFilteredTasks.length && overviewFilteredTasks.length > 0 ? '取消全選' : '全選'}
                    </button>
                    {selectedTasks.size > 0 && (
                      <>
                        <button onClick={() => handleBulkStatusChange('completed')} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>標記完成</button>
                        <button onClick={() => handleBulkStatusChange('pending')} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>未完成</button>
                        <button onClick={handleBulkDelete} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#ff4444', color: 'white', border: 'none' }}>刪除</button>
                      </>
                    )}
                  </div>
                  <div className="overview-table-container" style={{ overflowX: 'auto' }}>
                    <table className="overview-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                          <th style={{ width: '30%', padding: '12px' }}>任務名稱</th>
                          <th style={{ width: '6%', padding: '12px' }}>層級</th>
                          <th style={{ width: '10%', padding: '12px' }}>狀態</th>
                          <th style={{ width: '8%', padding: '12px' }}>優先級</th>
                          <th style={{ width: '10%', padding: '12px' }}>屬性</th>
                          <th style={{ width: '100px', padding: '12px' }}>開始</th>
                          <th style={{ width: '100px', padding: '12px' }}>截止</th>
                          <th style={{ padding: '12px' }}>路徑</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewFilteredTasks.map(task => (
                          <tr key={task.id} style={{ borderBottom: '1px solid #eee' }} className={selectedTasks.has(task.id) ? 'selected' : ''}>
                            <td style={{ padding: '12px' }}>
                              <input type="checkbox" checked={selectedTasks.has(task.id)} onChange={() => handleTaskSelect(task.id)} style={{ marginRight: '10px' }} />
                              <span onClick={() => { handleOverviewTaskClick(task.id); setActiveTab('details'); }} className="task-name" style={{ cursor: 'pointer', color: '#00A3FF' }}>
                                {task.title}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}><span className={`level-badge level-${String(task.level).toLowerCase()}`}>{task.level}</span></td>
                            <td style={{ padding: '12px' }}>
                              <button onClick={() => handleTaskStatusToggle(task.id, task.status === 'completed' ? 'pending' : 'completed')} className={`status-button ${task.status === 'completed' ? 'completed' : 'pending'}`}>
                                {task.status === 'completed' ? '已完成' : '未完成'}
                              </button>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <select value={task.priority || ''} onChange={(e) => handleTaskDetailUpdate(task.id, 'priority', e.target.value)} className="priority-select" style={{ padding: '4px 8px', border: '1px solid #E8EDF2', borderRadius: '4px', fontSize: '12px' }}>
                                <option value="">無</option>
                                <option value="high">高</option>
                                <option value="medium">中</option>
                                <option value="low">低</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div className="tag-dropdown-container" style={{ position: 'relative' }}>
                                <div
                                  onClick={(e) => { e.stopPropagation(); setTagDropdownOpen(tagDropdownOpen === task.id ? null : task.id); }}
                                  style={{ padding: '4px 8px', border: '1px solid #E8EDF2', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '12px', background: 'white' }}
                                >
                                  <span style={{ flex: 1, textAlign: 'left' }}>{task.tagId ? taskTags.find(t => t.id === task.tagId)?.name || '無屬性' : '無屬性'}</span>
                                  {task.tagId && <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: getTagColor(task.tagId), border: '1px solid #ddd' }} />}
                                  <span style={{ fontSize: '8px', color: '#999' }}>▼</span>
                                </div>
                                {tagDropdownOpen === task.id && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'white', border: '1px solid #E8EDF2', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                    <div onClick={() => { handleTaskDetailUpdate(task.id, 'tagId', null); setTagDropdownOpen(null); }} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>無屬性</div>
                                    {taskTags.map(tag => (
                                      <div key={tag.id} onClick={() => { handleTaskDetailUpdate(task.id, 'tagId', tag.id); setTagDropdownOpen(null); }} style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                        <div style={{ width: '14px', height: '14px', background: tag.color, borderRadius: '3px', border: '1px solid #ddd' }} />
                                        {tag.name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100px' }}>
                                <div className="date-fake-wrapper" style={{ width: '100px' }}>
                                  <div className={`fake-input overview-start-date ${task.details?.startDate ? '' : 'is-placeholder'}`} style={{ width: '100px' }} onClick={() => { document.getElementById(`start-date-input-${task.id}`).showPicker(); }}>
                                    {formatDateForInput(task.details?.startDate) || 'YYYY-MM-DD'}
                                  </div>
                                  <input id={`start-date-input-${task.id}`} type="date" value={task.details?.startDate ? new Date(task.details.startDate).toISOString().split('T')[0] : ''} onChange={(e) => handleTaskDetailUpdate(task.id, 'startDate', e.target.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                                </div>
                                <div className="fake-input overview-start-time" style={{ width: '100px' }} onClick={() => openStartTimePicker(task.id)}>{task.details?.startTime || '__:__'}</div>
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100px' }}>
                                <div className="date-fake-wrapper" style={{ width: '100px' }}>
                                  <div className={`fake-input overview-due-date ${task.details?.dueDate ? '' : 'is-placeholder'}`} style={{ width: '100px' }} onClick={() => { document.getElementById(`due-date-input-${task.id}`).showPicker(); }}>
                                    {formatDateForInput(task.details?.dueDate) || 'YYYY-MM-DD'}
                                  </div>
                                  <input id={`due-date-input-${task.id}`} type="date" value={task.details?.dueDate ? new Date(task.details.dueDate).toISOString().split('T')[0] : ''} onChange={(e) => handleTaskDetailUpdate(task.id, 'dueDate', e.target.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                                </div>
                                <div className="fake-input overview-due-time" style={{ width: '100px' }} onClick={() => openTimePicker(task.id)}>{task.details?.dueTime || '__:__'}</div>
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div className="breadcrumb">
                                {task.parentPath?.filter(p => p.id !== 'root' && p.title !== 'Root').map((p, idx, arr) => (
                                  <span key={p.id}>
                                    <span className="breadcrumb-item" onClick={() => handleBreadcrumbClick(p.id)}>{p.level}【{p.title}】</span>
                                    {idx < arr.length - 1 && ' > '}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'tag-label' && (
              <div className="task-details" style={{ width: '100%', maxWidth: '1600px', background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', boxSizing: 'border-box', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Tag標籤頁：#{activeDescriptionTag}</h3>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#7a8391' }}>共 {filteredTagPageTasks.length} 筆</span>
                    <button
                      onClick={closeDescriptionTagPage}
                      style={{ padding: '4px 10px', border: '1px solid #e1e5e9', background: '#fff', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#666' }}
                    >
                      關閉
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <input
                    type="text"
                    value={tagPageQuery}
                    onChange={(e) => setTagPageQuery(e.target.value)}
                    placeholder="輸入多個Tag（例如：#前端 #API），會篩選同時擁有這些Tag的任務"
                    style={{ width: '100%', maxWidth: '520px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px' }}
                  />
                </div>
                <div className="overview-table-container" style={{ overflowX: 'auto' }}>
                  <table className="overview-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ width: '40%', padding: '12px' }}>任務名稱</th>
                        <th style={{ width: '14%', padding: '12px' }}>狀態</th>
                        <th style={{ width: '14%', padding: '12px' }}>優先級</th>
                        <th style={{ width: '16%', padding: '12px' }}>屬性</th>
                        <th style={{ width: '16%', padding: '12px' }}>截止</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTagPageTasks.map(task => (
                        <tr key={task.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px' }}>
                            <span onClick={() => { handleOverviewTaskClick(task.id); setActiveTab('details'); }} className="task-name" style={{ cursor: 'pointer', color: '#00A3FF' }}>
                              {task.title}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <button onClick={() => handleTaskStatusToggle(task.id, task.status === 'completed' ? 'pending' : 'completed')} className={`status-button ${task.status === 'completed' ? 'completed' : 'pending'}`}>
                              {task.status === 'completed' ? '已完成' : '未完成'}
                            </button>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <select value={task.priority || ''} onChange={(e) => handleTaskDetailUpdate(task.id, 'priority', e.target.value)} className="priority-select" style={{ padding: '4px 8px', border: '1px solid #E8EDF2', borderRadius: '4px', fontSize: '12px' }}>
                              <option value="">無</option>
                              <option value="high">高</option>
                              <option value="medium">中</option>
                              <option value="low">低</option>
                            </select>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#333' }}>
                              <span>{task.tagId ? taskTags.find(t => t.id === task.tagId)?.name || '無屬性' : '無屬性'}</span>
                              {task.tagId && <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: getTagColor(task.tagId) || '#E0E0E0', border: '1px solid #ddd' }} />}
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                            {formatDateForInput(task.details?.dueDate) || '-'}
                          </td>
                        </tr>
                      ))}
                      {!filteredTagPageTasks.length && (
                        <tr>
                          <td colSpan={5} style={{ padding: '20px 12px', color: '#7a8391', textAlign: 'center' }}>
                            {tagPageQueryTags.length
                              ? `目前沒有同時符合 #${activeDescriptionTag} + ${tagPageQueryTags.map(tag => `#${tag}`).join(' ')} 的任務`
                              : `目前沒有符合 #${activeDescriptionTag} 的任務`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'tags' && (
              <div className="task-details" style={{ width: '100%', maxWidth: '1600px', background: 'white', padding: isMobile ? '24px 0' : '24px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', boxSizing: 'border-box', margin: '0 auto' }}>
                <div className="task-tags-panel" style={{ width: '100%' }}>
                  <div className="add-tag-section" style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '24px' }}>
                    <h4 style={{ marginBottom: '12px' }}>新增屬性</h4>
                    <div className="add-tag-row" style={{ display: 'flex', gap: isMobile ? '6px' : '12px' }}>
                      <input
                        type="text"
                        placeholder="名稱"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                      />
                      <input
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        style={{ width: '50px', height: '40px', cursor: 'pointer' }}
                      />
                      <button
                        onClick={handleAddTag}
                        style={{ padding: '8px 16px', background: '#52D0FF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        新增
                      </button>
                    </div>
                  </div>

                  <div className="tags-list">
                    <h4 style={{ marginBottom: '8px' }}>所有屬性</h4>
                    <p className="tags-list-note" style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#999' }}>
                      勾選：計入甘特圖、進度、經驗值<br />取消勾選：排除於上述統計（日曆仍顯示）
                    </p>
                    <div className="tags-list-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                      {taskTags.map((tag) => {
                        const isDropTarget = dragOverTagId === String(tag.id);
                        const borderTop = isDropTarget && dragOverTagSide === 'before' ? '2px solid #52D0FF' : '1px solid #e0e0e0';
                        const borderBottom = isDropTarget && dragOverTagSide === 'after' ? '2px solid #52D0FF' : '1px solid #e0e0e0';
                        return (
                          <div
                            key={tag.id}
                            draggable={editingTagId !== tag.id}
                            onDragStart={(e) => handleTagDragStart(e, tag.id)}
                            onDragOver={(e) => handleTagDragOver(e, tag.id)}
                            onDrop={(e) => handleTagDrop(e, tag.id)}
                            onDragEnd={resetTagDragState}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '12px',
                              background: 'white',
                              borderLeft: '1px solid #e0e0e0',
                              borderRight: '1px solid #e0e0e0',
                              borderTop,
                              borderBottom,
                              borderRadius: '8px',
                              cursor: editingTagId === tag.id ? 'default' : 'grab'
                            }}
                          >
                            {editingTagId === tag.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editingTagName}
                                  onChange={(e) => setEditingTagName(e.target.value)}
                                  style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                                />
                                <input
                                  type="color"
                                  value={rgbToHex(editingTagColor)}
                                  onChange={(e) => setEditingTagColor(hexToRgb(e.target.value))}
                                  style={{ width: '40px', height: '35px' }}
                                />
                                <button
                                  onClick={() => { handleEditTag(tag.id, editingTagName, rgbToHex(editingTagColor)); setEditingTagId(null); }}
                                  style={{ padding: '6px 12px', background: '#52D0FF', color: 'white', border: 'none', borderRadius: '4px' }}
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingTagId(null)}
                                  style={{ padding: '6px 12px', background: '#f0f0f0', border: 'none', borderRadius: '4px' }}
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <>
                                <input
                                  type="checkbox"
                                  className="tag-include-checkbox"
                                  checked={tag.includeInViews !== false}
                                  onChange={() => handleToggleTagIncludeInViews(tag.id)}
                                  title={tag.includeInViews !== false ? '計入甘特圖、進度、經驗值（取消勾選則排除）' : '已排除於甘特圖、進度、經驗值（日曆仍顯示）'}
                                />
                                <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: tag.color }} />
                                <span style={{ flex: 1, fontWeight: '500', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: tag.includeInViews === false ? 0.6 : 1 }}>{tag.name}</span>
                                <button
                                  onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); setEditingTagColor(tag.color); }}
                                  style={{ padding: '6px 12px', background: '#fff', color: '#8f97a3', border: '1px solid #d6dbe2', borderRadius: '4px' }}
                                >
                                  編輯
                                </button>
                                <button
                                  onClick={() => handleDeleteTag(tag.id)}
                                  style={{ padding: '6px 12px', background: '#a5aebc', color: 'white', border: 'none', borderRadius: '4px' }}
                                >
                                  刪除
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'gantt' && (
              <div ref={chartFilterRef} style={{ position: 'relative' }}>
                <div className="task-details" style={{ width: '100%', maxWidth: '1600px', background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', boxSizing: 'border-box', margin: '0 auto' }}>
                  <div className="gantt-panel" style={{ width: '100%', padding: 0 }}><div className="gantt-header"><h3>甘特圖</h3><div className="gantt-controls">{ganttZoom === 'day' && <div className="day-view-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '10px' }}><div className="date-fake-wrapper" style={{ width: 'fit-content', minWidth: '10ch' }}><div className="fake-input" onClick={() => dayViewDateInputRef.current?.showPicker?.()} style={{ width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', padding: isMobile ? '6px 8px' : undefined }}>{formatDateForInput(dayViewDate.toISOString().split('T')[0]) || 'YYYY/MM/DD'}</div><input ref={dayViewDateInputRef} type="date" value={dayViewDate.toISOString().split('T')[0]} onChange={(e) => setDayViewDate(new Date(e.target.value))} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} /></div><div className="column-width-control" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><label style={{ fontSize: '12px' }}>欄寬:</label><input type="range" min="20" max="160" value={ganttColumnWidth} onChange={(e) => handleColumnWidthChange(parseInt(e.target.value))} className="column-width-slider" /><span className="column-width-value" style={{ fontSize: '12px' }}>{ganttColumnWidth}px</span></div></div>}<button className={`gantt-zoom-btn ${ganttZoom === 'day' ? 'active' : ''}`} onClick={() => setGanttZoom('day')}>日視圖</button><button className={`gantt-zoom-btn ${ganttZoom === 'week' ? 'active' : ''}`} onClick={() => setGanttZoom('week')}>週視圖</button><button className={`gantt-zoom-btn ${ganttZoom === 'month' ? 'active' : ''}`} onClick={() => setGanttZoom('month')}>月視圖</button><div className="gantt-display-mode-control"><label className="gantt-display-mode-label" style={{ marginRight: '8px', fontSize: '12px', color: '#666' }}>任務條顯示:</label><select value={ganttTaskDisplayMode} onChange={(e) => setGanttTaskDisplayMode(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #E8EDF2', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', background: 'white', marginRight: '10px' }}><option value="default">預設</option><option value="level">層級</option><option value="priority">優先級</option><option value="custom">屬性</option></select></div><button className="gantt-filter-btn" onClick={() => setShowChartFilterPanel(prev => !prev)} style={{ padding: '6px 10px', border: '1px solid #E8EDF2', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>篩選</button></div></div>{showChartFilterPanel && renderChartFilterPanel()}<div className={`gantt-container ${ganttZoom === 'day' ? 'day-view' : ''}`} ref={ganttTimelineRef}><div className="gantt-timeline" onMouseLeave={handleTaskHoverLeave}><div className="gantt-timeline-header">{renderTimelineHeader()}</div><div className={`gantt-timeline-content ${ganttZoom === 'month' ? 'month-view' : ''}`}>{ganttZoom === 'day' ? Array.from({ length: 24 }).map((_, i) => <div key={i} className="gantt-time-row day-view-time-row" style={{ height: '30px', display: 'flex', alignItems: 'center' }}><div className="gantt-time-label-cell">{String(i).padStart(2, '0')}:00</div>{dayViewTasks.map(t => <div key={`${t.id}-${i}`} className="gantt-task-cell day-view-task-cell" style={{ width: `${ganttColumnWidth}px`, height: '30px', position: 'relative' }}>{renderDayTaskBar(t, i)}</div>)}</div>) : ganttTaskRows.map(row => <div key={row.id} className="gantt-task-bar-container" style={{ position: 'relative', height: '30px' }}>{getRowWindowsForGantt(row).map((w, idx) => renderTaskBar({ ...row, _windowStart: w.start, _windowEnd: w.end, _instanceKey: w.key || `${row.id}-${idx}` }))}</div>)}</div></div></div></div>
                </div>
              </div>
            )}
            {activeTab === 'calendar' && (
              <div className="task-details" style={{ width: '100%', maxWidth: '1600px', background: 'white', padding: isMobile ? '24px 0' : '24px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', boxSizing: 'border-box', margin: '0 auto' }}>
                <div className="calendar-view" style={{ width: '100%', margin: 0, padding: 0 }}>{renderCalendarView()}</div>
              </div>
            )}
          </div>
        </div>
        {(!isMobile || activeTab === 'details') && (
        <div className={`insert-toolbar ${toolbarCollapsed ? 'collapsed' : ''}`}>
          <div className="toolbar-header"><h4>🛠️ 插入工具列</h4><button className="collapse-btn" style={{ background: '#fff', border: '1px solid #e1e5e9' }} onClick={() => setToolbarCollapsed(!toolbarCollapsed)}>{toolbarCollapsed ? '📂' : '📁'}</button></div>
          {!toolbarCollapsed && (
            <div className="toolbar-content">
              <>
                <div style={{ fontSize: '12px', color: '#7a8391', marginBottom: '4px' }}>區塊開關</div>
                {toolbarToggleSectionIds.map((id) => {
                  const active = isSectionVisible(id);
                  const available = isSectionAvailable(id);
                  return (
                    <button
                      key={`toggle-${id}`}
                      className="tool-btn"
                      onClick={() => toggleSectionVisibility(id)}
                      disabled={!available}
                      style={{
                        backgroundColor: active ? '#52D0FF' : '#fff',
                        color: active ? '#fff' : '#333',
                        borderColor: active ? '#52D0FF' : '#e1e5e9',
                        opacity: available ? 1 : 0.5
                      }}
                    >
                      {SECTION_LABELS[id]}
                    </button>
                  );
                })}

                <button
                  className="tool-btn"
                  onClick={capsuleManager.togglePanel}
                  style={{
                    backgroundColor: capsuleManager.capsuleState.showCapsules ? '#52D0FF' : '#fff',
                    color: capsuleManager.capsuleState.showCapsules ? '#fff' : '#333',
                    borderColor: capsuleManager.capsuleState.showCapsules ? '#52D0FF' : '#e1e5e9'
                  }}
                >
                  文字膠囊
                </button>

                <div style={{ fontSize: '12px', color: '#7a8391', marginTop: '30px', marginBottom: '4px' }}>版面模板</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e1e5e9', borderRadius: '6px', background: 'white' }}
                  >
                    <option value="">選擇版面模板</option>
                    {layoutTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      className="tool-btn"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        backgroundColor: '#52D0FF',
                        color: '#fff',
                        borderColor: '#52D0FF',
                        opacity: selectedTemplateId ? 1 : 0.6
                      }}
                      onClick={handleApplyLayoutTemplate}
                      disabled={!selectedTemplateId}
                    >
                      套用
                    </button>
                    <button className="tool-btn" style={{ flex: 1, justifyContent: 'center', color: '#ff6b6b' }} onClick={handleDeleteLayoutTemplate} disabled={!selectedTemplateId}>
                      刪除
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <button className="tool-btn" style={{ justifyContent: 'center' }} onClick={handleSaveLayoutTemplate}>💾 儲存目前版面為模板</button>
                  <button
                    className="tool-btn"
                    style={{ justifyContent: 'center', color: '#666' }}
                    onClick={handleResetLayout}
                  >
                    ↺ 還原預設版面
                  </button>
                </div>
              </>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetailPanel;
