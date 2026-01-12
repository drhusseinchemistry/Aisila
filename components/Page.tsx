import React, { useEffect, useRef, useState } from 'react';
import { EditorSettings, PaperSize, MalzamaSection, FloatingImage } from '../types';

interface PageProps {
  index: number;
  sections: MalzamaSection[]; // These are flow sections (auto-layout)
  floatingSections: MalzamaSection[]; // These are movable text boxes on this page
  settings: EditorSettings;
  floatingImages: FloatingImage[];
  onImageMove: (id: string, x: number, y: number) => void;
  onImageResize: (id: string, w: number, h: number) => void;
  onSectionUpdate: (id: string, newContent: string) => void;
  onSectionMove: (id: string, x: number, y: number) => void;
  onAddTextToPage: () => void;
  onAddImageToPage: () => void;
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
  onSectionMove,
  onAddTextToPage,
  onAddImageToPage
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

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
        return <div className="whitespace-pre-wrap text-justify leading-relaxed break-words w-full overflow-hidden">{parseAndRender(sanitized)}</div>;
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
      <div className="flex flex-col w-full break-words">
        <div className="mb-4 leading-relaxed text-justify break-words w-full">{parseAndRender(questionPart)}</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-full mt-2">
          {choiceLabels.map((label, i) => (
            <div key={i} className="flex items-start gap-2 pr-2 transition-all w-full overflow-hidden" style={{ marginBottom: `${settings.choiceSpacing}px` }}>
              <span className="font-black opacity-80 bg-blue-50 w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-1" style={{ color: settings.primaryColor }}>{label.replace(')', '')}</span>
              <span className="pt-1 leading-relaxed break-words w-full" style={{ color: settings.fontColor }}>{parseAndRender(choiceParts[i] || '')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSection = (section: MalzamaSection, isFloating: boolean = false, index: number = 0) => {
    const isEditing = editingId === section.id;
    
    const content = (
      <div 
        className={`relative group/item ${isFloating ? '' : 'mb-6'}`}
        style={isFloating ? { 
           position: 'absolute', 
           left: section.x || 50, 
           top: section.y || 100, 
           width: section.width || 600,
           zIndex: isEditing ? 100 : 10
        } : { marginBottom: `${settings.questionGap}px` }}
      >
          {/* Move Handle for Floating Text */}
          {isFloating && !isEditing && (
              <div 
                className="absolute -top-6 right-0 bg-blue-100 text-blue-600 p-1 rounded-t cursor-move opacity-0 group-hover/item:opacity-100 transition-opacity no-print z-20 flex items-center gap-2"
                onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX - (section.x || 0);
                    const startY = e.clientY - (section.y || 0);
                    const move = (mE: MouseEvent) => {
                        mE.preventDefault();
                        onSectionMove(section.id, mE.clientX - startX, mE.clientY - startY);
                    };
                    const stop = () => { 
                        window.removeEventListener('mousemove', move); 
                        window.removeEventListener('mouseup', stop); 
                    };
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', stop);
                }}
              >
                 <span className="text-[10px] font-bold px-2">گواستنەوە (Drag)</span>
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </div>
          )}

          {/* Edit Button */}
          {!isEditing && (
             <div 
                className="absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-bl-lg cursor-pointer font-bold z-20 no-print"
                onClick={(e) => { e.stopPropagation(); setEditingId(section.id); }}
             >
                دەستکاری
             </div>
          )}

          {/* Content Area */}
          {isEditing ? (
             <textarea 
               className="w-full p-2 bg-transparent border-2 border-dashed border-blue-400 focus:outline-none resize rounded-lg overflow-hidden"
               style={{ 
                   ...fontStyle, 
                   fontSize: `${settings.fontSize}px`, 
                   lineHeight: settings.lineHeight,
                   minHeight: '100px',
                   height: 'auto'
               }}
               value={section.content}
               onChange={(e) => {
                   onSectionUpdate(section.id, e.target.value);
                   // Auto grow
                   e.target.style.height = 'auto';
                   e.target.style.height = e.target.scrollHeight + 'px';
               }}
               autoFocus
               onBlur={() => setEditingId(null)}
               placeholder="لێرە بنڤیسە..."
             />
          ) : (
            <div 
               className={`w-full h-full ${isFloating ? 'border border-transparent hover:border-blue-100' : ''} p-1 rounded transition-colors`}
               onClick={() => !isFloating && setEditingId(section.id)}
            >
                 <div className="flex items-start gap-4">
                     {!isFloating && (
                        <div 
                            className="mt-1 w-10 h-9 rounded-xl text-white font-black text-sm shadow-md flex items-center justify-center flex-shrink-0 select-none"
                            style={{ backgroundColor: settings.primaryColor }}
                        >
                            {index + 1}
                        </div>
                     )}
                     <div 
                        style={{ 
                          fontSize: `${settings.fontSize}px`, 
                          lineHeight: settings.lineHeight,
                        }}
                        className="font-bold w-full break-words"
                      >
                        {formatContent(section.content)}
                      </div>
                 </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="relative mb-12 flex flex-col items-center">
        <div 
        className={`relative bg-white page-shadow overflow-hidden flex flex-col page-break ${getPageStyle()}`}
        style={fontStyle}
        >
        {/* Inject custom font style if available */}
        {settings.customFontUrl && (
            <style>{`
            @font-face {
                font-family: 'CustomFont';
                src: url('${settings.customFontUrl}');
            }
            `}</style>
        )}

        {/* Decorations */}
        <div className="absolute inset-6 border-[1px] pointer-events-none opacity-10 z-0" style={{ borderColor: settings.primaryColor }} />
        <div className="absolute inset-8 border-[3px] pointer-events-none opacity-20 z-0" style={{ borderColor: settings.primaryColor }} />

        {/* Header */}
        <div className="absolute top-10 left-12 right-12 flex justify-between items-end z-10 border-b-2 pb-6" style={{ borderColor: settings.primaryColor + '15' }}>
            <div className="flex flex-col items-start gap-1">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">KRG Ministry of Education</div>
                <div className="text-[11px] font-black" style={{ color: settings.primaryColor }}>وەزارەتا پەروەردێ</div>
            </div>
            <div className="flex flex-col items-center">
                <div className="font-black text-xl tracking-tight text-slate-900">{settings.teacherName || "ناڤێ مامۆستای"}</div>
                <div className="text-[9px] opacity-40 font-bold uppercase tracking-[0.3em] mt-1">ئەزموونا دوماهیا سالێ</div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Final Examination</div>
                <div className="text-[11px] font-black text-left" style={{ color: settings.primaryColor }}>بەرێوبەرایەتیا گشتی یا ئەزموونان</div>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="mt-48 px-16 flex-1 relative z-10 w-full">
            {/* Flow Sections (Static Pagination) */}
            <div className="space-y-0 w-full">
                {sections.map((section, idx) => renderSection(section, false, idx))}
            </div>

            {/* Floating Sections (Movable Text Boxes) */}
            {floatingSections.map((section) => renderSection(section, true))}

            {/* Floating Images */}
            {floatingImages.filter(img => img.pageIndex === index).map(img => (
            <div
                key={img.id}
                className="absolute cursor-move border-2 border-transparent hover:border-blue-500 z-50 group transition-all"
                style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
                onMouseDown={(e) => {
                e.preventDefault(); // Prevents page scrolling
                e.stopPropagation(); // Stops event bubbling
                
                const startX = e.clientX - img.x;
                const startY = e.clientY - img.y;
                
                const move = (mE: MouseEvent) => {
                    mE.preventDefault(); // Lock screen
                    onImageMove(img.id, mE.clientX - startX, mE.clientY - startY);
                };
                
                const stop = () => { 
                    window.removeEventListener('mousemove', move); 
                    window.removeEventListener('mouseup', stop); 
                };
                
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', stop);
                }}
            >
                <img src={img.src} className="w-full h-full object-cover rounded-2xl shadow-xl bg-white p-1.5 border border-slate-100 pointer-events-none select-none" alt="Illustration" />
                
                {/* Image Resize Handle */}
                <div 
                className="absolute -bottom-3 -right-3 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white cursor-nwse-resize shadow-2xl opacity-0 group-hover:opacity-100 no-print scale-0 group-hover:scale-100 transition-transform z-50"
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

        {/* Footer */}
        <div className="h-24 px-16 flex items-center justify-between mt-auto mx-12 border-t" style={{ borderColor: settings.primaryColor + '08' }}>
            <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: settings.primaryColor }}></div>
            <span className="text-[10px] font-black opacity-30 tracking-[0.2em] uppercase">دوعای سەرکەفتنێ بۆ هەمی قوتابیان دکەین</span>
            </div>
            <span className="bg-slate-50 text-slate-400 px-5 py-2 rounded-xl text-[10px] font-black border border-slate-100 shadow-sm">لاپەرە {index + 1}</span>
        </div>
        </div>

        {/* Add Controls per Page */}
        <div className="flex gap-2 mb-8 no-print opacity-50 hover:opacity-100 transition-opacity">
            <button 
                onClick={onAddTextToPage}
                className="px-4 py-2 bg-white rounded-full shadow border text-xs font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition"
            >
                + نڤیسین بۆ لاپەرە {index + 1}
            </button>
            <button 
                onClick={onAddImageToPage}
                className="px-4 py-2 bg-white rounded-full shadow border text-xs font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition"
            >
                + وێنە بۆ لاپەرە {index + 1}
            </button>
        </div>
    </div>
  );
};

export default Page;