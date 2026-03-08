import React from 'react';

const StartDateSection = ({
  selectedTask,
  formatDateForInput,
  startDateInputRef,
  dateInputRef,
  handleTaskDetailUpdate,
  handleDueDateChange,
  openStartTimePicker,
  openTimePicker,
  showRepeatPeriodHint
}) => {
  return (
    <div className="task-datetime-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', width: 'max-content', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div className="date-fake-wrapper" style={{ width: '120px' }}>
            <div className="fake-input" onClick={() => startDateInputRef.current?.showPicker()} style={{ width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px' }}>
              {formatDateForInput(selectedTask.details?.startDate) || 'YYYY/MM/DD'}
            </div>
            <input
              ref={startDateInputRef}
              type="date"
              value={selectedTask.details?.startDate ? new Date(selectedTask.details.startDate).toISOString().split('T')[0] : ''}
              onChange={(e) => handleTaskDetailUpdate(selectedTask.id, 'startDate', e.target.value)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
          </div>
          <div className="fake-input" onClick={() => openStartTimePicker(selectedTask.id)} style={{ width: '100px', textAlign: 'center' }}>
            {selectedTask.details?.startTime || '00:00'}
          </div>
        </div>
        <span style={{ color: '#999', fontWeight: 500, flexShrink: 0 }}>~</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div className="date-fake-wrapper" style={{ width: '120px' }}>
            <div className="fake-input" onClick={() => dateInputRef.current?.showPicker()} style={{ width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px' }}>
              {formatDateForInput(selectedTask.details?.dueDate) || 'YYYY/MM/DD'}
            </div>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedTask.details?.dueDate ? new Date(selectedTask.details.dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => handleDueDateChange(e.target.value)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
          </div>
          <div className="fake-input" onClick={() => openTimePicker(selectedTask.id)} style={{ width: '100px', textAlign: 'center' }}>
            {selectedTask.details?.dueTime || '00:00'}
          </div>
        </div>
        {showRepeatPeriodHint && (
          <span style={{ color: '#7a8391', fontSize: '12px', marginLeft: '4px', flexShrink: 0 }}>
            （重複期間）
          </span>
        )}
      </div>
    </div>
  );
};

export default StartDateSection;
