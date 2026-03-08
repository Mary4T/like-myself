import React, { useEffect, useRef } from 'react';
import './App.css';
import { Routes, Route, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IoRocketOutline, IoHomeOutline } from 'react-icons/io5';
import Home from './Home';
import ProjectList from './components/ProjectTasks/ProjectList';
import UnifiedCalendarPage from './pages/UnifiedCalendarPage';
import MobileSwipeLayout from './layouts/MobileSwipeLayout';
import PageSettingsButton, { getDefaultHomePage } from './components/PageSettingsButton';
import AddTaskFloatingButton from './components/AddTaskFloatingButton';
import GlobalAddTaskModal from './components/GlobalAddTaskModal';
import CharacterButton from './components/CharacterButton';

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

const ResponsiveLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasCheckedInitialHome = useRef(false);

  useEffect(() => {
    if (hasCheckedInitialHome.current) return;
    hasCheckedInitialHome.current = true;
    if (location.pathname !== '/') return;
    const savedHome = getDefaultHomePage();
    if (savedHome && savedHome !== '/') {
      navigate(savedHome, { replace: true });
    }
  }, [location.pathname, navigate]);

  const [isDesktop, setIsDesktop] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleChange = (event) => setIsDesktop(event.matches);
    setIsDesktop(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);
  const [navOpen, setNavOpen] = React.useState(false);
  const navRef = React.useRef(null);

  React.useEffect(() => {
    if (!navOpen) return;
    const handleClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setNavOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [navOpen]);

  if (!isDesktop) {
    return (
      <>
        <PageSettingsButton />
        <AddTaskFloatingButton />
        <CharacterButton />
        <GlobalAddTaskModal />
        <MobileSwipeLayout>
          <Outlet />
        </MobileSwipeLayout>
      </>
    );
  }

  const leftBtnStyle = {
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
    fontSize: '18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    textDecoration: 'none'
  };

  return (
    <div className="desktop-shell">
      <div className="desktop-left-buttons">
        <NavLink
          to={getDefaultHomePage()}
          className="desktop-left-btn"
          style={leftBtnStyle}
          title="首頁"
        >
          <IoHomeOutline />
        </NavLink>
        <div ref={navRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="desktop-left-btn desktop-nav-trigger"
            style={leftBtnStyle}
            onClick={() => setNavOpen(prev => !prev)}
            title="導航"
          >
            <IoRocketOutline />
          </button>
          {navOpen && (
            <div className="desktop-floating-menu desktop-nav-menu">
              <NavLink to="/" end className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`} onClick={() => setNavOpen(false)}>
                總覽
              </NavLink>
              <NavLink to="/total-calendar" className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`} onClick={() => setNavOpen(false)}>
                總日曆
              </NavLink>
              <NavLink to="/projects" className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`} onClick={() => setNavOpen(false)}>
                項目管理
              </NavLink>
            </div>
          )}
        </div>
        <AddTaskFloatingButton inlineLayout />
        <PageSettingsButton inlineLayout />
      </div>
      <CharacterButton />
      <GlobalAddTaskModal />
      <main className="desktop-content">
        <Outlet />
      </main>
    </div>
  );
};

const App = () => {
  return (
    <div className="App">
      <Routes>
        <Route element={<ResponsiveLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/total-calendar" element={<UnifiedCalendarPage />} />
          <Route path="/projects" element={<ProjectList />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;

 
