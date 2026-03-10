import React from 'react';

const TaskPropertiesSection = ({
  selectedTask,
  taskTags,
  getTagColor,
  tagDropdownOpen,
  setTagDropdownOpen,
  handleTaskDetailUpdate,
  isMobile
}) => {
  const attrBtnWidth = isMobile ? '24vh' : 150;
  return (
    <div className="task-properties-section" style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label>任務類型：</label>
          <select className="task-props-select" value={selectedTask.taskType || 'recurring'} onChange={(e) => handleTaskDetailUpdate(selectedTask.id, 'taskType', e.target.value)}>
            <option value="recurring">持續型</option>
            <option value="one-time">一次性</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label>屬性：</label>
          <div className="tag-dropdown-container" style={{ position: 'relative', width: attrBtnWidth, minWidth: attrBtnWidth, maxWidth: attrBtnWidth }}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setTagDropdownOpen(tagDropdownOpen === 'detail' ? null : 'detail');
              }}
              className="fake-input"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '4px 6px' : '6px 12px', border: '1px solid #E8EDF2', borderRadius: '4px', cursor: 'pointer', background: 'white', minWidth: 0 }}
            >
              <span style={isMobile ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}>{selectedTask.tagId ? taskTags.find(t => t.id === selectedTask.tagId)?.name || '無屬性' : '無屬性'}</span>
              {selectedTask.tagId && <div style={{ width: '16px', height: '16px', borderRadius: '3px', background: getTagColor(selectedTask.tagId) || '#E0E0E0' }} />}
            </div>
            {tagDropdownOpen === 'detail' && (
              <div className="tag-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E8EDF2', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, maxHeight: '200px', overflowY: 'auto', ...(isMobile && { right: 'auto', minWidth: 150 }) }}>
                <div onClick={() => { handleTaskDetailUpdate(selectedTask.id, 'tagId', null); setTagDropdownOpen(null); }} style={{ padding: '8px 12px', cursor: 'pointer' }}>無屬性</div>
                {taskTags.map(tag => (
                  <div key={tag.id} onClick={() => { handleTaskDetailUpdate(selectedTask.id, 'tagId', tag.id); setTagDropdownOpen(null); }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: tag.color, borderRadius: '2px' }} /> {tag.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskPropertiesSection;
