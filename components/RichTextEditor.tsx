import React, { useRef, useEffect, useState } from 'react';

interface RichTextEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  style: React.CSSProperties;
  onBlur: () => void;
  isEditing: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onChange, style, onBlur, isEditing }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isEditing]);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      
      setToolbarPos({
        top: rect.top - editorRect.top - 40,
        left: rect.left - editorRect.left
      });
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  };

  const applyColor = (color: string) => {
    document.execCommand('foreColor', false, color);
  };

  const colors = ['#000000', '#ef4444', '#2563eb', '#16a34a', '#d97706', '#9333ea'];

  return (
    <div className="relative w-full h-full">
      {isEditing && showToolbar && (
        <div 
          className="absolute z-50 bg-white shadow-xl border rounded-lg p-1 flex gap-1 -mt-2 animate-in fade-in zoom-in duration-200"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
        >
           {colors.map(c => (
             <button 
                key={c} 
                onClick={() => applyColor(c)}
                className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition"
                style={{ backgroundColor: c }}
             />
           ))}
           <div className="w-[1px] bg-gray-200 mx-1"></div>
           <button onClick={() => document.execCommand('bold')} className="font-bold px-2 text-xs hover:bg-gray-100 rounded">B</button>
           <button onClick={() => document.execCommand('italic')} className="italic px-2 text-xs hover:bg-gray-100 rounded">I</button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        className={`w-full h-full min-h-[50px] outline-none ${isEditing ? 'cursor-text' : 'cursor-default'}`}
        style={{...style, direction: 'rtl'}}
        dangerouslySetInnerHTML={{ __html: initialContent }}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={onBlur}
        onSelect={handleSelection}
      />
    </div>
  );
};

export default RichTextEditor;
