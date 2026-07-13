import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  ocrModel: process.env.OCR_MODEL || 'claude-sonnet-4-20250514',
  ocrMaxTokens: parseInt(process.env.OCR_MAX_TOKENS || '4096', 10),
}));
