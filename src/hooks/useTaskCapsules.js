import { useState, useCallback, useEffect } from 'react';
import * as TaskUtils from '../components/ProjectTasks/taskUtils';

export const useTaskCapsules = (selectedTaskId, updateTasksAndSave, selectedTask) => {
  const [taskCapsuleStates, setTaskCapsuleStates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('taskCapsuleStates')) || {}; } catch { return {}; }
  });
  const [editingCapsuleId, setEditingCapsuleId] = useState(null);
  const [editingCapsuleText, setEditingCapsuleText] = useState('');

  useEffect(() => {
    localStorage.setItem('taskCapsuleStates', JSON.stringify(taskCapsuleStates));
  }, [taskCapsuleStates]);

  const getCurrentState = useCallback(() => {
    return taskCapsuleStates[selectedTaskId] || { 
      capsules: [], 
      showCapsules: false,
      capsuleTaskTemplate: { tasks: [] },
      generatedCapsuleIds: [],
      targetParentId: selectedTaskId, 
      placeholderTaskId: null,        
      placeholderEnabled: false       
    };
  }, [taskCapsuleStates, selectedTaskId]);

  const updateState = useCallback((updates) => {
    if (!selectedTaskId) return;
    setTaskCapsuleStates(prev => {
      const current = prev[selectedTaskId] || { 
        capsules: [], 
        showCapsules: false,
        capsuleTaskTemplate: { tasks: [] },
        generatedCapsuleIds: [],
        targetParentId: selectedTaskId,
        placeholderTaskId: null,
        placeholderEnabled: false
      };
      return {
        ...prev,
        [selectedTaskId]: { ...current, ...updates }
      };
    });
  }, [selectedTaskId]);

  // --- 佔位符管理 ---
  const togglePlaceholder = useCallback(() => {
    const currentState = getCurrentState();
    const isEnabling = !currentState.placeholderEnabled;
    
    if (isEnabling) {
      // 獲取最新任務數據以確保抓到名稱
      const allTasks = JSON.parse(localStorage.getItem('projectTasks') || '[]');
      const latestSelectedTask = TaskUtils.findTaskById(allTasks, selectedTaskId);
      
      // 建立一個可拖拽的佔位任務
      const placeholderId = `placeholder-${Date.now()}`;
      const placeholderTask = {
        id: placeholderId,
        title: `${latestSelectedTask?.title || '原任務'} 佔位符號`,
        level: 'A',
        status: 'pending',
        isPlaceholder: true,
        created: new Date().toISOString(),
        children: [],
        details: { progress: 0 }
      };
      
      // 1. 預設生成為原任務的子任務
      updateTasksAndSave(prev => TaskUtils.addChildToTask(prev, selectedTaskId, placeholderTask));
      // 3. 啟用佔位符時，關閉目標父任務模式
      updateState({ 
        placeholderEnabled: true, 
        placeholderTaskId: placeholderId,
        targetParentId: null 
      });
    } else {
      // 移除佔位任務
      if (currentState.placeholderTaskId) {
        updateTasksAndSave(prev => TaskUtils.removeTaskFromTree(prev, currentState.placeholderTaskId).tasks);
      }
      updateState({ placeholderEnabled: false, placeholderTaskId: null });
    }
  }, [getCurrentState, updateTasksAndSave, updateState, selectedTaskId, selectedTask]);

  const setTargetParent = useCallback((taskId) => {
    // 3. 設定目標父任務時，關閉佔位符模式
    const currentState = getCurrentState();
    if (currentState.placeholderEnabled && currentState.placeholderTaskId) {
      updateTasksAndSave(prev => TaskUtils.removeTaskFromTree(prev, currentState.placeholderTaskId).tasks);
    }
    updateState({ 
      targetParentId: taskId, 
      placeholderEnabled: false, 
      placeholderTaskId: null 
    });
  }, [updateState, getCurrentState, updateTasksAndSave]);

  // --- 膠囊 CRUD ---
  const addCapsule = () => {
    const currentState = getCurrentState();
    const newCapsule = { id: `cap-${Date.now()}`, text: '' };
    updateState({ capsules: [...(currentState.capsules || []), newCapsule] });
    setEditingCapsuleId(newCapsule.id);
    setEditingCapsuleText('');
  };

  const updateCapsule = (id, text) => {
    const currentState = getCurrentState();
    updateState({ capsules: currentState.capsules.map(c => c.id === id ? { ...c, text } : c) });
  };

  // 尋找由特定膠囊生成的任務數量
  const getGeneratedTasksCount = useCallback((capsuleId) => {
    const allTasksStr = localStorage.getItem('projectTasks');
    if (!allTasksStr) return 0;
    
    try {
      const allTasks = JSON.parse(allTasksStr);
      let count = 0;
      
      const countRecursive = (nodes) => {
        nodes.forEach(node => {
          if (node.originalCapsuleId === capsuleId) count++;
          if (node.children && node.children.length > 0) countRecursive(node.children);
        });
      };
      
      countRecursive(allTasks);
      return count;
    } catch (e) {
      console.error('Error counting generated tasks:', e);
      return 0;
    }
  }, []);

  const removeCapsule = (id, deleteTasks = false) => {
    const currentState = getCurrentState();
    
    if (deleteTasks) {
      updateTasksAndSave(prevTasks => {
        const removeRecursive = (nodes) => nodes.filter(node => {
          if (node.originalCapsuleId === id) return false;
          if (node.children) {
            node.children = removeRecursive(node.children);
          }
          return true;
        });
        return removeRecursive([...prevTasks]);
      });
    } else {
      updateTasksAndSave(prevTasks => {
        const unlinkRecursive = (nodes) => nodes.map(node => {
          if (node.originalCapsuleId === id) {
            const { originalCapsuleId, ...rest } = node;
            return { ...rest, children: node.children ? unlinkRecursive(node.children) : [] };
          }
          if (node.children) return { ...node, children: unlinkRecursive(node.children) };
          return node;
        });
        return unlinkRecursive([...prevTasks]);
      });
    }

    const newGeneratedIds = (currentState.generatedCapsuleIds || []).filter(gid => gid !== id);
    updateState({ 
      capsules: currentState.capsules.filter(c => c.id !== id),
      generatedCapsuleIds: newGeneratedIds
    });
  };

  // --- 新增：僅刪除生成的任務（保留膠囊） ---
  const deleteGeneratedTasksOnly = (id) => {
    const currentState = getCurrentState();
    
    updateTasksAndSave(prevTasks => {
      const removeRecursive = (nodes) => nodes.filter(node => {
        if (node.originalCapsuleId === id) return false;
        if (node.children) {
          node.children = removeRecursive(node.children);
        }
        return true;
      });
      return removeRecursive([...prevTasks]);
    });

    // 重置該膠囊的「已生成」狀態，讓它可以再次點擊生成
    const newGeneratedIds = (currentState.generatedCapsuleIds || []).filter(gid => gid !== id);
    updateState({ 
      generatedCapsuleIds: newGeneratedIds
    });
  };

  // --- 模板設計器邏輯 ---
  const updateTemplateTasks = (newTasks) => {
    updateState({ capsuleTaskTemplate: { tasks: newTasks } });
  };

  const importFromGeneralTemplate = (template) => {
    const convertNode = (node) => ({
      id: `tpl-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: node.title || '',
      children: (node.children || []).map(convertNode)
    });

    const convertedTasks = (template.tree || []).map(convertNode);
    updateState({ capsuleTaskTemplate: { tasks: convertedTasks } });
  };

  // --- 核心批次生成算法 ---
  const generateTasks = () => {
    const DEFAULT_REPEAT = { enabled: false, interval: 1, unit: 'day', base: 'startDate', lastResetAt: null };
    const currentState = getCurrentState();
    const templateTasks = currentState.capsuleTaskTemplate?.tasks || [];
    const capsulesToProcess = (currentState.capsules || []).filter(
      c => c.text.trim() !== '' && !currentState.generatedCapsuleIds?.includes(c.id)
    );

    if (capsulesToProcess.length === 0 || templateTasks.length === 0) {
      alert('請先新增膠囊並設計模板');
      return;
    }

    let targetLocation = currentState.placeholderEnabled && currentState.placeholderTaskId 
      ? currentState.placeholderTaskId 
      : (currentState.targetParentId || selectedTaskId);

    updateTasksAndSave(prevTasks => {
      const latestSelectedTask = TaskUtils.findTaskById(prevTasks, selectedTaskId);
      
      // 確定目標任務
      const finalTargetId = targetLocation || selectedTaskId;
      const targetTask = TaskUtils.findTaskById(prevTasks, finalTargetId);
      
      if (!targetTask) {
        alert('找不到目標位置，請重新設定');
        return prevTasks;
      }

      let newTasksState = prevTasks;
      const newGeneratedIds = [...(currentState.generatedCapsuleIds || [])];
      const allNewGeneratedTasks = [];

      capsulesToProcess.forEach(capsule => {
        const buildTasksFromTemplate = (nodes, parentLvl, isFirstLevel = false) => {
          const calculateNextLevel = (lvl) => {
            const levels = ['A', 'B', 'C', 'D', 'E'];
            const idx = levels.indexOf(lvl);
            return idx < levels.length - 1 ? levels[idx + 1] : 'E';
          };

          return nodes.map(node => {
            // 如果是模板的第一層，且目標是佔位符，則繼承佔位符的層級
            // 否則計算下一層級
            const currentLevel = (isFirstLevel && currentState.placeholderEnabled) 
              ? targetTask.level 
              : calculateNextLevel(parentLvl);
            
            const finalTitle = (node.title || '').replace(/（膠囊）/g, capsule.text);

            return {
              id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: finalTitle,
              status: 'pending',
              level: currentLevel,
              created: new Date().toISOString(),
              tags: latestSelectedTask?.tags || [], 
              priority: latestSelectedTask?.priority || 'medium', 
              details: { 
                progress: 0,
                startDate: latestSelectedTask?.details?.startDate || null,
                dueDate: latestSelectedTask?.details?.dueDate || null,
                startTime: latestSelectedTask?.details?.startTime || '00:00',
                dueTime: latestSelectedTask?.details?.dueTime || '00:00',
                repeat: { ...DEFAULT_REPEAT }
              },
              originalCapsuleId: capsule.id,
              sourceTaskId: selectedTaskId,
              isGeneratedTask: true,
              children: node.children ? buildTasksFromTemplate(node.children, currentLevel) : []
            };
          });
        };

        const generatedNodes = buildTasksFromTemplate(templateTasks, targetTask.level, true);
        allNewGeneratedTasks.push(...generatedNodes);
        newGeneratedIds.push(capsule.id);
      });

      const updateTreeWithInsertion = (taskList) => {
        const result = [];
        for (const task of taskList) {
          if (currentState.placeholderEnabled && task.id === targetLocation) {
            const indicator = {
              ...task,
              title: task.title, 
              isPlaceholder: true, // 保持為佔位符狀態，確保 renderTaskVisual 繼續套用灰字樣式
              isPlaceholderHeader: true,
              style: { color: '#999' }
            };
            result.push(indicator, ...allNewGeneratedTasks);
            continue;
          }
          
          if (!currentState.placeholderEnabled && task.id === targetLocation) {
            result.push({ ...task, children: [...(task.children || []), ...allNewGeneratedTasks] });
            continue;
          }

          if (task.children) {
            result.push({ ...task, children: updateTreeWithInsertion(task.children) });
          } else {
            result.push(task);
          }
        }
        return result;
      };

      newTasksState = updateTreeWithInsertion(newTasksState);
      updateState({ generatedCapsuleIds: newGeneratedIds });
      return newTasksState;
    });
  };

  const mergeCapsuleStates = useCallback((updates) => {
    setTaskCapsuleStates(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    capsuleState: getCurrentState(),
    togglePanel: () => updateState({ showCapsules: !getCurrentState().showCapsules }),
    addCapsule, updateCapsule, removeCapsule, generateTasks,
    getGeneratedTasksCount,
    deleteGeneratedTasksOnly,
    togglePlaceholder, setTargetParent,
    editingCapsuleId, setEditingCapsuleId, editingCapsuleText, setEditingCapsuleText,
    updateTemplateTasks, importFromGeneralTemplate,
    updateState,
    mergeCapsuleStates,
    insertCapsuleText: useCallback((text) => {
      if (!selectedTaskId) return;
      updateTasksAndSave(prev => {
        const task = TaskUtils.findTaskById(prev, selectedTaskId);
        if (!task) return prev;
        
        const currentTitle = task.title || '';
        if (currentTitle === '新任務' || currentTitle.trim() === '') {
          return TaskUtils.updateTaskInTree(prev, selectedTaskId, { title: text });
        }
        return prev;
      });
      
      const allTasks = JSON.parse(localStorage.getItem('projectTasks') || '[]');
      const task = TaskUtils.findTaskById(allTasks, selectedTaskId);
      const currentTitle = task?.title || '';
      return !(currentTitle === '新任務' || currentTitle.trim() === '');
    }, [selectedTaskId, updateTasksAndSave])
  };
};
