export interface StoredArtifact {
  objectKey: string
  sha256: string
  bytes: number
  contentType: string
  created: boolean
}

export interface ArtifactStore {
  put(input: { objectKey: string; bytes: Buffer; contentType: string; replaceMismatched?: boolean }): Promise<StoredArtifact>
  get(objectKey: string, contentType: string): Promise<{ bytes: Buffer; contentType: string }>
  delete(objectKey: string): Promise<void>
}
