import React from 'react';

const SubCalendarTabs = ({ subCalendars, selectedId, onSelect, onOpenManage }) => {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
      <button
        type="button"
        onClick={() => onSelect('all')}
        style={{
          border: '1px solid #dbe3ec',
          borderRadius: '8px',
          padding: '6px 10px',
          background: selectedId === 'all' ? '#52D0FF' : '#fff',
          color: selectedId === 'all' ? '#fff' : '#333',
          cursor: 'pointer'
        }}
      >
        總日曆
      </button>
      {subCalendars.map((calendar) => (
        <button
          key={calendar.id}
          type="button"
          onClick={() => onSelect(calendar.id)}
          style={{
            border: '1px solid #dbe3ec',
            borderRadius: '8px',
            padding: '6px 10px',
            background: selectedId === calendar.id ? '#52D0FF' : '#fff',
            color: selectedId === calendar.id ? '#fff' : '#333',
            cursor: 'pointer'
          }}
        >
          {calendar.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onOpenManage}
        style={{ border: '1px solid #dbe3ec', borderRadius: '8px', padding: '6px 10px', background: '#fff', cursor: 'pointer' }}
      >
        管理子日曆
      </button>
    </div>
  );
};

export default SubCalendarTabs;
