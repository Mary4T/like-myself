import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  IoMail,
  IoSettings,
  IoHome,
  IoAdd,
  IoGameController,
  IoList,
  IoPerson,
  IoEllipsisHorizontal
} from 'react-icons/io5';
import {
  BsCalendar,
  BsClock,
  BsBell,
  BsGeoAlt,
  BsArrowRepeat
} from 'react-icons/bs';
import './Home.css';
import {
  getDefaultUserId,
  setUserId,
  getAvatar,
  setAvatar,
  addXpNote,
  addRecommendedBonusXp,
  getTotalXp,
  getLevelAndProgress,
  getCompletionPercentForPeriod,
  getLeafTasksForPeriod,
  XP_INVALIDATE_EVENT
} from './utils/userOverviewUtils';
import { getDueDate, getDaysUntilDue } from './utils/characterRecommendations';
import {
  isTaskRecommended,
  HOME_TASKS_REFRESH_EVENT,
  OPEN_TASK_DETAIL_EVENT,
  completeNoteTaskFromDialog,
  completeProjectTaskFromDialog,
  uncompleteNoteTaskFromDialog,
  uncompleteProjectTaskFromDialog
} from './utils/characterMoodUtils';
import { dispatchAvatarUpdated } from './components/CharacterButton';
import { PROJECT_TASKS_UPDATED_EVENT, TASK_TAGS_UPDATED_EVENT } from './components/GlobalAddTaskModal';
import { resetProjectTasksIfNeeded } from './utils/projectTaskRepeatUtils';
import { OPEN_OVERVIEW_USER_SETTINGS_EVENT } from './components/PageSettingsButton';

// ReactQuill 配置
const modules = {
  toolbar: [
    [{ size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
    [{ color: [] }, { background: [] }],
    ['link', 'image', 'video'],
    ['clean']
  ]
};

const formats = [
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
];

const TASK_LAYOUT_STORAGE_PREFIX = 'taskDetailLayout.v3.task';
const TYPE_LAYOUT_STORAGE_PREFIX = 'taskDetailLayout.v2';
const LEGACY_LAYOUT_STORAGE_KEY = 'taskDetailLayout.v1';
const HOME_PROJECT_DISPLAY_TASK_IDS_KEY = 'homeProjectDisplayTaskIds.v1';
const HOME_MODAL_ALLOWED_SECTIONS = ['start-date', 'reminders', 'description', 'subtasks'];
const TASK_DETAIL_DEFAULT_ORDER = ['task-header', 'task-properties', 'start-date', 'reminders', 'repeat-settings', 'description', 'subtasks', 'created-at'];
const OPEN_NOTE_TASK_KEY = 'unifiedCalendar.openNoteTask.v1';

const flattenTaskTreeWithDepth = (list, depth = 0, result = []) => {
  (list || []).forEach((task) => {
    result.push({ task, depth });
    if (Array.isArray(task.children) && task.children.length > 0) {
      flattenTaskTreeWithDepth(task.children, depth + 1, result);
    }
  });
  return result;
};

const findTaskByIdInTree = (list, taskId) => {
  const target = String(taskId);
  for (const task of (list || [])) {
    if (String(task.id) === target) return task;
    const found = findTaskByIdInTree(task.children || [], target);
    if (found) return found;
  }
  return null;
};

const updateTaskInTree = (list, taskId, updater) => {
  const target = String(taskId);
  return (list || []).map((task) => {
    if (String(task.id) === target) return updater(task);
    if (Array.isArray(task.children) && task.children.length > 0) {
      return { ...task, children: updateTaskInTree(task.children, taskId, updater) };
    }
    return task;
  });
};

const Home = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(() => {
    try {
      const savedTasks = localStorage.getItem('tasks');
      return savedTasks ? JSON.parse(savedTasks) : [];
    } catch (error) {
      console.error('Error loading tasks from localStorage:', error);
      return [];
    }
  });
  
  // 添加项目管理任务状态
  const [projectTaskTree, setProjectTaskTree] = useState([]);
  const [taskTags, setTaskTags] = useState(() => {
    try {
      const saved = localStorage.getItem('taskTags');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [projectDisplayTaskIds, setProjectDisplayTaskIds] = useState(() => {
    try {
      const saved = localStorage.getItem(HOME_PROJECT_DISPLAY_TASK_IDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(String);
      }
      return [];
    } catch {
      return [];
    }
  });
  const [projectSourceOpen, setProjectSourceOpen] = useState(false);
  
  const [activeNotifications, setActiveNotifications] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [completedTasks, setCompletedTasks] = useState(() => {
    try {
      const savedCompletedTasks = localStorage.getItem('completedTasks');
      return savedCompletedTasks ? JSON.parse(savedCompletedTasks) : [];
    } catch (error) {
      console.error('Error loading completed tasks:', error);
      return [];
    }
  });

  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [userId, setUserIdState] = useState(getDefaultUserId);
  const [avatar, setAvatarState] = useState(getAvatar);
  const [showOverviewSettings, setShowOverviewSettings] = useState(false);
  const [xpNoteVersion, setXpNoteVersion] = useState(0);
  const [progressPopupPeriod, setProgressPopupPeriod] = useState(null);
  const [noteTaskDetailPopupTaskId, setNoteTaskDetailPopupTaskId] = useState(null);
  const [noteTaskDeletePopupTaskId, setNoteTaskDeletePopupTaskId] = useState(null);
  const longPressTimerRef = useRef(null);

  const [notificationHistory, setNotificationHistory] = useState(() => {
    // 從 localStorage 讀取通知歷史
    const saved = localStorage.getItem('notificationHistory');
    return saved ? JSON.parse(saved) : {};
  });
 
  // 計算提醒時間 (毫秒)
  const calculateReminderTime = (value, unit) => {
    const minutesMap = {
      minutes: value,
      hours: value * 60,
      days: value * 24 * 60,
      weeks: value * 7 * 24 * 60,
      months: value * 30 * 24 * 60 // 使用約30天作為一個月
    };
    return (minutesMap[unit] || value) * 60 * 1000; // 轉換為毫秒
  };

  const checkDueTasks = useCallback(() => {
    console.log('=== 開始檢查任務 ===');
    const now = new Date();
   
    tasks.forEach(task => {
      if (task.details?.date && task.details?.time && task.details?.reminders?.length > 0) {
        const dueDate = new Date(`${task.details.date}T${task.details.time}`);
        
        // 檢查每個提醒
        task.details.reminders.forEach((reminder, index) => {
          const reminderTime = new Date(dueDate.getTime() -
            (reminder.days * 24 * 60 * 60 * 1000) -
            (reminder.hours * 60 * 60 * 1000) -
            (reminder.minutes * 60 * 1000)
          );
          
          if (reminderTime <= now && dueDate > now && !task.completed) {
            // 檢查上次通知時間
            const notificationKey = `${task.id}-${index}`;
            const lastNotified = notificationHistory[notificationKey];
            const timeSinceLastNotification = lastNotified ? now - new Date(lastNotified) : Infinity;
           
            // 如果從未通知過或距離上次通知已超過5分鐘
            if (!lastNotified || timeSinceLastNotification > 5 * 60 * 1000) {
              console.log('創建新通知:', task.text);
             
              // 更新通知歷史
              setNotificationHistory(prev => ({
                ...prev,
                [notificationKey]: now.toISOString()
              }));
             
              // 添加新通知到列表
              const newNotification = {
                id: `${task.id}-${index}-${now.getTime()}`, // 使用組合ID確保唯一性
                message: `任務「${task.text}」即將到期！`,
                timestamp: now,
                taskId: task.id
              };
             
              setActiveNotifications(prev => [...prev, newNotification]);
             
              // 系統通知
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('任務提醒！', {
                  body: `任務「${task.text}」即將到期！`,
                  icon: '/favicon.ico',
                  silent: false,
                  requireInteraction: true,
                  vibrate: [200, 100, 200]
                });
   
                const audio = new Audio('data:audio/wav;base64,...');
                audio.play().catch(e => console.log('無法播放提示音:', e));
              }
            }
          }
        });
      }
    });
  }, [tasks, notificationHistory]);

const handleCloseNotification = (notificationId) => {
  setActiveNotifications(prev =>
    prev.filter(notification => notification.id !== notificationId)
  );
};

  const handleDetailChange = (taskId, field, value) => {
    const inCompleted = completedTasks.some(t => t.id === taskId);
    if (inCompleted) {
      setCompletedTasks(prev =>
        prev.map(task =>
          task.id === taskId
            ? { ...task, details: { ...task.details, [field]: value } }
            : task
        )
      );
    } else {
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? { ...task, details: { ...task.details, [field]: value } }
            : task
        )
      );
    }
  };

  const handleTaskTextChange = (taskId, newText) => {
    const inCompleted = completedTasks.some(t => t.id === taskId);
    if (inCompleted) {
      setCompletedTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, text: newText } : task
        )
      );
    } else {
      setTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, text: newText } : task
        )
      );
    }
  };

  const handleDeleteTask = (taskId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const inCompleted = completedTasks.some(t => t.id === taskId);
    if (inCompleted) {
      setCompletedTasks(prev => prev.filter(task => task.id !== taskId));
    } else {
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    }
  };

  const handleNoteTaskContextMenu = (e, taskId) => {
    e.preventDefault();
    e.stopPropagation();
    setNoteTaskDeletePopupTaskId(taskId);
  };

  const handleNoteTaskTouchStart = (taskId) => {
    longPressTimerRef.current = setTimeout(() => {
      setNoteTaskDeletePopupTaskId(taskId);
    }, 500);
  };

  const handleNoteTaskTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
 
  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving tasks to localStorage:', error);
    }
  }, [tasks]);

  useEffect(() => {
    // 1. 請求通知權限
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
       
        // 2. 如果獲得權限，立即執行一次檢查
        if (permission === 'granted') {
          checkDueTasks();
        }
      });
    }
 
    // 3. 設置定時檢查
    const interval = setInterval(checkDueTasks, 60000); // 每分鐘檢查一次
    return () => clearInterval(interval);
  }, [checkDueTasks]);

  const handleNewTask = (e) => {
    if (e.key === 'Enter' && newTaskText.trim()) {
      const newTask = {
        id: Date.now(),
        text: newTaskText,
        completed: false,
        createdAt: new Date(),
        details: {
          date: '',
          time: '',
          reminders: [], // 新的提醒格式
          location: '',
          repeat: ''
        }
      };
      setTasks(prevTasks => [...prevTasks, newTask]);
      setNewTaskText('');
    }
  };

