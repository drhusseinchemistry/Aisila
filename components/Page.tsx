import React, { useEffect, useRef } from 'react';
import { EditorSettings, PaperSize, MalzamaSection, FloatingImage } from '../types';

interface PageProps {
  index: number;
  sections: MalzamaSection[];
  settings: EditorSettings;
  floatingImages: FloatingImage[];
  onImageMove: (id: string, x: number, y: number) => void;
  onImageResize: (id: string, w: number, h: number) => void;
}

const Page: React.FC<PageProps> = ({ 
  index, 
  sections, 
  settings, 
  floatingImages,
  onImageMove,
  onImageResize
}) => {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for quirks mode explicitly
    if (document.compatMode !== "CSS1Compat") {
        console.warn("KaTeX Warning: Document is in Quirks Mode. Rendering might fail. Ensure <!DOCTYPE html> is at the very top.");
    }

    const renderMath = () => {
      if (pageRef.current && (window as any).renderMathInElement) {
        try {
          (window as any).renderMathInElement(pageRef.current, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false}
            ],
            throwOnError: false,
            errorColor: '#f43f5e',
            trust: true,
            strict: false // Less strict to avoid crashing on minor errors
          });
        } catch (e) {
          console.error("KaTeX Auto-render failed:", e);
        }
      }
    };

    // Use a small delay to ensure DOM is fully ready and stable to avoid "Quirks Mode" perception errors
    const timeout = setTimeout(renderMath, 50);
    return () => clearTimeout(timeout);
  }, [sections]);

  const getPageStyle = () => {
    switch(settings.paperSize) {
      case PaperSize.A5: return 'w-[148mm] h-[210mm]';
      case PaperSize.Letter: return 'w-[216mm] h-[279mm]';
      default: return 'w-[210mm] h-[297mm]'; 
    }
  };

  const fontStyle = {
    fontFamily: settings.customFontUrl ? 'CustomMalzamaFont, Vazirmatn' : 'Vazirmatn',
    color: settings.fontColor,
    direction: 'rtl' as const
  };

  // Robust LaTeX sanitization logic
  const sanitizeLatex = (text: string) => {
    if (!text) return "";
    let sanitized = text;

    // 1. Fix escaped dollars (e.g., \$ -> $) which often break KaTeX delimiters
    sanitized = sanitized.replace(/\\(\$)/g, '$1');

    // 2. Fix malformed triple/double delimiters at ends
    sanitized = sanitized.replace(/([^\$])\$\$(?!\$)/g, '$1$');
    sanitized = sanitized.replace(/([^\$])\$\$\$(?!\$)/g, '$1$');

    // 3. Simple balancing check for $ characters
    const dollarCount = (sanitized.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
        // If odd number, try to close it at the end
        sanitized += "$";
    }

    // 4. Clean up spaces around dollar signs if needed (KaTeX prefers no space after opening $)
    sanitized = sanitized.replace(/\$\s+/g, '$');
    sanitized = sanitized.replace(/\s+\$/g, '$');

    return sanitized;
  };

  const formatContent = (content: string) => {
    if (!content) return null;
    
    // Sanitize first to fix formatting issues
    const sanitized = sanitizeLatex(content);
    
    // Check for choice labels (Kurmanji/Sorani labels)
    const choiceLabels = sanitized.match(/[أبجد]\)/g);
    
    if (!choiceLabels) {
        return <div className="whitespace-pre-wrap">{sanitized}</div>;
    }

    // Separate question text from the choices
    // We split by the first label found
    const firstLabel = choiceLabels[0];
    const questionPart = sanitized.split(firstLabel)[0].trim();
    
    // Re-extract everything after the first label and split manually to be safe
    const rest = sanitized.substring(sanitized.indexOf(firstLabel));
    const choiceTexts = rest.split(/[أبجد]\)/).filter(t => t.trim() !== "").map(t => t.trim());

    return (
      <div className="flex flex-col w-full">
        <div className="mb-4 leading-relaxed">{questionPart}</div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 w-full mt-2">
          {choiceLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-3 border-r-4 border-transparent hover:border-slate-100 pr-2 transition-all" style={{ marginBottom: `${settings.choiceSpacing}px` }}>
              <span className="font-black text-blue-600/60 bg-blue-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm">{label.replace(')', '')}</span>
              <span className="text-slate-800">{choiceTexts[i] || '...'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={pageRef}
      className={`relative bg-white page-shadow mx-auto mb-12 overflow-hidden flex flex-col page-break ${getPageStyle()}`}
      style={fontStyle}
    >
      {/* Aesthetic Borders */}
      <div className="absolute inset-6 border-[1px] pointer-events-none opacity-10 z-0" style={{ borderColor: settings.primaryColor }} />
      <div className="absolute inset-8 border-[3px] pointer-events-none opacity-20 z-0" style={{ borderColor: settings.primaryColor }} />

      {/* Header */}
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
              <div className="flex items-start gap-6">
                 <div 
                  className="mt-1 w-12 h-10 rounded-xl text-white font-black text-sm shadow-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: settings.primaryColor }}
                 >
                  {idx + 1}
                </div>
                 <div className="flex-1">
                   <div 
                    style={{ 
                      fontSize: `${settings.fontSize}px`, 
                      lineHeight: settings.lineHeight,
                    }}
                    className="text-slate-900 font-bold"
                  >
                    {formatContent(section.content)}
                  </div>
                 </div>
              </div>
              
              {idx < sections.length - 1 && (
                <div className="mt-10 flex justify-center">
                  <div className="w-1/4 h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Floating Images */}
        {floatingImages.filter(img => img.pageIndex === index).map(img => (
          <div
            key={img.id}
            className="absolute cursor-move border-2 border-transparent hover:border-blue-500 z-50 group transition-all"
            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
            onMouseDown={(e) => {
              const startX = e.clientX - img.x;
              const startY = e.clientY - img.y;
              const move = (mE: MouseEvent) => onImageMove(img.id, mE.clientX - startX, mE.clientY - startY);
              const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', stop);
            }}
          >
            <img src={img.src} className="w-full h-full object-cover rounded-2xl shadow-xl bg-white p-1.5 border border-slate-100" alt="Illustration" />
            <div 
              className="absolute -bottom-3 -right-3 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white cursor-nwse-resize shadow-2xl opacity-0 group-hover:opacity-100 no-print scale-0 group-hover:scale-100 transition-transform"
              onMouseDown={(e) => {
                e.stopPropagation();
                const startW = img.width;
                const startH = img.height;
                const startX = e.clientX;
                const startY = e.clientY;
                const move = (mE: MouseEvent) => onImageResize(img.id, Math.max(80, startW + (mE.clientX - startX)), Math.max(80, startH + (mE.clientY - startY)));
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
  );
};

export default Page;