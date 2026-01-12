import { GoogleGenAI, Type } from "@google/genai";

// Helper to initialize AI client lazily. 
// This prevents the app from crashing on load if the API Key is missing in the browser environment.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_PROMPT_CORE = `
تۆ مامۆستایەکی شارەزا و داهێنەری د دانانا ئەسیلەیان دا.
ئەرکێ تە: دروستکردنا پسیارێن ئەزموونێ یە ب شێوازەکێ ئەکادیمی و "سەروبەر".

یاسایێن گرنگ بۆ رێکخستنێ:
1. **داهێنان (Originality):** هەرگیز دەقێ کتێبێ وەک خۆ کۆپی نەکە. مژاران وەربگرە و پسیارێن نوو دروست بکە.
2. **شێوازێ نڤیسینێ:** پسیاران ب زمانەکێ کوردی (بادینی) یێ فەرمی و زانستی بنڤیسە.
3. **بیرکاری و LaTeX (زۆر گرنگ):** 
   - بۆ هاوکێشەیێن ئاسایی (Inline) نیشانەی $...$ بکاربینە. نموونە: $x + y = 10$.
   - بۆ هاوکێشەیێن ئاڵۆز وەک کەرت (Fractions)، ڕەگ، و تەواوکاری، نیشانەی $$...$$ بکاربینە تاوەکو جوان دەربکەون.
   - نموونە بۆ کەرت: $$\\frac{x^2 + 1}{x - 1}$$
   - **JSON Escaping:** لەبەر ئەوەی ئەنجامەکە JSON ە، هەر Backslash ێک دەبێت دووجار بنوسرێت ("\\\\") بۆ ئەوەی لە کۆتاییدا یەک دانە ("\\") دەربچێت.
   - نموونە: "\\\\frac{1}{2}" (راست) | "\\frac{1}{2}" (هەڵە - تێکدەچێت).
   - هەرگیز پیتی کوردی تێکەلی هاوکێشەی LaTeX نەکە.
4. **هەلبژارتن (Choices):** هەلبژارتن پێدڤیە ب ڤی رێزبەندیێ بن:
   أ) [بژاردە]
   ب) [بژاردە]
   ج) [بژاردە]
   د) [بژاردە]
5. **سەروبەر:** پسیاران ب شێوەیەکێ رێک و پێک بنڤیسە، هەر پسیارەک بلا ژ یا دی جودا بیت.
`;

export const generateQuestionsFromImages = async (base64Images: string[], style: string) => {
  const ai = getAI();
  const imageParts = base64Images.map(img => ({ inlineData: { mimeType: "image/jpeg", data: img } }));
  const textPart = { 
    text: `${SYSTEM_PROMPT_CORE}\n\nتەماشای ڤان وێنەیان بکە و پسیارێن نوو و "سەروبەر" ب شێوازێ "${style || 'پسیارێن گشتی'}" دروست بکە.` 
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [...imageParts, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["id", "title", "content"]
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || '{"sections": []}');
};

export const processTextToSections = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SYSTEM_PROMPT_CORE}\n\nئەڤێ نڤیسینێ وەکی مژار بکاربینە و پسیارێن نوو و رێکخستی ژێ دروست بکە (تکایە دڵنیابە لە نوسینی LaTeX بۆ بیرکاری بە شێوەیەکێ دروست): \n\n ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["id", "title", "content"]
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || '{"sections": []}');
};

export const generateExplanatoryImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `High quality academic illustration for examination: ${prompt}` }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });
  for (const part of response.candidates?.[0]?.content.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const chatWithAI = async (question: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: question,
    config: { systemInstruction: "Tu مامۆستایەکی شارەزای، پسیارێن تاقیکردنێ (Original & Professional) دروست دکەی ب زمانی کوردی (بادینی). بۆ بیرکاری LaTeX بکاربینە." }
  });
  return response.text;
};