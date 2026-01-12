
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Page from './components/Page';
import { EditorSettings, PaperSize, MalzamaSection, FloatingImage } from './types';
// Fix: Removed generateQuestionsFromPdfText which was not exported from geminiService
import { processTextToSections, generateExplanatoryImage, chatWithAI, generateQuestionsFromImages } from './services/geminiService';

const App: React.FC = () => {
  const [sections, setSections] = useState<MalzamaSection[]>([]);
  const [pages, setPages] = useState<MalzamaSection[][]>([]);
  const [floatingImages, setFloatingImages] = useState<FloatingImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', text: string}[]>([]);
  
  // PDF specific state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfInfo, setPdfInfo] = useState<{ fileName: string, totalPages: number } | null>(null);
  const [pdfRange, setPdfRange] = useState({ from: 1, to: 1 });
  const [pdfStyle, setPdfStyle] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const [settings, setSettings] = useState<EditorSettings>({
    paperSize: PaperSize.A4,
    fontSize: 16,
    fontColor: '#1e293b',
    primaryColor: '#2563eb',
    lineHeight: 1.8,
    teacherName: '',
    customFontUrl: undefined,
    choiceSpacing: 12,
    questionGap: 40
  });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = (ev.target?.result as string).split(',')[1];
            setPdfInfo({ fileName: file.name, totalPages: 1 });
            setPdfDoc({ isImage: true, base64 });
            setLoading(false);
        };
        reader.readAsDataURL(file);
        return;
    }

    setLoading(true);
    setUploadProgress(10);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const typedArray = new Uint8Array(event.target?.result as ArrayBuffer);
        // @ts-ignore
        const loadingTask = window.pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setPdfInfo({ fileName: file.name, totalPages: pdf.numPages });
        setPdfRange({ from: 1, to: Math.min(pdf.numPages, 2) });
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 1000);
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert("شەکست ل خاندنا PDF هات!");
      setUploadProgress(0);
      setLoading(false);
    }
  };

  const generateFromPdf = async () => {
    if (!pdfDoc) return;
    setLoading(true);
    setUploadProgress(10);
    
    try {
      const base64Pages: string[] = [];
      
      if (pdfDoc.isImage) {
        base64Pages.push(pdfDoc.base64);
      } else {
        const start = Math.max(1, pdfRange.from);
        const end = Math.min(pdfDoc.numPages, pdfRange.to);

        for (let i = start; i <= end; i++) {
          setUploadProgress(10 + Math.floor(((i - start + 1) / (end - start + 1)) * 40));
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 2.5 }); // Higher scale for better OCR
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          base64Pages.push(base64);
        }
      }

      setUploadProgress(60);
      // Fix: Removed apiKey argument
      const { sections: newSections } = await generateQuestionsFromImages(base64Pages, pdfStyle);
      
      if (newSections && newSections.length > 0) {
        setSections(prev => [...prev, ...newSections]);
      } else {
        alert("AI نەشییا چ پسیاران ژ ڤان وێنەیان دروست کەت.");
      }
    } catch (err: any) {
      console.error(err);
      alert(`خەلەتیا OCR/AI: ${err.message}`);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const paginate = useCallback((allSections: MalzamaSection[]) => {
    const charsPerPage = settings.paperSize === PaperSize.A4 ? 1800 : settings.paperSize === PaperSize.A5 ? 900 : 1600;
    const result: MalzamaSection[][] = [];
    let currentPage: MalzamaSection[] = [];
    let currentCharCount = 0;

    allSections.forEach(section => {
      const sectionLength = section.content.length + section.title.length + 300; // Buffer for math/LaTeX
      if (currentCharCount + sectionLength > charsPerPage && currentPage.length > 0) {
        result.push(currentPage);
        currentPage = [section];
        currentCharCount = sectionLength;
      } else {
        currentPage.push(section);
        currentCharCount += sectionLength;
      }
    });

    if (currentPage.length > 0) result.push(currentPage);
    setPages(result);
  }, [settings.paperSize, settings.fontSize, settings.lineHeight, settings.questionGap]);

  useEffect(() => { paginate(sections); }, [sections, settings, paginate]);

  const handleTextSubmit = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      // Fix: Removed apiKey argument
      const { sections: newSections } = await processTextToSections(text);
      setSections(newSections);
    } catch (error: any) {
      alert(`خەلەتەک پەیدابوو: ${error.message}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar 
        settings={settings} 
        updateSettings={(s) => setSettings(prev => ({ ...prev, ...s }))}
        onGenerateImage={async () => {
          const desc = window.prompt("وێنە دەربارەی چی بیت؟ (ب ئینگلیزی)");
          if (desc) {
            setLoading(true);
            // Fix: Removed apiKey argument
            const src = await generateExplanatoryImage(desc);
            if (src) setFloatingImages(prev => [...prev, { id: Math.random().toString(), src, x: 200, y: 300, width: 350, height: 350, pageIndex: 0 }]);
            setLoading(false);
          }
        }}
        onUploadImage={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                if (event.target?.result) {
                  setFloatingImages(prev => [...prev, { id: Math.random().toString(), src: event.target!.result as string, x: 200, y: 300, width: 300, height: 300, pageIndex: 0 }]);
                }
              };
              reader.readAsDataURL(file);
            }
        }}
        onAskAI={() => setShowChat(true)}
        onDownloadPDF={() => window.print()}
        onUploadFont={(e) => {
          const file = e.target.files?.[0];
          if (file) setSettings(prev => ({ ...prev, customFontUrl: URL.createObjectURL(file) }));
        }}
        pdfStatus={pdfInfo ? pdfInfo.fileName : null}
        onPdfUpload={handlePdfUpload}
        pdfRange={pdfRange}
        setPdfRange={setPdfRange}
        onGenerateFromPdf={generateFromPdf}
        pdfStyle={pdfStyle}
        setPdfStyle={setPdfStyle}
        uploadProgress={uploadProgress}
      />

      <main className="flex-1 overflow-y-auto p-12 relative no-scrollbar bg-slate-100/30">
        {sections.length === 0 && !loading && (
          <div className="max-w-4xl mx-auto mt-20 p-16 bg-white rounded-[60px] shadow-2xl border-4 border-white no-print text-center transform transition-all hover:scale-[1.01]">
            <div className="w-24 h-24 bg-blue-600 rounded-[32px] mx-auto mb-10 flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-blue-200">A</div>
            <h2 className="text-5xl font-black text-gray-900 mb-6 tracking-tight">چێکرنا ئەسیلا ب شێوازەکێ نوی</h2>
            <p className="text-gray-400 mb-12 text-xl font-medium">پسیارێن خۆ بنڤیسە یان فایلەکێ PDF ئەپلۆد بکە بۆ دروستکرنا ئەسیلەیەکا فەرمی و جوان.</p>
            <textarea 
              className="w-full h-80 p-10 rounded-[40px] border-4 border-gray-50 focus:border-blue-500 focus:outline-none transition-all resize-none bg-gray-50/50 text-2xl leading-relaxed text-right font-bold placeholder:text-gray-200"
              placeholder="پسیارێن خۆ ل ڤێرە بنڤیسە..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="flex justify-center mt-12">
                <button 
                  onClick={() => handleTextSubmit(prompt)}
                  className="px-20 py-6 bg-blue-600 text-white rounded-[32px] font-black text-2xl shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95"
                >
                  دەستپێبکە
                </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center no-print">
            <div className="relative mb-12">
                <div className="w-32 h-32 border-[12px] border-blue-50 rounded-full"></div>
                <div className="w-32 h-32 border-[12px] border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <div className="text-center space-y-4">
                <p className="text-4xl font-black text-gray-900 tracking-tight animate-pulse px-6">
                  {uploadProgress > 0 && uploadProgress < 60 ? "یێ لاپەڕێن PDF دکەتە وێنە..." : "زیرەکی یێ پسیاران رێکدێخیت (OCR & LaTeX)..."}
                </p>
                <p className="text-gray-400 font-bold">تکایە چەند چرکەکان چاڤەرێ بە</p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center pb-20" id="malzama-print-area">
          {pages.map((pageSections, i) => (
            <Page 
              key={i} index={i} sections={pageSections} settings={settings} floatingImages={floatingImages}
              onImageMove={(id, x, y) => setFloatingImages(prev => prev.map(img => img.id === id ? { ...img, x, y } : img))}
              onImageResize={(id, width, height) => setFloatingImages(prev => prev.map(img => img.id === id ? { ...img, width, height } : img))}
            />
          ))}
        </div>
        
        {pages.length > 0 && (
             <div className="text-center no-print pb-20">
                 <button onClick={() => setSections(prev => [...prev, { id: Math.random().toString(), title: "پسیارەکا نوو", content: "ل ڤێرە پسیارێ بنڤیسە..." }])} className="px-12 py-5 bg-white text-gray-900 rounded-[30px] font-black shadow-2xl border-4 border-white hover:bg-gray-50 transition-all transform hover:scale-105 active:scale-95">+ زێدەکرنا پسیارەکا نوی</button>
             </div>
        )}
      </main>

      {showChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-xl px-4 no-print">
          <div className="bg-white w-full max-w-3xl h-[850px] rounded-[60px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border-8 border-white">
            <div className="p-10 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black tracking-tight mb-1">مامۆستایێ زیرەک</h3>
                <p className="text-white/60 text-sm font-bold uppercase tracking-widest">AI Teaching Assistant</p>
              </div>
              <button onClick={() => setShowChat(false)} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-2xl text-3xl hover:bg-white/20 transition">&times;</button>
            </div>
            <div className="flex-1 p-10 overflow-y-auto space-y-8 bg-slate-50/50 no-scrollbar">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-8 rounded-[40px] shadow-sm ${msg.role === 'user' ? 'bg-white text-gray-900' : 'bg-blue-600 text-white font-bold'}`}>
                    <div className="text-lg leading-relaxed">{msg.text}</div>
                    {msg.role === 'ai' && (
                      <button onClick={() => { setSections(prev => [...prev, { id: Math.random().toString(), title: "بەرسڤا AI", content: msg.text }]); setShowChat(false); }} className="flex items-center gap-3 mt-6 px-6 py-3 bg-white/10 rounded-2xl text-xs font-black tracking-widest hover:bg-white/20 transition uppercase">+ زێدە بکە بۆ ئەسیلەیێ</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-10 border-t-4 border-gray-50 bg-white">
              <input type="text" placeholder="پسیارا تە چیە؟..." className="w-full border-4 border-gray-50 rounded-[30px] px-10 py-6 focus:border-blue-500 font-black text-xl outline-none transition-all" onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const q = e.currentTarget.value;
                    e.currentTarget.value = '';
                    setChatHistory(prev => [...prev, { role: 'user', text: q }]);
                    // Fix: Removed apiKey argument
                    const answer = await chatWithAI(q);
                    if (answer) setChatHistory(prev => [...prev, { role: 'ai', text: answer }]);
                  }
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
