import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { SCENE, SCENES } from '../hooks/look'

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

test('each meadow is a scene the desktop app moves: only the elements it draws, a style that asks nothing of the window, and nothing fetched', KO, async () => {
  // What the app lets a moving scene hold, as its own check reads it: any other element, or a style it does not take, and the
  // scene is drawn once and stands still.
  const ELEMENTS = new Set('animate animateMotion animateTransform set circle clipPath defs desc ellipse feBlend feComposite feDropShadow feFlood feGaussianBlur feMerge feMergeNode feOffset filter g line linearGradient marker mask mpath path pattern polygon polyline radialGradient rect stop style svg symbol text textPath title tspan use'.split(' '))
  const FUNCTIONS = new Set(
    'color.color-mix.hsl.hsla.hwb.lab.lch.light-dark.oklab.oklch.rgb.rgba.abs.acos.asin.atan.atan2.calc.clamp.cos.exp.hypot.log.max.min.mod.pow.rem.round.sign.sin.sqrt.tan.var.matrix.matrix3d.perspective.rotate.rotate3d.rotatex.rotatey.rotatez.scale.scale3d.scalex.scaley.scalez.skew.skewx.skewy.translate.translate3d.translatex.translatey.translatez.cubic-bezier.linear.steps.blur.drop-shadow.grayscale.hue-rotate.invert.opacity.saturate.sepia.is.not.nth-child.nth-last-child.nth-last-of-type.nth-of-type.where'.split(
      '.',
    ),
  )
  const RULES = new Set(['keyframes', 'layer', 'media', 'supports'])
  const ASKED = /\(\s*(?:prefers-reduced-motion(?:\s*:\s*(?:reduce|no-preference))?|prefers-color-scheme(?:\s*:\s*(?:dark|light))?)\s*\)/gi
  /** Why the app would not take a style or an attribute's value, or nothing. */
  const refused = (text: string): string | undefined => {
    if (text.includes('\\')) return 'a backslash'
    if (/(?:\d|\.)(?:[dsl]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))(?![a-z0-9_-])/i.test(text)) return 'a length of the window'
    if (/shape-rendering|vector-effect/i.test(text)) return 'shape-rendering or vector-effect'
    for (const [, asked = '', opens] of text.matchAll(/@media([^{]*)(\{|$)/gi)) {
      if (opens !== '{' || !/^(?:\s|,|all|and|not|only|or|screen)*$/i.test(asked.replaceAll(ASKED, ''))) return `@media${asked}`
    }
    const bare = text.replaceAll(/[\s\p{Cc}]/gu, '').toLowerCase()

    if (bare.includes('data:')) return 'data:'
    if (text.replaceAll(/url\(#[A-Za-z_][\w.:-]*\)/gi, '').replaceAll(/[\s\p{Cc}]/gu, '').toLowerCase().includes('url(')) return 'a url that is not a part of the scene'
    for (const [, name = ''] of text.matchAll(/([^\s()[\]{}<>;:,'"`=+*/!@#$%^&|~?]{0,64})\(/g)) {
      if (name !== '' && name.toLowerCase() !== 'url' && !FUNCTIONS.has(name.toLowerCase())) return `${name}()`
    }
    for (const [, name = ''] of text.matchAll(/@([^\s{};("'/]*)/g)) if (!RULES.has(name.toLowerCase())) return `@${name}`

    return undefined
  }

  expect(Object.keys(SCENES)).toEqual(['meadow', 'meadow-day', 'meadow-night'])
  for (const [name, scene] of Object.entries(SCENES)) {
    const problems: string[] = []

    if (!scene.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') || /<!DOCTYPE|<!--|<\?/i.test(scene)) problems.push('not one plain svg')
    for (const [, element = ''] of scene.matchAll(/<([A-Za-z][\w:-]*)/g)) if (!ELEMENTS.has(element)) problems.push(`<${element}>`)
    for (const [, attribute = '', value = ''] of scene.matchAll(/\s([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) {
      const why = refused(value)

      if (/^on/i.test(attribute) || /href$/i.test(attribute)) problems.push(attribute)
      if (why !== undefined) problems.push(`${attribute}: ${why}`)
    }
    const styles = [...scene.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(([, text = '']) => text)

    for (const style of styles) {
      const why = refused(style)

      if (why !== undefined) problems.push(`style: ${why}`)
    }
    // It moves, and still follows the app's mode and the person's wish for less motion.
    if (!styles.some(style => /animation|@keyframes/i.test(style))) problems.push('nothing moves')
    if (!styles.some(style => style.includes('prefers-reduced-motion'))) problems.push('no rule for less motion')
    expect(`${name} ${[...new Set(problems)].join(', ')}`).toBe(`${name} `)
  }
  expect(SCENES.meadow).toContain('prefers-color-scheme')
})
