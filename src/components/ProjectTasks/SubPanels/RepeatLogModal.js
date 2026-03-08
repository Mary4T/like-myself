import React from 'react';
import { IoClose, IoChevronDown, IoChevronUp, IoCheckmarkSharp } from 'react-icons/io5';
import { BsTrash } from 'react-icons/bs';

const RepeatLogModal = ({ selectedTask, repeatManager }) => {
  const {
    showModal, setShowModal, activeTab, setActiveTab, expandedEntries, setExpandedEntries,
    showAllSubtasks, setShowAllSubtasks, recentEntries, analysis,
    handleUpdateSnapshot, handleDeleteEntry, handleClearLog, handleToggleEntryStatus
  } = repeatManager;

  if (!showModal || !selectedTask) return null;

  const repeatLogTabButtonStyle = (tab) => ({
    padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
    backgroundColor: activeTab === tab ? '#52D0FF' : '#f5f5f5', color: activeTab === tab ? 'white' : '#666', transition: 'all 0.2s'
  });

  const renderSnapshotTree = (nodes, dateKey, depth = 0) => nodes.map((node, idx) => (
    <div key={idx} style={{ marginLeft: `${depth * 20}px`, marginTop: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
        <div 
          onClick={() => handleUpdateSnapshot(dateKey, node.id, !node.completed)} 
          style={{ 
            width: '14px', height: '14px', borderRadius: '3px', 
            border: `1.5px solid ${node.completed ? '#52D0FF' : '#ccc'}`, 
            background: node.completed ? '#52D0FF' : 'transparent', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' 
          }}
        >
          {node.completed && <IoCheckmarkSharp size={10} />}
        </div>
        <span style={{ 
          color: node.completed ? '#52D0FF' : '#999', 
          textDecoration: node.completed ? 'line-through' : 'none', 
          fontWeight: node.completed ? '500' : 'normal' 
        }}>
          {node.title}
        </span>
      </div>
      {node.children && node.children.length > 0 && renderSnapshotTree(node.children, dateKey, depth + 1)}
    </div>
  ));

  return (
    <div className="time-picker-overlay" onClick={() => setShowModal(false)}>
      <div className="repeat-log-modal" onClick={(e) => e.stopPropagation()} style={{ 
        background: 'white', width: '90%', maxWidth: '600px', maxHeight: '80vh', 
        borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)' 
      }}>
        <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>重複日誌: {selectedTask.title}</h3>
          <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}><IoClose /></button>
        </div>
        
        <div className="modal-tabs" style={{ display: 'flex', padding: '10px 20px', gap: '10px', background: '#fff' }}>
          <button onClick={() => setActiveTab('log')} style={repeatLogTabButtonStyle('log')}>日誌列表</button>
          <button onClick={() => setActiveTab('analysis')} style={repeatLogTabButtonStyle('analysis')}>數據分析</button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {activeTab === 'log' ? (
            <div className="log-list">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>顯示最近 30 筆紀錄</span>
                <button onClick={handleClearLog} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>清空日誌</button>
              </div>
              {recentEntries.length > 0 ? recentEntries.map(entry => {
                const isExpanded = expandedEntries.has(entry.dateKey), hasSnapshot = entry.taskSnapshot && entry.taskSnapshot.length > 0;
                return (
                  <div key={entry.dateKey} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <div className="log-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {hasSnapshot && (
                          <button onClick={() => {
                            const next = new Set(expandedEntries);
                            if (next.has(entry.dateKey)) next.delete(entry.dateKey);
                            else next.add(entry.dateKey);
                            setExpandedEntries(next);
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', alignItems: 'center', padding: 0 }}>
                            {isExpanded ? <IoChevronUp size={14} /> : <IoChevronDown size={14} />}
                          </button>
                        )}
                        <div 
                          onClick={() => handleToggleEntryStatus(entry.dateKey, entry.completed)} 
                          style={{ 
                            width: '20px', height: '20px', borderRadius: '4px', 
                            border: `2px solid ${entry.completed ? '#52D0FF' : '#ddd'}`, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            cursor: 'pointer', background: entry.completed ? '#52D0FF' : 'transparent', 
                            color: 'white', transition: 'all 0.2s' 
                          }}
                        >
                          {entry.completed && <IoCheckmarkSharp size={14} />}
                        </div>
                        <span style={{ color: '#333', fontWeight: '500' }}>{entry.displayDate}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ color: '#999', fontSize: '12px' }}>最高進度: {entry.maxProgress}%</span>
                        <button onClick={() => handleDeleteEntry(entry.dateKey)} style={{ color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}><BsTrash size={14} /></button>
                      </div>
                    </div>
                    {isExpanded && hasSnapshot && (
                      <div style={{ padding: '0 20px 15px 52px', background: '#fafafa', borderTop: '1px dashed #eee' }}>
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px', paddingTop: '8px' }}>任務完成狀況快照：</div>
                        {renderSnapshotTree(entry.taskSnapshot, entry.dateKey)}
                      </div>
                    )}
                  </div>
                );
              }) : <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暫無日誌紀錄</div>}
            </div>
          ) : (
            <div className="analysis-view">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>總紀錄</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{analysis.total}</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>完成次數</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{analysis.completedCount}</div>
                </div>
                <div style={{ background: '#f0faff', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>總完成率</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52D0FF' }}>{analysis.completionRate}%</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '25px' }}>
                <div style={{ background: '#e8f5e9', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>當前連續</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>{analysis.currentStreak} <span style={{ fontSize: '11px' }}>天</span></div>
                </div>
                <div style={{ background: '#fff3e0', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>最長連續</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FF9800' }}>{analysis.longestStreak} <span style={{ fontSize: '11px' }}>天</span></div>
                </div>
                <div style={{ background: '#f3e5f5', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>近期表現</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9C27B0' }}>{analysis.recentCompletionRate}%</div>
                </div>
              </div>

              <div className="trend-chart" style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0 }}>最近 14 筆趨勢</h4>
                  <span style={{ fontSize: '11px', color: '#999' }}>基於每日平均進度</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '120px', gap: '6px', padding: '0 5px' }}>
                  {analysis.recentTrend.map((t, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div 
                        style={{ 
                          width: '100%', height: `${Math.max(5, t.value)}%`, 
                          background: t.value >= 100 ? '#52D0FF' : (t.value > 0 ? '#B3E5FC' : '#eee'), 
                          borderRadius: '3px', transition: 'all 0.3s ease', position: 'relative' 
                        }} 
                        title={`${t.date}: ${t.value}%`}
                      >
                        {t.value >= 100 && <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px' }}>⭐</div>}
                      </div>
                      <span style={{ fontSize: '9px', color: '#999', whiteSpace: 'nowrap' }}>{t.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '25px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0 }}>子任務執行力分析</h4>
                  <button onClick={() => setShowAllSubtasks(!showAllSubtasks)} style={{ background: 'none', border: 'none', color: '#52D0FF', fontSize: '11px', cursor: 'pointer' }}>
                    {showAllSubtasks ? '收起' : '查看全部'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#52D0FF', marginBottom: '10px', fontWeight: 'bold' }}>持續保持</div>
                    {(showAllSubtasks ? analysis.highPerformers : analysis.highPerformers.slice(0, 5)).map((s, i) => (
                      <div key={i} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                          <span style={{ color: '#333', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                          <span style={{ color: '#52D0FF', fontWeight: 'bold' }}>{s.rate}%</span>
                        </div>
                        <div style={{ height: '4px', background: '#e0f7ff', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${s.rate}%`, height: '100%', background: '#52D0FF' }} />
                        </div>
                      </div>
                    ))}
                    {analysis.highPerformers.length === 0 && <div style={{ fontSize: '11px', color: '#ccc', textAlign: 'center', padding: '10px' }}>暫無數據</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: '10px', fontWeight: 'bold' }}>可以進步</div>
                    {(showAllSubtasks ? analysis.lowPerformers : analysis.lowPerformers.slice(0, 5)).map((s, i) => (
                      <div key={i} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                          <span style={{ color: '#333', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                          <span style={{ color: '#999', fontWeight: 'bold' }}>{s.rate}%</span>
                        </div>
                        <div style={{ height: '4px', background: '#f5f5f5', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${s.rate}%`, height: '100%', background: '#ccc' }} />
                        </div>
                      </div>
                    ))}
                    {analysis.lowPerformers.length === 0 && <div style={{ fontSize: '11px', color: '#ccc', textAlign: 'center', padding: '10px' }}>暫無數據</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepeatLogModal;
