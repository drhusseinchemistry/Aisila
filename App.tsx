import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Page from './components/Page';
import { EditorSettings, PaperSize, MalzamaSection, FloatingElement } from './types';
import { processTextToSections, generateExplanatoryImage, chatWithAI, generateQuestionsFromImages } from './services/geminiService';

const App: React.FC = () => {
  const [sections, setSections] = useState<MalzamaSection[]>([]);
  const [pages, setPages] = useState<{flow: MalzamaSection[]}[]>([]);
  const [floatingElements, setFloatingElements] = useState<FloatingElement[]>([]);
  const [history, setHistory] = useState<FloatingElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Toolbar State
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'pen', 'highlighter'
  const [toolSettings, setToolSettings] = useState({ color: '#FFD700', width: 5, opacity: 1 });

  // PDF States
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfInfo, setPdfInfo] = useState<{ fileName: string, totalPages: number } | null>(null);
  const [pdfRange, setPdfRange] = useState({ from: 1, to: 1 });
  const [pdfStyle, setPdfStyle] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const [settings, setSettings] = useState<EditorSettings>({
    paperSize: PaperSize.A4,
    fontSize: 14,
    fontColor: '#000000',
    primaryColor: '#2563eb',
    lineHeight: 1.6,
    teacherName: '',
    customFontUrl: undefined,
    choiceSpacing: 10,
    questionGap: 30
  });

  const [activePageIndex, setActivePageIndex] = useState(0);

  // --- History Management ---
  const pushToHistory = (newElements: FloatingElement[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newElements);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
      if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setFloatingElements(history[historyIndex - 1]);
      } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setFloatingElements([]);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setFloatingElements(history[historyIndex + 1]);
      }
  };

  // Helper to wrap state updates with history
  const updateElements = (newElements: FloatingElement[]) => {
      setFloatingElements(newElements);
      pushToHistory(newElements);
  };

  // --- Helpers for Elements ---

  const addElement = (type: FloatingElement['type'], content?: string, src?: string) => {
    // Reset tool to select after adding fixed shapes (except pen which stays active)
    if (type !== 'path') setActiveTool('select');

    const newEl: FloatingElement = {
        id: Math.random().toString(),
        type,
        x: 100,
        y: 200,
        width: type === 'line' ? 200 : (type === 'text' ? 300 : 150),
        height: type === 'line' ? toolSettings.width : 150,
        pageIndex: activePageIndex,
        content: content || (type === 'text' ? 'نڤیسین لێرە...' : undefined),
        src,
        style: {
            borderColor: toolSettings.color,
            borderWidth: toolSettings.width,
            backgroundColor: 'transparent',
            color: toolSettings.color,
            fontSize: settings.fontSize
        }
    };
    updateElements([...floatingElements, newEl]);
  };

  const handleElementMove = (id: string, x: number, y: number) => {
      setFloatingElements(prev => prev.map(el => el.id === id ? { ...el, x, y } : el));
  };
  const handleElementResize = (id: string, width: number, height: number) => {
      setFloatingElements(prev => prev.map(el => el.id === id ? { ...el, width, height } : el));
  };
  const handleElementUpdate = (id: string, content: string) => {
      setFloatingElements(prev => prev.map(el => el.id === id ? { ...el, content } : el));
  };
  const handleElementStyleUpdate = (id: string, style: any) => {
      setFloatingElements(prev => prev.map(el => el.id === id ? { ...el, style: { ...el.style, ...style } } : el));
  };
  const handleDeleteElement = (id: string) => {
      updateElements(floatingElements.filter(el => el.id !== id));
  };
  const handleAddFreehandElement = (el: FloatingElement) => {
      updateElements([...floatingElements, el]);
  };

  // --- PDF & AI Handlers ---
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
          const viewport = page.getViewport({ scale: 2.5 }); 
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

  // Pagination
  useEffect(() => {
    const charsPerPage = settings.paperSize === PaperSize.A4 ? 1800 : 1600;
    const result: {flow: MalzamaSection[]}[] = [];
    let currentFlowPage: MalzamaSection[] = [];
    let currentCharCount = 0;

    sections.forEach(section => {
      const len = section.content.length + 100;
      if (currentCharCount + len > charsPerPage && currentFlowPage.length > 0) {
        result.push({ flow: currentFlowPage });
        currentFlowPage = [section];
        currentCharCount = len;
      } else {
        currentFlowPage.push(section);
        currentCharCount += len;
      }
    });
    if (currentFlowPage.length > 0) result.push({ flow: currentFlowPage });
    
    const maxElemPage = Math.max(...floatingElements.map(e => e.pageIndex), 0);
    while (result.length <= maxElemPage) {
        result.push({ flow: [] });
    }
    setPages(result);
  }, [sections, settings, floatingElements]);

  const handleTextSubmit = async (text: string) => {
    if(!text.trim()) return;
    setLoading(true);
    try {
        const { sections: newSections } = await processTextToSections(text);
        setSections(prev => [...prev, ...newSections]);
    } catch(err) { alert("Error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if(file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  if(ev.target?.result) addElement('image', undefined, ev.target.result as string);
              };
              reader.readAsDataURL(file);
          }
      }} />

      <Sidebar 
        settings={settings} 
        updateSettings={(s) => setSettings(prev => ({ ...prev, ...s }))}
        onGenerateImage={() => { /* ... */ }}
        onUploadImage={(e) => { /* ... */ }}
        onAskAI={() => setShowChat(true)}
        onDownloadPDF={() => window.print()}
        onUploadFont={(e) => { /* ... */ }}
        pdfStatus={pdfInfo ? pdfInfo.fileName : null}
        onPdfUpload={handlePdfUpload}
        pdfRange={pdfRange}
        setPdfRange={setPdfRange}
        onGenerateFromPdf={generateFromPdf}
        pdfStyle={pdfStyle}
        setPdfStyle={setPdfStyle}
        uploadProgress={uploadProgress}
      />

      <div className="flex-1 flex flex-col h-full relative bg-gray-800">
          {/* Main Toolbar */}
          <div className="bg-gray-800 p-2 flex flex-col gap-2 items-center shadow-md z-50 no-print border-b border-gray-700">
              
              {/* Row 1: Actions */}
              <div className="flex items-center gap-2">
                 <button onClick={undo} disabled={historyIndex < 0} className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50">↪️</button>
                 <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50">↩️</button>
                 <div className="w-px h-6 bg-gray-600 mx-2"></div>
                 <button onClick={() => setSections(prev => [...prev, {id: Math.random().toString(), title: "New", content: "..."}])} className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600" title="Add Page">📄+</button>
                 <button onClick={() => window.print()} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-500 font-bold" title="Save/Print">💾</button>
              </div>

              {/* Row 2: Tools */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                 <button onClick={() => setActiveTool('select')} className={`p-2 rounded ${activeTool === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`} title="Select/Hand">🖐️</button>
                 <button onClick={() => { setActiveTool('pen'); }} className={`p-2 rounded ${activeTool === 'pen' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`} title="Pen">✏️</button>
                 <button onClick={() => { setActiveTool('highlighter'); }} className={`p-2 rounded ${activeTool === 'highlighter' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`} title="Highlighter">🖍️</button>
                 <div className="w-px h-6 bg-gray-600 mx-1"></div>
                 <button onClick={() => addElement('text')} className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600" title="Text">T</button>
                 <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600" title="Image">🖼️</button>
                 <div className="w-px h-6 bg-gray-600 mx-1"></div>
                 <button onClick={() => addElement('rect')} className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600" title="Rectangle">⬜</button>
                 <button onClick={() => addElement('circle')} className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600" title="Circle">⚪</button>
                 <button onClick={() => addElement('line')} className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600" title="Line">➖</button>
                 <button onClick={() => addElement('line')} className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 underline font-bold" title="Underline">U</button>
              </div>

              {/* Row 3: Properties */}
              <div className="flex items-center gap-4 text-white text-sm">
                  <div className="flex items-center gap-2">
                      <span>ستووری:</span>
                      <input type="range" min="1" max="20" value={toolSettings.width} onChange={(e) => setToolSettings({...toolSettings, width: parseInt(e.target.value)})} className="accent-blue-500" />
                      <span>{toolSettings.width}</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <span>رەنگ:</span>
                      <input type="color" value={toolSettings.color} onChange={(e) => setToolSettings({...toolSettings, color: e.target.value})} className="bg-transparent border-none w-8 h-8 cursor-pointer" />
                  </div>
              </div>
          </div>

          <main className="flex-1 overflow-y-auto p-12 relative no-scrollbar bg-gray-800" onScroll={(e) => {
              const pageHeight = 1123; 
              const scroll = e.currentTarget.scrollTop;
              setActivePageIndex(Math.floor((scroll + 300) / pageHeight));
          }}>
             {sections.length === 0 && !loading && floatingElements.length === 0 && (
                 <div className="max-w-4xl mx-auto mt-20 p-16 bg-white rounded-[60px] shadow-2xl border-4 border-white no-print text-center">
                    <div className="w-24 h-24 bg-blue-600 rounded-[32px] mx-auto mb-10 flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-blue-200">A</div>
                    <h2 className="text-5xl font-black text-gray-900 mb-6 tracking-tight">چێکرنا ئەسیلا</h2>
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
                    <p className="text-2xl font-bold animate-pulse">جارێ بوەستە...</p>
                </div>
             )}

             <div className="flex flex-col items-center pb-20" id="malzama-print-area">
                {pages.map((pageData, i) => (
                    <Page 
                    key={i} 
                    index={i} 
                    sections={pageData.flow}
                    floatingElements={floatingElements.filter(e => e.pageIndex === i)}
                    settings={settings} 
                    activeTool={activeTool}
                    toolSettings={toolSettings}
                    onElementMove={handleElementMove}
                    onElementResize={handleElementResize}
                    onElementUpdate={handleElementUpdate}
                    onElementStyleUpdate={handleElementStyleUpdate}
                    onAddElement={handleAddFreehandElement}
                    onDeleteElement={handleDeleteElement}
                    />
                ))}
             </div>
          </main>
      </div>
      
      {showChat && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-xl px-4 no-print">
            <div className="bg-white w-full max-w-3xl h-[850px] rounded-[60px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border-8 border-white">
                <div className="p-10 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex justify-between items-center">
                <div>
                    <h3 className="text-3xl font-black tracking-tight mb-1">مامۆستایێ زیرەک</h3>
                </div>
                <button onClick={() => setShowChat(false)} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-2xl text-3xl">&times;</button>
                </div>
                <div className="flex-1 p-10 overflow-y-auto space-y-8 bg-slate-50/50 no-scrollbar">
                {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] p-8 rounded-[40px] shadow-sm ${msg.role === 'user' ? 'bg-white text-gray-900' : 'bg-blue-600 text-white font-bold'}`}>
                        {msg.text}
                    </div>
                    </div>
                ))}
                </div>
                <div className="p-10 border-t-4 border-gray-50 bg-white">
                <input type="text" placeholder="پسیارا تە چیە؟..." className="w-full border-4 border-gray-50 rounded-[30px] px-10 py-6 focus:border-blue-500 font-black text-xl outline-none" onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                        const q = e.currentTarget.value;
                        e.currentTarget.value = '';
                        setChatHistory(prev => [...prev, { role: 'user', text: q }]);
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
