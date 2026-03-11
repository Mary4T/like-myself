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
  showRepeatPeriodHint,
  isMobile
}) => {
  const dateWidth = isMobile ? undefined : '120px';
  const timeWidth = isMobile ? undefined : '100px';
  return (
    <div className="task-datetime-section" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 12 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexWrap: 'nowrap', width: 'max-content', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
          <div className="date-fake-wrapper" style={dateWidth ? { width: dateWidth } : undefined}>
            <div className="fake-input" onClick={() => startDateInputRef.current?.showPicker()} style={{ width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', padding: isMobile ? '6px 8px' : undefined }}>
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
          <div className="fake-input" onClick={() => openStartTimePicker(selectedTask.id)} style={{ ...(timeWidth && { width: timeWidth }), textAlign: 'center', padding: isMobile ? '6px 6px' : undefined }}>
            {selectedTask.details?.startTime || '00:00'}
          </div>
        </div>
        <span style={{ color: '#999', fontWeight: 500, flexShrink: 0 }}>~</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
          <div className="date-fake-wrapper" style={dateWidth ? { width: dateWidth } : undefined}>
            <div className="fake-input" onClick={() => dateInputRef.current?.showPicker()} style={{ width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', padding: isMobile ? '6px 8px' : undefined }}>
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
          <div className="fake-input" onClick={() => openTimePicker(selectedTask.id)} style={{ ...(timeWidth && { width: timeWidth }), textAlign: 'center', padding: isMobile ? '6px 6px' : undefined }}>
            {selectedTask.details?.dueTime || '00:00'}
          </div>
        </div>
        {showRepeatPeriodHint && !isMobile && (
          <span style={{ color: '#7a8391', fontSize: '12px', marginLeft: '4px', flexShrink: 0 }}>
            （重複期間）
          </span>
        )}
      </div>
      {showRepeatPeriodHint && isMobile && (
        <span style={{ color: '#7a8391', fontSize: '12px' }}>
          （重複期間）
        </span>
      )}
    </div>
  );
};

export default StartDateSection;
