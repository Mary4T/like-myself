import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ROUTE_ORDER = ['/total-calendar', '/', '/projects'];
const SWIPE_THRESHOLD = 50;

const MobileSwipeLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const activeRef = React.useRef(false);

  const goByDelta = React.useCallback((delta) => {
    const currentIndex = ROUTE_ORDER.indexOf(location.pathname);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= ROUTE_ORDER.length) return;
    navigate(ROUTE_ORDER[nextIndex]);
  }, [location.pathname, navigate]);

  const onTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    activeRef.current = true;
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
  };

  const onTouchEnd = (event) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goByDelta(1);
    else goByDelta(-1);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
};

export default MobileSwipeLayout;
