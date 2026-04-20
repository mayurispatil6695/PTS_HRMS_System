import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export interface TaskSuggestion {
  priority: 'low' | 'medium' | 'high';
  dueDateOffsetDays: number;   // ✅ property name matches your usage
  suggestedSubtasks: string[];
}

export const getTaskSuggestions = async (
  title: string,
  description: string
): Promise<TaskSuggestion> => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = `
    You are a project management assistant. Analyze the following task and return ONLY valid JSON (no extra text, no markdown).
    
    Task Title: ${title}
    Task Description: ${description}
    
    Return a JSON object with these exact fields:
    - priority: one of "low", "medium", "high"
    - dueDateOffsetDays: number (1-10, how many days from today this should be due)
    - suggestedSubtasks: array of 2-3 strings (short, actionable subtasks)
    
    Example:
    {
      "priority": "high",
      "dueDateOffsetDays": 3,
      "suggestedSubtasks": ["Design database schema", "Implement API endpoint", "Write tests"]
    }
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  
  const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  return JSON.parse(cleanJson) as TaskSuggestion;
};