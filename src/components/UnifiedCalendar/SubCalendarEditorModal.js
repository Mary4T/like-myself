import React from 'react';
import { generateSubCalendar } from '../../features/unifiedCalendar/storage';

const moveItem = (list, index, delta) => {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  return copy;
};

const SubCalendarEditorModal = ({
  open,
  subCalendars,
  setSubCalendars,
  onClose,
  groupOptions,
  taskOptions
}) => {
  if (!open) return null;
  const orderBtnStyle = {
    padding: '6px 10px',
    background: '#fff',
    color: '#8f97a3',
    border: '1px solid #d6dbe2',
    borderRadius: '4px',
    cursor: 'pointer'
  };

  const addSubCalendar = () => {
    setSubCalendars((prev) => [...prev, generateSubCalendar(`子日曆 ${prev.length + 1}`)]);
  };

  const updateSubCalendar = (id, updater) => {
    setSubCalendars((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const deleteSubCalendar = (id) => {
    setSubCalendars((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(900px, 92vw)', maxHeight: '86vh', overflow: 'auto', background: '#fff', borderRadius: '12px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>子日曆管理</h3>
          <button type="button" onClick={addSubCalendar} style={{ border: 'none', borderRadius: '8px', padding: '6px 10px', background: '#52D0FF', color: '#fff', cursor: 'pointer' }}>
            新增子日曆
          </button>
        </div>
        {subCalendars.map((calendar, index) => (
          <div key={calendar.id} style={{ border: '1px solid #e4eaf0', borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <input
                value={calendar.name}
                onChange={(e) => updateSubCalendar(calendar.id, (old) => ({ ...old, name: e.target.value }))}
                style={{ flex: 1, border: '1px solid #dbe3ec', borderRadius: '8px', padding: '6px 10px' }}
              />
              <button type="button" onClick={() => setSubCalendars((prev) => moveItem(prev, index, -1))} style={orderBtnStyle}>↑</button>
              <button type="button" onClick={() => setSubCalendars((prev) => moveItem(prev, index, 1))} style={orderBtnStyle}>↓</button>
              <button type="button" onClick={() => deleteSubCalendar(calendar.id)} style={{ color: '#fff', background: '#ff5d5d', border: 'none', borderRadius: '6px', padding: '6px 10px' }}>刪除</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6d7785', marginBottom: '6px' }}>群組選擇（父任務層）</div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #edf1f5', borderRadius: '8px', padding: '8px' }}>
                  {groupOptions.map((group) => (
                    <label key={group.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', fontSize: '13px', textAlign: 'left' }}>
                      <input
                        className="sub-calendar-checkbox"
                        type="checkbox"
                        checked={calendar.selectedGroupIds.includes(group.id)}
                        onChange={() => updateSubCalendar(calendar.id, (old) => ({
                          ...old,
                          selectedGroupIds: old.selectedGroupIds.includes(group.id)
                            ? old.selectedGroupIds.filter((id) => id !== group.id)
                            : [...old.selectedGroupIds, group.id]
                        }))}
                      />
                      <span style={{ marginLeft: '6px', paddingLeft: `${Math.max(0, (group.depth || 0) * 14)}px`, textAlign: 'left' }}>
                        {group.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6d7785', marginBottom: '6px' }}>任務選擇（單任務）</div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #edf1f5', borderRadius: '8px', padding: '8px' }}>
                  {taskOptions.map((task) => (
                    <label key={task.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', fontSize: '13px', textAlign: 'left' }}>
                      <input
                        className="sub-calendar-checkbox"
                        type="checkbox"
                        checked={calendar.selectedTaskIds.includes(task.id)}
                        onChange={() => updateSubCalendar(calendar.id, (old) => ({
                          ...old,
                          selectedTaskIds: old.selectedTaskIds.includes(task.id)
                            ? old.selectedTaskIds.filter((id) => id !== task.id)
                            : [...old.selectedTaskIds, task.id]
                        }))}
                      />
                      <span style={{ marginLeft: '6px', paddingLeft: `${Math.max(0, (task.depth || 0) * 14)}px`, textAlign: 'left' }}>
                        {task.type === 'note' ? `[便條紙] ${task.title}` : task.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ border: '1px solid #dbe3ec', borderRadius: '8px', padding: '6px 12px', background: '#fff' }}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubCalendarEditorModal;
