import { Box, Chip, Typography } from '@mui/material'

function compactLabel(prompt: string, length: number) {
  return prompt.length > length ? `${prompt.slice(0, length)}…` : prompt
}

export function SamplePromptPicker({
  prompts,
  labelLength,
  onSelect,
}: {
  prompts: readonly string[]
  labelLength: number
  onSelect: (prompt: string) => void
}) {
  return (
    <Box className="sample-prompt-picker">
      <Typography variant="body2" color="text.secondary" fontWeight={700}>Try a sample</Typography>
      <Box className="sample-prompt-list" aria-label="Sample prompts">
        {prompts.map(prompt => (
          <Chip
            key={prompt}
            clickable
            label={compactLabel(prompt, labelLength)}
            title={prompt}
            onClick={() => onSelect(prompt)}
          />
        ))}
      </Box>
    </Box>
  )
}
