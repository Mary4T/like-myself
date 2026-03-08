import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import DrawingCanvas from '../TaskComponents/DrawingCanvas';
import { IoAdd, IoChevronDown, IoChevronUp, IoClose } from 'react-icons/io5';
import { BsTrash, BsPencil, BsCheck2Circle, BsXCircle } from 'react-icons/bs';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { TextField } from '@mui/material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import debounce from 'lodash/debounce';
import DateTimePicker from '../../components/TaskComponents/DateTimePicker';
import IconSelector from '../../components/TaskComponents/IconSelector';
import { DEFAULT_ICONS } from '../../components/TaskComponents/IconSelector/defaultIcons';
import './ProjectTasks.css';
import '../../Home.css';
import { FaTasks } from 'react-icons/fa';  // 添加這行到文件頂部

const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("此瀏覽器不支持通知功能");
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
};

const modules = {
  toolbar: [
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link', 'image'],
    ['clean']
  ]
};

const formats = [
  'font',
  'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'align',
  'link', 'image'
];

const CountdownTimer = ({ dueDate }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const due = new Date(dueDate);
      const diff = due - now;

      if (diff <= 0) {
        return '已到期';
      }

      // 計算各個時間單位
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // 根據剩餘時間決定顯示格式
      if (days > 0) {
        return `剩餘 ${days} 天`;
      } else if (hours > 0) {
        return `剩餘 ${hours} 小時 ${minutes} 分鐘`;
      } else if (minutes > 0) {
        return `剩餘 ${minutes} 分鐘 ${seconds} 秒`;
      } else {
        return `剩餘 ${seconds} 秒`;
      }
    };

    // 初始計算
    setTimeLeft(calculateTimeLeft());

    // 設置定時器
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // 清理定時器
    return () => clearInterval(timer);
  }, [dueDate]);

  return <span className="countdown-timer">{timeLeft}</span>;
};

const TEMPLATE_STORAGE_KEY = 'projectTaskTemplates';

// 內建預設模板：生活環境整理
const BUILTIN_TEMPLATES = [
  {
    id: 'life_environment_cleaning',
    name: '【生活環境整理】',
    rootTitle: '生活空間深度整理計畫',
    description: '目標設定：選擇3-5個常用小區域，逐一完成深度整理',
    tree: [
      {
        title: '整理前準備與規劃', level: 'B', children: [
          {
            title: '選定整理區域', level: 'C', children: [
              { title: '列出所有常用小區域', level: 'D', hasCapsules: true },
              { title: '按使用頻率排序，選出前3-5個優先區域', level: 'D' },
              { title: '預估每區域需要的集中時間（建議2-4小時）', level: 'D' }
            ]
          },
          {
            title: '準備整理工具', level: 'C', children: [
              { title: '準備四個容器/袋子（標示：保留/丟棄/捐贈/出售）', level: 'D' },
              { title: '準備清潔用品', level: 'D' },
              { title: '準備收納用品（盒子、標籤等）', level: 'D' }
            ]
          },
          {
            title: '時間與獎勵規劃', level: 'C', children: [
              { title: '安排集中整理時間（週末半天或完整空閒時段）', level: 'D' },
              { title: '設定每個區域完成的小獎勵', level: 'D' },
              { title: '設定全部完成的大獎勵', level: 'D' }
            ]
          }
        ]
      },
      {
        title: '建立維持機制（新習慣培養）', level: 'B', children: [
          {
            title: '設計維持規則', level: 'C', children: [
              { title: '為每個整理完的區域制定「物歸原處」規則', level: 'D' },
              { title: '設定每日5分鐘維持時間', level: 'D' },
              { title: '建立每週檢視提醒', level: 'D' }
            ]
          },
          {
            title: '定期檢查制度', level: 'C', children: [
              { title: '設定每月第一個週日為檢查日', level: 'D' },
              { title: '制作檢查清單', level: 'D' },
              { title: '設定維持獎勵機制', level: 'D' }
            ]
          },
          {
            title: '習慣追蹤', level: 'C', children: [
              { title: '記錄每日5分鐘維持執行狀況', level: 'D' },
              { title: '追蹤各區域維持狀態', level: 'D' },
              { title: '調整維持策略', level: 'D' }
            ]
          }
        ]
      },
      {
        title: '專案完成與檢討', level: 'B', children: [
          {
            title: '成果整理', level: 'C', children: [
              { title: '整理所有整理前後對比照', level: 'D' },
              { title: '計算出售物品收益', level: 'D' },
              { title: '統計捐贈物品數量', level: 'D' }
            ]
          },
          {
            title: '經驗總結', level: 'C', children: [
              { title: '記錄最有效的整理技巧', level: 'D' },
              { title: '分析維持機制執行狀況', level: 'D' },
              { title: '規劃下一輪整理目標', level: 'D' }
            ]
          },
          {
            title: '慶祝與獎勵', level: 'C', children: [
              { title: '享受設定的完成大獎勵', level: 'D' },
              { title: '分享整理成果（如果願意的話）', level: 'D' },
              { title: '為下一個整理計畫做準備', level: 'D' }
            ]
          }
        ]
      }
    ]
  }
];

const loadTemplates = () => {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // 強制重新載入內建模板，確保使用最新版本
  console.log('使用內建模板，模板數量:', BUILTIN_TEMPLATES.length);
  console.log('第一個模板:', BUILTIN_TEMPLATES[0]);
  return BUILTIN_TEMPLATES;
};

const saveTemplates = (templates) => {
  try { localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates)); } catch {}
};

