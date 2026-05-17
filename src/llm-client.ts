import type { LLMRequest, LLMResponse, ParsedLLMResult } from './types';

const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const TIMEOUT_MS = 30000;
const API_KEY = 'sk-2e52991bb880420ea0aef337e1d52f1b';

const SYSTEM_PROMPT = `You are an expert in interpretation and translation. For the provided English speech, perform TWO tasks in sequence, separated by a marker like '---TRANSLATION---'.

Translation: Provide an accurate, natural Chinese translation.

Interpretation Notes: Please generate concise interpretation notes based only on the original English text. Follow these five principles:

  Concise and symbolic: Use one symbol to represent multiple words with similar meanings. Simplify Chinese characters to their most basic strokes, or use associative symbols wherever possible.

  Clear and unambiguous: Do not use the same symbol to represent different meanings within the same note.

  Flexible language use: Mix Chinese and English freely as long as it helps fluency and accuracy of interpretation.

  Common abbreviations and symbols: Include standard shortcuts for place names, currencies, time, weights/measures, company names, and frequent English abbreviations (e.g., max = maximum, min = minimum, ref = reference).

  Logical relationship markers: Use arrows (→, ←, ↑, ↓), superscript/subscript symbols, cause-and-effect symbols (e.g., ∴, ∵), etc., to indicate information hierarchy and logical connections, thereby aiding contextual understanding.

Output format:
---TRANSLATION---
[Place your Chinese translation here]
---NOTES---
[Place your interpretation notes here]`;

export async function generateNotes(
  englishText: string
): Promise<ParsedLLMResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const request: LLMRequest = {
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: englishText,
        },
      ],
      temperature: 0.7,
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API请求失败 (${response.status}): ${errorData.error?.message || response.statusText}`
      );
    }

    const data: LLMResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('API响应格式错误：未找到choices字段');
    }

    const content = data.choices[0].message.content;
    return parseLLMResponse(content);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接');
      }
      throw error;
    }

    throw new Error('调用LLM失败：未知错误');
  }
}

function parseLLMResponse(content: string): ParsedLLMResult {
  const translationMatch = content.match(
    /---TRANSLATION---\s*([\s\S]*?)\s*---NOTES---/i
  );
  const notesMatch = content.match(
    /---NOTES---\s*([\s\S]*?)$/i
  );

  if (!translationMatch || !notesMatch) {
    throw new Error('LLM响应格式不符合预期');
  }

  return {
    translation: translationMatch[1].trim(),
    notes: notesMatch[1].trim(),
  };
}
