document.addEventListener('DOMContentLoaded', () => {
    // Libs & Elements
    const { PDFDocument, rgb, BlendMode, StandardFonts, PageSizes } = PDFLib;
    // Set worker to CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const pdfUpload = document.getElementById('pdf-upload');
    const imageUpload = document.getElementById('image-upload');
    const projectUpload = document.getElementById('project-upload');
    const fontUpload = document.getElementById('font-upload');
    const loadProjectBtn = document.getElementById('load-project-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const addBlankPageBtn = document.getElementById('add-blank-page-btn');
    const importPagesBtn = document.getElementById('import-pages-btn');
    const importPdfUpload = document.getElementById('import-pdf-upload');
    const toolBtns = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('color-picker');
    const strokeWidth = document.getElementById('stroke-width');
    const strokeValue = document.getElementById('stroke-value');
    const strokeLabel = document.getElementById('stroke-label');
    const pdfContainer = document.getElementById('pdf-container');
    const loader = document.getElementById('loader');
    const pageThumbnailsContainer = document.getElementById('page-thumbnails-container');
    const goToPageBtn = document.getElementById('go-to-page-btn');
    const pageNumberInput = document.getElementById('page-number-input');
    const contextMenu = document.getElementById('context-menu');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const autosaveStatus = document.getElementById('autosave-status');
    
    // State
    let pdfDoc = null;
    let pdfPages = []; 
    let pageViewports = [];
    let observer = null;
    let currentTool = 'pen';
    let activeCanvas = null;
    let originalPdfBytes = null;
    let currentPdfName = 'document';
    let isDrawingShape = false, shape = null, startPoint = null;
    let customFontBytes = null;
    let customFontName = 'Noto Sans Arabic';
    let sortable = null;
    let history = {};

    // --- Utility Functions ---
    const showLoader = (show, text = '...تکایە چاڤەرێ بە') => {
        loader.querySelector('.loader-text').textContent = text;
        loader.style.display = show ? 'flex' : 'none';
    };

    const showStatus = (message) => {
        autosaveStatus.textContent = message;
        autosaveStatus.style.opacity = '1';
        setTimeout(() => { autosaveStatus.style.opacity = '0'; }, 2500);
    };
    
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- History (Undo/Redo) Management ---
    const saveState = (pageNum) => {
        const canvas = pdfPages[pageNum - 1]?.canvas;
        if (!canvas) return;
        if (!history[pageNum]) {
            history[pageNum] = { stack: [], index: -1 };
        }
        const pageHistory = history[pageNum];
        if (pageHistory.index < pageHistory.stack.length - 1) {
            pageHistory.stack = pageHistory.stack.slice(0, pageHistory.index + 1);
        }
        pageHistory.stack.push(canvas.toJSON());
        pageHistory.index++;
        if (pageHistory.stack.length > 50) {
            pageHistory.stack.shift();
            pageHistory.index--;
        }
        updateUndoRedoButtons(pageNum);
        debouncedAutoSave();
    };

    const undo = (pageNum) => {
        const canvas = pdfPages[pageNum - 1]?.canvas;
        const pageHistory = history[pageNum];
        if (!canvas || !pageHistory || pageHistory.index <= 0) return;
        pageHistory.index--;
        canvas.loadFromJSON(pageHistory.stack[pageHistory.index], () => {
            canvas.renderAll();
            updateUndoRedoButtons(pageNum);
            // ÇARESERKIRÎ: Banga autosave hat rakirin da ku karkirina undo/redo xera neke
            // debouncedAutoSave();
        });
    };

    const redo = (pageNum) => {
        const canvas = pdfPages[pageNum - 1]?.canvas;
        const pageHistory = history[pageNum];
        if (!canvas || !pageHistory || pageHistory.index >= pageHistory.stack.length - 1) return;
        pageHistory.index++;
        canvas.loadFromJSON(pageHistory.stack[pageHistory.index], () => {
            canvas.renderAll();
            updateUndoRedoButtons(pageNum);
             // ÇARESERKIRÎ: Banga autosave hat rakirin da ku karkirina undo/redo xera neke
            // debouncedAutoSave();
        });
    };

    const updateUndoRedoButtons = (pageNum) => {
        const pageHistory = pageNum ? history[pageNum] : null;
        if (!activeCanvas || !pageHistory || !pageHistory.stack) {
            undoBtn.disabled = true;
            redoBtn.disabled = true;
            return;
        }
        undoBtn.disabled = pageHistory.index <= 0;
        redoBtn.disabled = pageHistory.index >= pageHistory.stack.length - 1;
    };

    // --- Auto-Save Management ---
    const autoSaveProject = () => {
        if (pdfPages.length === 0) return;
        showStatus('...پاشەکەفتکرنا ئۆتۆماتیک');
        try {
            const projectData = {
                name: currentPdfName,
                numPages: pdfDoc.numPages,
                annotations: pdfPages.map(p => p && p.canvas ? p.canvas.toJSON() : null),
                history: history
            };
            localStorage.setItem('pdfEditorAutoSave', JSON.stringify(projectData));
            setTimeout(() => showStatus('ئۆتۆماتیک هاتە پاشەکەفتکرن'), 1000);
        } catch (e) {
            console.error("Auto-save failed:", e);
            showStatus('پاشەکەفتکرنا ئۆتۆماتیک سەرنەکەفت');
        }
    };
    const debouncedAutoSave = debounce(autoSaveProject, 2500);

    const checkForAutoSave = () => {
        const savedDataJSON = localStorage.getItem('pdfEditorAutoSave');
        if (!savedDataJSON) return;
        try {
            const savedData = JSON.parse(savedDataJSON);
            if (savedData.name === currentPdfName && savedData.numPages === pdfDoc.numPages) {
                if (confirm('پرۆژەیەکا پاشەکەفتکری یا ئۆتۆماتیک هاتە دیتن. دخازی بهێتە ڤەکرن؟')) {
                    history = savedData.history || {};
                    loadProjectData(savedData.annotations);
                }
            }
        } catch (e) {
            console.error("Failed to load auto-saved project:", e);
            localStorage.removeItem('pdfEditorAutoSave');
        }
    };

    // --- Font Management ---
    const loadCustomFont = async () => {
        try {
            if (customFontBytes) return; 
            // Attempt to load from a default place or just fail gracefully
            const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/NotoSansArabic-Regular.ttf';
            showLoader(true, '...فۆنتێ کوردی تێتە ئامادەکرن');
            const response = await fetch(fontUrl);
            if (!response.ok) throw new Error(`کێشە د بارکرنا فۆنتی دا: ${response.statusText}`);
            customFontBytes = await response.arrayBuffer();
            showLoader(false);
        } catch (error) {
            console.error('Could not load custom font:', error);
            // alert('کێشە دئینانا فۆنتێ کوردی دا چێبوو.'); 
            showLoader(false);
            customFontBytes = null;
        }
    };
    loadCustomFont();

    // --- Core PDF and Canvas Logic ---
    const applyToolToCanvas = (canvas, tool) => {
        if (!canvas) return;
        canvas.isDrawingMode = (tool === 'pen');
        canvas.selection = (tool === 'select' || tool === 'image');
        canvas.defaultCursor = (tool === 'select' || tool === 'image') ? 'default' : 'crosshair';
        canvas.hoverCursor = (tool === 'select' || tool === 'image') ? 'move' : 'crosshair';
        if (tool === 'image') {
            imageUpload.click();
        }
        if (canvas.isDrawingMode) {
            canvas.freeDrawingBrush.color = colorPicker.value;
            canvas.freeDrawingBrush.width = parseInt(strokeWidth.value, 10);
        }
    };

    const setActiveTool = (tool) => {
        currentTool = tool;
        pdfPages.forEach(page => {
            if (page && page.canvas) {
                applyToolToCanvas(page.canvas, tool);
            }
        });
        toolBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));
        strokeLabel.textContent = (tool === 'text-highlighter') ? 'بلندی:' : 'ستووری:';
    };

    const renderPage = async (wrapper) => {
        const pageNum = parseInt(wrapper.dataset.pageNum, 10);
        if (pdfPages[pageNum - 1] || wrapper.dataset.rendered === 'true') return;
        wrapper.dataset.rendered = 'rendering';
        
        try {
            const page = await pdfDoc.getPage(pageNum);
            const containerWidth = pdfContainer.clientWidth > 800 ? pdfContainer.clientWidth - 50 : pdfContainer.clientWidth - 20;
            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = containerWidth / unscaledViewport.width;
            const viewport = page.getViewport({ scale: scale });
            pageViewports[pageNum - 1] = viewport;

            wrapper.style.width = `${viewport.width}px`;
            wrapper.style.height = `${viewport.height}px`;
            
            const canvasEl = wrapper.querySelector('canvas');
            const fabricCanvas = new fabric.Canvas(canvasEl, { width: viewport.width, height: viewport.height });
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
            await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport }).promise;

            fabricCanvas.setBackgroundImage(new fabric.Image(tempCanvas), fabricCanvas.renderAll.bind(fabricCanvas));
            
            fabricCanvas.on('mouse:down', (options) => { activeCanvas = fabricCanvas; handleMouseDown(options); });
            fabricCanvas.on('mouse:move', (options) => handleMouseMove(options));
            const pageStateChanged = () => setTimeout(() => saveState(pageNum), 100);
            fabricCanvas.on('mouse:up', () => { handleMouseUp(); pageStateChanged(); });
            fabricCanvas.on('object:modified', pageStateChanged);
            fabricCanvas.on('object:added', pageStateChanged);
            fabricCanvas.on('object:removed', pageStateChanged);
            
            pdfPages[pageNum - 1] = { canvas: fabricCanvas, viewport };
            applyToolToCanvas(fabricCanvas, currentTool);
            
            wrapper.dataset.rendered = 'true';
            if (!history[pageNum]) saveState(pageNum);
            const pageLoader = wrapper.querySelector('.page-loader');
            if(pageLoader) pageLoader.style.display = 'none';

        } catch (error) {
            console.error(`Failed to render page ${pageNum}:`, error);
            wrapper.dataset.rendered = 'false';
        }
    };

    const handleIntersect = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                renderPage(entry.target);
            }
        });
    };
    
    const setupIntersectionObserver = () => {
        if (observer) observer.disconnect();
        const options = { root: null, rootMargin: '1000px 0px', threshold: 0.01 };
        observer = new IntersectionObserver(handleIntersect, options);
        document.querySelectorAll('.canvas-wrapper').forEach(wrapper => {
            if (wrapper.dataset.rendered !== 'true') {
                observer.observe(wrapper);
            }
        });
    };
    
    const renderThumbnails = async () => {
        pageThumbnailsContainer.innerHTML = '';
        const numPages = pdfDoc.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const desiredWidth = 180;
            const scale = desiredWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });
            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;
            await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
            
            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            item.dataset.pageNum = i;
            item.innerHTML = `
                <img src="${canvas.toDataURL()}" alt="Page ${i}">
                <span class="thumbnail-page-number">${i}</span>
                <button class="thumbnail-delete-btn" title="ژێبرنا لاپەرێ ${i}">X</button>
            `;
            
            item.addEventListener('click', () => goToPage(i));
            item.querySelector('.thumbnail-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deletePage(i);
            });
            pageThumbnailsContainer.appendChild(item);
        }
        
        if (sortable) sortable.destroy();
        sortable = new Sortable(pageThumbnailsContainer, {
            animation: 150,
            ghostClass: 'active-thumbnail',
            onEnd: handlePageReorder,
        });
    };

    const loadPdf = async (pdfBytes, pdfName, stateToRestore = null) => {
        currentPdfName = pdfName.replace('.pdf', '');
        originalPdfBytes = pdfBytes;
        showLoader(true, '...پێزانینێن PDF تێنە خواندن');
        pdfContainer.innerHTML = '';
        pageThumbnailsContainer.innerHTML = '';
        pdfPages = [];
        pageViewports = [];
        
        if (!stateToRestore) {
            history = {};
            updateUndoRedoButtons();
        }
        
        pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const numPages = pdfDoc.numPages;
        pageNumberInput.max = numPages;
        pageNumberInput.value = '';
        pdfPages = new Array(numPages).fill(null);
        pageViewports = new Array(numPages).fill(null);

        for (let i = 1; i <= numPages; i++) {
            const wrapper = document.createElement('div');
            wrapper.className = 'canvas-wrapper';
            wrapper.dataset.pageNum = i;
            wrapper.innerHTML = `<canvas></canvas><div class="page-loader">...لاپەر ${i} تێتە ئامادەکرن</div>`;
            pdfContainer.appendChild(wrapper);
        }
        
        // ÇARESERKIRÎ: لاپەرێ ئێکێ ڕاستەوخۆ باردکەت بۆ باشترکرنا ئەزموونێ
        const firstPageWrapper = pdfContainer.querySelector('.canvas-wrapper[data-page-num="1"]');
        if (firstPageWrapper) {
            await renderPage(firstPageWrapper);
        }

        setupIntersectionObserver();
        await renderThumbnails();
        showLoader(false);
        setActiveTool('pen');
        
        if (stateToRestore) {
            history = stateToRestore.history || {};
            await loadProjectData(stateToRestore.annotations);
        } else {
            checkForAutoSave();
        }
        
        await goToPage(1);
    };

    const goToPage = async (pageNum) => {
        const num = parseInt(pageNum, 10);
        if (!pdfDoc || isNaN(num) || num < 1 || num > pdfDoc.numPages) return;
        
        const wrapper = document.querySelector(`.canvas-wrapper[data-page-num="${num}"]`);
        if (!wrapper) return;
        
        if (wrapper.dataset.rendered !== 'true') {
            await renderPage(wrapper);
        }
        
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        document.querySelectorAll('.canvas-wrapper.active-page').forEach(p => p.classList.remove('active-page'));
        wrapper.classList.add('active-page');
        document.querySelectorAll('.thumbnail-item.active-thumbnail').forEach(t => t.classList.remove('active-thumbnail'));
        const activeThumbnail = document.querySelector(`.thumbnail-item[data-page-num="${num}"]`);
        if (activeThumbnail) activeThumbnail.classList.add('active-thumbnail');

        activeCanvas = pdfPages[num - 1]?.canvas;
        updateUndoRedoButtons(num);
    };

    // --- SERRATSKIRÎ: Fonksiyonên Guhertina Rûpelan ---
    const captureFullState = () => {
        const annotations = pdfPages.map(p => p && p.canvas ? p.canvas.toJSON() : null);
        return { annotations, history };
    };

    const deletePage = async (pageNum) => {
        if (!confirm(`پشتڕاستی کو دێ لاپەرێ ${pageNum} ژێبەی؟`)) return;
        showLoader(true, `...لاپەر ${pageNum} تێتە ژێبرن`);
        try {
            const pdfToModify = await PDFDocument.load(originalPdfBytes);
            if (pdfToModify.getPageCount() <= 1) {
                alert("نەشێی داوی لاپەر ژێبەی!");
                showLoader(false);
                return;
            }

            const currentState = captureFullState();
            currentState.annotations.splice(pageNum - 1, 1);
            
            const newHistory = {};
            Object.keys(currentState.history).forEach(key => {
                const keyNum = parseInt(key, 10);
                if (keyNum < pageNum) newHistory[keyNum] = currentState.history[keyNum];
                else if (keyNum > pageNum) newHistory[keyNum - 1] = currentState.history[keyNum];
            });
            currentState.history = newHistory;
            
            pdfToModify.removePage(pageNum - 1);
            const newPdfBytes = await pdfToModify.save();
            await loadPdf(newPdfBytes, `${currentPdfName}-modified.pdf`, currentState);

        } catch (error) {
            console.error("Error deleting page:", error);
            alert("کێشە د ژێبرنا لاپەری دا چێبوو.");
        } finally {
            showLoader(false);
        }
    };
    
    // ÇARESERKIRÎ: Fonksiyona guhertina cihê lapperan hat lezgîn kirin
    const handlePageReorder = async (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;

        showLoader(true, '...جهێ لاپەران تێتە گوهۆڕین');
        try {
            // 1. Reorder arraysên state
            const [movedPageData] = pdfPages.splice(oldIndex, 1);
            pdfPages.splice(newIndex, 0, movedPageData);

            const [movedViewport] = pageViewports.splice(oldIndex, 1);
            pageViewports.splice(newIndex, 0, movedViewport);
            
            const historyArray = [];
            for (let i = 1; i <= pdfPages.length; i++) {
                historyArray.push(history[i] || { stack: [], index: -1 });
            }
            const [movedHistory] = historyArray.splice(oldIndex, 1);
            historyArray.splice(newIndex, 0, movedHistory);
            const reorderedHistory = {};
            historyArray.forEach((h, i) => { reorderedHistory[i + 1] = h; });
            history = reorderedHistory;

            // 2. Reorder wraperên canvasê di DOM'ê de
            const wrappers = Array.from(pdfContainer.children);
            const [movedWrapper] = wrappers.splice(oldIndex, 1);
            wrappers.splice(newIndex, 0, movedWrapper);
            pdfContainer.innerHTML = '';
            wrappers.forEach(w => pdfContainer.appendChild(w));

            // 3. Nûkirina dataset û hejmarên rûpelan
            Array.from(pageThumbnailsContainer.children).forEach((item, index) => {
                const pageNum = index + 1;
                item.dataset.pageNum = pageNum;
                item.querySelector('.thumbnail-page-number').textContent = pageNum;
            });
            Array.from(pdfContainer.children).forEach((wrapper, index) => {
                const pageNum = index + 1;
                wrapper.dataset.pageNum = pageNum;
            });

            // 4. Di paşperdeyê de fayla PDF'ê nû bike
            const pdfToModify = await PDFDocument.load(originalPdfBytes);
            const [movedPage] = await pdfToModify.copyPages(pdfToModify, [oldIndex]);
            pdfToModify.removePage(oldIndex);
            pdfToModify.insertPage(newIndex, movedPage);
            originalPdfBytes = await pdfToModify.save(); // Baytên orîjînal nû bike

        } catch (error) {
            console.error("Error reordering pages:", error);
            alert("کێشە د گوهۆڕینا جهێ لاپەران دا چێبوو.");
            // Heke xeletiyek çêbibe, UI'yê ji nû ve bar bike da ku hevgirtî be
            window.location.reload();
        } finally {
            showLoader(false);
        }
    };
    
    const addBlankPage = async () => {
        showLoader(true, '...لاپەرێ سپی تێتە زێدەکرن');
        try {
            const currentState = captureFullState();
            const pdfToModify = originalPdfBytes ? await PDFDocument.load(originalPdfBytes) : await PDFDocument.create();
            pdfToModify.addPage(PageSizes.A4);
            const newPdfBytes = await pdfToModify.save();

            currentState.annotations.push(null);
            
            await loadPdf(newPdfBytes, `${currentPdfName}-modified.pdf`, currentState);
        } catch (error) {
            console.error("Error adding blank page:", error);
            alert("کێشە د زێدەکرنا لاپەرێ سپی دا چێبوو.");
        } finally {
            showLoader(false);
        }
    };
    
    const importPages = async (file) => {
        if (!originalPdfBytes) { alert("تکایە سەرەتا PDFەکا سەرەکی ڤەکە دا کو لاپەران بۆ زێدەکەی."); return; }
        showLoader(true, '...لاپەر تێنە ئینان');
        try {
            const currentState = captureFullState();
            const newPdfBytes = await file.arrayBuffer();
            const destDoc = await PDFDocument.load(originalPdfBytes);
            const sourceDoc = await PDFDocument.load(newPdfBytes);
            
            const pageIndicesStr = prompt(`ژمارا لاپەران ژ فایلێ دوویێ بنڤیسە دا بهێنە ئینان (بۆ نموونە: 1, 3-5, 8). فایلێ دووێ ${sourceDoc.getPageCount()} لاپەر هەنە.`);
            if (!pageIndicesStr) { showLoader(false); return; }

            const pageRanges = pageIndicesStr.split(',').map(s => s.trim());
            const pagesToCopy = [];
            pageRanges.forEach(range => {
                if (range.includes('-')) {
                    const [start, end] = range.split('-').map(Number);
                    for (let i = start; i <= end; i++) pagesToCopy.push(i - 1);
                } else { pagesToCopy.push(Number(range) - 1); }
            });

            const copiedPages = await destDoc.copyPages(sourceDoc, pagesToCopy);
            copiedPages.forEach(page => {
                destDoc.addPage(page);
                currentState.annotations.push(null);
            });

            const finalPdfBytes = await destDoc.save();
            await loadPdf(finalPdfBytes, `${currentPdfName}-imported.pdf`, currentState);
        } catch (error) {
            console.error("Error importing pages:", error);
            alert("کێشە د ئینانا لاپەران دا چێبوو: " + error.message);
        } finally {
            showLoader(false);
        }
    };

    const showContextMenu = (x, y, canvasWrapper) => {
        const pageNum = parseInt(canvasWrapper.dataset.pageNum, 10);
        activeCanvas = pdfPages[pageNum - 1]?.canvas;
        if (!activeCanvas) return;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'flex';
    };

    const hideContextMenu = () => { contextMenu.style.display = 'none'; };

    // --- Project Save/Load ---
    const saveProject = () => {
        if (pdfPages.length === 0) { alert('بۆ پاشەکەفتکرنێ، دڤێت PDFەکا ڤەکری هەبیت!'); return; }
        showLoader(true, '...پرۆژە تێتە پاشەکەفتکرن');
        const projectData = {
            annotations: pdfPages.map(p => p && p.canvas ? p.canvas.toJSON() : null),
            history: history
        };
        const jsonStr = JSON.stringify(projectData);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${currentPdfName}-project.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        showLoader(false);
    };

    const loadProjectData = async (projectAnnotations) => {
        if (!projectAnnotations || projectAnnotations.length !== pdfDoc.numPages) {
            alert('هژمارا لاپەرێن پرۆژەی و PDFێ نە وەکی ئێک نینن!');
            return;
        }
        showLoader(true, '...پرۆژە تێتە ڤەکرن');
        try {
            for (let i = 0; i < pdfDoc.numPages; i++) {
                if (projectAnnotations[i]) {
                    showLoader(true, `...لاپەر ${i + 1} / ${pdfDoc.numPages} تێتە ئامادەکرن`);
                    const wrapper = pdfContainer.querySelector(`.canvas-wrapper[data-page-num="${i + 1}"]`);
                    if (!wrapper) continue;
                    if (wrapper.dataset.rendered !== 'true') {
                         await renderPage(wrapper);
                         if (observer) observer.unobserve(wrapper);
                    }
                    if (pdfPages[i] && pdfPages[i].canvas) {
                        pdfPages[i].canvas.loadFromJSON(projectAnnotations[i], () => {
                            pdfPages[i].canvas.renderAll();
                            if (!history[i+1]) saveState(i + 1);
                        });
                    }
                }
            }
        } catch (err) { alert('فایلا پرۆژەی نە دروستە!'); console.error(err); } 
        finally { showLoader(false); }
    };

    const loadProject = (projectFile) => {
        if (!pdfDoc) { alert('بۆ ڤەکرنا پرۆژەی، دڤێت PDFا پەیوەندیدار ڤەکری بیت!'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = JSON.parse(e.target.result);
            history = data.history || {};
            loadProjectData(data.annotations);
            updateUndoRedoButtons(1);
        };
        reader.readAsText(projectFile);
    };
    
    // --- Export ---
    const parseColor = (colorString) => {
        if (!colorString || typeof colorString !== 'string') return { color: rgb(0, 0, 0), opacity: 1 };
        const color = new fabric.Color(colorString);
        const [r, g, b] = color.getSource();
        return { color: rgb(r / 255, g / 255, b / 255), opacity: color.getAlpha() };
    };
    
    const fabricPathToSvg = (fabricPath) => fabricPath.map(p => p.join(' ')).join(' ');

    const exportFinalPdf = async () => {
        if (!originalPdfBytes) { alert("تکایە سەرەتا PDFەکێ ڤەکە!"); return; }
        if (!customFontBytes) {
            // alert('خەلەتی: فۆنتێ کوردی بارنەبوویە!');
            await loadCustomFont();
            // if (!customFontBytes) return;
        }
        if (typeof fontkit === 'undefined') {
            alert('کێشەی سەرەکی: کتێبخانەی "fontkit" بارنەبوویە.');
            return;
        }

        try {
            showLoader(true, '...PDF تێتە هناردەکرن');
            const allWrappers = document.querySelectorAll('.canvas-wrapper');
            for (let i = 0; i < allWrappers.length; i++) {
                if (!pdfPages[i] || allWrappers[i].dataset.rendered !== 'true') {
                    showLoader(true, `...لاپەر ${i + 1} / ${allWrappers.length} تێتە ئامادەکرن`);
                    await renderPage(allWrappers[i]);
                }
            }

            const pdfDoc = await PDFDocument.load(originalPdfBytes);
            pdfDoc.registerFontkit(fontkit);
            
            let embeddedFont = null;
            if (customFontBytes) {
                 embeddedFont = await pdfDoc.embedFont(customFontBytes, { subset: true });
            } else {
                 embeddedFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            }
            const pages = pdfDoc.getPages();

            for (let i = 0; i < pages.length; i++) {
                showLoader(true, `...لاپەر ${i + 1} / ${pages.length} تێتە پرۆسێسکرن`);
                const page = pages[i];
                if (!pdfPages[i] || !pdfPages[i].canvas) continue;
                
                const { canvas, viewport } = pdfPages[i];
                const scale = page.getWidth() / viewport.width;
                const pageHeight = page.getHeight();

                for (const obj of canvas.getObjects()) {
                    try {
                        const coords = { x: (obj.left || 0) * scale, y: pageHeight - ((obj.top || 0) * scale), width: (obj.width * (obj.scaleX || 1)) * scale, height: (obj.height * (obj.scaleY || 1)) * scale };
                        const strokeW = (obj.strokeWidth || 0) * (obj.scaleX || 1) * scale;
                        
                        if (obj.type === 'image' && obj.getSrc()) {
                            const imageBytes = await fetch(obj.getSrc()).then(res => res.arrayBuffer());
                            const pdfImage = await pdfDoc.embedPng(imageBytes);
                            page.drawImage(pdfImage, { x: coords.x, y: coords.y - coords.height, width: coords.width, height: coords.height });
                        } else if (obj.type === 'path') {
                            const { color, opacity } = parseColor(obj.stroke);
                            page.drawSvgPath(fabricPathToSvg(obj.path), { x: coords.x, y: coords.y, borderColor: color, borderWidth: strokeW, scale: scale * (obj.scaleX || 1), opacity });
                        } else if (obj.type.includes('line')) {
                            const { color, opacity } = parseColor(obj.stroke);
                            page.drawLine({ start: { x: obj.x1 * scale, y: pageHeight - (obj.y1 * scale) }, end: { x: obj.x2 * scale, y: pageHeight - (obj.y2 * scale) }, thickness: strokeW, color, opacity });
                        } else if (obj.type === 'rect') {
                            const isHighlighter = obj.globalCompositeOperation === 'multiply';
                            page.pushGraphicsState();
                            if (isHighlighter) {
                                const { color, opacity } = parseColor(obj.fill);
                                page.setBlendMode(BlendMode.Multiply);
                                page.drawRectangle({ x: coords.x, y: coords.y - coords.height, width: coords.width, height: coords.height, color, opacity });
                            } else {
                                const { color: strokeColor, opacity: strokeOpacity } = parseColor(obj.stroke);
                                page.drawRectangle({ x: coords.x, y: coords.y - coords.height, width: coords.width, height: coords.height, borderColor: strokeColor, borderWidth: strokeW, borderOpacity: strokeOpacity });
                            }
                            page.popGraphicsState();
                        } else if (obj.type === 'ellipse') {
                            const { color, opacity } = parseColor(obj.stroke);
                            page.drawEllipse({ x: coords.x + coords.width / 2, y: coords.y - coords.height / 2, xScale: coords.width / 2, yScale: coords.height / 2, borderColor: color, borderWidth: strokeW, opacity });
                        } else if (obj.type === 'i-text') {
                            const { color, opacity } = parseColor(obj.fill);
                            const fontSize = (obj.fontSize || 12) * (obj.scaleY || 1) * scale;
                            page.drawText(obj.text, { x: coords.x, y: coords.y - fontSize, font: embeddedFont, size: fontSize, color, opacity });
                        }
                    } catch (err) { console.error("Could not draw object:", obj, "Error:", err); }
                }
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${currentPdfName}-final.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error during export:', error);
            alert('د دەما هناردەکرنێ دا خەلەتیەکا نەچاوەرێکری چێبوو: ' + error.message);
        } finally {
            showLoader(false);
        }
    };

    // --- Drawing Handlers ---
    const handleMouseDown = (options) => {
        if (!activeCanvas || activeCanvas.isDrawingMode || currentTool === 'select' || currentTool === 'image' || options.target) return;
        isDrawingShape = true;
        startPoint = activeCanvas.getPointer(options.e);
        const width = parseInt(strokeWidth.value, 10);
        const color = colorPicker.value;
        const commonProps = { left: startPoint.x, top: startPoint.y, stroke: color, originX: 'left', originY: 'top' };
        switch(currentTool) {
            case 'line': shape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], { ...commonProps, strokeWidth: width }); break;
            case 'underline': shape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], { ...commonProps, strokeWidth: width }); break;
            case 'text-highlighter': shape = new fabric.Rect({ ...commonProps, width: 0, height: width, fill: hexToRgba(color, 0.5), stroke: null, globalCompositeOperation: 'multiply' }); break;
            case 'rect': shape = new fabric.Rect({ ...commonProps, width: 0, height: 0, fill: 'transparent', strokeWidth: width }); break;
            case 'oval': shape = new fabric.Ellipse({ ...commonProps, rx: 0, ry: 0, fill: 'transparent', strokeWidth: width }); break;
            case 'text':
                const text = new fabric.IText('...بنڤیسە', { left: startPoint.x, top: startPoint.y, fill: color, stroke: null, fontSize: width * 2.5, fontFamily: customFontName });
                activeCanvas.add(text).setActiveObject(text).renderAll();
                isDrawingShape = false; setActiveTool('select'); break;
        }
        if (shape) activeCanvas.add(shape);
    };

    const handleMouseMove = (options) => {
        if (!isDrawingShape || !shape || !activeCanvas) return;
        const pointer = activeCanvas.getPointer(options.e);
        if (currentTool === 'underline') { shape.set({ x2: pointer.x, y2: startPoint.y }); } 
        else if (shape.type.includes('line')) { shape.set({ x2: pointer.x, y2: pointer.y }); } 
        else if (currentTool === 'text-highlighter') { shape.set({ width: pointer.x - startPoint.x }); } 
        else if (shape.type === 'rect' || shape.type === 'ellipse') {
            const width = Math.abs(pointer.x - startPoint.x);
            const height = Math.abs(pointer.y - startPoint.y);
            shape.set({ left: pointer.x < startPoint.x ? pointer.x : startPoint.x, top: pointer.y < startPoint.y ? pointer.y : startPoint.y, width, height });
            if (shape.type === 'ellipse') shape.set({ rx: width / 2, ry: height / 2 });
        }
        activeCanvas.renderAll();
    };
    
    const handleMouseUp = () => { if (isDrawingShape && shape) shape.setCoords(); isDrawingShape = false; shape = null; };
    const hexToRgba = (hex, opacity) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r},${g},${b},${opacity})`; };

    // --- Event Listeners ---
    pdfUpload.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => loadPdf(ev.target.result, file.name); reader.readAsArrayBuffer(file); e.target.value = null; });
    projectUpload.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; loadProject(file); e.target.value = null; });
    loadProjectBtn.addEventListener('click', () => projectUpload.click());
    saveProjectBtn.addEventListener('click', saveProject);
    exportPdfBtn.addEventListener('click', exportFinalPdf);
    addBlankPageBtn.addEventListener('click', addBlankPage);
    importPagesBtn.addEventListener('click', () => importPdfUpload.click());
    importPdfUpload.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { importPages(file); } e.target.value = null; });
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !activeCanvas) return;
        const reader = new FileReader();
        reader.onload = (event) => { fabric.Image.fromURL(event.target.result, (img) => { img.scaleToWidth(200); activeCanvas.add(img); setActiveTool('select'); }); };
        reader.readAsDataURL(file); e.target.value = null;
    });

    deleteBtn.addEventListener('click', () => { if (activeCanvas) { activeCanvas.getActiveObjects().forEach(obj => activeCanvas.remove(obj)); activeCanvas.discardActiveObject().renderAll(); } });
    toolBtns.forEach(btn => btn.addEventListener('click', () => setActiveTool(btn.dataset.tool)));
    strokeWidth.addEventListener('input', (e) => { const newWidth = parseInt(e.target.value, 10); strokeValue.textContent = newWidth; if (activeCanvas && activeCanvas.isDrawingMode) { activeCanvas.freeDrawingBrush.width = newWidth; }});
    colorPicker.addEventListener('input', () => {
        const newColor = colorPicker.value;
        if (activeCanvas && activeCanvas.isDrawingMode) { activeCanvas.freeDrawingBrush.color = newColor; }
        if (activeCanvas) { 
            const activeObjects = activeCanvas.getActiveObjects(); 
            if (activeObjects.length > 0) { 
                activeObjects.forEach(obj => {
                    if (obj.globalCompositeOperation === 'multiply') { obj.set('fill', hexToRgba(newColor, 0.5)); } 
                    else if (obj.type === 'i-text') { obj.set('fill', newColor); }
                    else { obj.set('stroke', newColor); }
                }); 
                activeCanvas.renderAll(); 
            } 
        }
    });

    window.addEventListener('resize', debounce(() => {
        if (!pdfDoc || !originalPdfBytes) return;
        const currentState = captureFullState();
        loadPdf(originalPdfBytes, `${currentPdfName}.pdf`, currentState);
    }, 250));

    undoBtn.addEventListener('click', () => { if (activeCanvas) { const pageNum = parseInt(activeCanvas.wrapperEl.dataset.pageNum, 10); undo(pageNum); } });
    redoBtn.addEventListener('click', () => { if (activeCanvas) { const pageNum = parseInt(activeCanvas.wrapperEl.dataset.pageNum, 10); redo(pageNum); } });
    
    fontUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showLoader(true, '...فۆنت تێتە بارکرن');
        try {
            customFontBytes = await file.arrayBuffer();
            if (typeof fontkit !== 'undefined' && customFontBytes) {
                const fk = fontkit.create(new Uint8Array(customFontBytes));
                customFontName = fk.postscriptName || 'Custom Font';
            } else { customFontName = 'Custom Font'; }
            alert(`فۆنت "${file.name}" ب سەرکەفتی هاتە بارکرن.`);
        } catch (error) { console.error("Error loading user font:", error); alert("کێشە د بارکرنا فۆنتی دا چێبوو."); } 
        finally { showLoader(false); e.target.value = null; }
    });

    goToPageBtn.addEventListener('click', () => goToPage(pageNumberInput.value));
    pageNumberInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { goToPage(pageNumberInput.value); e.preventDefault(); } });
    
    pdfContainer.addEventListener('mousedown', (e) => {
        const canvasWrapper = e.target.closest('.canvas-wrapper');
        hideContextMenu();
        if (canvasWrapper) {
            const pageNum = parseInt(canvasWrapper.dataset.pageNum, 10);
            activeCanvas = pdfPages[pageNum - 1]?.canvas;
            updateUndoRedoButtons(pageNum);
            document.querySelectorAll('.canvas-wrapper.active-page').forEach(p => p.classList.remove('active-page'));
            canvasWrapper.classList.add('active-page');
            document.querySelectorAll('.thumbnail-item.active-thumbnail').forEach(t => t.classList.remove('active-thumbnail'));
            document.querySelector(`.thumbnail-item[data-page-num="${canvasWrapper.dataset.pageNum}"]`)?.classList.add('active-thumbnail');
        }
    });
    
    pdfContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const canvasWrapper = e.target.closest('.canvas-wrapper');
        if (canvasWrapper) { showContextMenu(e.pageX, e.pageY, canvasWrapper); }
    });

    document.addEventListener('click', (e) => { if (!contextMenu.contains(e.target)) { hideContextMenu(); } });

    contextMenu.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            const tool = btn.dataset.tool;
            if (!activeCanvas) return;
            const pointer = activeCanvas.getPointer(e, true);
            setActiveTool(tool);
            if (tool === 'text') {
                const text = new fabric.IText('...بنڤیسە', { left: pointer.x, top: pointer.y, fill: colorPicker.value, stroke: null, fontSize: parseInt(strokeWidth.value, 10) * 2.5, fontFamily: customFontName });
                activeCanvas.add(text).setActiveObject(text).renderAll();
                setActiveTool('select');
            } else if (tool === 'image') {
                imageUpload.click();
            }
        });
    });
});