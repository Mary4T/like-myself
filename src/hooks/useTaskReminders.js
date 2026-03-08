import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useTaskReminders Hook
 * 負責管理任務提醒邏輯、權限請求及背景掃描引擎
 */
export const useTaskReminders = (tasks, updateTasksAndSave) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeNotifications, setActiveNotifications] = useState(() => {
    const saved = localStorage.getItem('activeNotifications');
    return saved ? JSON.parse(saved) : [];
  }); // 存儲應用程式內的活動通知 (持久化)
  const [appNotifications, setAppNotifications] = useState([]); // 存儲畫面上顯示的 Toast (僅限當前會話)
  const [countdownData, setCountdownData] = useState({}); 
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [rpIndex, setRpIndex] = useState(-1);
  const [rpDays, setRpDays] = useState(0);
  const [rpHours, setRpHours] = useState(0);
  const [rpMinutes, setRpMinutes] = useState(0);
  const [rpDaysCustom, setRpDaysCustom] = useState('');
  const notificationHistory = useRef(null);
  
  // 初始化 notificationHistory
  if (notificationHistory.current === null) {
    const saved = localStorage.getItem('notificationHistory');
    notificationHistory.current = saved ? JSON.parse(saved) : {};
  }

  // 持久化通知歷史與活動通知
  useEffect(() => {
    localStorage.setItem('notificationHistory', JSON.stringify(notificationHistory.current));
  }, [appNotifications]); // 這裡改為監聽 appNotifications 的變化來保存歷史

  useEffect(() => {
    localStorage.setItem('activeNotifications', JSON.stringify(activeNotifications));
  }, [activeNotifications]);

  // 1. 請求通知權限
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
    return permission === "granted";
  }, []);

  // 2. 移除 Toast 通知
  const dismissToast = useCallback((id) => {
    setAppNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // 3. 發送通知函數 (系統 + 應用程式內)
  const sendNotification = useCallback((task, type, reminderIndex = null) => {
    const isExpired = type === 'expired';
    const now = new Date();
    // 修改：Key 包含 reminderIndex，確保同一個任務的多個提醒都能觸發
    const notificationKey = reminderIndex !== null ? `${type}-${task.id}-${reminderIndex}` : `${type}-${task.id}`;
    
    // 檢查歷史記錄
    if (notificationHistory.current[notificationKey]) {
      const lastTime = new Date(notificationHistory.current[notificationKey]);
      // 過期通知永久不重複；提醒通知 24 小時內不重複
      if (isExpired || (now - lastTime < 24 * 60 * 60 * 1000)) return;
    }

    notificationHistory.current[notificationKey] = now.toISOString();
    localStorage.setItem('notificationHistory', JSON.stringify(notificationHistory.current));

    const notificationObj = {
      id: `${task.id}-${type}-${reminderIndex || 'exp'}-${now.getTime()}`,
      title: isExpired ? '任務已過期' : '任務提醒',
      message: isExpired ? `任務「${task.title}」已過期！` : `任務「${task.title}」即將到期！`,
      taskTitle: task.title,
      timestamp: now,
      taskId: task.id,
      type
    };

    // A. 更新應用程式內 Toast 列表
    setAppNotifications(prev => [...prev, notificationObj]);

    // B. 更新活動通知中心
    setActiveNotifications(prev => [
      ...prev.filter(n => n.taskId !== task.id || n.type !== type),
      notificationObj
    ]);

    // C. 發送系統通知
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(notificationObj.title, {
          body: notificationObj.message,
          icon: '/favicon.ico',
          requireInteraction: true,
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (e) { console.error("系統通知發送失敗", e); }
    }
  }, []);

  // 4. 核心檢查引擎
  const checkReminders = useCallback(() => {
    const now = new Date();
    const newCountdownData = {};

    const scanTasks = (taskList) => {
      taskList.forEach(task => {
        if (task.id === 'root' || task.status === 'completed') {
          if (task.children) scanTasks(task.children);
          return;
        }
        
        const reminders = task.details?.reminders || [];
        let dueDateStr = task.details?.dueDate;
        if (!dueDateStr) {
          if (task.children) scanTasks(task.children);
          return;
        }

        // 修正日期解析：如果是純日期 YYYY-MM-DD，補上時間以確保按本地時間解析
        // 否則 new Date('YYYY-MM-DD') 會被當作 UTC 0 點，導致東八區早上就過期
        let finalDueDateStr = dueDateStr;
        if (finalDueDateStr.length === 10) {
          finalDueDateStr += 'T23:59:59'; // 預設為當天最後一秒
        }
        const dueDate = new Date(finalDueDateStr);
        
        // 更新倒數計時數據
        const diff = dueDate.getTime() - now.getTime();
        if (diff > 0) {
          const d = Math.floor(diff / (1000 * 60 * 60 * 24));
          const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          newCountdownData[task.id] = `${d > 0 ? d + '天 ' : ''}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        } else {
          newCountdownData[task.id] = '已逾期';
        }

        // 檢查通知觸發
        if (dueDate < now) {
          sendNotification(task, 'expired');
        } else if (reminders.length > 0) {
          reminders.forEach((reminder, index) => {
            const offsetMs = (
              (parseInt(reminder.days || 0) * 24 * 60 * 60 * 1000) +
              (parseInt(reminder.hours || 0) * 60 * 60 * 1000) +
              (parseInt(reminder.minutes || 0) * 60 * 1000)
            );
            const reminderTime = new Date(dueDate.getTime() - offsetMs);
            
            if (now >= reminderTime && now < dueDate) {
              sendNotification(task, 'reminder', index); // 傳入 index 區分多個提醒
            }
          });
        }
        if (task.children) scanTasks(task.children);
      });
    };
    scanTasks(tasks);
    setCountdownData(newCountdownData);
  }, [tasks, sendNotification]);

  // 5. 啟動定時掃描
  useEffect(() => {
    const timer = setInterval(checkReminders, 1000); // 改為 1 秒檢查一次，以支援倒數計時
    checkReminders();
    return () => clearInterval(timer);
  }, [checkReminders]);

  // 6. 管理提醒列表的操作
  const openReminderPicker = useCallback((reminder, index) => {
    setRpIndex(index);
    setRpDays(reminder?.days || 0);
    setRpHours(reminder?.hours || 0);
    setRpMinutes(reminder?.minutes || 0);
    setRpDaysCustom('');
    setShowReminderPicker(true);
  }, []);

  const confirmReminderPicker = useCallback((selectedTaskId) => {
    if (!selectedTaskId || rpIndex < 0) { setShowReminderPicker(false); return; }
    updateTasksAndSave(prev => {
      const task = findTaskById(prev, selectedTaskId);
      if (!task) return prev;
      const list = [...(task.details?.reminders || [])];
      list[rpIndex] = { days: rpDays, hours: rpHours, minutes: rpMinutes };
      return updateTaskInTree(prev, selectedTaskId, {
        details: { ...task.details, reminders: list }
      });
    });
    setShowReminderPicker(false);
  }, [rpIndex, rpDays, rpHours, rpMinutes, updateTasksAndSave]);

  const addReminder = useCallback((taskId) => {
    updateTasksAndSave(prev => {
      const task = findTaskById(prev, taskId);
      if (!task) return prev;
      const list = [...(task.details?.reminders || [])];
      list.push({ days: 0, hours: 0, minutes: 30 });
      return updateTaskInTree(prev, taskId, {
        details: { ...task.details, reminders: list }
      });
    });
  }, [updateTasksAndSave]);

  const removeReminder = useCallback((taskId, index) => {
    updateTasksAndSave(prev => {
      const task = findTaskById(prev, taskId);
      if (!task) return prev;
      const currentReminders = task.details?.reminders || [];
      const newReminders = currentReminders.filter((_, i) => i !== index);
      return updateTaskInTree(prev, taskId, {
        details: { ...task.details, reminders: newReminders }
      });
    });
  }, [updateTasksAndSave]);

  // 輔助函數
  const findTaskById = (list, id) => {
    for (const t of list) {
      if (t.id === id) return t;
      if (t.children) {
        const found = findTaskById(t.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const updateTaskInTree = (list, id, updates) => {
    return list.map(t => {
      if (t.id === id) return { ...t, ...updates };
      if (t.children) return { ...t, children: updateTaskInTree(t.children, id, updates) };
      return t;
    });
  };

  return {
    notificationsEnabled,
    activeNotifications,
    setActiveNotifications,
    appNotifications,
    dismissToast,
    countdownData,
    requestPermission,
    addReminder,
    removeReminder,
    checkReminders,
    showReminderPicker,
    setShowReminderPicker,
    openReminderPicker,
    confirmReminderPicker,
    rpDays, setRpDays,
    rpHours, setRpHours,
    rpMinutes, setRpMinutes,
    rpDaysCustom, setRpDaysCustom
  };
};
