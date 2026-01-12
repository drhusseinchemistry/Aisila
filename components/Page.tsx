import React, { useEffect, useRef, useState } from 'react';
import { EditorSettings, PaperSize, MalzamaSection, FloatingImage } from '../types';

interface PageProps {
  index: number;
  sections: MalzamaSection[]; // Flow sections
  floatingSections: MalzamaSection[]; // Floating text sections
  settings: EditorSettings;
  floatingImages: FloatingImage[];
  onImageMove: (id: string, x: number, y: number) => void;
  onImageResize: (id: string, w: number, h: number) => void;
  onSectionUpdate: (id: string, updates: Partial<MalzamaSection>) => void;
  onConvertToFloating: (id: string, pageIdx: number) => void;
  onConvertToFlow: (id: string) => void;
}

// Helper component to render individual math expressions safely
const LatexRenderer: React.FC<{ latex: string; displayMode: boolean }> = ({ latex, displayMode }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (containerRef.current && (window as any).katex) {
      try {
        (window as any).katex.render(latex, containerRef.current, {
          throwOnError: true,
          displayMode: displayMode,
          strict: false,
          trust: true,
          output: 'html'
        });
        setError(false);
      } catch (err) {
        console.warn("KaTeX render error:", err);
        setError(true);
      }
    }
  }, [latex, displayMode]);

  if (error) {
    return <span className="font-mono text-sm text-gray-600 bg-gray-100 px-1 rounded mx-1" dir="ltr">{displayMode ? `$$${latex}$$` : `$${latex}$`}</span>;
  }

  return <span ref={containerRef} className={displayMode ? "block my-2 text-center" : "inline-block mx-1"} dir="ltr" />;
};

