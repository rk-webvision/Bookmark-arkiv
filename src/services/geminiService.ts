import { GoogleGenAI, Type } from "@google/genai";
import type { Bookmark } from "../types";

const getApiKey = () => {
  // Try Vite's built-in env first (prefixed with VITE_)
  const metaEnv = (import.meta as any).env;
  if (metaEnv?.VITE_GEMINI_API_KEY) {
    return metaEnv.VITE_GEMINI_API_KEY;
  }
  
  // Fallback to process.env (injected during AI Studio build)
  if (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  return null;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function extractBookmarkInfo(url: string, title?: string, description?: string) {
  if (!ai) {
    throw new Error("AI features are not configured. Please check your API key.");
  }
  
  const prompt = `Analyze this bookmark and provide a structured JSON object with refined title, detailed description, category, and smart tags.
  URL: ${url}
  Title: ${title || 'Unknown'}
  Description: ${description || 'No description provided'}
  
  Focus on identifying high-value tags that would help in semantic search.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          tags: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          summary: { type: Type.STRING, description: "A one-sentence punchy summary of why this is worth reading." }
        },
        required: ["title", "description", "category", "tags", "summary"]
      }
    }
  });

  if (!response.text) return null;
  return JSON.parse(response.text);
}

export async function semanticSearch(query: string, bookmarks: Bookmark[]) {
  if (!ai) return bookmarks; // Return all if AI not configured
  
  const bookmarksBatch = bookmarks.map(b => ({
    id: b.id,
    title: b.title,
    description: b.description,
    tags: b.tags,
    category: b.category
  }));

  const prompt = `Given the search query "${query}", filter and rank the following bookmarks from most relevant to least relevant. Return only the IDs of relevant bookmarks as a JSON array.
  
  Bookmarks:
  ${JSON.stringify(bookmarksBatch)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  if (!response.text) return [];
  const relevantIds = JSON.parse(response.text);
  return bookmarks.filter(b => relevantIds.includes(b.id));
}