// 2. 修改完成任務的處理函數
const handleTaskComplete = (taskId) => {
  // 先檢查是否是已完成任務列表中的任務
  const completedTask = completedTasks.find(t => t.id === taskId);
  if (completedTask) {
    // 如果是已完成的任務，將它移回活動任務列表
    const activeTask = {
      ...completedTask,
      completed: false,
      completedAt: null
    };
    // 從已完成列表中移除
    setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
    // 添加到活動任務列表
    setTasks(prev => [...prev, activeTask]);
  } else {
    // 如果是活動任務列表中的任務
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      addXpNote(); // 便條紙完成 +1 經驗值
      if (isTaskRecommended(task.id, 'note')) addRecommendedBonusXp(1);
      setXpNoteVersion((v) => v + 1);
      // 標記為完成，添加完成時間
      const newCompletedTask = {
        ...task,
        completed: true,
        completedAt: new Date().toISOString()
      };
      // 從活動任務中移除
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
      // 添加到已完成任務列表
      setCompletedTasks(prev => [...prev, newCompletedTask]);
    }
  }
};

// 3. 添加自動清理機制
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    const now = new Date();
    setCompletedTasks(prev =>
      prev.filter(task => {
        const completedDate = new Date(task.completedAt);
        const daysDiff = (now - completedDate) / (1000 * 60 * 60 * 24);
        return daysDiff < 7;
      })
    );
  }, 1000 * 60 * 60); // 每小時檢查一次

  return () => clearInterval(cleanupInterval);
}, []);

