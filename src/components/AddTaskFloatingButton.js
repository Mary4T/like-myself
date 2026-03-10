import React from 'react';
import { IoAdd } from 'react-icons/io5';

const OPEN_ADD_TASK_EVENT = 'openAddTaskModal';

export const dispatchOpenAddTask = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_ADD_TASK_EVENT));
  }
};

export const OPEN_ADD_TASK_EVENT_NAME = OPEN_ADD_TASK_EVENT;

const btnStyle = {
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

const AddTaskFloatingButton = ({ inlineLayout = false, inBottomBar = false }) => {
  const handleClick = () => {
    dispatchOpenAddTask();
  };

  const style = (inlineLayout || inBottomBar)
    ? btnStyle
    : { ...btnStyle, position: 'fixed', top: '60px', left: '12px', zIndex: 9998 };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="新增任務"
      className="add-task-floating-btn"
      style={style}
    >
      <IoAdd />
    </button>
  );
};

export default AddTaskFloatingButton;
