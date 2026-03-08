import React from 'react';
import { IoClose, IoRocketOutline, IoCheckmarkCircle, IoChevronDown, IoChevronForward } from 'react-icons/io5';
import CapsuleDesigner from './CapsuleDesigner';
import * as TaskUtils from '../taskUtils';

const CapsulePanel = ({ manager, templateManager, tasks }) => {
  const { 
    capsuleState, addCapsule, updateCapsule, removeCapsule, generateTasks,
    editingCapsuleId, setEditingCapsuleId, editingCapsuleText, setEditingCapsuleText,
    updateTemplateTasks, importFromGeneralTemplate, insertCapsuleText,
    togglePlaceholder, setTargetParent, deleteGeneratedTasksOnly
  } = manager;

  const [deleteConfirm, setDeleteConfirm] = React.useState({ visible: false, capsuleId: null, count: 0 });
  const [showTargetPicker, setShowTargetPicker] = React.useState(false);
  const [expandedTargetNodes, setExpandedTargetNodes] = React.useState(new Set(['root']));

  if (!capsuleState.showCapsules) return null;

  const toggleTargetExpand = (id) => {
    setExpandedTargetNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTargetNode = (node) => {
    if (node.isPlaceholder) return null; // 不顯示佔位符本身
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedTargetNodes.has(node.id);
    const isSelected = capsuleState.targetParentId === node.id;

    return (
      <div key={node.id} style={{ marginLeft: '15px' }}>
        <div 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '4px',
            cursor: 'pointer', background: isSelected ? '#f0faff' : 'transparent',
            border: isSelected ? '1px solid #52D0FF' : '1px solid transparent'
          }}
          onClick={() => { setTargetParent(node.id); setShowTargetPicker(false); }}
        >
          {hasChildren ? (
            <span onClick={(e) => { e.stopPropagation(); toggleTargetExpand(node.id); }} style={{ display: 'flex', alignItems: 'center', color: '#999' }}>
              {isExpanded ? <IoChevronDown size={12} /> : <IoChevronForward size={12} />}
            </span>
          ) : <span style={{ width: 12 }} />}
          <span style={{ fontSize: '12px', color: isSelected ? '#52D0FF' : '#666' }}>{node.title}</span>
        </div>
        {isExpanded && node.children?.map(child => renderTargetNode(child))}
      </div>
    );
  };

  const handleCapsuleClick = (text) => {
    const shouldInsertToDescription = insertCapsuleText(text);
    if (shouldInsertToDescription && window.insertToQuill) {
      window.insertToQuill(text);
    }
  };

  const isGenerated = (id) => capsuleState.generatedCapsuleIds?.includes(id);

  const handleRemoveClick = (id) => {
    const count = manager.getGeneratedTasksCount(id);
    if (count > 0) {
      setDeleteConfirm({ visible: true, capsuleId: id, count });
    } else {
      if (window.confirm('確定刪除此膠囊？')) {
        removeCapsule(id, false);
      }
    }
  };

  return (
    <div className="capsules-panel" style={{
      marginTop: '15px', padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid #E8EDF2', boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      position: 'relative'
    }}>
      {/* 自定義刪除確認 Modal */}
      {deleteConfirm.visible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 10000, padding: '20px'
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '100%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>刪除確認</h4>
            <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
              此膠囊已生成 <strong style={{ color: '#52D0FF' }}>{deleteConfirm.count}</strong> 個任務。<br/>請選擇刪除方式：
            </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <button 
                            onClick={() => { removeCapsule(deleteConfirm.capsuleId, true); setDeleteConfirm({ visible: false, capsuleId: null, count: 0 }); }}
                            style={{ padding: '10px', borderRadius: '8px', border: 'none', background: '#ff4d4f', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            刪除 生成的任務+膠囊
                          </button>
                          <button 
                            onClick={() => { deleteGeneratedTasksOnly(deleteConfirm.capsuleId); setDeleteConfirm({ visible: false, capsuleId: null, count: 0 }); }}
                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ff4d4f', background: 'white', color: '#ff4d4f', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            刪除 生成的任務
                          </button>
                          <button 
                            onClick={() => { removeCapsule(deleteConfirm.capsuleId, false); setDeleteConfirm({ visible: false, capsuleId: null, count: 0 }); }}
                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d9d9d9', background: 'white', color: '#666', cursor: 'pointer' }}
                          >
                            刪除 膠囊
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm({ visible: false, capsuleId: null, count: 0 })}
                            style={{ padding: '10px', borderRadius: '8px', border: 'none', background: '#f5f5f5', color: '#999', cursor: 'pointer' }}
                          >
                            取消
                          </button>
                        </div>
          </div>
        </div>
      )}

      {/* 1. 膠囊管理區 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h5 style={{ margin: 0, fontSize: '14px', color: '#333', fontWeight: 'bold' }}>文字膠囊庫</h5>
          <button onClick={addCapsule} style={{ background: '#52D0FF', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>+ 新增膠囊</button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', lineHeight: '1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666', cursor: 'pointer', margin: 0, padding: 0 }}>
            <input 
              type="checkbox" 
              checked={capsuleState.placeholderEnabled} 
              onChange={togglePlaceholder} 
              style={{ margin: 0, padding: 0, verticalAlign: 'middle' }}
            />
            <span style={{ display: 'inline-block', lineHeight: '1' }}>啟用位置佔位符</span>
          </label>
          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%' }}>
            <button 
              onClick={() => setShowTargetPicker(!showTargetPicker)}
              style={{ 
                background: 'none', border: 'none', 
                color: capsuleState.placeholderEnabled ? '#ccc' : '#52D0FF', 
                fontSize: '12px', 
                cursor: capsuleState.placeholderEnabled ? 'not-allowed' : 'pointer', 
                padding: 0, textDecoration: 'underline',
                display: 'flex',
                alignItems: 'center',
                lineHeight: '1',
                margin: 0
              }}
              disabled={capsuleState.placeholderEnabled}
            >
              <span style={{ display: 'inline-block', lineHeight: '1' }}>
                {capsuleState.targetParentId ? `目標：${TaskUtils.findTaskById(tasks, capsuleState.targetParentId)?.title || '已選擇'}` : '設定目標父任務'}
              </span>
            </button>
            
            {showTargetPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, width: '250px', maxHeight: '300px', 
                overflowY: 'auto', background: 'white', border: '1px solid #E8EDF2', borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, padding: '10px',
                marginTop: '5px'
              }}>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #eee' }}>選擇目標父任務：</div>
                {tasks.map(rootNode => renderTargetNode(rootNode))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="capsules-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {(capsuleState?.capsules || []).map(capsule => (
          <div 
            key={capsule.id} 
            className={`capsule-pill ${isGenerated(capsule.id) ? 'generated' : ''}`}
            style={{
              position: 'relative', 
              background: 'white', 
              border: isGenerated(capsule.id) ? '1px solid #52D0FF' : '1px solid #e0e0e0', 
              borderRadius: '16px', 
              padding: '4px 24px 4px 10px', 
              fontSize: '12px', 
              cursor: 'pointer', 
              minHeight: '28px', 
              display: 'flex', 
              alignItems: 'center', 
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            {editingCapsuleId === capsule.id ? (
              <input 
                autoFocus 
                className="capsule-edit-input" 
                value={editingCapsuleText} 
                onChange={(e) => setEditingCapsuleText(e.target.value)} 
                onBlur={() => { updateCapsule(capsule.id, editingCapsuleText); setEditingCapsuleId(null); }} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateCapsule(capsule.id, editingCapsuleText);
                    setEditingCapsuleId(null);
                  }
                  if (e.key === 'Escape') {
                    setEditingCapsuleId(null);
                  }
                }} 
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '12px', background: 'transparent' }} 
              />
            ) : (
              <span 
                className="capsule-text" 
                onClick={() => {
                  setEditingCapsuleId(capsule.id);
                  setEditingCapsuleText(capsule.text || '');
                }}
                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isGenerated(capsule.id) ? '#00A3FF' : '#333' }}
              >
                {capsule.text || <span style={{ color: '#ccc' }}>點擊輸入...</span>}
              </span>
            )}
            <button onClick={(e) => { e.stopPropagation(); handleRemoveClick(capsule.id); }} style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 0, fontSize: '12px', display: 'flex', alignItems: 'center' }}><IoClose size={12} /></button>
          </div>
        ))}
      </div>

      {/* 2. 模板設計區 */}
      <CapsuleDesigner 
        tasks={capsuleState.capsuleTaskTemplate?.tasks || []} 
        onUpdate={updateTemplateTasks}
        onImportTemplate={importFromGeneralTemplate}
        generalTemplates={templateManager.templates}
      />

      {/* 3. 生成按鈕 */}
      {(capsuleState?.capsules || []).length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button 
            onClick={generateTasks} 
            style={{ 
              padding: '10px 24px', 
              background: '#52D0FF', color: 'white', border: 'none', 
              borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', 
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(82, 208, 255, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <IoRocketOutline size={18} /> 生成任務
          </button>
        </div>
      )}
    </div>
  );
};

export default CapsulePanel;
