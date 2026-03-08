import { useState, useCallback, useEffect } from 'react';
import * as TaskUtils from '../components/ProjectTasks/taskUtils';

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
              { title: '列出所有常用小區域', level: 'D' },
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
          }
        ]
      }
    ]
  }
];

export const useTaskTemplates = (updateTasksAndSave, selectedTask) => {
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : BUILTIN_TEMPLATES;
      }
    } catch (e) {
      console.error('Error loading templates:', e);
    }
    return BUILTIN_TEMPLATES;
  });

  useEffect(() => {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

  // 生成唯一 ID
  const generateId = useCallback(() => `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  // 遞迴建立任務樹
  const buildTreeFromTemplate = useCallback((templateNodes, parentLevel) => {
    const calculateNextLevel = (lvl) => {
      const levels = ['A', 'B', 'C', 'D', 'E'];
      const idx = levels.indexOf(lvl);
      return idx < levels.length - 1 ? levels[idx + 1] : 'E';
    };

    return templateNodes.map(node => {
      const currentLevel = calculateNextLevel(parentLevel);
      return {
        id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: node.title,
        status: 'pending',
        level: currentLevel,
        created: new Date().toISOString(),
        details: { progress: 0 },
        children: node.children ? buildTreeFromTemplate(node.children, currentLevel) : []
      };
    });
  }, []);

  // 套用模板
  const applyTemplate = useCallback((templateId) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;

    const newRootTask = {
      id: `gen-${Date.now()}`,
      title: tpl.rootTitle,
      description: tpl.description || '',
      level: 'A',
      status: 'pending',
      created: new Date().toISOString(),
      details: { progress: 0 },
      children: buildTreeFromTemplate(tpl.tree || [], 'A')
    };

    updateTasksAndSave(prev => {
      // 假設 root 是任務樹的根節點
      return TaskUtils.addChildToTask(prev, 'root', newRootTask);
    });
  }, [templates, buildTreeFromTemplate, updateTasksAndSave]);

  // 儲存目前任務為模板
  const saveCurrentAsTemplate = useCallback((name, includeChildren = true) => {
    if (!selectedTask) return;

    const cloneNode = (node) => ({
      title: node.title,
      level: node.level,
      children: (node.children || []).map(cloneNode)
    });

    const newTpl = {
      id: generateId(),
      name: name || selectedTask.title || '未命名模板',
      rootTitle: selectedTask.title,
      description: selectedTask.description || '',
      tree: includeChildren ? (selectedTask.children || []).map(cloneNode) : []
    };

    setTemplates(prev => [...prev, newTpl]);
  }, [selectedTask, generateId]);

  // 匯出模板
  const exportTemplates = useCallback(() => {
    const dataStr = JSON.stringify(templates, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `task_templates_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [templates]);

  // 匯入模板
  const importTemplates = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (Array.isArray(imported)) {
            setTemplates(prev => {
              // 簡單的合併邏輯，可以根據 ID 去重
              const existingIds = new Set(prev.map(t => t.id));
              const newTemplates = imported.filter(t => !existingIds.has(t.id));
              return [...prev, ...newTemplates];
            });
            resolve(true);
          } else {
            reject(new Error('無效的模板格式'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const deleteTemplate = useCallback((id) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    templates,
    applyTemplate,
    saveCurrentAsTemplate,
    exportTemplates,
    importTemplates,
    deleteTemplate
  };
};
