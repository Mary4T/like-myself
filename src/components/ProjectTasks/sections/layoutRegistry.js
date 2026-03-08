export const DEFAULT_SECTION_ORDER = [
  'task-header',
  'task-properties',
  'start-date',
  'reminders',
  'task-status',
  'repeat-settings',
  'description',
  'subtasks',
  'created-at'
];

export const DRAGGABLE_SECTION_IDS = new Set([
  'task-header',
  'task-properties',
  'start-date',
  'reminders',
  'task-status',
  'repeat-settings',
  'description',
  'subtasks',
  'created-at'
]);

export const REMOVABLE_SECTION_IDS = new Set([
  'task-properties',
  'start-date',
  'reminders',
  'repeat-settings',
  'description',
  'subtasks',
  'created-at'
]);

export const SECTION_LABELS = {
  'task-header': '任務標題',
  'task-properties': '任務屬性',
  'start-date': '開始/截止日期',
  'reminders': '提前提醒',
  'task-status': '完成狀態',
  'repeat-settings': '重複性功能',
  'description': '任務描述',
  'subtasks': '子任務清單',
  'created-at': '創建時間'
};
