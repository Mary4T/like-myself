import React, { useState, useRef } from 'react';
import { IoClose, IoCloudDownloadOutline, IoCloudUploadOutline, IoTrashOutline } from 'react-icons/io5';

const TemplateModal = ({ isOpen, onClose, manager, selectedTask }) => {
  const { 
    templates, 
    applyTemplate, 
    saveCurrentAsTemplate, 
    exportTemplates, 
    importTemplates,
    deleteTemplate
  } = manager;

  const [selectedTplId, setSelectedTplId] = useState(templates[0]?.id || '');
  const [newTplName, setNewTplName] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedTplId) {
      applyTemplate(selectedTplId);
      onClose();
    }
  };

  const handleSave = () => {
    // 此函數已不再直接使用，邏輯已移至按鈕內
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await importTemplates(file);
        alert('模板匯入成功');
      } catch (err) {
        alert('匯入失敗：' + err.message);
      }
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div className="modal-content" style={{
        backgroundColor: 'white', padding: '24px', borderRadius: '12px',
        width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>內容模板管理</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <IoClose size={24} />
          </button>
        </div>

        {/* 匯出匯入按鈕 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-start' }}>
          <button onClick={exportTemplates} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#f0f0f0', color: '#666', cursor: 'pointer', fontSize: '12px'
          }}>
            <IoCloudDownloadOutline /> 匯出
          </button>
          <button onClick={handleImportClick} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#f0f0f0', color: '#666', cursor: 'pointer', fontSize: '12px'
          }}>
            <IoCloudUploadOutline /> 匯入
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept=".json"
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>套用現有內容模板</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              value={selectedTplId} 
              onChange={(e) => setSelectedTplId(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
            >
              <option value="">請選擇內容模板...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button 
              onClick={handleApply}
              disabled={!selectedTplId}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none',
                background: selectedTplId ? '#52D0FF' : '#ccc', color: 'white', cursor: 'pointer'
              }}
            >
              新增
            </button>
            {selectedTplId && (
              <button 
                onClick={() => { if(confirm('確定刪除此模板？')) deleteTemplate(selectedTplId); }}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ff4d4f', color: '#ff4d4f', background: 'none', cursor: 'pointer' }}
              >
                <IoTrashOutline />
              </button>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>儲存目前任務為內容模板</h4>
          <p style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            {selectedTask ? `目前選中：${selectedTask.title}` : '請先在主畫面選擇一個任務'}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => {
                const name = prompt('請輸入模板名稱', selectedTask?.title);
                if (name) saveCurrentAsTemplate(name, false);
              }}
              disabled={!selectedTask}
              style={{
                flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                background: selectedTask ? '#f0f0f0' : '#eee', color: selectedTask ? '#666' : '#ccc', cursor: selectedTask ? 'pointer' : 'not-allowed', fontSize: '13px'
              }}
            >
              僅儲存單一任務
            </button>
            <button 
              onClick={() => {
                const name = prompt('請輸入模板名稱', selectedTask?.title);
                if (name) saveCurrentAsTemplate(name, true);
              }}
              disabled={!selectedTask}
              style={{
                flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                background: selectedTask ? '#f0f0f0' : '#eee', color: selectedTask ? '#666' : '#ccc', cursor: selectedTask ? 'pointer' : 'not-allowed', fontSize: '13px'
              }}
            >
              儲存為任務群 (含子任務)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TemplateModal;
