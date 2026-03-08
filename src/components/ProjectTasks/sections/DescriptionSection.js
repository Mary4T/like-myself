import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import CapsulePanel from '../SubPanels/CapsulePanel';

const DescriptionSection = ({
  quillRef,
  selectedTask,
  handleEditorChange,
  modules,
  formats,
  capsuleManager,
  templateManager,
  tasks,
  descriptionTags,
  descriptionLinks,
  onDescriptionTagClick
}) => {
  return (
    <div className="task-description">
      <CapsulePanel manager={capsuleManager} templateManager={templateManager} tasks={tasks} />

      <div className="editor-container" style={{ marginTop: '12px' }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={selectedTask.description || ''}
          onChange={handleEditorChange}
          modules={modules}
          formats={formats}
        />
      </div>
      {Array.isArray(descriptionTags) && descriptionTags.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {descriptionTags.map((tag) => (
            <button
              key={tag.normalized}
              type="button"
              onClick={() => onDescriptionTagClick?.(tag.raw)}
              style={{ border: '1px solid #e1e5e9', background: '#fff', color: '#333', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
            >
              #{tag.raw}
            </button>
          ))}
        </div>
      )}
      {Array.isArray(descriptionLinks) && descriptionLinks.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {descriptionLinks.map((link, idx) => (
            <a
              key={`${link.url}-${idx}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ border: '1px solid #e1e5e9', background: '#fff', color: '#666', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', maxWidth: '320px' }}
              title={link.url}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default DescriptionSection;
