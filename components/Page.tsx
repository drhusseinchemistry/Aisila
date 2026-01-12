import React, { useEffect, useRef, useState } from 'react';
import { EditorSettings, PaperSize, MalzamaSection, FloatingElement } from '../types';
import RichTextEditor from './RichTextEditor';

interface PageProps {
  index: number;
  sections: MalzamaSection[]; // Flow sections
  floatingElements: FloatingElement[]; // All floating items (images, shapes, text)
  settings: EditorSettings;
  activeTool: string; // 'select', 'pen', 'highlighter', etc.
  toolSettings: { color: string; width: number; opacity: number };
  onElementMove: (id: string, x: number, y: number) => void;
  onElementResize: (id: string, w: number, h: number) => void;
  onElementUpdate: (id: string, newContent: string) => void;
  onElementStyleUpdate: (id: string, newStyle: any) => void;
  onAddElement: (el: FloatingElement) => void;
  onDeleteElement: (id: string) => void;
}

const Page: React.FC<PageProps> = ({ 
  index, 
  sections,
  floatingElements,
  settings, 
  activeTool,
  toolSettings,
  onElementMove,
  onElementResize,
  onElementUpdate,
  onElementStyleUpdate,
  onAddElement,
  onDeleteElement
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  
  // Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{x:number, y:number}[]>([]);

  const getPageStyle = () => {
    switch(settings.paperSize) {
      case PaperSize.A5: return 'w-[148mm] h-[210mm]';
      case PaperSize.Letter: return 'w-[216mm] h-[279mm]';
      default: return 'w-[210mm] h-[297mm]'; 
    }
  };

  // Convert points to SVG Path Data
  const pointsToPath = (points: {x:number, y:number}[]) => {
    if (points.length === 0) return '';
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return d;
  };

  const handlePageMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'select') return;
    if (activeTool === 'pen' || activeTool === 'highlighter') {
        if (!pageRef.current) return;
        const rect = pageRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setIsDrawing(true);
        setCurrentPoints([{x, y}]);
    }
  };

  const handlePageMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    if (!pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPoints(prev => [...prev, {x, y}]);
  };

  const handlePageMouseUp = () => {
    if (isDrawing) {
        setIsDrawing(false);
        if (currentPoints.length > 1) {
            // Calculate Bounding Box
            const xs = currentPoints.map(p => p.x);
            const ys = currentPoints.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            const width = maxX - minX;
            const height = maxY - minY;

            // Normalize points relative to bounding box
            const normalizedPoints = currentPoints.map(p => ({x: p.x - minX, y: p.y - minY}));
            const d = pointsToPath(normalizedPoints);

            const newEl: FloatingElement = {
                id: Math.random().toString(),
                type: 'path',
                x: minX,
                y: minY,
                width: Math.max(width, 10), // Ensure min size to be selectable
                height: Math.max(height, 10),
                pageIndex: index,
                pathData: d,
                style: {
                    borderColor: toolSettings.color,
                    borderWidth: toolSettings.width,
                    backgroundColor: 'transparent',
                    opacity: activeTool === 'highlighter' ? 0.4 : 1
                }
            };
            onAddElement(newEl);
        }
        setCurrentPoints([]);
    }
  };

  const renderFloatingElement = (el: FloatingElement) => {
    const isEditing = editingId === el.id;
    // Allow selection only if tool is 'select'
    const canSelect = activeTool === 'select';
    const isSelected = isEditing && canSelect;

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!canSelect) return; // Pass through to page if drawing
      if (isEditing && el.type === 'text') return; // Don't drag while editing text
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX - el.x;
      const startY = e.clientY - el.y;
      
      setEditingId(el.id);

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
        className={`absolute group ${isSelected ? 'z-50' : 'z-10'} ${!canSelect ? 'pointer-events-none' : ''}`}
        style={{ left: el.x, top: el.y, width: el.width, height: el.height }}
        onMouseDown={handleMouseDown}
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
           <button className="absolute -top-3 -left-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs z-50 no-print shadow-md hover:bg-red-600 transition"
             onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id); }}>
             &times;
           </button>
        )}

        {/* Content Render based on Type */}
        {el.type === 'image' && (
           <img src={el.src} className="w-full h-full object-cover select-none pointer-events-none" alt="" />
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

        {el.type === 'path' && (
            <svg width="100%" height="100%" viewBox={`0 0 ${el.width} ${el.height}`} style={{overflow: 'visible'}}>
                <path 
                    d={el.pathData} 
                    stroke={el.style?.borderColor} 
                    strokeWidth={el.style?.borderWidth} 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    opacity={el.style?.opacity}
                />
            </svg>
        )}

        {el.type === 'icon' && (
           <div className="w-full h-full flex items-center justify-center text-4xl select-none" style={{ color: el.style?.color || '#000' }}>
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

  const renderFlowSection = (section: MalzamaSection, idx: number) => (
    <div key={section.id} className="mb-6 w-full" style={{ marginBottom: `${settings.questionGap}px` }}>
        <div className="flex items-start gap-4">
            <div className="mt-1 w-10 h-9 rounded-xl text-white font-black text-sm shadow-md flex items-center justify-center flex-shrink-0 select-none" style={{ backgroundColor: settings.primaryColor }}>
                {idx + 1}
            </div>
            <div className="w-full" style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight, color: settings.fontColor }}>
                 <div dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, '<br/>') }} />
            </div>
        </div>
    </div>
  );

  return (
    <div className="relative mb-12 flex flex-col items-center">
        <div 
           ref={pageRef}
           className={`relative bg-white page-shadow overflow-hidden flex flex-col page-break ${getPageStyle()} ${activeTool !== 'select' ? 'cursor-crosshair' : ''}`}
           onMouseDown={handlePageMouseDown}
           onMouseMove={handlePageMouseMove}
           onMouseUp={handlePageMouseUp}
           onMouseLeave={handlePageMouseUp}
           onClick={() => { if(activeTool === 'select') setEditingId(null); }}
        >
             {/* Header */}
             <div className="absolute top-10 left-12 right-12 flex justify-between items-end z-10 border-b-2 pb-6 select-none" style={{ borderColor: settings.primaryColor + '15' }}>
                <div className="flex flex-col items-start gap-1"><div className="text-[11px] font-black" style={{ color: settings.primaryColor }}>وەزارەتا پەروەردێ</div></div>
                <div className="flex flex-col items-center"><div className="font-black text-xl tracking-tight text-slate-900">{settings.teacherName || "ناڤێ مامۆستای"}</div></div>
                <div className="flex flex-col items-end gap-1"><div className="text-[11px] font-black text-left" style={{ color: settings.primaryColor }}>بەرێوبەرایەتیا گشتی</div></div>
            </div>

            {/* Current Drawing Path Overlay */}
            {isDrawing && currentPoints.length > 0 && (
                <div className="absolute inset-0 z-50 pointer-events-none">
                    <svg width="100%" height="100%" style={{overflow: 'visible'}}>
                        <path 
                            d={pointsToPath(currentPoints)} 
                            stroke={toolSettings.color} 
                            strokeWidth={toolSettings.width} 
                            fill="none" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            opacity={activeTool === 'highlighter' ? 0.4 : 1}
                        />
                    </svg>
                </div>
            )}

            {/* Main Content Area */}
            <div className="mt-48 px-16 flex-1 relative z-10 w-full">
                {sections.map((sec, idx) => renderFlowSection(sec, idx))}
                {floatingElements.filter(el => el.pageIndex === index).map(el => renderFloatingElement(el))}
            </div>

            {/* Footer */}
            <div className="h-24 px-16 flex items-center justify-between mt-auto mx-12 border-t select-none" style={{ borderColor: settings.primaryColor + '08' }}>
               <span className="bg-slate-50 text-slate-400 px-5 py-2 rounded-xl text-[10px] font-black border border-slate-100 shadow-sm">لاپەرە {index + 1}</span>
            </div>
        </div>
    </div>
  );
};

export default Page;
