import React, { useState, useEffect, useCallback } from 'react';
import * as TaskUtils from './ProjectTasks/taskUtils';
import AddTaskModal from './ProjectTasks/AddTaskModal';
import { OPEN_ADD_TASK_EVENT_NAME } from './AddTaskFloatingButton';

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

export const PROJECT_TASKS_UPDATED_EVENT = 'projectTasksUpdated';
export const TASK_TAGS_UPDATED_EVENT = 'taskTagsUpdated';

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

const loadTasks = () => {
  try {
    const saved = localStorage.getItem('projectTasks');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading tasks', e);
  }
  return [{ id: 'root', title: 'Root', children: [], isHidden: true, details: { repeat: { ...DEFAULT_REPEAT } } }];
};

const loadTaskTags = () => {
  try {
    const s = localStorage.getItem('taskTags');
    return s ? JSON.parse(s) : [
      { id: 'tag-1', name: '工作', color: 'rgb(156, 39, 176)' },
      { id: 'tag-2', name: '遊玩', color: 'rgb(255, 193, 7)' },
      { id: 'tag-3', name: '學習', color: 'rgb(33, 150, 243)' }
    ];
  } catch {
    return [];
  }
};

const loadLayoutTemplates = () => {
  try {
    const saved = localStorage.getItem(LAYOUT_TEMPLATE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const GlobalAddTaskModal = () => {
  const [show, setShow] = useState(false);
  const [tasks, setTasks] = useState(loadTasks);
  const [taskTags, setTaskTags] = useState(loadTaskTags);
  const [layoutTemplates, setLayoutTemplates] = useState(loadLayoutTemplates);
  const [selectedParent, setSelectedParent] = useState('root');
  const [newTask, setNewTask] = useState(createEmptyNewTask);

  useEffect(() => {
    const handler = () => {
      setTasks(loadTasks());
      setTaskTags(loadTaskTags());
      setLayoutTemplates(loadLayoutTemplates());
      setSelectedParent('root');
      setNewTask(createEmptyNewTask());
      setShow(true);
    };
    window.addEventListener(OPEN_ADD_TASK_EVENT_NAME, handler);
    return () => window.removeEventListener(OPEN_ADD_TASK_EVENT_NAME, handler);
  }, []);

  const handleAddTask = useCallback(() => {
    if (!newTask.title.trim()) return;
    const currentTasks = loadTasks();
    const parentTask = selectedParent === 'root' ? null : TaskUtils.findTaskById(currentTasks, selectedParent);
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
      id: newTaskId,
      title: newTask.title,
      description: newTask.description,
      level: autoLevel,
      status: 'pending',
      created: new Date().toISOString(),
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

    const nextTasks = TaskUtils.addChildToTask(currentTasks, selectedParent, newTaskObj);
    localStorage.setItem('projectTasks', JSON.stringify(nextTasks));

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

    setShow(false);
    setSelectedParent('root');
    setNewTask(createEmptyNewTask());
    setTasks(nextTasks);
    window.dispatchEvent(new CustomEvent(PROJECT_TASKS_UPDATED_EVENT));
  }, [newTask, selectedParent, layoutTemplates]);

  return (
    <AddTaskModal
      show={show}
      onClose={() => setShow(false)}
      onAdd={handleAddTask}
      newTask={newTask}
      setNewTask={setNewTask}
      selectedParent={selectedParent}
      setSelectedParent={setSelectedParent}
      tasks={tasks}
      taskTags={taskTags}
      layoutTemplates={layoutTemplates}
    />
  );
};

export default GlobalAddTaskModal;
