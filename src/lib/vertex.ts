import { VertexAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

// Initialize Vertex with your Cloud project and location
// Note: GOOGLE_APPLICATION_CREDENTIALS should be set in environment for local dev
// or strictly rely on Vercel's attached integration if available.
// Support GOOGLE_CREDENTIALS_JSON for Coolify/Container environments

let vertexAiInstance: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (vertexAiInstance) return vertexAiInstance;

  let googleAuthOptions;
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      googleAuthOptions = { credentials };
    } catch (e) {
      console.error('Failed to parse GOOGLE_CREDENTIALS_JSON', e);
    }
  }

  vertexAiInstance = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'debateai-prod', 
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    googleAuthOptions,
  });

  return vertexAiInstance;
}

export const getGeminiModel = (
  modelName: string = 'gemini-1.5-flash',
  options: { 
    systemInstruction?: string,
    generationConfig?: any 
  } = {}
): GenerativeModel => {
  // Allow override from env for testing different models
  const model = process.env.GEMINI_MODEL || modelName;
  
  const vertexAi = getVertexAI();

  return vertexAi.getGenerativeModel({
    model: model,
    systemInstruction: options.systemInstruction,
    generationConfig: options.generationConfig,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ],
  });
};
