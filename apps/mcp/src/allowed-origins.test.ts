import { describe, expect, it } from 'vitest'

import { isAllowedOrigin } from './allowed-origins'

const ALLOWED =
  'https://nudo.joyco.studio, https://nudo-*-joycostudio.vercel.app,http://localhost:*'

describe('isAllowedOrigin', () => {
  it.each([
    'https://nudo.joyco.studio',
    'https://nudo-git-some-branch-joycostudio.vercel.app',
    'https://nudo-a1b2c3d4e-joycostudio.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ])('allows %s', (origin) => {
    expect(isAllowedOrigin(origin, ALLOWED)).toBe(true)
  })

  it.each([
    null,
    'https://evil.example',
    'http://nudo.joyco.studio',
    'https://nudo.joyco.studio.evil.example',
    'https://nudo-x-joycostudio.vercel.app.evil.example',
    'https://evil.example/nudo-x-joycostudio.vercel.app',
    'https://nudo-a.b-joycostudio.vercel.app',
    'https://nudo--joycostudio.vercel.app',
    'http://localhost',
    'http://localhost:5173.evil.example',
  ])('refuses %s', (origin) => {
    expect(isAllowedOrigin(origin, ALLOWED)).toBe(false)
  })

  it('treats the dots of an exact origin literally', () => {
    expect(isAllowedOrigin('https://nudoXjoyco.studio', 'https://nudo.joyco.studio')).toBe(false)
  })
})
