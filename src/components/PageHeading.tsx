import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export function PageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <Box className="page-heading">
      <Box><Typography component="h1" variant="h1">{title}</Typography><Typography color="text.secondary">{description}</Typography></Box>
      {actions && <Box className="page-actions">{actions}</Box>}
    </Box>
  )
}