// 4. 保存已完成任務到 localStorage
useEffect(() => {
  localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
}, [completedTasks]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTasks(items);
  };

  // 將日期轉為 input 可用的 YYYY-MM-DD 字串
  const formatDateForInput = (dateLike) => {
    if (!dateLike) return '';
    try {
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (e) {
      return '';
    }
  };

  const formatTimeForDisplay = (timeLike, fallback = '00:00') => {
    const raw = String(timeLike || '').trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    const hh = Math.max(0, Math.min(23, parseInt(match[1], 10)));
    const mm = Math.max(0, Math.min(59, parseInt(match[2], 10)));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const parseTimeForPicker = (timeLike, fallbackHour = 0) => {
    const normalized = formatTimeForDisplay(timeLike, `${String(fallbackHour).padStart(2, '0')}:00`);
    const [hh, mm] = normalized.split(':').map(v => parseInt(v, 10));
    return {
      hour: Number.isFinite(hh) ? hh : fallbackHour,
      minute: Number.isFinite(mm) ? (mm - (mm % 5)) : 0
    };
  };

  const handleProjectTaskClick = useCallback((task) => {
    // 確保 details 存在並補齊預設欄位，避免未定義導致無法雙向綁定
    const normalized = {
      ...task,
      details: {
        ...(task.details || {}),
        reminders: task.details?.reminders || [],
        startDate: task.details?.startDate || '',
        startTime: task.details?.startTime || '00:00',
        dueDate: task.details?.dueDate || '',
        dueTime: task.details?.dueTime || '23:59'
      }
    };
    setSelectedTask(normalized);
    setShowTaskModal(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OPEN_NOTE_TASK_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const targetId = String(parsed?.taskId || '');
      if (!targetId) {
        localStorage.removeItem(OPEN_NOTE_TASK_KEY);
        return;
      }
      const noteTask = (tasks || []).find((item) => String(item.id) === targetId);
      if (!noteTask) return;
      setExpandedTaskId(noteTask.id);
      localStorage.removeItem(OPEN_NOTE_TASK_KEY);
    } catch (error) {
      console.error('Failed to open note task from unified calendar:', error);
      localStorage.removeItem(OPEN_NOTE_TASK_KEY);
    }
  }, [tasks]);

  // refs for click-to-open pickers
  const dateInputRef = useRef(null);
  const startDateInputRef = useRef(null);
  const projectSourceRef = useRef(null);
  const overviewSettingsRef = useRef(null);

  // 依 taskTags.includeInViews 過濾項目任務樹（排除 includeInViews=false 的 tag 對應任務）
  const filteredProjectTaskTree = useMemo(() => {
    const excluded = new Set((taskTags || []).filter(t => t.includeInViews === false).map(t => t.id));
    if (excluded.size === 0) return projectTaskTree;
    const filterTree = (tree, parentResolvedTagId = null) => {
      if (!tree || tree.length === 0) return [];
      return tree
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
    return filterTree(projectTaskTree);
  }, [projectTaskTree, taskTags]);

  // 總覽：經驗值、等級、完成度（經驗值依 includeInViews 過濾）
  const totalXp = useMemo(() => getTotalXp(filteredProjectTaskTree), [filteredProjectTaskTree, xpNoteVersion]);
  const levelInfo = useMemo(() => getLevelAndProgress(totalXp), [totalXp]);
  const completionPercent = useMemo(
    () => getCompletionPercentForPeriod(tasks, completedTasks, filteredProjectTaskTree, 'total'),
    [tasks, completedTasks, filteredProjectTaskTree]
  );
  const monthPercent = useMemo(
    () => getCompletionPercentForPeriod(tasks, completedTasks, filteredProjectTaskTree, 'month'),
    [tasks, completedTasks, filteredProjectTaskTree]
  );
  const weekPercent = useMemo(
    () => getCompletionPercentForPeriod(tasks, completedTasks, filteredProjectTaskTree, 'week'),
    [tasks, completedTasks, filteredProjectTaskTree]
  );
  const dayPercent = useMemo(
    () => getCompletionPercentForPeriod(tasks, completedTasks, filteredProjectTaskTree, 'day'),
    [tasks, completedTasks, filteredProjectTaskTree]
  );

  const progressPopupTasks = useMemo(() => {
    if (!progressPopupPeriod) return [];
    return getLeafTasksForPeriod(tasks, completedTasks, filteredProjectTaskTree, progressPopupPeriod);
  }, [progressPopupPeriod, tasks, completedTasks, filteredProjectTaskTree]);

  const progressPopupTitle = {
    total: '總進度任務',
    month: '本月任務',
    week: '本週任務',
    day: '本日任務'
  }[progressPopupPeriod] || '';

  const handleProgressTaskToggle = (t) => {
    const isCompleted = t.completed || (t._source === 'project' && t.status === 'completed');
    if (isCompleted) {
      if (t._source === 'note') {
        if (uncompleteNoteTaskFromDialog(t._rawId || t.id)) {
          window.dispatchEvent(new CustomEvent(HOME_TASKS_REFRESH_EVENT));
        }
      } else if (t._source === 'project') {
        if (uncompleteProjectTaskFromDialog(t._rawId || t.id)) {
          window.dispatchEvent(new CustomEvent(PROJECT_TASKS_UPDATED_EVENT));
          setProjectTaskTree((prev) => {
            const updateInTree = (list, id, updater) =>
              list.map((task) => {
                if (String(task.id) === String(id)) return updater(task);
                if (task.children?.length) return { ...task, children: updateInTree(task.children, id, updater) };
                return task;
              });
            return updateInTree(prev, t._rawId || t.id, (task) => ({ ...task, status: 'pending', completed: false }));
          });
        }
      }
    } else {
      if (t._source === 'note') {
        if (completeNoteTaskFromDialog(t._rawId || t.id, addXpNote, isTaskRecommended(t._rawId || t.id, 'note') ? addRecommendedBonusXp : undefined)) {
          window.dispatchEvent(new CustomEvent(HOME_TASKS_REFRESH_EVENT));
          window.dispatchEvent(new CustomEvent(XP_INVALIDATE_EVENT));
        }
      } else if (t._source === 'project') {
        if (completeProjectTaskFromDialog(t._rawId || t.id, isTaskRecommended(t._rawId || t.id, 'project') ? addRecommendedBonusXp : undefined)) {
          window.dispatchEvent(new CustomEvent(PROJECT_TASKS_UPDATED_EVENT));
          window.dispatchEvent(new CustomEvent(XP_INVALIDATE_EVENT));
          setProjectTaskTree((prev) => {
            try {
              const saved = localStorage.getItem('projectTasks');
              if (!saved) return prev;
              const parsed = JSON.parse(saved);
              return parsed?.[0]?.children || prev;
            } catch {
              return prev;
            }
          });
        }
      }
    }
  };

  // 自訂時間選擇器狀態
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tpHour, setTpHour] = useState(0); // 0-23
  const [tpMinute, setTpMinute] = useState(0); // 0-55 step 5

  const timePickerTaskRef = useRef(null);
  const openTimePicker = (taskForTime) => {
    const t = taskForTime ?? selectedTask;
    timePickerTaskRef.current = t;
    const current = t?.details?.dueTime || t?.details?.time || '';
    const parsed = parseTimeForPicker(current, 0);
    setTpHour(parsed.hour);
    setTpMinute(parsed.minute);
    setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    const mm = String(tpMinute).padStart(2, '0');
    const hh = String(tpHour).padStart(2, '0');
    const timeValue = `${hh}:${mm}`;
    const t = timePickerTaskRef.current ?? selectedTask;
    if (t && t.id) {
      if (!t.level) {
        handleDetailChange(t.id, 'time', timeValue);
      } else {
        const targetField = t._editingTimeField === 'startTime' ? 'startTime' : 'dueTime';
        handleTaskDetailChange(targetField, timeValue);
      }
    }
    setShowTimePicker(false);
    timePickerTaskRef.current = null;
    setSelectedTask(prev => prev ? ({ ...prev, _editingTimeField: null }) : prev);
  };

  // 自訂提醒倒數選擇器
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [rpIndex, setRpIndex] = useState(-1);
  const [rpDays, setRpDays] = useState(0);
  const [rpHours, setRpHours] = useState(0);
  const [rpMinutes, setRpMinutes] = useState(0);
  const [rpDaysCustom, setRpDaysCustom] = useState('');
  
  // 編輯任務標題狀態
  const openReminderPicker = (reminder, index) => {
    setRpIndex(index);
    setRpDays(reminder?.days || 0);
    setRpHours(reminder?.hours || 0);
    setRpMinutes(reminder?.minutes || 0);
    setRpDaysCustom('');
    setShowReminderPicker(true);
  };

  const confirmReminderPicker = () => {
    if (rpIndex < 0 || !selectedTask) {
      setShowReminderPicker(false);
      return;
    }
    
    const updatedReminder = { days: rpDays, hours: rpHours, minutes: rpMinutes };
    
    // 如果是便條紙任務（沒有 level 屬性）
    if (!selectedTask.level) {
      const currentReminders = selectedTask.details?.reminders || [];
      const newReminders = [...currentReminders];
      newReminders[rpIndex] = updatedReminder;
      handleDetailChange(selectedTask.id, 'reminders', newReminders);
    } else {
      // 如果是項目任務
      setSelectedTask(prev => {
        const next = {...prev};
        const list = [...(next.details?.reminders || [])];
        list[rpIndex] = updatedReminder;
        next.details = { ...(next.details || {}), reminders: list };
        return next;
      });
    }
    setShowReminderPicker(false);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  // ReactQuill 編輯器變更處理
  const handleEditorChange = (content) => {
    if (selectedTask) {
      setSelectedTask(prev => ({ ...prev, description: content }));
    }
  };

  const extractDescriptionLinks = useCallback((content) => {
    const html = String(content || '');
    const links = [];
    const anchorUrls = new Set();

    // 優先使用 DOM 解析，避免 Quill 輸出格式變動造成 regex 漏抓
    try {
      if (typeof window !== 'undefined' && window.DOMParser) {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a[href]'));
        anchors.forEach((anchor) => {
          const href = String(anchor.getAttribute('href') || '').trim();
          if (!href || href.startsWith('#')) return;
          const normalizedHref = /^https?:\/\//i.test(href) ? href : (/^www\./i.test(href) ? `https://${href}` : href);
          anchorUrls.add(normalizedHref.toLowerCase());
          const labelText = String(anchor.textContent || '').replace(/\s+/g, ' ').trim() || '連結';
          links.push({ url: normalizedHref, label: labelText });
        });
      }
    } catch (error) {
      console.warn('Home link parse fallback to regex:', error);
    }

    // 備援：若 DOM 沒抓到，使用 regex 抓 <a>
    if (links.length === 0) {
      const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let anchorMatch;
      while ((anchorMatch = anchorPattern.exec(html)) !== null) {
        const rawUrl = anchorMatch[1]?.trim();
        if (!rawUrl || rawUrl.startsWith('#')) continue;
        const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : (/^www\./i.test(rawUrl) ? `https://${rawUrl}` : rawUrl);
        anchorUrls.add(url.toLowerCase());
        const inner = String(anchorMatch[2] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const label = inner || '連結';
        links.push({ url, label });
      }
    }

    // 補抓純文字 URL（http/https + www.）
    const plain = html.replace(/<[^>]*>/g, ' ');
    const textPattern = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
    let textMatch;
    while ((textMatch = textPattern.exec(plain)) !== null) {
      const raw = textMatch[1].replace(/[),.;!?]+$/g, '').trim();
      if (!raw) continue;
      const cleaned = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const key = cleaned.toLowerCase();
      if (anchorUrls.has(key)) continue;
      links.push({ url: cleaned, label: '連結' });
    }

    return links;
  }, []);

  const descriptionLinks = useMemo(
    () => extractDescriptionLinks(selectedTask?.description || selectedTask?.details?.description || ''),
    [extractDescriptionLinks, selectedTask?.description, selectedTask?.details?.description]
  );

  const projectTaskOptions = useMemo(() => {
    const flattened = flattenTaskTreeWithDepth(projectTaskTree);
    return flattened.map(({ task, depth }) => ({ id: String(task.id), title: task.title || '未命名任務', depth }));
  }, [projectTaskTree]);

  const visibleProjectTasks = useMemo(() => {
    const selected = new Set((projectDisplayTaskIds || []).map(String));
    return projectTaskOptions
      .filter(opt => selected.has(opt.id))
      .map(opt => findTaskByIdInTree(projectTaskTree, opt.id))
      .filter(Boolean);
  }, [projectDisplayTaskIds, projectTaskOptions, projectTaskTree]);

  const currentProjectSourceLabel = useMemo(() => {
    const selectedCount = (projectDisplayTaskIds || []).length;
    const totalCount = projectTaskOptions.length;
    if (totalCount === 0) return '無可選任務';
    if (selectedCount === 0) return '未選擇';
    if (selectedCount === totalCount) return '全選';
    return `已選 ${selectedCount} 個`;
  }, [projectDisplayTaskIds, projectTaskOptions.length]);

  const allProjectTaskIds = useMemo(() => projectTaskOptions.map(opt => opt.id), [projectTaskOptions]);
  const allSelected = useMemo(
    () => allProjectTaskIds.length > 0 && allProjectTaskIds.every(id => projectDisplayTaskIds.includes(id)),
    [allProjectTaskIds, projectDisplayTaskIds]
  );

  const toggleProjectTaskSource = useCallback((taskId) => {
    const id = String(taskId);
    setProjectDisplayTaskIds((prev) => {
      const current = Array.isArray(prev) ? prev.map(String) : [];
      if (current.includes(id)) return current.filter(v => v !== id);
      return [...current, id];
    });
  }, []);

  const toggleAllProjectTaskSources = useCallback(() => {
    setProjectDisplayTaskIds((prev) => {
      const current = Array.isArray(prev) ? prev.map(String) : [];
      const isAll = allProjectTaskIds.length > 0 && allProjectTaskIds.every(id => current.includes(id));
      return isAll ? [] : [...allProjectTaskIds];
    });
  }, [allProjectTaskIds]);

  const modalLayoutInfo = useMemo(() => {
    const defaultVisibleOrder = HOME_MODAL_ALLOWED_SECTIONS.filter(id => id !== 'subtasks' || (selectedTask?.children || []).some(sub => sub && !sub.isPlaceholder && !sub.isPlaceholderHeader));
    const makeInfo = (order, hidden = []) => {
      const rank = {};
      TASK_DETAIL_DEFAULT_ORDER.forEach((id, idx) => { rank[id] = idx; });
      order.forEach((id, idx) => { rank[id] = idx; });
      const visible = new Set(
        order
          .filter(id => HOME_MODAL_ALLOWED_SECTIONS.includes(id))
          .filter(id => !hidden.includes(id))
          .filter(id => id !== 'subtasks' || (selectedTask?.children || []).some(sub => sub && !sub.isPlaceholder && !sub.isPlaceholderHeader))
      );
      if (visible.size === 0) defaultVisibleOrder.forEach(id => visible.add(id));
      return { rank, visible };
    };

    if (!selectedTask?.id) return makeInfo(defaultVisibleOrder, []);
    try {
      const taskKey = `${TASK_LAYOUT_STORAGE_PREFIX}.${selectedTask.id}`;
      const typeKey = `${TYPE_LAYOUT_STORAGE_PREFIX}.${selectedTask.taskType || 'default'}`;
      const raw = localStorage.getItem(taskKey) || localStorage.getItem(typeKey) || localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
      if (!raw) return makeInfo(defaultVisibleOrder, []);
      const parsed = JSON.parse(raw);
      const incomingOrder = Array.isArray(parsed?.order) ? parsed.order : TASK_DETAIL_DEFAULT_ORDER;
      const normalizedOrder = incomingOrder.filter(id => TASK_DETAIL_DEFAULT_ORDER.includes(id));
      TASK_DETAIL_DEFAULT_ORDER.forEach(id => { if (!normalizedOrder.includes(id)) normalizedOrder.push(id); });
      const hidden = Array.isArray(parsed?.hidden) ? parsed.hidden : [];
      return makeInfo(normalizedOrder, hidden);
    } catch {
      return makeInfo(defaultVisibleOrder, []);
    }
  }, [selectedTask?.id, selectedTask?.taskType, selectedTask?.children]);

  const handleTaskDetailChange = (field, value) => {
    if (!selectedTask) return;
    
    setSelectedTask(prev => ({
      ...prev,
      details: {
        ...prev.details,
        [field]: value
      }
    }));
  };

  const handleAddReminder = () => {
    if (!selectedTask) return;
    
    const newReminder = {
      days: 0,
      hours: 0,
      minutes: 30
    };
    
    setSelectedTask(prev => ({
      ...prev,
      details: {
        ...prev.details,
        reminders: [...(prev.details?.reminders || []), newReminder]
      }
    }));
  };

  const handleRemoveReminder = (index) => {
    if (!selectedTask) return;
    
    setSelectedTask(prev => ({
      ...prev,
      details: {
        ...prev.details,
        reminders: prev.details?.reminders?.filter((_, i) => i !== index) || []
      }
    }));
  };


  const handleToggleTaskStatus = () => {
    if (!selectedTask) return;
    const toCompleted = selectedTask.status !== 'completed';
    if (toCompleted && selectedTask.level) {
      const isRepeat = selectedTask.details?.repeat?.enabled;
      if (isTaskRecommended(selectedTask.id, 'project')) {
        addRecommendedBonusXp(isRepeat ? 1 : 2);
      }
    }
    setSelectedTask(prev => ({
      ...prev,
      status: prev.status === 'completed' ? 'pending' : 'completed'
    }));
  };

  const handleSaveTask = () => {
    if (!selectedTask) return;
    const { _editingTimeField, ...cleanTask } = selectedTask;
    
    // 更新本地狀態（樹狀）
    setProjectTaskTree(prev => updateTaskInTree(prev, cleanTask.id, () => cleanTask));
    
    // 保存到 localStorage
    try {
      const savedProjectTasks = localStorage.getItem('projectTasks');
      if (savedProjectTasks) {
        const parsed = JSON.parse(savedProjectTasks);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].children) {
          const updatedProjectTasks = updateTaskInTree(parsed[0].children || [], cleanTask.id, () => cleanTask);
          const newProjectData = [
            {
              ...parsed[0],
              children: updatedProjectTasks
            }
          ];
          localStorage.setItem('projectTasks', JSON.stringify(newProjectData));
        }
      }
    } catch (error) {
      console.error('Error saving project task:', error);
    }
    
    // 关闭弹窗
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  useEffect(() => {
    localStorage.setItem('notificationHistory', JSON.stringify(notificationHistory));
  }, [notificationHistory]);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  // 載入項目管理任務，並執行重複任務重置（新週期時更新 repeatLog）
  useEffect(() => {
    try {
      const savedProjectTasks = localStorage.getItem('projectTasks');
      if (savedProjectTasks) {
        const parsed = JSON.parse(savedProjectTasks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const reset = resetProjectTasksIfNeeded(parsed);
          if (reset !== parsed) {
            try {
              localStorage.setItem('projectTasks', JSON.stringify(reset));
            } catch (e) {
              console.error('Error saving reset project tasks:', e);
            }
          }
          const children = reset[0]?.children ?? parsed[0]?.children ?? [];
          setProjectTaskTree(children);
        }
      }
    } catch (error) {
      console.error('Error loading project tasks:', error);
    }
  }, []);

  // 监听项目管理任务的变化
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const savedProjectTasks = localStorage.getItem('projectTasks');
        if (savedProjectTasks) {
          const parsed = JSON.parse(savedProjectTasks);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].children) {
            setProjectTaskTree(parsed[0].children || []);
            
            // 如果當前選中的任務在彈窗中，同步更新其描述
            if (selectedTask && showTaskModal) {
              const updatedTask = findTaskByIdInTree(parsed[0].children || [], selectedTask.id);
              if (updatedTask) {
                setSelectedTask(prev => ({
                  ...prev,
                  ...updatedTask,
                  details: {
                    ...(updatedTask.details || {}),
                    reminders: updatedTask.details?.reminders || [],
                    startDate: updatedTask.details?.startDate || '',
                    startTime: updatedTask.details?.startTime || '00:00',
                    dueDate: updatedTask.details?.dueDate || '',
                    dueTime: updatedTask.details?.dueTime || '23:59'
                  }
                }));
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading project tasks:', error);
      }
    };

    const handleProjectTasksUpdate = () => {
      handleStorageChange();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(PROJECT_TASKS_UPDATED_EVENT, handleProjectTasksUpdate);
    const handleTaskTagsUpdate = () => {
      try {
        const saved = localStorage.getItem('taskTags');
        const parsed = saved ? JSON.parse(saved) : [];
        setTaskTags(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Error loading task tags:', e);
      }
    };
    const storageHandlerForTags = (e) => { if (e.key === 'taskTags') handleTaskTagsUpdate(); };
    window.addEventListener('storage', storageHandlerForTags);
    window.addEventListener(TASK_TAGS_UPDATED_EVENT, handleTaskTagsUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(PROJECT_TASKS_UPDATED_EVENT, handleProjectTasksUpdate);
      window.removeEventListener('storage', storageHandlerForTags);
      window.removeEventListener(TASK_TAGS_UPDATED_EVENT, handleTaskTagsUpdate);
    };
  }, [selectedTask, showTaskModal]);

  useEffect(() => {
    if (!showTaskModal || !selectedTask || !selectedTask.level) return;
    const { _editingTimeField, ...cleanTask } = selectedTask;
    setProjectTaskTree(prev => updateTaskInTree(prev, cleanTask.id, () => cleanTask));
    try {
      const savedProjectTasks = localStorage.getItem('projectTasks');
      if (!savedProjectTasks) return;
      const parsed = JSON.parse(savedProjectTasks);
      if (!(Array.isArray(parsed) && parsed.length > 0 && parsed[0].children)) return;
      const updatedProjectTasks = updateTaskInTree(parsed[0].children || [], cleanTask.id, () => cleanTask);
      localStorage.setItem('projectTasks', JSON.stringify([{ ...parsed[0], children: updatedProjectTasks }]));
    } catch (error) {
      console.error('Error auto-saving project task:', error);
    }
  }, [selectedTask, showTaskModal]);

  useEffect(() => {
    try {
      localStorage.setItem(HOME_PROJECT_DISPLAY_TASK_IDS_KEY, JSON.stringify(projectDisplayTaskIds));
    } catch (error) {
      console.error('Error saving home project display parent:', error);
    }
  }, [projectDisplayTaskIds]);

  useEffect(() => {
    const handler = () => setShowOverviewSettings(true);
    window.addEventListener(OPEN_OVERVIEW_USER_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_OVERVIEW_USER_SETTINGS_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      try {
        const savedTasks = localStorage.getItem('tasks');
        const savedCompleted = localStorage.getItem('completedTasks');
        setTasks(savedTasks ? JSON.parse(savedTasks) : []);
        setCompletedTasks(savedCompleted ? JSON.parse(savedCompleted) : []);
      } catch (e) {
        console.error('Error refreshing tasks:', e);
      }
    };
    window.addEventListener(HOME_TASKS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(HOME_TASKS_REFRESH_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => setXpNoteVersion((v) => v + 1);
    window.addEventListener(XP_INVALIDATE_EVENT, handler);
    return () => window.removeEventListener(XP_INVALIDATE_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { task, source } = e.detail || {};
      if (!task || !source) return;
      if (source === 'project') {
        handleProjectTaskClick(task);
      } else if (source === 'note') {
        setNoteTaskDetailPopupTaskId(task._rawId ?? task.id);
      }
    };
    window.addEventListener(OPEN_TASK_DETAIL_EVENT, handler);
    return () => window.removeEventListener(OPEN_TASK_DETAIL_EVENT, handler);
  }, [handleProjectTaskClick]);

  useEffect(() => {
    setProjectDisplayTaskIds((prev) => {
      if (!Array.isArray(projectTaskOptions) || projectTaskOptions.length === 0) {
        return Array.isArray(prev) ? prev.map(String) : [];
      }
      const current = Array.isArray(prev) ? prev.map(String) : [];
      const validSet = new Set(projectTaskOptions.map(opt => opt.id));
      const valid = current.filter((id) => validSet.has(id));
      if (valid.length > 0) return valid;
      try {
        const saved = localStorage.getItem(HOME_PROJECT_DISPLAY_TASK_IDS_KEY);
        if (!saved) return projectTaskOptions.map(opt => opt.id); // 首次預設全選
      } catch {
        // ignore
      }
      return valid;
    });
  }, [projectTaskOptions]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!projectSourceRef.current) return;
      if (!projectSourceRef.current.contains(event.target)) {
        setProjectSourceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenProjectManagement = useCallback(() => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      window.open('/projects', '_blank', 'noopener,noreferrer');
      return;
    }
    navigate('/projects');
  }, [navigate]);

  return (
    <div className="home-container">
      {/* 上方區域 */}
      <header className="header">
        <div className="header-user-block">
          <div className="user-info">
            <span className="username">{userId || '系頭發光體'}</span>
            <span className="level">LV.{levelInfo.level}</span>
          </div>
          <div className="progress-bars">
            <div className="progress-bar-row progress-bar-clickable" onClick={() => setProgressPopupPeriod('total')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setProgressPopupPeriod('total')}>
              <span className="progress-bar-label">總進度</span>
              <div className="progress-bar-track" title="總體任務完成度">
                <div className="progress-bar blue" style={{ width: `${completionPercent}%`, backgroundColor: '#52D0FF' }}></div>
              </div>
            </div>
            <div className="progress-bar-row progress-bar-clickable" onClick={() => setProgressPopupPeriod('month')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setProgressPopupPeriod('month')}>
              <span className="progress-bar-label">本月任務</span>
              <div className="progress-bar-track" title="本月任務完成度">
                <div className="progress-bar blue" style={{ width: `${monthPercent}%`, backgroundColor: '#52D0FF' }}></div>
              </div>
            </div>
            <div className="progress-bar-row progress-bar-clickable" onClick={() => setProgressPopupPeriod('week')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setProgressPopupPeriod('week')}>
              <span className="progress-bar-label">本週任務</span>
              <div className="progress-bar-track" title="本週任務完成度">
                <div className="progress-bar blue" style={{ width: `${weekPercent}%`, backgroundColor: '#52D0FF' }}></div>
              </div>
            </div>
            <div className="progress-bar-row progress-bar-clickable" onClick={() => setProgressPopupPeriod('day')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setProgressPopupPeriod('day')}>
              <span className="progress-bar-label">本日任務</span>
              <div className="progress-bar-track" title="本日任務完成度">
                <div className="progress-bar blue" style={{ width: `${dayPercent}%`, backgroundColor: '#52D0FF' }}></div>
              </div>
            </div>
            <div className="progress-bar-row">
              <span className="progress-bar-label">經驗值</span>
              <div className="progress-bar-track" title="經驗值 / 升級所需">
                <div className="progress-bar orange" style={{ width: `${levelInfo.progressPercent}%`, backgroundColor: '#FF9800' }}></div>
              </div>
            </div>
          </div>
        </div>
        <div className="avatar-container">
          <div
            className={`avatar-character ${avatar ? 'has-avatar' : ''}`}
            style={avatar ? { backgroundImage: `url(${avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {!avatar && <IoPerson className="avatar-character-icon" />}
          </div>
        </div>
      </header>

      {/* 進度任務彈窗 */}
      {progressPopupPeriod && (
        <div
          className="progress-popup-overlay"
          onClick={() => setProgressPopupPeriod(null)}
          role="presentation"
        >
          <div
            className="progress-popup"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={progressPopupTitle}
          >
            <div className="progress-popup-header">
              <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>{progressPopupTitle}</h3>
              <button
                type="button"
                onClick={() => setProgressPopupPeriod(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer' }}
                aria-label="關閉"
              >
                ×
              </button>
            </div>
            <div className="progress-popup-body">
              {progressPopupTasks.length === 0 ? (
                <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>暫無任務</p>
              ) : (
                <div className="home-subtasks-list character-recommend-list">
                  {progressPopupTasks.map((t) => {
                    const isCompleted = t.completed || (t._source === 'project' && (t._todayCompletedFromRepeat ?? (t.status === 'completed')));
                    const tForDue = t._source === 'note' && t.details?.date
                      ? { ...t, details: { ...(t.details || {}), dueDate: t.details.dueDate || t.details.date } }
                      : t;
                    const daysUntil = getDueDate(tForDue) ? getDaysUntilDue(tForDue) : null;
                    const countdownText = daysUntil != null
                      ? (daysUntil < 0 ? `已逾期 ${-daysUntil} 天` : daysUntil === 0 ? '今天截止' : `剩 ${daysUntil} 天`)
                      : null;
                    const title = t.title || t.text || '未命名';
                    const handleOpenTaskDetail = (e) => {
                      if (e.target.closest('button.home-subtask-check')) return;
                      if (t._source === 'project') {
                        handleProjectTaskClick(t);
                      } else if (t._source === 'note') {
                        setNoteTaskDetailPopupTaskId(t._rawId || t.id);
                      }
                      setProgressPopupPeriod(null);
                    };
                    return (
                      <div
                        key={t._source === 'note' ? `note:${t.id}` : `project:${t.id}`}
                        className={`home-subtask-item ${isCompleted ? 'completed' : ''}`}
                        onClick={handleOpenTaskDetail}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenTaskDetail(e); } }}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="home-subtask-title">{title}</span>
                          {!isCompleted && countdownText && (
                            <span className={`home-subtask-countdown ${daysUntil < 0 ? 'overdue' : ''}`}>{countdownText}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={`home-subtask-check ${isCompleted ? 'completed' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleProgressTaskToggle(t); }}
                          aria-label={isCompleted ? '取消完成' : '標記完成'}
                        >
                          {isCompleted ? '✓' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 側邊按鈕 */}
      <div className="side-buttons">
        <button className="mail-btn">
          <IoMail />
        </button>
        <button className="settings-btn" onClick={() => setShowOverviewSettings(prev => !prev)}>
          <IoSettings />
        </button>
      </div>

      {/* 總覽設定面板 */}
      {showOverviewSettings && (
        <div
          className="overview-settings-overlay"
          onClick={() => setShowOverviewSettings(false)}
        >
          <div
            ref={overviewSettingsRef}
            className="overview-settings-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overview-settings-header">
              <h3>總覽設定</h3>
              <button className="overview-settings-close" onClick={() => setShowOverviewSettings(false)}>×</button>
            </div>
            <div className="overview-settings-body">
              <div className="overview-settings-section">
                <h4>使用者資料</h4>
                <div className="form-group avatar-upload-group">
                  <label>大頭貼</label>
                  <div className="avatar-upload-row">
                    <div
                      className="avatar-preview"
                      style={avatar ? { backgroundImage: `url(${avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                    />
                    <div className="avatar-upload-actions">
                      <label className="avatar-upload-btn">
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file || !file.type.startsWith('image/')) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const dataUrl = reader.result;
                              if (typeof dataUrl === 'string' && dataUrl.length > 500000) {
                                const img = new Image();
                                img.onload = () => {
                                  const canvas = document.createElement('canvas');
                                  const max = 200;
                                  let w = img.width;
                                  let h = img.height;
                                  if (w > h && w > max) {
                                    h = (h * max) / w;
                                    w = max;
                                  } else if (h > max) {
                                    w = (w * max) / h;
                                    h = max;
                                  }
                                  canvas.width = w;
                                  canvas.height = h;
                                  const ctx = canvas.getContext('2d');
                                  ctx.drawImage(img, 0, 0, w, h);
                                  const compressed = canvas.toDataURL('image/png');
                                  setAvatar(compressed);
                                  setAvatarState(compressed);
                                  dispatchAvatarUpdated();
                                };
                                img.src = dataUrl;
                              } else {
                                setAvatar(dataUrl);
                                setAvatarState(dataUrl);
                                dispatchAvatarUpdated();
                              }
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                        上傳圖片
                      </label>
                      {avatar && (
                        <button
                          type="button"
                          className="avatar-remove-btn"
                          onClick={() => {
                            setAvatar(null);
                            setAvatarState(null);
                            dispatchAvatarUpdated();
                          }}
                        >
                          移除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>使用者 ID</label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUserIdState(v);
                      setUserId(v);
                    }}
                    placeholder="輸入使用者 ID"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 中央區域 */}
      <main className="main-content">
        <div className="note-section">
          <div className="task-list">
            <h3 className="section-title">便條紙任務</h3>
            {/* 新任務輸入框 */}
            <div className="new-task">
              <button className="task-check new-task-check">✓</button>
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyPress={handleNewTask}
                placeholder="新增任務..."
                className="task-input"
              />
            </div>
           
            {/* 可拖曳的任務列表 */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="tasks">
                {(provided) => {
                  return (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      onClick={(e) => e.stopPropagation()}
                      className="note-tasks-grid"
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}
                    >
                      {tasks.map((task, index) => {
                        return (
                          <Draggable
                            key={task.id}
                            draggableId={task.id.toString()}
                            index={index}
                          >
                            {(provided, snapshot) => {
                              return (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`task ${task.completed ? 'task-completed' : ''}`}
                                  onClick={(e) => {
                                    if (e.target.closest('.task-check')) return;
                                    e.stopPropagation();
                                    setNoteTaskDetailPopupTaskId(task.id);
                                  }}
                                  onContextMenu={(e) => handleNoteTaskContextMenu(e, task.id)}
                                  onTouchStart={() => handleNoteTaskTouchStart(task.id)}
                                  onTouchEnd={handleNoteTaskTouchEnd}
                                  onTouchCancel={handleNoteTaskTouchEnd}
                                >
                                  <button
                                    className="task-check"
                                    onClick={(e) => { e.stopPropagation(); handleTaskComplete(task.id); }}
                                  >
                                    {task.completed ? '✓' : ''}
                                  </button>
                                  <div className="note-task-content">
                                    <span className="task-text">{task.text}</span>
                                    {!task.completed && (() => {
                                      const tForDue = task.details?.date ? { ...task, details: { ...(task.details || {}), dueDate: task.details.dueDate || task.details.date } } : task;
                                      const daysUntil = getDueDate(tForDue) ? getDaysUntilDue(tForDue) : null;
                                      const countdownText = daysUntil != null ? (daysUntil < 0 ? `已逾期 ${-daysUntil} 天` : daysUntil === 0 ? '今天截止' : `剩 ${daysUntil} 天`) : null;
                                      const isOverdue = daysUntil != null && daysUntil < 0;
                                      return countdownText ? <span className={`note-task-countdown ${isOverdue ? 'overdue' : ''}`}>{countdownText}</span> : null;
                                    })()}
                                  </div>
                                </div>
                              );
                            }}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  );
                }}
              </Droppable>
            </DragDropContext>

            {/* 便條紙任務詳細設定彈窗 - 使用 Portal 渲染到 body，確保在最上層並壓暗背景 */}
            {noteTaskDetailPopupTaskId && (() => {
              const task = tasks.find(t => t.id === noteTaskDetailPopupTaskId) || completedTasks.find(t => t.id === noteTaskDetailPopupTaskId);
              if (!task) return null;
              return createPortal(
                <div
                  className="note-task-detail-popup-overlay"
                  onClick={() => setNoteTaskDetailPopupTaskId(null)}
                >
                  <div className="note-task-detail-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="note-task-detail-popup-header">
                      <span>詳細設定</span>
                      <button type="button" onClick={() => setNoteTaskDetailPopupTaskId(null)}>×</button>
                    </div>
                    <div className="note-task-detail-popup-body">
                      <div className="form-group">
                        <div className="group-header"><label>任務名稱</label></div>
                        <input type="text" placeholder="輸入任務名稱" value={task.text || ''} onChange={(e) => handleTaskTextChange(task.id, e.target.value)} />
                      </div>
                      <div className="form-group">
                        <div className="group-header"><label>截止日期</label></div>
                        <div className="date-time-row note-popup-datetime">
                          <div className="date-fake-wrapper">
                            <div className={`fake-input note-due-date ${!formatDateForInput(task.details?.date) ? 'is-placeholder' : ''}`} onClick={() => { const el = document.getElementById(`date-input-popup-${task.id}`); if (el?.showPicker) el.showPicker(); else el?.focus(); }}>
                              {formatDateForInput(task.details?.date) || 'YYYY / MM / DD'}
                            </div>
                            <input id={`date-input-popup-${task.id}`} type="date" className="visually-hidden-date" value={formatDateForInput(task.details?.date)} onChange={(e) => handleDetailChange(task.id, 'date', e.target.value)} tabIndex={-1} />
                          </div>
                          <div className="fake-input note-due-time" onClick={(e) => { e.preventDefault(); openTimePicker(task); }}>
                            {task.details?.time || '00:00'}
                          </div>
                        </div>
                      </div>
                      <div className="form-group">
                        <div className="group-header">
                          <label>提前提醒</label>
                          <button className="link-add-btn" onClick={() => { const r = task.details?.reminders || []; handleDetailChange(task.id, 'reminders', [...r, { days: 0, hours: 0, minutes: 30 }]); }}><IoAdd /> 添加提醒</button>
                        </div>
                        <div className="reminder-section">
                          {task.details?.reminders?.length > 0 ? (
                            <div className="reminder-list">
                              {task.details.reminders.map((reminder, index) => (
                                <div key={index} className="reminder-item" onClick={() => { setSelectedTask({...task, details: {...task.details}}); openReminderPicker(reminder, index); }}>
                                  <span className="reminder-text">{reminder.days > 0 && `${reminder.days}天`}{reminder.hours > 0 && `${reminder.hours}小時`}{reminder.minutes > 0 && `${reminder.minutes}分鐘`}</span>
                                  <button className="remove-reminder-btn" onClick={(e) => { e.stopPropagation(); handleDetailChange(task.id, 'reminders', (task.details?.reminders || []).filter((_, i) => i !== index)); }}>×</button>
                                </div>
                              ))}
                            </div>
                          ) : <span className="no-reminders">暫無提醒設置</span>}
                        </div>
                      </div>
                      <div className="form-group">
                        <div className="group-header"><label>地點</label></div>
                        <input type="text" placeholder="添加地點" value={task.details?.location || ''} onChange={(e) => handleDetailChange(task.id, 'location', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <div className="group-header"><label>重複</label></div>
                        <select value={task.details?.repeat || ''} onChange={(e) => handleDetailChange(task.id, 'repeat', e.target.value)}>
                          <option value="">不重複</option>
                          <option value="daily">每天</option>
                          <option value="weekly">每週</option>
                          <option value="monthly">每月</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              );
            })()}

            {/* 便條紙任務刪除確認彈窗 - 使用 Portal 渲染到 body */}
            {noteTaskDeletePopupTaskId && createPortal(
              <div className="note-task-delete-popup-overlay" onClick={() => setNoteTaskDeletePopupTaskId(null)}>
                <div className="note-task-delete-popup" onClick={(e) => e.stopPropagation()}>
                  <p>確定要刪除此任務嗎？</p>
                  <div className="note-task-delete-popup-actions">
                    <button type="button" onClick={() => setNoteTaskDeletePopupTaskId(null)}>取消</button>
                    <button type="button" className="delete-confirm" onClick={() => { handleDeleteTask(noteTaskDeletePopupTaskId); setNoteTaskDeletePopupTaskId(null); }}>刪除</button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {completedTasks.length > 0 && (
              <div className="completed-tasks-section">
                <h3 className="completed-tasks-title">已完成的任務</h3>
                <div className="completed-tasks note-tasks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {completedTasks.map(task => (
                    <div
                      key={task.id}
                      className="task task-completed"
                      onClick={(e) => {
                        if (e.target.closest('.task-check')) return;
                        e.stopPropagation();
                        setNoteTaskDetailPopupTaskId(task.id);
                      }}
                      onContextMenu={(e) => handleNoteTaskContextMenu(e, task.id)}
                      onTouchStart={() => handleNoteTaskTouchStart(task.id)}
                      onTouchEnd={handleNoteTaskTouchEnd}
                      onTouchCancel={handleNoteTaskTouchEnd}
                    >
                      <button
                        className="task-check"
                        onClick={(e) => { e.stopPropagation(); handleTaskComplete(task.id); }}
                      >
                        ✓
                      </button>
                      <span className="task-text">{task.text}</span>
                      <span className="task-completed-time">
                        {new Date(task.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 项目管理任务区域 */}
        <div className="project-section">
          <div className="project-task-list">
            <div className="project-section-header-row">
              <h3 className="section-title" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={handleOpenProjectManagement}>項目管理</h3>
              <div className="project-source-picker" ref={projectSourceRef}>
                <button
                  type="button"
                  className="project-source-btn"
                  onClick={() => setProjectSourceOpen(prev => !prev)}
                >
                  顯示任務：{currentProjectSourceLabel}
                  <span style={{ marginLeft: '6px', fontSize: '10px', color: '#8b95a3' }}>{projectSourceOpen ? '▲' : '▼'}</span>
                </button>
                {projectSourceOpen && (
                  <div className="project-source-dropdown">
                    <button
                      type="button"
                      className={`project-source-option ${allSelected ? 'active' : ''}`}
                      onClick={toggleAllProjectTaskSources}
                    >
                      <span className={`project-source-check ${allSelected ? 'checked' : ''}`}>{allSelected ? '✓' : ''}</span>
                      <span>全選</span>
                    </button>
                    {projectTaskOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`project-source-option ${projectDisplayTaskIds.includes(opt.id) ? 'active' : ''}`}
                        onClick={() => toggleProjectTaskSource(opt.id)}
                      >
                        <span className={`project-source-check ${projectDisplayTaskIds.includes(opt.id) ? 'checked' : ''}`}>
                          {projectDisplayTaskIds.includes(opt.id) ? '✓' : ''}
                        </span>
                        <span>{opt.depth >= 0 ? `${'　'.repeat(opt.depth)}${opt.title}` : opt.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {visibleProjectTasks.length === 0 ? (
              <div className="empty-project-tasks">
                <p>暫無ABCD任務</p>
                <button 
                  className="go-to-projects-btn"
                  onClick={() => navigate('/projects')}
                >
                  前往項目管理
                </button>
              </div>
            ) : (
              <div className="project-tasks-grid">
                {visibleProjectTasks.map((task, index) => (
                  <div 
                    key={task.id} 
                    className="project-task-card"
                    onClick={() => handleProjectTaskClick(task)}
                  >
                    <div className="task-card-header">
                      <span className={`level-badge level-${task.level?.toLowerCase() || 'a'}`}>
                        {task.level || 'A'}
                      </span>
                      <span className="task-card-title">{task.title || `Task ${index + 1}`}</span>
                    </div>
                    <div className="task-card-status">
                      <span className={`status-indicator ${task.status === 'completed' ? 'completed' : 'pending'}`}>
                        {task.status === 'completed' ? '已完成' : '進行中'}
                      </span>
                    </div>
                    {task.details?.dueDate && (
                      <div className="task-card-due-date">
                        <BsCalendar />
                        <span>{new Date(task.details.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 底部導航 */}
      <nav className="bottom-nav">
        <button className="home-btn">
          <IoHome />
        </button>
        <button className="add-task-btn">
          <IoAdd />
        </button>
        <button
          className="project-btn"
          onClick={() => navigate('/projects')}
        >
          <IoList />
          項目管理
        </button>
        <button className="game-btn">
          <IoGameController />
        </button>
      </nav>

      {/* 通知組件 */}
      <div className="notifications-container">
        {activeNotifications.map(notification => (
          <div key={notification.id} className="custom-notification">
            <div className="notification-content">
              <BsBell className="notification-icon" />
              <span>{notification.message}</span>
            </div>
            <button
              className="notification-close"
              onClick={() => handleCloseNotification(notification.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 任务详情弹窗 */}
      {showTaskModal && selectedTask && (
        <div className="task-modal-overlay" onClick={handleCloseTaskModal}>
          <div className="task-modal" onClick={(e) => e.stopPropagation()}>
            <div className="task-modal-header">
              <div className="task-modal-title">
                <span className={`level-badge level-${selectedTask.level?.toLowerCase() || 'a'}`}>
                  {selectedTask.level || 'A'}
                </span>
                <input
                  className="task-number-input"
                  value={selectedTask.title || ''}
                  onChange={(e) => setSelectedTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="任務名稱"
                />
              </div>
              <div className="task-modal-actions">
                <button 
                  className={`header-complete-btn ${selectedTask.status === 'completed' ? 'completed' : ''}`}
                  onClick={handleToggleTaskStatus}
                >
                  {selectedTask.status === 'completed' ? '✓ 完成' : '✓ 完成'}
                </button>
              </div>
            </div>

            <div className="task-modal-content">
              <div className="form-group" style={{ order: modalLayoutInfo.rank['start-date'] ?? 0, display: modalLayoutInfo.visible.has('start-date') ? undefined : 'none' }}>
                <div className="date-time-row" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'max-content', whiteSpace: 'nowrap' }}>
                  <div className="date-fake-wrapper">
                    <div
                      className="fake-input"
                      style={{ width: '120px' }}
                      onClick={() => {
                        const el = startDateInputRef.current;
                        if (!el) return;
                        if (el.showPicker) el.showPicker();
                        else el.focus();
                      }}
                    >
                      {formatDateForInput(selectedTask.details?.startDate)?.replace(/-/g, '/') || 'YYYY/MM/DD'}
                    </div>
                    <input
                      ref={startDateInputRef}
                      type="date"
                      className="visually-hidden-date"
                      value={formatDateForInput(selectedTask.details?.startDate)}
                      onChange={(e)=>handleTaskDetailChange('startDate', e.target.value)}
                      tabIndex={-1}
                    />
                  </div>
                  <div
                    className="input-with-icon click-box no-icon"
                    onClick={(e) => {
                      e.preventDefault();
                      const current = selectedTask?.details?.startTime || '';
                      const parsed = parseTimeForPicker(current, 0);
                      setTpHour(parsed.hour);
                      setTpMinute(parsed.minute);
                      setSelectedTask(prev => ({ ...prev, _editingTimeField: 'startTime' }));
                      setShowTimePicker(true);
                    }}
                  >
                    <div className="fake-input" style={{ width: '100px', textAlign: 'center' }}>
                      {formatTimeForDisplay(selectedTask.details?.startTime, '00:00')}
                    </div>
                  </div>
                  <span style={{ color: '#999', fontWeight: 500 }}>~</span>
                  <div className="date-fake-wrapper">
                    <div
                      className="fake-input"
                      style={{ width: '120px' }}
                      onClick={() => {
                        const el = dateInputRef.current;
                        if (!el) return;
                        if (el.showPicker) el.showPicker();
                        else el.focus();
                      }}
                    >
                      {formatDateForInput(selectedTask.details?.dueDate)?.replace(/-/g, '/') || 'YYYY/MM/DD'}
                    </div>
                    <input
                      ref={dateInputRef}
                      type="date"
                      className="visually-hidden-date"
                      value={formatDateForInput(selectedTask.details?.dueDate)}
                      onChange={(e)=>handleTaskDetailChange('dueDate', e.target.value)}
                      tabIndex={-1}
                    />
                  </div>
                  <div
                    className="input-with-icon click-box no-icon"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedTask(prev => ({ ...prev, _editingTimeField: 'dueTime' }));
                      openTimePicker();
                    }}
                  >
                    <div className="fake-input" style={{ width: '100px', textAlign: 'center' }}>
                      {formatTimeForDisplay(selectedTask.details?.dueTime, '23:59')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ order: modalLayoutInfo.rank.reminders ?? 1, display: modalLayoutInfo.visible.has('reminders') ? undefined : 'none' }}>
                <div className="group-header">
                  <label>提前提醒</label>
                  <button className="link-add-btn" onClick={handleAddReminder}>
                    <IoAdd /> 添加提醒
                  </button>
                </div>
                <div className="reminder-section">
                  {selectedTask.details?.reminders && selectedTask.details.reminders.length > 0 ? (
                    <div className="reminder-list">
                      {selectedTask.details.reminders.map((reminder, index) => (
                        <div key={index} className="reminder-item" onClick={() => openReminderPicker(reminder, index)}>
                          <span className="reminder-text">
                            {reminder.days > 0 && `${reminder.days}天`}
                            {reminder.hours > 0 && `${reminder.hours}小時`}
                            {reminder.minutes > 0 && `${reminder.minutes}分鐘`}
                          </span>
                          <button 
                            className="remove-reminder-btn"
                            onClick={() => handleRemoveReminder(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="no-reminders">暫無提醒設置</span>
                  )}
                </div>
              </div>

              

              <div className="form-group" style={{ order: modalLayoutInfo.rank.description ?? 2, display: modalLayoutInfo.visible.has('description') ? undefined : 'none' }}>
                <div className="editor-container">
                  <ReactQuill
                    theme="snow"
                    value={selectedTask.description || ''}
                    onChange={handleEditorChange}
                    modules={modules}
                    formats={formats}
                    placeholder="在這裡輸入任務描述..."
                    preserveWhitespace={true}
                  />
                </div>
                {Array.isArray(descriptionLinks) && descriptionLinks.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {descriptionLinks.map((link, idx) => (
                      <a
                        key={`${link.url}-${idx}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ border: '1px solid #e1e5e9', background: '#fff', color: '#666', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', maxWidth: '320px' }}
                        title={link.url}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.label}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {Array.isArray(selectedTask.children) && selectedTask.children.filter(sub => sub && !sub.isPlaceholder && !sub.isPlaceholderHeader).length > 0 && modalLayoutInfo.visible.has('subtasks') && (
                <div className="form-group" style={{ order: modalLayoutInfo.rank.subtasks ?? 3 }}>
                  <label>子任務清單</label>
                  <div className="home-subtasks-list">
                    {selectedTask.children
                      .filter(sub => sub && !sub.isPlaceholder && !sub.isPlaceholderHeader)
                      .map((subtask) => (
                        <div key={subtask.id} className="home-subtask-item">
                          <span className="home-subtask-title">{subtask.title}</span>
                          <button
                            className={`home-subtask-check ${subtask.status === 'completed' ? 'completed' : ''}`}
                            onClick={() => {
                              setSelectedTask(prev => ({
                                ...prev,
                                children: (prev.children || []).map(c => (
                                  c.id === subtask.id
                                    ? { ...c, status: c.status === 'completed' ? 'pending' : 'completed' }
                                    : c
                                ))
                              }));
                            }}
                          >
                            {subtask.status === 'completed' ? '✓' : ''}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      {showTimePicker && (
        <div className="time-picker-overlay" onClick={() => setShowTimePicker(false)}>
          <div className="time-picker" onClick={(e) => e.stopPropagation()}>
            <div className="time-picker-wheels">
              <div className="wheel">
                {[...Array(24)].map((_,i)=> (
                  <div
                    key={i}
                    className={`wheel-item ${tpHour === i ? 'active' : ''}`}
                    onClick={() => setTpHour(i)}
                  >{String(i).padStart(2, '0')}</div>
                ))}
              </div>
              <div className="wheel">
                {[...Array(12)].map((_,i)=>{
                  const v = i*5;
                  const label = String(v).padStart(2,'0');
                  return (
                    <div
                      key={v}
                      className={`wheel-item ${tpMinute === v ? 'active' : ''}`}
                      onClick={() => setTpMinute(v)}
                    >{label}</div>
                  );
                })}
              </div>
            </div>
            <div className="time-picker-actions">
              <button className="cancel-btn" onClick={()=>setShowTimePicker(false)}>取消</button>
              <button className="save-btn" onClick={confirmTimePicker}>確定</button>
            </div>
          </div>
        </div>
      )}
      {showReminderPicker && (
        <div className="time-picker-overlay" onClick={() => setShowReminderPicker(false)}>
          <div className="time-picker" onClick={(e)=>e.stopPropagation()}>
            <div className="time-picker-wheels">
              <div className="wheel">
                <div className="wheel-item custom-input">
                  <span>自填天數</span>
                  <input
                    type="number"
                    min={0}
                    value={rpDaysCustom}
                    onChange={(e)=>setRpDaysCustom(e.target.value.replace(/[^\d]/g,''))}
                  />
                  <button className="mini-apply" onClick={()=>setRpDays(Math.max(0, parseInt(rpDaysCustom || '0',10)))}>套用</button>
                </div>
                {[...Array(200)].map((_,i)=> (
                  <div
                    key={i}
                    className={`wheel-item ${rpDays === i ? 'active' : ''}`}
                    onClick={()=>setRpDays(i)}
                  >{i} 天</div>
                ))}
              </div>
              <div className="wheel">
                {[...Array(25)].map((_,i)=> (
                  <div
                    key={i}
                    className={`wheel-item ${rpHours === i ? 'active' : ''}`}
                    onClick={()=>setRpHours(i)}
                  >{i} 小時</div>
                ))}
              </div>
              <div className="wheel">
                {[...Array(61)].map((_,i)=> (
                  <div
                    key={i}
                    className={`wheel-item ${rpMinutes === i ? 'active' : ''}`}
                    onClick={()=>setRpMinutes(i)}
                  >{String(i).padStart(2,'0')} 分</div>
                ))}
              </div>
            </div>
            <div className="time-picker-actions">
              <button className="cancel-btn" onClick={()=>setShowReminderPicker(false)}>取消</button>
              <button className="save-btn" onClick={confirmReminderPicker}>確定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;