import React, { useState, useEffect } from 'react';
import { DEFAULT_ICONS } from './defaultIcons';
import { IoClose } from 'react-icons/io5';
import './IconSelector.css';

const IconSelector = ({ currentIcon, onIconChange }) => {
  const [showSelector, setShowSelector] = useState(false);
  const [customIcons, setCustomIcons] = useState(() => {
    const saved = localStorage.getItem('customIcons');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('customIcons', JSON.stringify(customIcons));
  }, [customIcons]);

  const handleIconSelect = (iconName) => {
    onIconChange({ type: 'default', name: iconName });
    setShowSelector(false);
  };

  const handleCustomIconSelect = (icon) => {
    onIconChange({ type: 'custom', url: icon.url });
    setShowSelector(false);
  };

  const handleCustomIconUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newIcon = {
          id: Date.now().toString(),
          url: e.target.result
        };
        setCustomIcons(prev => [...prev, newIcon]);
        handleCustomIconSelect(newIcon);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCustomIcon = (iconId, e) => {
    e.stopPropagation();
    setCustomIcons(prev => prev.filter(icon => icon.id !== iconId));
    if (currentIcon?.type === 'custom' && 
        customIcons.find(icon => icon.id === iconId)?.url === currentIcon.url) {
      onIconChange(null);
    }
  };

  const DefaultIcon = DEFAULT_ICONS[0].icon;

  return (
    <div className="icon-selector">
      <div 
        className="current-icon" 
        onClick={() => setShowSelector(!showSelector)}
      >
        {currentIcon ? (
          currentIcon.type === 'custom' ? (
            <img src={currentIcon.url} alt="" />
          ) : (
            React.createElement(
              DEFAULT_ICONS.find(i => i.name === currentIcon.name)?.icon,
              { size: 24 }
            )
          )
        ) : (
          <DefaultIcon size={24} />
        )}
      </div>

      {showSelector && (
        <div className="icon-selector-popup">
          <div className="icon-grid">
            {DEFAULT_ICONS.map((icon) => (
              <div
                key={icon.name}
                className={`icon-option ${
                  currentIcon?.type === 'default' && 
                  currentIcon.name === icon.name ? 'selected' : ''
                }`}
                onClick={() => handleIconSelect(icon.name)}
              >
                {React.createElement(icon.icon, { size: 24 })}
              </div>
            ))}
            
            {customIcons.map((icon) => (
              <div
                key={icon.id}
                className={`icon-option custom ${
                  currentIcon?.type === 'custom' && 
                  currentIcon.url === icon.url ? 'selected' : ''
                }`}
                onClick={() => handleCustomIconSelect(icon)}
              >
                <img src={icon.url} alt="" />
                <button 
                  className="remove-icon"
                  onClick={(e) => removeCustomIcon(icon.id, e)}
                >
                  <IoClose />
                </button>
              </div>
            ))}

            <label className="icon-option upload-option">
              <input
                type="file"
                accept="image/*"
                onChange={handleCustomIconUpload}
                style={{ display: 'none' }}
              />
              <span>+</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default IconSelector;