const ProjectList = () => {

  const [activeNotifications, setActiveNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState(() => {
    const saved = localStorage.getItem('projectNotificationHistory');
    return saved ? JSON.parse(saved) : {};
  });

  // 模板狀態
  const [templates, setTemplates] = useState(loadTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // 編輯狀態
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // 布局編輯狀態
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);

  // 文字膠囊狀態 - 改為每個任務獨立的狀態
  const [taskCapsuleStates, setTaskCapsuleStates] = useState(() => {
    try {
      const saved = localStorage.getItem('taskCapsuleStates');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Error loading capsule states:', error);
      return {};
    }
  });
  const [editingCapsuleTitle, setEditingCapsuleTitle] = useState(null);
  const [capsuleTitleText, setCapsuleTitleText] = useState('');
  const [editingCapsuleId, setEditingCapsuleId] = useState(null);
  const [editingCapsuleText, setEditingCapsuleText] = useState('');
  
  // 模板任務編輯狀態
  const [editingTemplateTaskId, setEditingTemplateTaskId] = useState(null);
  // 任務拖曳狀態
  const [draggedTaskInfo, setDraggedTaskInfo] = useState(null);

  // 任務關聯高亮狀態
  const [highlightedTasks, setHighlightedTasks] = useState(new Set());
  const [highlightedOriginalTask, setHighlightedOriginalTask] = useState(null);
  
  // 任務概覽面板狀態
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'overview', 'tags', 'gantt', 'calendar'
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all'); // 屬性篩選
  const [sortBy, setSortBy] = useState('default');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [repeatLogExpanded, setRepeatLogExpanded] = useState(true);
  const [repeatLogActiveTab, setRepeatLogActiveTab] = useState('log');
  
  // 屬性篩選下拉選單開啟狀態
  const [tagFilterDropdownOpen, setTagFilterDropdownOpen] = useState(false);
  
  // 任務標籤狀態
  const [taskTags, setTaskTags] = useState(() => {
    try {
      const saved = localStorage.getItem('taskTags');
      if (saved) {
        return JSON.parse(saved);
      }
      // 預設標籤
      return [
        { id: 'tag-1', name: '工作', color: 'rgb(156, 39, 176)' }, // 紫色
        { id: 'tag-2', name: '遊玩', color: 'rgb(255, 193, 7)' }, // 黃色
        { id: 'tag-3', name: '學習', color: 'rgb(33, 150, 243)' } // 藍色
      ];
    } catch (error) {
      console.error('Error loading task tags:', error);
      return [
        { id: 'tag-1', name: '工作', color: 'rgb(156, 39, 176)' },
        { id: 'tag-2', name: '遊玩', color: 'rgb(255, 193, 7)' },
        { id: 'tag-3', name: '學習', color: 'rgb(33, 150, 243)' }
      ];
    }
  });
  
  // 標籤編輯狀態
  const [editingTagId, setEditingTagId] = useState(null);
  const [newTagName, setNewTagName] = useState(''); // 用於新增屬性
  const [newTagColor, setNewTagColor] = useState('#9c27b0'); // 用於新增屬性
  const [editingTagName, setEditingTagName] = useState(''); // 用於編輯屬性
  const [editingTagColor, setEditingTagColor] = useState('rgb(156, 39, 176)'); // 用於編輯屬性（RGB格式）
  
  // 屬性下拉選單開啟狀態
  const [tagDropdownOpen, setTagDropdownOpen] = useState(null); // 存儲打開的下拉選單的任務ID或'detail'
  
  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tagDropdownOpen && !event.target.closest('.tag-dropdown-container')) {
        setTagDropdownOpen(null);
      }
      if (tagFilterDropdownOpen && !event.target.closest('.tag-filter-dropdown-container')) {
        setTagFilterDropdownOpen(false);
      }
    };
    
    if (tagDropdownOpen || tagFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [tagDropdownOpen, tagFilterDropdownOpen]);
  
  // 右鍵選單狀態
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    taskId: null,
    taskTitle: ''
  });
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetTask, setMoveTargetTask] = useState(null);
  const [moveSearchTerm, setMoveSearchTerm] = useState('');
  
  
  // 日曆視圖狀態
  const [calendarDate, setCalendarDate] = useState(new Date()); // 日曆視圖顯示的月份
  
  // 甘特圖狀態
  const [ganttZoom, setGanttZoom] = useState('month'); // 支援日視圖、週視圖和月視圖
  const [ganttTaskDisplayMode, setGanttTaskDisplayMode] = useState(() => {
    const saved = localStorage.getItem('ganttTaskDisplayMode');
    return saved || 'default'; // 'default', 'level', 'priority', 'custom'
  });
  // 日視圖 Hover 編輯狀態
  const hoverTimerRef = useRef(null);
  const [hoverPreview, setHoverPreview] = useState({ visible: false, task: null, x: 0, y: 0 });
  const ganttTimelineRef = useRef(null);
  const [dayViewDate, setDayViewDate] = useState(new Date()); // 日視圖顯示的日期

  // 甘特圖欄寬控制
  const [ganttColumnWidth, setGanttColumnWidth] = useState(() => {
    const saved = localStorage.getItem('ganttColumnWidth');
    return saved ? parseInt(saved) : 40; // 預設40px
  });
  
  // 懸停視窗狀態
  const [hoverTooltip, setHoverTooltip] = useState({ visible: false, task: null, x: 0, y: 0 });

  // 自動儲存膠囊狀態到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('taskCapsuleStates', JSON.stringify(taskCapsuleStates));
    } catch (error) {
      console.error('Error saving capsule states:', error);
    }
  }, [taskCapsuleStates]);

  // 自動儲存甘特圖顯示模式到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ganttTaskDisplayMode', ganttTaskDisplayMode);
    } catch (error) {
      console.error('Error saving gantt task display mode:', error);
    }
  }, [ganttTaskDisplayMode]);

  // 自動儲存任務標籤到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('taskTags', JSON.stringify(taskTags));
    } catch (error) {
      console.error('Error saving task tags:', error);
    }
  }, [taskTags]);
  
  // RGB 轉 Hex 的輔助函數
  const rgbToHex = (rgb) => {
    if (!rgb || !rgb.startsWith('rgb')) return '#9c27b0';
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return '#9c27b0';
    const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };
  
  // Hex 轉 RGB 的輔助函數
  const hexToRgb = (hex) => {
    if (!hex || !hex.startsWith('#')) return 'rgb(156, 39, 176)';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
  };
  
  // 標籤管理函數
  const handleAddTag = () => {
    if (!newTagName.trim()) {
      alert('請輸入屬性名稱');
      return;
    }
    const newTag = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      color: hexToRgb(newTagColor)
    };
    setTaskTags([...taskTags, newTag]);
    setNewTagName('');
    setNewTagColor('#9c27b0');
  };
  
  const handleEditTag = (tagId, newName, newColor) => {
    setTaskTags(taskTags.map(tag => 
      tag.id === tagId 
        ? { ...tag, name: newName, color: hexToRgb(newColor) }
        : tag
    ));
    setEditingTagId(null);
  };
  
  const handleDeleteTag = (tagId) => {
    if (window.confirm('確定要刪除此屬性嗎？使用此屬性的任務將變為無屬性。')) {
      // 清除所有使用此標籤的任務的標籤
      const updateTaskTag = (taskList) => {
        return taskList.map(task => {
          const updatedTask = { ...task };
          if (updatedTask.tagId === tagId) {
            updatedTask.tagId = null;
          }
          if (updatedTask.children && updatedTask.children.length > 0) {
            updatedTask.children = updateTaskTag(updatedTask.children);
          }
          return updatedTask;
        });
      };
      
      setTasks(updateTaskTag(tasks));
      setTaskTags(taskTags.filter(tag => tag.id !== tagId));
    }
  };
  
  // 根據標籤ID獲取標籤
  const getTagById = (tagId) => {
    return taskTags.find(tag => tag.id === tagId);
  };
  
  // 根據標籤ID獲取標籤顏色
  const getTagColor = (tagId) => {
    const tag = getTagById(tagId);
    return tag ? tag.color : null;
  };

  // 自動儲存甘特圖欄寬到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ganttColumnWidth', ganttColumnWidth.toString());
    } catch (error) {
      console.error('Error saving gantt column width:', error);
    }
  }, [ganttColumnWidth]);

  // 處理欄寬調整
  const handleColumnWidthChange = (newWidth) => {
    setGanttColumnWidth(Math.max(20, Math.min(160, newWidth))); // 限制在20-160px之間
  };

  // 處理懸停事件
  const handleTaskHover = (e, task) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 10;
    
    setHoverTooltip({
      visible: true,
      task: task,
      x: x,
      y: y
    });
  };

  const handleTaskHoverLeave = () => {
    setHoverTooltip({
      visible: false,
      task: null,
      x: 0,
      y: 0
    });
  };
  
  // 處理描述內容：按順序顯示，從最前面開始填充懸停視窗
  const getDescriptionContent = (htmlOrText) => {
    if (!htmlOrText) return null;
    
    // 直接返回原始HTML，讓瀏覽器按順序渲染
    // 通過CSS限制大小來控制顯示範圍
    return {
      type: 'sequential',
      html: htmlOrText
    };
  };
  const calculateTaskProgress = (task) => {
    if (!task.children || task.children.length === 0) {
      return task.status === 'completed' ? 100 : 0;
    }

    // 過濾掉佔位符，只計算真實任務的進度
    const realChildren = task.children.filter(child => !child.isPlaceholder && !child.isPlaceholderHeader);
    
    if (realChildren.length === 0) {
      return task.status === 'completed' ? 100 : 0;
    }

    const totalProgress = realChildren.reduce((sum, child) => {
      return sum + calculateTaskProgress(child);
    }, 0);

    return Math.round(totalProgress / realChildren.length);
  };

  // 處理任務數據的輔助函數
  const processTask = (task) => ({
    ...task,
    details: {
      ...task.details,
      reminders: task.details?.reminders ? JSON.parse(JSON.stringify(task.details.reminders)) : []
    },
    children: task.children ? task.children.map(child => processTask(child)) : []
  });

  // 重複功能：預設結構
  const DEFAULT_REPEAT = { enabled: false, interval: 1, unit: 'day', base: 'startDate', lastResetAt: null };

  const ensureRepeatDefaults = (task) => {
    if (!task) return task;
    const details = task.details || {};
    const nextDetails = {
      ...details,
      repeat: details.repeat ? {
        enabled: Boolean(details.repeat.enabled),
        interval: Number(details.repeat.interval || 1),
        unit: details.repeat.unit || 'day',
        base: details.repeat.base || 'startDate'
      } : { ...DEFAULT_REPEAT },
      repeatLog: details.repeatLog && typeof details.repeatLog === 'object' ? details.repeatLog : {}
    };

    const nextChildren = Array.isArray(task.children)
      ? task.children.map(ensureRepeatDefaults)
      : [];

    const normalizedStatus = task.status === 'completed' ? 'completed' : 'pending';
    const normalizedCompleted = normalizedStatus === 'completed';

    return {
      ...task,
      status: normalizedStatus,
      completed: normalizedCompleted,
      details: nextDetails,
      children: nextChildren
    };
  };

  const migrateTasksForRepeat = (taskList) => {
    if (!Array.isArray(taskList)) return taskList;
    return taskList.map(ensureRepeatDefaults);
  };

  // 工具：取得任務層級的最終截止日（自己優先，否則向上找父任務）
  const getInheritedDueDate = (taskId) => {
    // 建立即時索引以便向上追溯
    const idToParent = new Map();
    const idToTask = new Map();
    const buildIndex = (list, parent) => {
      if (!list || !Array.isArray(list)) return;
      list.forEach(t => {
        // 檢查任務是否存在
        if (!t || !t.id) return;
        idToTask.set(t.id, t);
        if (parent) idToParent.set(t.id, parent.id);
        if (t.children && Array.isArray(t.children) && t.children.length) buildIndex(t.children, t);
      });
    };
    buildIndex(tasks, null);

    let curId = taskId;
    while (curId) {
      const t = idToTask.get(curId);
      const due = t?.details?.dueDate;
      if (due) return due;
      curId = idToParent.get(curId);
    }
    return null;
  };

  // 工具：取得目前所屬重置視窗起點（以固定錨點 + interval 對齊）
  const getWindowStart = (task) => {
    const rep = task?.details?.repeat || DEFAULT_REPEAT;
    const unit = rep.unit || 'day';
    const interval = Math.max(1, Number(rep.interval || 1));
    const now = new Date();

    // 取得錨點：優先 startDate + startTime；否則使用 created；都沒有則使用今天 00:00
    const hasStartDate = Boolean(task?.details?.startDate);
    const hasStartTime = Boolean(task?.details?.startTime && /^\d{2}:\d{2}$/.test(task.details.startTime));
    let anchor;
    if (hasStartDate) {
      const [y, m, d] = task.details.startDate.split('-').map(n => Number(n));
      let hh = 0, mm = 0;
      if (hasStartTime) {
        const [h, mi] = task.details.startTime.split(':');
        hh = Number(h); mm = Number(mi);
      }
      anchor = new Date(y, (m - 1), d, hh, mm, 0, 0);
    } else if (task?.created) {
      const created = new Date(task.created);
      anchor = new Date(created.getFullYear(), created.getMonth(), created.getDate(), created.getHours(), created.getMinutes(), 0, 0);
    } else {
      anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }

    // 計算視窗起點：anchor + k * interval
    let intervalMs;
    if (unit === 'minute') {
      intervalMs = interval * 60 * 1000;
    } else {
      // day 單位：以天為間隔，時間部分以 anchor 的時分對齊
      intervalMs = interval * 24 * 60 * 60 * 1000;
    }
    const diff = now.getTime() - anchor.getTime();
    const k = Math.max(0, Math.floor(diff / intervalMs));
    return new Date(anchor.getTime() + k * intervalMs);
  };

  const getLocalDateKey = (d, unit = 'day') => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (unit === 'minute') {
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}-${hour}-${minute}`;
    }
    return `${year}-${month}-${day}`;
  };

  const addDays = (d, days) => {
    const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    nd.setDate(nd.getDate() + days);
    return nd;
  };

  const addMinutes = (d, minutes) => {
    const nd = new Date(d);
    nd.setMinutes(nd.getMinutes() + minutes);
    return nd;
  };

  // 更新當前窗口的日誌（任務完成時立即調用）
  const updateCurrentWindowLog = (task) => {
    const rep = task?.details?.repeat || DEFAULT_REPEAT;
    if (!rep || !rep.enabled) return task;

    const unit = rep.unit || 'day';
    const interval = Number(rep.interval || 1);
    const now = new Date();
    
    const currentKey = getLocalDateKey(now, unit);
    const nextRepeatLog = { ...(task.details?.repeatLog || {}) };
    
    // 更新或創建當前窗口的日誌
    const isCompleted = task.status === 'completed' || task.completed === true;
    const progressVal = typeof task.details?.progress === 'number' ? task.details.progress : (isCompleted ? 100 : 0);
    
    const existingLog = nextRepeatLog[currentKey];
    nextRepeatLog[currentKey] = {
      completed: isCompleted || (existingLog?.completed || false),
      completedAt: isCompleted ? (existingLog?.completedAt || new Date().toISOString()) : (existingLog?.completedAt || null),
      maxProgress: Math.max(existingLog?.maxProgress || 0, Math.max(0, Math.min(100, progressVal))),
      recordedAt: existingLog?.recordedAt || new Date().toISOString()
    };

    return {
      ...task,
      details: {
        ...task.details,
        repeatLog: nextRepeatLog
      }
    };
  };

  // 規則：是否達到重置條件（超過結束條件不重置）
  const shouldResetTask = (task, now = new Date()) => {
    const rep = task?.details?.repeat;
    if (!rep || !rep.enabled) return false;
    // 終止條件：自己的 dueDate > 父 dueDate > 無限期
    const endDateStr = task?.details?.dueDate || getInheritedDueDate(task.id);
    if (endDateStr) {
      const endDate = new Date(endDateStr + 'T23:59:59');
      if (now > endDate) return false;
    }

    const windowStart = getWindowStart(task);
    const lastResetAt = rep.lastResetAt ? new Date(rep.lastResetAt) : null;

    // 第一次啟用：若尚未紀錄 lastResetAt，初始化為當前視窗起點，不立即重置
    if (!lastResetAt) {
      return false;
    }

    // 視窗已前進（lastResetAt 早於本視窗起點）=> 需要重置
    return lastResetAt < windowStart;
  };
  // 執行重置與日誌補記：依規則處理自己與子孫
  const resetTaskTreeIfNeeded = (task, windowStartISO) => {
    // 檢查任務是否存在
    if (!task || !task.id) return null;
    
    const rep = task?.details?.repeat || DEFAULT_REPEAT;
    const needReset = shouldResetTask(task);

    const resetSelf = (t) => {
      const rep = t?.details?.repeat || DEFAULT_REPEAT;
      const unit = rep.unit || 'day';
      const interval = Number(rep.interval || 1);
      const windowStart = getWindowStart(t);
      
      let prevWindow;
      let prevWindowKey;
      
      if (unit === 'minute') {
        prevWindow = addMinutes(windowStart, -interval);
        prevWindowKey = getLocalDateKey(prevWindow, unit);
      } else {
        prevWindow = addDays(windowStart, -1);
        prevWindowKey = getLocalDateKey(prevWindow, unit);
      }

      const nextRepeatLog = { ...(t.details?.repeatLog || {}) };

      // backfill：從 lastResetAt 視窗到前一個窗口之間補記
      const lastResetAt = t.details?.repeat?.lastResetAt ? new Date(t.details.repeat.lastResetAt) : null;
      if (lastResetAt && unit === 'day') {
        // 天級別：最多補記 7 天
        const lastWindowStart = new Date(lastResetAt.getFullYear(), lastResetAt.getMonth(), lastResetAt.getDate());
        let cur = addDays(lastWindowStart, 1);
        let filled = 0;
        while (cur <= prevWindow && filled < 7) {
          const key = getLocalDateKey(cur, unit);
          if (!nextRepeatLog[key]) {
            nextRepeatLog[key] = {
              completed: false,
              completedAt: null,
              maxProgress: 0,
              recordedAt: new Date().toISOString()
            };
          }
          cur = addDays(cur, 1);
          filled += 1;
        }
      } else if (lastResetAt && unit === 'minute') {
        // 分鐘級別：最多補記最近 10 個窗口
        let cur = addMinutes(lastResetAt, interval);
        let filled = 0;
        while (cur <= prevWindow && filled < 10) {
          const key = getLocalDateKey(cur, unit);
          if (!nextRepeatLog[key]) {
            nextRepeatLog[key] = {
              completed: false,
              completedAt: null,
              maxProgress: 0,
              recordedAt: new Date().toISOString()
            };
          }
          cur = addMinutes(cur, interval);
          filled += 1;
        }
      }

      // 寫入前一個窗口日誌（若不存在）
      if (!nextRepeatLog[prevWindowKey]) {
        const isCompleted = t.status === 'completed' || t.completed === true;
        const progressVal = typeof t.details?.progress === 'number' ? t.details.progress : (isCompleted ? 100 : 0);
        nextRepeatLog[prevWindowKey] = {
          completed: isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : null,
          maxProgress: Math.max(0, Math.min(100, progressVal)),
          recordedAt: new Date().toISOString()
        };
      }
      
      // 重置狀態：將狀態改為 pending，completed 改為 false，進度歸零
      return {
        ...t,
        status: 'pending',
        completed: false,
        details: {
          ...t.details,
          progress: 0,
          repeatLog: nextRepeatLog,
          repeat: {
            ...(t.details?.repeat || {}),
            lastResetAt: windowStartISO
          }
        }
      };
    };

    let next = task;
    let parentWasReset = false; // 標記父任務是否已重置
    
    if (rep.enabled) {
      if (needReset) {
        next = resetSelf(next);
        parentWasReset = true; // 標記父任務已重置
      } else {
        // 若第一次初始化 lastResetAt
        if (!rep.lastResetAt) {
          next = {
            ...next,
            details: {
              ...next.details,
              repeat: { ...(next.details?.repeat || {}), lastResetAt: windowStartISO }
            }
          };
        }
      }
    }

    // 處理子任務
    if (next.children && Array.isArray(next.children) && next.children.length) {
      // 遞歸重置子任務的輔助函數（當父任務重置時，強制重置所有子任務）
      const resetChildrenTree = (childTask) => {
        // 檢查子任務是否存在
        if (!childTask) return null;
        
        // 重置子任務：狀態改為 pending，completed 改為 false，進度歸零
        const resetChild = {
          ...childTask,
          status: 'pending',
          completed: false,
          details: {
            ...childTask.details,
            progress: 0
          }
        };
        
        // 遞歸處理子任務的子任務
        if (childTask.children && Array.isArray(childTask.children) && childTask.children.length) {
          resetChild.children = childTask.children.map(resetChildrenTree).filter(c => c !== null);
        }
        
        return resetChild;
      };
      
      next = {
        ...next,
        children: next.children
          .filter(child => child !== null) // 過濾掉 null 子任務
          .map(child => {
            // 如果父任務已重置，強制重置所有子任務（不管子任務是否啟用重複）
            if (parentWasReset) {
              return resetChildrenTree(child);
            }
            // 正常遞歸處理（子任務有自己的重複規則時）
            return resetTaskTreeIfNeeded(child, windowStartISO);
          })
          .filter(child => child !== null) // 過濾掉處理後為 null 的任務
      };
    }
    return next;
  };

  const performResetCheck = (reason) => {
    try {
      const now = new Date();
      setTasks(prev => {
        const updated = prev
          .filter(t => t !== null) // 過濾掉 null 任務
          .map(t => {
            if (!t || !t.id) return null; // 跳過無效任務
            const wsISO = getWindowStart(t).toISOString();
            return resetTaskTreeIfNeeded(t, wsISO);
          })
          .filter(t => t !== null); // 過濾掉處理後為 null 的任務
        if (updated !== prev) {
          try { localStorage.setItem('projectTasks', JSON.stringify(updated)); } catch {}
        }
        return updated;
      });
    } catch (e) {
      console.warn('performResetCheck failed:', e);
    }
  };

  // 基本狀態 - 只保留這一個 tasks 定義
  const [tasks, setTasks] = useState(() => {
    try {
      const savedTasks = localStorage.getItem('projectTasks');
      console.log('嘗試載入保存的任務:', savedTasks);
      
      if (savedTasks) {
        const parsed = JSON.parse(savedTasks);
        // 檢查是否有有效的根任務
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id === 'root') {
          console.log('成功載入已保存的任務');
          // 遷移：補齊 repeat 與 repeatLog 預設
          const migrated = migrateTasksForRepeat(parsed);
          try {
            localStorage.setItem('projectTasks', JSON.stringify(migrated));
          } catch (e) {
            console.warn('無法在遷移後立即保存任務:', e);
          }
          return migrated;
        }
      }
    } catch (error) {
      console.error('載入任務時發生錯誤:', error);
    }

    // 默認的根任務
    const defaultTasks = [{
      id: 'root',
      title: 'Root',
      icon: null,
      description: '',
      level: 'NONE',
      children: [],
      created: new Date().toISOString(),
      status: 'pending',
      isHidden: true,
      details: {
        startDate: null,
        dueDate: null,
        reminders: [],
        reminderDays: null,
        location: null,
        notes: '',
        links: [],
        cheerUpItems: [],
        cheerUpProgress: 0,
        progress: 0,
        repeat: { ...DEFAULT_REPEAT },
        repeatLog: {}
      }
    }];
    
    console.log('創建新的默認任務結構');
    localStorage.setItem('projectTasks', JSON.stringify(defaultTasks));
    return defaultTasks;
  });
  
  // 啟動校正
  useEffect(() => {
    performResetCheck('startup');
  }, []);

  // 每分鐘輪詢
  useEffect(() => {
    const id = setInterval(() => performResetCheck('interval'), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // 進入詳情/甘特時即時校正
  useEffect(() => {
    if (activeTab === 'details' || activeTab === 'gantt') {
      performResetCheck('tab');
    }
  }, [activeTab]);
  // 日曆視圖任務資料
  // 日曆任務條資料（包含完整任務信息和日期範圍）
  const calendarTaskBars = useMemo(() => {
    const taskBars = [];
    
    // 處理所有任務，找出有日期的任務
    const processTasks = (taskList) => {
      if (!taskList || !Array.isArray(taskList)) return;
      
      taskList.forEach(task => {
        // 先檢查 task 是否存在
        if (!task) return;
        
        if (task.id && task.id !== 'root') {
          // 解析任務日期
          const parseLocalDate = (value) => {
            if (!value) return null;
            if (typeof value === 'string' && !value.includes('T')) {
              const d = new Date(value);
              return new Date(d.getFullYear(), d.getMonth(), d.getDate());
            }
            if (typeof value === 'string' && value.includes('T')) {
              const dateOnly = value.split('T')[0];
              const d = new Date(dateOnly);
              return new Date(d.getFullYear(), d.getMonth(), d.getDate());
            }
            return new Date(value);
          };
          
          let startDate = task.details?.startDate ? parseLocalDate(task.details.startDate) : null;
          let endDate = task.details?.dueDate ? parseLocalDate(task.details.dueDate) : null;
          
          // 標記是否為單日任務（只有開始日期或只有結束日期）
          const isSingleDay = (startDate && !endDate) || (!startDate && endDate);
          
          // 如果只有開始日期，結束日期設為開始日期（單日任務）
          if (startDate && !endDate) {
            endDate = new Date(startDate);
          } else if (!startDate && endDate) {
            // 如果只有結束日期，開始日期設為結束日期（單日任務）
            startDate = new Date(endDate);
          }
          
          // 如果有日期，添加到任務條列表
          if (startDate && endDate) {
            taskBars.push({
              id: task.id,
              title: task.title,
              startDate: startDate,
              endDate: endDate,
              priority: task.priority,
              status: task.status,
              level: task.level,
              levelType: task.levelType || task.level,
              taskType: task.taskType,
              tagId: task.tagId,
              isSingleDay: isSingleDay // 標記單日任務
            });
          }
        }
        
        // 遞歸處理子任務（確保 task 存在）
        if (task && task.children && Array.isArray(task.children) && task.children.length > 0) {
          processTasks(task.children);
        }
      });
    };
    
    processTasks(tasks);
    return taskBars;
  }, [tasks]);
  
  // 舊的 calendarTasks 保留用於向後兼容（如果需要）
  const calendarTasks = useMemo(() => {
    const result = {};
    
    calendarTaskBars.forEach(taskBar => {
      // 計算任務條覆蓋的所有日期
      const start = new Date(taskBar.startDate);
      const end = new Date(taskBar.endDate);
      
      // 遍歷從開始到結束的所有日期
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        if (!result[dateKey]) result[dateKey] = [];
        result[dateKey].push({
          id: taskBar.id,
          title: taskBar.title,
          priority: taskBar.priority,
          status: taskBar.status,
          level: taskBar.level,
          levelType: taskBar.levelType,
          taskType: taskBar.taskType,
          tagId: taskBar.tagId,
          startDate: taskBar.startDate,
          endDate: taskBar.endDate
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return result;
  }, [calendarTaskBars]);
  
  // 甘特圖資料處理
  const ganttTasks = useMemo(() => {
    const processTasks = (taskList, level = 0) => {
      const result = [];
      if (!taskList || !Array.isArray(taskList)) return result;
      
      taskList.forEach(task => {
        // 先檢查 task 是否存在
        if (!task) return;
        
        if (task.id && task.id !== 'root') {
          // 檢查任務是否有時間設定
          const hasStartDate = task.details?.startDate;
          const hasDueDate = task.details?.dueDate;
          
            if (hasStartDate || hasDueDate) {
              // 日視圖、週視圖和月視圖：只處理日期，不包含時間
            const processDate = (dateStr) => {
              if (!dateStr) return null;
              // 移除時間部分，只保留日期
              const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
              return new Date(dateOnly);
            };
            
            const startDate = processDate(task.details.startDate);
            const endDate = processDate(task.details.dueDate);
            
            result.push({
              ...task,
              level: level, // 用於縮排的數字層級
              levelType: task.level, // 保留原始的層級類型 (A, B, C, D等)
              startDate: startDate,
              endDate: endDate
            });
          }
        }
        
        // 遞歸處理子任務（確保 task 存在）
        if (task && task.children && Array.isArray(task.children) && task.children.length > 0) {
          result.push(...processTasks(task.children, level + 1));
        }
      });
      return result;
    };
    
    return processTasks(tasks);
  }, [tasks]);

  // 日視圖過濾任務
  const dayViewTasks = useMemo(() => {
    if (ganttZoom !== 'day') return ganttTasks;
    
    // 將日期規整到本地午夜，避免因時間造成的當日篩選錯誤
    const toLocalDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const currentDay = toLocalDay(dayViewDate);
    
    return ganttTasks.filter(task => {
      const rawStart = task.details?.startDate ? new Date(task.details.startDate) : null;
      const rawEnd = task.details?.dueDate ? new Date(task.details.dueDate) : null;
      
      if (!rawStart && !rawEnd) return false;
      
      const startDay = rawStart ? toLocalDay(rawStart) : null;
      const endDay = rawEnd ? toLocalDay(rawEnd) : null;
      
      if (startDay && endDay) {
        // 只按日期範圍（含頭含尾）判斷是否顯示
        return startDay <= currentDay && currentDay <= endDay;
      }
      if (startDay) {
        return startDay.getTime() === currentDay.getTime();
      }
      if (endDay) {
        return endDay.getTime() === currentDay.getTime();
      }
      return false;
    });
  }, [ganttTasks, ganttZoom, dayViewDate]);
  
  // 甘特圖時間軸基準
  const ganttTimelineBase = useMemo(() => {
    if (ganttTasks.length === 0) return null;
    
    // 收集所有任務的日期
    const allDates = [];
    ganttTasks.forEach(task => {
      if (task.details?.startDate) allDates.push(new Date(task.details.startDate));
      if (task.details?.dueDate) allDates.push(new Date(task.details.dueDate));
    });
    
    if (allDates.length === 0) return null;
    
    // 找到最早和最晚的日期
    const earliestDate = new Date(Math.min(...allDates));
    const latestDate = new Date(Math.max(...allDates));
    
    // 計算時間範圍
    const monthsDiff = (latestDate.getFullYear() - earliestDate.getFullYear()) * 12 + 
                      (latestDate.getMonth() - earliestDate.getMonth());
    
    let startDate, endDate;
    
    if (ganttZoom === 'day') {
      // 日視圖：顯示指定日期的一天
      startDate = new Date(dayViewDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dayViewDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (ganttZoom === 'week') {
      // 週視圖：從最晚任務日期往後延伸30天，並將起訖日規整到本地午夜，避免時區造成的前一天偏移
      startDate = new Date(
        earliestDate.getFullYear(),
        earliestDate.getMonth(),
        earliestDate.getDate()
      );
      endDate = new Date(
        latestDate.getFullYear(),
        latestDate.getMonth(),
        latestDate.getDate()
      );
      endDate.setDate(endDate.getDate() + 30);
    } else {
      // 月視圖：從最晚任務日期往後延伸12個月
      startDate = new Date(earliestDate);
      endDate = new Date(latestDate);
      endDate.setMonth(endDate.getMonth() + 12);
    }
    
    return { startDate, endDate };
  }, [ganttTasks, dayViewDate, ganttZoom]);
  
  // 渲染時間軸標題
  const renderTimelineHeader = () => {
    if (!ganttTimelineBase) return null;
    
    const { startDate, endDate } = ganttTimelineBase;
    
    if (ganttZoom === 'day') {
      // 日視圖：顯示24小時，每1小時一格
      const timeSlots = [];
      for (let hour = 0; hour < 24; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
      
      return (
        <div className="gantt-timeline-header-container day-view-header">
          {/* 任務名稱行 */}
          <div className="gantt-task-header-row">
            <div className="gantt-time-label-cell">時間</div>
            {dayViewTasks.map((task, index) => (
              <div 
                key={task.id} 
                className="gantt-task-header-cell" 
                style={{ width: `${ganttColumnWidth}px`, flex: `0 0 ${ganttColumnWidth}px` }}
                onMouseEnter={(e) => handleTaskHover(e, task)}
                onMouseLeave={handleTaskHoverLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  // 隱藏懸停視窗
                  handleTaskHoverLeave();
                  const foundTask = findTaskById(tasks, task.id);
                  if (foundTask) {
                    setSelectedTask(foundTask);
                    setActiveTab('details');
                  }
                }}
              >
                <span className="task-title-truncated">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (ganttZoom === 'week') {
      // 週視圖：顯示每一天，並添加年份標註
      const dates = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return (
        <div className="gantt-timeline-header-container">
          {/* 年份標註行 */}
          <div className="gantt-year-row">
            {dates.map((date, index) => {
              // 只在1月1日顯示年份
              if (date.getMonth() === 0 && date.getDate() === 1) {
                return (
                  <div key={`year-${index}`} className="gantt-year-cell" style={{ width: '41px', flex: '0 0 41px' }}>
                    {date.getFullYear()}
                  </div>
                );
              }
              return <div key={`year-${index}`} className="gantt-year-cell" style={{ width: '41px', flex: '0 0 41px' }}></div>;
            })}
          </div>
          {/* 星期幾行 */}
          <div className="gantt-weekday-row">
            {dates.map((date, index) => {
              const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
              const weekday = weekdays[date.getDay()];
              const isEvenYear = date.getFullYear() % 2 === 0;
              
              // 檢查是否為今天
              const today = new Date();
              const isToday = date.getDate() === today.getDate() && 
                             date.getMonth() === today.getMonth() && 
                             date.getFullYear() === today.getFullYear();
              
              return (
                <div 
                  key={`weekday-${index}`} 
                  className="gantt-weekday-cell" 
                  style={{ 
                    width: '41px', 
                    flex: '0 0 41px',
                    backgroundColor: isToday ? '#52D0FF' : (isEvenYear ? '#e9ecef' : '#d6d9dc'),
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: isToday ? 'white' : '#666'
                  }}
                >
                  {weekday}
                </div>
              );
            })}
          </div>
          {/* 日期行 */}
          <div className="gantt-date-row">
            {dates.map((date, index) => {
              // 按年份交替背景色
              const isEvenYear = date.getFullYear() % 2 === 0;
              
              // 檢查是否為今天
              const today = new Date();
              const isToday = date.getDate() === today.getDate() && 
                             date.getMonth() === today.getMonth() && 
                             date.getFullYear() === today.getFullYear();
              
              return (
                <div 
                  key={index} 
                  className="gantt-timeline-cell" 
                  style={{ 
                    width: '41px', 
                    flex: '0 0 41px',
                    backgroundColor: isToday ? '#52D0FF' : (isEvenYear ? '#e9ecef' : '#d6d9dc'),
                    color: isToday ? 'white' : 'inherit',
                    fontWeight: isToday ? 'bold' : 'normal'
                  }}
                >
                  {(date.getMonth() + 1) + '/' + date.getDate()}
                </div>
              );
            })}
          </div>
        </div>
      );
    } else {
      // 月視圖：顯示每個月，並添加年份標註
      const months = [];
      const currentDate = new Date(startDate);
      currentDate.setDate(1); // 設為月初
      
      while (currentDate <= endDate) {
        months.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      return (
        <div className="gantt-timeline-header-container">
          {/* 年份標註行 */}
          <div className="gantt-year-row">
            {months.map((date, index) => {
              // 只在1月顯示年份
              if (date.getMonth() === 0) {
                return (
                  <div key={`year-${index}`} className="gantt-year-cell" style={{ width: '41px', flex: '0 0 41px' }}>
                    {date.getFullYear()}
                  </div>
                );
              }
              return <div key={`year-${index}`} className="gantt-year-cell" style={{ width: '41px', flex: '0 0 41px' }}></div>;
            })}
          </div>
          {/* 月份行 */}
          <div className="gantt-date-row">
            {months.map((date, index) => {
              // 按年份交替背景色
              const isEvenYear = date.getFullYear() % 2 === 0;
              
              return (
                <div 
                  key={index} 
                  className="gantt-timeline-cell" 
                  style={{ 
                    width: '41px', 
                    flex: '0 0 41px',
                    backgroundColor: isEvenYear ? '#e9ecef' : '#d6d9dc'
                  }}
                >
                  {date.toLocaleDateString('zh-TW', { month: 'short' })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };
  
  // 計算任務在時間軸上的位置
  const getPosition = (date) => {
    if (!ganttTimelineBase || !date) return 0;
    
    const { startDate } = ganttTimelineBase;
    
    if (ganttZoom === 'day') {
      // 日視圖：按小時+分鐘計算（40px/每小時）
      const diffTime = date - startDate;
      const diffHours = diffTime / (1000 * 60 * 60);
      const position = diffHours * 40;
      return position;
    } else if (ganttZoom === 'week') {
      // 週視圖：按天計算（40px/每天）
      const diffTime = date - startDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const position = diffDays * 41; // 41px格子（包含邊框）
      return position;
    } else {
      // 月視圖：按月+日內比例計算（40px/每月）
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const targetYear = date.getFullYear();
      const targetMonth = date.getMonth();
      const monthsDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);

      // 目標月的月初
      const monthStart = new Date(targetYear, targetMonth, 1);
      // 下個月月初 - 當月天數
      const nextMonthStart = new Date(targetYear, targetMonth + 1, 1);
      const daysInMonth = Math.max(1, Math.round((nextMonthStart - monthStart) / (1000 * 60 * 60 * 24)));
      const dayOffset = Math.min(Math.max(0, Math.floor((date - monthStart) / (1000 * 60 * 60 * 24))), daysInMonth);
      const ratio = dayOffset / daysInMonth;
      const position = monthsDiff * 40 + ratio * 40;
      
      return position;
    }
  };
  
  // 根據任務條顏色計算邊框顏色（稍微深一點）
  const getBorderColor = (baseColor) => {
    // 如果是 hex 顏色，轉換為 RGB
    if (baseColor.startsWith('#')) {
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);
      // 稍微變深（減去約 10%）
      const darkerR = Math.max(0, Math.floor(r * 0.85));
      const darkerG = Math.max(0, Math.floor(g * 0.85));
      const darkerB = Math.max(0, Math.floor(b * 0.85));
      return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
    }
    // 如果是 rgb 顏色
    if (baseColor.startsWith('rgb')) {
      const match = baseColor.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]);
        const g = parseInt(match[1]);
        const b = parseInt(match[2]);
        // 稍微變深（減去約 15%）
        const darkerR = Math.max(0, Math.floor(r * 0.85));
        const darkerG = Math.max(0, Math.floor(g * 0.85));
        const darkerB = Math.max(0, Math.floor(b * 0.85));
        return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
      }
    }
    // 默認邊框顏色
    return '#4fc8f5';
  };
  
  // 根據顯示模式獲取任務條顏色
  const getTaskBarColor = (task) => {
    switch (ganttTaskDisplayMode) {
      case 'level':
        // 根據層級顯示顏色（與左側樹狀圖層級徽章顏色一致）
        // 注意：扁平化後的任務使用 levelType 保留原始層級類型（A, B, C, D等）
        // 而 level 是數字（用於縮排）
        const levelType = task.levelType || task.level; // 優先使用 levelType，如果沒有則使用 level
        const levelColors = {
          'A': '#ff4d4d', // 紅色
          'B': '#ffa64d', // 橙色
          'C': '#4da6ff', // 藍色
          'D': '#4dff4d', // 綠色
          'E': '#2C2C2C', // 非常深的灰色
          'F': '#404040', // 深灰色
          'G': '#545454', // 中深灰色
          'H': '#686868', // 中灰色
          'NONE': '#808080' // 灰色
        };
        return levelColors[levelType] || levelColors['NONE'] || '#787878'; // 其他層級使用淺灰色
      
      case 'priority':
        // 根據優先級顯示顏色
        if (task.priority === 'high') return '#f44336'; // 紅色
        if (task.priority === 'medium') return '#FF9800'; // 黃色
        if (task.priority === 'low') return '#4CAF50'; // 綠色
        return '#E0E0E0'; // 無優先級：灰色
      
      case 'custom':
        // 自定義顏色：使用任務標籤的顏色
        if (task.tagId) {
          const tagColor = getTagColor(task.tagId);
          if (tagColor) return tagColor;
        }
        return '#E0E0E0'; // 無標籤時顯示灰色
      
      case 'default':
      default:
        // 預設：根據狀態顯示顏色
        if (task.status === 'completed') return '#4CAF50'; // 綠色
        return '#E0E0E0'; // 灰色（未完成）
    }
  };
  // 渲染日視圖任務條
  const renderDayTaskBar = (task, timeSlotIndex) => {
    if (!ganttTimelineBase || ganttZoom !== 'day') return null;
    
    const startDate = task.details?.startDate ? new Date(task.details.startDate) : null;
    const dueDate = task.details?.dueDate ? new Date(task.details.dueDate) : null;
    
    if (!startDate && !dueDate) return null;
    
    // 不要僅以開始/結束日期是否等於當天來決定是否渲染
    // 跨日任務在開始日與結束日也需要顯示對應片段
    
    // 計算任務時間
    let taskStartTime, taskEndTime;
    
    if (startDate && dueDate) {
      // 跨日任務：檢查是否包含當前日期
      const taskStartDate = startDate.toDateString();
      const taskEndDate = dueDate.toDateString();
      const currentDateStr = dayViewDate.toDateString();
      
      if (taskStartDate === currentDateStr && taskEndDate === currentDateStr) {
        // 同一天任務
        taskStartTime = startDate.getHours() * 60 + startDate.getMinutes();
        taskEndTime = dueDate.getHours() * 60 + dueDate.getMinutes();
      } else if (taskStartDate === currentDateStr) {
        // 任務從今天開始
        taskStartTime = startDate.getHours() * 60 + startDate.getMinutes();
        // 檢查任務是否跨日，如果是跨日任務則顯示到當天結束，否則顯示到任務實際結束時間
        if (taskEndDate !== currentDateStr) {
          // 跨日任務，顯示到當天結束
          taskEndTime = 1440; // 當天結束（填滿到23:59）
        } else {
          // 同天任務，顯示到實際結束時間
          taskEndTime = dueDate.getHours() * 60 + dueDate.getMinutes();
        }
      } else if (taskEndDate === currentDateStr) {
        // 任務在今天結束
        taskStartTime = 0; // 當天開始
        taskEndTime = dueDate.getHours() * 60 + dueDate.getMinutes();
      } else {
        // 跨日任務，顯示全天
        taskStartTime = 0;
        taskEndTime = 1440;
      }
    } else if (startDate) {
      // 只有開始時間
      taskStartTime = startDate.getHours() * 60 + startDate.getMinutes();
      taskEndTime = 1440;
    } else {
      // 只有結束時間
      taskStartTime = 0;
      taskEndTime = dueDate.getHours() * 60 + dueDate.getMinutes();
    }
    
    // 單條渲染：僅在第0小時的格子內渲染整日的單一長條，
    // 以絕對定位向下延伸穿越所有小時（父層不裁切）
    if (timeSlotIndex !== 0) return null;

    const heightPerMinute = 30 / 60; // 固定行高30px，每分鐘0.5px
    const height = (taskEndTime - taskStartTime) * heightPerMinute;
    let topOffset = taskStartTime * heightPerMinute; // 從當日00:00起算

    // 每跨過一個小時的行邊框，視覺上要補 1px；
    // 並且在起點之前跨過了多少小時，也要在起點 top 加上對應的補償
    const BORDER_PX = 1;
    const bordersBeforeStart = Math.floor(taskStartTime / 60) * BORDER_PX;
    const bordersWithin = (Math.ceil(taskEndTime / 60) - Math.ceil(taskStartTime / 60)) * BORDER_PX;
    topOffset += bordersBeforeStart;

    // 移除 24:00 額外補 2px，改為精準到 24:00
    const finalHeight = height + bordersWithin;
    
    const taskBarColor = getTaskBarColor(task);
    const isOneTime = task.taskType === 'one-time';
    
    return (
      <div
        className="gantt-task-bar day-task-bar"
        style={{
          position: 'absolute',
          left: '0px',
          top: `${topOffset}px`, // 相對於開始時間槽的精確偏移
          width: `${ganttColumnWidth}px`,
          height: `${finalHeight}px`,
          backgroundColor: taskBarColor,
          border: isOneTime ? `2px solid ${getBorderColor(taskBarColor)}` : 'none',
          cursor: 'pointer',
          zIndex: 10,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => handleTaskHover(e, task)}
        onMouseLeave={handleTaskHoverLeave}
        onClick={(e) => {
          e.stopPropagation();
          // 隱藏懸停視窗
          handleTaskHoverLeave();
          const foundTask = findTaskById(tasks, task.id);
          if (foundTask) {
            // 確保任務有 levelType（如果沒有，使用 level）
            const taskWithLevelType = {
              ...foundTask,
              levelType: foundTask.levelType || foundTask.level
            };
            setSelectedTask(taskWithLevelType);
            setActiveTab('details');
          }
        }}
      >
        <span className="gantt-task-title task-title-vertical">
          {task.title.split('').map((char, index) => (
            <span key={index} className="vertical-char">{char}</span>
          ))}
        </span>
      </div>
    );
  };
  
  // 渲染任務進度條
  const renderTaskBar = (task) => {
    if (!ganttTimelineBase) return null;
    
    const { startDate: timelineStart, endDate: timelineEnd } = ganttTimelineBase;
    
    // 解析任務日期；若只有日期字串（無時間），使用本地午夜避免時區偏移
    const parseLocalDate = (value) => {
      if (!value) return null;
      if (typeof value === 'string' && !value.includes('T')) {
        const d = new Date(value);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      return new Date(value);
    };

    let startDate = task.details?.startDate ? parseLocalDate(task.details.startDate) : null;
    let endDate = task.details?.dueDate ? parseLocalDate(task.details.dueDate) : null;
    
    // 處理只有開始日期或只有結束日期的情況
    if (!startDate && endDate) {
      // 只有截止日期，從截止日期往回推到時間軸開始
      endDate = new Date(endDate);
      startDate = new Date(timelineStart);
    } else if (startDate && !endDate) {
      // 只有開始日期，從開始日期延伸到時間軸結束
      startDate = new Date(startDate);
      endDate = new Date(timelineEnd);
    } else if (startDate && endDate) {
      // 兩個日期都有，直接使用
      startDate = new Date(startDate);
      endDate = new Date(endDate);
    } else {
      // 兩個日期都沒有，不顯示
      return null;
    }
    
    // 週視圖：整格對齊規則
    if (ganttZoom === 'week') {
      // 將日期設為當天的開始（避免時區問題）
      const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      // 週視圖整格對齊：含頭含尾
      // 例：10/9 16:00 ~ 10/18 08:00 → 覆蓋10/9到10/18共10欄
      
      // 計算天數差（endDay - startDay）
      const diffTime = endDay - startDay;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // 含頭含尾：總是+1天
      const actualDays = diffDays + 1;
      
      // 計算位置和寬度
      const left = Math.max(0, getPosition(startDay)); // 確保不會是負數
      const width = Math.max(20, actualDays * 41); // 41px per day
      
      console.log(`週視圖任務 ${task.title} 位置計算:`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDay: startDay.toISOString(),
        endDay: endDay.toISOString(),
        diffDays,
        actualDays,
        left,
        width
      });
      
      const taskBarColor = getTaskBarColor(task);
      const isOneTime = task.taskType === 'one-time';
      
      return (
        <div 
          className="gantt-task-bar"
          style={{
            left: `${left}px`,
            width: `${width}px`,
            backgroundColor: taskBarColor,
            border: isOneTime ? `2px solid ${getBorderColor(taskBarColor)}` : 'none',
            color: taskBarColor === '#E0E0E0' ? '#333' : 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            borderTopLeftRadius: '4px',
            borderBottomLeftRadius: '4px',
            borderTopRightRadius: '4px',
            borderBottomRightRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            zIndex: 2
          }}
          onClick={() => {
            console.log('週視圖任務條被點擊:', task.title, task.id);
            handleTaskHoverLeave(); // 隱藏懸停視窗
            setSelectedTask(task);
            setActiveTab('details');
            console.log('selectedTask已設定:', task);
          }}
          onMouseEnter={(e) => handleTaskHover(e, task)}
          onMouseLeave={handleTaskHoverLeave}
        >
          <span className="gantt-task-title">{task.title}</span>
        </div>
      );
    }
    
    // 其他視圖：使用原有邏輯
    const left = getPosition(startDate);
    const right = getPosition(endDate);
    // 任務條寬度計算
    const width = Math.max(20, right - left);
    
    console.log(`任務 ${task.title} 位置計算:`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      left: left,
      right: right,
      width: width
    });
    
    const taskBarColor = getTaskBarColor(task);
    const isOneTime = task.taskType === 'one-time';
    
    return (
      <div 
        className="gantt-task-bar"
        style={{
          left: `${left}px`,
          width: `${width}px`,
          backgroundColor: taskBarColor,
          border: isOneTime ? `2px solid ${getBorderColor(taskBarColor)}` : 'none',
          cursor: 'pointer',
          zIndex: 10,
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => handleTaskHover(e, task)}
        onMouseLeave={handleTaskHoverLeave}
        onClick={(e) => {
          e.stopPropagation();
          // 隱藏懸停視窗
          handleTaskHoverLeave();
          // 點擊任務條跳轉到任務詳細頁
          console.log('點擊任務條:', task.id, task.title);
          const taskToSelect = findTaskById(tasks, task.id);
          console.log('找到任務:', taskToSelect);
          if (taskToSelect) {
            // 確保任務有 levelType（如果沒有，使用 level）
            const taskWithLevelType = {
              ...taskToSelect,
              levelType: taskToSelect.levelType || taskToSelect.level
            };
            setSelectedTask(taskWithLevelType);
            setActiveTab('details');
            console.log('已切換到任務詳情頁');
          } else {
            console.log('未找到對應的任務');
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          console.log('任務條 mousedown 事件觸發');
        }}
      >
        <span className="gantt-task-title">{task.title}</span>
      </div>
    );
  };
  
  // 甘特圖滾動處理
  const handleGanttWheel = useCallback((e) => {
    if (ganttTimelineRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const scrollAmount = e.deltaY > 0 ? 50 : -50;
      ganttTimelineRef.current.scrollLeft += scrollAmount;
    }
  }, []);
  
  // 使用原生事件監聽器
  useEffect(() => {
    const timelineElement = ganttTimelineRef.current;
    if (timelineElement) {
      const handleNativeWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // 計算滾動量，使用更大的滾動距離
        const scrollAmount = e.deltaY > 0 ? 100 : -100;
        timelineElement.scrollLeft += scrollAmount;
        
        console.log('甘特圖滾動:', {
          deltaY: e.deltaY,
          scrollAmount,
          scrollLeft: timelineElement.scrollLeft,
          scrollWidth: timelineElement.scrollWidth,
          clientWidth: timelineElement.clientWidth,
          maxScroll: timelineElement.scrollWidth - timelineElement.clientWidth
        });
      };
      
      timelineElement.addEventListener('wheel', handleNativeWheel, { passive: false });
      
      return () => {
        timelineElement.removeEventListener('wheel', handleNativeWheel);
      };
    }
  }, [ganttZoom, ganttTimelineBase, dayViewDate]); // 添加依賴項，確保在視圖切換時重新綁定
  
  // 渲染日曆視圖
  const renderCalendarView = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    // 獲取當月第一天和最後一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 獲取當月第一天是星期幾（0=星期日）
    const firstDayOfWeek = firstDay.getDay();
    
    // 獲取當月天數
    const daysInMonth = lastDay.getDate();
    
    // 生成日曆格子
    const calendarDays = [];
    
    // 添加上個月的空白天數
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarDays.push(null);
    }
    
    // 添加當月的天數
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      // 避免時區轉換，直接構造日期字串
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const tasksForDate = calendarTasks[dateKey] || [];
      
      calendarDays.push({
        date,
        day,
        dateKey,
        tasks: tasksForDate,
        isToday: date.toDateString() === new Date().toDateString()
      });
    }
    
    // 計算當月顯示的任務條（只顯示與當月有重疊的任務）
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    const visibleTaskBars = calendarTaskBars.filter(taskBar => {
      const taskStart = new Date(taskBar.startDate);
      const taskEnd = new Date(taskBar.endDate);
      taskEnd.setHours(23, 59, 59, 999);
      
      // 檢查任務是否與當月有重疊
      return taskStart <= monthEnd && taskEnd >= monthStart;
    });
    
    // 計算任務條在日曆中的位置和分層
    const taskBarPositions = visibleTaskBars.map(taskBar => {
      const taskStart = new Date(taskBar.startDate);
      const taskEnd = new Date(taskBar.endDate);
      
      // 計算任務條在當月的實際開始和結束日期
      const actualStart = taskStart < monthStart ? monthStart : taskStart;
      const actualEnd = taskEnd > monthEnd ? monthEnd : taskEnd;
      
      // 計算在日曆網格中的列位置（從0開始，不包括星期標題行）
      const startDay = actualStart.getDate();
      const endDay = actualEnd.getDate();
      
      // 計算起始列（考慮前面的空白列）
      const startCol = firstDayOfWeek + startDay - 1;
      // 計算結束列（含頭含尾，所以+1）
      const endCol = firstDayOfWeek + endDay;
      
      // 計算寬度（跨越的列數）
      const spanCols = endCol - startCol;
      
      // 計算任務條所在的行（從0開始，不包括星期標題行）
      const startRow = Math.floor(startCol / 7);
      const endRow = Math.floor((endCol - 1) / 7);
      
      return {
        ...taskBar,
        startCol,
        endCol,
        spanCols,
        startRow,
        endRow,
        actualStart,
        actualEnd,
        startDay,
        endDay
      };
    });
    
    // 按開始日期排序（早開始的在前面，會先分配層級，顯示在上面）
    const sortedTaskBars = [...taskBarPositions].sort((a, b) => {
      const dateA = new Date(a.actualStart);
      const dateB = new Date(b.actualStart);
      return dateA - dateB; // 升序：早開始的在前面
    });
    
    // 任務條分層算法（處理重疊）- 每行獨立計算分層
    const layeredTaskBars = [];
    // 記錄每行每列使用的層級：key 格式為 "row-col-layer"
    const usedLayers = new Map();
    
    sortedTaskBars.forEach(taskBar => {
      // 為任務條的每一行片段單獨計算層級
      const rowLayers = new Map(); // 記錄該任務條在每一行的層級
      
      // 遍歷任務條覆蓋的所有行
      for (let row = taskBar.startRow; row <= taskBar.endRow; row++) {
        // 計算該行內任務條覆蓋的列範圍
        const rowStartCol = row * 7;
        const rowEndCol = (row + 1) * 7;
        const segmentStartCol = Math.max(taskBar.startCol, rowStartCol);
        const segmentEndCol = Math.min(taskBar.endCol, rowEndCol);
        
        // 為該行片段尋找可用的層級
        let layer = 0;
        let foundLayer = false;
        
        while (!foundLayer) {
          let canUseLayer = true;
          
          // 檢查該行片段覆蓋的每一列是否在該層級已被占用
          for (let col = segmentStartCol; col < segmentEndCol; col++) {
            const layerKey = `${row}-${col}-${layer}`;
            if (usedLayers.has(layerKey)) {
              canUseLayer = false;
              break;
            }
          }
          
          if (canUseLayer) {
            // 標記該層級的所有列為已使用
            for (let col = segmentStartCol; col < segmentEndCol; col++) {
              usedLayers.set(`${row}-${col}-${layer}`, true);
            }
            rowLayers.set(row, layer);
            foundLayer = true;
          } else {
            layer++;
          }
        }
      }
      
      layeredTaskBars.push({
        ...taskBar,
        rowLayers // 存儲每行的層級映射
      });
    });
    
    const monthNames = [
      '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月'
    ];
    
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    
    // 計算每個日期格子的寬度（用於任務條定位）
    const cellWidth = 100 / 7; // 7列，每列約14.28%
    
    return (
      <div className="calendar-view">
        <div className="calendar-header">
          <button 
            onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
            className="calendar-nav-btn"
          >
            ←
          </button>
          <h3>{year}年 {monthNames[month]}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="gantt-display-mode-control">
              <label style={{ marginRight: '8px', fontSize: '12px', color: '#666' }}>任務條顯示:</label>
              <select
                value={ganttTaskDisplayMode}
                onChange={(e) => setGanttTaskDisplayMode(e.target.value)}
                className="gantt-display-mode-select"
                style={{
                  padding: '6px 12px',
                  border: '1px solid #E8EDF2',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                <option value="default">預設</option>
                <option value="level">層級</option>
                <option value="priority">優先級</option>
                <option value="custom">屬性</option>
              </select>
            </div>
          </div>
          <button 
            onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
            className="calendar-nav-btn"
          >
            →
          </button>
        </div>
        
        <div className="calendar-grid" style={{ position: 'relative' }}>
          {/* 星期標題 */}
          {weekDays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
          
          {/* 任務條（使用絕對定位） */}
          {layeredTaskBars.map((taskBar, taskIndex) => {
            const taskBarColor = getTaskBarColor(taskBar);
            const isOneTime = taskBar.taskType === 'one-time';
            const borderColor = getBorderColor(taskBarColor);
            
            // 計算任務條的位置和寬度
            // 星期標題行高度
            const weekdayRowHeight = 48;
            // 每個日期行的高度
            const dayRowHeight = 100;
            // 日期數字高度
            const dayNumberHeight = 24;
            
            // 計算任務條的 top 位置（基於第一行）
            // 星期標題行 + 任務條所在行之前的行數 * 每行高度 + 日期格子的 padding(8px) + 日期數字區域高度(28px) + 間距(2px) + 層級偏移
            const dayPadding = 8; // 日期格子的 padding
            const dateAreaHeight = 28; // 日期數字區域固定高度
            const spacing = 2; // 日期區域與任務條區域的間距（縮小間距）
            // 獲取該行的層級（單行任務條使用 startRow 的層級）
            const rowLayer = taskBar.rowLayers ? taskBar.rowLayers.get(taskBar.startRow) : 0;
            const topOffset = weekdayRowHeight + (taskBar.startRow * dayRowHeight) + dayPadding + dateAreaHeight + spacing + (rowLayer * 20);
            
            // 計算任務條的 left 位置和寬度
            // 由於網格是7列等寬，每列約14.28%
            // startCol 是絕對列位置（包括前面的空白列），需要轉換為行內相對位置
            const colInFirstRow = taskBar.startCol % 7;
            const leftPercent = (colInFirstRow / 7) * 100;
            
            // 計算寬度
            if (taskBar.isSingleDay) {
              // 單日任務：只顯示一個日期格子的寬度
              const widthPercent = (1 / 7) * 100;
              return (
                <div
                  key={`taskbar-${taskBar.id}-${taskIndex}`}
                  className="calendar-task-bar"
                  style={{
                    position: 'absolute',
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    top: `${topOffset}px`,
                    height: '18px',
                    backgroundColor: taskBarColor,
                    border: isOneTime ? `2px solid ${borderColor}` : 'none',
                    color: taskBarColor === '#E0E0E0' ? '#333' : 'white',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    zIndex: 10 + taskBar.layer,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const taskToSelect = findTaskById(tasks, taskBar.id);
                    if (taskToSelect) {
                      setSelectedTask(taskToSelect);
                      setActiveTab('details');
                    }
                  }}
                  title={taskBar.title}
                >
                  <span style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}>
                    {taskBar.title}
                  </span>
                </div>
              );
            }
            
            // 多日任務：計算實際跨度
            // 如果跨行，需要將任務條分割成多個部分，每行顯示一段
            if (taskBar.endRow > taskBar.startRow) {
              // 跨行任務：生成多個任務條片段
              const segments = [];
              
              for (let row = taskBar.startRow; row <= taskBar.endRow; row++) {
                // 計算該行的起始列和結束列
                const rowStartCol = row * 7;
                const rowEndCol = (row + 1) * 7;
                
                // 計算該片段在該行的起始列和結束列
                const segmentStartCol = Math.max(taskBar.startCol, rowStartCol);
                const segmentEndCol = Math.min(taskBar.endCol, rowEndCol);
                
                // 計算該片段在該行內的相對位置
                const colInRow = segmentStartCol % 7;
                const leftPercent = (colInRow / 7) * 100;
                const spanCols = segmentEndCol - segmentStartCol;
                const widthPercent = (spanCols / 7) * 100;
                
                // 計算該片段的 top 位置
                // 使用該行專屬的層級（從 rowLayers 中獲取）
                const dayPadding = 8; // 日期格子的 padding
                const dateAreaHeight = 28; // 日期數字區域固定高度
                const spacing = 2; // 日期區域與任務條區域的間距（縮小間距）
                const rowLayer = taskBar.rowLayers ? taskBar.rowLayers.get(row) : 0; // 獲取該行的層級
                const segmentTop = weekdayRowHeight + (row * dayRowHeight) + dayPadding + dateAreaHeight + spacing + (rowLayer * 20);
                
                segments.push({
                  leftPercent,
                  widthPercent,
                  top: segmentTop,
                  row,
                  layer: rowLayer, // 存儲該片段的層級
                  isFirstRow: row === taskBar.startRow,
                  isLastRow: row === taskBar.endRow
                });
              }
              
              // 渲染多個片段
              return (
                <>
                  {segments.map((segment, segIndex) => (
                    <div
                      key={`taskbar-${taskBar.id}-${taskIndex}-seg-${segIndex}`}
                      className="calendar-task-bar"
                      style={{
                        position: 'absolute',
                        left: `${segment.leftPercent}%`,
                        width: `${segment.widthPercent}%`,
                        top: `${segment.top}px`,
                        height: '18px',
                        backgroundColor: taskBarColor,
                        border: isOneTime ? `2px solid ${borderColor}` : 'none',
                        color: taskBarColor === '#E0E0E0' ? '#333' : 'white',
                        borderRadius: segIndex === 0 ? '3px 0 0 3px' : segIndex === segments.length - 1 ? '0 3px 3px 0' : '0',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 4px',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        zIndex: 10 + taskBar.layer,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const taskToSelect = findTaskById(tasks, taskBar.id);
                        if (taskToSelect) {
                          setSelectedTask(taskToSelect);
                          setActiveTab('details');
                        }
                      }}
                      title={taskBar.title}
                    >
                      {/* 只在第一段顯示任務名稱 */}
                      {segIndex === 0 && (
                        <span style={{ 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%'
                        }}>
                          {taskBar.title}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              );
            }
            
            // 單行任務：正常顯示
            const totalCols = taskBar.endCol - taskBar.startCol;
            const widthPercent = (totalCols / 7) * 100;
            
            return (
              <div
                key={`taskbar-${taskBar.id}-${taskIndex}`}
                className="calendar-task-bar"
                style={{
                  position: 'absolute',
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  top: `${topOffset}px`,
                  height: '18px',
                  backgroundColor: taskBarColor,
                  border: isOneTime ? `2px solid ${borderColor}` : 'none',
                  color: taskBarColor === '#E0E0E0' ? '#333' : 'white',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  zIndex: 10 + taskBar.layer,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const taskToSelect = findTaskById(tasks, taskBar.id);
                  if (taskToSelect) {
                    setSelectedTask(taskToSelect);
                    setActiveTab('details');
                  }
                }}
                title={taskBar.title}
              >
                <span style={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%'
                }}>
                  {taskBar.title}
                </span>
              </div>
            );
          })}
          
          {/* 日期格子 */}
          {calendarDays.map((dayData, index) => {
            if (!dayData) {
              return <div key={index} className="calendar-day empty"></div>;
            }
            
            const { date, day, tasks: dayTasks, isToday } = dayData;
            
            return (
              <div 
                key={index} 
                className={`calendar-day ${isToday ? 'today' : ''} ${dayTasks.length > 0 ? 'has-tasks' : ''}`}
                onClick={() => {
                  // 點擊日期切換到甘特圖的日視圖
                  setDayViewDate(new Date(date));
                  setGanttZoom('day');
                  setActiveTab('gantt');
                }}
              >
                <div className="calendar-day-number">{day}</div>
                {/* 任務條區域 - 獨立的 flex 區域，任務條會顯示在這裡 */}
                <div className="calendar-task-area"></div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const checkReminders = () => {
    const now = new Date();
  
    const createNotification = (task, type) => {
      const isExpired = type === 'expired';
      const notificationKey = `${type}-${task.id}`;
      
      // 如果已經發送過該通知，則跳過
      if (notificationHistory[notificationKey]) return;
  
      // 更新通知歷史
      setNotificationHistory(prev => ({
        ...prev,
        [notificationKey]: now.toISOString()
      }));
  
      // 創建通知
      const notification = {
        id: `${task.id}-${now.getTime()}`,
        message: `任務「${task.title}」${isExpired ? '已過期！' : '即將到期！'}`,
        timestamp: now,
        taskId: task.id,
        type
      };
  
      // 添加到活動通知列表（只保留一個同 taskId 的提醒）
      setActiveNotifications(prev => [
        ...prev.filter(n => n.taskId !== task.id),
        notification
      ]);
  
      // 發送系統通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(isExpired ? '任務已過期' : '任務提醒', {
          body: notification.message,
          icon: '/favicon.ico',
          silent: false,
          requireInteraction: true,
          vibrate: [200, 100, 200]
        });
      }
    };
  
    const checkTask = (task) => {
      if (!task.details?.dueDate || !task.details?.reminders?.length) return;
  
      const dueDate = new Date(task.details.dueDate);
      
      // 檢查是否過期
      if (dueDate < now) {
        createNotification(task, 'expired');
        return;
      }
  
      // 檢查提醒時間
      task.details.reminders.forEach(reminder => {
        const reminderTime = new Date(dueDate.getTime() -
          ((reminder.days * 24 + reminder.hours) * 60 + reminder.minutes) * 60 * 1000
        );
  
        if (reminderTime <= now && dueDate > now) {
          createNotification(task, 'reminder');
        }
      });
  
      // 遞歸檢查子任務
      task.children?.forEach(checkTask);
    };
  
    // 檢查所有任務
    tasks.forEach(checkTask);
  };

  // 處理任務屬性更新
  const handleTaskDetailUpdate = (taskId, field, value) => {
    // 1. 參數檢查
    if (!taskId) {
      console.error('任務ID不能為空');
      return;
    }

    // 2. 調試日誌
    console.log('嘗試更新任務細節:', {
      taskId,
      field,
      value,
      valueType: typeof value,
      valueContent: JSON.stringify(value)
    });

    console.log('更新前的任務狀態:', {
      taskId,
      field,
      value,
      allTasks: JSON.parse(JSON.stringify(tasks))
    });

    // 3. 更新任務
    setTasks(prevTasks => {
      try {
        const newTasks = prevTasks.map(task => {
          if (task.id === taskId) {
            // 根據欄位類型選擇不同的更新方式
            if (field === 'description' || field === 'drawingData') {
              return {
                ...task,
                [field]: value
              };
            }
            // 其他欄位更新到 details 中
            return {
              ...task,
              details: {
                ...task.details,
                [field]: value
              }
            };
          }
          if (task.children?.length > 0) {
            return {
              ...task,
              children: updateTaskDetails(task.children, taskId, field, value)
            };
          }
          return task;
        });
  
        // 同步 selectedTask
        syncSelectedTask(newTasks, taskId);
  
        return newTasks;
      } catch (error) {
        console.error('更新任務時發生錯誤:', error);
        return prevTasks;
      }
    });
  };

  useEffect(() => {
    console.log('=== 開始檢查提醒 ===');
    console.log('當前任務列表:', tasks);
  
    const checkTaskReminders = (task) => {
      if (!task || !task.id) {
        return; // 跳過無效的任務
      }
      
      console.log('檢查任務:', {
        taskId: task.id,
        title: task.title,
        dueDate: task.details?.dueDate,
        reminders: task.details?.reminders
      });
  
      if (task.details?.dueDate && task.details?.reminders?.length > 0) {
        const dueDate = new Date(task.details.dueDate);
        const now = new Date();
  
        // 檢查是否已過期
        if (dueDate < now) {
          const notificationKey = `expired-${task.id}`;
          const lastNotified = notificationHistory[notificationKey];
  
          if (!lastNotified) {
            setNotificationHistory(prev => ({
              ...prev,
              [notificationKey]: now.toISOString()
            }));
  
            const newNotification = {
              id: `expired-${task.id}-${now.getTime()}`,
              message: `任務「${task.title}」已過期！`,
              timestamp: now,
              taskId: task.id
            };
  
            setActiveNotifications(prev => [...prev, newNotification]);
  
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('任務已過期', {
                body: `任務「${task.title}」已過期！`,
                icon: '/favicon.ico',
                silent: false,
                requireInteraction: true,
                vibrate: [200, 100, 200]
              });
            }
            return;
          }
        }
  
        task.details.reminders.forEach(reminder => {
          const reminderTime = new Date(dueDate.getTime() -
            (reminder.days * 24 * 60 * 60 * 1000) -
            (reminder.hours * 60 * 60 * 1000) -
            (reminder.minutes * 60 * 1000)
          );
  
          if (reminderTime <= now && dueDate > now) {
            const notificationKey = `${task.id}-${reminderTime.getTime()}`;
            const lastNotified = notificationHistory[notificationKey];
  
            if (!lastNotified) {
              setNotificationHistory(prev => ({
                ...prev,
                [notificationKey]: now.toISOString()
              }));
  
              const newNotification = {
                id: `${task.id}-${now.getTime()}`,
                message: `任務「${task.title}」即將到期！`,
                timestamp: now,
                taskId: task.id
              };
  
              setActiveNotifications(prev => [...prev, newNotification]);
  
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('任務提醒', {
                  body: `任務「${task.title}」即將到期！`,
                  icon: '/favicon.ico',
                  silent: false,
                  requireInteraction: true,
                  vibrate: [200, 100, 200]
                });
              }
            }
          }
        });
      }
  
      // 檢查子任務
      if (task.children && Array.isArray(task.children) && task.children.length > 0) {
        task.children.forEach(childTask => checkTaskReminders(childTask));
      }
    };
  
    const checkReminders = () => {
      if (tasks && Array.isArray(tasks)) {
      tasks.forEach(task => checkTaskReminders(task));
      }
    };
  
    // 檢查通知權限
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        console.log('Notification 權限:', permission);
      });
    }
  
    const intervalId = setInterval(checkReminders, 60000);
    checkReminders(); // 立即執行一次
  
    return () => clearInterval(intervalId);
  }, [tasks]);
  
  
  // 添加這個新的 useEffect 來保存通知歷史
  useEffect(() => {
    localStorage.setItem('projectNotificationHistory', JSON.stringify(notificationHistory));
  }, [notificationHistory]);

  // 👇 添加這個新的 useEffect 來保存任務數據
  useEffect(() => {
    try {
      // 檢查任務結構是否完整
      const isValidTask = (task) => {
        return task && 
               typeof task.id === 'string' && 
               typeof task.title === 'string' &&
               Array.isArray(task.children);
      };
  
      // 只有當任務結構有效時才保存
      if (tasks && Array.isArray(tasks) && tasks.length > 0 && isValidTask(tasks[0])) {
        console.log('保存有效的任務數據:', tasks);
        localStorage.setItem('projectTasks', JSON.stringify(tasks));
      } else {
        console.error('嘗試保存無效的任務數據:', tasks);
      }
    } catch (error) {
      console.error('保存任務時發生錯誤:', error);
    }
  }, [tasks]);


  
 
  // UI相關狀態
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCapsuleDeleteDialog, setShowCapsuleDeleteDialog] = useState(false);
  const [deletingCapsuleId, setDeletingCapsuleId] = useState(null);

  // 統一的 selectedTask 同步函數（需要在所有使用它的函數之前定義）
  const syncSelectedTask = useCallback((updatedTasks, currentSelectedTaskId = null) => {
    // 優先使用傳入的 taskId，如果沒有則使用當前 selectedTask?.id
    const taskId = currentSelectedTaskId || selectedTask?.id;
    if (taskId) {
      const latestTask = findTaskById(updatedTasks, taskId);
      if (latestTask) {
        setSelectedTask(latestTask);
      } else {
        // 如果找不到任務，可能是任務被刪除或ID無效，保持當前選擇不變
        console.warn('syncSelectedTask: 找不到任務，taskId:', taskId);
      }
    }
  }, [selectedTask?.id]); // 添加 selectedTask?.id 作為依賴，但使用可選鏈避免不必要的重新創建

  useEffect(() => {
    setRepeatLogExpanded(true);
    setRepeatLogActiveTab('log');
  }, [selectedTask?.id]);
  // 與首頁彈窗一致的日期/時間/提醒選擇狀態
  const dateInputRef = useRef(null);
  const startDateInputRef = useRef(null);
  const startTimeInputRef = useRef(null);
  const timeInputRef = useRef(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isStartTimePicker, setIsStartTimePicker] = useState(false); // 區分開始時間和結束時間選擇器
  const [tpPeriod, setTpPeriod] = useState('PM');
  const [tpHour, setTpHour] = useState(5);
  const [tpMinute, setTpMinute] = useState(0);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [rpIndex, setRpIndex] = useState(-1);
  const [rpDays, setRpDays] = useState(0);
  const [rpHours, setRpHours] = useState(0);
  const [rpMinutes, setRpMinutes] = useState(0);
  const [rpDaysCustom, setRpDaysCustom] = useState('');

  const formatDateForInput = (dateLike) => {
    if (!dateLike) return '';
    try {
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      return '';
    }
  };

  const formatDateTimeForDisplay = (value, fallback = '未紀錄') => {
    if (!value) return fallback;
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return fallback;
      return d.toLocaleString();
    } catch {
      return fallback;
    }
  };

  const getCombinedISO = (dateStr, timeStr) => {
    if (!dateStr) return null;
    if (!timeStr || timeStr === '00:00') {
      // 沒有時間設定，返回純日期字串
      return dateStr;
    }
    const [hh='00', mm='00'] = timeStr.split(':');
    return `${dateStr}T${hh}:${mm}:00`;
  };

  const repeatLogTabButtonStyle = (isActive) => ({
    padding: '4px 12px',
    borderRadius: '12px',
    border: `1px solid ${isActive ? '#52D0FF' : '#E8EDF2'}`,
    background: isActive ? '#E6F8FF' : '#FFFFFF',
    color: isActive ? '#1679A2' : '#666666',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  });

  const handleDueDateChange = (newDateStr) => {
    if (!selectedTask) return;
    const combined = getCombinedISO(newDateStr, selectedTask.details?.dueTime);
    handleTaskDetailUpdate(selectedTask.id, 'dueDate', combined);
  };

  const openTimePicker = () => {
    if (!selectedTask) return;
    let h24 = 0, m = 0;
    const timeStr = selectedTask.details?.dueTime;
    if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
      const [hh, mm] = timeStr.split(':').map(v=>parseInt(v,10));
      h24 = hh; m = mm - (mm % 5);
    } else if (selectedTask.details?.dueDate) {
      const d = new Date(selectedTask.details.dueDate);
      if (!Number.isNaN(d.getTime())) { h24 = d.getHours(); m = d.getMinutes() - (d.getMinutes()%5); }
    }
    setIsStartTimePicker(false); // 標記為結束時間選擇器
    setTpHour(h24); setTpMinute(m); setShowTimePicker(true);
  };

  const openStartTimePicker = () => {
    if (!selectedTask) return;
    let h24 = 0, m = 0;
    const timeStr = selectedTask.details?.startTime;
    if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
      const [hh, mm] = timeStr.split(':').map(v=>parseInt(v,10));
      h24 = hh; m = mm - (mm % 5);
    } else if (selectedTask.details?.startDate) {
      const d = new Date(selectedTask.details.startDate);
      if (!Number.isNaN(d.getTime())) { h24 = d.getHours(); m = d.getMinutes() - (d.getMinutes()%5); }
    }
    setIsStartTimePicker(true); // 標記為開始時間選擇器
    setTpHour(h24); setTpMinute(m); setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    if (!selectedTask) { setShowTimePicker(false); return; }
    const hh = String(tpHour).padStart(2,'0');
    const mm = String(tpMinute).padStart(2,'0');
    const timeStr = `${hh}:${mm}`;
    
    if (isStartTimePicker) {
      // 更新開始時間字串
      handleTaskDetailUpdate(selectedTask.id, 'startTime', timeStr);
      
      // 同時更新 startDate，確保包含時間資訊
      if (selectedTask.details?.startDate) {
        const baseDate = selectedTask.details.startDate.includes('T') 
          ? selectedTask.details.startDate.split('T')[0] 
          : selectedTask.details.startDate;
        const combinedStartDate = getCombinedISO(baseDate, timeStr);
        handleTaskDetailUpdate(selectedTask.id, 'startDate', combinedStartDate);
      }
    } else {
      // 更新結束時間字串
      handleTaskDetailUpdate(selectedTask.id, 'dueTime', timeStr);
      
      // 同時更新 dueDate，確保包含時間資訊
      if (selectedTask.details?.dueDate) {
        const baseDate = selectedTask.details.dueDate.includes('T') 
          ? selectedTask.details.dueDate.split('T')[0] 
          : selectedTask.details.dueDate;
        const combinedDueDate = getCombinedISO(baseDate, timeStr);
        handleTaskDetailUpdate(selectedTask.id, 'dueDate', combinedDueDate);
      }
    }
    
    setShowTimePicker(false);
  };

  const openReminderPicker = (reminder, index) => {
    setRpIndex(index);
    setRpDays(reminder?.days || 0);
    setRpHours(reminder?.hours || 0);
    setRpMinutes(reminder?.minutes || 0);
    setRpDaysCustom('');
    setShowReminderPicker(true);
  };

  const confirmReminderPicker = () => {
    if (!selectedTask || rpIndex < 0) { setShowReminderPicker(false); return; }
    const list = [...(selectedTask.details?.reminders || [])];
    list[rpIndex] = { days: rpDays, hours: rpHours, minutes: rpMinutes };
    handleTaskDetailUpdate(selectedTask.id, 'reminders', list);
    setShowReminderPicker(false);
  };
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    level: 'NONE'
  });

  // 使用 useMemo 優化更新函數
  const debouncedUpdate = useMemo(
    () => 
      debounce((taskId, content) => {
        handleTaskDetailUpdate(taskId, 'description', content);
      }, 300),
    [] // 移除依賴
  );
  // 使用 useCallback 優化 onChange 處理
  const handleEditorChange = useCallback((content) => {
    if (selectedTask?.id) {
      // 更新 tasks 中的描述
      setTasks(prevTasks => {
        const updateDescription = (items) => {
          return items.map(item => {
            if (item.id === selectedTask.id) {
              return {
                ...item,
                description: content
              };
            }
            if (item.children?.length > 0) {
              return {
                ...item,
                children: updateDescription(item.children)
              };
            }
            return item;
          });
        };
        const updatedTasks = updateDescription(prevTasks);
        
        // 同步 selectedTask
        syncSelectedTask(updatedTasks, selectedTask?.id);
  
      // 立即保存到 localStorage
        try {
        try {
          localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
        } catch (error) {
          console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
        }
        
        return updatedTasks;
      });
    }
  }, [selectedTask?.id, syncSelectedTask]);

  // 程式啟動時初始化展開根節點
  useEffect(() => {
    setExpandedItems(new Set(['root']));
  }, []);

  // 等級對應表，用於確定等級順序及轉換
  // 使用動態生成的方式處理擴展等級
  const generateLevelMap = () => {
    const map = { 'NONE': { next: 'A', prev: null } };
    const levels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
   
    levels.forEach((level, index) => {
      const prevLevel = index > 0 ? levels[index - 1] : null;
      const nextLevel = index < levels.length - 1 ? levels[index + 1] : null;
      map[level] = { next: nextLevel, prev: prevLevel };
    });
   
    return map;
  };
 
  const LEVEL_MAP = generateLevelMap();

  // 處理展開/收起
  const toggleExpand = (id) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 根據父任務的等級確定子任務的等級
  const getChildLevel = (parentLevel) => {
    if (parentLevel === 'NONE') return 'A';
    return LEVEL_MAP[parentLevel]?.next || 'NONE';
  };

  // 從模板生成任務樹
  const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const buildTreeFromTemplate = (nodes, parentLevel) => {
    if (!nodes || nodes.length === 0) return [];
    return nodes.map((n) => ({
      id: generateId(),
      title: n.title,
      description: '',
      level: n.level || getChildLevel(parentLevel || 'NONE'),
      priority: 'low', // 預設優先級為低
      status: 'pending',
      taskType: 'recurring', // 預設為持續型
      details: { startDate: null, startTime: '', dueDate: null, dueTime: '', reminders: [] },
      hasCapsules: n.hasCapsules || false, // 傳遞膠囊功能標記
      children: buildTreeFromTemplate(n.children || [], n.level || getChildLevel(parentLevel || 'NONE'))
    }));
  };

  const applyTemplate = () => {
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    const newA = {
      id: generateId(),
      title: tpl.rootTitle,
      description: tpl.description || '',
      level: 'A',
      status: 'pending',
      details: { startDate: null, startTime: '', dueDate: null, dueTime: '', reminders: [] },
      children: buildTreeFromTemplate(tpl.tree || [], 'A')
    };
    setTasks(prev => {
      const updated = prev.map(root => {
        if (root.id === 'root') {
          return { ...root, children: [...root.children, newA] };
        }
        return root;
      });
      syncSelectedTask(updated);
      return updated;
    });
  };

  const saveCurrentAsTemplate = () => {
    if (!selectedTask) {
      alert('請先選擇一個任務作為範本來源');
      return;
    }
    const name = window.prompt('請輸入模板名稱', selectedTask.title || '自訂模板');
    if (!name) return;

    const cloneNode = (node) => ({
      title: node.title,
      level: node.level,
      children: (node.children || []).map(cloneNode)
    });
    const newTpl = {
      id: generateId(),
      name,
      rootTitle: selectedTask.title || name,
      description: selectedTask.description || '',
      tree: (selectedTask.children || []).map(cloneNode)
    };
    const next = [...templates, newTpl];
    setTemplates(next);
    saveTemplates(next);
    setSelectedTemplateId(newTpl.id);
  };

  // 編輯任務標題相關函數
  const startEditTask = (taskId, currentTitle) => {
    console.log('開始編輯任務:', taskId, currentTitle);
    console.log('當前編輯狀態:', editingTaskId, editingText);
    setEditingTaskId(taskId);
    setEditingText(currentTitle);
    console.log('設置編輯狀態後:', taskId, currentTitle);
  };

  const saveEditTask = () => {
    if (!editingTaskId || !editingText.trim()) {
      setEditingTaskId(null);
      setEditingText('');
      return;
    }

    const updateTaskInTree = (tasks) => {
      return tasks.map(task => {
        if (task.id === editingTaskId) {
          return { ...task, title: editingText.trim() };
        }
        if (task.children) {
          return { ...task, children: updateTaskInTree(task.children) };
        }
        return task;
      });
    };

    const updatedTasks = updateTaskInTree(tasks);
    setTasks(updatedTasks);
    
    // 同步 selectedTask
    syncSelectedTask(updatedTasks);

    try {
    localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
    setEditingTaskId(null);
    setEditingText('');
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingText('');
  };

  const handleEditKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveEditTask();
    } else if (e.key === 'Escape') {
      cancelEditTask();
    }
  };

  // 獲取當前任務的膠囊狀態
  const getCurrentTaskCapsuleState = () => {
    if (!selectedTask) return null;
    return taskCapsuleStates[selectedTask.id] || {
      showCapsules: false,
      capsules: [],
      targetParentId: selectedTask.id,
      title: '文字膠囊動態任務生成器',
      placeholderEnabled: false,
      placeholderTaskId: null,
      originalTaskTitle: '',
      capsuleTaskMappings: {}, // 膠囊ID -> 任務群ID的映射
      allGeneratedTaskIds: [],  // 所有生成的任務ID（用於高亮）
      // 新的膠囊任務模板設計格式
      capsuleTaskTemplate: {
        tasks: [] // 任務陣列，每個任務格式：{ id, nameParts: [{type: 'text'|'capsule', content?: string}], level, children: [...] }
      },
      templateDesignerOpen: false // 模板設計器預設關閉
    };
  };

  // 更新當前任務的膠囊狀態
  const updateTaskCapsuleState = (updates) => {
    if (!selectedTask) return;
    const newState = {
      ...getCurrentTaskCapsuleState(),
      ...updates
    };
    setTaskCapsuleStates(prev => {
      const updatedStates = {
        ...prev,
        [selectedTask.id]: newState
      };
      // 同步到 localStorage
      try {
        localStorage.setItem('taskCapsuleStates', JSON.stringify(updatedStates));
      } catch (error) {
        console.warn('localStorage 配額已滿，無法儲存模板狀態:', error);
      }
      return updatedStates;
    });
  };

  // ========== 膠囊任務模板設計相關函數 ==========
  
  // 生成任務 ID
  const generateTemplateTaskId = () => {
    return `template_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 將文字轉換為 nameParts 格式
  const textToNameParts = (text) => {
    if (!text) return [{ type: 'text', content: '' }];
    const parts = [];
    const capsuleRegex = /（膠囊）/g;
    let lastIndex = 0;
    let match;
    
    while ((match = capsuleRegex.exec(text)) !== null) {
      // 添加膠囊前的文字
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      // 添加膠囊
      parts.push({ type: 'capsule' });
      lastIndex = match.index + match[0].length;
    }
    // 添加剩餘文字
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }
    // 如果沒有匹配到膠囊，整個文字作為一個文字部分
    if (parts.length === 0) {
      parts.push({ type: 'text', content: text });
    }
    return parts;
  };

  // 將 nameParts 轉換為顯示文字
  const namePartsToText = (nameParts) => {
    if (!nameParts || nameParts.length === 0) return '';
    return nameParts.map(part => {
      if (part.type === 'capsule') return '膠囊';
      return part.content || '';
    }).join('');
  };

  // 計算任務層級（根據父任務層級+1）
  const calculateTaskLevel = (parentLevel) => {
    if (!parentLevel || parentLevel === 'NONE') return 'A';
    if (parentLevel === 'A') return 'B';
    if (parentLevel === 'B') return 'C';
    if (parentLevel === 'C') return 'D';
    if (parentLevel === 'D') return 'E';
    return 'E'; // 預設最深到 E
  };

  // 從預設模板載入到設計器
  const loadTemplateIntoDesigner = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // 將模板的 tree 結構轉換為新的格式
    // 忽略模板中的 level，根據任務在樹中的深度重新計算層級
    const convertTemplateTree = (treeNodes, parentLevel = null) => {
      return treeNodes.map(node => {
        // 忽略模板中的 level，根據父層級計算（最上層從 A 開始）
        const level = calculateTaskLevel(parentLevel);
        const nameParts = textToNameParts(node.title || '');
        return {
          id: generateTemplateTaskId(),
          nameParts,
          level,
          children: node.children ? convertTemplateTree(node.children, level) : []
        };
      });
    };

    const convertedTasks = convertTemplateTree(template.tree || []);
    updateTaskCapsuleState({
      capsuleTaskTemplate: { tasks: convertedTasks }
    });
  };

  // 新增根任務
  const addRootTask = () => {
    const currentState = getCurrentTaskCapsuleState();
    const currentTasks = currentState.capsuleTaskTemplate?.tasks || [];
    const rootLevel = selectedTask?.level || 'A';
    const newTask = {
      id: generateTemplateTaskId(),
      nameParts: [{ type: 'text', content: '' }],
      level: calculateTaskLevel(rootLevel),
      children: []
    };
    updateTaskCapsuleState({
      capsuleTaskTemplate: {
        tasks: [...currentTasks, newTask]
      }
    });
  };

  // 新增子任務
  const addChildTask = (parentId) => {
    const currentState = getCurrentTaskCapsuleState();
    const tasks = currentState.capsuleTaskTemplate?.tasks || [];
    
    const findTaskAndAddChild = (taskList, targetId) => {
      return taskList.map(task => {
        if (task.id === targetId) {
          const newChild = {
            id: generateTemplateTaskId(),
            nameParts: [{ type: 'text', content: '' }],
            level: calculateTaskLevel(task.level),
            children: []
          };
          return {
            ...task,
            children: [...(task.children || []), newChild]
          };
        }
        if (task.children && task.children.length > 0) {
          return {
            ...task,
            children: findTaskAndAddChild(task.children, targetId)
          };
        }
        return task;
      });
    };

    const updatedTasks = findTaskAndAddChild(tasks, parentId);
    updateTaskCapsuleState({
      capsuleTaskTemplate: { tasks: updatedTasks }
    });
  };

  // 刪除任務
  const removeTask = (taskId) => {
    const currentState = getCurrentTaskCapsuleState();
    const tasks = currentState.capsuleTaskTemplate?.tasks || [];
    
    const removeTaskById = (taskList, targetId) => {
      return taskList.filter(task => task.id !== targetId)
        .map(task => {
          if (task.children && task.children.length > 0) {
            return {
              ...task,
              children: removeTaskById(task.children, targetId)
            };
          }
          return task;
        });
    };

    const updatedTasks = removeTaskById(tasks, taskId);
    updateTaskCapsuleState({
      capsuleTaskTemplate: { tasks: updatedTasks }
    });
  };

  // 移動任務到新的父任務下
  const moveTaskToParent = (taskId, newParentId) => {
    const currentState = getCurrentTaskCapsuleState();
    const tasks = currentState.capsuleTaskTemplate?.tasks || [];
    
    // 先找到並移除被拖曳的任務
    let draggedTask = null;
    const removeTaskById = (taskList, targetId) => {
      const result = [];
      for (const task of taskList) {
        if (task.id === targetId) {
          draggedTask = task;
          continue;
        }
        if (task.children && task.children.length > 0) {
          result.push({
            ...task,
            children: removeTaskById(task.children, targetId)
          });
        } else {
          result.push(task);
        }
      }
      return result;
    };
    
    const tasksWithoutDragged = removeTaskById(tasks, taskId);
    if (!draggedTask) return;
    
    // 計算新層級
    const findParentLevel = (taskList, targetId) => {
      for (const task of taskList) {
        if (task.id === targetId) {
          return task.level;
        }
        if (task.children && task.children.length > 0) {
          const found = findParentLevel(task.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };
    
    const parentLevel = findParentLevel(tasksWithoutDragged, newParentId);
    const newLevel = calculateTaskLevel(parentLevel);
    draggedTask = { ...draggedTask, level: newLevel };
    
    // 將任務添加到新父任務下
    const addTaskToParent = (taskList, parentId, taskToAdd) => {
      return taskList.map(task => {
        if (task.id === parentId) {
          return {
            ...task,
            children: [...(task.children || []), taskToAdd]
          };
        }
        if (task.children && task.children.length > 0) {
          return {
            ...task,
            children: addTaskToParent(task.children, parentId, taskToAdd)
          };
        }
        return task;
      });
    };
    
    const updatedTasks = addTaskToParent(tasksWithoutDragged, newParentId, draggedTask);
    updateTaskCapsuleState({
      capsuleTaskTemplate: { tasks: updatedTasks }
    });
  };

  // 更新任務的 nameParts
  const updateTaskNameParts = (taskId, nameParts) => {
    const currentState = getCurrentTaskCapsuleState();
    const tasks = currentState.capsuleTaskTemplate?.tasks || [];
    
    const updateTaskById = (taskList, targetId, newNameParts) => {
      return taskList.map(task => {
        if (task.id === targetId) {
          return { ...task, nameParts: newNameParts };
        }
        if (task.children && task.children.length > 0) {
          return {
            ...task,
            children: updateTaskById(task.children, targetId, newNameParts)
          };
        }
        return task;
      });
    };

    const updatedTasks = updateTaskById(tasks, taskId, nameParts);
    updateTaskCapsuleState({
      capsuleTaskTemplate: { tasks: updatedTasks }
    });
  };

  // 在游標位置插入膠囊佔位符（contentEditable 版本）
  const insertCapsuleAtCursor = (taskId) => {
    const currentState = getCurrentTaskCapsuleState();
    const tasks = currentState.capsuleTaskTemplate?.tasks || [];
    
    const findTaskAndInsertCapsule = (taskList, targetId) => {
      return taskList.map(task => {
        if (task.id === targetId) {
          const nameParts = [...(task.nameParts || [])];
          // 在游標位置插入膠囊（簡化：在最後插入，實際應該根據游標位置）
          nameParts.push({ type: 'capsule' });
          return { ...task, nameParts };
        }
        if (task.children && task.children.length > 0) {
          return {
            ...task,
            children: findTaskAndInsertCapsule(task.children, targetId)
          };
        }
        return task;
      });
    };

    const updatedTasks = findTaskAndInsertCapsule(tasks, taskId);
    updateTaskCapsuleState({
      capsuleTaskTemplate: { tasks: updatedTasks }
    });
  };

  // 從 contentEditable 元素解析 nameParts
  const parseNamePartsFromElement = (element) => {
    const nameParts = [];
    
    // 遍歷所有子節點
    const processNode = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // 如果是膠囊標籤，添加膠囊類型
        if (node.classList && node.classList.contains('capsule-tag')) {
          nameParts.push({ type: 'capsule' });
          return; // 不處理膠囊標籤內部的內容
        }
        
        // 處理其他元素節點的子節點
        for (let child = node.firstChild; child; child = child.nextSibling) {
          processNode(child);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // 只處理不在膠囊標籤內的文字節點
        if (!node.parentElement || !node.parentElement.classList.contains('capsule-tag')) {
          const text = node.textContent;
          if (text && text.trim()) {
            // 檢查是否已有文字部分，如果有則合併
            if (nameParts.length > 0 && nameParts[nameParts.length - 1].type === 'text') {
              nameParts[nameParts.length - 1].content += text;
            } else {
              nameParts.push({ type: 'text', content: text });
            }
          }
        }
      }
    };
    
    // 從根元素開始處理
    for (let child = element.firstChild; child; child = child.nextSibling) {
      processNode(child);
    }
    
    return nameParts.length > 0 ? nameParts : [{ type: 'text', content: '' }];
  };

  // 將 nameParts 渲染到 contentEditable 元素
  const renderNamePartsToElement = (element, nameParts) => {
    element.innerHTML = '';
    nameParts.forEach(part => {
      if (part.type === 'text') {
        const textNode = document.createTextNode(part.content || '');
        element.appendChild(textNode);
      } else if (part.type === 'capsule') {
        const capsuleSpan = document.createElement('span');
        capsuleSpan.className = 'capsule-tag';
        capsuleSpan.contentEditable = false;
        capsuleSpan.textContent = '膠囊'; // 只顯示「膠囊」兩字
        capsuleSpan.draggable = true; // 允許拖曳
        capsuleSpan.style.cssText = `
          display: inline-block;
          background: #e3f2fd;
          border: 1px solid #52D0FF;
          border-radius: 4px;
          padding: 2px 8px;
          margin: 0 2px;
          font-size: 13px;
          color: #1679A2;
          cursor: move;
          user-select: none;
          vertical-align: middle;
        `;
        
        // 拖曳開始
        capsuleSpan.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', 'capsule');
          e.dataTransfer.setData('dragged-capsule', 'true');
          e.dataTransfer.effectAllowed = 'move';
          capsuleSpan.style.opacity = '0.5';
          // 保存被拖曳的膠囊元素引用
          e.dataTransfer.setData('dragged-element-id', capsuleSpan.getAttribute('data-capsule-id') || Date.now().toString());
          capsuleSpan.setAttribute('data-capsule-id', e.dataTransfer.getData('dragged-element-id'));
        });
        
        // 拖曳結束
        capsuleSpan.addEventListener('dragend', (e) => {
          capsuleSpan.style.opacity = '1';
        });
        
        // 移除點擊事件，避免點擊時複製膠囊
        // 只保留雙擊刪除功能
        capsuleSpan.addEventListener('dblclick', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // 雙擊刪除膠囊
          const taskId = element.dataset.taskId;
          if (taskId) {
            capsuleSpan.remove();
            const newNameParts = parseNamePartsFromElement(element);
            updateTaskNameParts(taskId, newNameParts);
          }
        });
        element.appendChild(capsuleSpan);
      }
    });
  };

  // 渲染任務樹
  const renderTemplateTaskTree = () => {
    const currentState = getCurrentTaskCapsuleState();
    const tasks = currentState.capsuleTaskTemplate?.tasks || [];

    if (tasks.length === 0) {
      return (
        <div style={{ fontSize: '13px', color: '#999', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>
          暫無任務，點擊上方按鈕新增
        </div>
      );
    }

    const renderTaskNode = (task, depth = 0, isLast = false) => {
      const displayText = namePartsToText(task.nameParts || []);
      const isEditing = editingTemplateTaskId === task.id;

      return (
        <div key={task.id} style={{ marginBottom: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              background: isEditing ? '#f0f8ff' : 'transparent',
              borderRadius: '4px',
              border: '1px solid transparent',
              cursor: isEditing ? 'text' : 'default',
              marginLeft: depth > 0 ? `${depth * 30}px` : '0', // 子任務縮排
              borderLeft: depth > 0 ? '3px solid #d0d0d0' : 'none', // 子任務左邊框
              paddingLeft: depth > 0 ? '16px' : '8px' // 調整左邊框後的內距
            }}
            draggable={!isEditing}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', task.id);
              // 保存原始位置信息，以便拖曳失敗時恢復
              const currentState = getCurrentTaskCapsuleState();
              const tasks = currentState.capsuleTaskTemplate?.tasks || [];
              
              // 找到任務的原始位置
              const findTaskPosition = (taskList, targetId, path = []) => {
                for (let i = 0; i < taskList.length; i++) {
                  if (taskList[i].id === targetId) {
                    return { path: [...path, i], task: JSON.parse(JSON.stringify(taskList[i])) };
                  }
                  if (taskList[i].children && taskList[i].children.length > 0) {
                    const found = findTaskPosition(taskList[i].children, targetId, [...path, i]);
                    if (found) return found;
                  }
                }
                return null;
              };
              
              const position = findTaskPosition(tasks, task.id);
              if (position) {
                setDraggedTaskInfo({ taskId: task.id, originalPosition: position });
                e.dataTransfer.effectAllowed = 'move';
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              const draggedTaskId = e.dataTransfer.getData('text/plain');
              // 只處理任務拖曳，不處理膠囊拖曳
              if (draggedTaskId && draggedTaskId !== task.id && !draggedTaskId.includes('capsule')) {
                // 檢查是否在元素的下半部分
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const isBottomHalf = y > rect.height / 2;
                
                if (isBottomHalf) {
                  e.currentTarget.style.borderBottom = '2px solid #52D0FF';
                  e.currentTarget.style.borderTop = '1px solid transparent';
                } else {
                  e.currentTarget.style.borderTop = '2px solid #52D0FF';
                  e.currentTarget.style.borderBottom = '1px solid transparent';
                }
              }
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderTop = '1px solid transparent';
              e.currentTarget.style.borderBottom = '1px solid transparent';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderTop = '1px solid transparent';
              e.currentTarget.style.borderBottom = '1px solid transparent';
              const draggedTaskId = e.dataTransfer.getData('text/plain');
              // 只處理任務拖曳，不處理膠囊拖曳
              if (draggedTaskId && draggedTaskId !== task.id && !draggedTaskId.includes('capsule')) {
                // 檢查是否在元素的下半部分
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const isBottomHalf = y > rect.height / 2;
                
                let success = false;
                
                if (isBottomHalf) {
                  // 拖曳到下方，成為子任務
                  // 檢查是否會造成循環引用（不能將任務拖曳到自己的子任務下）
                  const currentState = getCurrentTaskCapsuleState();
                  const tasks = currentState.capsuleTaskTemplate?.tasks || [];
                  
                  const isDescendant = (taskList, ancestorId, descendantId) => {
                    for (const t of taskList) {
                      if (t.id === ancestorId) {
                        // 檢查子任務中是否有目標任務
                        const checkChildren = (children, targetId) => {
                          if (!children) return false;
                          for (const child of children) {
                            if (child.id === targetId) return true;
                            if (child.children && checkChildren(child.children, targetId)) return true;
                          }
                          return false;
                        };
                        return checkChildren(t.children, descendantId);
                      }
                      if (t.children && t.children.length > 0) {
                        if (isDescendant(t.children, ancestorId, descendantId)) return true;
                      }
                    }
                    return false;
                  };
                  
                  // 如果不會造成循環引用，則移動
                  if (!isDescendant(tasks, draggedTaskId, task.id)) {
                    moveTaskToParent(draggedTaskId, task.id);
                    success = true;
                  }
                } else {
                  // 拖曳到上方，成為同層級任務
                  const currentState = getCurrentTaskCapsuleState();
                  const tasks = currentState.capsuleTaskTemplate?.tasks || [];
                  
                  // 找到被拖曳任務的父任務
                  const findParentTask = (taskList, targetId, parentId = null) => {
                    for (const t of taskList) {
                      if (t.id === targetId) return parentId;
                      if (t.children && t.children.length > 0) {
                        const found = findParentTask(t.children, targetId, t.id);
                        if (found !== null) return found;
                      }
                    }
                    return null;
                  };
                  
                  const draggedParentId = findParentTask(tasks, draggedTaskId);
                  const targetParentId = findParentTask(tasks, task.id);
                  
                  // 如果兩個任務有相同的父任務，則在同層級移動
                  if (draggedParentId === targetParentId) {
                    // 在同層級重新排序
                    const reorderTasks = (taskList, draggedId, targetId, isBefore) => {
                      const result = [];
                      let draggedTask = null;
                      
                      // 先移除被拖曳的任務
                      for (const t of taskList) {
                        if (t.id === draggedId) {
                          draggedTask = t;
                          continue;
                        }
                        if (t.children && t.children.length > 0) {
                          result.push({
                            ...t,
                            children: reorderTasks(t.children, draggedId, targetId, isBefore)
                          });
                        } else {
                          result.push(t);
                        }
                      }
                      
                      // 在目標位置插入
                      if (draggedTask) {
                        const targetIndex = result.findIndex(t => t.id === targetId);
                        if (targetIndex >= 0) {
                          result.splice(isBefore ? targetIndex : targetIndex + 1, 0, draggedTask);
                        } else {
                          result.push(draggedTask);
                        }
                      }
                      
                      return result;
                    };
                    
                    const updatedTasks = reorderTasks(tasks, draggedTaskId, task.id, true);
                    updateTaskCapsuleState({
                      capsuleTaskTemplate: { tasks: updatedTasks }
                    });
                    success = true;
                  } else {
                    // 如果父任務不同，移動到目標任務的父任務下（同層級）
                    moveTaskToParent(draggedTaskId, targetParentId);
                    success = true;
                  }
                }
                
                // 如果拖曳成功，清除拖曳信息；如果失敗，保留以便恢復
                if (success) {
                  setDraggedTaskInfo(null);
                }
              }
            }}
            onDragEnd={(e) => {
              // 如果拖曳失敗（draggedTaskInfo 還在），恢復原位置
              if (draggedTaskInfo && draggedTaskInfo.taskId) {
                const currentState = getCurrentTaskCapsuleState();
                const tasks = currentState.capsuleTaskTemplate?.tasks || [];
                
                // 檢查任務是否還在（如果已經被移動了就不需要恢復）
                const findTask = (taskList, targetId) => {
                  for (const t of taskList) {
                    if (t.id === targetId) return t;
                    if (t.children && t.children.length > 0) {
                      const found = findTask(t.children, targetId);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                
                const taskExists = findTask(tasks, draggedTaskInfo.taskId);
                if (!taskExists) {
                  // 任務不存在，需要恢復
                  const restoreTask = (taskList, position, taskToRestore, depth = 0) => {
                    if (depth >= position.path.length - 1) {
                      // 到達目標層級
                      const index = position.path[depth];
                      const newList = [...taskList];
                      newList.splice(index, 0, taskToRestore);
                      return newList;
                    }
                    
                    const currentIndex = position.path[depth];
                    return taskList.map((t, i) => {
                      if (i === currentIndex) {
                        return {
                          ...t,
                          children: restoreTask(t.children || [], position, taskToRestore, depth + 1)
                        };
                      }
                      return t;
                    });
                  };
                  
                  const restoredTasks = restoreTask(tasks, draggedTaskInfo.originalPosition, draggedTaskInfo.originalPosition.task);
                  updateTaskCapsuleState({
                    capsuleTaskTemplate: { tasks: restoredTasks }
                  });
                }
                
                // 清除拖曳信息
                setDraggedTaskInfo(null);
              }
            }}
          >
            <span style={{ fontSize: '13px', color: '#666' }}>
              {depth === 0 ? '└─' : isLast ? '└─' : '├─'}
            </span>
            
            {isEditing ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div
                  ref={(el) => {
                    if (el && !el.dataset.initialized) {
                      el.dataset.initialized = 'true';
                      el.dataset.taskId = task.id;
                      el.contentEditable = true;
                      el.style.cssText = `
                        flex: 1;
                        min-width: 200px;
                        min-height: 24px;
                        padding: 4px 8px;
                        border: 1px solid #52D0FF;
                        border-radius: 4px;
                        font-size: 14px;
                        outline: none;
                        background: white;
                        line-height: 1.5;
                      `;
                      
                      // 初始化內容
                      renderNamePartsToElement(el, task.nameParts || [{ type: 'text', content: '' }]);
                      
                      // 監聽輸入變化
                      el.addEventListener('input', () => {
                        const newNameParts = parseNamePartsFromElement(el);
                        updateTaskNameParts(task.id, newNameParts);
                      });
                      
                      // 監聽鍵盤事件，處理backspace刪除膠囊
                      el.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                          const selection = window.getSelection();
                          if (selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            
                            // 檢查游標是否在膠囊後面
                            if (range.collapsed) {
                              const startContainer = range.startContainer;
                              const startOffset = range.startOffset;
                              
                              // 檢查下一個節點是否是膠囊
                              let nextNode = null;
                              if (startContainer.nodeType === Node.TEXT_NODE) {
                                // 如果是文字節點的末尾
                                if (startOffset === startContainer.textContent.length) {
                                  nextNode = startContainer.nextSibling;
                                }
                              } else {
                                // 如果是元素節點，檢查第一個子節點
                                nextNode = startContainer.childNodes[startOffset] || startContainer.nextSibling;
                              }
                              
                              // 如果下一個節點是膠囊，刪除它
                              if (nextNode && nextNode.classList && nextNode.classList.contains('capsule-tag')) {
                                e.preventDefault();
                                nextNode.remove();
                                const newNameParts = parseNamePartsFromElement(el);
                                updateTaskNameParts(task.id, newNameParts);
                                return;
                              }
                              
                              // 檢查前一個節點是否是膠囊（Delete鍵的情況）
                              if (e.key === 'Delete') {
                                let prevNode = null;
                                if (startContainer.nodeType === Node.TEXT_NODE) {
                                  if (startOffset === 0) {
                                    prevNode = startContainer.previousSibling;
                                  }
                                } else {
                                  prevNode = startContainer.childNodes[startOffset - 1] || startContainer.previousSibling;
                                }
                                
                                if (prevNode && prevNode.classList && prevNode.classList.contains('capsule-tag')) {
                                  e.preventDefault();
                                  prevNode.remove();
                                  const newNameParts = parseNamePartsFromElement(el);
                                  updateTaskNameParts(task.id, newNameParts);
                                  return;
                                }
                              }
                            }
                          }
                        }
                      });
                      
                      // 監聽點擊膠囊按鈕（只阻止默認行為，不複製）
                      el.addEventListener('click', (e) => {
                        if (e.target.classList.contains('capsule-tag')) {
                          e.stopPropagation();
                          // 不阻止默認行為，讓游標可以移動到膠囊後面
                        }
                      });
                      
                      // 創建插入指示器（游標線）- 使用全局指示器
                      if (!window.capsuleInsertIndicator) {
                        window.capsuleInsertIndicator = document.createElement('span');
                        window.capsuleInsertIndicator.style.cssText = `
                          position: fixed;
                          width: 2px;
                          background: #52D0FF;
                          pointer-events: none;
                          z-index: 10000;
                          display: none;
                          transition: none;
                        `;
                        document.body.appendChild(window.capsuleInsertIndicator);
                      }
                      const insertIndicator = window.capsuleInsertIndicator;
                      
                      // 監聽拖曳事件（膠囊在文字間移動）
                      el.addEventListener('dragover', (e) => {
                        // 檢查是否有膠囊正在被拖曳
                        const draggedCapsule = Array.from(el.querySelectorAll('.capsule-tag')).find(
                          tag => tag.style.opacity === '0.5'
                        );
                        
                        if (draggedCapsule && e.dataTransfer.types.includes('text/plain')) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          
                          // 使用 document.caretRangeFromPoint 找到插入位置
                          let range = null;
                          if (document.caretRangeFromPoint) {
                            range = document.caretRangeFromPoint(e.clientX, e.clientY);
                          } else if (document.caretPositionFromPoint) {
                            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                            if (pos) {
                              range = document.createRange();
                              range.setStart(pos.offsetNode, pos.offset);
                              range.collapse(true);
                            }
                          }
                          
                          if (range) {
                            // 確保範圍在編輯器內
                            const startContainer = range.startContainer;
                            if (el.contains(startContainer) || el === startContainer || 
                                (startContainer.nodeType === Node.TEXT_NODE && el.contains(startContainer.parentElement))) {
                              try {
                                // 更新選擇範圍以顯示游標位置
                                const selection = window.getSelection();
                                selection.removeAllRanges();
                                selection.addRange(range);
                                
                                // 顯示插入指示器
                                const rect = range.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                
                                // 如果範圍在編輯器內，顯示指示器
                                if (rect.top >= elRect.top && rect.top <= elRect.bottom) {
                                  insertIndicator.style.display = 'block';
                                  insertIndicator.style.left = `${rect.left}px`;
                                  insertIndicator.style.top = `${rect.top}px`;
                                  insertIndicator.style.height = `${Math.max(rect.height, 20)}px`;
                                } else {
                                  insertIndicator.style.display = 'none';
                                }
                              } catch (err) {
                                // 忽略範圍錯誤
                                insertIndicator.style.display = 'none';
                              }
                            }
                          }
                        }
                      });
                      
                      // 拖曳離開時隱藏指示器
                      el.addEventListener('dragleave', (e) => {
                        if (insertIndicator) {
                          insertIndicator.style.display = 'none';
                        }
                      });
                      
                      el.addEventListener('drop', (e) => {
                        // 隱藏插入指示器
                        if (insertIndicator) {
                          insertIndicator.style.display = 'none';
                        }
                        
                        // 檢查是否有膠囊正在被拖曳
                        const draggedCapsule = Array.from(el.querySelectorAll('.capsule-tag')).find(
                          tag => tag.style.opacity === '0.5'
                        );
                        if (draggedCapsule) {
                          e.preventDefault();
                          
                          // 使用當前選擇範圍或根據鼠標位置創建範圍
                          let range = null;
                          const selection = window.getSelection();
                          if (selection.rangeCount > 0) {
                            range = selection.getRangeAt(0);
                          } else {
                            // 如果沒有選擇範圍，根據鼠標位置創建
                            if (document.caretRangeFromPoint) {
                              range = document.caretRangeFromPoint(e.clientX, e.clientY);
                            } else if (document.caretPositionFromPoint) {
                              const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                              if (pos) {
                                range = document.createRange();
                                range.setStart(pos.offsetNode, pos.offset);
                                range.collapse(true);
                              }
                            }
                          }
                          
                          if (range) {
                            // 確保範圍在編輯器內
                            const startContainer = range.startContainer;
                            if (el.contains(startContainer) || el === startContainer || 
                                (startContainer.nodeType === Node.TEXT_NODE && el.contains(startContainer.parentElement))) {
                              // 移除舊位置的膠囊
                              draggedCapsule.remove();
                              
                              // 在新位置插入膠囊
                              const newCapsule = document.createElement('span');
                              newCapsule.className = 'capsule-tag';
                              newCapsule.contentEditable = false;
                              newCapsule.textContent = '膠囊';
                              newCapsule.draggable = true;
                              newCapsule.style.cssText = `
                                display: inline-block;
                                background: #e3f2fd;
                                border: 1px solid #52D0FF;
                                border-radius: 4px;
                                padding: 2px 8px;
                                margin: 0 2px;
                                font-size: 13px;
                                color: #1679A2;
                                cursor: move;
                                user-select: none;
                                vertical-align: middle;
                              `;
                              
                              // 添加拖曳事件
                              newCapsule.addEventListener('dragstart', (ev) => {
                                ev.dataTransfer.setData('text/plain', 'capsule');
                                ev.dataTransfer.setData('dragged-capsule', 'true');
                                newCapsule.style.opacity = '0.5';
                              });
                              
                              newCapsule.addEventListener('dragend', (ev) => {
                                newCapsule.style.opacity = '1';
                              });
                              
                              newCapsule.addEventListener('dblclick', (ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();
                                newCapsule.remove();
                                const newNameParts = parseNamePartsFromElement(el);
                                updateTaskNameParts(task.id, newNameParts);
                              });
                              
                              range.insertNode(newCapsule);
                              range.setStartAfter(newCapsule);
                              range.collapse(true);
                              selection.removeAllRanges();
                              selection.addRange(range);
                              
                              // 更新 nameParts
                              const newNameParts = parseNamePartsFromElement(el);
                              updateTaskNameParts(task.id, newNameParts);
                            }
                          }
                        }
                      });
                      
                      // 拖曳結束時清理指示器
                      el.addEventListener('dragend', (e) => {
                        if (insertIndicator) {
                          insertIndicator.style.display = 'none';
                        }
                      });
                      
                      // 聚焦
                      setTimeout(() => {
                        el.focus();
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                      }, 0);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    // 在當前游標位置插入膠囊
                    const editor = document.querySelector(`[data-task-id="${task.id}"]`);
                    if (editor) {
                      const selection = window.getSelection();
                      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();
                      
                      // 創建膠囊標籤
                      const capsuleSpan = document.createElement('span');
                      capsuleSpan.className = 'capsule-tag';
                      capsuleSpan.contentEditable = false;
                      capsuleSpan.textContent = '膠囊'; // 只顯示「膠囊」兩字
                      capsuleSpan.draggable = true; // 允許拖曳
                      capsuleSpan.style.cssText = `
                        display: inline-block;
                        background: #e3f2fd;
                        border: 1px solid #52D0FF;
                        border-radius: 4px;
                        padding: 2px 8px;
                        margin: 0 2px;
                        font-size: 13px;
                        color: #1679A2;
                        cursor: move;
                        user-select: none;
                        vertical-align: middle;
                      `;
                      
                      // 添加拖曳事件
                      capsuleSpan.addEventListener('dragstart', (ev) => {
                        ev.dataTransfer.setData('text/plain', 'capsule');
                        ev.dataTransfer.setData('dragged-capsule', 'true');
                        capsuleSpan.style.opacity = '0.5';
                      });
                      
                      capsuleSpan.addEventListener('dragend', (ev) => {
                        capsuleSpan.style.opacity = '1';
                      });
                      
                      capsuleSpan.addEventListener('dblclick', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        capsuleSpan.remove();
                        const newNameParts = parseNamePartsFromElement(editor);
                        updateTaskNameParts(task.id, newNameParts);
                      });
                      
                      // 如果沒有選中範圍，在游標位置插入
                      if (range.collapsed) {
                        range.insertNode(capsuleSpan);
                        range.setStartAfter(capsuleSpan);
                        range.collapse(true);
                      } else {
                        // 如果有選中內容，替換選中內容
                        range.deleteContents();
                        range.insertNode(capsuleSpan);
                        range.setStartAfter(capsuleSpan);
                        range.collapse(true);
                      }
                      
                      selection.removeAllRanges();
                      selection.addRange(range);
                      editor.focus();
                      
                      // 添加事件監聽
                      capsuleSpan.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const selection = window.getSelection();
                        if (selection.rangeCount > 0) {
                          const range = selection.getRangeAt(0);
                          const newCapsule = capsuleSpan.cloneNode(true);
                          range.insertNode(newCapsule);
                          range.setStartAfter(newCapsule);
                          range.collapse(true);
                          selection.removeAllRanges();
                          selection.addRange(range);
                          
                          const newNameParts = parseNamePartsFromElement(editor);
                          updateTaskNameParts(task.id, newNameParts);
                        }
                      });
                      
                      capsuleSpan.addEventListener('dblclick', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        capsuleSpan.remove();
                        const newNameParts = parseNamePartsFromElement(editor);
                        updateTaskNameParts(task.id, newNameParts);
                      });
                      
                      // 更新 nameParts
                      const newNameParts = parseNamePartsFromElement(editor);
                      updateTaskNameParts(task.id, newNameParts);
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    background: '#e3f2fd',
                    border: '1px solid #52D0FF',
                    borderRadius: '4px',
                    color: '#1679A2',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  +新增膠囊
                </button>
                <button
                  onClick={() => {
                    setEditingTemplateTaskId(null);
                  }}
                  style={{
                    padding: '4px 12px',
                    background: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  完成
                </button>
              </div>
            ) : (
              <>
                <div
                  onClick={() => {
                    setEditingTemplateTaskId(task.id);
                  }}
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    cursor: 'pointer',
                    color: displayText ? '#333' : '#999',
                    textDecoration: 'underline',
                    textDecorationColor: '#52D0FF',
                    minHeight: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '4px'
                  }}
                  title="點擊編輯"
                >
                  {(task.nameParts || []).length === 0 ? (
                    <span style={{ color: '#999' }}>（未命名，點擊編輯）</span>
                  ) : (
                    (task.nameParts || []).map((part, index) => (
                      <React.Fragment key={index}>
                        {part.type === 'text' ? (
                          <span>{part.content || ''}</span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#e3f2fd',
                              border: '1px solid #52D0FF',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '13px',
                              color: '#1679A2',
                              verticalAlign: 'middle'
                            }}
                          >
                            膠囊
                          </span>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>
                <span style={{ fontSize: '12px', color: '#999' }}>
                  ({task.level})
                </span>
                <button
                  onClick={() => addChildTask(task.id)}
                  style={{
                    padding: '4px 8px',
                    background: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#333',
                    fontWeight: '500'
                  }}
                >
                  + 添加子任務
                </button>
                <button
                  onClick={() => removeTask(task.id)}
                  style={{
                    padding: '4px 8px',
                    background: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  刪除
                </button>
              </>
            )}
          </div>
          
          {/* 渲染子任務 */}
          {task.children && task.children.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {task.children.map((child, index) => 
                renderTaskNode(child, depth + 1, index === task.children.length - 1)
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        {tasks.map((task, index) => 
          renderTaskNode(task, 0, index === tasks.length - 1)
        )}
      </div>
    );
  };

  // 當選擇有膠囊功能的任務時，自動啟用膠囊功能
  useEffect(() => {
    if (selectedTask && selectedTask.hasCapsules) {
      const currentState = getCurrentTaskCapsuleState();
      if (!currentState.showCapsules) {
        updateTaskCapsuleState({ 
          showCapsules: true,
          title: '列出常用小區域',
          capsuleTaskTemplate: {
            tasks: [] // 初始化模板設計為空
          },
          templateDesignerOpen: true // 自動展開模板設計區域
        });
      }
    }
  }, [selectedTask]);

  // 文字膠囊功能函數
  const handleInsertCapsules = () => {
    const currentState = getCurrentTaskCapsuleState();
    
    // 如果還沒有佔位符，自動創建一個隱藏的佔位符作為當前任務的子任務
    if (!currentState.placeholderTaskId) {
      const placeholderId = generateId();
      const placeholderTask = {
        id: placeholderId,
        title: `此處將插入動態生成的任務，原任務為【${selectedTask.title}】`,
        level: getChildLevel(selectedTask.level),
        status: 'pending',
        taskType: 'recurring', // 預設為持續型
        isPlaceholder: true,
        isHidden: true, // 預設隱藏
        originalTitle: selectedTask.title,
        sourceTaskId: selectedTask.id,
        details: { startDate: null, startTime: '', dueDate: null, dueTime: '', reminders: [] },
        children: [],
        style: {
          color: '#999',
          fontStyle: 'italic',
          backgroundColor: 'rgba(245, 245, 245, 0.5)'
        }
      };

      // 添加佔位符作為當前任務的子任務
      setTasks(prevTasks => {
        const addPlaceholder = (taskList) => {
          return taskList.map(task => {
            if (task.id === selectedTask.id) {
              return {
                ...task,
                children: [...(task.children || []), placeholderTask]
              };
            }
            if (task.children && task.children.length > 0) {
              return {
                ...task,
                children: addPlaceholder(task.children)
              };
            }
            return task;
          });
        };
        
        const updatedTasks = addPlaceholder(prevTasks);
        syncSelectedTask(updatedTasks);
        try {
        localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
        return updatedTasks;
      });

      updateTaskCapsuleState({ 
        showCapsules: true,
        placeholderTaskId: placeholderId,
        placeholderEnabled: false, // 預設不啟用（隱藏）
        originalTaskTitle: selectedTask.title,
        capsuleTaskTemplate: {
          tasks: [] // 初始化模板設計為空
        },
        templateDesignerOpen: true // 啟用時自動展開模板設計區域
      });
    } else {
      // 已有佔位符，只顯示膠囊功能
      updateTaskCapsuleState({ 
        showCapsules: true,
        capsuleTaskTemplate: {
          tasks: [] // 確保模板設計區域顯示
        },
        templateDesignerOpen: true // 啟用時自動展開模板設計區域
      });
    }
  };


  // 任務關聯高亮功能
  const getRelatedTasks = (clickedTaskId) => {
    // 檢查是否是原任務（有膠囊功能）
    const findTaskById = (taskList, id) => {
      for (const task of taskList) {
        if (task.id === id) return task;
        if (task.children) {
          const found = findTaskById(task.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const clickedTask = findTaskById(tasks, clickedTaskId);
    if (!clickedTask) return { type: 'none', relatedIds: [] };

    // 檢查是否是有膠囊功能的原任務
    if (clickedTask.hasCapsules) {
      const capsuleState = taskCapsuleStates[clickedTaskId];
      if (capsuleState && capsuleState.allGeneratedTaskIds && capsuleState.allGeneratedTaskIds.length > 0) {
        return {
          type: 'original',
          relatedIds: capsuleState.allGeneratedTaskIds
        };
      }
    }

    // 檢查是否是生成的任務（包括子任務）
    if (clickedTask.isGeneratedTask && clickedTask.sourceTaskId) {
      const originalTaskId = clickedTask.sourceTaskId;
      const capsuleState = taskCapsuleStates[originalTaskId];
      if (capsuleState && capsuleState.generatedTasks) {
        return {
          type: 'generated',
          originalTaskId: originalTaskId,
          relatedIds: capsuleState.generatedTasks
        };
      }
    }

    // 備用檢查：遍歷所有膠囊狀態
    for (const [originalTaskId, capsuleState] of Object.entries(taskCapsuleStates)) {
      if (capsuleState.generatedTasks && capsuleState.generatedTasks.includes(clickedTaskId)) {
        return {
          type: 'generated',
          originalTaskId: originalTaskId,
          relatedIds: capsuleState.generatedTasks
        };
      }
    }

    return { type: 'none', relatedIds: [] };
  };

  const handleTaskHighlight = (taskId) => {
    const relation = getRelatedTasks(taskId);
    
    if (relation.type === 'original') {
      // 點擊原任務 → 高亮生成的任務群
      setHighlightedTasks(new Set(relation.relatedIds));
      setHighlightedOriginalTask(null);
    } else if (relation.type === 'generated') {
      // 點擊生成任務 → 高亮原任務
      setHighlightedTasks(new Set());
      setHighlightedOriginalTask(relation.originalTaskId);
    } else {
      // 清除高亮
      setHighlightedTasks(new Set());
      setHighlightedOriginalTask(null);
    }
  };

  // 查找任務的父級路徑
  const findParentPath = (taskList, targetId, path = []) => {
    for (const task of taskList) {
      if (task.id === targetId) {
        return path;
      }
      if (task.children) {
        const result = findParentPath(task.children, targetId, [...path, task.id]);
        if (result) return result;
      }
    }
    return null;
  };

  // 通用的任務樹更新函數
  const updateTaskTree = (taskList, targetId, updates) => {
    return taskList.map(task => {
      if (task.id === targetId) {
        return { ...task, ...updates };
      }
      if (task.children) {
        return {
          ...task,
          children: updateTaskTree(task.children, targetId, updates)
        };
      }
      return task;
    });
  };

  // 處理回到原任務導航
  const handleBackToOriginalTask = (generatedTaskId) => {
    // 找到這個生成任務對應的原始任務
    let originalTaskId = null;
    let originalCapsuleId = null;
    
    // 遍歷所有任務的膠囊狀態，找到對應的原始任務
    Object.keys(taskCapsuleStates).forEach(taskId => {
      const state = taskCapsuleStates[taskId];
      if (state.capsuleTaskMappings) {
        Object.entries(state.capsuleTaskMappings).forEach(([capsuleId, mappedTaskId]) => {
          if (mappedTaskId === generatedTaskId) {
            originalTaskId = taskId;
            originalCapsuleId = capsuleId;
          }
        });
      }
    });
    
    if (originalTaskId) {
      const originalTask = findTaskById(tasks, originalTaskId);
      if (originalTask) {
        // 選擇原始任務
        setSelectedTask(originalTask);
        
        // 展開所有父級任務
        const parentPath = findParentPath(tasks, originalTaskId);
        if (parentPath) {
          parentPath.forEach(parentId => {
            if (parentId !== originalTaskId) {
              const parentTask = findTaskById(tasks, parentId);
              if (parentTask) {
                setTasks(prevTasks => updateTaskTree(prevTasks, parentId, { expanded: true }));
              }
            }
          });
        }
        
        // 高亮相關任務
        handleTaskHighlight(originalTaskId);
        
        // 滾動到原始任務
        setTimeout(() => {
          const element = document.querySelector(`[data-task-id="${originalTaskId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  };

  // 檢查任務是否為生成任務
  const isGeneratedTask = (taskId) => {
    return Object.values(taskCapsuleStates).some(state => 
      state.allGeneratedTaskIds && state.allGeneratedTaskIds.includes(taskId)
    );
  };
  // 扁平化任務數據用於概覽面板
  const flattenTasks = (taskList, parentPath = [], globalIndex = { value: 0 }) => {
    let flattened = [];
    
    if (!taskList || !Array.isArray(taskList)) {
      return flattened;
    }
    
    taskList.forEach((task) => {
      if (!task || !task.id) {
        return; // 跳過無效的任務
      }
      
      const currentPath = [...parentPath, { id: task.id, title: task.title, level: task.level }];
      const breadcrumb = currentPath.map(p => `${p.level}【${p.title}】`).join(' > ');
      
      // 保存當前全局索引，然後遞增
      const currentIndex = globalIndex.value++;
      
      flattened.push({
        ...task,
        breadcrumb,
        parentPath: currentPath,
        originalIndex: currentIndex, // 保存原始索引（按照樹狀圖的順序）
        completed: task.status === 'completed' || task.completed // 確保 completed 字段與 status 同步
      });
      
      if (task.children && Array.isArray(task.children) && task.children.length > 0) {
        flattened = flattened.concat(flattenTasks(task.children, currentPath, globalIndex));
      }
    });
    
    return flattened;
  };
  // 獲取扁平化任務列表
  const allTasks = useMemo(() => flattenTasks(tasks), [tasks]);
  // 過濾和排序任務
  const filteredTasks = useMemo(() => {
    let filtered = allTasks.filter(task => {
      // 隱藏 Root 任務
      if (task.id === 'root' || (typeof task.title === 'string' && task.title.trim().toLowerCase() === 'root')) {
        return false;
      }
      // 搜索過濾
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!task.title.toLowerCase().includes(searchLower) && 
            !(task.description && task.description.toLowerCase().includes(searchLower))) {
          return false;
        }
      }
      
      // 層級過濾
      if (levelFilter !== 'all' && task.level !== levelFilter) {
        return false;
      }
      
      // 狀態過濾
      if (statusFilter !== 'all') {
        const isCompleted = task.completed;
        if (statusFilter === 'completed' && !isCompleted) return false;
        if (statusFilter === 'pending' && isCompleted) return false;
      }
      
      // 優先級過濾
      if (priorityFilter !== 'all') {
        if (priorityFilter === 'none') {
          // 篩選無優先級的任務（priority 為 null、undefined 或空字串）
          if (task.priority !== null && task.priority !== undefined && task.priority !== '') {
        return false;
          }
        } else {
          // 篩選特定優先級
          if (task.priority !== priorityFilter) {
            return false;
          }
        }
      }
      
      // 屬性過濾
      if (tagFilter !== 'all') {
        if (tagFilter === 'none') {
          // 篩選無屬性的任務（tagId 為 null、undefined 或空字串）
          if (task.tagId !== null && task.tagId !== undefined && task.tagId !== '') {
            return false;
          }
        } else {
          // 篩選特定屬性
          if (task.tagId !== tagFilter) {
            return false;
          }
        }
      }
      
      return true;
    });
    
    // 排序
    filtered.sort((a, b) => {
      let aValue, bValue;
      let comparison = 0;
      
      switch (sortBy) {
        case 'default':
          // 預設：按照左側樹狀圖的順序（使用原始索引）
          return (a.originalIndex || 0) - (b.originalIndex || 0);
          
        case 'created':
          // 創建時間：最早的在最上面（升序時）
          const aCreated = a.created ? new Date(a.created) : new Date(0);
          const bCreated = b.created ? new Date(b.created) : new Date(0);
          aValue = aCreated.getTime();
          bValue = bCreated.getTime();
          comparison = aValue - bValue;
          break;
          
        case 'dueDate':
          // 截止日期：最早的在最上面（升序時）
          // 無日期的排在最下面（使用很晚的日期）
          const aDueDate = a.details?.dueDate ? new Date(a.details.dueDate) : new Date('9999-12-31');
          const bDueDate = b.details?.dueDate ? new Date(b.details.dueDate) : new Date('9999-12-31');
          aValue = aDueDate.getTime();
          bValue = bDueDate.getTime();
          comparison = aValue - bValue;
          break;
          
        case 'priority':
          // 優先級：高→中→低→無（降序時高在最上面）
          const priorityOrder = { 'high': 4, 'medium': 3, 'low': 2 };
          // 處理無優先級：null、undefined、空字串都視為'none'
          const aPriority = (!a.priority || a.priority === 'none') ? 'none' : a.priority;
          const bPriority = (!b.priority || b.priority === 'none') ? 'none' : b.priority;
          aValue = priorityOrder[aPriority] || 1; // 無優先級 = 1
          bValue = priorityOrder[bPriority] || 1; // 無優先級 = 1
          comparison = bValue - aValue; // 預設降序：高優先級在前
          break;
          
        case 'level':
          // 層級：A→B→C→D（降序時A在最上面）
          const levelOrder = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
          aValue = levelOrder[a.level] || 0;
          bValue = levelOrder[b.level] || 0;
          comparison = bValue - aValue; // 預設降序：A層級在前
          break;
          
        case 'status':
        // 狀態：未完成 → 已完成（升序時未完成在上）
          aValue = a.completed ? 1 : 0;
          bValue = b.completed ? 1 : 0;
        comparison = aValue - bValue; // 預設升序：未完成在前
          break;
          
        default:
          aValue = a.title;
          bValue = b.title;
          comparison = aValue > bValue ? 1 : -1;
      }
      
      // 預設排序不受 sortOrder 影響，直接返回
      if (sortBy === 'default') {
        return comparison;
      }
      
      // 根據 sortOrder 決定是否反轉排序
      // 對於優先級和層級，預設是降序（高優先級/A層級在前），所以升序時要反轉
      // 對於截止日期、創建時間和狀態，預設是升序（早日期/早創建/未完成在前），所以降序時要反轉
      if (sortBy === 'priority' || sortBy === 'level') {
        // 優先級和層級：預設降序，升序時反轉
        return sortOrder === 'asc' ? -comparison : comparison;
      } else {
        // 截止日期、創建時間和狀態：預設升序，降序時反轉
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });
    
    return filtered;
  }, [allTasks, searchTerm, levelFilter, statusFilter, priorityFilter, tagFilter, sortBy, sortOrder]);

  const repeatLogEntries = useMemo(() => {
    if (!selectedTask) return [];
    const log = selectedTask.details?.repeatLog || {};
    const unit = selectedTask.details?.repeat?.unit || 'day';

    return Object.entries(log)
      .map(([dateKey, info]) => {
        let displayDate = dateKey;
        if (unit === 'minute' && /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(dateKey)) {
          const [year, month, day, hour, minute] = dateKey.split('-');
          displayDate = `${year}-${month}-${day} ${hour}:${minute}`;
        }
        return {
          dateKey,
          displayDate,
          completed: Boolean(info?.completed),
          completedAt: info?.completedAt || null,
          maxProgress: typeof info?.maxProgress === 'number' ? info.maxProgress : null,
          recordedAt: info?.recordedAt || null
        };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [selectedTask?.id, selectedTask?.details?.repeatLog, selectedTask?.details?.repeat?.unit]);

  const recentRepeatLogEntries = useMemo(() => {
    if (!repeatLogEntries.length) return [];
    return [...repeatLogEntries].reverse().slice(0, 30);
  }, [repeatLogEntries]);

  const repeatLogAnalysis = useMemo(() => {
    const entries = repeatLogEntries;
    if (!entries.length) {
      return {
        total: 0,
        completedCount: 0,
        completionRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        recentCompletionRate: 0,
        recentTrend: [],
        dailyTrend: []
      };
    }

    const total = entries.length;
    let completedCount = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let totalProgress = 0;

    const normalizeProgress = (entry) => {
      if (entry.completed) return 100;
      const numeric = Number(entry.maxProgress);
      const raw = Number.isFinite(numeric) ? numeric : 0;
      return Math.max(0, Math.min(100, raw));
    };

    entries.forEach(entry => {
      const progressValue = normalizeProgress(entry);
      totalProgress += progressValue;

      if (entry.completed || progressValue >= 100) {
        completedCount += 1;
        currentStreak += 1;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    });

    const completionRate = Math.round(totalProgress / total);
    const recentWindow = entries.slice(-7);
    const recentProgressSum = recentWindow.reduce((sum, entry) => sum + normalizeProgress(entry), 0);
    const recentCompletionRate = recentWindow.length
      ? Math.round(recentProgressSum / recentWindow.length)
      : 0;
    const recentTrend = entries.slice(-10);
    const dailyMap = new Map();

    entries.forEach(entry => {
      const dateKey =
        entry.dateKey.length >= 10
          ? entry.dateKey.slice(0, 10)
          : entry.displayDate.split(' ')[0];
      const existing = dailyMap.get(dateKey) || { date: dateKey, total: 0, completed: 0, progressSum: 0 };
      existing.total += 1;
      const progressValue = normalizeProgress(entry);
      existing.progressSum += progressValue;
      if (entry.completed || progressValue >= 100) existing.completed += 1;
      dailyMap.set(dateKey, existing);
    });

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        date: item.date,
        total: item.total,
        completed: item.completed,
        completionRate: item.total ? Math.round(item.progressSum / item.total) : 0
      }));

    return {
      total,
      completedCount,
      completionRate,
      currentStreak,
      longestStreak,
      recentCompletionRate,
      recentTrend,
      dailyTrend
    };
  }, [repeatLogEntries]);

  // 概覽面板處理函數
  const handleTaskStatusToggle = (taskId) => {
    const task = findTaskById(tasks, taskId);
    if (task) {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      handleStatusChange(taskId, newStatus);
    }
  };

  const handleOverviewTaskClick = (taskId) => {
    const task = findTaskById(tasks, taskId);
    if (task) {
      setSelectedTask(task);
      setActiveTab('details');
    }
  };

  const handleBreadcrumbClick = (taskId) => {
    const task = findTaskById(tasks, taskId);
    if (task) {
      setSelectedTask(task);
      setActiveTab('details');
    }
  };

  const handleBulkStatusChange = (newStatus) => {
    const targetStatus = newStatus === 'completed' ? 'completed' : 'pending';
      selectedTasks.forEach(taskId => {
      handleStatusChange(taskId, targetStatus);
    });
    setSelectedTasks(new Set());
  };

  const handleDeleteRepeatLogEntry = useCallback((taskId, entryKey) => {
    if (!taskId || !entryKey) return;

    setTasks(prevTasks => {
      const targetTask = findTaskById(prevTasks, taskId);
      if (!targetTask) return prevTasks;

      const currentLog = targetTask.details?.repeatLog || {};
      if (!Object.prototype.hasOwnProperty.call(currentLog, entryKey)) {
        return prevTasks;
      }

      const nextLog = { ...currentLog };
      delete nextLog[entryKey];

      const nextDetails = {
        ...targetTask.details,
        repeatLog: nextLog
      };

      const updatedTasks = updateTaskTree(prevTasks, taskId, { details: nextDetails });

      syncSelectedTask(updatedTasks, taskId);

      try {
        localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
      } catch (error) {
        console.warn('localStorage 配額已滿，無法儲存日誌刪除結果:', error);
      }

      return updatedTasks;
    });
  }, [syncSelectedTask]);

  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(task => task.id)));
    }
  };

  const handleTaskSelect = (taskId) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  // 右鍵選單處理函數
  const handleContextMenu = (e, taskId, taskTitle) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      taskId,
      taskTitle
    });
  };

  const hideContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, taskId: null, taskTitle: '' });
  };

  const handleDeleteTask = (taskId) => {
    // 防止刪除根任務
    if (taskId === 'root') {
      alert('無法刪除根任務');
      hideContextMenu();
      return;
    }
    
    if (window.confirm('確定要刪除這個任務嗎？')) {
      const removeTaskFromTree = (taskList) => {
        return taskList.filter(task => {
          if (task.id === taskId) {
            return false;
          }
          if (task.children) {
            task.children = removeTaskFromTree(task.children);
          }
          return true;
        });
      };

      setTasks(prevTasks => {
        const updatedTasks = removeTaskFromTree(prevTasks);
        
        // 如果刪除的是當前選中的任務，清空選中狀態
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(null);
        } else {
          // 否則同步 selectedTask
          syncSelectedTask(updatedTasks);
        }
        
        try {
        localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
        return updatedTasks;
      });
    }
    hideContextMenu();
  };

  const handleBulkDelete = () => {
    if (selectedTasks.size === 0) return;
    
    // 檢查是否包含根任務
    if (selectedTasks.has('root')) {
      alert('無法刪除根任務');
      return;
    }
    
    if (window.confirm(`確定要刪除選中的 ${selectedTasks.size} 個任務嗎？`)) {
      const removeTasksFromTree = (taskList) => {
        return taskList.filter(task => {
          if (selectedTasks.has(task.id)) {
            return false;
          }
          if (task.children) {
            task.children = removeTasksFromTree(task.children);
          }
          return true;
        });
      };

      setTasks(prevTasks => {
        const updatedTasks = removeTasksFromTree(prevTasks);
        syncSelectedTask(updatedTasks);
        try {
        localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
        return updatedTasks;
      });

      setSelectedTasks(new Set());
    }
  };
  const handleCopyTask = (taskId) => {
    const task = findTaskById(tasks, taskId);
    if (task) {
      const cloneTask = (task) => ({
        ...task,
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        title: task.title + ' (複製)',
        created: Date.now(),
        completed: false,
        children: task.children ? task.children.map(cloneTask) : []
      });

      const newTask = cloneTask(task);
      
      // 找到父任務並添加新任務
      const addTaskToParent = (taskList, parentId) => {
        return taskList.map(task => {
          if (task.id === parentId) {
            return {
              ...task,
              children: [...(task.children || []), newTask]
            };
          }
          if (task.children) {
            return {
              ...task,
              children: addTaskToParent(task.children, parentId)
            };
          }
          return task;
        });
      };

      // 找到原任務的父任務
      const findParentId = (taskList, targetId, parentId = null) => {
        for (const task of taskList) {
          if (task.id === targetId) {
            return parentId;
          }
          if (task.children) {
            const result = findParentId(task.children, targetId, task.id);
            if (result !== null) return result;
          }
        }
        return null;
      };

      const parentId = findParentId(tasks, taskId);
      
      setTasks(prevTasks => {
        const updatedTasks = parentId ? 
          addTaskToParent(prevTasks, parentId) : 
          [...prevTasks, newTask];
        try {
        localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
        return updatedTasks;
      });
    }
    hideContextMenu();
  };

  const handleMoveTask = (taskId) => {
    setMoveTargetTask({ id: taskId, title: contextMenu.taskTitle });
    setShowMoveDialog(true);
    setMoveSearchTerm(''); // 重置搜尋
    hideContextMenu();
  };

  const executeMoveTask = (taskId, newParentId) => {
    try {
      // 檢查是否會造成循環引用
      const wouldCreateCycle = (taskList, targetId, newParentId) => {
        if (targetId === newParentId) return true;
        
        const findTask = (tasks, id) => {
          for (const task of tasks) {
            if (task.id === id) return task;
            if (task.children) {
              const found = findTask(task.children, id);
              if (found) return found;
            }
          }
          return null;
        };

        const targetTask = findTask(taskList, targetId);
        if (!targetTask) return false;

        const checkChildren = (task) => {
          if (task.id === newParentId) return true;
          if (task.children) {
            return task.children.some(checkChildren);
          }
          return false;
        };

        return checkChildren(targetTask);
      };

      if (wouldCreateCycle(tasks, taskId, newParentId)) {
        alert('無法移動：會造成循環引用');
        return;
      }

      // 使用與拖曳相同的邏輯
      setTasks(prevTasks => {
        try {
          // 從原位置移除任務
          const removeResult = removeTaskFromTree(prevTasks, taskId);
          let updatedTasks = removeResult.tasks;
         
          // 檢查是否成功移除
          if (!removeResult.task) {
            console.error('無法移除任務:', taskId);
            return prevTasks; // 返回原狀態
          }
         
          // 獲取新父任務
          const newParent = newParentId === 'root'
            ? { level: 'NONE' }
            : findTaskById(updatedTasks, newParentId);
         
          if (!newParent) {
            console.error('找不到新的父任務:', newParentId);
            return prevTasks;
          }
         
        // 自動調整被移動任務及其子任務的等級
        const targetLevel = newParentId === 'root' ? 'NONE' : newParent.level;
        const updatedTask = adjustTaskLevels(removeResult.task, targetLevel);
       
        // 添加到新位置（等級已在外部調整，因此這裡保持等級不再改變）
        const result = addChildToTask(
          updatedTasks,
          newParentId,
          updatedTask,
          -1,
          { preserveLevel: true }
        );
         
          console.log('移動任務完成');
          syncSelectedTask(result);
          return result;
        } catch (error) {
          console.error('移動任務時發生錯誤:', error);
          return prevTasks; // 發生錯誤時返回原狀態
        }
      });

      setShowMoveDialog(false);
      setMoveTargetTask(null);
      setMoveSearchTerm('');
    } catch (error) {
      alert('移動失敗：' + error.message);
    }
  };

  // 膠囊點擊跳轉功能
  const handleCapsuleNavigation = (capsuleId) => {
    const currentState = getCurrentTaskCapsuleState();
    
    // 檢查這個膠囊是否已生成對應任務
    const taskGroupId = currentState.capsuleTaskMappings && currentState.capsuleTaskMappings[capsuleId];
    if (!taskGroupId) {
      alert('此膠囊尚未生成對應任務，請先點擊生成子任務！');
      return;
    }

    // 找到對應的任務
    const findTaskById = (taskList, id) => {
      for (const task of taskList) {
        if (task.id === id) return task;
        if (task.children) {
          const found = findTaskById(task.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const targetTask = findTaskById(tasks, taskGroupId);
    if (!targetTask) {
      alert('找不到對應的生成任務！');
      return;
    }

    // 跳轉到對應任務
    setSelectedTask(targetTask);
    
    // 確保任務的父級都是展開的
    const parentPath = findParentPath(tasks, taskGroupId);
    if (parentPath) {
      setExpandedItems(prev => new Set([...prev, ...parentPath]));
    }
    
    // 高亮對應的任務群
    handleTaskHighlight(taskGroupId);
  };

  // 智能更新：只更新任務標題，不重新創建
  const updateTaskTitlesOnly = (capsuleId, oldText, newText) => {
    if (!oldText || !newText || oldText === newText) return;
    
    const updateTaskTree = (taskList) => {
      return taskList.map(task => {
        // 更新任務標題中的膠囊內容
        let updatedTask = { ...task };
        if (task.title && task.sourceCapsuleId === capsuleId) {
          // 使用全局替換，確保所有出現的舊文字都被替換
          updatedTask.title = task.title.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newText);
        }
        
        // 遞歸更新子任務
        if (task.children && task.children.length > 0) {
          updatedTask.children = updateTaskTree(task.children);
        }
        
        return updatedTask;
      });
    };

    setTasks(prevTasks => {
      const updatedTasks = updateTaskTree(prevTasks);
      syncSelectedTask(updatedTasks);
      try {
      localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
      return updatedTasks;
    });
  };

  const addCapsule = () => {
    const currentState = getCurrentTaskCapsuleState();
    const newCapsule = {
      id: Date.now().toString(),
      text: '',
      order: currentState.capsules.length
    };
    updateTaskCapsuleState({
      capsules: [...currentState.capsules, newCapsule]
    });
    // 不需要即時更新，因為新膠囊沒有內容
  };

  const updateCapsule = (id, text) => {
    const currentState = getCurrentTaskCapsuleState();
    const oldCapsule = currentState.capsules.find(c => c.id === id);
    
    updateTaskCapsuleState({
      capsules: currentState.capsules.map(capsule => 
        capsule.id === id ? { ...capsule, text } : capsule
      )
    });
    
    // 智能更新：如果膠囊已有對應的生成任務，只更新文字而不重新創建
    if (currentState.allGeneratedTaskIds && currentState.allGeneratedTaskIds.length > 0 && oldCapsule && oldCapsule.text !== text) {
      setTimeout(() => {
        updateTaskTitlesOnly(id, oldCapsule.text, text);
      }, 300); // 延遲一點讓用戶完成輸入
    }
  };

  const removeCapsule = (id) => {
    const currentState = getCurrentTaskCapsuleState();
    
    // 如果這個膠囊已生成任務，顯示確認對話框
    if (currentState.capsuleTaskMappings && currentState.capsuleTaskMappings[id]) {
      setDeletingCapsuleId(id);
      setShowCapsuleDeleteDialog(true);
    } else {
      // 膠囊未生成任務，直接刪除
      updateTaskCapsuleState({
        capsules: currentState.capsules.filter(capsule => capsule.id !== id)
      });
    }
  };

  // 確認刪除膠囊（同時刪除生成的任務）
  const confirmDeleteCapsuleWithTasks = () => {
    const currentState = getCurrentTaskCapsuleState();
    const id = deletingCapsuleId;
    
    if (!id) return;
    
    // 刪除對應的任務群
    removeGeneratedTasksByCapsule(id);
    
    // 更新映射和任務ID列表
    const newMappings = { ...currentState.capsuleTaskMappings };
    delete newMappings[id];
    
    updateTaskCapsuleState({
      capsules: currentState.capsules.filter(capsule => capsule.id !== id),
      capsuleTaskMappings: newMappings,
      allGeneratedTaskIds: currentState.allGeneratedTaskIds.filter(taskId => {
        // 移除與此膠囊相關的所有任務ID
        const findTaskById = (taskList, id) => {
          for (const task of taskList) {
            if (task.id === id) return task;
            if (task.children) {
              const found = findTaskById(task.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const task = findTaskById(tasks, taskId);
        return !(task && task.sourceCapsuleId === id);
      })
    });
    
    setShowCapsuleDeleteDialog(false);
    setDeletingCapsuleId(null);
  };
  // 只刪除膠囊（保留生成的任務）
  const confirmDeleteCapsuleOnly = () => {
    const currentState = getCurrentTaskCapsuleState();
    const id = deletingCapsuleId;
    
    if (!id) return;
    
    // 清除生成任務的 sourceCapsuleId 標記，使其成為獨立任務
    setTasks(prevTasks => {
      const clearCapsuleId = (taskList) => {
        return taskList.map(task => {
          if (task.sourceCapsuleId === id) {
            const { sourceCapsuleId, ...taskWithoutCapsuleId } = task;
            return {
              ...taskWithoutCapsuleId,
              children: task.children ? clearCapsuleId(task.children) : []
            };
          }
          if (task.children) {
            return {
              ...task,
              children: clearCapsuleId(task.children)
            };
          }
          return task;
        });
      };
      
      const updatedTasks = clearCapsuleId(prevTasks);
      syncSelectedTask(updatedTasks);
      try {
      localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
      return updatedTasks;
    });
    
    // 更新膠囊狀態，移除映射但保留任務ID
    const newMappings = { ...currentState.capsuleTaskMappings };
    delete newMappings[id];
    
    updateTaskCapsuleState({
      capsules: currentState.capsules.filter(capsule => capsule.id !== id),
      capsuleTaskMappings: newMappings
      // 保留 allGeneratedTaskIds，不移除任務ID
    });
    
    setShowCapsuleDeleteDialog(false);
    setDeletingCapsuleId(null);
  };

  // 根據膠囊ID刪除對應的生成任務群
  const removeGeneratedTasksByCapsule = (capsuleId) => {
    const removeTaskTree = (taskList) => {
      return taskList.filter(task => {
        // 如果是對應膠囊生成的任務，則刪除
        if (task.sourceCapsuleId === capsuleId) {
          return false;
        }
        // 遞歸處理子任務
        if (task.children) {
          task.children = removeTaskTree(task.children);
        }
        return true;
      });
    };

    setTasks(prevTasks => {
      const updatedTasks = removeTaskTree(prevTasks);
      syncSelectedTask(updatedTasks);
      try {
      localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
      return updatedTasks;
    });
  };

  // 一鍵清除所有生成的任務
  const clearAllGeneratedTasks = () => {
    const currentState = getCurrentTaskCapsuleState();
    if (!currentState.allGeneratedTaskIds || currentState.allGeneratedTaskIds.length === 0) {
      alert('沒有生成的任務需要清除');
      return;
    }

    if (confirm(`確定要清除所有 ${currentState.allGeneratedTaskIds.length} 個生成的任務嗎？此操作無法復原。`)) {
      const removeTaskTree = (taskList) => {
        return taskList.filter(task => {
          // 如果是生成的任務，則刪除
          if (task.isGeneratedTask && task.sourceTaskId === selectedTask.id) {
            return false;
          }
          // 遞歸處理子任務
          if (task.children) {
            task.children = removeTaskTree(task.children);
          }
          return true;
        });
      };

      setTasks(prevTasks => {
        const updatedTasks = removeTaskTree(prevTasks);
        syncSelectedTask(updatedTasks);
        try {
        localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
        return updatedTasks;
      });

      // 清除膠囊狀態中的生成任務記錄
      updateTaskCapsuleState({
        capsuleTaskMappings: {},
        allGeneratedTaskIds: [],
        placeholderTransformed: false
      });

      // 如果有佔位符標題指示器，將其恢復為佔位符
      if (currentState.placeholderTaskId) {
        restorePlaceholder();
      }

      alert('所有生成的任務已清除');
    }
  };

  // 恢復佔位符（從標題指示器恢復為佔位符）
  const restorePlaceholder = () => {
    const currentState = getCurrentTaskCapsuleState();
    if (!currentState.placeholderTaskId) return;

    const restoreTaskTree = (taskList) => {
      return taskList.map(task => {
        if (task.id === currentState.placeholderTaskId && task.isPlaceholderHeader) {
          // 恢復為佔位符
          return {
            ...task,
            title: `此處將插入動態生成的任務，原任務為【${currentState.originalTaskTitle}】`,
            isPlaceholder: true,
            isPlaceholderHeader: false,
            style: {
              color: '#999',
              fontStyle: 'italic',
              backgroundColor: 'rgba(245, 245, 245, 0.5)'
            }
          };
        }
        if (task.children) {
          task.children = restoreTaskTree(task.children);
        }
        return task;
      });
    };

    setTasks(prevTasks => {
      const updatedTasks = restoreTaskTree(prevTasks);
      try {
      localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
      return updatedTasks;
    });
  };
  // 替換模板中的變數
  const replaceTemplateVariables = (template, capsuleText) => {
    const replaceInObject = (obj) => {
      if (typeof obj === 'string') {
        return obj.replace(/\[膠囊內容\]/g, capsuleText);
      } else if (Array.isArray(obj)) {
        return obj.map(replaceInObject);
      } else if (obj && typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
          newObj[key] = replaceInObject(obj[key]);
        }
        return newObj;
      }
      return obj;
    };
    return replaceInObject(template);
  };
  // 創建任務對象
  const createTaskFromTemplate = (template, parentId, order) => {
    const taskId = generateId();
    const task = {
      id: taskId,
      title: template.name,
      level: template.level,
      priority: 'low', // 預設優先級為低
      taskType: 'recurring', // 預設為持續型
      status: 'pending',
      created: new Date().toISOString(),
      details: {
        description: '',
        startDate: '',
        startTime: '',
        dueDate: '',
        dueTime: '',
        reminders: [],
        progress: 0,
        repeat: { ...DEFAULT_REPEAT },
        repeatLog: {}
      },
      children: template.children ? template.children.map((child, idx) => 
        createTaskFromTemplate(child, taskId, idx)
      ) : []
    };
    return task;
  };

  const generateTasksFromCapsules = () => {
    const currentState = getCurrentTaskCapsuleState();
    if (currentState.capsules.length === 0) return;

    // 檢查是否有未生成的膠囊
    const unGeneratedCapsules = currentState.capsules.filter(capsule => 
      capsule.text.trim() && !(currentState.capsuleTaskMappings && currentState.capsuleTaskMappings[capsule.id])
    );

    if (unGeneratedCapsules.length === 0) {
      alert('所有膠囊都已生成對應任務！請使用修改功能或刪除後重新添加。');
      return;
    }

    
    try {
      // 判斷插入模式：佔位符模式 vs 目標父任務模式
      let insertionMode = 'append'; // 'placeholder' or 'append'
      let targetLocation = null;

      if (currentState.placeholderEnabled && currentState.placeholderTaskId) {
        // 佔位符模式：替換佔位符位置
        insertionMode = 'placeholder';
        targetLocation = currentState.placeholderTaskId;
      } else if (currentState.targetParentId) {
        // 傳統模式：添加到目標父任務
        insertionMode = 'append';
        targetLocation = currentState.targetParentId;
      } else {
        alert('請選擇生成位置或啟用佔位符插入！');
        return;
      }

      // 找到目標位置
      const findTaskById = (taskList, id) => {
        for (const task of taskList) {
          if (task.id === id) return task;
          if (task.children) {
            const found = findTaskById(task.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const findTaskParentAndIndex = (taskList, targetId) => {
        for (let i = 0; i < taskList.length; i++) {
          const task = taskList[i];
          if (task.children) {
            for (let j = 0; j < task.children.length; j++) {
              if (task.children[j].id === targetId) {
                return { parent: task, index: j };
              }
            }
            const result = findTaskParentAndIndex(task.children, targetId);
            if (result) return result;
          }
        }
        return null;
      };

      if (insertionMode === 'append') {
        const targetParent = findTaskById(tasks, targetLocation);
        if (!targetParent) {
          alert('找不到目標父任務！');
          return;
        }
      }

      // 確定生成任務的層級
      let targetTaskLevel = 'B'; // 預設層級
      if (insertionMode === 'placeholder') {
        // 佔位符模式：使用佔位符的層級
        const findTaskById = (taskList, id) => {
          for (const task of taskList) {
            if (task.id === id) return task;
            if (task.children) {
              const found = findTaskById(task.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const placeholderTask = findTaskById(tasks, targetLocation);
        if (placeholderTask) {
          targetTaskLevel = placeholderTask.level;
        }
      }


      // 只為未生成的膠囊生成任務
      const newTasks = unGeneratedCapsules.map((capsule, index) => {
        // 檢查是否有自定義模板
        const customTemplate = currentState.capsuleTaskTemplate?.tasks || [];
        let task;
        
        if (customTemplate.length > 0) {
          // 使用自定義模板生成任務
          const convertTemplateToTask = (templateTask, parentId, order) => {
            // 將 nameParts 轉換為任務名稱（替換膠囊佔位符）
            const taskName = (templateTask.nameParts || [])
              .map(part => {
                if (part.type === 'capsule') {
                  return capsule.text.trim();
                }
                return part.content || '';
              })
              .join('');
            
            const taskId = generateId();
            const task = {
              id: taskId,
              title: taskName || '未命名任務',
              level: templateTask.level,
              priority: 'low',
              taskType: 'recurring',
              status: 'pending',
              created: new Date().toISOString(),
              details: {
                description: '',
                startDate: '',
                startTime: '',
                dueDate: '',
                dueTime: '',
                reminders: [],
                progress: 0,
                repeat: { ...DEFAULT_REPEAT },
                repeatLog: {}
              },
              children: (templateTask.children || []).map((child, idx) => 
                convertTemplateToTask(child, taskId, idx)
              )
            };
            
            // 標記為生成的任務
            task.isGeneratedTask = true;
            task.sourceTaskId = selectedTask.id;
            task.sourceCapsuleId = capsule.id;
            
            return task;
          };
          
          // 為每個根任務生成一個任務群（如果有多個根任務，會生成多個任務群）
          // 但根據需求，每個膠囊應該生成一個任務群，所以我們只使用第一個根任務
          if (customTemplate.length > 0) {
            task = convertTemplateToTask(customTemplate[0], targetLocation, index);
          } else {
            // 如果模板為空，提示用戶先設計模板
            alert('請先在「膠囊任務模板設計」中設計任務模板！');
            return null;
          }
        } else {
          // 沒有自定義模板，提示用戶先設計模板
          alert('請先在「膠囊任務模板設計」中設計任務模板！');
          return null;
        }
        
        // 遞歸標記所有生成的任務和子任務
        const markGeneratedTask = (task, capsuleId, sourceTaskId) => {
          task.isGeneratedTask = true;
          task.sourceTaskId = sourceTaskId;
          task.sourceCapsuleId = capsuleId;
          if (task.children) {
            task.children.forEach(child => markGeneratedTask(child, capsuleId, sourceTaskId));
          }
        };
        
        markGeneratedTask(task, capsule.id, selectedTask.id);
        return task;
      });

      if (newTasks.length === 0) {
        alert('請先輸入膠囊內容！');
        return;
      }

      // 更新任務樹 - 支持佔位符轉換和傳統添加
      const updateTaskTree = (taskList) => {
        return taskList.map(task => {
          if (insertionMode === 'placeholder' && task.id === targetLocation) {
            // 佔位符模式：將佔位符轉換為標題指示器，並在其下方添加生成的任務
            const transformedPlaceholder = {
              ...task,
              title: currentState.originalTaskTitle || '執行深度整理（重複進行，直到所有區域完成）',
              isPlaceholder: false,
              isPlaceholderHeader: true, // 新的標記：佔位符標題
              style: {
                color: '#999',
                fontSize: '14px',
                fontWeight: 'normal',
                backgroundColor: 'transparent'
              }
            };
            // 返回標題指示器和生成的任務
            return [transformedPlaceholder, ...newTasks];
          } else if (insertionMode === 'append' && task.id === targetLocation) {
            // 傳統模式：添加到目標父任務
            return {
              ...task,
              children: [...(task.children || []), ...newTasks]
            };
          } else if (task.children) {
            const updatedChildren = updateTaskTree(task.children);
            // 處理佔位符轉換的情況，可能返回數組而不是單個任務
            const flattenedChildren = updatedChildren.flat();
            return {
              ...task,
              children: flattenedChildren
            };
          }
          return task;
        });
      };

      const updatedTasks = updateTaskTree(tasks);
      setTasks(updatedTasks);
      syncSelectedTask(updatedTasks);
      try {
      localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }

      // 建立膠囊與任務群的一對一映射
      const newCapsuleTaskMappings = { ...(currentState.capsuleTaskMappings || {}) };
      const newAllGeneratedTaskIds = [...currentState.allGeneratedTaskIds];

      unGeneratedCapsules.forEach((capsule, index) => {
        const taskGroup = newTasks[index];
        if (taskGroup) {
          // 記錄膠囊 -> 任務群的映射
          newCapsuleTaskMappings[capsule.id] = taskGroup.id;
          
          // 收集這個任務群的所有任務ID（包括子任務）
          const collectTaskIds = (task) => {
            newAllGeneratedTaskIds.push(task.id);
            if (task.children) {
              task.children.forEach(collectTaskIds);
            }
          };
          collectTaskIds(taskGroup);
        }
      });


      // 一次性更新所有狀態
      const stateUpdates = {
        capsuleTaskMappings: newCapsuleTaskMappings,
        allGeneratedTaskIds: newAllGeneratedTaskIds
      };

      // 佔位符模式：添加佔位符狀態更新
      if (insertionMode === 'placeholder') {
        stateUpdates.placeholderTransformed = true;
      }

      updateTaskCapsuleState(stateUpdates);


      alert(`成功生成 ${newTasks.length} 個任務！${insertionMode === 'placeholder' ? '（已替換佔位符）' : ''}`);
      
    } catch (error) {
      console.error('任務生成失敗:', error);
      alert('任務生成失敗，請檢查控制台錯誤信息。');
    }
  };

  // 刪除已生成的任務
  const removeGeneratedTasks = (generatedTaskIds) => {
    if (!generatedTaskIds || generatedTaskIds.length === 0) return tasks;

    const removeTasksFromTree = (taskList) => {
      return taskList
        .filter(task => !generatedTaskIds.includes(task.id))
        .map(task => ({
          ...task,
          children: task.children ? removeTasksFromTree(task.children) : []
        }));
    };

    return removeTasksFromTree(tasks);
  };

  // 即時更新任務（當膠囊變化時）
  const updateGeneratedTasks = useCallback(debounce(() => {
    const currentState = getCurrentTaskCapsuleState();
    if (!currentState.generatedTasks || currentState.generatedTasks.length === 0) {
      return;
    }

    try {
      // 先刪除舊的任務
      const tasksAfterRemoval = removeGeneratedTasks(currentState.generatedTasks);
      
      // 清空已生成任務記錄
      updateTaskCapsuleState({ generatedTasks: [] });
      
      // 暫時更新任務列表
      setTasks(tasksAfterRemoval);
      
      // 重新生成任務
      setTimeout(() => {
        generateTasksFromCapsules();
      }, 100);
      
    } catch (error) {
      console.error('即時更新失敗:', error);
    }
  }, 500), [tasks, taskCapsuleStates]); // 500ms防抖

  // 標題編輯函數
  const startEditCapsuleTitle = () => {
    const currentState = getCurrentTaskCapsuleState();
    setEditingCapsuleTitle(selectedTask.id);
    setCapsuleTitleText(currentState.title);
  };

  const saveCapsuleTitle = () => {
    updateTaskCapsuleState({ title: capsuleTitleText });
    setEditingCapsuleTitle(null);
    setCapsuleTitleText('');
  };

  const cancelEditCapsuleTitle = () => {
    setEditingCapsuleTitle(null);
    setCapsuleTitleText('');
  };

  const handleCapsuleTitleKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveCapsuleTitle();
    } else if (e.key === 'Escape') {
      cancelEditCapsuleTitle();
    }
  };

  // 動態任務模板系統 - 根據目標層級調整
  // 已移除預設測試任務模板
  // 現在使用膠囊任務模板設計功能來定義任務結構

  // 膠囊內容編輯函數
  const startEditCapsule = (capsuleId, currentText) => {
    setEditingCapsuleId(capsuleId);
    setEditingCapsuleText(currentText);
  };

  const saveCapsuleEdit = () => {
    if (editingCapsuleId && editingCapsuleText.trim()) {
      updateCapsule(editingCapsuleId, editingCapsuleText.trim());
    }
    setEditingCapsuleId(null);
    setEditingCapsuleText('');
  };

  const cancelCapsuleEdit = () => {
    setEditingCapsuleId(null);
    setEditingCapsuleText('');
  };

  const handleCapsuleKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveCapsuleEdit();
    } else if (e.key === 'Escape') {
      cancelCapsuleEdit();
    }
  };

  // 檢查移動的等級規則是否合法
  const isValidMove = (parentLevel, childLevel) => {
    if (parentLevel === 'NONE') return true; // 可以將任務移動到根級別
    if (LEVEL_MAP[parentLevel]?.next === childLevel) return true; // 子任務等級是父任務的下一級
    return false;
  };

  // 根據父任務的等級調整當前任務及其子任務等級
  const adjustTaskLevels = (task, parentLevel) => {
    if (!task) return null;
   
    // 決定新的等級
    let newLevel = 'NONE';
    if (parentLevel === 'NONE') {
      // 移動到根級別的任務設為A級
      newLevel = 'A';
    } else {
      // 否則設為父任務的下一級
      newLevel = LEVEL_MAP[parentLevel]?.next || getExtendedLevel(parentLevel);
    }  

    // 遞歸調整所有子任務的等級
    let adjustedChildren = [];
    if (task.children && task.children.length > 0) {
      adjustedChildren = task.children.map(child =>
        // 將新的等級作為父等級傳遞給子任務
        adjustTaskLevels(child, newLevel)
      );
    }

    return {
      ...task,
      level: newLevel,
      children: adjustedChildren
    };
  };
 
  // 當超出A-Z範圍時，生成擴展等級 (如AA, AB...)
  const getExtendedLevel = (parentLevel) => {
    // 如果是單個字母等級，繼續向後擴展
    if (parentLevel.length === 1) {
      return 'Z' === parentLevel ? 'AA' : String.fromCharCode(parentLevel.charCodeAt(0) + 1);
    }
   
    // 如果已經是多字母等級 (如AA, AB...)
    const lastChar = parentLevel.charAt(parentLevel.length - 1);
    const prefix = parentLevel.slice(0, -1);
   
    if (lastChar === 'Z') {
      // 處理進位 (如AZ -> BA)
      return getExtendedLevel(prefix) + 'A';
    } else {
      // 簡單遞增最後一個字母 (如AA -> AB)
      return prefix + String.fromCharCode(lastChar.charCodeAt(0) + 1);
    }
  };
  // 遞歸添加子任務
  // options:
  //   - preserveLevel: true 時，不在此函數內調整 newChild 的等級
  const addChildToTask = (tasks, parentId, newChild, index = -1, options = {}) => {
    const { preserveLevel = false } = options;

    return tasks.map(task => {
      if (task.id === parentId) {
        // 如果父任務是未分類(NONE)，則自動升級為A級
        let updatedTask = { ...task };
        if (task.level === 'NONE' && parentId !== 'root') {
          updatedTask.level = 'A';
        }
       
        const children = Array.isArray(updatedTask.children) ? [...updatedTask.children] : [];

        // 決定要插入的子任務：
        // - preserveLevel 為 true：直接使用傳入的 newChild（等級在外部已處理或需維持不變）
        // - 否則：依照父任務等級，自動計算下一級（包含其子孫）
        let adjustedChild;
        if (preserveLevel) {
          adjustedChild = newChild;
        } else {
          const parentLevelForChild = parentId === 'root' ? 'NONE' : updatedTask.level;
          adjustedChild = adjustTaskLevels(newChild, parentLevelForChild);
        }
       
        // 添加到指定位置或末尾
        if (index >= 0) {
          children.splice(index, 0, adjustedChild);
        } else {
          children.push(adjustedChild);
        }
       
        // 重新計算父任務的進度
        const updatedTaskWithChildren = {
          ...updatedTask,
          children
        };
        const progress = calculateTaskProgress(updatedTaskWithChildren);
        
        // 如果有未完成的子任務，父任務狀態應該是未完成
        const hasIncompleteChildren = children.some(child => child.status !== 'completed');
        const newStatus = hasIncompleteChildren ? 'pending' : updatedTaskWithChildren.status;
        
        return {
          ...updatedTaskWithChildren,
          status: newStatus,
          details: {
            ...updatedTaskWithChildren.details,
            progress
          }
        };
      }
     
      if (task.children?.length > 0) {
        const updatedChildren = addChildToTask(task.children, parentId, newChild, index, options);
        // 重新計算當前任務的進度
        const updatedTask = {
          ...task,
          children: updatedChildren
        };
        const progress = calculateTaskProgress(updatedTask);
        
        // 如果有未完成的子任務，父任務狀態應該是未完成
        const hasIncompleteChildren = updatedChildren.some(child => child.status !== 'completed');
        const newStatus = hasIncompleteChildren ? 'pending' : updatedTask.status;
        
        return {
          ...updatedTask,
          status: newStatus,
          details: {
            ...updatedTask.details,
            progress
          }
        };
      }
     
      return task;
    });
  };

  // 處理新增任務
  const handleAddTask = () => {
    if (!newTask.title.trim()) {
      alert('請輸入任務標題');
      return;
    }
  
    const newItem = {
      id: Date.now().toString(),
      title: newTask.title.trim(),
      description: newTask.description || '',
      level: newTask.level || 'NONE',
      priority: 'low', // 預設優先級為低
      taskType: 'recurring', // 預設為持續型
      children: [],
      created: new Date().toISOString(),
      status: 'pending',
      details: {
        startDate: null,
        dueDate: null,
        reminders: [],
        reminderDays: null,
        location: null,
        notes: '',
        links: [],
        cheerUpItems: [],
        cheerUpProgress: 0,
        progress: 0,
        repeat: { ...DEFAULT_REPEAT },
        repeatLog: {}
      }
    };
  
    console.log('準備添加新任務:', newItem);
 
    setTasks(prevTasks => {
      // 如果選擇了特定的父任務
      if (selectedParent && selectedParent !== 'root') {
        // 找到父任務
        const parentTask = findTaskById(prevTasks, selectedParent);
        if (!parentTask) return prevTasks;
       
        // 自動調整等級
        if (newItem.level === 'NONE') {
          newItem.level = getChildLevel(parentTask.level);
        }
       
        // 添加為子任務
        return addChildToTask(prevTasks, selectedParent, newItem);
      } else {
        // 添加到根任務下
        if (newItem.level === 'NONE') {
          newItem.level = 'A'; // 頂層任務默認為A級
        }
       
        return prevTasks.map(task => {
          if (task.id === 'root') {
            return {
              ...task,
              children: [...task.children, newItem]
            };
          }
          return task;
        });
      }
    });
 
    setShowAddModal(false);
    setSelectedParent(null);
    setNewTask({ title: '', description: '', level: 'NONE' });
   
    // 確保展開新任務的父節點
    if (selectedParent) {
      setExpandedItems(prev => new Set([...prev, selectedParent]));
    }
  };

  // 處理任務點擊
  const handleTaskClick = (task, e) => {
    // 處理任務關聯高亮
    handleTaskHighlight(task.id);
    
    setSelectedTask(task);
    setIsEditing(false);
  };

  // 處理編輯點擊
  const handleEditClick = (task) => {
    const parentId = findParentId(tasks, task.id);
   
    setIsEditing(true);
    setEditingTask({
      ...task,
      parentId: parentId // 獲取當前父任務ID
    });
  };
  // 任務拖曳狀態
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragTarget, setDragTarget] = useState(null); // 新增：記錄瞄準位置

  // 1. 抽離任務的純視覺內容 (UI 外殼)
  const renderTaskVisual = (task, isStatic = false) => (
    <div 
      className={`project-item-header ${task.status === 'completed' ? 'completed' : ''} ${selectedTask?.id === task.id ? 'selected' : ''} ${isStatic ? 'is-static-copy' : ''}`}
      onClick={(e) => !isStatic && handleTaskClick(task, e)}
    >
      <div className="task-info-left">
        <IoChevronDown 
          className={`expand-icon ${expandedItems.has(task.id) ? 'expanded' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isStatic) toggleExpand(task.id);
          }}
        />
        <span className={`level-badge level-${String(task.level).toLowerCase()}`}>{task.level}</span>
        <span className="project-title">{task.title}</span>
      </div>

      <div className="task-actions-right">
        {task.children && task.children.length > 0 && (
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${task.details?.progress || 0}%` }} />
          </div>
        )}
        {!isStatic && (
          <button 
            className="add-subtask-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedParent(task.id);
              setShowAddModal(true);
            }}
            title="新增子任務"
          >
            <IoAdd />
          </button>
        )}
      </div>
    </div>
  );

  // 2. 處理拖曳開始
  const handleDragStart = (start) => {
    document.body.classList.add('is-dragging-task');
    const taskId = start.draggableId;
    setDraggedTaskId(taskId);
    setDragTarget({
      droppableId: start.source.droppableId,
      index: start.source.index,
      source: start.source // 記錄起點
    });

    // 【新增】拖曳開始時，自動收起該任務群組
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      }
      return next;
    });
  };

  // 2.1 處理拖曳中位置更新
  const handleDragUpdate = (update) => {
    if (update.destination) {
      setDragTarget({
        droppableId: update.destination.droppableId,
        index: update.destination.index,
        source: update.source // 持續傳遞起點
      });
    } else {
      setDragTarget(null);
    }
  };

  // 3. 處理拖曳結束
  const handleDragEnd = (result) => {
    document.body.classList.remove('is-dragging-task');
    setDraggedTaskId(null);
    setDragTarget(null); // 清除

    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setTasks(prevTasks => {
      try {
        const { tasks: tasksAfterRemove, task: draggedTask } = removeTaskFromTree(prevTasks, draggableId);
        if (!draggedTask) return prevTasks;

        const sameParent = source.droppableId === destination.droppableId;
        const result = addChildToTask(tasksAfterRemove, destination.droppableId, draggedTask, destination.index, { preserveLevel: sameParent });
        
        syncSelectedTask(result);
        return result;
      } catch (error) {
        console.error('拖曳更新失敗:', error);
        return prevTasks;
      }
    });
  };

  // 更新任務等級
  const updateTaskLevel = (tasks, taskId, newLevel) => {
    return tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          level: newLevel
        };
      }
      if (task.children && task.children.length > 0) {
        return {
          ...task,
          children: updateTaskLevel(task.children, taskId, newLevel)
        };
      }
      return task;
    });
  };
// 處理任務編輯更新
const handleEditTaskUpdate = () => {
  if (!editingTask.title.trim()) {
    alert('請輸入任務標題');
    return;
  }

  setTasks(prevTasks => {
    // 找到當前任務及其完整信息
    const currentTask = findTaskById(prevTasks, editingTask.id);
    if (!currentTask) return prevTasks;

    // 獲取當前父任務ID和新的父任務ID
    const oldParentId = findParentId(prevTasks, editingTask.id);
    const newParentId = editingTask.parentId;
   
    // 如果父任務沒有改變，但等級可能改變
    if (oldParentId === newParentId) {
      const updateTaskAndChildren = (items) => {
        return items.map(item => {
          if (item.id === editingTask.id) {
            // 調整當前任務及其所有子任務的等級
            return adjustTaskLevels({
              ...item,
              title: editingTask.title,
              description: editingTask.description,
              level: editingTask.level
            }, LEVEL_MAP[editingTask.level]?.prev || 'NONE');
          }
          if (item.children?.length > 0) {
            return {
              ...item,
              children: updateTaskAndChildren(item.children)
            };
          }
          return item;
        });
      };
     
      return updateTaskAndChildren(prevTasks);
    }
   
    // 如果父任務改變，需要移動任務
    // 1. 從原位置移除任務
    const removeResult = removeTaskFromTree(prevTasks, editingTask.id);
   
    // 2. 獲取新父任務
    let updatedTasks = removeResult.tasks;
    const newParent = newParentId === 'root'
      ? { level: 'NONE' }
      : findTaskById(updatedTasks, newParentId);
   
    if (!newParent) return prevTasks;
   
    // 如果新父任務是NONE，則自動升級為A級
    if (newParent.level === 'NONE' && newParentId !== 'root') {
      updatedTasks = updateTaskLevel(updatedTasks, newParentId, 'A');
    }
   
    // 3. 準備要移動的任務
    const taskToMove = {
      ...currentTask,
      title: editingTask.title,
      description: editingTask.description
    };
   
    // 4. 調整任務及其子任務的等級
    const adjustedTask = adjustTaskLevels(taskToMove, newParent.level);
   
    // 5. 添加到新位置（等級已在外部調整，因此這裡保持等級不再改變）
    return addChildToTask(updatedTasks, newParentId, adjustedTask, -1, { preserveLevel: true });
  });

  // 更新 UI 狀態
  setSelectedTask(null); // 先清空選中狀態
  setIsEditing(false);
 
  // 重新選中更新後的任務
  setTimeout(() => {
    const updatedTask = findTaskById(tasks, editingTask.id);
    if (updatedTask) {
      setSelectedTask(updatedTask);
    }
  }, 0);

  // 如果有父任務，確保它是展開的
  if (editingTask.parentId) {
    setExpandedItems(prev => new Set([...prev, editingTask.parentId]));
  }
};

// 處理日期時間變更
const handleDateTimeChange = (taskId, newDate) => {
  setTasks(prevTasks => {
    const newTasks = updateTaskDetails(prevTasks, taskId, 'dueDate', newDate);
    // 如果更新的是當前選中的任務，同時更新 selectedTask
    if (selectedTask?.id === taskId) {
      const updatedTask = findTaskById(newTasks, taskId);
      setSelectedTask(updatedTask);
    }
    return newTasks;
  });
};


// 通用任務屬性更新輔助函數
const updateTaskDetails = (tasks, taskId, field, value) => {
  return tasks.map(task => {
    if (task.id === taskId) {
      if (field === 'icon') {
        // 直接在任務對象上更新圖標
        return {
          ...task,
          icon: value
        };
      } else {
        // 其他欄位更新到 details 中
        return {
          ...task,
          details: {
            ...task.details,
            [field]: value
          }
        };
      }
    }
    if (task.children?.length > 0) {
      return {
        ...task,
        children: updateTaskDetails(task.children, taskId, field, value)
      };
    }
    return task;
  });
};

// 處理任務刪除
const handleTaskDelete = (taskId) => {
  if (!window.confirm('確定要刪除此任務嗎？子任務也將一併刪除。')) return;
 
  const removeResult = removeTaskFromTree(tasks, taskId);
  setTasks(removeResult.tasks);
  setSelectedTask(null);
};

// 檢查是否為子任務
const isChildTask = (parent, taskId) => {
  if (!parent.children) return false;
  if (parent.children.some(child => child.id === taskId)) return true;
  return parent.children.some(child => isChildTask(child, taskId));
};

// 添加 findTaskById 輔助函數
const findTaskById = (tasks, taskId) => {
  for (const task of tasks) {
    if (task.id === taskId) {
      return task;
    }
    if (task.children && task.children.length > 0) {
      const found = findTaskById(task.children, taskId);
      if (found) return found;
    }
  }
  return null;
};

// 查找父任務ID的輔助函數
const findParentId = (items, taskId, parentId = null) => {
  for (const item of items) {
    if (item.children && item.children.some(child => child.id === taskId)) {
      return item.id;
    }
    if (item.children && item.children.length > 0) {
      const found = findParentId(item.children, taskId, item.id);
      if (found) return found;
    }
  }
  return parentId;
};
// 從任務樹中移除任務的輔助函數
const removeTaskFromTree = (tasks, taskId) => {
  let removedTask = null;
 
  const removeTask = (items) => {
    if (!Array.isArray(items)) return [];
   
    const index = items.findIndex(item => item.id === taskId);
    if (index !== -1) {
      removedTask = {...items[index]};
      return items.filter(item => item.id !== taskId);
    }
   
    return items.map(item => {
      if (item.children && item.children.length > 0) {
        const updatedChildren = removeTask(item.children);
        
        // 如果子任務有變化，重新計算進度和狀態
        if (updatedChildren.length !== item.children.length) {
          const progress = calculateTaskProgress({ ...item, children: updatedChildren });
          const hasIncompleteChildren = updatedChildren.some(child => child.status !== 'completed');
          const newStatus = hasIncompleteChildren ? 'pending' : (updatedChildren.length === 0 ? item.status : 'completed');
          
          return {
            ...item,
            children: updatedChildren,
            status: newStatus,
            details: {
              ...item.details,
              progress
            }
          };
        }
        
        return {
          ...item,
          children: updatedChildren
        };
      }
      return item;
    });
  };
 
  const newTasks = removeTask([...tasks]);
 
  return {
    tasks: newTasks,
    task: removedTask
  };
};

// 獲取所有可能的父任務
const getAvailableParents = () => {
  const parents = [];
 
  const findPotentialParents = (items, level = 0, path = []) => {
    items.forEach(item => {
      // 排除當前編輯的任務及其子任務
      if (editingTask && (item.id === editingTask.id || isChildTask(item, editingTask.id))) {
        return;
      }
     
      const itemPath = [...path, item.title];
      const displayTitle = itemPath.join(' > ');
     
      parents.push({
        id: item.id,
        title: '　'.repeat(level) + item.title,
        fullPath: displayTitle,
        level: item.level
      });
     
      if (item.children && item.children.length > 0) {
        findPotentialParents(item.children, level + 1, itemPath);
      }
    });
  };

  // 添加根級別
  parents.push({
    id: 'root',
    title: '頂層',
    fullPath: '頂層',
    level: 'NONE'
  });
 
  // 查找所有任務
  findPotentialParents(tasks[0].children);
 
  return parents;
};

// 修改 handleStatusChange，只更新受影響的任務分支
const handleStatusChange = (taskId, newStatus) => {
  const targetStatus = newStatus === 'completed' ? 'completed' : 'pending';
  setTasks(prevTasks => {
    // 更新目標任務及其所有子任務的狀態和進度
    const updateTaskAndChildrenStatus = (task, newStatus) => {
      const normalizedStatus = newStatus === 'completed' ? 'completed' : 'pending';
      const updatedTask = {
        ...task,
        status: normalizedStatus,
        completed: normalizedStatus === 'completed', // 同步更新 completed 字段
        children: task.children?.map(child =>
          updateTaskAndChildrenStatus(child, normalizedStatus)
        ) || []
      };
      
      // 重新計算進度
      const progress = calculateTaskProgress(updatedTask);
      
      const taskWithProgress = {
        ...updatedTask,
        details: {
          ...updatedTask.details,
          progress
        }
      };

      // 如果任務啟用了重複，立即更新當前窗口的日誌
      return updateCurrentWindowLog(taskWithProgress);
    };
    
    // 遞歸更新任務樹，只更新包含目標任務的分支
    const updateTaskStatus = (items, targetId) => {
      return items.map(item => {
        // 找到目標任務
        if (item.id === targetId) {
          // updateTaskAndChildrenStatus 已經計算過進度並更新日誌，直接返回
          return updateTaskAndChildrenStatus(item, targetStatus);
        }
        
        // 檢查子任務中是否包含目標任務
        if (item.children && item.children.length > 0) {
          const hasTarget = findTaskById(item.children, targetId);
          if (hasTarget) {
            // 只更新包含目標的分支
            const updatedChildren = updateTaskStatus(item.children, targetId);
            const progress = calculateTaskProgress({ ...item, children: updatedChildren });
            
            // 如果有未完成的子任務，父任務狀態應該是未完成
            const hasIncompleteChildren = updatedChildren.some(child => child.status !== 'completed');
            const parentStatus = hasIncompleteChildren ? 'pending' : 'completed';
            
            const parentWithProgress = {
              ...item,
              children: updatedChildren,
              status: parentStatus,
              completed: parentStatus === 'completed',
              details: {
                ...item.details,
                progress
              }
            };

            // 如果父任務啟用了重複，也更新日誌
            return updateCurrentWindowLog(parentWithProgress);
          }
        }
        
        // 其他任務保持不變
        return item;
      });
    };
    
    const newTasks = updateTaskStatus(prevTasks, taskId);
    // 明確傳遞 taskId，確保同步正確的任務
    syncSelectedTask(newTasks, taskId);
    
    // 保存到 localStorage
    try {
      localStorage.setItem('projectTasks', JSON.stringify(newTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
    
    return newTasks;
  });
};

  // 渲染單個任務項目
  const renderTaskItem = (task, index, parentId) => {
    if (!task || task.isHidden) return null;

    return (
      <Draggable key={task.id} draggableId={String(task.id)} index={index}>
          {(provided, snapshot) => {
            // 計算邊框類名
            let targetClass = '';
            
            if (dragTarget && String(dragTarget.droppableId) === String(parentId)) {
              // 排除掉正在拖曳的那個幻影本身
              if (draggedTaskId !== String(task.id)) {
                // 判斷是否為同列表移動
                const isSameList = dragTarget.source && String(dragTarget.source.droppableId) === String(dragTarget.droppableId);
                
                if (isSameList) {
                  // 同列表移動：dnd 的 index 會因為「挖洞」而偏移，需要補償
                  const sourceIndex = dragTarget.source.index;
                  const destIndex = dragTarget.index;
                  
                  // 如果目標位置在起點之前，則 targetIndex 就是 destIndex
                  // 如果目標位置在起點之後，則 targetIndex 需要加 1（因為起點那個洞被補上了）
                  const realTargetIndex = destIndex <= sourceIndex ? destIndex : destIndex;
                  
                  // 注意：在同列表且 destination.index > source.index 時，
                  // dnd 實際上是想把項目放在目標項目的「後面」。
                  if (destIndex === index) {
                    targetClass = destIndex <= sourceIndex ? 'drop-target-top' : 'drop-target-bottom';
                  }
                } else {
                  // 跨列表移動：簡單匹配
                  if (dragTarget.index === index) {
                    targetClass = 'drop-target-top';
                  } else {
                    // 處理列表末尾
                    const children = parentId === 'root' ? tasks[0]?.children : findTaskById(tasks, parentId)?.children;
                    const filteredChildren = children?.filter(c => !c.isHidden) || [];
                    if (index === filteredChildren.length - 1 && dragTarget.index === filteredChildren.length) {
                      targetClass = 'drop-target-bottom';
                    }
                  }
                }
              }
            }

          return (
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              className={`project-item ${snapshot.isDragging ? 'is-phantom' : ''} ${targetClass}`}
              style={{
                ...provided.draggableProps.style,
                // 只有正在拖曳的幻影才允許 transform，其餘全部鎖死
                transform: snapshot.isDragging ? provided.draggableProps.style.transform : 'none'
              }}
            >
              <div {...provided.dragHandleProps}>
                {renderTaskVisual(task)}
              </div>

              {/* 子任務區域 - 只有當不是正在被拖曳的幻影時才顯示 */}
              {!snapshot.isDragging && (
                <div className={`project-subitems ${expandedItems.has(task.id) ? '' : 'hidden'}`}>
                  <Droppable droppableId={String(task.id)} type="DEFAULT">
                    {(listProvided, listSnapshot) => (
                      <div
                        ref={listProvided.innerRef}
                        {...listProvided.droppableProps}
                        className={`droppable-area ${listSnapshot.isDraggingOver ? 'is-dragging-over' : ''}`}
                      >
                        {task.children && task.children.length > 0 && task.children
                          .filter(child => !child.isHidden)
                          .map((child, idx) => renderTaskItem(child, idx, task.id))}
                        {listProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )}
            </div>
          );
        }}
      </Draggable>
    );
  };


return (
  <DragDropContext 
    onDragStart={handleDragStart} 
    onDragUpdate={handleDragUpdate} 
    onDragEnd={handleDragEnd}
  >
    <div className="project-container project-list-container">
      <div className="project-sidebar">
        <div className="project-header">
          <h2>ABCD任務系統</h2>
          <div className="header-buttons">
          <button
            className="add-project-btn"
            onClick={() => {
              setSelectedParent('root');
              setShowAddModal(true);
            }}
          >
            <IoAdd />
            新增任務
          </button>
            <button
              className="template-btn"
              onClick={() => setShowTemplateModal(true)}
            >
              <FaTasks />
              任務模板
          </button>
          </div>
        </div>
       
        <div className="project-tree">
          <Droppable droppableId="root" type="DEFAULT">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`root-droppable ${snapshot.isDraggingOver ? 'droppable-hover' : ''}`}
              >
                {tasks[0]?.children
                  ?.filter(task => !task.isHidden)
                  .map((task, index) => renderTaskItem(task, index, 'root'))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>

      <div 
        className="project-content"
        onClick={(e) => {
          // 點擊任何位置清除高亮和右鍵選單
          setHighlightedTasks(new Set());
          setHighlightedOriginalTask(null);
          hideContextMenu();
        }}
      >
        {!selectedTask && (
          <div className="project-welcome">
            <h2>歡迎使用ABCD任務系統</h2>
            <p>選擇左側任務或創建新任務來開始</p>
            <div className="level-guide">
              <h3>等級說明：</h3>
              <ul>
                <li><span className="level-badge level-a">A</span> A級任務 (頂層任務)</li>
                <li><span className="level-badge level-b">B</span> B級任務 (A的子任務)</li>
                <li><span className="level-badge level-c">C</span> C級任務 (B的子任務)</li>
                <li><span className="level-badge level-d">D</span> D級任務 (C的子任務)</li>
                <li><span className="level-badge level-none">NONE</span> 未分類任務</li>
              </ul>
            </div>
          </div>
        )}

        {selectedTask && !isEditing && (
          <div className={`task-details-container ${isLayoutEditing ? 'editing-mode' : ''}`}>
            {/* 介面布局控制按鈕 */}
            <div className="layout-control">
              <button 
                className={`layout-edit-btn ${isLayoutEditing ? 'active' : ''}`}
                onClick={() => setIsLayoutEditing(!isLayoutEditing)}
                title={isLayoutEditing ? '退出編輯模式' : '介面布局'}
              >
                {isLayoutEditing ? '🔒 退出編輯' : '🎨 介面布局'}
              </button>
            </div>

            {/* 主要內容布局 */}
            <div className="task-content-layout">
              {/* 左側任務詳細內容（紫框區域） */}
          <div className="task-details">
            {/* 標籤切換 */}
            <div className="task-tabs">
              <button 
                className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                任務詳細
              </button>
              <button 
                className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                任務概覽
              </button>
              <button 
                className={`tab-button ${activeTab === 'tags' ? 'active' : ''}`}
                onClick={() => setActiveTab('tags')}
              >
                任務屬性
              </button>
              <button 
                className={`tab-button ${activeTab === 'gantt' ? 'active' : ''}`}
                onClick={() => setActiveTab('gantt')}
              >
                甘特圖
              </button>
              <button 
                className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendar')}
              >
                日曆
              </button>
            </div>

            {/* 標籤內容 */}
            {activeTab === 'details' && (
              <>
                {/* 可拖拽的任務標題區域 */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="task-header">
            <div className="task-details-header">
              <div className="task-title-section">
                {/* 回到原任務連結 - 僅在生成任務時顯示 */}
                {isGeneratedTask(selectedTask.id) && (
                  <div className="back-to-original-link">
                    <span 
                      className="back-link-text"
                      onClick={() => handleBackToOriginalTask(selectedTask.id)}
                    >
                      ← 回到原任務
                    </span>
                  </div>
                )}
                
                <span className={`level-badge level-${String(selectedTask.levelType || selectedTask.level).toLowerCase()}`}>
                  {selectedTask.levelType || selectedTask.level}
                </span>
                {editingTaskId === selectedTask.id ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyPress={handleEditKeyPress}
                    onBlur={saveEditTask}
                    className="task-title-edit"
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('右邊點擊事件觸發:', selectedTask.id, selectedTask.title);
                      startEditTask(selectedTask.id, selectedTask.title);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {selectedTask.title}
                  </h2>
                )}
              </div>
              <div className="task-actions">
                <IconSelector
                  currentIcon={selectedTask.icon}
                  onIconChange={(newIcon) => {
                    handleTaskDetailUpdate(selectedTask.id, 'icon', newIcon);
                  }}
                />
                <button
                  className="action-btn delete-btn"
                  data-tooltip="刪除任務"
                  onClick={() => handleTaskDelete(selectedTask.id)}
                >
                  <BsTrash />
                </button>
              </div>
              </div>
            </div>

                {/* 任務屬性區域（層級、優先級、標籤、任務類型） */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="task-properties">
                  <div className="task-properties-section" style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>任務類型：</label>
                        <select
                          value={selectedTask.taskType || 'recurring'}
                          onChange={(e) => {
                            const newTaskType = e.target.value;
                            setTasks(prevTasks => {
                              const updatedTasks = updateTaskTree(prevTasks, selectedTask.id, {
                                taskType: newTaskType
                              });
                              syncSelectedTask(updatedTasks, selectedTask?.id);
                              try {
                                localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
                              } catch (error) {
                                console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                              }
                              return updatedTasks;
                            });
                          }}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #E8EDF2',
                            borderRadius: '4px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            backgroundColor: 'white',
                            minWidth: '120px'
                          }}
                        >
                          <option value="recurring">持續型</option>
                          <option value="one-time">一次性</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>屬性：</label>
                        <div className="tag-dropdown-container" style={{ position: 'relative', minWidth: '150px' }}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagDropdownOpen(tagDropdownOpen === 'detail' ? null : 'detail');
                            }}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #E8EDF2',
                              borderRadius: '4px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              backgroundColor: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px'
                            }}
                          >
                            <span style={{ flex: 1, textAlign: 'left' }}>
                              {selectedTask.tagId ? taskTags.find(t => t.id === selectedTask.tagId)?.name || '無屬性' : '無屬性'}
                            </span>
                            {selectedTask.tagId && (
                              <div
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '3px',
                                  background: getTagColor(selectedTask.tagId) || '#E0E0E0',
                                  border: '1px solid #ddd',
                                  flexShrink: 0
                                }}
                              />
                            )}
                            <span style={{ fontSize: '10px', color: '#999' }}>▼</span>
                          </div>
                          {tagDropdownOpen === 'detail' && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '4px',
                                background: 'white',
                                border: '1px solid #E8EDF2',
                                borderRadius: '4px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                zIndex: 1000,
                                maxHeight: '200px',
                                overflowY: 'auto'
                              }}
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newTagId = null;
                                  setTasks(prevTasks => {
                                    const updatedTasks = updateTaskTree(prevTasks, selectedTask.id, {
                                      tagId: newTagId
                                    });
                                    syncSelectedTask(updatedTasks, selectedTask?.id);
                                    try {
                                      localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
                                    } catch (error) {
                                      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                                    }
                                    return updatedTasks;
                                  });
                                  setTagDropdownOpen(null);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '14px'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                              >
                                <span>無屬性</span>
                              </div>
                              {taskTags.map(tag => (
                                <div
                                  key={tag.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newTagId = tag.id;
                                    setTasks(prevTasks => {
                                      const updatedTasks = updateTaskTree(prevTasks, selectedTask.id, {
                                        tagId: newTagId
                                      });
                                      // 如果子任務沒有標籤，則繼承母任務的標籤
                                      if (newTagId && selectedTask.children && selectedTask.children.length > 0) {
                                        const inheritTag = (taskList) => {
                                          return taskList.map(t => {
                                            if (t.id === selectedTask.id && t.children) {
                                              return {
                                                ...t,
                                                children: t.children.map(child => {
                                                  if (!child.tagId) {
                                                    return {
                                                      ...child,
                                                      tagId: newTagId,
                                                      children: inheritTag(child.children || [])
                                                    };
                                                  }
                                                  return {
                                                    ...child,
                                                    children: inheritTag(child.children || [])
                                                  };
                                                })
                                              };
                                            }
                                            if (t.children) {
                                              return { ...t, children: inheritTag(t.children) };
                                            }
                                            return t;
                                          });
                                        };
                                        const finalTasks = inheritTag(updatedTasks);
                                        syncSelectedTask(finalTasks, selectedTask?.id);
                                        try {
                                          localStorage.setItem('projectTasks', JSON.stringify(finalTasks));
                                        } catch (error) {
                                          console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                                        }
                                        return finalTasks;
                                      }
                                      syncSelectedTask(updatedTasks, selectedTask?.id);
                                      try {
                                        localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
                                      } catch (error) {
                                        console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                                      }
                                      return updatedTasks;
                                    });
                                    setTagDropdownOpen(null);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '14px'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                >
                                  <div
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '3px',
                                      background: tag.color,
                                      border: '1px solid #ddd',
                                      flexShrink: 0
                                    }}
                                  />
                                  <span>{tag.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
              </div>
              </div>
            </div>

                {/* 可拖拽的開始/截止日期區域 */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="start-date">
          <div
            className="task-datetime-section"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}
          >
            <div className="form-group" style={{ flex: '1 1 260px', minWidth: '240px' }}>
                <label>開始日期</label>
                <div className="date-time-row">
                  <div className="date-fake-wrapper">
                    <div
                      className="fake-input"
                      onClick={() => {
                        const el = startDateInputRef.current;
                        if (!el) return; if (el.showPicker) el.showPicker(); else el.focus();
                      }}
                    >
                      {formatDateForInput(selectedTask?.details?.startDate) || 'YYYY / MM / DD'}
                    </div>
                    <input
                      ref={startDateInputRef}
                      type="date"
                      value={selectedTask?.details?.startDate || ''}
                      onChange={(e) => {
                        const newStartDate = e.target.value;
                        setTasks(prevTasks => {
                          const updatedTasks = updateTaskTree(prevTasks, selectedTask.id, {
                            details: {
                              ...selectedTask.details,
                              startDate: newStartDate
                            }
                          });
                        syncSelectedTask(updatedTasks, selectedTask?.id);
                        try {
                          try {
                          localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
      } catch (error) {
        console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
      }
                        } catch (error) {
                          console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                        }
                          return updatedTasks;
                        });
                      }}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                    />
                  </div>
                  <div
                    className="input-with-icon click-box no-icon"
                    onClick={(e) => { e.preventDefault(); openStartTimePicker(); }}
                  >
                    <input
                      ref={startTimeInputRef}
                      type="time"
                      className="no-native-icon"
                      value={selectedTask?.details?.startTime || ''}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            <div className="form-group" style={{ flex: '1 1 260px', minWidth: '240px' }}>
                <label>截止日期</label>
                <div className="date-time-row">
                  <div className="date-fake-wrapper">
                    <div
                      className="fake-input"
                      onClick={() => {
                        const el = dateInputRef.current;
                        if (!el) return; if (el.showPicker) el.showPicker(); else el.focus();
                      }}
                    >
                      {formatDateForInput(selectedTask?.details?.dueDate) || 'YYYY / MM / DD'}
                    </div>
                    <input
                      ref={dateInputRef}
                      type="date"
                      className="visually-hidden-date"
                      value={formatDateForInput(selectedTask?.details?.dueDate)}
                      onChange={(e)=>handleDueDateChange(e.target.value)}
                      tabIndex={-1}
                    />
                  </div>
                  <div
                    className="input-with-icon click-box no-icon"
                    onClick={(e) => { e.preventDefault(); openTimePicker(); }}
                  >
                    <input
                      ref={timeInputRef}
                      type="time"
                      className="no-native-icon"
                      value={selectedTask?.details?.dueTime || ''}
                      readOnly
                    />
                </div>
                  </div>
                </div>
                  </div>
                </div>

                {/* 可拖拽的提前提醒區域 */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="reminders">
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                <div className="group-header">
                  <label>提前提醒</label>
                  <button
                    className="link-add-btn"
                    onClick={() => {
                      const list = [...(selectedTask?.details?.reminders || [])];
                      list.push({ days: 0, hours: 0, minutes: 30 });
                      handleTaskDetailUpdate(selectedTask.id, 'reminders', list);
                    }}
                  >+ 添加提醒</button>
                </div>
                <div className="reminder-section">
                  {(selectedTask?.details?.reminders || []).length > 0 ? (
                    <div className="reminder-list">
                      {selectedTask.details.reminders.map((reminder, index) => (
                        <div key={index} className="reminder-item" onClick={() => openReminderPicker(reminder, index)}>
                          <span className="reminder-text">
                            {reminder.days > 0 && `${reminder.days}天`}
                            {reminder.hours > 0 && `${reminder.hours}小時`}
                            {reminder.minutes > 0 && `${reminder.minutes}分鐘`}
                            {(reminder.days||0)+(reminder.hours||0)+(reminder.minutes||0)===0 && '0分鐘'}
                          </span>
                          <button
                            className="remove-reminder-btn"
                            onClick={(e)=>{
                              e.stopPropagation();
                              const list = [...(selectedTask.details.reminders||[])];
                              list.splice(index,1);
                              handleTaskDetailUpdate(selectedTask.id, 'reminders', list);
                            }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="no-reminders">暫無提醒設置</span>
                  )}
                </div>
              </div>
              </div>

              <div className="task-status">
                <button
                  className={`header-complete-btn ${selectedTask.status === 'completed' ? 'completed' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(selectedTask.id, selectedTask.status === 'completed' ? 'pending' : 'completed');
                  }}
                >
                  {selectedTask.status === 'completed' ? '已完成' : '未完成'}
                </button>
              </div>

                {/* 重複設定區塊 */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="repeat-settings">
                  <div className="task-properties-section" style={{ marginBottom: '12px', padding: '12px 16px 10px', background: '#f5f7fa', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>重複：</label>
                        <div className="task-status" style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className={`header-progress-btn ${selectedTask?.details?.repeat?.enabled ? 'enabled' : 'disabled'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = Boolean(selectedTask?.details?.repeat?.enabled);
                              setTasks(prevTasks => {
                                const nextRepeat = {
                                  ...(selectedTask.details?.repeat || {}),
                                  enabled: !current,
                                  interval: Number(selectedTask.details?.repeat?.interval || 1),
                                  unit: selectedTask.details?.repeat?.unit || 'day',
                                  base: selectedTask.details?.repeat?.base || 'startDate'
                                };
                                // 若是啟用，對齊 lastResetAt 到目前視窗起點
                                let alignedLast = undefined;
                                if (!current) {
                                  const simulatedTask = {
                                    ...selectedTask,
                                    details: { ...selectedTask.details, repeat: nextRepeat }
                                  };
                                  alignedLast = getWindowStart(simulatedTask).toISOString();
                                }
                                const updatedTasks = updateTaskTree(prevTasks, selectedTask.id, {
                                  details: {
                                    ...selectedTask.details,
                                    repeat: {
                                      ...nextRepeat,
                                      ...(alignedLast ? { lastResetAt: alignedLast } : {})
                                    }
                                  }
                                });
                                syncSelectedTask(updatedTasks, selectedTask?.id);
                                try {
                                  localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
                                } catch (error) {
                                  console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                                }
                                return updatedTasks;
                              });
                            }}
                          >
                            {selectedTask?.details?.repeat?.enabled ? '已啟用' : '未啟用'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>頻率：</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="1"
                            value={selectedTask?.details?.repeat?.interval || 1}
                            onChange={(e) => {
                              const newInterval = Math.max(1, Number(e.target.value) || 1);
                              setTasks(prevTasks => {
                                const nextRepeat = {
                                  ...(selectedTask.details?.repeat || {}),
                                  interval: newInterval,
                                  unit: selectedTask.details?.repeat?.unit || 'day',
                                  enabled: Boolean(selectedTask.details?.repeat?.enabled),
                                  base: selectedTask.details?.repeat?.base || 'startDate'
                                };
                                const simulatedTask = { ...selectedTask, details: { ...selectedTask.details, repeat: nextRepeat } };
                                const alignedLast = getWindowStart(simulatedTask).toISOString();
                                const updatedTasks = updateTaskTree(prevTasks, selectedTask.id, {
                                  details: {
                                    ...selectedTask.details,
                                    repeat: { ...nextRepeat, lastResetAt: alignedLast }
                                  }
                                });
                                syncSelectedTask(updatedTasks, selectedTask?.id);
                                try {
                                  localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
                                } catch (error) {
                                  console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                                }
                                return updatedTasks;
                              });
                            }}
                            style={{
                              padding: '6px 8px',
                              border: '1px solid #E8EDF2',
                              borderRadius: '4px',
                              fontSize: '14px',
                              width: '60px',
                              textAlign: 'center'
                            }}
                          />
                          <select
                            value={selectedTask?.details?.repeat?.unit || 'day'}
                            onChange={(e) => {
                              const newUnit = e.target.value;
                              setTasks(prevTasks => {
                                const nextRepeat = {
                                  ...(selectedTask.details?.repeat || {}),
                                  unit: newUnit,
                                  interval: Number(selectedTask.details?.repeat?.interval || 1),
                                  enabled: Boolean(selectedTask.details?.repeat?.enabled),
                                  base: selectedTask.details?.repeat?.base || 'startDate'
                                };
                                const simulatedTask = { ...selectedTask, details: { ...selectedTask.details, repeat: nextRepeat } };
                                const alignedLast = getWindowStart(simulatedTask).toISOString();
                                const updatedTasks = updateTaskTree(prevTasks, selectedTask.id, {
                                  details: {
                                    ...selectedTask.details,
                                    repeat: { ...nextRepeat, lastResetAt: alignedLast }
                                  }
                                });
                                syncSelectedTask(updatedTasks, selectedTask?.id);
                                try {
                                  localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
                                } catch (error) {
                                  console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
                                }
                                return updatedTasks;
                              });
                            }}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #E8EDF2',
                              borderRadius: '4px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              backgroundColor: 'white',
                              minWidth: '100px'
                            }}
                          >
                            <option value="minute">分鐘</option>
                            <option value="day">天</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 重複日誌（極簡版，最近 30 天） */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="repeat-logs">
                  <div className="task-properties-section" style={{ marginBottom: '16px', padding: '12px', background: '#ffffff', border: '1px solid #E8EDF2', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setRepeatLogExpanded(prev => !prev)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#4a4a4a'
                          }}
                        >
                          {repeatLogExpanded ? <IoChevronUp size={16} /> : <IoChevronDown size={16} />}
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>重複日誌</h3>
                      </div>
                      <span style={{ fontSize: '12px', color: '#888' }}>
                        {selectedTask?.details?.repeat?.unit === 'minute'
                          ? `顯示最近 ${Math.min(30, repeatLogEntries.length)} 筆`
                          : `顯示最近 ${Math.min(30, repeatLogEntries.length)} 天`}
                      </span>
                    </div>
                    {repeatLogExpanded && (
                      <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                          <button
                            type="button"
                            style={repeatLogTabButtonStyle(repeatLogActiveTab === 'log')}
                            onClick={() => setRepeatLogActiveTab('log')}
                          >
                            日誌列表
                          </button>
                          <button
                            type="button"
                            style={repeatLogTabButtonStyle(repeatLogActiveTab === 'analysis')}
                            onClick={() => setRepeatLogActiveTab('analysis')}
                          >
                            日誌分析
                          </button>
                        </div>
                        {repeatLogActiveTab === 'log' ? (
                          recentRepeatLogEntries.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#999' }}>暫無日誌</div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px 12px', alignItems: 'center' }}>
                              {recentRepeatLogEntries.map((entry) => (
                                <React.Fragment key={entry.dateKey}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 999, background: entry.completed ? '#2e7d32' : '#bdc5cb', display: 'inline-block' }} />
                                    <span style={{ fontSize: '14px' }}>{entry.displayDate}</span>
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#666' }}>{entry.completed ? '完成' : '未完成'}</div>
                                  <div style={{ fontSize: '13px', color: '#666', textAlign: 'right' }}>{typeof entry.maxProgress === 'number' ? `${Math.round(entry.maxProgress)}%` : '-'}</div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedTask) {
                                        handleDeleteRepeatLogEntry(selectedTask.id, entry.dateKey);
                                      }
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#d94b4b',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    刪除
                                  </button>
                                </React.Fragment>
                              ))}
                            </div>
                          )
                        ) : repeatLogEntries.length === 0 ? (
                          <div style={{ fontSize: '13px', color: '#999' }}>暫無日誌可供分析</div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                              <div style={{ flex: '1 1 140px', minWidth: '140px', padding: '12px', border: '1px solid #E8EDF2', borderRadius: '8px', background: '#F9FBFC' }}>
                                <div style={{ fontSize: '12px', color: '#777', marginBottom: '4px' }}>總紀錄</div>
                                <div style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>{repeatLogAnalysis.total}</div>
                              </div>
                              <div style={{ flex: '1 1 140px', minWidth: '140px', padding: '12px', border: '1px solid #E8EDF2', borderRadius: '8px', background: '#F9FBFC' }}>
                                <div style={{ fontSize: '12px', color: '#777', marginBottom: '4px' }}>完成次數</div>
                                <div style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>{repeatLogAnalysis.completedCount}</div>
                              </div>
                              <div style={{ flex: '1 1 140px', minWidth: '140px', padding: '12px', border: '1px solid #E8EDF2', borderRadius: '8px', background: '#F9FBFC' }}>
                                <div style={{ fontSize: '12px', color: '#777', marginBottom: '4px' }}>平均完成率</div>
                                <div style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>{repeatLogAnalysis.completionRate}%</div>
                              </div>
                              <div style={{ flex: '1 1 140px', minWidth: '140px', padding: '12px', border: '1px solid #E8EDF2', borderRadius: '8px', background: '#F9FBFC' }}>
                                <div style={{ fontSize: '12px', color: '#777', marginBottom: '4px' }}>當前連續完成</div>
                                <div style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>{repeatLogAnalysis.currentStreak}</div>
                              </div>
                              <div style={{ flex: '1 1 140px', minWidth: '140px', padding: '12px', border: '1px solid #E8EDF2', borderRadius: '8px', background: '#F9FBFC' }}>
                                <div style={{ fontSize: '12px', color: '#777', marginBottom: '4px' }}>最佳連續完成</div>
                                <div style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>{repeatLogAnalysis.longestStreak}</div>
                              </div>
                              <div style={{ flex: '1 1 140px', minWidth: '140px', padding: '12px', border: '1px solid #E8EDF2', borderRadius: '8px', background: '#F9FBFC' }}>
                                <div style={{ fontSize: '12px', color: '#777', marginBottom: '4px' }}>近 7 筆完成率</div>
                                <div style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>{repeatLogAnalysis.recentCompletionRate}%</div>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#777', marginBottom: '8px' }}>
                                最近 {repeatLogAnalysis.recentTrend.length} 筆完成趨勢
                              </div>
                              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                                {repeatLogAnalysis.recentTrend.map((entry) => (
                                  <div key={`${entry.dateKey}-trend`} style={{ border: '1px solid #E8EDF2', borderRadius: '8px', padding: '10px', background: '#F9FBFC' }}>
                                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '4px' }}>{entry.displayDate}</div>
                                    <div style={{ fontSize: '12px', color: entry.completed ? '#2e7d32' : '#888', marginBottom: '6px' }}>
                                      {entry.completed ? '完成' : '未完成'}
                                    </div>
                                    <div style={{ height: '6px', borderRadius: '3px', background: '#E2E8F0', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${Math.max(0, Math.min(100, entry.maxProgress ?? 0))}%`,
                                          height: '100%',
                                          background: entry.completed ? '#2e7d32' : '#bdc5cb'
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div style={{ marginTop: '16px' }}>
                              <div style={{ fontSize: '12px', color: '#777', marginBottom: '8px' }}>
                                每日完成率趨勢
                              </div>
                              {repeatLogAnalysis.dailyTrend.length === 0 ? (
                                <div style={{ fontSize: '13px', color: '#999' }}>暫無趨勢資料</div>
                              ) : (
                                (() => {
                                  const trendSlice = repeatLogAnalysis.dailyTrend.slice(-14);
                                  const chartHeight = 140;
                                  const chartWidth = Math.max(240, trendSlice.length * 48);
                                  const padding = { top: 16, right: 24, bottom: 32, left: 40 };
                                  const innerWidth = chartWidth - padding.left - padding.right;
                                  const innerHeight = chartHeight - padding.top - padding.bottom;
                                  const maxRate = 100;
                                  const minRate = 0;
                                  const range = maxRate - minRate || 1;
                                  const getPoint = (rate, index) => {
                                    const x =
                                      padding.left +
                                      (trendSlice.length === 1
                                        ? innerWidth / 2
                                        : (innerWidth / (trendSlice.length - 1)) * index);
                                    const y =
                                      padding.top +
                                      innerHeight -
                                      ((Math.max(minRate, Math.min(maxRate, rate)) - minRate) / range) * innerHeight;
                                    return { x, y };
                                  };
                                  const points = trendSlice.map((item, idx) =>
                                    getPoint(item.completionRate, idx)
                                  );
                                  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
                                  const areaPoints =
                                    `${points[0].x},${padding.top + innerHeight} ` +
                                    polylinePoints +
                                    ` ${points[points.length - 1].x},${padding.top + innerHeight}`;

                                  return (
                                    <div style={{ overflowX: 'auto' }}>
                                      <svg width={chartWidth} height={chartHeight}>
                                        <rect
                                          x={padding.left}
                                          y={padding.top}
                                          width={innerWidth}
                                          height={innerHeight}
                                          fill="#F5FAFD"
                                          stroke="#E2E8F0"
                                          strokeWidth="1"
                                          rx="8"
                                        />
                                        {[0, 25, 50, 75, 100].map(rate => {
                                          const y =
                                            padding.top +
                                            innerHeight -
                                            ((rate - minRate) / range) * innerHeight;
                                          return (
                                            <g key={rate}>
                                              <line
                                                x1={padding.left}
                                                x2={padding.left + innerWidth}
                                                y1={y}
                                                y2={y}
                                                stroke="#E5EEF6"
                                                strokeWidth={rate === 0 ? 2 : 1}
                                                strokeDasharray={rate === 0 ? '0' : '4 4'}
                                              />
                                              <text
                                                x={padding.left - 8}
                                                y={y + 4}
                                                textAnchor="end"
                                                fontSize="10"
                                                fill="#7A8A9A"
                                              >
                                                {rate}%
                                              </text>
                                            </g>
                                          );
                                        })}
                                        <polyline
                                          points={areaPoints}
                                          fill="rgba(82, 208, 255, 0.2)"
                                          stroke="none"
                                        />
                                        <polyline
                                          points={polylinePoints}
                                          fill="none"
                                          stroke="#52D0FF"
                                          strokeWidth="2"
                                        />
                                        {points.map((point, idx) => (
                                          <g key={`${trendSlice[idx].date}-point`}>
                                            <circle
                                              cx={point.x}
                                              cy={point.y}
                                              r="4"
                                              fill="#ffffff"
                                              stroke="#0F95D1"
                                              strokeWidth="2"
                                            />
                                            <text
                                              x={point.x}
                                              y={padding.top + innerHeight + 14}
                                              textAnchor="middle"
                                              fontSize="10"
                                              fill="#4A4A4A"
                                            >
                                              {trendSlice[idx].date.slice(5)}
                                            </text>
                                          </g>
                                        ))}
                                      </svg>
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
              </div>

                {/* 可拖拽的任務描述區域 */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="description">
                  <div className="task-description">
                    <h3>任務描述</h3>
                    <div className="editor-container">
                      <ReactQuill
                        key={selectedTask?.id || 'no-task'}
                        theme="snow"
                        value={selectedTask.description || ''}
                        onChange={(content) => handleEditorChange(content)}
                        modules={modules}
                        formats={formats}
                        placeholder="在這裡輸入任務描述..."
                        preserveWhitespace={true}
                      />
                    </div>
                  </div>
                </div>

                {/* 文字膠囊輸入器 */}
                {(() => {
                  const currentState = getCurrentTaskCapsuleState();
                  return currentState?.showCapsules && (
                    <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="capsules">
                      <div className="capsule-section">
                        {/* 膠囊任務模板設計 */}
                        {/* 可摺疊標題 */}
                        <div
                          className="template-designer-header"
                          onClick={() => {
                            const currentState = getCurrentTaskCapsuleState();
                            updateTaskCapsuleState({ 
                              templateDesignerOpen: !currentState.templateDesignerOpen 
                            });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#f5f7fa',
                            border: '1px solid #E8EDF2',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginBottom: getCurrentTaskCapsuleState()?.templateDesignerOpen ? '12px' : '0'
                          }}
                        >
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                            📋 膠囊任務模板設計
                          </span>
                          <span style={{ fontSize: '12px', color: '#999' }}>
                            {getCurrentTaskCapsuleState()?.templateDesignerOpen ? '▼' : '▶'}
                          </span>
                        </div>

                        {/* 模板設計內容 */}
                        {getCurrentTaskCapsuleState()?.templateDesignerOpen && (
                          <div style={{ marginBottom: '16px' }}>
                            {/* 載入模板下拉選單 */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#666' }}>
                                載入模板：
                              </label>
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    loadTemplateIntoDesigner(e.target.value);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 12px',
                                  border: '1px solid #E8EDF2',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  background: 'white'
                                }}
                              >
                                <option value="">選擇模板...</option>
                                {templates.map(template => (
                                  <option key={template.id} value={template.id}>
                                    {template.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 任務結構 */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '500', color: '#666' }}>
                                  任務結構：
                                </label>
                                <button
                                  onClick={addRootTask}
                                  style={{
                                    padding: '5px 10px',
                                    background: '#52D0FF',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500'
                                  }}
                                >
                                  +新增任務
                                </button>
                              </div>

                              {/* 渲染任務樹 */}
                              <div className="template-task-tree" style={{ minHeight: '80px', padding: '10px', border: '1px solid #E8EDF2', borderRadius: '4px', background: '#f8f9fa' }}>
                                {renderTemplateTaskTree()}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* 目標位置選擇器 */}
                        <div className="target-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                          <label style={{ margin: 0, whiteSpace: 'nowrap' }}>生成位置</label>
                          <select 
                            value={currentState.targetParentId || ''} 
                            onChange={(e) => updateTaskCapsuleState({ targetParentId: e.target.value })}
                            style={{ flex: 1, margin: 0 }}
                          >
                            <option value="">選擇父任務</option>
                            <option value={selectedTask.id}>當前任務 ({selectedTask.title})</option>
                            {(() => {
                              // 遞歸渲染所有任務選項
                              const renderTaskOptions = (taskList, prefix = '') => {
                                return taskList.flatMap(task => {
                                  const options = [
                                    <option key={task.id} value={task.id}>
                                      {prefix}[{task.level}] {task.title}
                                    </option>
                                  ];
                                  if (task.children && task.children.length > 0) {
                                    options.push(...renderTaskOptions(task.children, prefix + '　'));
                                  }
                                  return options;
                                });
                              };
                              return renderTaskOptions(tasks);
                            })()}
                          </select>
                        </div>

                        {/* 佔位符控制選項 */}
                        <div className="placeholder-control" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <label className="placeholder-checkbox" style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={currentState.placeholderEnabled}
                              onChange={(e) => {
                                const isEnabled = e.target.checked;
                                
                                // 切換佔位符的顯示/隱藏
                                if (currentState.placeholderTaskId) {
                                  setTasks(prevTasks => {
                                    const togglePlaceholderVisibility = (taskList) => {
                                      return taskList.map(task => {
                                        if (task.id === currentState.placeholderTaskId) {
                                          return {
                                            ...task,
                                            isHidden: !isEnabled
                                          };
                                        }
                                        if (task.children && task.children.length > 0) {
                                          return {
                                            ...task,
                                            children: togglePlaceholderVisibility(task.children)
                                          };
                                        }
                                        return task;
                                      });
                                    };
                                    
                                    const updatedTasks = togglePlaceholderVisibility(prevTasks);
                                    syncSelectedTask(updatedTasks);
                                    try {
                                    localStorage.setItem('projectTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('localStorage 配額已滿，無法儲存任務更新:', error);
    }
                                    return updatedTasks;
                                  });
                                }
                                
                                updateTaskCapsuleState({ 
                                  placeholderEnabled: isEnabled
                                });
                              }}
                            />
                            <span className="checkmark"></span>
                            啟用佔位符插入
                          </label>
                          
                          {/* 新增膠囊按鈕 */}
                          <button 
                            className="add-capsule-text-btn"
                            onClick={addCapsule}
                            style={{ margin: 0 }}
                          >
                            + 新增膠囊
                          </button>
                        </div>

                        {/* 膠囊列表 - 3個一排 */}
                        <div className="capsules-container">
                          <div className="capsules-grid">
                            {currentState.capsules.map((capsule, index) => (
                              <div 
                                key={capsule.id} 
                                className="capsule-pill"
                                onClick={(e) => {
                                  // 檢查點擊位置：如果點擊的是邊緣區域（不是文字或X按鈕），則跳轉
                                  if (e.target.classList.contains('capsule-pill')) {
                                    handleCapsuleNavigation(capsule.id);
                                  }
                                }}
                                title={(currentState.capsuleTaskMappings && currentState.capsuleTaskMappings[capsule.id]) ? '點擊跳轉到對應任務' : '尚未生成對應任務'}
                              >
                                {editingCapsuleId === capsule.id ? (
                                  <input
                                    type="text"
                                    value={editingCapsuleText}
                                    onChange={(e) => setEditingCapsuleText(e.target.value)}
                                    onKeyPress={handleCapsuleKeyPress}
                                    onBlur={saveCapsuleEdit}
                                    className="capsule-edit-input"
                                    autoFocus
                                  />
                                ) : (
                                  <>
                                    <span 
                                      className="capsule-text"
                                      onClick={(e) => {
                                        e.stopPropagation(); // 防止觸發父級的跳轉事件
                                        startEditCapsule(capsule.id, capsule.text);
                                      }}
                                    >
                                      {capsule.text || '點擊編輯...'}
                                    </span>
                                    <button 
                                      className="capsule-remove-btn capsule-x-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeCapsule(capsule.id);
                                      }}
                                      title="刪除膠囊"
                                      onMouseEnter={(e) => {
                                        e.target.style.background = '#ff4444';
                                        e.target.style.color = 'white';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.background = 'white';
                                        e.target.style.color = 'white';
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: '50%',
                                        right: '8px',
                                        transform: 'translateY(-50%)',
                                        width: '18px',
                                        height: '18px',
                                        maxWidth: '18px',
                                        maxHeight: '18px',
                                        minWidth: '18px',
                                        minHeight: '18px',
                                        background: 'white',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        fontSize: '11px',
                                        fontFamily: 'inherit',
                                        lineHeight: '1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        padding: '0',
                                        margin: '0',
                                        outline: 'none',
                                        textAlign: 'center',
                                        verticalAlign: 'middle',
                                        boxSizing: 'border-box',
                                        transition: 'all 0.2s ease'
                                      }}
                                    >
                                      ×
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 操作按鈕 */}
                        <div className="capsule-actions">
                          <div className="generation-status">
                            {currentState.generatedTasks && currentState.generatedTasks.length > 0 ? (
                              <span className="status-indicator generated">
                                ✓ 已生成 {currentState.generatedTasks.length} 個任務
                              </span>
                            ) : (
                              <span className="status-indicator not-generated">
                                待生成任務
                              </span>
                            )}
                          </div>
                          
                          <div className="action-buttons">
                            <button 
                              className="generate-btn"
                              onClick={generateTasksFromCapsules}
                              disabled={currentState.capsules.length === 0 || 
                                       (!currentState.placeholderEnabled && !currentState.targetParentId)}
                            >
{(() => {
                                const unGeneratedCount = currentState.capsules.filter(capsule => 
                                  capsule.text.trim() && !(currentState.capsuleTaskMappings && currentState.capsuleTaskMappings[capsule.id])
                                ).length;
                                const generatedCount = Object.keys(currentState.capsuleTaskMappings || {}).length;
                                
                                
                                if (generatedCount === 0) {
                                  return '生成子任務';
                                } else if (unGeneratedCount > 0) {
                                  return `生成剩餘 ${unGeneratedCount} 個`;
                                } else {
                                  return '全部已生成';
                                }
                              })()}
                            </button>

                            {/* 一鍵清除按鈕 - 只在有生成任務時顯示 */}
                            {currentState.allGeneratedTaskIds && currentState.allGeneratedTaskIds.length > 0 && (
                              <button 
                                className="clear-all-btn"
                                onClick={clearAllGeneratedTasks}
                                title="清除所有生成的任務"
                              >
                                一鍵清除
                              </button>
                            )}
                            
                            {/* 關閉按鈕只在介面布局編輯模式下顯示 */}
                            {isLayoutEditing && (
                              <button 
                                className="close-capsules-btn"
                                onClick={() => updateTaskCapsuleState({ showCapsules: false })}
                              >
                                關閉
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 可拖拽的子任務清單區域 */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="subtasks">
              {selectedTask.children && selectedTask.children.length > 0 && (
                <div className="subtasks-list">
                  <h3>子任務清單</h3>
                  <div className="subtasks-container">
                    {selectedTask.children.filter(subtask => subtask && subtask.id && !subtask.isPlaceholder && !subtask.isPlaceholderHeader).map(subtask => (
                      <div 
                        key={subtask.id} 
                        className={`subtask-item ${subtask.status === 'completed' ? 'completed' : ''}`}
                      >
                        <div className="subtask-icon">
                          {subtask.icon ? (
                            subtask.icon.type === 'custom' ? (
                              <img src={subtask.icon.url} alt="" />
                            ) : (
                              React.createElement(
                                DEFAULT_ICONS.find(i => i.name === subtask.icon.name)?.icon,
                                { size: 20 }
                              )
                            )
                          ) : (
                            React.createElement(DEFAULT_ICONS[0].icon, { size: 20 })
                          )}
                        </div>
                        
                        <span className="subtask-title">{subtask.title}</span>
                        
                        <button
                          className={`status-toggle ${subtask.status === 'completed' ? 'completed' : ''}`}
                          style={{ color: subtask.status === 'completed' ? '#1976d2' : '#999' }}
                          onClick={() => handleStatusChange(
                            subtask.id,
                            subtask.status === 'completed' ? 'pending' : 'completed'
                          )}
                        >
                          <BsCheck2Circle />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </div>

                {/* 可拖拽的任務元數據區域 */}
                <div className={`layout-item ${isLayoutEditing ? 'draggable-item' : ''}`} data-layout-id="meta">
              <div className="task-meta">
                <p>創建時間：{formatDateTimeForDisplay(selectedTask.created)}</p>
                {selectedTask.children && selectedTask.children.length > 0 && (
                  <p>子任務數量：{selectedTask.children.length}</p>
                )}
              </div>
              </div>
              </>
            )}

            {/* 任務概覽面板 */}
            {activeTab === 'overview' && (
              <div className="task-overview-panel">
                {/* 統計和搜索區域 */}
                <div className="overview-header">
                  <div className="overview-stats">
                    <span>整體進度: {allTasks.filter(t => t.completed).length}/{allTasks.length} 任務 ({Math.round((allTasks.filter(t => t.completed).length / allTasks.length) * 100)}%)</span>
                  </div>
                  <div className="overview-search">
                    <input
                      type="text"
                      placeholder="搜索任務名稱或描述..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                {/* 篩選和排序工具列 */}
                <div className="overview-toolbar">
                  <div className="filters">
                    <select 
                      value={levelFilter} 
                      onChange={(e) => setLevelFilter(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="all">全部層級</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                    <select 
                      value={statusFilter} 
                      onChange={(e) => setStatusFilter(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="all">全部狀態</option>
                      <option value="pending">未完成</option>
                      <option value="completed">已完成</option>
                    </select>
                    <select 
                      value={priorityFilter} 
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="all">全部優先級</option>
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                      <option value="none">無</option>
                    </select>
                    <div className="tag-filter-dropdown-container" style={{ position: 'relative' }}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagFilterDropdownOpen(!tagFilterDropdownOpen);
                        }}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          minWidth: '120px'
                        }}
                      >
                        <span style={{ flex: 1, textAlign: 'left', fontSize: '12px' }}>
                          {tagFilter === 'all' ? '全部屬性' : 
                           tagFilter === 'none' ? '無屬性' : 
                           taskTags.find(t => t.id === tagFilter)?.name || '全部屬性'}
                        </span>
                        {tagFilter !== 'all' && tagFilter !== 'none' && (
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              background: getTagColor(tagFilter) || '#E0E0E0',
                              border: '1px solid #ddd',
                              flexShrink: 0
                            }}
                          />
                        )}
                        <span style={{ fontSize: '8px', color: '#999' }}>▼</span>
                      </div>
                      {tagFilterDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '4px',
                            background: 'white',
                            border: '1px solid #E8EDF2',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            zIndex: 1000,
                            maxHeight: '200px',
                            overflowY: 'auto'
                          }}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter('all');
                              setTagFilterDropdownOpen(false);
                            }}
                            style={{
                              padding: '6px 10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                          >
                            <span>全部屬性</span>
                          </div>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter('none');
                              setTagFilterDropdownOpen(false);
                            }}
                            style={{
                              padding: '6px 10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                          >
                            <span>無屬性</span>
                          </div>
                          {taskTags.map(tag => (
                            <div
                              key={tag.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTagFilter(tag.id);
                                setTagFilterDropdownOpen(false);
                              }}
                              style={{
                                padding: '6px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                            >
                              <div
                                style={{
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '3px',
                                  background: tag.color,
                                  border: '1px solid #ddd',
                                  flexShrink: 0
                                }}
                              />
                              <span>{tag.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="default">預設</option>
                      <option value="created">創建時間</option>
                      <option value="dueDate">截止日期</option>
                      <option value="priority">優先級</option>
                      <option value="level">層級</option>
                      <option value="status">狀態</option>
                    </select>
                    <button 
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        backgroundColor: 'white',
                        color: '#333',
                        minWidth: '32px',
                        height: 'auto',
                        lineHeight: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={sortOrder === 'asc' ? '升序' : '降序'}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>

                {/* 操作按鈕區域 */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  marginBottom: '12px',
                  gap: '8px'
                }}>
                  <button 
                    onClick={handleSelectAll}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      color: '#333'
                    }}
                  >
                      {selectedTasks.size === filteredTasks.length ? '取消全選' : '全選'}
                    </button>
                    {selectedTasks.size > 0 && (
                      <>
                      <button 
                        onClick={() => handleBulkStatusChange('completed')}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          color: '#333'
                        }}
                      >
                          標記完成
                        </button>
                      <button 
                        onClick={() => handleBulkStatusChange('pending')}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          color: '#333'
                        }}
                        >
                          標記未完成
                        </button>
                      <button 
                        onClick={handleBulkDelete}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          color: '#333'
                        }}
                      >
                          刪除任務
                        </button>
                      </>
                    )}
                </div>

                {/* 任務表格 */}
                {/* 刪除：概覽中的日期時間快速編輯（改採每列任務提供欄位） */}
                <div className="overview-table-container">
                  <table className="overview-table">
                    <thead>
                      <tr>
                        <th style={{width: '30%'}}>任務名稱</th>
                        <th style={{width: '6%'}}>層級</th>
                        <th style={{width: '10%'}}>狀態</th>
                        <th style={{width: '8%'}}>優先級</th>
                        <th style={{width: '10%'}}>屬性</th>
                        <th style={{width: '80px'}}>開始</th>
                        <th style={{width: '80px'}}>截止</th>
                        <th>路徑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(task => (
                        <tr 
                          key={task.id} 
                          className={selectedTasks.has(task.id) ? 'selected' : ''}
                          onContextMenu={(e) => handleContextMenu(e, task.id, task.title)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedTasks.has(task.id)}
                              onChange={() => handleTaskSelect(task.id)}
                            />
                            <span 
                              className="task-name"
                              onClick={() => handleOverviewTaskClick(task.id)}
                            >
                              {task.title}
                            </span>
                          </td>
                          <td>
                            <span className={`level-badge level-${String(task.level).toLowerCase()}`}>
                              {task.level}
                            </span>
                          </td>
                          <td>
                            <button
                            className={`status-button ${task.status === 'completed' ? 'completed' : 'pending'}`}
                              onClick={() => handleTaskStatusToggle(task.id)}
                            >
                            {task.status === 'completed' ? '已完成' : '未完成'}
                            </button>
                          </td>
                          <td>
                            <select
                              value={task.priority || ''}
                              onChange={(e) => {
                                const newPriority = e.target.value || null; // 空字串轉為null
                                setTasks(prevTasks => {
                                  return updateTaskTree(prevTasks, task.id, {
                                    priority: newPriority
                                  });
                                });
                              }}
                              className="priority-select"
                              style={{
                                padding: '4px 8px',
                                border: '1px solid #E8EDF2',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                backgroundColor: 'white'
                              }}
                            >
                              <option value="">無</option>
                              <option value="high">高</option>
                              <option value="medium">中</option>
                              <option value="low">低</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                              <div className="tag-dropdown-container" style={{ position: 'relative', flex: 1 }}>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTagDropdownOpen(tagDropdownOpen === task.id ? null : task.id);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    border: '1px solid #E8EDF2',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    backgroundColor: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '6px'
                                  }}
                                >
                                  <span style={{ flex: 1, textAlign: 'left', fontSize: '12px' }}>
                                    {task.tagId ? taskTags.find(t => t.id === task.tagId)?.name || '無屬性' : '無屬性'}
                                  </span>
                                  {task.tagId && (
                                    <div
                                      style={{
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '3px',
                                        background: getTagColor(task.tagId) || '#E0E0E0',
                                        border: '1px solid #ddd',
                                        flexShrink: 0
                                      }}
                                    />
                                  )}
                                  <span style={{ fontSize: '8px', color: '#999' }}>▼</span>
                                </div>
                                {tagDropdownOpen === task.id && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: 0,
                                      right: 0,
                                      marginTop: '4px',
                                      background: 'white',
                                      border: '1px solid #E8EDF2',
                                      borderRadius: '4px',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                      zIndex: 1000,
                                      maxHeight: '200px',
                                      overflowY: 'auto'
                                    }}
                                  >
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newTagId = null;
                                        setTasks(prevTasks => {
                                          return updateTaskTree(prevTasks, task.id, {
                                            tagId: newTagId
                                          });
                                        });
                                        setTagDropdownOpen(null);
                                      }}
                                      style={{
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '12px'
                                      }}
                                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                    >
                                      <span>無屬性</span>
                                    </div>
                                    {taskTags.map(tag => (
                                      <div
                                        key={tag.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newTagId = tag.id;
                                          setTasks(prevTasks => {
                                            return updateTaskTree(prevTasks, task.id, {
                                              tagId: newTagId
                                            });
                                          });
                                          setTagDropdownOpen(null);
                                        }}
                                        style={{
                                          padding: '6px 10px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          fontSize: '12px'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                      >
                                        <div
                                          style={{
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '3px',
                                            background: tag.color,
                                            border: '1px solid #ddd',
                                            flexShrink: 0
                                          }}
                                        />
                                        <span>{tag.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ paddingRight: '8px' }}>
                            {/* 開始：日期+時間 垂直堆疊 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100px' }}>
                              <div className="date-fake-wrapper" style={{ width: '100px' }}>
                                <div
                                  className={`fake-input overview-start-date ${task.details?.startDate ? '' : 'is-placeholder'}`}
                                  style={{ width: '100px' }}
                                  onClick={() => {
                                    if (selectedTask?.id === task.id) return;
                                    const el = document.getElementById(`start-date-input-${task.id}`);
                                    if (!el) return;
                                    if (el.showPicker) el.showPicker(); else el.focus();
                                  }}
                                >
                                  {formatDateForInput(task.details?.startDate) || 'YYYY-MM-DD'}
                                </div>
                                <input
                                  id={`start-date-input-${task.id}`}
                                  type="date"
                                  className="visually-hidden-date"
                                  value={formatDateForInput(task.details?.startDate)}
                                  onChange={(e) => {
                                    if (selectedTask?.id === task.id) return;
                                    const newDate = e.target.value;
                                    setTasks(prevTasks => {
                                      const timeStr = task.details?.startTime || '00:00';
                                      const combined = getCombinedISO(newDate, timeStr);
                                      const updatedTasks = updateTaskTree(prevTasks, task.id, {
                                        details: {
                                          ...task.details,
                                          startDate: combined
                                        }
                                      });
                                      return updatedTasks;
                                    });
                                  }}
                                  tabIndex={-1}
                                />
                              </div>
                              <div
                                className="fake-input overview-start-time"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const taskToSelect = findTaskById(tasks, task.id);
                                  if (taskToSelect) setSelectedTask(taskToSelect);
                                  let h = 0, m = 0;
                                  const ts = task.details?.startTime;
                                  if (ts && /\d{2}:\d{2}/.test(ts)) { h = parseInt(ts.split(':')[0],10); m = parseInt(ts.split(':')[1],10); }
                                  setIsStartTimePicker(true);
                                  setTpHour(h);
                                  setTpMinute(m - (m % 5));
                                  setShowTimePicker(true);
                                }}
                                style={{ width: '100px' }}
                              >
                                {task.details?.startTime || '__:__'}
                              </div>
                            </div>
                          </td>
                          <td style={{ paddingRight: '24px' }}>
                            {/* 截止：日期+時間 垂直堆疊 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100px' }}>
                              <div className="date-fake-wrapper" style={{ width: '100px' }}>
                                <div
                                  className={`fake-input overview-due-date ${task.details?.dueDate ? '' : 'is-placeholder'}`}
                                  style={{ width: '100px' }}
                                onClick={() => {
                                  // 如果是當前選中的任務，不顯示日期選擇器，避免重複
                                  if (selectedTask?.id === task.id) {
                                    return;
                                  }
                                  const el = document.getElementById(`due-date-input-${task.id}`);
                                  if (!el) return; 
                                  if (el.showPicker) el.showPicker(); 
                                  else el.focus();
                                }}
                              >
                                {formatDateForInput(task.details?.dueDate) || 'YYYY-MM-DD'}
                              </div>
                              <input
                                id={`due-date-input-${task.id}`}
                                type="date"
                                className="visually-hidden-date"
                                value={formatDateForInput(task.details?.dueDate)}
                                onChange={(e) => {
                                  // 如果是當前選中的任務，不處理變更，避免重複
                                  if (selectedTask?.id === task.id) {
                                    return;
                                  }
                                  const newDate = e.target.value;
                                  setTasks(prevTasks => {
                                      const timeStr = task.details?.dueTime || '00:00';
                                      const combined = getCombinedISO(newDate, timeStr);
                                    const updatedTasks = updateTaskTree(prevTasks, task.id, {
                                      details: {
                                        ...task.details,
                                          dueDate: combined
                                      }
                                    });
                                    
                                    return updatedTasks;
                                  });
                                }}
                                tabIndex={-1}
                              />
                              </div>
                              <div
                                className="fake-input overview-due-time"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const taskToSelect = findTaskById(tasks, task.id);
                                  if (taskToSelect) setSelectedTask(taskToSelect);
                                  let h = 0, m = 0;
                                  const ts = task.details?.dueTime;
                                  if (ts && /\d{2}:\d{2}/.test(ts)) { h = parseInt(ts.split(':')[0],10); m = parseInt(ts.split(':')[1],10); }
                                  setIsStartTimePicker(false);
                                  setTpHour(h);
                                  setTpMinute(m - (m % 5));
                                  setShowTimePicker(true);
                                }}
                                style={{ width: '100px' }}
                              >
                                {task.details?.dueTime || '__:__'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="breadcrumb">
                              {(() => {
                                const filteredPath = (task.parentPath || []).filter(p => p && p.id !== 'root' && String(p.title).trim().toLowerCase() !== 'root');
                                return filteredPath.map((pathItem, index) => (
                                <span key={pathItem.id}>
                                  <span 
                                    className="breadcrumb-item"
                                    onClick={() => handleBreadcrumbClick(pathItem.id)}
                                  >
                                    {pathItem.level}【{pathItem.title}】
                                  </span>
                                    {index < filteredPath.length - 1 && ' > '}
                                </span>
                                ));
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* 任務屬性管理面板 */}
            {activeTab === 'tags' && (
              <div className="task-tags-panel">
                <div className="tags-header">
                  <h3>任務屬性管理</h3>
                  <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
                    創建和管理任務屬性，屬性可用於在甘特圖中分類顯示任務
                  </p>
                </div>

                {/* 新增屬性區域 */}
                <div className="add-tag-section" style={{ 
                  padding: '16px', 
                  background: '#f8f9fa', 
                  borderRadius: '8px', 
                  marginBottom: '24px' 
                }}>
                  <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>新增屬性</h4>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="屬性名稱"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag();
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        flex: 1,
                        maxWidth: '300px'
                      }}
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      style={{
                        width: '50px',
                        height: '40px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    />
                    <button
                      onClick={handleAddTag}
                      style={{
                        padding: '8px 16px',
                        background: '#52D0FF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      新增
                    </button>
                  </div>
                </div>

                {/* 屬性列表 */}
                <div className="tags-list">
                  <h4 style={{ marginBottom: '16px', fontSize: '16px' }}>所有屬性</h4>
                  {taskTags.length === 0 ? (
                    <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                      還沒有屬性，請創建一個
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {taskTags.map(tag => (
                        <div
                          key={tag.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            background: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px'
                          }}
                        >
                          {editingTagId === tag.id ? (
                            <>
                              <input
                                type="text"
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  flex: 1,
                                  maxWidth: '200px'
                                }}
                              />
                              <input
                                type="color"
                                value={rgbToHex(editingTagColor)}
                                onChange={(e) => setEditingTagColor(hexToRgb(e.target.value))}
                                style={{
                                  width: '40px',
                                  height: '35px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              />
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '4px',
                                  background: editingTagColor,
                                  border: '1px solid #ddd',
                                  flexShrink: 0
                                }}
                              />
                              <button
                                onClick={() => {
                                  handleEditTag(tag.id, editingTagName, rgbToHex(editingTagColor));
                                  setEditingTagId(null);
                                  setEditingTagName('');
                                  setEditingTagColor('rgb(156, 39, 176)');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#52D0FF',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                保存
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTagId(null);
                                  setEditingTagName('');
                                  setEditingTagColor('rgb(156, 39, 176)');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#f0f0f0',
                                  color: '#333',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '4px',
                                  background: tag.color,
                                  flexShrink: 0
                                }}
                              />
                              <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>
                                {tag.name}
                              </span>
                              <span style={{ 
                                color: '#999', 
                                fontSize: '12px',
                                fontFamily: 'monospace'
                              }}>
                                {tag.color}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingTagId(tag.id);
                                  setEditingTagName(tag.name);
                                  setEditingTagColor(tag.color);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#f0f0f0',
                                  color: '#333',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                編輯
                              </button>
                              <button
                                onClick={() => handleDeleteTag(tag.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#ff4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                刪除
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 甘特圖面板 */}
            {activeTab === 'gantt' && (
              <div className="gantt-panel">
                  <div className="gantt-header">
                    <h3>甘特圖</h3>
                    <div className="gantt-controls">
                      <div className="gantt-display-mode-control">
                        <label style={{ marginRight: '8px', fontSize: '12px', color: '#666' }}>任務條顯示:</label>
                        <select
                          value={ganttTaskDisplayMode}
                          onChange={(e) => setGanttTaskDisplayMode(e.target.value)}
                          className="gantt-display-mode-select"
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #E8EDF2',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            backgroundColor: 'white',
                            marginRight: '10px'
                          }}
                        >
                          <option value="default">預設</option>
                          <option value="level">層級</option>
                          <option value="priority">優先級</option>
                          <option value="custom">屬性</option>
                        </select>
                      </div>
                      {ganttZoom === 'day' && (
                        <div className="day-view-controls">
                          <input 
                            type="date" 
                            value={dayViewDate.toISOString().split('T')[0]}
                            onChange={(e) => {
                              setDayViewDate(new Date(e.target.value));
                            }}
                            className="date-input-direct"
                          />
                          <div className="column-width-control">
                            <label>欄寬:</label>
                            <input
                              type="range"
                              min="20"
                              max="160"
                              value={ganttColumnWidth}
                              onChange={(e) => handleColumnWidthChange(parseInt(e.target.value))}
                              className="column-width-slider"
                            />
                            <span className="column-width-value">{ganttColumnWidth}px</span>
                          </div>
                        </div>
                      )}
                      <button 
                        className={`gantt-zoom-btn ${ganttZoom === 'day' ? 'active' : ''}`}
                        onClick={() => setGanttZoom('day')}
                      >
                        日視圖
                      </button>
                      <button 
                        className={`gantt-zoom-btn ${ganttZoom === 'week' ? 'active' : ''}`}
                        onClick={() => setGanttZoom('week')}
                      >
                        週視圖
                      </button>
                      <button 
                        className={`gantt-zoom-btn ${ganttZoom === 'month' ? 'active' : ''}`}
                        onClick={() => setGanttZoom('month')}
                      >
                        月視圖
                      </button>
                    </div>
                  </div>
                <div 
                  className={`gantt-container ${ganttZoom === 'day' ? 'day-view' : ''}`}
                  style={ganttZoom === 'day' ? {
                    height: `calc(24 * 30px + 50px + 60px)` // 固定行高30px計算日視圖高度
                  } : {}}
                >
                  <div 
                    className="gantt-timeline" 
                    ref={ganttTimelineRef}
                    onMouseLeave={handleTaskHoverLeave}
                  >
                    <div 
                      className="gantt-timeline-header"
                      style={{ 
                        width: `${ganttTimelineBase ? (ganttZoom === 'day' ? 
                          Math.max(1200, 24 * ganttColumnWidth) : // 日視圖：24小時 * 動態欄寬
                          ganttZoom === 'week' ? 
                          Math.max(1200, Math.ceil((ganttTimelineBase.endDate - ganttTimelineBase.startDate) / (1000 * 60 * 60 * 24)) * 41) :
                          Math.max(1200, (((ganttTimelineBase.endDate.getFullYear() - ganttTimelineBase.startDate.getFullYear()) * 12 + 
                            (ganttTimelineBase.endDate.getMonth() - ganttTimelineBase.startDate.getMonth())) + 1) * 41)
                        ) : 1200}px` 
                      }}
                    >
                      {renderTimelineHeader()}
                    </div>
                    <div 
                      className={`gantt-timeline-content ${ganttZoom === 'month' ? 'month-view' : ''}`}
                      style={{ 
                        width: `${ganttTimelineBase ? (ganttZoom === 'day' ? 
                          Math.max(1200, 24 * ganttColumnWidth) : // 日視圖：24小時 * 動態欄寬
                          ganttZoom === 'week' ? 
                          Math.max(1200, Math.ceil((ganttTimelineBase.endDate - ganttTimelineBase.startDate) / (1000 * 60 * 60 * 24)) * 41) :
                          Math.max(1200, (((ganttTimelineBase.endDate.getFullYear() - ganttTimelineBase.startDate.getFullYear()) * 12 + 
                            (ganttTimelineBase.endDate.getMonth() - ganttTimelineBase.startDate.getMonth())) + 1) * 41)
                        ) : 1200}px`,
                        position: 'relative'
                      }}
                    >
                      {ganttZoom === 'day' ? (
                        // 日視圖：顯示時間軸和任務條
                        <>
                          {/* 時間軸 */}
                          {Array.from({ length: 24 }, (_, index) => {
                            const hour = index;
                            const timeString = `${hour.toString().padStart(2, '0')}:00`;
                            
                            return (
                              <div 
                                key={index} 
                                className="gantt-time-row day-view-time-row"
                                style={{ height: '30px', display: 'flex', alignItems: 'center' }}
                              >
                                <div className="gantt-time-label-cell">
                                  {timeString}
                                </div>
                                {dayViewTasks.map(task => (
                                  <div 
                                    key={`${task.id}-${index}`}
                                    className="gantt-task-cell day-view-task-cell"
                                    style={{ width: `${ganttColumnWidth}px`, height: '30px', position: 'relative' }}
                                  >
                                    {/* 任務條只在對應的時間槽渲染 */}
                                    {renderDayTaskBar(task, index)}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </>
                      ) : ganttZoom === 'week' ? (
                        // 週視圖：顯示背景網格和任務條
                        <>
                          {ganttTimelineBase && (
                            // 週視圖：添加背景色網格
                            <div className="gantt-week-background" style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: `${Math.max(1200, Math.ceil((ganttTimelineBase.endDate - ganttTimelineBase.startDate) / (1000 * 60 * 60 * 24)) * 41)}px`,
                              height: '100%',
                              display: 'flex',
                              zIndex: 0
                            }}>
                              {(() => {
                                const dates = [];
                                const currentDate = new Date(ganttTimelineBase.startDate);
                                while (currentDate <= ganttTimelineBase.endDate) {
                                  dates.push(new Date(currentDate));
                                  currentDate.setDate(currentDate.getDate() + 1);
                                }
                                
                                return dates.map((date, index) => {
                                  // 計算真正的週數（星期一到星期日為一週）
                                  const dayOfWeek = date.getDay(); // 0=星期日, 1=星期一, ..., 6=星期六
                                  
                                  // 找到這個日期所在週的星期一
                                  const mondayOfWeek = new Date(date);
                                  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 如果是星期日，往前推6天；否則計算到星期一的距離
                                  mondayOfWeek.setDate(date.getDate() + daysToMonday);
                                  mondayOfWeek.setHours(0, 0, 0, 0);
                                  
                                  // 計算從1970年1月5日（第一個星期一）開始的週數
                                  const epochMonday = new Date(1970, 0, 5); // 1970年1月5日是星期一
                                  const weeksSinceEpoch = Math.floor((mondayOfWeek - epochMonday) / (7 * 24 * 60 * 60 * 1000));
                                  const isEvenWeek = weeksSinceEpoch % 2 === 0;
                                  
                                  // 判斷是否為假日（星期六、日）
                                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                  
                                  // 根據週數和是否假日選擇背景色
                                  let backgroundColor;
                                  if (isEvenWeek) {
                                    backgroundColor = isWeekend ? '#dcf5fa' : '#eaf8f9';
                                  } else {
                                    backgroundColor = isWeekend ? '#fffaea' : '#fffcf4';
                                  }
                                  
                                  return (
                                    <div 
                                      key={`bg-${index}`}
                                      style={{
                                        width: '41px',
                                        flex: '0 0 41px',
                                        backgroundColor: backgroundColor,
                                        borderRight: '1px solid #e0e0e0',
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                  );
                                });
                              })()}
                            </div>
                          )}
                          {ganttTasks.map(task => {
                            return (
                              <div 
                                key={task.id} 
                                className="gantt-task-bar-container"
                                style={{ paddingLeft: `${task.level * 20}px`, position: 'relative', zIndex: 1 }}
                              >
                                {renderTaskBar(task)}
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        // 月視圖：顯示任務條
                        <>
                          {ganttTasks.map(task => {
                          return (
                            <div 
                              key={task.id} 
                              className="gantt-task-bar-container"
                                style={{ paddingLeft: `${task.level * 20}px`, position: 'relative', zIndex: 1 }}
                            >
                              {renderTaskBar(task)}
                            </div>
                          );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
              </div>
            )}

            {/* 日曆視圖面板 */}
            {activeTab === 'calendar' && (
              <div className="calendar-panel">
                {renderCalendarView()}
              </div>
            )}
          </div>

              {/* 右側插入工具列（綠框區域） */}
              <div className={`insert-toolbar ${toolbarCollapsed ? 'collapsed' : ''}`}>
                <div className="toolbar-header">
                  <h4>🛠️ 插入工具列</h4>
                  <button 
                    className="collapse-btn"
                    onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
                    title={toolbarCollapsed ? '展開工具列' : '收縮工具列'}
                  >
                    {toolbarCollapsed ? '📂' : '📁'}
                  </button>
                </div>
                
                {!toolbarCollapsed && (
                  <div className="toolbar-content">
                    <button className="tool-btn" title="插入截止日期">
                      📅 截止日期
                    </button>
                    <button className="tool-btn" title="插入提前提醒">
                      ⏰ 提前提醒
                    </button>
                    <button className="tool-btn" title="插入任務描述">
                      📝 任務描述
                    </button>
                    <button className="tool-btn" title="插入子任務清單">
                      📋 子任務清單
                    </button>
                    <button 
                      className="tool-btn" 
                      title="插入文字膠囊"
                      onClick={handleInsertCapsules}
                    >
                      🏷️ 文字膠囊
                    </button>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {isEditing && editingTask && (
            <div className="task-edit">
              <h2>編輯任務</h2>
              <div className="edit-form">
                <div className="form-group">
                  <label>任務標題</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      title: e.target.value
                    })}
                    placeholder="輸入任務標題"
                  />
                </div>

                <div className="form-group">
                  <label>任務描述</label>
                  <textarea
                    value={editingTask.description || ''}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      description: e.target.value
                    })}
                    placeholder="輸入任務描述"
                  />
                </div>

                <div className="form-group">
                  <label>任務等級</label>
                  <select
                    value={editingTask.level}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      level: e.target.value
                    })}
                  >
                    <option value="NONE">未分類</option>
                    <option value="A">A 級</option>
                    <option value="B">B 級</option>
                    <option value="C">C 級</option>
                    <option value="D">D 級</option>
                    <option value="E">E 級</option>
                    <option value="F">F 級</option>
                    <option value="G">G 級</option>
                    <option value="H">H 級</option>
                    {editingTask.level && !['NONE', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(editingTask.level) && (
                      <option value={editingTask.level}>{editingTask.level} 級</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>父任務</label>
                  <select
                    value={editingTask.parentId || ''}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      parentId: e.target.value
                    })}
                  >
                    {getAvailableParents().map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="edit-actions">
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setEditingTask(null);
                    }}
                  >
                    取消
                  </button>
                  <button
                    className="save-btn"
                    onClick={handleEditTaskUpdate}
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{selectedParent && selectedParent !== 'root' ? '新增子任務' : '新增任務'}</h3>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedParent(null);
                  }}
                >
                  <IoClose />
                </button>
              </div>
             
              <div className="modal-body">
                <div className="form-group">
                  <label>任務標題</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      title: e.target.value
                    })}
                    placeholder="輸入任務標題"
                  />
                </div>

                <div className="form-group">
                  <label>任務描述</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      description: e.target.value
                    })}
                    placeholder="輸入任務描述"
                  />
                </div>

                <div className="form-group">
                  <label>任務等級</label>
                  <select
                    value={newTask.level}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      level: e.target.value
                    })}
                  >
                    <option value="NONE">未分類</option>
                    <option value="A">A 級</option>
                    <option value="B">B 級</option>
                    <option value="C">C 級</option>
                    <option value="D">D 級</option>
                    <option value="E">E 級</option>
                    <option value="F">F 級</option>
                    <option value="G">G 級</option>
                    <option value="H">H 級</option>
                  </select>
                </div>
               
                {selectedParent && selectedParent !== 'root' && (
                  <div className="form-info">
                    <p>注意：此任務將作為子任務添加到選定的父任務下，系統會自動調整任務等級。</p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedParent(null);
                  }}
                >
                  取消
                </button>
                <button
                  className="submit-btn"
                  onClick={handleAddTask}
                >
                  創建
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="notifications-container">
        {activeNotifications.map(notification => (
          <div key={notification.taskId} className="custom-notification">
            <div className="notification-content">
              <NotificationsIcon className="notification-icon" />
              <div className="notification-text">
                <span>{notification.message}</span>
                <CountdownTimer 
                  dueDate={findTaskById(tasks, notification.taskId)?.details?.dueDate} 
                />
              </div>
            </div>
            <button
              className="notification-close"
              onClick={() => setActiveNotifications(prev =>
                prev.filter(n => n.id !== notification.id)
              )}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {showTimePicker && (
        <div className="time-picker-overlay" onClick={() => setShowTimePicker(false)}>
          <div className="time-picker" onClick={(e)=>e.stopPropagation()}>
            <div className="time-picker-wheels">
              <div className="wheel">
                {[...Array(24)].map((_,i)=>{
                  const v=i; const label=String(v).padStart(2,'0');
                  return (
                    <div key={v} className={`wheel-item ${tpHour===v?'active':''}`} onClick={()=>setTpHour(v)}>{label}</div>
                  );
                })}
              </div>
              <div className="wheel">
                {[...Array(12)].map((_,i)=>{ const v=i*5; const label=String(v).padStart(2,'0');
                  return (
                    <div key={v} className={`wheel-item ${tpMinute===v?'active':''}`} onClick={()=>setTpMinute(v)}>{label}</div>
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
                  <input type="number" min={0} value={rpDaysCustom} onChange={(e)=>setRpDaysCustom(e.target.value.replace(/[^\d]/g,''))} />
                  <button className="mini-apply" onClick={()=>setRpDays(Math.max(0, parseInt(rpDaysCustom || '0',10)))}>套用</button>
                </div>
                {[...Array(200)].map((_,i)=> (
                  <div key={i} className={`wheel-item ${rpDays===i?'active':''}`} onClick={()=>setRpDays(i)}>{i} 天</div>
                ))}
              </div>
              <div className="wheel">
                {[...Array(25)].map((_,i)=> (
                  <div key={i} className={`wheel-item ${rpHours===i?'active':''}`} onClick={()=>setRpHours(i)}>{i} 小時</div>
                ))}
              </div>
              <div className="wheel">
                {[...Array(61)].map((_,i)=> (
                  <div key={i} className={`wheel-item ${rpMinutes===i?'active':''}`} onClick={()=>setRpMinutes(i)}>{String(i).padStart(2,'0')} 分</div>
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
      {/* 模板模態框 */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>任務模板</h3>
              <button className="modal-close" onClick={() => setShowTemplateModal(false)}>
                <IoClose />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="template-section">
                <h4>套用模板</h4>
                <div className="template-selector">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="template-select"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button className="apply-template-btn" onClick={applyTemplate}>
                    套用模板
                  </button>
                </div>
                {selectedTemplateId && (
                  <div className="template-preview">
                    <h5>模板預覽：</h5>
                    <p><strong>{templates.find(t => t.id === selectedTemplateId)?.rootTitle}</strong></p>
                    <p>{templates.find(t => t.id === selectedTemplateId)?.description}</p>
                  </div>
                )}
              </div>

              <div className="template-section">
                <h4>儲存為模板</h4>
                <p>將目前選中的任務儲存為新模板</p>
                <button 
                  className="save-template-btn" 
                  onClick={saveCurrentAsTemplate}
                  disabled={!selectedTask}
                >
                  儲存為模板
                </button>
                {!selectedTask && (
                  <p className="template-hint">請先選擇一個任務</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 右鍵選單 */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
          onClick={hideContextMenu}
        >
          <div className="context-menu-content" onClick={(e) => e.stopPropagation()}>
            <div className="context-menu-item" onClick={() => handleDeleteTask(contextMenu.taskId)}>
              刪除任務
            </div>
            <div className="context-menu-item" onClick={() => handleCopyTask(contextMenu.taskId)}>
              複製任務
            </div>
            <div className="context-menu-item" onClick={() => handleMoveTask(contextMenu.taskId)}>
              移動到...
            </div>
          </div>
        </div>
      )}

      {/* 移動任務對話框 */}
      {showMoveDialog && moveTargetTask && (
        <div className="modal-overlay" onClick={() => setShowMoveDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>移動任務：{moveTargetTask.title}</h3>
              <button
                className="close-btn"
                onClick={() => setShowMoveDialog(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>選擇新的父任務：</p>
              <div className="move-search-container">
                <input
                  type="text"
                  placeholder="搜尋任務名稱..."
                  value={moveSearchTerm}
                  onChange={(e) => setMoveSearchTerm(e.target.value)}
                  className="move-search-input"
                />
              </div>
              <div className="move-task-options">
                {allTasks
                  .filter(task => task.id !== moveTargetTask.id)
                  .filter(task => 
                    moveSearchTerm === '' || 
                    task.title.toLowerCase().includes(moveSearchTerm.toLowerCase())
                  )
                  .map(task => (
                    <div 
                      key={task.id}
                      className="move-option"
                      onClick={() => executeMoveTask(moveTargetTask.id, task.id)}
                    >
                      <span className={`level-badge level-${String(task.level).toLowerCase()}`}>
                        {task.level}
                      </span>
                      <div className="task-text-block">
                        <span className="task-title">{task.title}</span>
                        <span className="task-path">{task.breadcrumb}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 膠囊刪除確認對話框 */}
      {showCapsuleDeleteDialog && (
        <div className="modal-overlay" onClick={() => {
          setShowCapsuleDeleteDialog(false);
          setDeletingCapsuleId(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>刪除文字膠囊</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowCapsuleDeleteDialog(false);
                  setDeletingCapsuleId(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>此膠囊已生成任務，請選擇刪除方式：</p>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowCapsuleDeleteDialog(false);
                  setDeletingCapsuleId(null);
                }}
              >
                取消
              </button>
              <button
                className="submit-btn"
                onClick={confirmDeleteCapsuleOnly}
                style={{ marginRight: '8px' }}
              >
                只刪除文字膠囊
              </button>
              <button
                className="delete-btn"
                onClick={confirmDeleteCapsuleWithTasks}
              >
                刪除生成的任務
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 懸停視窗 */}
      {hoverTooltip.visible && hoverTooltip.task && (
        <div 
          className="task-hover-tooltip"
          style={{
            position: 'fixed',
            left: `${hoverTooltip.x}px`,
            top: `${hoverTooltip.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div className="tooltip-content">
            <div className="tooltip-header">
              <div className="tooltip-icon">
                {hoverTooltip.task.icon?.type === 'custom' ? (
                  <img src={hoverTooltip.task.icon.url} alt="" />
                ) : hoverTooltip.task.icon?.type === 'default' ? (
                  (() => {
                    const IconComponent = DEFAULT_ICONS.find(i => i.name === hoverTooltip.task.icon.name)?.icon;
                    return IconComponent ? <IconComponent size={16} /> : null;
                  })()
                ) : null}
              </div>
              <div className="tooltip-info">
                <div className="tooltip-title">{hoverTooltip.task.title}</div>
                {hoverTooltip.task.details?.dueDate && (
                  <div className="tooltip-date">
                    截止: {new Date(hoverTooltip.task.details.dueDate).toLocaleString()}
                  </div>
                )}
                {hoverTooltip.task.tagId && (() => {
                  const tag = getTagById(hoverTooltip.task.tagId);
                  return tag ? (
                    <div className="tooltip-tag" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      marginTop: '4px',
                      fontSize: '11px',
                      color: '#666'
                    }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '3px',
                          background: tag.color,
                          border: '1px solid #ddd',
                          flexShrink: 0
                        }}
                      />
                      <span>任務屬性: {tag.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
            {hoverTooltip.task.description && (
              <div className="tooltip-description">
                <div 
                  dangerouslySetInnerHTML={{ __html: hoverTooltip.task.description }}
                  style={{ 
                    maxWidth: '240px', 
                    maxHeight: '120px', 
                    overflow: 'hidden',
                    lineHeight: '1.3'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </DragDropContext>
  );
};

export default ProjectList;