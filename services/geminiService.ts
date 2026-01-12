import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  let apiKey = "";
  if (typeof process !== "undefined" && process.env && process.env.API_KEY) {
    apiKey = process.env.API_KEY;
  }
  if (!apiKey && typeof window !== "undefined") {
    // @ts-ignore
    apiKey = window.process?.env?.API_KEY;
  }
  if (!apiKey && typeof window !== "undefined") {
    apiKey = localStorage.getItem('gemini_api_key') || "";
  }

  if (!apiKey) {
    throw new Error("API Key نەهاتیە دیتن. تکایە ژ سایدباری Connect بکە.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper function to clean AI response
const cleanAndParseJSON = (text: string) => {
  try {
    // Remove markdown code blocks if present (```json ... ```)
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    console.log("Raw Text:", text);
    return { sections: [] }; // Return empty structure on failure to prevent crash
  }
};

const SYSTEM_PROMPT_CORE = `
تۆ مامۆستایەکی شارەزا و داهێنەری د دانانا ئەسیلەیان دا.
ئەرکێ تە: دروستکردنا پسیارێن ئەزموونێ یە ب شێوازەکێ ئەکادیمی و "سەروبەر".

یاسایێن گرنگ:
1. پسیاران ب زمانەکێ کوردی (بادینی) یێ فەرمی بنڤیسە.
2. بۆ بیرکاری LaTeX ($...$) بکاربینە.
3. JSON Escaping: هەر Backslash ێک دەبێت دووجار بنوسرێت ("\\\\").
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
  
  return cleanAndParseJSON(response.text || '{"sections": []}');
};

export const processTextToSections = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SYSTEM_PROMPT_CORE}\n\nئەڤێ نڤیسینێ وەکی مژار بکاربینە و پسیارێن نوو و رێکخستی ژێ دروست بکە: \n\n ${text}`,
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
  return cleanAndParseJSON(response.text || '{"sections": []}');
};

export const generateExplanatoryImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `High quality academic illustration line art white background: ${prompt}` }] },
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
