import React, { useState, useRef, useCallback } from 'react';
import { IoAdd, IoTrashOutline, IoChevronDown, IoChevronForward } from 'react-icons/io5';

const TemplateNode = ({ node, depth, updateNodeTitle, addNode, removeNode, renderVisualTitle, onInputFocus, registerInputRef }) => {
  const inputRef = useCallback((el) => { registerInputRef(node.id, el); }, [node.id, registerInputRef]);
  
  return (
    <div className="template-node" style={{ marginLeft: depth * 20, marginBottom: '12px' }}>
      <div className="template-node-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: 14, flexShrink: 0 }} />
        
        <div className="template-node-input-wrap" style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: '400px' }}>
          <div className="template-visual-title" style={{ marginBottom: '4px', fontSize: '10px', color: '#52D0FF' }}>
            {renderVisualTitle(node.title)}
          </div>
          <input 
            ref={inputRef}
            value={node.title} 
            onChange={(e) => updateNodeTitle(node.id, e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = '#52D0FF'; onInputFocus(node.id); }}
            onBlur={(e) => e.target.style.borderColor = '#eee'}
            placeholder="輸入任務標題..."
            style={{ 
              width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #eee', 
              fontSize: '13px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
            }}
          />
        </div>

        <button onClick={() => addNode(node.id)} style={{ border: 'none', background: 'none', color: '#52D0FF', cursor: 'pointer', flexShrink: 0 }} title="新增子模板"><IoAdd size={18} /></button>
        <button onClick={() => removeNode(node.id)} style={{ border: 'none', background: 'none', color: '#ccc', cursor: 'pointer', flexShrink: 0 }}><IoTrashOutline size={14} /></button>
      </div>
      {node.children?.map(child => (
        <TemplateNode 
          key={child.id}
          node={child}
          depth={depth + 1}
          updateNodeTitle={updateNodeTitle}
          addNode={addNode}
          removeNode={removeNode}
          renderVisualTitle={renderVisualTitle}
          onInputFocus={onInputFocus}
          registerInputRef={registerInputRef}
        />
      ))}
    </div>
  );
};

const CapsuleDesigner = ({ tasks, onUpdate, onImportTemplate, generalTemplates }) => {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const inputRefsMap = useRef({});

  const registerInputRef = useCallback((nodeId, el) => {
    if (el) inputRefsMap.current[nodeId] = el;
    else delete inputRefsMap.current[nodeId];
  }, []);

  const addNode = (parentId = null) => {
    const newNode = {
      id: `tpl-node-${Date.now()}`,
      title: '新模板任務',
      children: []
    };

    if (!parentId) {
      onUpdate([...tasks, newNode]);
    } else {
      const updateRecursive = (nodes) => nodes.map(node => {
        if (node.id === parentId) return { ...node, children: [...(node.children || []), newNode] };
        if (node.children) return { ...node, children: updateRecursive(node.children) };
        return node;
      });
      onUpdate(updateRecursive(tasks));
    }
  };

  const removeNode = (id) => {
    const removeRecursive = (nodes) => nodes.filter(node => {
      if (node.id === id) return false;
      if (node.children) node.children = removeRecursive(node.children);
      return true;
    });
    onUpdate(removeRecursive(tasks));
  };

  const updateNodeTitle = (id, title) => {
    const updateRecursive = (nodes) => nodes.map(node => {
      if (node.id === id) return { ...node, title };
      if (node.children) return { ...node, children: updateRecursive(node.children) };
      return node;
    });
    onUpdate(updateRecursive(tasks));
  };

  const insertPlaceholderAtCursor = (nodeId) => {
    const input = inputRefsMap.current[nodeId];
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newTitle = before + '（膠囊）' + after;

    updateNodeTitle(nodeId, newTitle);

    setTimeout(() => {
      input.focus();
      const newCursorPos = start + '（膠囊）'.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const renderVisualTitle = (title) => {
    if (!title) return null;
    const parts = title.split('（膠囊）');
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px', pointerEvents: 'none' }}>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span>{part}</span>
            {i < parts.length - 1 && (
              <span style={{ background: '#52D0FF', color: 'white', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', margin: '0 2px' }}>膠囊</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="capsule-designer" style={{ marginTop: '20px', padding: '20px', background: '#fdfdfd', borderRadius: '8px', border: '1px dashed #ccc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCollapsed ? '0' : '20px' }}>
        <h5 
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ margin: 0, fontSize: '14px', color: '#999', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isCollapsed ? <IoChevronForward size={14} /> : <IoChevronDown size={14} />}
          生成模板
        </h5>
        {!isCollapsed && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              style={{ background: '#f0f0f0', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#666' }}
            >
              匯入現有模板
            </button>
            <button onClick={() => addNode()} style={{ background: '#52D0FF', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>新增根模板</button>
            <button 
              onClick={() => selectedNodeId && insertPlaceholderAtCursor(selectedNodeId)}
              disabled={!selectedNodeId}
              style={{ border: '1px solid #52D0FF', background: 'white', color: selectedNodeId ? '#52D0FF' : '#ccc', fontSize: '12px', cursor: selectedNodeId ? 'pointer' : 'not-allowed', padding: '6px 12px', borderRadius: '6px' }}
              title="在選中任務的游標位置插入膠囊佔位符"
            >
              插入膠囊
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {showTemplatePicker && (
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #E8EDF2' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#999' }}>選擇要匯入的模板（標題含「（膠囊）」將自動轉換）：</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {generalTemplates.map(tpl => (
                  <button 
                    key={tpl.id} 
                    onClick={() => { onImportTemplate(tpl); setShowTemplatePicker(false); }}
                    style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #52D0FF', background: 'white', color: '#52D0FF', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.target.style.background = '#52D0FF'; e.target.style.color = 'white'; }}
                    onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.color = '#52D0FF'; }}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="designer-tree" style={{ minHeight: '100px' }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#ccc', fontSize: '13px', padding: '40px 0', border: '1px dashed #eee', borderRadius: '8px' }}>
                尚未設計模板，請點擊右上方按鈕開始
              </div>
            ) : (
              tasks.map(node => (
                <TemplateNode 
                  key={node.id}
                  node={node}
                  depth={0}
                  updateNodeTitle={updateNodeTitle}
                  addNode={addNode}
                  removeNode={removeNode}
                  renderVisualTitle={renderVisualTitle}
                  onInputFocus={setSelectedNodeId}
                  registerInputRef={registerInputRef}
                />
              ))
            )}
          </div>
          
          <div style={{ marginTop: '15px', fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
            提示：在標題中輸入「（膠囊）」或點擊按鈕，生成時將自動替換為實際文字。
          </div>
        </>
      )}
    </div>
  );
};

export default CapsuleDesigner;
