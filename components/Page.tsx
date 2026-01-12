import React, { useEffect, useRef, useState } from 'react';
import { EditorSettings, PaperSize, MalzamaSection, FloatingImage } from '../types';

interface PageProps {
  index: number;
  sections: MalzamaSection[];
  settings: EditorSettings;
  floatingImages: FloatingImage[];
  onImageMove: (id: string, x: number, y: number) => void;
  onImageResize: (id: string, w: number, h: number) => void;
  onSectionUpdate?: (id: string, newContent: string) => void;
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
  settings, 
  floatingImages,
  onImageMove,
  onImageResize,
  onSectionUpdate
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
    color: settings.fontColor, // Applied font color
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
        return <div className="whitespace-pre-wrap text-justify leading-relaxed">{parseAndRender(sanitized)}</div>;
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
        <div className="mb-4 leading-relaxed text-justify">{parseAndRender(questionPart)}</div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 w-full mt-2">
          {choiceLabels.map((label, i) => (
            <div key={i} className="flex items-start gap-3 border-r-4 border-transparent hover:border-slate-100 pr-2 transition-all" style={{ marginBottom: `${settings.choiceSpacing}px` }}>
              <span className="font-black opacity-80 bg-blue-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-1" style={{ color: settings.primaryColor }}>{label.replace(')', '')}</span>
              <span className="pt-1 leading-relaxed" style={{ color: settings.fontColor }}>{parseAndRender(choiceParts[i] || '')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`relative bg-white page-shadow mx-auto mb-12 overflow-hidden flex flex-col page-break ${getPageStyle()}`}
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

      <div className="absolute inset-6 border-[1px] pointer-events-none opacity-10 z-0" style={{ borderColor: settings.primaryColor }} />
      <div className="absolute inset-8 border-[3px] pointer-events-none opacity-20 z-0" style={{ borderColor: settings.primaryColor }} />

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

      <div className="mt-48 px-16 flex-1 relative z-10">
        <div className="space-y-0">
          {sections.map((section, idx) => (
            <div key={section.id} className="relative group animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ marginBottom: `${settings.questionGap}px` }}>
              
              {/* Editing Mode */}
              {editingId === section.id ? (
                <div className="relative z-50">
                   <textarea 
                     className="w-full h-auto min-h-[150px] p-4 border-2 border-blue-400 rounded-xl bg-blue-50 focus:outline-none text-base"
                     style={{ fontFamily: 'monospace', direction: 'rtl' }}
                     value={tempContent}
                     onChange={(e) => setTempContent(e.target.value)}
                     autoFocus
                     onBlur={() => {
                        if (onSectionUpdate) onSectionUpdate(section.id, tempContent);
                        setEditingId(null);
                     }}
                   />
                   <div className="text-[10px] text-blue-500 mt-1">Click outside to save. Supports LaTeX ($...$)</div>
                </div>
              ) : (
                // Display Mode
                <div 
                   className="flex items-start gap-6 cursor-pointer hover:bg-slate-50/80 p-2 -m-2 rounded-xl transition-colors border border-transparent hover:border-slate-100 relative group/item"
                   onClick={() => {
                       setEditingId(section.id);
                       setTempContent(section.content);
                   }}
                   title="Click to edit text"
                >
                    <div 
                        className="absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-bl-lg pointer-events-none font-bold"
                    >
                        دەستکاری (Edit)
                    </div>
                     <div 
                      className="mt-1 w-12 h-10 rounded-xl text-white font-black text-sm shadow-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: settings.primaryColor }}
                     >
                      {idx + 1}
                    </div>
                     <div className="flex-1 w-full pointer-events-none">
                       <div 
                        style={{ 
                          fontSize: `${settings.fontSize}px`, 
                          lineHeight: settings.lineHeight,
                        }}
                        className="font-bold w-full"
                      >
                        {formatContent(section.content)}
                      </div>
                     </div>
                </div>
              )}
              
              {idx < sections.length - 1 && (
                <div className="mt-10 flex justify-center pointer-events-none">
                  <div className="w-1/4 h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                </div>
              )}
            </div>
          ))}
        </div>

        {floatingImages.filter(img => img.pageIndex === index).map(img => (
          <div
            key={img.id}
            className="absolute cursor-move border-2 border-transparent hover:border-blue-500 z-50 group transition-all"
            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
            onMouseDown={(e) => {
              // Crucial: Prevent default to stop browser native drag/selection which moves the page
              e.preventDefault();
              e.stopPropagation();
              
              const startX = e.clientX - img.x;
              const startY = e.clientY - img.y;
              
              const move = (mE: MouseEvent) => {
                  mE.preventDefault();
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