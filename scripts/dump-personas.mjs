import { PERSONAS } from '../lib/prompts/personas/index.ts';
import { BASE_PROMPT, OUTPUT_HINT } from '../lib/prompts/base.ts';
import { writeFileSync } from 'node:fs';
writeFileSync('data/personas.json', JSON.stringify(PERSONAS, null, 2));
writeFileSync('data/prompts.json', JSON.stringify({ basePrompt: BASE_PROMPT, outputHint: OUTPUT_HINT }, null, 2));
console.log('OK');
