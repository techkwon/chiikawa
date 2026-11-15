import type { AgentSpawnInput, On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { stampOf } from '../hooks/pictures'

const KO = { options: { language: 'ko' } } as const
const FOLDER = '/u/.claude/chiikawa-pictures'
const GIF = 'R0lGODlhAQABAAAAACw='
const SMALL = 'R0lGODlhAQABAIAAAP8='
const BAND_FOLDER = `${FOLDER}/band`
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const BAND = { hasSurvey: false, isWorking: true, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const
const PANE = { title: '먼작귀', isFocused: false, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} } as const
const SPAWN: AgentSpawnInput = {
  tool_use_id: 'toolu_1',
  prompt: '로그인 폼을 고쳐 줘.',
  description: '하치와레: 로그인 폼 구현',
  subagentType: 'general-purpose',
  provider: { plugin: 'core', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
}

/** A home whose picture folder holds what `files` names, by name and size. */
const world = (on: On, files: { name: string; size: number }[] | undefined, small: { name: string; size: number }[] = [], bodies = { big: GIF, small: SMALL }): void => {
  const kept = new Map<string, unknown>()

  mock.clock(on, { now: 1000 })
  on('store.get', ($, e) => ({ value: kept.get(e.key) }))
  on('store.set', ($, e) => {
    kept.set(e.key, e.value)

    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('config.list', () => ({ value: [] }))
  on('ui.panes', () => ({ value: [] }))
  on('theme.set', () => ({ value: { isDrawn: true as const, requestId: 'backdrop' } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('env.get', ($, e, next) => (e.name === 'HOME' ? { value: '/u' } : next(e)))
  on('fs.exists', ($, e, next) => (e.path === FOLDER ? { value: files !== undefined } : e.path === BAND_FOLDER ? { value: small.length > 0 } : next(e)))
  on('fs.list', ($, e, next) =>
    e.path === FOLDER || e.path === BAND_FOLDER
      ? { value: (e.path === FOLDER ? (files ?? []) : small).map(one => ({ name: one.name, kind: 'file' as const, size: one.size, mtimeMs: 0, isLink: false })) }
      : next(e),
  )
  on('fs.read', ($, e, next) => (e.path.startsWith(`${BAND_FOLDER}/`) ? { value: { base64: bodies.small } } : e.path.startsWith(`${FOLDER}/`) ? { value: { base64: bodies.big } } : next(e)))
}

test('a picture the person put in the folder stands in for that friend\'s emoji on the desktop card', KO, async ($, on) => {
  world(on, [
    { name: 'hachiware.gif', size: 2000 },
    { name: 'hachiware-working.gif', size: 2000 },
    { name: 'hachiware-dancing.gif', size: 2000 },
    { name: 'usagi.png', size: 400_000 },
    { name: 'notes.txt', size: 10 },
  ], [
    { name: 'hachiware-working.gif', size: 3000 },
    { name: 'hachiware-idle.gif', size: 3000 },
    { name: 'usagi.gif', size: 20_000 },
  ])
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  await $.session.start({ cwd: '/w', surface: 'desktop', isInteractive: true })
  await $.agent.spawn(SPAWN)

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Pane', requestId: 'chiikawa', props: PANE })
  const pictures = (await pane.findAll({ type: 'Svg' })).filter(svg => String(svg.props.source).includes(`data:image/gif;base64,${GIF}`))

  expect(pictures.length).toBeGreaterThanOrEqual(1)
  // A line said by 하치와레 in the talk shows his small picture before it, not his emoji.
  const said = (await pane.findAll({ type: 'Svg' })).filter(svg => String(svg.props.source).includes(`data:image/gif;base64,${SMALL}`))

  expect(said.length).toBeGreaterThanOrEqual(1)
  expect(await pane.find({ type: 'Text', text: /^🐱$/ })).toBeUndefined()
  await pane.unmount()

  // The band above the prompt shows 하치와레's small picture from the band folder, never a large one, and his name then goes without its emoji.
  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const sources = (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.source))

  expect(sources.filter(one => one.includes(`data:image/gif;base64,${SMALL}`)).length).toBe(1)
  expect(sources.filter(one => one.includes(`data:image/gif;base64,${GIF}`)).length).toBe(0)
  expect(await band.find({ key: 'seat-hachiware' })).toMatchObject({ props: { label: '하치와레' } })
  // The send list shows his picture beside his button, whose name goes without the emoji; a friend with no picture keeps it.
  await band.press({ key: 'to' })
  expect(await band.find({ key: 'send-box-hachiware' })).toBeDefined()
  expect(await band.find({ key: 'send-hachiware' })).toMatchObject({ props: { label: expect.stringMatching(/^하치와레 · /) } })
  expect(await band.find({ key: 'send-rakko' })).toMatchObject({ props: { label: expect.stringMatching(/^🦦 /) } })
  await band.press({ key: 'to' })
  await band.unmount()

  // The line that closes a turn shows his picture, not his emoji.
  const turn = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'TurnDuration', props: { word: 'Worked', durationMs: 3000 } })

  expect((await turn.findAll({ type: 'Svg' })).some(svg => String(svg.props.source).includes(`data:image/gif;base64,${SMALL}`))).toBe(true)
  expect(await turn.find({ type: 'Text', text: /^🐱$/ })).toBeUndefined()
  await turn.unmount()

  // The line a turn runs under shows the small picture before its words on the desktop; the terminal keeps the emoji in the words.
  const SPIN = { word: 'Working', message: null, suffix: '…', mode: 'thinking' } as const
  const line = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Spinner', requestId: 'main', props: SPIN })
  const spun = await line.findAll({ type: 'Svg' })

  expect(spun.length).toBe(1)
  expect(String(spun[0]?.props.source)).toContain(`data:image/gif;base64,${SMALL}`)
  expect(await line.find({ type: 'Text', text: /🐱/ })).toBeUndefined()
  await line.unmount()

  const told = await $.command.run({ command: 'chiikawa', args: 'pictures', ...RUN })

  expect(told.text).toContain('그림 2장')
  expect(told.text).toContain('하치와레')
  expect(told.text).toContain('usagi.png(48KB보다 커요)')
  expect(told.text).toContain('작은 그림 2장')
  expect(told.text).toContain('band/usagi.gif(10KB보다 커요)')
})

test('with no folder every friend keeps its emoji, and the command says where to put them', KO, async ($, on) => {
  world(on, undefined)
  await $.session.start({ cwd: '/w', surface: 'desktop', isInteractive: true })

  const told = await $.command.run({ command: 'chiikawa', args: '그림', ...RUN })

  expect(told.text).toContain(`${FOLDER} 에서 쓸 그림을 못 찾았어요`)
})

test('with every friend\'s pictures as large as the folder takes, no desktop drawing carries more picture data than it can draw, and the newest lines keep theirs', KO, async ($, on) => {
  const FRIENDS = ['hachiware', 'chiikawa', 'usagi', 'rakko', 'shisa', 'kurimanju', 'kani', 'pochette', 'momonga']
  // As large as each folder lets in: 48KB and 10KB files, so about 64K and 13K characters of base64.
  const big = `R0lGOD${'A'.repeat(64_000)}`
  const small = `R0lGOD${'B'.repeat(13_000)}`

  world(
    on,
    FRIENDS.map(name => ({ name: `${name}.gif`, size: 47_000 })),
    FRIENDS.map(name => ({ name: `${name}.gif`, size: 9_500 })),
    { big, small },
  )
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  await $.session.start({ cwd: '/w', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chiikawa', args: 'demo on', ...RUN })
  const weight = (svgs: readonly { props: Record<string, unknown> }[]): number => svgs.reduce((sum, svg) => sum + String(svg.props.source).length, 0)

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Pane', requestId: 'chiikawa', props: PANE })
  const drawn = await pane.findAll({ type: 'Svg' })

  expect(weight(drawn)).toBeLessThan(170_000)
  // Four at work at once: every card takes its small picture, none its large one.
  expect(drawn.filter(svg => String(svg.props.source).includes(big)).length).toBe(0)
  expect(drawn.filter(svg => String(svg.props.source).includes(small)).length).toBeGreaterThanOrEqual(4)
  await pane.unmount()

  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  await band.press({ key: 'to' })
  expect(weight(await band.findAll({ type: 'Svg' }))).toBeLessThan(170_000)
  // What did not fit keeps its emoji: every friend is still in the list.
  expect(await band.find({ key: 'send-momonga' })).toBeDefined()
  await band.unmount()
  await $.command.run({ command: 'chiikawa', args: 'demo off', ...RUN })
})

test('a desktop drawing reads the pictures once and their short stamp after that; the same pictures read again are not written again, and new ones are shown', KO, async ($, on) => {
  const NEXT = 'R0lGODlhAgACAAAAACw='
  const bodies = { big: GIF, small: SMALL }
  const box = { reads: 0, stamps: 0, writes: 0 }

  world(on, [{ name: 'hachiware.gif', size: 2000 }], [{ name: 'hachiware.gif', size: 3000 }], bodies)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('state.get', ($, e, next) => {
    if (e.key === 'pictures') box.reads += 1
    if (e.key === 'picturesAt') box.stamps += 1

    return next(e)
  })
  on('state.set', ($, e, next) => {
    if (e.key === 'pictures') box.writes += 1

    return next(e)
  })
  await $.session.start({ cwd: '/w', surface: 'desktop', isInteractive: true })
  await $.agent.spawn(SPAWN)
  const shows = async (drawing: { findAll: (query: { type: 'Svg' }) => Promise<readonly { props: Record<string, unknown> }[]> }, body: string): Promise<boolean> =>
    (await drawing.findAll({ type: 'Svg' })).some(svg => String(svg.props.source).includes(`data:image/gif;base64,${body}`))

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await shows(pane, GIF)).toBe(true)
  // Drawn again, and drawn elsewhere, the table is not read again: only its stamp is.
  const read = { ...box }

  for (let turn = 0; turn < 5; turn += 1) await pane.redraw()
  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isCollapsed: false } })
  const line = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'TurnDuration', props: { word: 'Worked', durationMs: 3000 } })

  expect(await shows(pane, GIF)).toBe(true)
  expect(await shows(band, SMALL)).toBe(true)
  expect(await shows(line, SMALL)).toBe(true)
  expect(box.reads).toBe(read.reads)
  expect(box.stamps).toBeGreaterThanOrEqual(read.stamps + 7)
  await line.unmount()

  // The folder read again with the same pictures in it: nothing is written, so nothing is drawn again for it.
  await $.command.run({ command: 'chiikawa', args: 'pictures', ...RUN })
  expect(box.writes).toBe(read.writes)
  expect(await shows(pane, GIF)).toBe(true)

  // With another picture in it, the table is written, and the drawings that stand show the new one.
  bodies.big = NEXT
  await $.command.run({ command: 'chiikawa', args: 'pictures', ...RUN })
  expect(box.writes).toBe(read.writes + 1)
  expect(await shows(pane, NEXT)).toBe(true)
  expect(await shows(pane, GIF)).toBe(false)
  expect(await shows(band, SMALL)).toBe(true)
  await pane.unmount()
  await band.unmount()
})

test('the stamp of the pictures is the same for the same ones and another for any other', () => {
  const table = { hachiware: { base: 'data:image/gif;base64,AAAA', 'band-base': 'data:image/gif;base64,BBBB' }, usagi: { idle: 'data:image/gif;base64,CCCC' } }

  expect(stampOf(table)).toBe(stampOf({ usagi: { ...table.usagi }, hachiware: { 'band-base': table.hachiware['band-base'], base: table.hachiware.base } }))
  expect(stampOf({ ...table, usagi: { idle: 'data:image/gif;base64,CCCD' } })).not.toBe(stampOf(table))
  expect(stampOf({ ...table, usagi: { done: table.usagi.idle } })).not.toBe(stampOf(table))
  expect(stampOf({ hachiware: table.hachiware })).not.toBe(stampOf(table))
  expect(stampOf({})).not.toBe('')
})
