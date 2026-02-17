import { VertexAI, GenerativeModel, HarmCategory, HarmBlockThreshold, Content, GenerateContentRequest } from '@google-cloud/vertexai';

// Primary model + fallbacks in priority order
const MODEL_CHAIN = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

// Initialize Vertex with your Cloud project and location
// Note: GOOGLE_APPLICATION_CREDENTIALS should be set in environment for local dev
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

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export const getGeminiModel = (
  modelName: string = 'gemini-1.5-flash',
  options: {
    systemInstruction?: string,
    generationConfig?: any
  } = {}
): GenerativeModel => {
  const model = process.env.GEMINI_MODEL || modelName;
  const vertexAi = getVertexAI();

  return vertexAi.getGenerativeModel({
    model,
    systemInstruction: options.systemInstruction,
    generationConfig: options.generationConfig,
    safetySettings: SAFETY_SETTINGS,
  });
};

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

/**
 * Try generateContentStream with automatic fallback on 429 rate limits.
 * Walks through MODEL_CHAIN starting from the given primary model.
 */
export async function generateContentStreamWithFallback(
  primaryModel: string,
  options: { systemInstruction?: string; generationConfig?: any },
  request: GenerateContentRequest,
): Promise<{ stream: AsyncIterable<any>; model: string }> {
  const vertexAi = getVertexAI();
  const envOverride = process.env.GEMINI_MODEL;

  // Build ordered list: primary first, then remaining fallbacks
  const models = envOverride
    ? [envOverride]
    : [primaryModel, ...MODEL_CHAIN.filter(m => m !== primaryModel)];

  let lastError: unknown;
  for (const modelName of models) {
    try {
      const model = vertexAi.getGenerativeModel({
        model: modelName,
        systemInstruction: options.systemInstruction,
        generationConfig: options.generationConfig,
        safetySettings: SAFETY_SETTINGS,
      });
      const result = await model.generateContentStream(request);
      return { stream: result.stream, model: modelName };
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && models.indexOf(modelName) < models.length - 1) {
        console.warn(`[vertex] ${modelName} rate limited, falling back to next model`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
