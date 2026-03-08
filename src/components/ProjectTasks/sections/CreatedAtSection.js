import React from 'react';

const formatCreatedDateTime = (createdAt) => {
  if (!createdAt) return '--';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '--';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}  ${hh}:${min}:${ss}`;
};

const CreatedAtSection = ({ created }) => {
  return (
    <div style={{ marginTop: '12px', color: '#666', fontSize: '13px', textAlign: 'center' }}>
      <span>創建時間：{formatCreatedDateTime(created)}</span>
    </div>
  );
};

export default CreatedAtSection;
