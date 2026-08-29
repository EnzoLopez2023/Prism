export type ImageOrientation = 'portrait' | 'square' | 'landscape'

export interface ImageOutputPreset {
  id: string
  label: string
  width: number | null
  height: number | null
  orientation: ImageOrientation | null
}

export const IMAGE_LAB_SAMPLE_PROMPTS = [
  'A cozy reading nook with a sleeping cat, warm afternoon light, watercolor',
  'A futuristic city skyline at sunset, synthwave, glowing neon',
  'A photorealistic bowl of ramen with steam rising, top-down',
  'A minimalist flat-vector logo for a coffee shop called "Hearth"',
  'An astronaut riding a horse on Mars, cinematic lighting',
  "A children's book illustration of a friendly robot gardener",
  'Cinematic cyberpunk portrait of a man walking through a neon-lit futuristic city, nighttime scene, heavy rain, soaked trench coat, neon reflections on wet street, dramatic side profile, serious expression, vibrant pink and blue ambient lighting from neon signs, busy urban street with motion blur of rushing crowd, shallow depth of field, shot on 35mm film at f/1.4, rim lighting on edges, neon cyan, magenta, purple and electric blue with hints of deep red, analog film grain, slight chromatic aberration, moody noir Blade Runner aesthetic',
  'A cinematic double exposure of a man in profile, with a post-apocalyptic cityscape inside his silhouette. The inner scene shows the man walking through a destroyed, burning urban street, buildings in ruins, glowing embers and fire, with a dramatic sunset in the background. Moody lighting, warm tones, emotional and introspective mood, high detail, 8K resolution',
  'A dramatic overhead cinematic shot of a stylish individual seated alone on a vintage armchair in the center of a large, moody room with wooden flooring and warm ambient lighting. The subject is wearing a dark, textured outfit — a charcoal knit sweater, black tailored pants, and minimalist boots. The lighting creates soft shadows around the chair, drawing full attention to the subject from above. Scattered around are subtle elements: a closed book, a warm floor lamp casting a golden glow, and soft window light from the corner. The background is slightly desaturated with a shallow depth-of-field to enhance the focus on the person, creating a movie scene aesthetic. The tone is cinematic, quiet, and powerful',
  'Turn this into a pencil sketch',
] as const

export const IMAGE_LAB_MODELS = [
  { id: 'gpt-image-1', label: 'GPT-Image-1', provider: 'Azure AI Foundry', supportsEditing: true },
  { id: 'gpt-image-2', label: 'GPT-Image-2', provider: 'Azure AI Foundry', supportsEditing: true },
  { id: 'mai-image-2e', label: 'MAI-Image-2e', provider: 'Azure AI Foundry · Microsoft', supportsEditing: false },
] as const

export const IMAGE_OUTPUT_PRESETS: readonly ImageOutputPreset[] = [
  { id: 'native', label: 'Model native (no resize)', width: null, height: null, orientation: null },
  { id: 'iphone-17-pro-max', label: 'iPhone 17 Pro Max', width: 1320, height: 2868, orientation: 'portrait' },
  { id: 'iphone-modern', label: 'iPhone (modern)', width: 1290, height: 2796, orientation: 'portrait' },
  { id: 'phone-9-16', label: 'Phone 9:16', width: 1080, height: 1920, orientation: 'portrait' },
  { id: 'macbook-pro-16', label: 'MacBook Pro 16"', width: 3456, height: 2234, orientation: 'landscape' },
  { id: 'desktop-4k', label: 'Desktop 4K UHD', width: 3840, height: 2160, orientation: 'landscape' },
  { id: 'desktop-1440p', label: 'Desktop 1440p', width: 2560, height: 1440, orientation: 'landscape' },
  { id: 'desktop-1080p', label: 'Desktop 1080p', width: 1920, height: 1080, orientation: 'landscape' },
  { id: 'square-2048', label: 'Square', width: 2048, height: 2048, orientation: 'square' },
  { id: 'instagram-post', label: 'Instagram post', width: 1080, height: 1080, orientation: 'square' },
  { id: 'instagram-story', label: 'Instagram story', width: 1080, height: 1920, orientation: 'portrait' },
]

const ORIENTATION_DETAILS: Record<ImageOrientation, { words: string; ratio: string; size: string }> = {
  portrait: { words: 'vertical portrait', ratio: '2:3', size: '1024x1536' },
  square: { words: 'square', ratio: '1:1', size: '1024x1024' },
  landscape: { words: 'horizontal landscape', ratio: '3:2', size: '1536x1024' },
}

export function imageOutputPreset(id: string): ImageOutputPreset {
  return IMAGE_OUTPUT_PRESETS.find(preset => preset.id === id) || IMAGE_OUTPUT_PRESETS[0]!
}

export function nativeImageSize(orientation: ImageOrientation): string {
  return ORIENTATION_DETAILS[orientation].size
}

export function buildImagePrompt(prompt: string, orientation: ImageOrientation, presetId: string): string {
  const base = prompt.trim()
  const details = ORIENTATION_DETAILS[orientation]
  const preset = imageOutputPreset(presetId)
  if (preset.id === 'native') return `${base}\n\n(${details.words} ${details.ratio} composition.)`
  return `${base}\n\n(Compose as a ${details.words} ${preset.label} wallpaper, ${preset.width}×${preset.height} pixels.)`
}

export function imageTargetIds(hasSourceImage: boolean): string[] {
  return IMAGE_LAB_MODELS.filter(model => !hasSourceImage || model.supportsEditing).map(model => model.id)
}
