import { GoogleGenAI } from "@google/genai";
import { CpuState, InstructionStep } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize client only if key exists (handled in component)
const getClient = () => new GoogleGenAI({ apiKey });

export const explainStep = async (
  instruction: InstructionStep,
  cpuState: CpuState
): Promise<string> => {
  if (!apiKey) return "API Key eksik. Lütfen .env dosyasını kontrol edin.";

  const ai = getClient();
  
  const prompt = `
    Sen uzman bir Bilgisayar Mühendisliği profesörüsün. Öğrencilere 8085 mikroişlemcisini öğretiyorsun.
    
    Şu anki komut: ${instruction.code}
    Açıklama: ${instruction.description}
    
    Şu anki CPU Durumu:
    A=${cpuState.registers.A.toString(16).toUpperCase()}
    B=${cpuState.registers.B.toString(16).toUpperCase()}
    C=${cpuState.registers.C.toString(16).toUpperCase()}
    SP=${cpuState.registers.SP.toString(16).toUpperCase()}
    Flags: Z=${cpuState.flags.Z}, CY=${cpuState.flags.CY}
    
    Bu adımın ne yaptığını, özellikle stack veya register değişimlerini vurgulayarak Türkçe ve çok kısa (maksimum 2 cümle) açıkla.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Yapay zeka açıklaması şu an kullanılamıyor.";
  }
};

export const getGeneralHelp = async (query: string): Promise<string> => {
    if (!apiKey) return "API Key eksik.";
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `8085 mikroişlemcisi hakkında şu soruya Türkçe, kısa ve teknik bir cevap ver: ${query}`
    });
    return response.text;
}
