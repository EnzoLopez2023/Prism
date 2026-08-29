export const MODEL_LAB_SAMPLE_PROMPTS = [
  'Write a haiku about debugging code at 2 AM',
  'Explain how DNS works in one sentence',
  'What is 17 × 43? Show your reasoning briefly',
  'List 3 surprisingly practical uses for a rubber duck',
  'Translate "Hello, World!" to pirate speak',
  'What is the difference between a mutex and a semaphore?',
  'Write a one-paragraph pitch for a sentient toaster startup',
  'Write a function in [Language] that determines if a given string is a palindrome. It must ignore spaces, punctuation, and capitalization. Include two edge-case tests and output a time complexity of O(n).',
] as const

export const MODEL_LAB_MODELS = [
  { id: 'codex', label: 'GPT-5.3-Codex', provider: 'Azure AI Foundry' },
  { id: 'gpt54', label: 'GPT-5.4', provider: 'Azure AI Foundry' },
  { id: 'haiku', label: 'Claude Haiku', provider: 'Anthropic' },
  { id: 'gpt54pro', label: 'GPT-5.4-Pro', provider: 'Azure AI Foundry' },
  { id: 'sonnet', label: 'Claude Sonnet', provider: 'Anthropic' },
  { id: 'lmstudio', label: 'Gemma 4 (local)', provider: 'LM Studio @ Mac' },
] as const
