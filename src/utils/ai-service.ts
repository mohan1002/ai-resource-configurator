import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAIValidation(data: any[], type: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a data validation expert. Analyze the provided data and return validation results in JSON format."
        },
        {
          role: "user",
          content: `Validate this ${type} data: ${JSON.stringify(data)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('AI Validation error:', error);
    return null;
  }
}

export async function processNaturalLanguageQuery(query: string, data: any[]) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a data query expert. Convert natural language queries into filtered results."
        },
        {
          role: "user",
          content: `Query: "${query}" on data: ${JSON.stringify(data)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Natural language processing error:', error);
    return null;
  }
}

export async function createAIRule(ruleDescription: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Convert natural language rule descriptions into JSON validation rules."
        },
        {
          role: "user",
          content: ruleDescription
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Rule creation error:', error);
    return null;
  }
}