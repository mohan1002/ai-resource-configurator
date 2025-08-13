import OpenAI from 'openai';

// Create OpenAI client with environment check
const createOpenAIClient = () => {
  if (typeof window === 'undefined') {
    // Server-side initialization
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  // Client-side initialization
  return new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });
};

const openai = createOpenAIClient();

export const aiService = {
  async validate(data: any, type: string) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a data validation expert."
          },
          {
            role: "user",
            content: `Validate this ${type} data: ${JSON.stringify(data)}`
          }
        ]
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('AI Validation error:', error);
      throw error;
    }
  },

  async search(query: string, data: any[]) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a data search expert."
          },
          {
            role: "user",
            content: `Search: "${query}" in: ${JSON.stringify(data)}`
          }
        ]
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
};