const Page: React.FC<PageProps> = ({ 
  index, 
  sections,
  floatingSections, 
  settings, 
  floatingImages,
  onImageMove,
  onImageResize,
  onSectionUpdate,
  onConvertToFloating,
  onConvertToFlow
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempContent, setTempContent] = useState("");

  const getPageStyle = () => {
    switch(settings.paperSize) {
      case PaperSize.A5: return 'w-[148mm] h-[210mm]';
      case PaperSize.Letter: return 'w-[216mm] h-[279mm]';
      default: return 'w-[210mm] h-[297mm]'; 
    }
  };

  const fontStyle = {
    fontFamily: settings.customFontUrl ? '"CustomFont", "Vazirmatn", sans-serif' : '"Vazirmatn", sans-serif',
    color: settings.fontColor, 
    direction: 'rtl' as const
  };

  const sanitizeLatex = (text: string) => {
    if (!text) return "";
    return text.replace(/\\(\$)/g, '$1');
  };

  const parseAndRender = (text: string) => {
    if (!text) return null;
    const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])|(\$[^\$\n]+?\$|\\\([^\n]+?\\\))/g;
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
        if (!part) return null;
        if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
            return <LatexRenderer key={i} latex={part.startsWith('$$') ? part.slice(2, -2) : part.slice(2, -2)} displayMode={true} />;
        }
        if ((part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
            return <LatexRenderer key={i} latex={part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2)} displayMode={false} />;
        }
        return <span key={i}>{part}</span>;
    });
  };

  const formatContent = (content: string) => {
    if (!content) return null;
    const sanitized = sanitizeLatex(content);
    const choiceLabels = sanitized.match(/[أبجد]\)/g);
    
    if (!choiceLabels) {
        return <div className="whitespace-pre-wrap text-justify leading-relaxed break-words">{parseAndRender(sanitized)}</div>;
    }

    const firstLabel = choiceLabels[0];
    const questionPart = sanitized.split(firstLabel)[0].trim();
    const rest = sanitized.substring(sanitized.indexOf(firstLabel));
    
    const choiceParts: string[] = [];
    let currentRest = rest;
    
    choiceLabels.forEach((label, idx) => {
       const nextLabel = choiceLabels[idx + 1];
       let choiceText = "";
       const labelIndex = currentRest.indexOf(label);
       
       if (nextLabel) {
           const nextLabelIndex = currentRest.indexOf(nextLabel);
           choiceText = currentRest.substring(labelIndex + label.length, nextLabelIndex).trim();
       } else {
           choiceText = currentRest.substring(labelIndex + label.length).trim();
       }
       choiceParts.push(choiceText);
    });

    return (
      <div className="flex flex-col w-full">
        <div className="mb-4 leading-relaxed text-justify break-words">{parseAndRender(questionPart)}</div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 w-full mt-2">
          {choiceLabels.map((label, i) => (
            <div key={i} className="flex items-start gap-3 border-r-4 border-transparent hover:border-slate-100 pr-2 transition-all break-words" style={{ marginBottom: `${settings.choiceSpacing}px` }}>
              <span className="font-black opacity-80 bg-blue-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-1" style={{ color: settings.primaryColor }}>{label.replace(')', '')}</span>
              <span className="pt-1 leading-relaxed break-words" style={{ color: settings.fontColor }}>{parseAndRender(choiceParts[i] || '')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleDragStart = (e: React.MouseEvent, id: string, type: 'image'|'text', initialX: number, initialY: number) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      const move = (mE: MouseEvent) => {
          mE.preventDefault();
          const dx = mE.clientX - startX;
          const dy = mE.clientY - startY;
          
          if (type === 'image') {
              onImageMove(id, initialX + dx, initialY + dy);
          } else {
              onSectionUpdate(id, { x: initialX + dx, y: initialY + dy });
          }
      };

      const stop = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', stop);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
      };

      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
  };

  return (
    <div 
      className={`relative bg-white page-shadow mx-auto mb-12 overflow-hidden flex flex-col page-break ${getPageStyle()}`}
      style={fontStyle}
    >
      {settings.customFontUrl && (
        <style>{`
          @font-face {
            font-family: 'CustomFont';
            src: url('${settings.customFontUrl}');
          }
        `}</style>
      )}

      {/* Header Background */}
      <div className="absolute inset-6 border-[1px] pointer-events-none opacity-10 z-0" style={{ borderColor: settings.primaryColor }} />
      <div className="absolute inset-8 border-[3px] pointer-events-none opacity-20 z-0" style={{ borderColor: settings.primaryColor }} />

      {/* Header Content */}
      <div className="absolute top-10 left-12 right-12 flex justify-between items-end z-10 border-b-2 pb-6" style={{ borderColor: settings.primaryColor + '15' }}>
         <div className="flex flex-col items-start gap-1">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">KRG Ministry of Education</div>
            <div className="text-[11px] font-black" style={{ color: settings.primaryColor }}>وەزارەتا پەروەردێ</div>
         </div>
         <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-2 border border-slate-100">
               <svg className="w-6 h-6 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z"/></svg>
            </div>
            <div className="font-black text-xl tracking-tight text-slate-900">{settings.teacherName || "ناڤێ مامۆستای"}</div>
            <div className="text-[9px] opacity-40 font-bold uppercase tracking-[0.3em] mt-1">ئەزموونا دوماهیا سالێ</div>
         </div>
         <div className="flex flex-col items-end gap-1">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Final Examination</div>
            <div className="text-[11px] font-black text-left" style={{ color: settings.primaryColor }}>بەرێوبەرایەتیا گشتی یا ئەزموونان</div>
         </div>
      </div>

      <div className="mt-48 px-16 flex-1 relative z-10 h-full">
        {/* FLOW CONTENT (List) */}
        <div className="space-y-0 w-full">
          {sections.map((section, idx) => (
            <div key={section.id} className="relative group animate-in fade-in slide-in-from-bottom-2 duration-500 w-full" style={{ marginBottom: `${settings.questionGap}px` }}>
              {editingId === section.id ? (
                <div className="relative z-50">
                   <textarea 
                     className="w-full h-auto min-h-[150px] p-4 border-2 border-blue-400 rounded-xl bg-blue-50 focus:outline-none text-base"
                     style={{ fontFamily: 'monospace', direction: 'rtl' }}
                     value={tempContent}
                     onChange={(e) => setTempContent(e.target.value)}
                     autoFocus
                     onBlur={() => {
                        onSectionUpdate(section.id, { content: tempContent });
                        setEditingId(null);
                     }}
                   />
                </div>
              ) : (
                <div 
                   className="flex items-start gap-6 cursor-pointer hover:bg-slate-50/80 p-2 -m-2 rounded-xl transition-colors border border-transparent hover:border-slate-100 relative group/item"
                   onClick={() => {
                       setEditingId(section.id);
                       setTempContent(section.content);
                   }}
                >
                    <div className="absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 flex gap-1 pointer-events-none group-hover/item:pointer-events-auto">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onConvertToFloating(section.id, index); }}
                            className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold hover:bg-blue-700"
                            title="Convert to Movable Box (Unlock)"
                        >
                            Unlock / جوڵاندن
                        </button>
                    </div>
                     <div 
                      className="mt-1 w-12 h-10 rounded-xl text-white font-black text-sm shadow-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: settings.primaryColor }}
                     >
                      {idx + 1}
                    </div>
                     <div className="flex-1 w-full pointer-events-none break-words overflow-hidden">
                       <div 
                        style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
                        className="font-bold w-full break-words"
                      >
                        {formatContent(section.content)}
                      </div>
                     </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FLOATING TEXT BOXES (Manual Position) */}
        {floatingSections.map((section) => (
             <div 
                key={section.id}
                className="absolute cursor-move border-2 border-dashed border-blue-200 hover:border-blue-500 bg-white/90 p-4 rounded-xl group z-40 shadow-sm hover:shadow-lg transition-all"
                style={{ 
                    left: section.x || 50, 
                    top: section.y || 100, 
                    width: section.width || 400 
                }}
                onMouseDown={(e) => handleDragStart(e, section.id, 'text', section.x || 50, section.y || 100)}
             >
                 {/* Resize Handle */}
                 <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-blue-100 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 flex items-center justify-center"
                     onMouseDown={(e) => {
                         e.stopPropagation();
                         e.preventDefault();
                         const startW = section.width || 400;
                         const startX = e.clientX;
                         const move = (me: MouseEvent) => {
                             onSectionUpdate(section.id, { width: Math.max(200, startW + (me.clientX - startX)) });
                         };
                         const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
                         window.addEventListener('mousemove', move);
                         window.addEventListener('mouseup', stop);
                     }}
                 >
                     <div className="w-0.5 h-4 bg-blue-400"></div>
                 </div>

                 <div className="absolute top-0 right-0 -mt-6 opacity-0 group-hover:opacity-100 flex gap-2">
                     <button onClick={() => onConvertToFlow(section.id)} className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded font-bold">Lock / لیست</button>
                 </div>
                 
                 {editingId === section.id ? (
                     <textarea 
                     className="w-full h-auto min-h-[100px] p-2 bg-transparent focus:outline-none"
                     style={{ fontFamily: 'monospace', direction: 'rtl' }}
                     value={tempContent}
                     onChange={(e) => setTempContent(e.target.value)}
                     autoFocus
                     onBlur={() => { onSectionUpdate(section.id, { content: tempContent }); setEditingId(null); }}
                     onMouseDown={(e) => e.stopPropagation()} 
                   />
                 ) : (
                     <div onDoubleClick={() => { setEditingId(section.id); setTempContent(section.content); }}>
                         <div style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }} className="font-bold w-full break-words">
                            {formatContent(section.content)}
                         </div>
                     </div>
                 )}
             </div>
        ))}

        {/* FLOATING IMAGES */}
        {floatingImages.filter(img => img.pageIndex === index).map(img => (
          <div
            key={img.id}
            className="absolute cursor-move border-2 border-transparent hover:border-blue-500 z-50 group transition-all"
            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
            onMouseDown={(e) => handleDragStart(e, img.id, 'image', img.x, img.y)}
          >
            <img src={img.src} className="w-full h-full object-cover rounded-2xl shadow-xl bg-white p-1.5 border border-slate-100 pointer-events-none select-none" alt="Illustration" />
            <div 
              className="absolute -bottom-3 -right-3 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white cursor-nwse-resize shadow-2xl opacity-0 group-hover:opacity-100 no-print scale-0 group-hover:scale-100 transition-transform"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const startW = img.width;
                const startH = img.height;
                const startX = e.clientX;
                const startY = e.clientY;
                const move = (mE: MouseEvent) => {
                    mE.preventDefault();
                    onImageResize(img.id, Math.max(80, startW + (mE.clientX - startX)), Math.max(80, startH + (mE.clientY - startY)));
                };
                const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', stop);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </div>
          </div>
        ))}
      </div>

      <div className="h-24 px-16 flex items-center justify-between mt-auto mx-12 border-t" style={{ borderColor: settings.primaryColor + '08' }}>
        <div className="flex items-center gap-4">
           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: settings.primaryColor }}></div>
           <span className="text-[10px] font-black opacity-30 tracking-[0.2em] uppercase">دوعای سەرکەفتنێ بۆ هەمی قوتابیان دکەین</span>
        </div>
        <span className="bg-slate-50 text-slate-400 px-5 py-2 rounded-xl text-[10px] font-black border border-slate-100 shadow-sm">لاپەرە {index + 1}</span>
      </div>
    </div>
  );
};

export default Page;