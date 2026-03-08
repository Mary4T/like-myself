import React, { useState, useEffect } from 'react';
import { IoPerson } from 'react-icons/io5';
import { getAvatar, addRecommendedBonusXp, addXpNote, XP_INVALIDATE_EVENT } from '../utils/userOverviewUtils';
import {
  isFirstOpenToday,
  setMoodCheckedToday,
  setTodayMood,
  getMoodOptions,
  completeSimpleTask,
  completeNoteTaskFromDialog,
  completeProjectTaskFromDialog,
  HOME_TASKS_REFRESH_EVENT,
  OPEN_TASK_DETAIL_EVENT
} from '../utils/characterMoodUtils';
import {
  computeRecommendations,
  getRecommendedTasksForDisplay,
  getDueDate,
  getDaysUntilDue
} from '../utils/characterRecommendations';
import { PROJECT_TASKS_UPDATED_EVENT } from './GlobalAddTaskModal';

const AVATAR_UPDATED_EVENT = 'avatarUpdated';

export const dispatchAvatarUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT));
  }
};

const CharacterButton = () => {
  const [avatar, setAvatarState] = useState(getAvatar);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showMoodFirst, setShowMoodFirst] = useState(false);
  const [recommendedTasks, setRecommendedTasks] = useState([]);

  useEffect(() => {
    const handler = () => setAvatarState(getAvatar());
    window.addEventListener(AVATAR_UPDATED_EVENT, handler);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, handler);
  }, []);

  useEffect(() => {
    if (isFirstOpenToday()) {
      setShowMoodFirst(true);
      setDialogOpen(true);
    }
  }, []);

  const handleOpenDialog = () => {
    if (isFirstOpenToday()) {
      setShowMoodFirst(true);
      setDialogOpen(true);
    } else {
      setShowMoodFirst(false);
      setRecommendedTasks(getRecommendedTasksForDisplay());
      setDialogOpen(true);
    }
  };

  const handleMoodSelect = (moodId) => {
    setTodayMood(moodId);
    setMoodCheckedToday();
    const tasks = computeRecommendations(moodId);
    setRecommendedTasks(tasks);
    setShowMoodFirst(false);
  };

  const handleCompleteSimpleTask = (taskId) => {
    completeSimpleTask(taskId);
    addRecommendedBonusXp(1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(XP_INVALIDATE_EVENT));
    }
    setRecommendedTasks(getRecommendedTasksForDisplay());
  };

  const handleCompleteNoteTask = (taskId) => {
    if (completeNoteTaskFromDialog(taskId, addXpNote, addRecommendedBonusXp)) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(HOME_TASKS_REFRESH_EVENT));
        window.dispatchEvent(new CustomEvent(XP_INVALIDATE_EVENT));
      }
      setRecommendedTasks(getRecommendedTasksForDisplay());
    }
  };

  const handleCompleteProjectTask = (taskId) => {
    if (completeProjectTaskFromDialog(taskId, addRecommendedBonusXp)) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PROJECT_TASKS_UPDATED_EVENT));
        window.dispatchEvent(new CustomEvent(XP_INVALIDATE_EVENT));
      }
      setRecommendedTasks(getRecommendedTasksForDisplay());
    }
  };

  const handleTaskComplete = (t) => {
    if (t.completed) return;
    if (t._source === 'simple') handleCompleteSimpleTask(t._rawId || t.id);
    else if (t._source === 'note') handleCompleteNoteTask(t._rawId || t.id);
    else if (t._source === 'project') handleCompleteProjectTask(t._rawId || t.id);
  };

  const getTaskTitle = (t) => t.title || t.text || '未命名';

  return (
    <>
      <button
        type="button"
        onClick={handleOpenDialog}
        title="今日推薦"
        className="character-floating-btn"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9998,
          width: '56px',
          height: '56px',
          borderRadius: '8px',
          border: '1px solid #e1e5e9',
          background: avatar ? 'transparent' : '#E8EDF2',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
      >
        {avatar ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url(${avatar})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        ) : (
          <IoPerson style={{ fontSize: 28, color: '#52D0FF' }} />
        )}
      </button>

      {dialogOpen && (
        <div
          className="character-dialog-overlay"
          onClick={() => setDialogOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 10002,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'flex-end',
            padding: '0 24px 100px 24px',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="character-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '320px',
              width: '100%',
              maxHeight: '70vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
            }}
          >
            {showMoodFirst ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>今天心情如何？</h3>
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666', lineHeight: 1.5 }}>
                  選一個最符合你現在情緒的選項，我會幫你推薦適合的任務～
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {getMoodOptions().map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleMoodSelect(opt.id)}
                      style={{
                        padding: '12px 16px',
                        border: '1px solid #e1e5e9',
                        borderRadius: '8px',
                        background: 'white',
                        color: '#333',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#52D0FF';
                        e.currentTarget.style.background = 'rgba(82, 208, 255, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e1e5e9';
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>今日推薦任務</h3>
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#999' }}>
                  完成推薦任務可獲得 2 倍經驗值！
                </p>
                {recommendedTasks.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>暫無推薦任務</p>
                ) : (
                  <div className="home-subtasks-list character-recommend-list">
                    {recommendedTasks.map((t) => {
                      const isCompleted = t.completed || (t._source === 'project' && (t._todayCompletedFromRepeat === true || t.status === 'completed'));
                      const tForDue = t._source === 'note' && t.details?.date
                        ? { ...t, details: { ...(t.details || {}), dueDate: t.details.dueDate || t.details.date } }
                        : t;
                      const daysUntil = getDueDate(tForDue) ? getDaysUntilDue(tForDue) : null;
                      const countdownText = daysUntil != null
                        ? (daysUntil < 0 ? `已逾期 ${-daysUntil} 天` : daysUntil === 0 ? '今天截止' : `剩 ${daysUntil} 天`)
                        : null;
                      const handleOpenTaskDetail = (e) => {
                        if (e.target.closest('button.home-subtask-check')) return;
                        if (t._source === 'note' || t._source === 'project') {
                          setDialogOpen(false);
                          window.dispatchEvent(new CustomEvent(OPEN_TASK_DETAIL_EVENT, { detail: { task: t, source: t._source } }));
                        }
                      };
                      return (
                        <div
                          key={t._recId || t.id}
                          className={`home-subtask-item ${isCompleted ? 'completed' : ''}`}
                          onClick={handleOpenTaskDetail}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenTaskDetail(e); } }}
                          role="button"
                          tabIndex={0}
                          style={{ cursor: t._source === 'note' || t._source === 'project' ? 'pointer' : undefined }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span className="home-subtask-title">
                              {getTaskTitle(t)}
                            </span>
                            {!isCompleted && countdownText && (
                              <span className={`home-subtask-countdown ${daysUntil < 0 ? 'overdue' : ''}`}>{countdownText}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            className={`home-subtask-check ${isCompleted ? 'completed' : ''}`}
                            onClick={(e) => { e.stopPropagation(); if (!isCompleted) handleTaskComplete(t); }}
                          >
                            {isCompleted ? '✓' : ''}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default CharacterButton;
