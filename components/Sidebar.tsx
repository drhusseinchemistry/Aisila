import React, { useState, useRef } from 'react';
import { EditorSettings } from '../types';

interface SidebarProps {
  settings: EditorSettings;
  updateSettings: (s: Partial<EditorSettings>) => void;
  onGenerateImage: () => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAskAI: () => void;
  onDownloadPDF: () => void;
  onUploadFont: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pdfStatus: string | null;
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pdfRange: { from: number; to: number };
  setPdfRange: (r: { from: number; to: number }) => void;
  onGenerateFromPdf: () => void;
  pdfStyle: string;
  setPdfStyle: (s: string) => void;
  uploadProgress: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  settings, updateSettings, onGenerateImage, onUploadImage, onAskAI, onDownloadPDF, onUploadFont,
  pdfStatus, onPdfUpload, pdfRange, setPdfRange, onGenerateFromPdf, pdfStyle, setPdfStyle, uploadProgress
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) {
    return (
      <div className="no-print fixed top-6 right-6 z-50">
        <button onClick={() => setIsOpen(true)} className="w-16 h-16 bg-white rounded-3xl shadow-2xl border flex items-center justify-center text-gray-900 hover:scale-110 transition-all">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-85 bg-white border-l h-screen flex flex-col no-print shadow-2xl z-20 relative animate-in slide-in-from-right-10 duration-300">
      <button onClick={() => setIsOpen(false)} className="absolute top-6 left-6 p-2 bg-gray-50 text-gray-400 hover:text-red-500 rounded-xl transition">&times;</button>
      
      <div className="p-8 border-b flex items-center gap-5 bg-gray-50/50">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg" style={{ backgroundColor: settings.primaryColor }}>A</div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">ئەسیلە چێکرن</h1>
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Premium Edition</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
        
        {/* PDF SECTION */}
        <section className="bg-blue-50/50 p-5 rounded-[24px] border border-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-5 rounded-full bg-blue-600 shadow-sm shadow-blue-200"></div>
            <h3 className="text-sm font-black text-gray-800">سکانەر و OCR</h3>
          </div>
          
          <button onClick={() => pdfInputRef.current?.click()} className="w-full bg-white border-2 border-dashed border-blue-200 py-4 rounded-2xl text-xs font-black text-blue-600 hover:bg-blue-50 transition relative overflow-hidden group">
            {uploadProgress > 0 && uploadProgress < 100 ? (
                <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                    <div className="absolute left-0 top-0 h-full bg-blue-600/30 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    <span className="relative z-10">{uploadProgress}% کارکرن...</span>
                </div>
            ) : (
                pdfStatus ? `بارهاتیە: ${pdfStatus.substring(0, 15)}...` : "ئەپلۆدکرنا PDF یان وێنە"
            )}
          </button>
          <input type="file" accept=".pdf,image/*" ref={pdfInputRef} className="hidden" onChange={onPdfUpload} />

          {pdfStatus && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 mb-1 block">دەستپێک</label>
                  <input type="number" value={pdfRange.from} onChange={e => setPdfRange({...pdfRange, from: parseInt(e.target.value)})} className="w-full border-2 rounded-xl p-2 text-sm font-bold bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 mb-1 block">کۆتایی</label>
                  <input type="number" value={pdfRange.to} onChange={e => setPdfRange({...pdfRange, to: parseInt(e.target.value)})} className="w-full border-2 rounded-xl p-2 text-sm font-bold bg-white" />
                </div>
              </div>
              
              <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 block mb-1">شێواز (بیرکاری، کیمیا، هەلبژارتن...)</label>
                  <textarea value={pdfStyle} onChange={(e) => setPdfStyle(e.target.value)} placeholder="بۆ نموونە: بیرکاری پۆلا ١٢..." className="w-full border-2 border-blue-100 rounded-2xl p-4 text-xs font-bold focus:ring-4 focus:ring-blue-100 outline-none min-h-[80px] resize-none" />
              </div>

              <button onClick={onGenerateFromPdf} className="w-full bg-blue-600 text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition">دروستکردنا پسیاران ب AI</button>
            </div>
          )}
        </section>

        {/* Teacher Info */}
        <section className="space-y-6">
          <div>
            <label className="text-[11px] font-black text-gray-400 mb-2 block uppercase tracking-widest">ناڤێ مامۆستای یان قوتابخانێ</label>
            <input type="text" value={settings.teacherName} onChange={(e) => updateSettings({ teacherName: e.target.value })} className="w-full border-2 rounded-2xl px-5 py-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition font-black text-gray-700 shadow-sm" />
          </div>

          {/* Design Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[11px] font-black text-gray-400 mb-3 block uppercase tracking-widest">رەنگێ سەرەکی</label>
              <div className="flex items-center gap-4">
                <input type="color" value={settings.primaryColor} onChange={(e) => updateSettings({ primaryColor: e.target.value })} className="w-12 h-12 rounded-2xl border-none p-0 overflow-hidden cursor-pointer shadow-md" />
                <span className="text-xs font-black text-gray-500">{settings.primaryColor}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-gray-400 mb-2 block uppercase tracking-widest">قەبارێ فۆنتی</label>
              <input type="number" value={settings.fontSize} onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })} className="w-full border-2 rounded-xl px-3 py-2 text-xs font-bold bg-gray-50" />
            </div>
            <div>
              <label className="text-[11px] font-black text-gray-400 mb-2 block uppercase tracking-widest">دووراتییا پسیاران</label>
              <input type="number" value={settings.questionGap} onChange={(e) => updateSettings({ questionGap: parseInt(e.target.value) })} className="w-full border-2 rounded-xl px-3 py-2 text-xs font-bold bg-gray-50" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-black text-gray-400 mb-2 block uppercase tracking-widest">دووراتییا هەلبژارتنان</label>
              <input type="range" min="0" max="40" value={settings.choiceSpacing} onChange={(e) => updateSettings({ choiceSpacing: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="space-y-4 pt-6 border-t">
          <div className="grid grid-cols-2 gap-3">
             <button onClick={onGenerateImage} className="py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] shadow-lg hover:shadow-gray-200 transition flex flex-col items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                وێنەیێ AI
             </button>
             <button onClick={() => imgInputRef.current?.click()} className="py-4 bg-blue-50 text-blue-600 border-2 border-blue-100 rounded-2xl font-black text-[10px] shadow-sm hover:bg-blue-100 transition flex flex-col items-center justify-center gap-2 group">
                <svg className="w-6 h-6 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                ئەپلۆدکرن
             </button>
          </div>
          <input type="file" accept="image/*" ref={imgInputRef} className="hidden" onChange={onUploadImage} />
          
          <button onClick={onAskAI} className="w-full py-4 border-2 border-blue-600 text-blue-600 rounded-2xl font-black text-xs hover:bg-blue-50 transition flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            چات دگەل زیرەکیێ
          </button>
        </section>
      </div>

      <div className="p-8 bg-white border-t">
        <button onClick={onDownloadPDF} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-sm shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">داونلۆدکرنا ئەسیلەیێ (PDF)</button>
      </div>
    </div>
  );
};

export default Sidebar;