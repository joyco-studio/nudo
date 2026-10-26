import '@fontsource-variable/public-sans'
import '@fontsource-variable/roboto-mono'
import './app/globals.css'
import './app/focus-ring.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/app'
import { bootstrapEditor } from './app/bootstrap-editor'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Missing #root element in index.html.')
}

// Restore the last session before the first render, so the canvas fits the restored graph.
bootstrapEditor(window.localStorage, window)

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
