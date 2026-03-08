import React from 'react';
import { BsTrash } from 'react-icons/bs';
import IconSelector from '../../TaskComponents/IconSelector';

const TaskHeaderSection = ({
  selectedTask,
  isGeneratedTask,
  handleBackToOriginalTask,
  editingTaskId,
  editingText,
  setEditingText,
  handleEditKeyPress,
  saveEditTask,
  startEditTask,
  handleTaskDetailUpdate,
  handleTaskDelete
}) => {
  return (
    <div className="task-details-header">
      <div className="task-title-section">
        {isGeneratedTask(selectedTask.id) && (
          <div className="back-to-original-link">
            <span className="back-link-text" onClick={() => handleBackToOriginalTask(selectedTask.id)}>
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
          <h2 onClick={() => startEditTask(selectedTask.id, selectedTask.title)} style={{ cursor: 'pointer' }}>
            {selectedTask.title}
          </h2>
        )}
      </div>
      <div className="task-actions">
        <IconSelector
          currentIcon={selectedTask.icon}
          onIconChange={(newIcon) => handleTaskDetailUpdate(selectedTask.id, 'icon', newIcon)}
        />
        <button className="action-btn delete-btn" onClick={() => handleTaskDelete(selectedTask.id)}>
          <BsTrash />
        </button>
      </div>
    </div>
  );
};

export default TaskHeaderSection;
