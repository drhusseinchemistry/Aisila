import { GoogleGenAI, Type } from "@google/genai";

// Initialize the GoogleGenAI client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_PROMPT_CORE = `
تۆ مامۆستایەکی شارەزا و داهێنەری د دانانا ئەسیلەیان دا.
ئەرکێ تە: دروستکردنا پسیارێن ئەزموونێ یە ب شێوازەکێ ئەکادیمی و "سەروبەر".

یاسایێن گرنگ بۆ رێکخستنێ:
1. **داهێنان (Originality):** هەرگیز دەقێ کتێبێ وەک خۆ کۆپی نەکە. مژاران وەربگرە و پسیارێن نوو دروست بکە.
2. **شێوازێ نڤیسینێ:** پسیاران ب زمانەکێ کوردی (بادینی) یێ فەرمی و زانستی بنڤیسە.
3. **بیرکاری و LaTeX:** بۆ هەر هاوکێشەکا بیرکاری، سیمبول، یان ژمارەیەکا حیسابی، تنێ تاکە دۆلار $...$ بکاربینە. 
   - بۆ نموونە: $f(x) = \log_b x$ یان $x = 25$.
   - **تێبینی زۆر گرنگ:** هەرگیز هێمای دۆلار بۆ کارەکتەرێن ئاسایی بکارنەهێنە. هەرگیز باک-سلاش \\ ل پێش دۆلارێ \\$ دانەنێ چونکی خەلەتی دکەڤیتە نڤیسینێ.
   - هەرگیز دۆلارا دووبارە $$...$$ بکارنەهێنە.
4. **هەلبژارتن (Choices):** هەلبژارتن پێدڤیە ب ڤی رێزبەندیێ بن:
   أ) [بژاردە]
   ب) [بژاردە]
   ج) [بژاردە]
   د) [بژاردە]
5. **سەروبەر:** پسیاران ب شێوەیەکێ رێک و پێک بنڤیسە، هەر پسیارەک بلا ژ یا دی جودا بیت.
`;

export const generateQuestionsFromImages = async (base64Images: string[], style: string) => {
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
  return JSON.parse(response.text || '{"sections": []}');
};

export const generateExplanatoryImage = async (prompt: string) => {
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
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: question,
    config: { systemInstruction: "Tu مامۆستایەکی شارەزای، پسیارێن تاقیکردنێ (Original & Professional) دروست دکەی ب زمانی کوردی (بادینی)." }
  });
  return response.text;
};