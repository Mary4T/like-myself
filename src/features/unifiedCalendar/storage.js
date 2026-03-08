const SUB_CALENDARS_KEY = 'unifiedCalendar.subCalendars.v1';
const LAST_VIEWED_CALENDAR_KEY = 'unifiedCalendar.lastViewedCalendarId.v1';

export const loadSubCalendars = () => {
  try {
    const raw = localStorage.getItem(SUB_CALENDARS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveSubCalendars = (subCalendars) => {
  try {
    localStorage.setItem(SUB_CALENDARS_KEY, JSON.stringify(Array.isArray(subCalendars) ? subCalendars : []));
  } catch (error) {
    console.error('Failed to save unified calendar sub-calendars:', error);
  }
};

export const loadLastViewedCalendarId = () => {
  try {
    return localStorage.getItem(LAST_VIEWED_CALENDAR_KEY) || 'all';
  } catch {
    return 'all';
  }
};

export const saveLastViewedCalendarId = (calendarId) => {
  try {
    localStorage.setItem(LAST_VIEWED_CALENDAR_KEY, String(calendarId || 'all'));
  } catch (error) {
    console.error('Failed to save unified calendar last viewed id:', error);
  }
};

export const generateSubCalendar = (name = '新子日曆') => ({
  id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  selectedGroupIds: [],
  selectedTaskIds: []
});
