import React from 'react';
import ReactDOM from 'react-dom';
import { IoClose } from 'react-icons/io5';

const AddTaskModal = ({ 
  show, 
  onClose, 
  onAdd, 
  newTask, 
  setNewTask, 
  selectedParent,
  setSelectedParent,
  tasks,
  taskTags,
  layoutTemplates
}) => {
  if (!show) return null;
  const startDateInputRef = React.useRef(null);
  const dueDateInputRef = React.useRef(null);
  const parentDropdownRef = React.useRef(null);
  const layoutDropdownRef = React.useRef(null);
  const attrDropdownRef = React.useRef(null);
  const [parentDropdownOpen, setParentDropdownOpen] = React.useState(false);
  const [layoutDropdownOpen, setLayoutDropdownOpen] = React.useState(false);
  const [attrDropdownOpen, setAttrDropdownOpen] = React.useState(false);

  const taskRoots = tasks?.[0]?.children || [];
  const parentOptions = [];
  const buildParentOptions = (nodes, depth = 0) => {
    (nodes || []).forEach((node) => {
      if (node.isPlaceholder || node.isPlaceholderHeader) return;
      parentOptions.push({ id: node.id, title: node.title, depth });
      buildParentOptions(node.children || [], depth + 1);
    });
  };
  buildParentOptions(taskRoots);
  const selectedParentTask = selectedParent === 'root'
    ? null
    : parentOptions.find(opt => opt.id === selectedParent);
  const selectedParentLabel = selectedParent === 'root'
    ? '根目錄'
    : parentOptions.find(opt => opt.id === selectedParent)?.title || `任務 ID: ${selectedParent}`;
  const selectedLayoutLabel = newTask.layoutTemplateId
    ? ((layoutTemplates || []).find(tpl => tpl.id === newTask.layoutTemplateId)?.name || '不套用模板（使用預設）')
    : '不套用模板（使用預設）';
  const selectedTag = (taskTags || []).find(tag => tag.id === newTask.tagId);
  const selectedTagLabel = newTask.tagId === '__inherit__'
    ? `沿用父任務（${selectedParentLabel}）`
    : (newTask.tagId === '__none__' || !newTask.tagId)
      ? '無屬性'
      : (selectedTag?.name || '無屬性');
  const labelColumnWidth = '88px';
  React.useEffect(() => {
    if (!parentDropdownOpen && !layoutDropdownOpen && !attrDropdownOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target)) {
        setParentDropdownOpen(false);
      }
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target)) {
        setLayoutDropdownOpen(false);
      }
      if (attrDropdownRef.current && !attrDropdownRef.current.contains(event.target)) {
        setAttrDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [parentDropdownOpen, layoutDropdownOpen, attrDropdownOpen]);
  const formatDateLabel = (value) => {
    if (!value) return 'YYYY/MM/DD';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'YYYY/MM/DD';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const modalContent = (
    <div className="modal-overlay add-task-modal" style={{ zIndex: 10005 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header add-task-modal-header">
          <h3 className="add-task-modal-title">新增任務</h3>
          <button className="close-btn" onClick={onClose}><IoClose /></button>
        </div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label>任務名稱</label>
            <input 
              type="text" value={newTask.title} 
              onChange={e => setNewTask({...newTask, title: e.target.value})} 
              placeholder="輸入任務標題..." autoFocus
            />
          </div>
          <div className="form-group add-task-date-time" style={{ marginBottom: '10px' }}>
            <div className="add-task-date-time-inner" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', width: 'max-content', maxWidth: '100%' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div className="date-fake-wrapper" style={{ width: '120px' }}>
                  <div className="fake-input" onClick={() => startDateInputRef.current?.showPicker()} style={{ width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px' }}>
                    {formatDateLabel(newTask.startDate)}
                  </div>
                  <input
                    ref={startDateInputRef}
                    type="date"
                    value={newTask.startDate || ''}
                    onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                </div>
                <div className="fake-input add-task-time-input" onClick={() => document.getElementById('new-task-start-time')?.showPicker?.()} style={{ width: '100px', textAlign: 'center' }}>
                  {newTask.startTime || '00:00'}
                </div>
                <input
                  id="new-task-start-time"
                  type="time"
                  value={newTask.startTime || '00:00'}
                  onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value || '00:00' })}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
              </div>
              <span style={{ color: '#999', fontWeight: 500, flexShrink: 0 }}>~</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div className="date-fake-wrapper" style={{ width: '120px' }}>
                  <div className="fake-input" onClick={() => dueDateInputRef.current?.showPicker()} style={{ width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px' }}>
                    {formatDateLabel(newTask.dueDate)}
                  </div>
                  <input
                    ref={dueDateInputRef}
                    type="date"
                    value={newTask.dueDate || ''}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                </div>
                <div className="fake-input add-task-time-input" onClick={() => document.getElementById('new-task-due-time')?.showPicker?.()} style={{ width: '100px', textAlign: 'center' }}>
                  {newTask.dueTime || '23:59'}
                </div>
                <input
                  id="new-task-due-time"
                  type="time"
                  value={newTask.dueTime || '23:59'}
                  onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value || '23:59' })}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
              </div>
            </div>
          </div>
          <div className="form-group add-task-description-group" style={{ marginBottom: '8px' }}>
            <textarea 
              value={newTask.description}
              onChange={e => setNewTask({...newTask, description: e.target.value})}
              placeholder="任務描述 (可選)"
              className="add-task-description-textarea"
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                marginTop: '0'
              }}
            />
          </div>
          <div style={{ marginTop: '-4px', display: 'grid', rowGap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `${labelColumnWidth} 1fr`, alignItems: 'center', columnGap: '8px' }}>
              <label style={{ margin: 0, fontSize: '13px' }}>父任務</label>
              <div ref={parentDropdownRef} style={{ position: 'relative' }}>
                <div
                  className="fake-input add-task-dropdown-input"
                  onClick={() => { setParentDropdownOpen(prev => !prev); setLayoutDropdownOpen(false); setAttrDropdownOpen(false); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '34px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '13px' }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', flex: 1 }}>{selectedParentLabel}</span>
                  <span style={{ fontSize: '10px', color: '#999' }}>▼</span>
                </div>
                {parentDropdownOpen && (
                  <div className="add-task-dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'white', border: '1px solid #E8EDF2', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10010, maxHeight: '220px', overflowY: 'auto', textAlign: 'left' }}>
                    <div onClick={() => { setSelectedParent('root'); setParentDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>
                      根目錄
                    </div>
                    {parentOptions.map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => { setSelectedParent(opt.id); setParentDropdownOpen(false); }}
                        style={{
                          paddingTop: '8px',
                          paddingBottom: '8px',
                          paddingRight: '12px',
                          paddingLeft: `${12 + (opt.depth * 16)}px`,
                          cursor: 'pointer',
                          fontSize: '13px',
                          textAlign: 'left'
                        }}
                      >
                        {opt.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `${labelColumnWidth} 1fr`, alignItems: 'center', columnGap: '8px' }}>
              <label style={{ margin: 0, fontSize: '13px' }}>版面模板</label>
              <div ref={layoutDropdownRef} style={{ position: 'relative' }}>
                <div
                  className="fake-input add-task-dropdown-input"
                  onClick={() => { setLayoutDropdownOpen(prev => !prev); setParentDropdownOpen(false); setAttrDropdownOpen(false); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '34px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '13px' }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', flex: 1 }}>{selectedLayoutLabel}</span>
                  <span style={{ fontSize: '10px', color: '#999' }}>▼</span>
                </div>
                {layoutDropdownOpen && (
                  <div className="add-task-dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'white', border: '1px solid #E8EDF2', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10010, maxHeight: '220px', overflowY: 'auto', textAlign: 'left' }}>
                    <div onClick={() => { setNewTask({ ...newTask, layoutTemplateId: '' }); setLayoutDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>
                      不套用模板（使用預設）
                    </div>
                    {(layoutTemplates || []).map((tpl) => (
                      <div key={tpl.id} onClick={() => { setNewTask({ ...newTask, layoutTemplateId: tpl.id }); setLayoutDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>
                        {tpl.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `${labelColumnWidth} 1fr`, alignItems: 'center', columnGap: '8px' }}>
              <label style={{ margin: 0, fontSize: '13px' }}>任務屬性</label>
              <div ref={attrDropdownRef} style={{ position: 'relative' }}>
                <div
                  className="fake-input add-task-dropdown-input"
                  onClick={() => { setAttrDropdownOpen(prev => !prev); setParentDropdownOpen(false); setLayoutDropdownOpen(false); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '34px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '13px' }}
                >
                  <span style={{ textAlign: 'left', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedTagLabel}</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    {selectedTag && (
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: selectedTag.color, border: '1px solid #ddd' }} />
                    )}
                    <span style={{ fontSize: '10px', color: '#999' }}>▼</span>
                  </div>
                </div>
                {attrDropdownOpen && (
                  <div className="add-task-dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'white', border: '1px solid #E8EDF2', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10010, maxHeight: '220px', overflowY: 'auto', textAlign: 'left' }}>
                    <div onClick={() => { setNewTask({ ...newTask, tagId: '__inherit__' }); setAttrDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>
                      沿用父任務（{selectedParentTask?.title || '根目錄'}）
                    </div>
                    <div onClick={() => { setNewTask({ ...newTask, tagId: '__none__' }); setAttrDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>
                      無屬性
                    </div>
                    {(taskTags || []).map((tag) => (
                      <div key={tag.id} onClick={() => { setNewTask({ ...newTask, tagId: tag.id }); setAttrDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', textAlign: 'left' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: tag.color, border: '1px solid #ddd' }} />
                        <span>{tag.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>取消</button>
          <button className="save-btn" onClick={onAdd}>確認新增</button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default AddTaskModal;
