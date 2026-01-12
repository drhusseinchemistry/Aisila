import React, { useEffect, useRef, useState } from 'react';
import { EditorSettings, PaperSize, MalzamaSection, FloatingElement } from '../types';
import RichTextEditor from './RichTextEditor';

interface PageProps {
  index: number;
  sections: MalzamaSection[]; // Flow sections
  floatingElements: FloatingElement[]; // All floating items (images, shapes, text)
  settings: EditorSettings;
  onElementMove: (id: string, x: number, y: number) => void;
  onElementResize: (id: string, w: number, h: number) => void;
  onElementUpdate: (id: string, newContent: string) => void;
  onElementStyleUpdate: (id: string, newStyle: any) => void;
}

// LaTeX Renderer (Unchanged)
const LatexRenderer: React.FC<{ latex: string; displayMode: boolean }> = ({ latex, displayMode }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (containerRef.current && (window as any).katex) {
      try {
        (window as any).katex.render(latex, containerRef.current, {
          throwOnError: false,
          displayMode: displayMode
        });
      } catch (err) { console.warn(err); }
    }
  }, [latex, displayMode]);
  return <span ref={containerRef} className={displayMode ? "block my-2 text-center" : "inline-block mx-1"} dir="ltr" />;
};

const Page: React.FC<PageProps> = ({ 
  index, 
  sections,
  floatingElements,
  settings, 
  onElementMove,
  onElementResize,
  onElementUpdate,
  onElementStyleUpdate
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const getPageStyle = () => {
    switch(settings.paperSize) {
      case PaperSize.A5: return 'w-[148mm] h-[210mm]';
      case PaperSize.Letter: return 'w-[216mm] h-[279mm]';
      default: return 'w-[210mm] h-[297mm]'; 
    }
  };

  const renderFloatingElement = (el: FloatingElement) => {
    const isEditing = editingId === el.id;
    const isSelected = isEditing; // Simplify for now

    const handleMouseDown = (e: React.MouseEvent) => {
      if (isEditing && el.type === 'text') return; // Don't drag while editing text
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX - el.x;
      const startY = e.clientY - el.y;
      
      const move = (mE: MouseEvent) => {
          mE.preventDefault();
          onElementMove(el.id, mE.clientX - startX, mE.clientY - startY);
      };
      const stop = () => { 
          window.removeEventListener('mousemove', move); 
          window.removeEventListener('mouseup', stop); 
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
    };

    return (
      <div
        key={el.id}
        className={`absolute group ${isSelected ? 'z-50' : 'z-10'}`}
        style={{ left: el.x, top: el.y, width: el.width, height: el.height }}
        onMouseDown={handleMouseDown}
        onClick={(e) => { e.stopPropagation(); setEditingId(el.id); }}
      >
        {/* Resize Handle */}
        {isSelected && (
           <div 
             className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize z-50 no-print"
             onMouseDown={(e) => {
                 e.stopPropagation(); e.preventDefault();
                 const startX = e.clientX; const startY = e.clientY;
                 const startW = el.width; const startH = el.height;
                 const move = (mE: MouseEvent) => {
                     onElementResize(el.id, Math.max(20, startW + (mE.clientX - startX)), Math.max(20, startH + (mE.clientY - startY)));
                 };
                 const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
                 window.addEventListener('mousemove', move);
                 window.addEventListener('mouseup', stop);
             }}
           />
        )}

        {/* Delete Button */}
        {isSelected && (
           <button className="absolute -top-3 -left-3 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs z-50 no-print"
             onClick={(e) => { e.stopPropagation(); /* Needs a delete handler, for now just hide */  }}>
             &times;
           </button>
        )}

        {/* Content Render based on Type */}
        {el.type === 'image' && (
           <img src={el.src} className="w-full h-full object-cover" alt="" />
        )}
        
        {el.type === 'rect' && (
           <div className="w-full h-full border-2" style={{ borderColor: el.style?.borderColor || '#000', backgroundColor: el.style?.backgroundColor || 'transparent', borderWidth: el.style?.borderWidth || 2 }}></div>
        )}

        {el.type === 'circle' && (
           <div className="w-full h-full rounded-full border-2" style={{ borderColor: el.style?.borderColor || '#000', backgroundColor: el.style?.backgroundColor || 'transparent', borderWidth: el.style?.borderWidth || 2 }}></div>
        )}

        {el.type === 'line' && (
           <div className="w-full h-0.5 bg-black absolute top-1/2" style={{ backgroundColor: el.style?.borderColor || '#000', height: el.style?.borderWidth || 2 }}></div>
        )}

        {el.type === 'icon' && (
           <div className="w-full h-full flex items-center justify-center text-4xl" style={{ color: el.style?.color || '#000' }}>
               {el.content === 'check' && '✅'}
               {el.content === 'x' && '❌'}
               {el.content === 'star' && '⭐'}
               {el.content === 'warning' && '⚠️'}
           </div>
        )}

        {el.type === 'text' && (
           <RichTextEditor 
             initialContent={el.content || ''}
             onChange={(html) => onElementUpdate(el.id, html)}
             style={{ 
                 fontSize: `${el.style?.fontSize || settings.fontSize}px`, 
                 color: el.style?.color || settings.fontColor,
                 lineHeight: settings.lineHeight
             }}
             onBlur={() => setEditingId(null)}
             isEditing={isEditing}
           />
        )}
      </div>
    );
  };

  // Static Flow Content (Old logic preserved for main questions)
  const renderFlowSection = (section: MalzamaSection, idx: number) => (
    <div key={section.id} className="mb-6 w-full" style={{ marginBottom: `${settings.questionGap}px` }}>
        <div className="flex items-start gap-4">
            <div className="mt-1 w-10 h-9 rounded-xl text-white font-black text-sm shadow-md flex items-center justify-center flex-shrink-0 select-none" style={{ backgroundColor: settings.primaryColor }}>
                {idx + 1}
            </div>
            <div className="w-full" style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight, color: settings.fontColor }}>
                 {/* Simple render for flow text, robust html parsing for rich text would be needed here if flow text becomes rich */}
                 <div dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, '<br/>') }} />
            </div>
        </div>
    </div>
  );

  return (
    <div className="relative mb-12 flex flex-col items-center">
        <div 
           className={`relative bg-white page-shadow overflow-hidden flex flex-col page-break ${getPageStyle()}`}
           onClick={() => setEditingId(null)}
        >
             {/* Header/Footer (Same as before) */}
             <div className="absolute top-10 left-12 right-12 flex justify-between items-end z-10 border-b-2 pb-6" style={{ borderColor: settings.primaryColor + '15' }}>
                <div className="flex flex-col items-start gap-1"><div className="text-[11px] font-black" style={{ color: settings.primaryColor }}>وەزارەتا پەروەردێ</div></div>
                <div className="flex flex-col items-center"><div className="font-black text-xl tracking-tight text-slate-900">{settings.teacherName || "ناڤێ مامۆستای"}</div></div>
                <div className="flex flex-col items-end gap-1"><div className="text-[11px] font-black text-left" style={{ color: settings.primaryColor }}>بەرێوبەرایەتیا گشتی</div></div>
            </div>

            {/* Main Content Area */}
            <div className="mt-48 px-16 flex-1 relative z-10 w-full">
                {sections.map((sec, idx) => renderFlowSection(sec, idx))}
                {floatingElements.filter(el => el.pageIndex === index).map(el => renderFloatingElement(el))}
            </div>

            {/* Footer */}
            <div className="h-24 px-16 flex items-center justify-between mt-auto mx-12 border-t" style={{ borderColor: settings.primaryColor + '08' }}>
               <span className="bg-slate-50 text-slate-400 px-5 py-2 rounded-xl text-[10px] font-black border border-slate-100 shadow-sm">لاپەرە {index + 1}</span>
            </div>
        </div>
    </div>
  );
};

export default Page;
