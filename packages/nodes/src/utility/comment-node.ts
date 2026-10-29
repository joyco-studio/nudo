import { defineNode } from '@nudo-tsl/core'

const DEFAULT_TITLE = 'Comment'
const DEFAULT_WIDTH = 320
const MIN_WIDTH = 120
const DEFAULT_HEIGHT = 200
const MIN_HEIGHT = 80

export const commentNode = defineNode({
  type: 'utility/comment',
  category: 'utility',
  label: 'Comment',
  description: 'A resizable note on the canvas. It does not affect the shader.',
  keywords: ['comment', 'note', 'annotation', 'label', 'group'],
  inputs: [],
  outputs: [],
  params: [
    // Edited in the frame header (ruling P2-R8): editor state that never recompiles.
    {
      id: 'title',
      label: 'Title',
      kind: 'string',
      default: DEFAULT_TITLE,
      hidden: true,
      editorOnly: true,
    },
    {
      id: 'width',
      label: 'Width',
      kind: 'number',
      default: DEFAULT_WIDTH,
      min: MIN_WIDTH,
      hidden: true,
      editorOnly: true,
    },
    {
      id: 'height',
      label: 'Height',
      kind: 'number',
      default: DEFAULT_HEIGHT,
      min: MIN_HEIGHT,
      hidden: true,
      editorOnly: true,
    },
    // The note written in the frame body: editor state too, so it never recompiles either.
    { id: 'body', label: 'Text', kind: 'string', default: '', hidden: true, editorOnly: true },
  ],
  build: () => ({}),
})
