import type { AgentSpawnInput, On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { dotSource } from '../hooks/desk'

/** The tests here read the Korean screen. */
const KO = { options: { language: 'ko' } } as const

const SPAWN: AgentSpawnInput = {
  tool_use_id: 'toolu_1',
  prompt: '로그인 폼을 고쳐 줘.',
  description: '로그인 폼 구현',
  subagentType: 'general-purpose',
  provider: { plugin: 'core', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
}

const BAND = { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }
const PANE = { title: '먼작귀', isFocused: false, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} } as const

/** The clock, the pane's opening and the toasts, each recorded where a test reads it. */
const world = (on: On): { opened: unknown[] } => {
  const opened: unknown[] = []

  mock.clock(on, { now: 1000 })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', ($, e) => {
    opened.push(e)

    return { value: { isPlaced: true as const } }
  })

  return { opened }
}

/** Two guests handed work by name, past the main two: 시사, who talks, and 쿠리만쥬, who cannot. */
const handOut = async ($: Parameters<TestBody>[0], on: On): Promise<void> => {
  let count = 0

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(count += 1)}` }))
  await $.agent.spawn({ ...SPAWN, description: '시사: 로그인 폼 구현' })
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', description: '쿠리만쥬: 바뀐 코드 다시 보기' })
}

test('the desktop pane draws a card only for the friends at work, with no cell-grid art', KO, async ($, on) => {
  world(on)
  await handOut($, on)

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.findAll({ type: 'Raster' })).toHaveLength(0)
  // Each friend at work has a card: its mark large and its name in its colors, to press.
  for (const [id, mark, name] of [
    ['shisa', '🦁', '시사'],
    ['kurimanju', '🌰', '쿠리만쥬'],
  ] as const) {
    expect(await pane.find({ key: `card-${id}` })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: mark })).toBeDefined()
    expect(await pane.find({ key: `watch-${id}` })).toMatchObject({ props: { label: name } })
  }
  // The resting ones are left off, and so is their heading.
  for (const id of ['chiikawa', 'usagi', 'rakko', 'momonga'] as const) {
    expect(await pane.find({ key: `card-${id}` })).toBeUndefined()
  }
  expect(await pane.find({ type: 'Text', text: /^ 시사 $/ })).toMatchObject({ props: { backgroundColor: '#f08a24', color: '#000000' } })
  // The dot stands for the running mark: the state is said once, and the heading counts nothing the title has not.
  expect(await pane.find({ type: 'Text', text: /^● 작업 중/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^작업 중 / })).toBeDefined()
  // The ones at work are told apart: their heading, their task, and a dot of their color.
  expect(await pane.find({ type: 'Text', text: /^일하는 친구들$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^쉬는 친구들$/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^로그인 폼 구현$/ })).toBeDefined()
  expect((await pane.findAll({ type: 'Svg' })).length).toBeGreaterThanOrEqual(2)
  // The conversation keeps the sound of the one who cannot talk, and 하치와레's reading of it.
  expect(await pane.find({ type: 'Text', text: /^\(손으로 O를 그린다\)$/ })).toMatchObject({ props: { italic: false } })
  expect(await pane.find({ type: 'Text', text: /^“그 말은 "맡을게"라는 거\?”$/ })).toMatchObject({ props: { italic: true } })
  expect(await pane.find({ type: 'Text', text: /^구현 · 토벌 · 슈퍼 아르바이터$/ })).toBeDefined()
  // The usage is in full until it is folded.
  expect(await pane.find({ key: 'usage-less' })).toBeDefined()

  // A friend pressed has its sheet, and there is handed the next prompt.
  await pane.press({ key: 'watch-shisa' })
  expect(await pane.find({ key: 'watch-close' })).toBeDefined()
  expect(await pane.find({ key: 'pick-shisa' })).toMatchObject({ props: { label: '▷ 이 친구에게 다음 명령 맡기기' } })
  expect(await pane.find({ key: 'role-shisa-검토' })).toBeDefined()
  await pane.press({ key: 'pick-shisa' })
  expect(await pane.find({ key: 'pick-shisa' })).toMatchObject({ props: { label: '▶ 다음 명령을 맡기로 했어요 · 누르면 취소' } })
  await pane.press({ key: 'watch-close' })
  expect(await pane.find({ key: 'watch-close' })).toBeUndefined()

  // The usage folds to one line and opens in full again; the conversation can be shown alone.
  await pane.press({ key: 'usage-less' })
  expect(await pane.find({ key: 'usage-more' })).toBeDefined()
  await pane.press({ key: 'usage-more' })
  expect(await pane.find({ key: 'usage-less' })).toBeDefined()
  await pane.press({ key: 'talk-only' })
  expect(await pane.find({ key: 'card-shisa' })).toBeUndefined()
  expect(await pane.find({ key: 'talk-only' })).toMatchObject({ props: { label: '전체 보기' } })
  await pane.unmount()

  // Seated as a widget, a glance with nothing to press.
  const widget = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, placement: 'widget' } })

  expect(await widget.find({ type: 'Text', text: '🦁' })).toBeDefined()
  expect(await widget.findAll({ type: 'Button' })).toHaveLength(0)
  await widget.unmount()

  // The editor keeps the plain lines it had.
  const editor = await $.ui.mount({ plugin: 'chiikawa', surface: 'vscode', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await editor.findAll({ type: 'Svg' })).toHaveLength(0)
  expect(await editor.find({ type: 'Text', text: /^🦁 시사 \(구현\) ● 작업 중/ })).toBeDefined()
  await editor.unmount()
})

test('a line said while the pane shows the last ones moves no page, so the pane is drawn again for the line alone', KO, async ($, on) => {
  const written: string[] = []

  world(on)
  on('state.set', ($, e, next) => {
    written.push(e.key)

    return next(e)
  })
  await handOut($, on)
  expect(written).toContain('feed')
  expect(written).not.toContain('talkBack')
})

test('the desktop band has a chip for the main three and each friend at work to press, who takes the next prompt, and the last line said', { options: { language: 'ko', autoOpen: false } }, async ($, on) => {
  const { opened } = world(on)

  await handOut($, on)
  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Text', text: /^ 먼작귀 $/ })).toBeDefined()
  expect(await band.find({ key: 'seat-hachiware' })).toMatchObject({ props: { label: '🐱 하치와레' } })
  expect(await band.find({ key: 'seat-shisa' })).toMatchObject({ props: { label: '🦁 시사', dimColor: false } })
  expect(await band.find({ key: 'seat-usagi' })).toMatchObject({ props: { label: '🐰 우사기', dimColor: true } })
  // A guest resting is hidden.
  expect(await band.find({ key: 'seat-rakko' })).toBeUndefined()
  // The ones at work are framed in their color with a dot; the others keep the same frame unseen, so the row's height never changes.
  expect(await band.find({ key: 'chip-shisa' })).toMatchObject({ props: { borderStyle: 'round', borderColor: '#f08a24', backgroundColor: '#f08a2438', paddingX: 'sm' } })
  expect(await band.find({ key: 'chip-usagi' })).toMatchObject({ props: { borderStyle: 'round', borderColor: '#00000000', backgroundColor: '#00000000', paddingX: 'sm' } })
  expect((await band.findAll({ type: 'Svg' })).length).toBeGreaterThanOrEqual(2)
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 자동 ▾' } })
  expect(await band.find({ key: 'open' })).toMatchObject({ props: { label: '창 열기' } })
  expect(await band.find({ type: 'Text', text: /^“친한 건가\.”$/ })).toBeDefined()

  // A friend pressed is told of in the pane, which opens.
  await band.press({ key: 'seat-shisa' })
  expect(opened.length).toBeGreaterThanOrEqual(1)
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ key: 'pick-shisa' })).toBeDefined()
  await pane.unmount()
  await band.unmount()

  // A survey holds the band: the friends give way to it.
  const survey = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, hasSurvey: true } })

  expect(await survey.find({ key: 'seat-shisa' })).toBeUndefined()
  await survey.unmount()

  // Collapsed, the row of friends stays and the line under it is left out.
  const folded = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isCollapsed: true } })

  expect(await folded.find({ key: 'seat-shisa' })).toBeDefined()
  expect(await folded.find({ type: 'Text', text: /^“친한 건가\.”$/ })).toBeUndefined()
  await folded.unmount()
})

test('the desktop band\'s send button lists each friend with its name and what it is good at, and the one chosen takes the next prompt', { options: { language: 'ko', autoOpen: false } }, async ($, on) => {
  world(on)
  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })

  expect(await band.find({ key: 'send-auto' })).toBeUndefined()
  await band.press({ key: 'to' })
  expect(await band.find({ type: 'Text', text: /누구에게 보낼까요/ })).toBeDefined()
  expect(await band.find({ key: 'send-auto' })).toMatchObject({ props: { label: '자동 · 하치와레가 일을 보고 정해요', variant: 'primary' } })
  expect(await band.find({ key: 'send-chiikawa' })).toMatchObject({ props: { label: '🐹 치이카와 · 작은 수정, 정리(풀 뽑기)', variant: 'secondary' } })
  expect(await band.find({ key: 'send-hachiware' })).toBeDefined()
  expect(await band.find({ key: 'send-momonga' })).toBeDefined()
  // 노동 갑옷 씨 takes no work, so it is not offered.
  expect(await band.find({ key: 'send-rodo' })).toBeUndefined()

  // A friend chosen takes the next prompt, and the list closes.
  await band.press({ key: 'send-rakko' })
  expect(await band.find({ key: 'send-auto' })).toBeUndefined()
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: expect.stringMatching(/^보내기: .*랏코.* ▾$/) } })

  // Opened again, the chosen one stands out, and auto gives the choice back to 하치와레.
  await band.press({ key: 'to' })
  expect(await band.find({ key: 'send-rakko' })).toMatchObject({ props: { variant: 'primary' } })
  await band.press({ key: 'send-auto' })
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 자동 ▾' } })
  await band.unmount()
})

test('the desktop band\'s open button opens the pane, and pressed again closes it', { options: { language: 'ko', autoOpen: false } }, async ($, on) => {
  const { opened } = world(on)
  const closed: unknown[] = []

  on('ui.close', ($, e) => {
    closed.push(e)

    return { value: undefined }
  })
  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ key: 'open' })).toMatchObject({ props: { label: '창 열기' } })
  await band.press({ key: 'open' })
  expect(opened.length).toBe(1)
  expect(await band.find({ key: 'open' })).toMatchObject({ props: { label: '창 닫기' } })

  await band.press({ key: 'open' })
  expect(closed).toEqual([expect.objectContaining({ id: 'chiikawa' })])
  expect(opened.length).toBe(1)
  expect(await band.find({ key: 'open' })).toMatchObject({ props: { label: '창 열기' } })

  // And again it opens.
  await band.press({ key: 'open' })
  expect(opened.length).toBe(2)
  await band.unmount()
})

test('the line that closes a turn on the desktop is 하치와레 with his word and the time, as on the terminal', KO, async ($, on) => {
  world(on)
  const turn = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'TurnDuration', props: { word: 'Baked', durationMs: 4000 } })

  expect(await turn.find({ type: 'Text', text: /^ 하치와레 $/ })).toMatchObject({ props: { backgroundColor: '#4a7fd4', color: '#ffffff' } })
  expect(await turn.find({ type: 'Text', text: /^“최고~”$/ })).toBeDefined()
  expect(await turn.find({ type: 'Text', text: '🐱' })).toBeDefined()
  await turn.unmount()

  const long = await $.ui.mount({ plugin: 'chiikawa', surface: 'desktop', component: 'TurnDuration', props: { word: 'Baked', durationMs: 700_000 } })

  expect(await long.find({ type: 'Text', text: /^“몇 번이라도 계속 응원할 테니까!!”$/ })).toBeDefined()
  await long.unmount()
})

test('the bobbing dot is one SVG with no script, and keeps still where movement is off', () => {
  const moving = dotSource('#f08a24', true)
  const still = dotSource('#f08a24', false)

  expect(moving).toContain('@keyframes')
  expect(moving).toContain('prefers-reduced-motion')
  expect(still).not.toContain('@keyframes')
  expect(moving).not.toMatch(/<script|on[a-z]+=|href=/i)
  expect(dotSource('red;}</style><script>', true)).not.toContain('<script')
})
