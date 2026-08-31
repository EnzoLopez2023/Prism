export const buildIdentity = Object.freeze({
  app: 'prism',
  version: process.env.PRISM_BUILD_VERSION || '1.0.0-local',
  build: process.env.PRISM_BUILD_NUMBER || 'local',
  schema: 'prism.sqlite.v2',
  commit: process.env.PRISM_BUILD_COMMIT || 'unknown',
  buildTime: process.env.PRISM_BUILD_TIME || new Date().toISOString(),
  imageDigest: process.env.PRISM_IMAGE_DIGEST || 'none',
  source: {
    app: 'hearth',
    version: '2.13.2',
    build: 172,
    commit: 'f0b05fc1dbf53e8aa26c215d8e858894a2793871',
    tree: '62cbd35861c511f7c17187c875d19ee6e353b80d',
    imageDigest: 'sha256:dc4df7e0f966be5b0608e71643d316cc5eba7590b8e56cec482583ab69443140',
  },
})
