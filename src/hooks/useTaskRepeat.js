import { useState, useCallback, useMemo } from 'react';
import * as TaskUtils from '../components/ProjectTasks/taskUtils';

export const useTaskRepeat = (selectedTask, updateTasksAndSave, getLocalDateKey) => {
  const [showRepeatLogModal, setShowRepeatLogModal] = useState(false);
  const [repeatLogActiveTab, setRepeatLogActiveTab] = useState('log');
  const [expandedLogEntries, setExpandedLogEntries] = useState(new Set());
  const [showAllSubtasks, setShowAllSubtasks] = useState(false);

  // 1. 基礎數據：日誌條目
  const repeatLogEntries = useMemo(() => {
    if (!selectedTask) return [];
    const log = selectedTask.details?.repeatLog || {};
    return Object.entries(log).map(([dateKey, info]) => ({
      dateKey,
      displayDate: dateKey,
      completed: Boolean(info?.completed),
      maxProgress: info?.maxProgress ?? null,
      taskSnapshot: info?.taskSnapshot || []
    })).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [selectedTask]);

  const recentRepeatLogEntries = useMemo(() => [...repeatLogEntries].reverse().slice(0, 30), [repeatLogEntries]);

  // 2. 數據分析邏輯
  const repeatLogAnalysis = useMemo(() => {
    const entries = repeatLogEntries;
    if (!entries.length) return {
      total: 0, completedCount: 0, completionRate: 0, currentStreak: 0,
      longestStreak: 0, recentCompletionRate: 0, recentTrend: [],
      dailyTrend: [], highPerformers: [], lowPerformers: []
    };

    const total = entries.length;
    let completedCount = 0, currentStreak = 0, longestStreak = 0, totalProgress = 0;

    const normalizeProgress = (entry) => {
      if (entry.completed) return 100;
      const numeric = Number(entry.maxProgress);
      return Math.max(0, Math.min(100, Number.isFinite(numeric) ? numeric : 0));
    };

    entries.forEach(entry => {
      const progressValue = normalizeProgress(entry);
      totalProgress += progressValue;
      if (entry.completed || progressValue >= 100) {
        completedCount += 1;
        currentStreak += 1;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        const now = new Date();
        const unit = selectedTask?.details?.repeat?.unit || 'day';
        const todayKey = getLocalDateKey(now, unit);
        if (entry.dateKey !== todayKey) currentStreak = 0;
      }
    });

    const completionRate = Math.round(totalProgress / total);
    const recentWindow = entries.slice(-7);
    const recentProgressSum = recentWindow.reduce((sum, entry) => sum + normalizeProgress(entry), 0);
    const recentCompletionRate = recentWindow.length ? Math.round(recentProgressSum / recentWindow.length) : 0;

    // 趨勢圖數據
    const dailyMap = new Map();
    entries.forEach(entry => {
      const dateKey = entry.dateKey.length >= 10 ? entry.dateKey.slice(0, 10) : entry.displayDate.split(' ')[0];
      const existing = dailyMap.get(dateKey) || { date: dateKey, total: 0, completed: 0, progressSum: 0 };
      existing.total += 1;
      const progressValue = normalizeProgress(entry);
      existing.progressSum += progressValue;
      if (entry.completed || progressValue >= 100) existing.completed += 1;
      dailyMap.set(dateKey, existing);
    });

    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)).map(item => ({
      date: item.date.split('-').slice(-2).join('/'),
      total: item.total,
      completed: item.completed,
      value: item.total ? Math.round(item.progressSum / item.total) : 0
    }));

    // 子任務分析
    const subtaskStats = new Map();
    const processSnapshot = (nodes) => {
      nodes.forEach(node => {
        const stats = subtaskStats.get(node.title) || { title: node.title, total: 0, completed: 0 };
        stats.total += 1;
        if (node.completed) stats.completed += 1;
        subtaskStats.set(node.title, stats);
        if (node.children) processSnapshot(node.children);
      });
    };
    entries.forEach(entry => { if (entry.taskSnapshot) processSnapshot(entry.taskSnapshot); });

    const subtaskAnalysis = Array.from(subtaskStats.values()).map(s => ({
      ...s,
      rate: Math.round((s.completed / s.total) * 100)
    }));

    const highPerformers = subtaskAnalysis.filter(s => s.rate >= 50).sort((a, b) => b.rate - a.rate);
    const lowPerformers = subtaskAnalysis.filter(s => s.rate < 50).sort((a, b) => a.rate - b.rate);

    return {
      total, completedCount, completionRate, currentStreak, longestStreak,
      recentCompletionRate, recentTrend: dailyTrend.slice(-14),
      dailyTrend, highPerformers, lowPerformers
    };
  }, [repeatLogEntries, selectedTask?.details?.repeat?.unit, getLocalDateKey]);

  // 3. 操作函數
  const handleUpdateSnapshot = useCallback((dateKey, targetSnapshotId, isCompleted) => {
    if (!selectedTask) return;
    updateTasksAndSave(prev => {
      const task = TaskUtils.findTaskById(prev, selectedTask.id);
      if (!task) return prev;
      const nextLog = { ...(task.details?.repeatLog || {}) };
      const entry = nextLog[dateKey];
      if (!entry || !entry.taskSnapshot) return prev;

      const updateSnapshotRecursive = (nodes) => {
        return nodes.map(node => {
          if (node.id === targetSnapshotId) {
            const updateAll = (n) => ({
              ...n, completed: isCompleted, status: isCompleted ? 'completed' : 'pending',
              children: n.children ? n.children.map(updateAll) : []
            });
            return updateAll(node);
          }
          if (node.children && node.children.length > 0) {
            const updatedChildren = updateSnapshotRecursive(node.children);
            const hasChanged = updatedChildren.some((child, idx) => child !== node.children[idx]);
            if (hasChanged) {
              const allCompleted = updatedChildren.every(c => c.completed);
              return { ...node, children: updatedChildren, completed: allCompleted, status: allCompleted ? 'completed' : 'pending' };
            }
          }
          return node;
        });
      };

      const nextSnapshot = updateSnapshotRecursive(entry.taskSnapshot);
      const totalNodes = nextSnapshot.length;
      const completedNodes = nextSnapshot.filter(n => n.completed).length;
      const nextProgress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : entry.maxProgress;
      const nextAllCompleted = totalNodes > 0 && nextSnapshot.every(n => n.completed);

      nextLog[dateKey] = { ...entry, taskSnapshot: nextSnapshot, maxProgress: nextProgress, completed: nextAllCompleted };
      return TaskUtils.updateTaskInTree(prev, selectedTask.id, { details: { ...task.details, repeatLog: nextLog } });
    });
  }, [selectedTask, updateTasksAndSave]);

  const handleDeleteEntry = useCallback((dateKey) => {
    if (!selectedTask) return;
    updateTasksAndSave(prev => {
      const task = TaskUtils.findTaskById(prev, selectedTask.id);
      if (!task) return prev;
      const log = { ...(task.details?.repeatLog || {}) };
      delete log[dateKey];
      return TaskUtils.updateTaskInTree(prev, selectedTask.id, { details: { ...task.details, repeatLog: log } });
    });
  }, [selectedTask, updateTasksAndSave]);

  const handleClearLog = useCallback(() => {
    if (!selectedTask) return;
    if (window.confirm('確定要清空所有重複日誌嗎？此操作不可撤銷。')) {
      updateTasksAndSave(prev => {
        const task = TaskUtils.findTaskById(prev, selectedTask.id);
        if (!task) return prev;
        return TaskUtils.updateTaskInTree(prev, selectedTask.id, { details: { ...task.details, repeatLog: {} } });
      });
    }
  }, [selectedTask, updateTasksAndSave]);

  const handleToggleEntryStatus = useCallback((dateKey, currentCompleted) => {
    if (!selectedTask) return;
    const nextCompleted = !currentCompleted;
    updateTasksAndSave(prev => {
      const task = TaskUtils.findTaskById(prev, selectedTask.id);
      if (!task) return prev;
      const nextLog = { ...(task.details?.repeatLog || {}) };
      const entry = nextLog[dateKey];
      
      const updateAllSnapshot = (nodes) => nodes.map(n => ({
        ...n, completed: nextCompleted, status: nextCompleted ? 'completed' : 'pending',
        children: n.children ? updateAllSnapshot(n.children) : []
      }));

      nextLog[dateKey] = {
        ...entry,
        completed: nextCompleted,
        maxProgress: nextCompleted ? 100 : 0,
        taskSnapshot: entry.taskSnapshot ? updateAllSnapshot(entry.taskSnapshot) : []
      };
      return TaskUtils.updateTaskInTree(prev, selectedTask.id, { details: { ...task.details, repeatLog: nextLog } });
    });
  }, [selectedTask, updateTasksAndSave]);

  return {
    showModal: showRepeatLogModal,
    setShowModal: setShowRepeatLogModal,
    activeTab: repeatLogActiveTab,
    setActiveTab: setRepeatLogActiveTab,
    expandedEntries: expandedLogEntries,
    setExpandedEntries: setExpandedLogEntries,
    showAllSubtasks,
    setShowAllSubtasks,
    entries: repeatLogEntries,
    recentEntries: recentRepeatLogEntries,
    analysis: repeatLogAnalysis,
    handleUpdateSnapshot,
    handleDeleteEntry,
    handleClearLog,
    handleToggleEntryStatus
  };
};
