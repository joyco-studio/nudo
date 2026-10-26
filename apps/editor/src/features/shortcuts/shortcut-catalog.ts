/** One way to press a shortcut: the keys held together, in order. */
export type KeyChord = readonly string[]

export interface ShortcutEntry {
  readonly action: string
  /** Alternative chords for the same action. */
  readonly chords: readonly KeyChord[]
}

export interface ShortcutSection {
  readonly title: string
  readonly entries: readonly ShortcutEntry[]
}

const MOD = 'Ctrl/⌘'

/** Every keyboard shortcut in the editor, shown in the shortcuts dialog. */
export const SHORTCUT_SECTIONS: readonly ShortcutSection[] = [
  {
    title: 'Anywhere',
    entries: [
      { action: 'Undo', chords: [[MOD, 'Z']] },
      {
        action: 'Redo',
        chords: [
          [MOD, 'Shift', 'Z'],
          ['Ctrl', 'Y'],
        ],
      },
      { action: 'Copy selected nodes', chords: [[MOD, 'C']] },
      { action: 'Paste nodes', chords: [[MOD, 'V']] },
      { action: 'Select all nodes', chords: [[MOD, 'A']] },
      { action: 'Fit all nodes in view', chords: [['F']] },
      { action: 'Show these shortcuts', chords: [['?']] },
    ],
  },
  {
    title: 'Canvas',
    entries: [
      { action: 'Add a node', chords: [['Space']] },
      { action: 'Pan the view 40 px', chords: [['Arrow keys']] },
      { action: 'Pan the view 160 px', chords: [['Shift', 'Arrow keys']] },
      { action: 'Delete the selected nodes and connections', chords: [['Delete']] },
    ],
  },
  {
    title: 'Node',
    entries: [
      { action: 'Move the node 10 px', chords: [['Arrow keys']] },
      { action: 'Move the node 50 px', chords: [['Shift', 'Arrow keys']] },
      { action: 'Delete the node', chords: [['Delete'], ['Backspace']] },
      { action: 'Edit its first field', chords: [['Enter']] },
      { action: 'Leave a field and return to the node', chords: [['Esc']] },
      { action: 'Next or previous port and field', chords: [['Tab'], ['Shift', 'Tab']] },
    ],
  },
  {
    title: 'Port',
    entries: [
      { action: 'Connect to another port', chords: [['Enter']] },
      { action: 'Remove its connections', chords: [['Delete']] },
    ],
  },
]
