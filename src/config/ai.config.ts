import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  ocrModel: process.env.OCR_MODEL || 'gpt-4o',
  ocrMaxTokens: parseInt(process.env.OCR_MAX_TOKENS || '4096', 10),
  ocrScale: parseFloat(process.env.OCR_SCALE || '3.0'),
  ocrMaxPages: parseInt(process.env.OCR_MAX_PAGES || '5', 10),
  ocrTimeout: parseInt(process.env.OCR_TIMEOUT || '60000', 10),
}));
