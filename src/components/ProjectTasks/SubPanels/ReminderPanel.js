import React from 'react';

const ReminderPanel = ({ selectedTask, reminderManager }) => {
  if (!selectedTask) return null;

  const reminders = selectedTask.details?.reminders || [];

  return (
    <div className="form-group">
      <div className="group-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ marginBottom: 0 }}>提前提醒</label>
        {/* 倒數計時移到標題旁邊 */}
        {reminderManager.countdownData[selectedTask.id] && (
          <span style={{ color: '#52D0FF', fontWeight: 'bold', fontSize: '11px' }}>
            ( 剩餘 {reminderManager.countdownData[selectedTask.id]} )
          </span>
        )}
        <button 
          className="link-add-btn" 
          onClick={() => reminderManager.addReminder(selectedTask.id)}
          style={{ marginLeft: 'auto' }}
        >
          + 添加提醒
        </button>
      </div>
      
      <div className="reminder-section">
        {reminders.length > 0 ? (
          <div className="reminder-list">
            {reminders.map((reminder, index) => (
              <div 
                key={index} 
                className="reminder-item" 
                onClick={() => reminderManager.openReminderPicker(reminder, index)}
                style={{ cursor: 'pointer' }}
              >
                <span className="reminder-text">
                  {reminder.days > 0 && `${reminder.days}天`}
                  {reminder.hours > 0 && `${reminder.hours}小時`}
                  {reminder.minutes > 0 && `${reminder.minutes}分鐘`}
                  {(reminder.days || 0) + (reminder.hours || 0) + (reminder.minutes || 0) === 0 && '0分鐘'}
                </span>
                <button
                  className="remove-reminder-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    reminderManager.removeReminder(selectedTask.id, index);
                  }}
                >×</button>
              </div>
            ))}
          </div>
        ) : (
          <span className="no-reminders">暫無提醒設置</span>
        )}
      </div>

      {/* 權限提示 */}
      {!reminderManager.notificationsEnabled && reminders.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '11px', color: '#faad14', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>⚠️ 尚未開啟通知權限</span>
          <button 
            onClick={() => reminderManager.requestPermission()}
            style={{ background: 'none', border: 'none', color: '#52D0FF', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px', padding: 0 }}
          >
            立即開啟
          </button>
        </div>
      )}
    </div>
  );
};

export default ReminderPanel;
