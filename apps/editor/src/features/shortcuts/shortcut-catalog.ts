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

/** How the catalog, menus and tooltips write Ctrl on Windows and Linux, ⌘ on a Mac. */
export const MOD = 'Ctrl/⌘'

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
      { action: 'Start a new graph', chords: [[MOD, 'Alt', 'N']] },
      { action: 'Show these shortcuts', chords: [['?']] },
    ],
  },
  {
    title: 'Panels (canvas, node or panel header)',
    entries: [
      { action: 'Show or hide the Properties panel', chords: [['B']] },
      { action: 'Show or hide the Inspector', chords: [['I']] },
      { action: 'Show or hide the Preview', chords: [['P']] },
      { action: 'Show or hide the Code panel', chords: [['C']] },
      { action: 'Next preview layout: docked, split, full', chords: [['Shift', 'P']] },
    ],
  },
  {
    title: 'Preview layout',
    entries: [
      { action: 'Leave the full preview', chords: [['Esc']] },
      { action: 'Move the split handle 5%', chords: [['Arrow keys']] },
      { action: 'Smallest or largest canvas in split', chords: [['Home'], ['End']] },
    ],
  },
  {
    title: 'Canvas',
    entries: [
      { action: 'Add a node', chords: [['Space']] },
      { action: 'Pan the view 40 px', chords: [['Arrow keys']] },
      { action: 'Pan the view 160 px', chords: [['Shift', 'Arrow keys']] },
      { action: 'Delete the selected nodes and connections', chords: [['Delete']] },
      { action: 'Open the canvas menu', chords: [['Shift', 'F10'], ['Menu']] },
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
      {
        action: 'Open its menu: copy, duplicate, preview mode, delete',
        chords: [['Shift', 'F10'], ['Menu']],
      },
    ],
  },
  {
    title: 'Comment',
    entries: [
      { action: 'Edit its title', chords: [['Enter']] },
      { action: 'Resize the frame 20 px', chords: [['Alt', 'Arrow keys']] },
    ],
  },
  {
    title: 'Port',
    entries: [
      { action: 'Connect to another port', chords: [['Enter']] },
      { action: 'Remove its connections', chords: [['Delete']] },
    ],
  },
  {
    title: 'Connection',
    entries: [
      { action: 'Delete the connection', chords: [['Delete']] },
      { action: 'Open its menu', chords: [['Shift', 'F10'], ['Menu']] },
    ],
  },
]
