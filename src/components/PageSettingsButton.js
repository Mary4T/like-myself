import React, { useState, useRef, useEffect } from 'react';
import { IoSettings } from 'react-icons/io5';
import { useLocation } from 'react-router-dom';

const APP_HOME_PAGE_KEY = 'appDefaultHomePage.v1';
export const OPEN_OVERVIEW_USER_SETTINGS_EVENT = 'openOverviewUserSettings';

export const dispatchOpenOverviewUserSettings = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_OVERVIEW_USER_SETTINGS_EVENT));
  }
};

const PAGE_CONFIG = {
  '/': { path: '/', label: '總覽' },
  '/total-calendar': { path: '/total-calendar', label: '總日曆' },
  '/projects': { path: '/projects', label: '項目管理' }
};

export const getDefaultHomePage = () => {
  try {
    const saved = localStorage.getItem(APP_HOME_PAGE_KEY);
    return (saved && PAGE_CONFIG[saved]) ? saved : '/';
  } catch {
    return '/';
  }
};

export const setDefaultHomePage = (path) => {
  try {
    localStorage.setItem(APP_HOME_PAGE_KEY, path);
  } catch (e) {
    console.error('Failed to save default home page:', e);
  }
};

const PageSettingsButton = ({ inlineLayout = false, inBottomBar = false }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentPath = location.pathname || '/';
  const currentConfig = PAGE_CONFIG[currentPath] || PAGE_CONFIG['/'];
  const savedHome = getDefaultHomePage();
  const isCurrentHome = savedHome === currentPath;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSetAsHome = () => {
    setDefaultHomePage(currentPath);
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.alert(`已將「${currentConfig.label}」設為開啟 APP 時的預設頁面`);
    }
  };

  const btnStyle = (inlineLayout || inBottomBar)
    ? {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: '1px solid #e1e5e9',
        background: 'white',
        color: '#555',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }
    : {
        position: 'fixed',
        top: '12px',
        left: '12px',
        zIndex: 9999,
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: '1px solid #e1e5e9',
        background: 'white',
        color: '#555',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="page-settings-btn"
        onClick={() => setOpen(prev => !prev)}
        title="設定"
        style={btnStyle}
      >
        <IoSettings />
      </button>
      {open && (
        <div
          style={{
            position: (inlineLayout || inBottomBar) ? 'absolute' : 'fixed',
            top: (inlineLayout || inBottomBar) ? 'calc(100% + 6px)' : '58px',
            left: (inlineLayout || inBottomBar) ? 0 : '12px',
            zIndex: 10000,
            background: 'white',
            border: '1px solid #e1e5e9',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: '8px 0',
            minWidth: '200px'
          }}
        >
          <button
            type="button"
            onClick={handleSetAsHome}
            style={{
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              color: isCurrentHome ? '#52D0FF' : '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>🏠</span>
            <span>將此頁面設為首頁</span>
            {isCurrentHome && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#52D0FF' }}>✓</span>}
          </button>
          {currentPath === '/' && (
            <button
              type="button"
              onClick={() => {
                dispatchOpenOverviewUserSettings();
                setOpen(false);
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderTop: '1px solid #eee'
              }}
            >
              <span>👤</span>
              <span>使用者資料</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PageSettingsButton;
