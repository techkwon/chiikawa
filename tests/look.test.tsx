import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { SCENE } from '../hooks/look'

const KO = { options: { language: 'ko' } } as const
const DESKTOP_START = { cwd: '/w', surface: 'desktop', isInteractive: true } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

/** Records each theme set and clear, and keeps what the mode stores. */
const world = (on: On, isSaveFailing = false): { sets: unknown[]; clears: number[]; kept: Map<string, unknown> } => {
  const sets: unknown[] = []
  const clears: number[] = []
  const kept = new Map<string, unknown>()

  mock.clock(on, { now: 1000 })
  on('store.get', ($, e) => ({ value: kept.get(e.key) }))
  on('store.set', ($, e) => {
    if (isSaveFailing && e.key === 'look') throw new Error('disk full')
    kept.set(e.key, e.value)

    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('config.list', () => ({ value: [] }))
  on('env.get', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('theme.set', ($, e) => {
    sets.push(e)

    return { value: { isDrawn: true as const, requestId: 'backdrop' } }
  })
  on('theme.clear', () => {
    clears.push(clears.length)

    return { value: { isDrawn: false as const, reason: 'cleared' } }
  })

  return { sets, clears, kept }
}

test('a session starting sets the meadow and its colors once, and never clears another theme', KO, async ($, on) => {
  const { sets, clears } = world(on)

  await $.session.start(DESKTOP_START)

  expect(sets).toHaveLength(1)
  const first = sets[0] as { colors?: { v: number; label: string; inputs: { light?: object; dark?: object } }; backdrop?: { scene?: string; id?: string } }

  expect(first.colors?.v).toBe(1)
  expect(first.colors?.label).toBe('Chiikawa meadow')
  expect(Object.keys(first.colors?.inputs.light ?? {}).length).toBeGreaterThan(50)
  expect(Object.keys(first.colors?.inputs.dark ?? {}).length).toBeGreaterThan(50)
  expect(first.backdrop?.scene ?? first.backdrop?.id).toBe('meadow')
  expect(clears).toHaveLength(0)
})

test('/chiikawa look off clears and is kept, and look on sets it again', KO, async ($, on) => {
  const { sets, clears, kept } = world(on)

  await $.session.start(DESKTOP_START)
  const off = await $.command.run({ command: 'chiikawa', args: 'look off', ...RUN })

  expect(off.text).toContain('배경과 색을 뺐어요')
  expect(clears).toHaveLength(1)
  expect(kept.get('look')).toBe('off')

  // Kept off: the next session sets nothing.
  await $.session.start(DESKTOP_START)
  expect(sets).toHaveLength(1)
  expect((await $.command.run({ command: 'chiikawa', args: 'look', ...RUN })).text).toContain('꺼짐')

  const back = await $.command.run({ command: 'chiikawa', args: 'look on', ...RUN })

  expect(back.text).toContain('들판 배경과 색을 입혔어요')
  expect(sets).toHaveLength(2)
  expect(kept.get('look')).toBe('on')
})

test('/chiikawa look off that could not be saved says it holds for this session only, and look shows it off', KO, async ($, on) => {
  world(on, true)
  await $.session.start(DESKTOP_START)
  const off = await $.command.run({ command: 'chiikawa', args: 'look off', ...RUN })

  expect(off.text).toContain('배경과 색을 뺐어요')
  expect(off.text).toContain('이번 세션에만')
  expect((await $.command.run({ command: 'chiikawa', args: 'look', ...RUN })).text).toContain('꺼짐')
})

test('the meadow is drawn on the desktop for this mod alone, as one SVG with no script', KO, async ($, on) => {
  world(on)
  await $.session.start(DESKTOP_START)

  const own = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Backdrop', props: { id: 'meadow', scene: 'meadow', plugin: 'chiikawa', glass: { blur: 6, opacity: 0.22 } } as never })
  const svg = await own.find({ type: 'Svg' })

  expect(svg).toBeDefined()
  expect(SCENE.length).toBeLessThan(131_072)
  expect(SCENE).not.toMatch(/<script|on[a-z]+=|href=/i)
  await own.unmount()

  const other = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Backdrop', props: { id: 'meadow', scene: 'meadow', plugin: 'someone-else', glass: false } as never })

  expect(await other.find({ type: 'Svg' })).toBeUndefined()
  await other.unmount()
})

test('/chiikawa look night keeps the window dark with the night meadow, and day keeps it light', KO, async ($, on) => {
  const { sets, kept } = world(on)

  await $.session.start(DESKTOP_START)
  const night = await $.command.run({ command: 'chiikawa', args: 'look 밤', ...RUN })

  expect(night.text).toContain('밤하늘')
  expect(kept.get('look')).toBe('night')
  const set = sets.at(-1) as { overrideColorScheme?: string; backdrop?: { scene?: string; id?: string } }

  expect(set.overrideColorScheme).toBe('dark')
  expect(set.backdrop?.scene).toBe('meadow-night')
  expect(set.backdrop?.id).toBe('meadow-night')

  // Kept for the next session.
  await $.session.start(DESKTOP_START)
  expect((sets.at(-1) as { overrideColorScheme?: string }).overrideColorScheme).toBe('dark')
  expect((await $.command.run({ command: 'chiikawa', args: 'look', ...RUN })).text).toContain('밤으로 고정')

  await $.command.run({ command: 'chiikawa', args: 'look day', ...RUN })
  expect((sets.at(-1) as { overrideColorScheme?: string }).overrideColorScheme).toBe('light')

  const drawn = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Backdrop', props: { id: 'meadow-day', scene: 'meadow-day', plugin: 'chiikawa', glass: { blur: 6, opacity: 0.22 } } as never })

  expect(await drawn.find({ type: 'Svg' })).toBeDefined()
  await drawn.unmount()
})
