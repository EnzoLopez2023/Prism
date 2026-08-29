import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  IMAGE_LAB_MODELS, IMAGE_LAB_SAMPLE_PROMPTS, IMAGE_OUTPUT_PRESETS, buildImagePrompt, imageOutputPreset, imageTargetIds,
  nativeImageSize,
} from '../src/features/image-lab/imageLabConfig.js'
import { MODEL_LAB_MODELS, MODEL_LAB_SAMPLE_PROMPTS } from '../src/features/model-lab/modelLabConfig.js'

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

test('frozen Hearth lab samples and provider order stay exact', () => {
  assert.equal(MODEL_LAB_SAMPLE_PROMPTS.length, 8)
  assert.equal(IMAGE_LAB_SAMPLE_PROMPTS.length, 10)
  assert.equal(hash(MODEL_LAB_SAMPLE_PROMPTS), 'c46458997223bb9bd52d360fa2daad466c322107cad53a38ab0c8fd12165030e')
  assert.equal(hash(MODEL_LAB_MODELS), '5722f2486113346d5cb5c418ad28f566f72976986a24fb830fe890ec5a3c5fde')
  assert.equal(hash(IMAGE_LAB_SAMPLE_PROMPTS), 'b8b11b10665ddd67f1b8751d84012632cfecb110324328c0e02ab312326cb551')
  assert.equal(hash(IMAGE_LAB_MODELS), 'acc78c65a0cff69e1ef5912486c2043c046db287c7a4e98311c400fc0a3aef56')
  assert.deepEqual(MODEL_LAB_MODELS.map(model => model.id), ['codex', 'gpt54', 'haiku', 'gpt54pro', 'sonnet', 'lmstudio'])
  assert.deepEqual(IMAGE_LAB_MODELS.map(model => model.id), ['gpt-image-1', 'gpt-image-2', 'mai-image-2e'])
})

test('image target presets preserve Hearth orientation and download contracts', () => {
  assert.equal(IMAGE_OUTPUT_PRESETS.length, 11)
  assert.equal(hash(IMAGE_OUTPUT_PRESETS), '35d6639f2d6cd015281c4b2d04f40ef009eae4481b64ca4cde255ecbc7b4d7b7')
  assert.equal(nativeImageSize('portrait'), '1024x1536')
  assert.equal(nativeImageSize('square'), '1024x1024')
  assert.equal(nativeImageSize('landscape'), '1536x1024')
  assert.equal(buildImagePrompt('Draw a room', 'portrait', 'native'), 'Draw a room\n\n(vertical portrait 2:3 composition.)')
  assert.equal(
    buildImagePrompt('Draw a room', 'landscape', 'desktop-4k'),
    'Draw a room\n\n(Compose as a horizontal landscape Desktop 4K UHD wallpaper, 3840×2160 pixels.)',
  )
  assert.deepEqual(imageOutputPreset('instagram-story'), {
    id: 'instagram-story', label: 'Instagram story', width: 1080, height: 1920, orientation: 'portrait',
  })
  assert.deepEqual(imageTargetIds(false), ['gpt-image-1', 'gpt-image-2', 'mai-image-2e'])
  assert.deepEqual(imageTargetIds(true), ['gpt-image-1', 'gpt-image-2'])
})
