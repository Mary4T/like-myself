import React from 'react';
import { TextField } from '@mui/material';
import DateTimePicker from '../TaskComponents/DateTimePicker';
import './TaskDetail.css';

const TaskDetail = ({ 
  selectedTask, 
  onTaskUpdate, 
  onTaskDetailUpdate 
}) => {
  const handleDateTimeChange = (value) => {
    onTaskDetailUpdate(selectedTask.id, 'dueDate', value);
  };

  return (
    <div className="task-detail-container">
      {selectedTask && (
        <>
          <div className="task-detail-header">
            <div className="task-icon-area">
              {/* 圖標區域 */}
            </div>
            <input
              className="task-title-input"
              value={selectedTask.title}
              onChange={(e) => onTaskUpdate(selectedTask.id, 'title', e.target.value)}
              placeholder="任務標題"
            />
          </div>

          <div className="task-progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${selectedTask.details?.progress || 0}%` }}
            />
          </div>

          <div className="task-detail-content">
            <TextField
              multiline
              rows={4}
              value={selectedTask.description || ''}
              onChange={(e) => onTaskUpdate(selectedTask.id, 'description', e.target.value)}
              placeholder="添加任務描述..."
              fullWidth
            />

            <DateTimePicker
              label="截止日期"
              value={selectedTask?.details?.dueDate || null}
              onChange={handleDateTimeChange}
              reminders={selectedTask?.details?.reminders || []}
              onRemindersChange={(newReminders) => 
                onTaskDetailUpdate(selectedTask.id, 'reminders', newReminders)
              }
            />
          </div>
        </>
      )}
    </div>
  );
};

export default TaskDetail;