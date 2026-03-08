import React, { useState } from 'react';
import { DateTimePicker as MuiDateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TextField, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import './DateTimePicker.css';

const ReminderSelect = ({ value, onChange, onDelete }) => {
  // 移除本地狀態，直接使用傳入的 value
  const handleTimeChange = (field, newValue) => {
    const updated = {
      ...value,  // 使用傳入的 value 而不是本地狀態
      [field]: parseInt(newValue) || 0
    };
    onChange(updated);
  };

  return (
    <div className="reminder-item">
      <div className="reminder-time-inputs">
        <TextField
          label="天"
          type="number"
          size="small"
          value={value.days}  // 直接使用傳入的 value
          onChange={(e) => handleTimeChange('days', e.target.value)}
          InputProps={{
            inputProps: { min: 0 }
          }}
          sx={{ width: 90 }}
        />
        <TextField
          label="小時"
          type="number"
          size="small"
          value={value.hours}  // 直接使用傳入的 value
          onChange={(e) => handleTimeChange('hours', e.target.value)}
          InputProps={{
            inputProps: { min: 0, max: 23 }
          }}
          sx={{ width: 90 }}
        />
        <TextField
          label="分鐘"
          type="number"
          size="small"
          value={value.minutes}  // 直接使用傳入的 value
          onChange={(e) => handleTimeChange('minutes', e.target.value)}
          InputProps={{
            inputProps: { min: 0, max: 59 }
          }}
          sx={{ width: 90 }}
        />
      </div>
      <button
        className="delete-reminder-btn"
        onClick={onDelete}
        title="刪除提醒"
      >
        <CloseIcon fontSize="small" />
      </button>
    </div>
  );
};

const DateTimePicker = ({
  value,
  onChange,
  label,
  reminders = [],
  onRemindersChange
}) => {
  const handleChange = (newValue) => {
    if (onChange) {
      onChange(newValue ? newValue.toDate() : null);
    }
  };

  const handleAddReminder = () => {
    console.log('Adding reminder');
    console.log('Current reminders:', reminders);
    // 創建新的提醒對象並進行深拷貝
    const newReminders = JSON.parse(JSON.stringify([
      ...reminders,
      { days: 1, hours: 0, minutes: 0 }
    ]));
    onRemindersChange(newReminders);
  };
 
  const handleReminderChange = (index, newValue) => {
    // 對當前的 reminders 進行深拷貝
    const currentReminders = JSON.parse(JSON.stringify(reminders));
    
    // 創建新的提醒數組
    const newReminders = [...currentReminders];
    newReminders[index] = newValue;
  
    console.log('DateTimePicker handleReminderChange:', {
      index,
      oldReminders: JSON.stringify(currentReminders),
      newReminders: JSON.stringify(newReminders)
    });
  
    onRemindersChange(newReminders);
  };

  const handleReminderDelete = (index) => {
    const newReminders = reminders.filter((_, i) => i !== index);
    onRemindersChange(newReminders);
  };


  return (
    <div className="date-time-picker">
      <MuiDateTimePicker
        label={label}
        value={value ? dayjs(value) : null}
        onChange={handleChange}
        format="YYYY年MM月DD日 HH:mm"  // 添加這行
        slotProps={{
          textField: {
            variant: 'outlined',
            fullWidth: true,
          },
        }}
      />
      {onRemindersChange && (
        <div className="reminder-section">
          <div className="reminder-header">
            <h4>提前提醒</h4>
            <button 
              className="add-reminder-btn"
              onClick={handleAddReminder}
              title="添加新提醒"
            >
              <AddIcon fontSize="small" />
              添加提醒
            </button>
          </div>
          
          <div className="reminder-options">
            {reminders.map((reminder, index) => (
              <ReminderSelect
                key={index}
                value={reminder}
                onChange={(newValue) => handleReminderChange(index, newValue)}
                onDelete={() => handleReminderDelete(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;