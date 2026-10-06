import type { AgentSpawnInput, On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Mounted, TestBody } from 'claude-code/testing'

import { cells, spent } from '../hooks/view'
import { MARKS, memberBlock, orcaBlock } from '../hooks/voice'

import type { Drawn } from './drawn'
import { keyed, rowWith, sizeOf, textOf, written } from './drawn'

/** The tests here read the Korean screen: each sets the language, so that none follows the machine it runs on. */
const KO = { options: { language: 'ko' } } as const
const MARK = MARKS.ko

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

const BAND = { hasSurvey: false, isWorking: true, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const PANE = { title: '먼작귀', isFocused: false, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} } as const

test('a spawned subagent is handed to a character; the band shows the last line said, and the pane the conversation', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const seen: AgentSpawnInput[] = []

  on('agent.spawn', ($, e) => {
    seen.push(e)

    return { model: 'claude-sonnet-5-5', agentId: `agent_${seen.length}` }
  })

  await $.agent.spawn(SPAWN)
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', description: '쿠리만쥬: 바뀐 코드 다시 보기' })

  expect(seen[0]?.description).toBe('🦁 시사 · 로그인 폼 구현')
  expect(seen[0]?.prompt).toContain('로그인 폼을 고쳐 줘.')
  expect(seen[0]?.prompt).toContain('너는 지휘자 하치와레가 아니라 시사다')
  expect(seen[1]?.description).toBe('🌰 쿠리만쥬 · 바뀐 코드 다시 보기')
  expect(seen[1]?.prompt).toContain('쿠리만쥬는 원작에서 말을 하지 않는다')

  // The band is one row of names, and under it the last line said as one cut.
  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 150 } })

  expect(await band.find({ type: 'Text', text: /먼작귀/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^친한 건가\.$/ })).toBeDefined()
  expect(await band.findAll({ type: 'Text', text: /^╭─$/ })).toHaveLength(1)
  expect(await band.find({ type: 'Text', text: /^손으로 O를 그린다$/ })).toBeUndefined()
  // The cut has its speaker's picture: 노동 갑옷 씨 is the armor with its bell.
  expect(await band.find({ type: 'Text', text: /^\.---\.$/ })).toMatchObject({ props: { color: '#a89f91' } })
  expect(await band.find({ type: 'Text', text: /^A$/ })).toMatchObject({ props: { color: '#f3dc6b' } })
  await band.unmount()

  // The pane has the conversation under the cuts of those at work: the last three lines, a cut each.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /─ 일하는 친구들 ─/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /─ 이야기 ─/ })).toBeDefined()
  // A gesture is a caption, told plainly; a line is a balloon with the speaker's name on its rim.
  expect(await pane.find({ type: 'Text', text: /^ 쿠리만쥬 $/ })).toMatchObject({ props: { backgroundColor: '#8a5a2b' } })
  expect(await pane.find({ type: 'Text', text: /^손으로 O를 그린다$/ })).toMatchObject({ props: { italic: false } })
  expect(await pane.find({ type: 'Text', text: /^┌─$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^그 말은 "맡을게"라는 거\?$/ })).toMatchObject({ props: { italic: true } })
  expect(await pane.find({ type: 'Text', text: /^친한 건가\.$/ })).toBeDefined()
  // 하치와레 says how many have the work; each of them has a cut of the same shape as the three's.
  expect(await pane.find({ type: 'Text', text: /^친구 2명에게 맡김$/ })).toBeDefined()
  expect((await pane.findAll({ type: 'Box' })).filter(box => box.props.borderStyle === 'round')).toHaveLength(6)
  expect(await pane.find({ type: 'Text', text: /^로그인 폼 구현$/ })).toBeDefined()
  // Two cuts do not fill a row of three: they stand in its middle.
  expect((await pane.findAll({ type: 'Box' })).filter(box => box.props.justifyContent === 'center' && box.props.borderStyle === undefined).length).toBeGreaterThanOrEqual(2)
  await pane.unmount()

  // A band too narrow for a cut tells the same lines one to a row.
  const narrow = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 44 } })

  expect(await narrow.find({ type: 'Text', text: /^“친한 건가\.”$/ })).toBeDefined()
  await narrow.unmount()
})

test('the conversation that has gone by can be turned back to, and forward again', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  let count = 0

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(count += 1)}` }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  await $.agent.spawn(SPAWN)
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', description: '쿠리만쥬: 바뀐 코드 다시 보기' })

  // A page with room for the last three lines only.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, scroll: { offset: 0, bodyRows: 30 } } })
  const last = { type: 'Text', text: /^친한 건가\.$/ } as const

  expect(await pane.find(last)).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /─ 이야기 ─/ })).toBeDefined()
  expect(await pane.find({ key: 'talk-newer' })).toBeUndefined()

  await pane.press({ key: 'talk-older' })
  expect(await pane.find({ type: 'Text', text: /─ 지난 이야기 1~3\/\d+ ─/ })).toBeDefined()
  expect(await pane.find(last)).toBeUndefined()
  // The first of them all is on the page: there is nothing before it to turn to.
  expect(await pane.find({ key: 'talk-older' })).toBeUndefined()

  await pane.press({ key: 'talk-newer' })
  expect(await pane.find(last)).toBeDefined()
  expect(await pane.find({ key: 'talk-newer' })).toBeUndefined()

  // The conversation alone: no cut of a character, no bench, no usage, and all that was said on the page.
  expect(await pane.find({ key: 'talk-only' })).toMatchObject({ props: { label: '이야기만' } })
  expect((await pane.findAll({ type: 'Raster' })).length).toBeGreaterThan(0)
  await pane.press({ key: 'talk-only' })
  expect(await pane.findAll({ type: 'Raster' })).toHaveLength(0)
  expect(await pane.find({ key: 'usage-less' })).toBeUndefined()
  expect(await pane.find({ key: 'talk-older' })).toBeUndefined()
  expect(await pane.find(last)).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^손으로 O를 그린다$/ })).toBeDefined()
  expect(await pane.find({ key: 'talk-only' })).toMatchObject({ props: { label: '전체 보기' } })
  await pane.press({ key: 'talk-only' })
  expect((await pane.findAll({ type: 'Raster' })).length).toBeGreaterThan(0)
  // The same by name, from the prompt.
  expect((await $.command.run({ command: 'chiikawa', args: '이야기', ...RUN })).text).toContain('이야기만 보여요')
  expect(await pane.findAll({ type: 'Raster' })).toHaveLength(0)
  expect((await $.command.run({ command: 'chiikawa', args: 'talk', ...RUN })).text).toContain('전체 보기로 돌렸어요')
  await pane.unmount()
})

test('a role given on the sheet or by name changes who takes that work, is kept, and is told to the main loop', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const kept = new Map<string, unknown>([['roles', { kani: '검토' }]])
  const spawned: AgentSpawnInput[] = []
  const told: (readonly string[] | undefined)[] = []

  on('agent.spawn', ($, e) => {
    spawned.push(e)

    return { model: 'claude-sonnet-5-5', agentId: `agent_${spawned.length}` }
  })
  on('prompt.submit', ($, e) => {
    told.push(e.context)

    return { text: e.text }
  })
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('store.get', ($, e) => ({ value: kept.get(e.key) }))
  on('store.set', ($, e) => {
    kept.set(e.key, e.value)

    return { value: undefined }
  })

  const typed = { text: '안녕', wait: false, origin: { kind: 'composer' } } as const

  // What an earlier session kept is in the first telling.
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.prompt.submit(typed)
  expect(told[0]?.[0]).toContain('🦀 카니 (헌책방, 헌책방 주인): 검토, 검증 (사용자가 바꾼 역할: 검토)')
  expect((await $.command.run({ command: 'chiikawa', args: 'role', ...RUN })).text).toContain('🦀 카니 · 검토 (검토, 검증) ← 원래 조사')
  expect((await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })).text).toBe('친구들의 역할을 모두 원래대로 돌렸어요.')

  // On the sheet: the role it has is marked, and another, pressed, is its role.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, scroll: { offset: 0, bodyRows: 60 } } })

  await pane.press({ key: 'watch-rakko' })
  expect(await pane.find({ key: 'role-rakko-구현' })).toMatchObject({ props: { label: '▶구현' } })
  await pane.press({ key: 'role-rakko-검토' })
  expect(await pane.find({ key: 'role-rakko-검토' })).toMatchObject({ props: { label: '▶검토' } })
  expect(await pane.find({ key: 'role-rakko-구현' })).toMatchObject({ props: { label: '▷구현' } })
  expect(await pane.find({ type: 'Text', text: /^원래 구현$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^쉬는 중 · 검토, 검증$/ })).toBeDefined()
  expect(kept.get('roles')).toEqual({ rakko: '검토' })
  // 하치와레 conducts, and has no role to give.
  await pane.press({ key: 'watch-hachiware' })
  expect(await pane.find({ key: 'role-hachiware-구현' })).toBeUndefined()
  expect(await pane.find({ key: 'pick-hachiware' })).toBeDefined()
  await pane.unmount()

  // The review goes to 랏코 now, and the next prompt says so, once.
  await $.agent.spawn({ ...SPAWN, subagentType: 'quality-engineer', description: '바뀐 코드 다시 보기' })
  expect(spawned[0]?.description).toBe('🦦 랏코 · 바뀐 코드 다시 보기')
  expect(spawned[0]?.prompt).toContain('검토 담당')
  await $.prompt.submit(typed)
  await $.prompt.submit(typed)
  expect(told.at(-2)?.[0]).toContain('[치이카와 역할] 사용자가 친구들의 역할을 바꿨다. 지금 바뀐 역할: 랏코는 검토(검토, 검증)')
  expect(told.at(-1)).toBeUndefined()

  // By name: another role, the same again, its own again, and one that cannot be.
  expect((await $.command.run({ command: 'chiikawa', args: '역할 포쉐트 갑옷 씨 조사', ...RUN })).text).toContain('👛 포쉐트 갑옷 씨의 역할을 조사로 바꿨어요(원래 구현)')
  expect((await $.command.run({ command: 'chiikawa', args: 'role 포쉐트 조사', ...RUN })).text).toBe('👛 포쉐트 갑옷 씨는 이미 조사 역할이에요.')
  expect((await $.command.run({ command: 'chiikawa', args: 'role 랏코 기본', ...RUN })).text).toBe('🦦 랏코의 역할을 원래대로 구현으로 돌렸어요.')
  expect((await $.command.run({ command: 'chiikawa', args: 'role 하치와레 검토', ...RUN })).text).toContain('역할을 바꿀 수 없어요')
  expect((await $.command.run({ command: 'chiikawa', args: 'role 랏코 지휘', ...RUN })).text).toContain('알 수 없어요')
  expect(kept.get('roles')).toEqual({ pochette: '조사' })
  await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })
  expect(kept.get('roles')).toEqual({})
})

test('the kind of work picks the character: screens to 포쉐트 갑옷 씨, a named one to itself', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const seen: AgentSpawnInput[] = []

  on('agent.spawn', ($, e) => {
    seen.push(e)

    return { model: 'claude-sonnet-5-5', agentId: `agent_${seen.length}` }
  })

  await $.agent.spawn({ ...SPAWN, subagentType: 'frontend-architect', description: '설정 화면 만들기' })
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', description: '랏코: 로그인 버그 토벌' })
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_3', description: '함수 이름 고치기', model: 'claude-haiku-4-5' })

  expect(seen.map(e => e.description)).toEqual(['👛 포쉐트 갑옷 씨 · 설정 화면 만들기', '🦦 랏코 · 로그인 버그 토벌', '🐹 치이카와 · 함수 이름 고치기'])
  expect(seen[1]?.prompt).toContain('"온다!"')
})

test("a character's turn ending ends its task, with what it cost and what 하치와레 makes of it", KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }))

  await $.agent.spawn({ ...SPAWN, subagentType: 'Explore', description: '설정 파일 위치 찾기' })
  await clock.advance(65_000)
  await $.turn.complete({
    answer: '🐰 우사기: 우라라라라\n설정 파일은 src/config.ts 에 있다.',
    durationMs: 65_000,
    isAborted: false,
    turnId: 'turn_1',
    agentId: 'agent_1',
    reason: 'answer',
    usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 50_000, cache_creation_input_tokens: 800, model: 'claude-haiku-4-5' },
  })

  const said = await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })

  expect(said.text).toContain('🐰 우사기: 입력 2천 · 캐시 5만 · 출력 340')

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /^✓ 끝 1:05$/ })).toMatchObject({ props: { color: 'success' } })
  expect(await pane.find({ type: 'Text', text: /탐색 끝 · 1분 5초/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /토끼 · 제초 2급/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^↳ 설정 파일은 src/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^있구나~\. 이런 곳에도\.$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /쉬는 친구들/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^“최고~”$/ })).toBeDefined()
  // The three the comic is about have a cut each; the other seven sit on the bench as icons.
  expect(await pane.findAll({ type: 'Raster' })).toHaveLength(10)
  // Each one's name is the thing to press.
  expect(await pane.find({ key: 'watch-hachiware' })).toMatchObject({ props: { label: '하치와레' } })
  expect(await pane.find({ key: 'watch-chiikawa' })).toMatchObject({ props: { label: '치이카와' } })
  // Pressed, it tells what that one is doing: here what it ended, what it handed back line by line, and what it cost.
  await pane.press({ key: 'watch-usagi' })
  expect(await pane.find({ type: 'Text', text: /토끼 · 제초 2급/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^설정 파일은 src\/config\.ts 에 있다\.$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^입력 2천 · 캐시 5만 · 출력 340$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^✓ 설정 파일 위치 찾기 · 1분 5초$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^쉬는 중 · 코드 탐색, 위치 찾기$/ })).toBeDefined()
  expect(await pane.find({ key: 'pick-usagi' })).toBeDefined()
  // The tree the surface is handed is one it takes.
  expect(await pane.drawn()).toMatchObject({ type: 'Box' })
  await pane.press({ key: 'watch-close' })
  expect(await pane.findAll({ key: 'watch-close' })).toHaveLength(0)
  await pane.unmount()
})

test('the main loop is told it conducts as 하치와레, until the mode is off', KO, async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }))

  const facts = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: ['Agent'], outputStyle: null, traits: [] } as const
  const composed = await $.prompt.compose(facts)

  expect(composed.sections.map(section => section.id)).toEqual(['intro', 'chiikawa:leader'])
  expect(composed.sections[1]?.text).toContain('너는 하치와레')

  await $.command.run({ command: 'chiikawa', args: 'off', ...RUN })

  expect((await $.prompt.compose(facts)).sections.map(section => section.id)).toEqual(['intro'])
  await $.command.run({ command: 'chiikawa', args: 'on', ...RUN })
})

test('an Orca worker is handed to a character, voiced through a copy of its spec, and ended by its meta file', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const files = new Map<string, string>([['/w/runs/a/find.spec.md', '# 작업지시\n설정 파일을 찾는다.']])
  const ran: string[] = []

  mock.env(on, { HOME: '/home/me' })
  on('fs.read', ($, e) => {
    const text = files.get(e.path)

    if (text === undefined) throw new Error('ENOENT')

    return { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)

    return { value: undefined }
  })
  on('fs.stat', ($, e) => {
    if (!files.has(e.path)) throw new Error('ENOENT')

    return { value: { kind: 'file' as const, size: 1, mtimeMs: clock.now(), isLink: false } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', ($, e) => {
    if (e.tool === 'Bash') ran.push(e.command)

    return { result: { stdout: '', stderr: '' } }
  })

  const answer = await $.tool.call({
    tool: 'Bash',
    command: `ls /w/runs/a/find.spec.md; orca terminal create --title "scout" --command "fleet-run codex-scout --cwd /w --spec /w/runs/a/find.spec.md --out /w/runs/a/find.out.md; echo done" --json`,
  })

  expect(ran[0]).toContain('--spec /w/runs/a/find.spec.chiikawa-usagi.md --out /w/runs/a/find.out.md')
  expect(ran[0]?.startsWith('ls /w/runs/a/find.spec.md; orca terminal create')).toBe(true)
  expect(files.get('/w/runs/a/find.spec.chiikawa-usagi.md')).toContain('너는 지휘자 하치와레가 아니라 우사기다')
  expect(files.get('/w/runs/a/find.spec.md')).toBe('# 작업지시\n설정 파일을 찾는다.')
  expect(answer.context?.join('\n')).toContain('[치이카와 배역] fleet-run codex-scout "find" 작업은 우사기(탐색)가 맡았다.')

  const before = await $.command.run({ command: 'chiikawa', args: '', ...RUN })

  expect(before.text).toContain('🐰 우사기 (탐색) ● 작업 중')
  expect(before.text).toContain('노동 갑옷 씨: “빠른 사람이 임자!” (일감 접수)')

  files.set('/w/runs/a/find.out.md.meta.json', JSON.stringify({ exit_code: 0, model: 'gpt-6-luna', seconds: 43, usage: { input_tokens: 249_829, cached_input_tokens: 195_072, output_tokens: 1095 } }))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await clock.advance(4000)

  const after = await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })

  expect(after.text).toContain('🐰 우사기: 입력 5.5만 · 캐시 19.5만 · 출력 1.1천')
})

test('a pane with little room draws two rows a character, and a roomy one a page of cuts', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const props = { ...PANE, bodyColumns: 44, placement: 'inline', scroll: { offset: 0, bodyRows: 12 } } as const
  const slim = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props })

  expect(await slim.findAll({ type: 'Raster' })).toHaveLength(0)
  // The three the comic is about, two rows each.
  expect(await slim.findAll({ type: 'Text', text: /^▌$/ })).toHaveLength(6)
  expect(await slim.find({ key: 'watch-hachiware' })).toMatchObject({ props: { label: '하치와레' } })
  expect(await slim.find({ type: 'Text', text: /쉬는 중 / })).toBeDefined()
  await slim.unmount()

  // Narrow, it stays a list however tall: no frames, and the conversation a line each.
  const tall = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...props, scroll: { offset: 0, bodyRows: 34 } } })

  expect(await tall.findAll({ type: 'Raster' })).toHaveLength(0)
  expect((await tall.findAll({ type: 'Box' })).filter(box => box.props.borderStyle === 'round')).toHaveLength(0)
  expect(await tall.find({ type: 'Text', text: /^“뭐야 뭐야\?”$/ })).toBeDefined()
  await tall.unmount()

  // Roomy, the three have a cut each, the rest sit as characters, and the usage is in full until it is put away.
  const page = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })
  const framed = async (): Promise<number> => (await page.findAll({ type: 'Box' })).filter(box => box.props.borderStyle === 'round').length

  expect(await page.findAll({ type: 'Raster' })).toHaveLength(10)
  expect(await framed()).toBe(4)
  expect(await page.find({ type: 'Text', text: /^사용량$/ })).toBeDefined()
  await page.press({ key: 'usage-less' })
  expect(await framed()).toBe(3)
  expect(await page.find({ type: 'Text', text: /─ 일하는 친구들 ─/ })).toBeUndefined()
  expect(await page.find({ type: 'Text', text: /─ 이야기 ─/ })).toBeDefined()
  expect(await page.find({ type: 'Text', text: /─ 쉬는 친구들 ─/ })).toBeDefined()
  expect(await page.find({ key: 'usage-more' })).toMatchObject({ props: { label: '사용량 보기' } })
  await page.press({ key: 'usage-more' })
  expect(await framed()).toBe(4)
  await page.unmount()
})

test('the main loop is told beside the first typed prompt that it conducts, once, and told when the mode goes off', KO, async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []

  on('prompt.submit', ($, e) => {
    seen.push(e.context)

    return { text: e.text }
  })

  const typed = { text: '안녕', wait: false, origin: { kind: 'composer' } } as const

  await $.prompt.submit(typed)
  await $.prompt.submit(typed)
  await $.command.run({ command: 'chiikawa', args: 'off', ...RUN })
  await $.prompt.submit(typed)
  await $.prompt.submit(typed)

  expect(seen[0]?.[0]).toContain('너는 하치와레')
  expect(seen[1]).toBeUndefined()
  expect(seen[2]?.[0]).toContain('치이카와 모드가 꺼졌다')
  expect(seen[3]).toBeUndefined()
  await $.command.run({ command: 'chiikawa', args: 'on', ...RUN })
})

test('the beat ends a character the engine lists as done, and a slow one is grumbled at by 모몽가', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const listed = [{ id: 'agent_1', description: '🦁 시사 · 로그인 폼 구현', type: 'general-purpose', status: 'running' as 'running' | 'completed' }]
  const opened: string[] = []

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('agent.list', () => ({ value: listed }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', ($, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.agent.spawn(SPAWN)
  await clock.settle()

  expect(opened).toEqual(['chiikawa'])

  await clock.advance(184_000)

  const slow = await $.command.run({ command: 'chiikawa', args: '', ...RUN })

  expect(slow.text).toContain('🦁 시사 (구현) ● 작업 중 3:0')
  expect(slow.text).toContain('모몽가: “배고파서 기분이 좀 안 좋아!!!”')

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /^피곤해도 계속한다$/ })).toBeDefined()
  // 모몽가 spoke last and is tired of waiting.
  expect(await pane.find({ type: 'Text', text: /^\( -A- \)$/ })).toBeDefined()
  await pane.unmount()

  const first = listed[0]

  if (first !== undefined) first.status = 'completed'
  await clock.advance(4000)

  const done = await $.command.run({ command: 'chiikawa', args: '', ...RUN })

  expect(done.text).toContain('🦁 시사 (구현) ✓ 끝')
})

const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const DONE = { durationMs: 1000, isAborted: false, turnId: 'turn_1' } as const

test('the next prompt goes where 하치와레 decides unless a friend is chosen, and a chosen friend takes one', KO, async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []

  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('prompt.submit', ($, e) => {
    seen.push(e.context)

    return { text: e.text }
  })

  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 120 } })

  // With nothing going on the band is still there: the friends by name, who takes the next prompt, and the usage.
  expect(await band.find({ key: 'seat-rakko' })).toMatchObject({ props: { label: '랏코', dimColor: true } })
  expect(await band.find({ key: 'seat-hachiware' })).toMatchObject({ props: { label: '하치와레' } })
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 자동', dimColor: true } })
  expect(await band.find({ key: 'usage' })).toBeDefined()
  expect(await band.drawn()).toMatchObject({ type: 'Box' })

  // The usage, pressed, is told of in full in the pane, until it is put away there.
  await band.press({ key: 'usage' })

  const figures = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await figures.find({ key: 'usage-more' })).toBeUndefined()
  await figures.press({ key: 'usage-less' })
  expect(await figures.find({ key: 'usage-more' })).toBeDefined()
  await figures.unmount()

  // A friend, pressed, is told of in the pane, and there handed the next prompt.
  await band.press({ key: 'seat-rakko' })

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /^쉬는 중 · 어려운 구현, 디버깅$/ })).toBeDefined()
  await pane.press({ key: 'pick-rakko' })
  await pane.unmount()
  expect(await band.find({ key: 'seat-rakko' })).toMatchObject({ props: { label: '▶랏코', dimColor: false } })
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 랏코', dimColor: false } })

  const typed = { text: '로그인 버그 고쳐 줘', wait: false, origin: { kind: 'composer' } } as const

  await $.prompt.submit(typed)
  await $.prompt.submit(typed)

  expect(seen[0]?.some(line => line.includes('[치이카와 지명]') && line.includes('description을 "랏코: "로 시작한다'))).toBe(true)
  expect(seen[1]?.some(line => line.includes('[치이카와 지명]')) ?? false).toBe(false)
  // The choice is spent with the prompt: the next one is 하치와레's to share out again.
  expect(await band.find({ key: 'seat-rakko' })).toMatchObject({ props: { label: '랏코' } })
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 자동' } })

  // A choice not yet spent is let go by a press on it, or by name.
  await $.command.run({ command: 'chiikawa', args: '시사', ...RUN })
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 시사' } })
  await band.press({ key: 'to' })
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 자동' } })
  await $.command.run({ command: 'chiikawa', args: '시사', ...RUN })
  expect((await $.command.run({ command: 'chiikawa', args: 'auto', ...RUN })).text).toContain('자동으로 했어요')
  expect(await band.find({ key: 'to' })).toMatchObject({ props: { label: '보내기: 자동' } })
  await band.unmount()

  // Short of room, the three keep their names and the rest are a count that opens the pane.
  const narrow = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 72 } })

  expect(await narrow.find({ key: 'seat-usagi' })).toMatchObject({ props: { label: '우사기' } })
  expect(await narrow.find({ key: 'seat-rakko' })).toBeUndefined()
  expect(await narrow.find({ key: 'rest' })).toMatchObject({ props: { label: '쉬는 친구 6' } })
  await narrow.unmount()

  // The same choice by name, and taken back by the same name.
  expect((await $.command.run({ command: 'chiikawa', args: '해달', ...RUN })).text).toContain('랏코에게 맡겨요')
  expect((await $.command.run({ command: 'chiikawa', args: '랏코', ...RUN })).text).toContain('취소했어요')
})

test('a prompt that was turned away does not count as having told the main loop', KO, async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []

  on('prompt.submit', ($, e) => {
    seen.push(e.context)

    return seen.length === 1 ? { drop: 'declined' } : { text: e.text }
  })

  const typed = { text: '안녕', wait: false, origin: { kind: 'composer' } } as const

  await $.prompt.submit(typed)
  await $.prompt.submit(typed)
  await $.prompt.submit(typed)

  expect(seen[0]?.[0]).toContain('너는 하치와레')
  expect(seen[1]?.[0]).toContain('너는 하치와레')
  expect(seen[2]).toBeUndefined()
})

test('an Orca worker whose end cannot be learned is let go after an hour, and said to be', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })

  mock.env(on, { HOME: '/home/me' })
  on('fs.read', () => {
    throw new Error('ENOENT')
  })
  on('fs.write', () => ({ value: undefined }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))

  await $.session.start(START)
  await $.tool.call({ tool: 'Bash', command: 'orca terminal create --title "scout" --command "fleet-run codex-scout --cwd /w --spec /w/runs/a/find.spec.md" --json' })

  // With no result file named there is nothing to watch: it waits, and says why.
  const flagged = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(flagged).toContain('🐰 우사기 (탐색) ◐ 기다리는 중')

  await clock.advance(3_610_000)

  const gone = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  // Neither done nor failed: it is off the page, and 노동 갑옷 씨 says so.
  expect(gone).toContain('🐰 우사기 (탐색) ○ 대기')
  expect(gone).toContain('노동 갑옷 씨: “의태형인가...?” (우사기의 find · 결과가 없어 내려놓음)')
})

test('a demonstration is ended by the beat, so the session starting again in the middle does not leave it running', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })

  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await $.command.run({ command: 'chiikawa', args: 'demo', ...RUN })
  // The session starts a second time, which is as near a reload as a test comes: what the hooks hold in their own variables is not lost here, and the tasks are ended by the beat either way.
  await $.session.start(START)
  await clock.advance(18_000)

  const after = await $.command.run({ command: 'chiikawa', args: '', ...RUN })

  expect(after.text).toContain('🐰 우사기 (탐색) ✓ 끝')
  expect(after.text).toContain('🦦 랏코 (구현) ✓ 끝')
  expect(after.text).toContain('🐹 치이카와 (구현) ✗ 실패')
  expect(after.text).toContain('🌰 쿠리만쥬 (검토) ✓ 끝')
  expect(after.text).toContain('하치와레: “몇 번이라도 계속 응원할 테니까!!” (4개 가운데 1개 실패)')
  await $.command.run({ command: 'chiikawa', args: 'clear', ...RUN })
})

test('two tasks of one name are each given their own agent, and one ending ends one', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const listed = [
    { id: 'agent_a', description: '🦁 시사 · 로그인 폼 구현', type: 'general-purpose', status: 'running' as 'running' | 'completed' },
    { id: 'agent_b', description: '🦦 랏코 · 로그인 폼 구현', type: 'general-purpose', status: 'running' as 'running' | 'completed' },
  ]

  // The spawn answers no id: the beat finds each task its row in the list.
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5' }))
  on('agent.list', () => ({ value: listed }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2' })
  await clock.advance(4000)

  const first = listed[0]

  if (first !== undefined) first.status = 'completed'
  await clock.advance(4000)

  const roster = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(roster.match(/✓ 끝/g)).toHaveLength(1)
  expect(roster.match(/● 작업 중/g)).toHaveLength(1)
})

test('a list that cannot be read ends nobody, and a guess is overruled by the task itself', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const list = { isBroken: true, status: 'running' as 'running' | 'completed' }

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('agent.list', () => {
    if (list.isBroken) throw new Error('busy')

    return { value: [{ id: 'agent_1', description: '🦁 시사 · 로그인 폼 구현', type: 'general-purpose', status: list.status }] }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  await clock.advance(60_000)

  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🦁 시사 (구현) ● 작업 중')

  // The list says it is done, which is a guess until the task's own turn says how it went.
  list.isBroken = false
  list.status = 'completed'
  await clock.advance(4000)

  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🦁 시사 (구현) ✓ 끝')

  await $.turn.complete({ ...DONE, answer: '', agentId: 'agent_1', reason: 'error' })

  const after = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(after).toContain('🦁 시사 (구현) ✗ 실패')
  expect(after).toContain('API 오류')
})

test('a friend at work, pressed in the band, shows its task in the pane, and moves while it works', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const opened: string[] = []

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('agent.list', () => ({ value: [{ id: 'agent_1', description: '🦦 랏코 · 로그인 버그 토벌', type: 'general-purpose', status: 'running' as const }] }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', ($, e) => {
    opened.push(e.id)

    return { value: { isPlaced: false as const, reason: 'narrow' } }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await $.agent.spawn({ ...SPAWN, description: '랏코: 로그인 버그 토벌' })
  await clock.settle()
  opened.length = 0

  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 120 } })
  const turning = async (): Promise<string[]> => {
    const seen: string[] = []

    for (const mark of '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏') {
      for (const _ of await band.findAll({ type: 'Text', text: new RegExp(`^${mark} $`) })) seen.push(mark)
    }

    return seen
  }

  // 하치와레 conducts and 랏코 works: their marks turn together, a frame at a time.
  const before = await turning()

  expect(before).toHaveLength(2)
  expect(before[0]).toBe(before[1])
  await clock.advance(500)

  const next = await turning()

  expect(next).toHaveLength(2)
  expect(next[0]).not.toBe(before[0])

  // Pressed, a friend is told of in the pane; it is not thereby chosen for the next prompt.
  await band.press({ key: 'seat-rakko' })
  expect(opened).toEqual(['chiikawa'])
  expect(await band.find({ key: 'seat-rakko' })).toMatchObject({ props: { label: '랏코' } })
  await band.unmount()

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ key: 'watch-close' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^● 로그인 버그 토벌$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^ {2}general-purpose · 작업 중 0:0\d$/ })).toBeDefined()
  // 랏코 is a guest on the page while it works: a card of its own under the three.
  expect(await pane.findAll({ type: 'Raster' })).toHaveLength(10)
  await pane.press({ key: 'watch-close' })
  expect(await pane.findAll({ key: 'watch-close' })).toHaveLength(0)
  await pane.press({ key: 'watch-rakko' })
  expect(await pane.find({ key: 'watch-close' })).toBeDefined()
  await pane.unmount()
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🦦 랏코 (구현) ○ 대기')
})

test("the drawings follow the person's theme from the next prompt or command, with no setting watched", KO, async ($, on) => {
  const theme = { value: 'light' }

  mock.clock(on, { now: 1000 })
  on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice' as const, value: theme.value, provider: { plugin: 'engine', tier: 'core' as const }, isLocked: false }] }))
  on('config.set', ($, e) => {
    theme.value = String(e.value)

    return { value: e.value }
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })
  const frames = async (): Promise<unknown[]> => (await pane.findAll({ type: 'Text' })).map(text => text.props.color)
  const set = (value: string, previous: string): Promise<unknown> => $.config.set({ key: 'theme', value, previous, provider: { plugin: 'engine', tier: 'core' }, origin: { kind: 'composer' } })

  // 하치와레's blue, deepened for a light ground.
  expect(await frames()).toContain('#2f62b8')
  expect(await frames()).not.toContain('#6fa0ea')

  // The change itself goes by unwatched: the next prompt the person types is where it is read.
  await set('dark', 'light')
  expect(await frames()).toContain('#2f62b8')
  await $.prompt.submit({ text: '안녕', wait: false, origin: { kind: 'composer' } })
  expect(await frames()).toContain('#6fa0ea')
  expect(await frames()).not.toContain('#2f62b8')

  // And so is the mode's own command.
  await set('light', 'dark')
  await $.command.run({ command: 'chiikawa', args: '', ...RUN })
  expect(await frames()).toContain('#2f62b8')
  expect(await frames()).not.toContain('#6fa0ea')
  await pane.unmount()
})

const LIGHT = [{ key: 'theme', label: 'Theme', kind: 'choice' as const, value: 'light', provider: { plugin: 'engine', tier: 'core' as const }, isLocked: false }]

/** The colors the pane's drawings have under a theme the mode's own setting may overrule. */
const tonesUnder = async ($: Parameters<TestBody>[0], on: On): Promise<unknown[]> => {
  on('config.list', () => ({ value: LIGHT }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })
  const tones = (await pane.findAll({ type: 'Text' })).map(text => text.props.color)

  await pane.unmount()

  return tones
}

test("the mode's own theme setting holds against the person's theme", { options: { ...KO.options, theme: 'dark' } }, async ($, on) => {
  const tones = await tonesUnder($, on)

  expect(tones).toContain('#6fa0ea')
  expect(tones).not.toContain('#2f62b8')
})

test("a theme setting that is none of the three follows the person's theme, as auto does", { options: { ...KO.options, theme: 'sepia' } }, async ($, on) => {
  const tones = await tonesUnder($, on)

  expect(tones).toContain('#2f62b8')
  expect(tones).not.toContain('#6fa0ea')
})

test('light work the main loop does itself is seen as the three at it together', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })

  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await $.tool.call({ tool: 'Read', file_path: '/w/hooks/view.tsx' })

  const seeking = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(seeking).toContain('🐱 하치와레 (지휘) ● 같이 하는 중 · 우사기와 찾는 중 · view.tsx')
  expect(seeking).toContain('🐰 우사기 (탐색) ● 거드는 중 · 찾는 중 · view.tsx')
  expect(seeking).toContain('우사기: “우라” (찾는 중 · view.tsx)')
  expect(seeking).toContain('하치와레: “그 말은 "찾아볼게"라는 거?” (우사기의 말 풀이)')
  // No friend was called in: the others rest.
  expect(seeking).toContain('🦦 랏코 (구현) ○ 대기')

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /^ 셋이 같이 하는 중$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^우사기와 함께$/ })).toBeDefined()
  // The three have their cuts, and the other seven wait as characters: no card among them.
  expect(await pane.findAll({ type: 'Raster' })).toHaveLength(10)
  const cuts = (await pane.findAll({ type: 'Box' })).filter(box => box.props.borderStyle === 'round').slice(0, 3)

  expect(cuts).toHaveLength(3)
  // The two at it are framed in their own colors; 치이카와, with nothing to do yet, plainly.
  expect(cuts.map(box => box.props.borderColor)).toEqual(['#6fa0ea', 'subtle', '#f3dc6b'])
  await pane.unmount()

  await $.tool.call({ tool: 'Edit', file_path: '/w/hooks/view.tsx', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Read', file_path: '/w/hooks/view.tsx', offset: 100 })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const mending = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(mending).toContain('🐹 치이카와 (구현) ● 거드는 중 · 고치는 중 · view.tsx')
  expect(mending).toContain('하치와레: “그 말은 "고쳐 볼게"라는 거?” (치이카와의 말 풀이)')
  expect(mending).toContain('🐱 하치와레 (지휘) ● 같이 하는 중 · Bash · npm test')
  // One does not say it again at every tool.
  expect(mending.match(/우사기: /g)).toHaveLength(1)

  // The hand is taken back once the work has stopped.
  await clock.advance(16_000)

  const after = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(after).toContain('🐱 하치와레 (지휘) ○ 대기')
  expect(after).toContain('🐰 우사기 (탐색) ○ 대기')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

/** A wait a test holds until it lets it go. */
const gate = (): { held: Promise<void>; open: () => void } => {
  const box = { open: (): void => undefined }
  const held = new Promise<void>(resolve => {
    box.open = resolve
  })

  return { held, open: () => box.open() }
}

// The runtime's timer, which the plugin's types leave out as a plugin is given `$.clock` in its place.
declare const setTimeout: (run: () => void, ms: number) => unknown

/** Lets what is under way run as far as it can before the test goes on. */
const breathe = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10))

const TYPED = { text: '안녕', wait: false, origin: { kind: 'composer' } } as const
const SPEC = '/w/a/find.spec.md'
const META = '/w/a/find.out.md.meta.json'
const PASSED = JSON.stringify({ exit_code: 0, model: 'gpt-6-luna', seconds: 43, usage: { input_tokens: 1000, cached_input_tokens: 0, output_tokens: 10 } })
const HANDED = 'orca terminal create --title "scout" --command "fleet-run codex-scout --cwd /w --spec /w/a/find.spec.md --out /w/a/find.out.md" --json'

/**
 * The files a test holds, each with when it was written, and what the mode
 * wrote among them. `under` is what a test has happen beneath the mode: a
 * wait before a file is looked at, something done once one was written.
 */
const disk = (
  on: On,
  clock: { now: () => number },
  given: Record<string, string>,
  under: { looking?: () => Promise<void> | undefined; wrote?: (path: string) => void } = {},
): { files: Map<string, string>; written: string[]; put: (path: string, text: string, at?: number) => void } => {
  const files = new Map(Object.entries(given))
  const times = new Map(Object.keys(given).map(path => [path, clock.now()]))
  const written: string[] = []
  const put = (path: string, text: string, at = clock.now()): void => {
    files.set(path, text)
    times.set(path, at)
  }

  mock.env(on, { HOME: '/home/me' })
  on('fs.read', ($, e) => {
    const text = files.get(e.path)

    if (text === undefined) throw new Error('ENOENT')

    return { value: text }
  })
  on('fs.write', ($, e) => {
    written.push(e.path)
    put(e.path, e.text)
    under.wrote?.(e.path)

    return { value: undefined }
  })
  on('fs.stat', async ($, e) => {
    await under.looking?.()
    if (!files.has(e.path)) throw new Error('ENOENT')

    return { value: { kind: 'file' as const, size: 1, mtimeMs: times.get(e.path) ?? 0, isLink: false } }
  })

  return { files, written, put }
}

/** What a session needs beneath it; answers the toasts raised. */
const session = (on: On): string[] => {
  const toasts: string[] = []

  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: [] }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  return toasts
}

test('a spec copy never writes over a file that is there: the same text is used again, and another is passed by', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  // A copy made before, which the person has since edited.
  const mine = `# 작업지시\n내가 고쳐 둔 사본.${memberBlock('ko', 'usagi', '탐색')}`
  const { files, written, put } = disk(on, clock, { [SPEC]: '# 작업지시\n설정 파일을 찾는다.', '/w/a/find.spec.chiikawa-usagi.md': mine })
  const ran: string[] = []

  session(on)
  on('tool.call', ($, e) => {
    if (e.tool === 'Bash') ran.push(e.command)

    return { result: { stdout: '', stderr: '' } }
  })

  const launch = (): ReturnType<typeof $.tool.call> => $.tool.call({ tool: 'Bash', command: `fleet-run codex-scout --cwd /w --spec ${SPEC} --out /w/a/find.out.md` })

  // The place is taken by something else: the copy goes to the next one, and what was there stays.
  await launch()
  expect(ran[0]).toContain('--spec /w/a/find.spec.chiikawa-usagi-2.md --out')
  expect(files.get('/w/a/find.spec.chiikawa-usagi.md')).toBe(mine)
  expect(files.get('/w/a/find.spec.chiikawa-usagi-2.md')).toContain('너는 지휘자 하치와레가 아니라 우사기다')
  expect(written).toEqual(['/w/a/find.spec.chiikawa-usagi-2.md'])

  // The same spec again: the copy that is there is this very text, and is used as it is.
  await launch()
  expect(ran[1]).toContain('--spec /w/a/find.spec.chiikawa-usagi-2.md --out')
  expect(written).toHaveLength(1)

  // The spec was rewritten: the copy of the old text is not written over either.
  const old = files.get('/w/a/find.spec.chiikawa-usagi-2.md')

  put(SPEC, '# 작업지시\n설정 파일과 그 테스트를 찾는다.')
  await launch()
  expect(ran[2]).toContain('--spec /w/a/find.spec.chiikawa-usagi-3.md --out')
  expect(files.get('/w/a/find.spec.chiikawa-usagi-2.md')).toBe(old)
  expect(files.get('/w/a/find.spec.chiikawa-usagi-3.md')).toContain('설정 파일과 그 테스트를 찾는다.')

  // Every place taken: the launch runs on the spec as it was written, and nothing is written.
  for (const turn of [4, 5, 6, 7, 8, 9]) put(`/w/a/find.spec.chiikawa-usagi-${turn}.md`, mine)
  put(SPEC, '# 작업지시\n다른 일.')
  const before = new Map(files)
  const answer = await launch()

  expect(ran[3]).toBe(`fleet-run codex-scout --cwd /w --spec ${SPEC} --out /w/a/find.out.md`)
  expect(files).toEqual(before)
  expect(answer.context?.join('\n')).toContain('작업은 우사기(탐색)가 맡았다.')
  expect(answer.context?.join('\n')).not.toContain('사본')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('a command that only tells of a fleet-run is run as it is and makes no task, and one run with a variable gets the copy of what the shell fills in', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { files } = disk(on, clock, { [SPEC]: '# 찾기', '/w/a/other.spec.md': '# 다른 일' })
  const ran: string[] = []

  session(on)
  on('tool.call', ($, e) => {
    if (e.tool === 'Bash') ran.push(e.command)

    return { result: { stdout: '', stderr: '' } }
  })

  for (const command of [
    `echo --command "fleet-run codex-scout --spec ${SPEC} --out /w/a/find.out.md"`,
    `# fleet-run codex-scout --spec ${SPEC} --out /w/a/find.out.md\nls /w`,
    `cat > /w/go.sh <<EOF\nfleet-run codex-scout --spec ${SPEC} --out /w/a/find.out.md\nEOF`,
  ]) {
    const answer = await $.tool.call({ tool: 'Bash', command })

    expect(ran.at(-1)).toBe(command)
    expect(answer.context).toBeUndefined()
  }
  expect([...files.keys()]).toEqual([SPEC, '/w/a/other.spec.md'])
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🐰 우사기 (탐색) ○ 대기')

  // What is assigned before the command is not what its own argument is filled in with.
  await $.tool.call({ tool: 'Bash', command: `X=${SPEC}; X=/w/a/other.spec.md fleet-run codex-scout --spec "$X" --out /w/a/find.out.md` })
  expect(ran.at(-1)).toBe(`X=${SPEC}; X=/w/a/other.spec.md fleet-run codex-scout --spec "/w/a/find.spec.chiikawa-usagi.md" --out /w/a/find.out.md`)
  expect(files.get('/w/a/find.spec.chiikawa-usagi.md')).toContain('# 찾기')

  // Single quotes keep the `$`: the launch is a task, and its command is left as written.
  const kept = "X=/w/a/other.spec.md; fleet-run codex-scout --spec '$X' --out /w/a/find.out.md"

  await $.tool.call({ tool: 'Bash', command: kept })
  expect(ran.at(-1)).toBe(kept)
  expect([...files.keys()]).toHaveLength(3)
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('two tasks alike that started together are not guessed between: word that one ended waits for the task its id is given to', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const gates = [gate(), gate()]
  const listed = [
    { id: 'agent_a', description: '로그인 폼 구현', type: 'general-purpose', status: 'running' as const },
    { id: 'agent_b', description: '로그인 폼 구현', type: 'general-purpose', status: 'running' as const },
  ]

  session(on)
  on('agent.spawn', async ($, e) => {
    const turn = e.tool_use_id === 'toolu_1' ? 0 : 1

    await gates[turn]?.held

    return { model: 'claude-sonnet-5-5', agentId: turn === 0 ? 'agent_a' : 'agent_b' }
  })
  on('agent.list', () => ({ value: listed }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.session.start(START)
  const first = $.agent.spawn(SPAWN)

  await breathe()
  const second = $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2' })

  await breathe()
  await clock.advance(4000)

  // The second one's turn ends before either spawn has answered which agent is whose.
  await $.turn.complete({ ...DONE, answer: '끝냈습니다.', agentId: 'agent_b', reason: 'answer' })

  const during = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(during.match(/● 작업 중/g)).toHaveLength(2)
  expect(during).not.toContain('✓ 끝')

  gates[0]?.open()
  await first
  gates[1]?.open()
  await second

  const after = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(after).toContain('🦁 시사 (구현) ● 작업 중')
  expect(after).toContain('🦦 랏코 (구현) ✓ 끝')

  await $.turn.complete({ ...DONE, answer: '끝냈습니다.', agentId: 'agent_a', reason: 'answer' })
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🦁 시사 (구현) ✓ 끝')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('an Orca launch that answered an error is a failure though it was handed on, until its result says otherwise', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { put } = disk(on, clock, { [SPEC]: '# 찾기' })

  session(on)
  on('tool.call', () => ({ isError: true as const, result: 'orca: 실행 중이 아님', text: 'orca: 실행 중이 아님' }))

  await $.session.start(START)
  await $.tool.call({ tool: 'Bash', command: HANDED })

  const failed = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(failed).toContain('🐰 우사기 (탐색) ✗ 실패')
  expect(failed).toContain('실행 명령이 오류로 끝남')

  // The launch had gone through after all, as when only what waited for it timed out: the result overrules the guess.
  await clock.advance(60_000)
  put(META, PASSED)
  await clock.advance(4000)
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🐰 우사기 (탐색) ✓ 끝')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('a result that lands as the wait for it runs out ends the worker, which is then not let go', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { put } = disk(on, clock, { [SPEC]: '# 찾기' })

  session(on)
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))

  await $.tool.call({ tool: 'Bash', command: HANDED })
  await clock.advance(7_201_000)
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🐰 우사기 (탐색) ● 작업 중')

  // Two hours on, the first beat there is, which would let it go, finds its result.
  put(META, PASSED)
  await $.session.start(START)
  await clock.advance(4000)

  const after = (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

  expect(after).toContain('🐰 우사기 (탐색) ✓ 끝')
  expect(after).not.toContain('내려놓음')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test("a result left at the same place by an earlier run is not the new worker's", KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { put } = disk(on, clock, { [SPEC]: '# 찾기' })

  // The run before this one ended half a second ago, at this very place.
  put(META, PASSED, 4500)
  put('/w/a/find.out.md', '지난번 결과', 4500)
  session(on)
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))

  await $.session.start(START)
  await $.tool.call({ tool: 'Bash', command: HANDED })
  await clock.advance(4000)
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🐰 우사기 (탐색) ● 작업 중')

  // Its own result is written later, and says how it went.
  await clock.advance(60_000)
  put(META, JSON.stringify({ exit_code: 1, model: 'gpt-6-luna', seconds: 60 }))
  await clock.advance(4000)
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🐰 우사기 (탐색) ✗ 실패')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('the roles kept are the last ones given, whatever order the saves end in', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const kept = new Map<string, unknown>()
  const slow = gate()
  const saves: unknown[] = []

  session(on)
  on('store.get', ($, e) => ({ value: kept.get(e.key) }))
  on('store.set', async ($, e) => {
    saves.push(e.value)
    // The first save is slow to land.
    if (saves.length === 1) await slow.held
    kept.set(e.key, e.value)

    return { value: undefined }
  })

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, scroll: { offset: 0, bodyRows: 60 } } })

  await pane.press({ key: 'watch-pochette' })
  // One change by name and, while its save is under way, another on the sheet.
  const one = $.command.run({ command: 'chiikawa', args: 'role 랏코 검토', ...RUN })

  await breathe()
  const two = pane.press({ key: 'role-pochette-조사' })

  await breathe()
  slow.open()
  await one
  await two
  await pane.unmount()

  expect(kept.get('roles')).toEqual({ rakko: '검토', pochette: '조사' })
  expect(saves.at(-1)).toEqual({ rakko: '검토', pochette: '조사' })
  await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })
})

test('roles that cannot be saved or read hold for the session, and the person is told they were not kept', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const store = { isBroken: true, kept: {} as unknown }
  const told: (readonly string[] | undefined)[] = []
  const toasts = session(on)

  on('prompt.submit', ($, e) => {
    told.push(e.context)

    return { text: e.text }
  })
  on('store.get', () => {
    if (store.isBroken) throw new Error('EACCES')

    return { value: store.kept }
  })
  on('store.set', ($, e) => {
    if (store.isBroken) throw new Error('EACCES')
    store.kept = e.value

    return { value: undefined }
  })

  await $.session.start(START)
  await $.prompt.submit(TYPED)

  const changed = (await $.command.run({ command: 'chiikawa', args: 'role 랏코 검토', ...RUN })).text ?? ''

  expect(changed).toContain('🦦 랏코의 역할을 검토로 바꿨어요(원래 구현)')
  expect(changed).toContain('저장하지는 못해서 이번 세션에만 적용돼요.')
  expect(changed).not.toContain('다음 세션에도 그대로예요')

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, scroll: { offset: 0, bodyRows: 60 } } })

  await pane.press({ key: 'watch-pochette' })
  await pane.press({ key: 'role-pochette-조사' })
  await pane.press({ key: 'watch-close' })
  await pane.unmount()
  expect(toasts.at(-1)).toBe('👛 포쉐트 갑옷 씨의 역할을 조사로 바꿨어요. 저장하지는 못해서 이번 세션에만 적용돼요.')

  // A reload that cannot read what was kept leaves the roles as they are.
  await $.session.start(START)
  expect((await $.command.run({ command: 'chiikawa', args: 'role', ...RUN })).text).toContain('🦦 랏코 · 검토 (검토, 검증) ← 원래 구현')
  expect((await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })).text).toBe('친구들의 역할을 모두 원래대로 돌렸어요. 저장하지는 못해서 이번 세션에만 적용돼요.')
  await $.prompt.submit(TYPED)
  expect(told.at(-1)?.[0]).toContain('모두 원래대로 돌렸다')
  await $.prompt.submit(TYPED)
  expect(told.at(-1)).toBeUndefined()

  // A reload that reads other roles than the ones in use tells the main loop of them.
  store.isBroken = false
  store.kept = { kani: '검토' }
  await $.session.start(START)
  await $.prompt.submit(TYPED)
  expect(told.at(-1)?.[0]).toContain('[치이카와 역할] 사용자가 친구들의 역할을 바꿨다. 지금 바뀐 역할: 카니는 검토(검토, 검증).')
  // The same roles read again are no news.
  await $.session.start(START)
  await $.prompt.submit(TYPED)
  expect(told.at(-1)).toBeUndefined()
  expect((await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })).text).toBe('친구들의 역할을 모두 원래대로 돌렸어요.')
})

test('a role changed while a prompt is going in is told beside the next one', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const told: (readonly string[] | undefined)[] = []
  const slow = gate()
  const box = { isHolding: false }

  session(on)
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('prompt.submit', async ($, e) => {
    told.push(e.context)
    if (box.isHolding) {
      box.isHolding = false
      await slow.held
    }

    return { text: e.text }
  })

  await $.prompt.submit(TYPED)
  await $.command.run({ command: 'chiikawa', args: 'role 랏코 검토', ...RUN })
  box.isHolding = true
  const going = $.prompt.submit(TYPED)

  await breathe()
  await $.command.run({ command: 'chiikawa', args: 'role 포쉐트 조사', ...RUN })
  slow.open()
  await going
  await $.prompt.submit(TYPED)
  await $.prompt.submit(TYPED)

  // The prompt that was going in carried the first change only; the second is news still.
  expect(told[1]?.[0]).toContain('지금 바뀐 역할: 랏코는 검토(검토, 검증).')
  expect(told[2]?.[0]).toContain('포쉐트 갑옷 씨는 조사(')
  expect(told[2]?.[0]).toContain('전문 분야가 정해진 일')
  expect(told[3]).toBeUndefined()
  await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })
})

test('turned off while a call runs, the mode keeps its tasks in order and adds no word or toast to the result', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const waits = [gate(), gate()]
  const box = { calls: 0 }
  const toasts = session(on)

  disk(on, clock, { [SPEC]: '# 찾기' })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('tool.call', async () => {
    const wait = waits[box.calls]

    box.calls += 1
    await wait?.held

    return { result: { stdout: '', stderr: '' } }
  })

  const worker = $.tool.call({ tool: 'Bash', command: `fleet-run codex-scout --cwd /w --spec ${SPEC} --out /w/a/find.out.md` })

  await breathe()
  const agent = $.tool.call({ tool: 'Agent', tool_use_id: 'toolu_1', description: SPAWN.description, prompt: SPAWN.prompt, subagent_type: SPAWN.subagentType })

  await breathe()
  await $.agent.spawn(SPAWN)
  await $.command.run({ command: 'chiikawa', args: 'off', ...RUN })
  toasts.length = 0
  for (const wait of waits) wait.open()

  expect((await worker).context).toBeUndefined()
  expect((await agent).context).toBeUndefined()
  expect(toasts).toEqual([])

  // The worker's end was noted all the same: it is not left at work.
  await $.command.run({ command: 'chiikawa', args: 'on', ...RUN })
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🐰 우사기 (탐색) ✓ 끝')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('a task handed on with a block at its end gets the block of the one who has it now, once', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const seen: AgentSpawnInput[] = []

  on('agent.spawn', ($, e) => {
    seen.push(e)

    return { model: 'claude-sonnet-5-5', agentId: `agent_${seen.length}` }
  })

  await $.agent.spawn({ ...SPAWN, description: '랏코: 로그인 버그 토벌', prompt: `로그인 버그를 고쳐 줘.${memberBlock('ko', 'shisa', '구현')}` })
  expect(seen[0]?.prompt.split(MARK)).toHaveLength(2)
  expect(seen[0]?.prompt.startsWith('로그인 버그를 고쳐 줘.\n\n---\n')).toBe(true)
  expect(seen[0]?.prompt).toContain('너는 지휘자 하치와레가 아니라 랏코다')
  expect(seen[0]?.prompt).not.toContain('시사다')

  // The mark in the middle of what was asked is the person's own text: it stays, and the block is added.
  const asked = `"${MARK}" 표시가 붙은 줄을 모두 찾아 줘.`

  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', subagentType: 'Explore', description: '표시 찾기', prompt: asked })
  expect(seen[1]?.prompt.startsWith(`${asked}\n\n---\n${MARK}\n`)).toBe(true)
  expect(seen[1]?.prompt).toContain('너는 지휘자 하치와레가 아니라 우사기다')
})

test("what the friends were paid outlasts the records of their tasks, until all of it is cleared", KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const box = { spawned: 0 }

  session(on)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(box.spawned += 1)}` }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  // More tasks than the page keeps records of: the oldest records go, and what they cost stays counted.
  for (let turn = 1; turn <= 45; turn += 1) {
    await $.agent.spawn({ ...SPAWN, tool_use_id: `toolu_${turn}` })
    await $.turn.complete({ ...DONE, answer: '끝냈습니다.', agentId: `agent_${turn}`, reason: 'answer', usage: { input_tokens: 1000, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' } })
  }

  const usage = async (): Promise<string> => (await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })).text ?? ''

  expect(await usage()).toContain('친구별 보수 (토큰, 이번 세션 누적)')
  expect(await usage()).toContain('🦁 시사: 입력 4.5만 · 캐시 0 · 출력 450')

  const cleared = (await $.command.run({ command: 'chiikawa', args: 'clear', ...RUN })).text ?? ''

  expect(cleared).toContain('친구별 보수(누적 사용량)는 그대로예요')
  expect((await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text).toContain('🦁 시사 (구현) ○ 대기')
  expect(await usage()).toContain('🦁 시사: 입력 4.5만 · 캐시 0 · 출력 450')

  expect((await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })).text).toContain('친구별 보수(누적 사용량)를 지웠어요')
  expect(await usage()).not.toContain('시사')
})

test('a pane short of room draws no wider than its columns and no taller than its rows, whatever is on it', { ...KO, timeoutMs: 30_000 }, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const box = { spawned: 0 }

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(box.spawned += 1)}` }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))

  // Enough was said for the conversation to be turned back through three-figure lines.
  for (let turn = 1; turn <= 45; turn += 1) {
    await $.agent.spawn({ ...SPAWN, tool_use_id: `toolu_${turn}` })
    await $.turn.complete({ ...DONE, answer: '끝냈습니다.', agentId: `agent_${turn}`, reason: 'answer' })
  }

  const mount = (columns: number, rows: number): Promise<Mounted<'terminal', 'Pane'>> =>
    $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: columns, placement: 'inline', scroll: { offset: 0, bodyRows: rows } } })
  // Every size is drawn, and each that takes more than it was given is noted.
  const over = async (): Promise<string[]> => {
    const found: string[] = []

    for (const columns of [20, 26, 32, 38, 44, 49, 60, 100]) {
      for (const rows of [3, 4, 5, 6, 7, 8, 10, 12, 16, 30]) {
        const pane = await mount(columns, rows)
        const size = sizeOf((await pane.drawn()) as Drawn, columns)
        // A page of cuts, where there is room for one, scrolls in its pane: only its width is held to.
        const isList = columns < 50 || rows < 16

        if (size.width > columns || (isList && size.rows > rows)) found.push(`${columns}x${rows} drew ${size.width}x${size.rows}`)
        await pane.unmount()
      }
    }

    return found
  }

  // What the person presses in a roomy pane is what a narrow one then has to draw.
  const press = async (...keys: string[]): Promise<void> => {
    const pane = await mount(72, 30)

    for (const key of keys) await pane.press({ key })
    await pane.unmount()
  }

  expect(await over()).toEqual([])

  // Turned back on a page of cuts, the rule over the conversation is written out, with the ways back and on at its end.
  await press('talk-older', 'talk-older')
  const wide = await mount(72, 30)

  expect(textOf(rowWith((await wide.drawn()) as Drawn, 'talk-older'))).toMatch(/─ 지난 이야기 \d+~\d+\/1\d\d ─/)
  expect(await wide.find({ key: 'talk-older' })).toMatchObject({ props: { label: '▲ 이전' } })
  expect(await wide.find({ key: 'talk-newer' })).toMatchObject({ props: { label: '▼ 다음' } })
  await wide.unmount()
  expect(await over()).toEqual([])

  // The conversation alone in a narrow pane: the same rule holds its one line, written short.
  await press('talk-only')
  const alone = await mount(44, 12)
  const rule = rowWith((await alone.drawn()) as Drawn, 'talk-older')

  expect(sizeOf(rule, 44)).toEqual({ width: 44, rows: 1 })
  expect(textOf(rule)).toMatch(/─ \d+~\d+\/1\d\d ─/)
  expect(textOf(rule)).not.toContain('지난 이야기')
  expect(await alone.find({ key: 'talk-older' })).toMatchObject({ props: { label: '▲' } })
  expect(await alone.find({ key: 'talk-newer' })).toMatchObject({ props: { label: '▼' } })
  expect(await alone.find({ key: 'talk-only' })).toMatchObject({ props: { label: '전체 보기' } })
  expect(sizeOf((await alone.drawn()) as Drawn, 44).rows).toBeLessThanOrEqual(12)
  await alone.unmount()
  expect(await over()).toEqual([])
  await press('talk-only')

  // A worker's sheet, with its roles and its button: in six rows it is the sheet alone, cut to the rows there are.
  await press('watch-rakko')
  const sheet = await mount(44, 6)

  expect(sizeOf((await sheet.drawn()) as Drawn, 44)).toEqual({ width: 44, rows: 6 })
  expect(cells(String((await sheet.find({ key: 'pick-rakko' }))?.props.label))).toBeLessThanOrEqual(40)
  expect(await sheet.find({ key: 'watch-close' })).toBeDefined()
  await sheet.unmount()
  expect(await over()).toEqual([])

  // 하치와레's sheet has the longest button there is.
  await press('watch-hachiware')
  expect(await over()).toEqual([])
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

const USED = { input_tokens: 1000, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' } as const
const OTHER = '/w/a/other.spec.md'

/** What the mode answers with no argument: who is doing what, and the last of the conversation. */
const roster = async ($: Parameters<TestBody>[0]): Promise<string> => (await $.command.run({ command: 'chiikawa', args: '', ...RUN })).text ?? ''

/** The Bash commands a test's shell was handed, as the mode passed them on. */
const shell = (on: On): string[] => {
  const ran: string[] = []

  on('tool.call', ($, e) => {
    if (e.tool === 'Bash') ran.push(e.command)

    return { result: { stdout: '', stderr: '' } }
  })

  return ran
}

test("the copy of a spec takes the spec's own place in the command, past a redirection and in whatever letters the path is written", KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { files, written } = disk(on, clock, { '/w/작업/지시.md': '# 찾기', '/w/メモ/しじ.md': '# さがす', '/w/내 작업/지시 1.md': '# 찾기', '/w/log': 'kept' })
  const ran = shell(on)

  session(on)
  // What a redirection leads to is not the spec, though it stands where the spec's path would.
  await $.tool.call({ tool: 'Bash', command: 'fleet-run codex-scout --cwd /w --spec > /w/log /w/작업/지시.md --out /w/작업/결과.md 2>&1' })
  expect(ran.at(-1)).toBe('fleet-run codex-scout --cwd /w --spec > /w/log /w/작업/지시.chiikawa-usagi.md --out /w/작업/결과.md 2>&1')
  expect(files.get('/w/log')).toBe('kept')
  expect(files.get('/w/작업/지시.chiikawa-usagi.md')).toContain('너는 지휘자 하치와레가 아니라 우사기다')
  // A path in kana, in its quotes, and one with spaces that only its quotes hold together.
  await $.tool.call({ tool: 'Bash', command: 'fleet-run codex-scout --cwd /w --spec "/w/メモ/しじ.md" 2> /w/log' })
  expect(ran.at(-1)).toBe('fleet-run codex-scout --cwd /w --spec "/w/メモ/しじ.chiikawa-usagi.md" 2> /w/log')
  await $.tool.call({ tool: 'Bash', command: `fleet-run codex-scout --cwd /w --spec '/w/내 작업/지시 1.md' --out "/w/내 작업/결과.md"` })
  expect(ran.at(-1)).toBe(`fleet-run codex-scout --cwd /w --spec '/w/내 작업/지시 1.chiikawa-usagi.md' --out "/w/내 작업/결과.md"`)
  expect(written).toEqual(['/w/작업/지시.chiikawa-usagi.md', '/w/メモ/しじ.chiikawa-usagi.md', '/w/내 작업/지시 1.chiikawa-usagi.md'])

  // An ideographic space parts no word for the shell: the path it is in is not one to be sure of, and the command is left as written.
  for (const unsure of ['fleet-run codex-scout --cwd /w --spec /w/작업/지시.md　--out /w/작업/결과.md', 'fleet-run codex-scout --cwd /w --spec /w/내\\ 작업/지시\\ 1.md']) {
    const answer = await $.tool.call({ tool: 'Bash', command: unsure })

    expect(ran.at(-1)).toBe(unsure)
    expect(answer.context?.join('\n')).toContain('작업은 우사기(탐색)가 맡았다.')
    expect(answer.context?.join('\n')).not.toContain('사본')
  }
  expect(written).toHaveLength(3)
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test("a fleet-run in a function's body makes no task, and one whose variable may have been assigned over is run as written", KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { written } = disk(on, clock, { [SPEC]: '# 찾기', [OTHER]: '# 다른 일' })
  const ran = shell(on)

  session(on)
  for (const defined of [`go() { fleet-run codex-scout --cwd /w --spec ${SPEC} --out /w/a/find.out.md; }`, `function go {\n  fleet-run codex-scout --cwd /w --spec ${SPEC} --out /w/a/find.out.md\n}\ngo`]) {
    const answer = await $.tool.call({ tool: 'Bash', command: defined })

    expect(ran.at(-1)).toBe(defined)
    expect(answer.context).toBeUndefined()
  }
  expect(await roster($)).toContain('🐰 우사기 (탐색) ○ 대기')

  // What is assigned before `export` may be what the variable holds after it: the launch is a task, and its spec is not written over.
  const exported = `X=${SPEC}; X=${OTHER} export X; fleet-run codex-scout --cwd /w --spec "$X"`
  const answer = await $.tool.call({ tool: 'Bash', command: exported })

  expect(ran.at(-1)).toBe(exported)
  expect(answer.context?.join('\n')).toContain('작업은 우사기(탐색)가 맡았다.')
  expect(written).toEqual([])
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('of two launches in one command, the one handed to an Orca terminal is waited for by its result and the other ends with the command', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { put } = disk(on, clock, { [SPEC]: '# 찾기', [OTHER]: '# 다른 일' })

  shell(on)
  session(on)
  await $.session.start(START)
  await $.tool.call({ tool: 'Bash', command: `fleet-run codex-scout --cwd /w --spec ${SPEC}; orca terminal create --title b --command "fleet-run codex-build --cwd /w --spec ${OTHER} --out /w/a/other.out.md" --json` })

  const during = await roster($)

  expect(during).toContain('🐰 우사기 (탐색) ✓ 끝')
  expect(during).toContain('🦁 시사 (구현) ● 작업 중')
  put('/w/a/other.out.md.meta.json', PASSED)
  await clock.advance(4000)
  expect(await roster($)).toContain('🦁 시사 (구현) ✓ 끝')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('a launch whose paths an inner shell fills in is a task with its command left as written, and is said to have a result to look at by hand', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { written } = disk(on, clock, { [SPEC]: '# 찾기' })
  const ran = shell(on)
  const inner = `export X=${SPEC}; bash -c 'fleet-run codex-scout --cwd /w --spec "$X" --out "$X.out"'`

  session(on)
  await $.session.start(START)
  await $.tool.call({ tool: 'Bash', command: inner })
  expect(ran.at(-1)).toBe(inner)
  expect(written).toEqual([])

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /탐색 끝 · .*결과는 직접 확인/ })).toBeDefined()
  await pane.unmount()

  // Handed on, there is no result file to wait for: it waits, and says the path could not be read.
  await $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_bg', command: `export X=${SPEC}; nohup bash -c 'fleet-run codex-build --cwd /w --spec "$X" --out "$X.out"' &` })
  expect(await roster($)).toContain('🦁 시사 (구현) ◐ 기다리는 중')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('a result file one worker is waited for at does not end a second worker told to write there, and is counted once', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const { put } = disk(on, clock, { [SPEC]: '# 찾기', [OTHER]: '# 다른 일' })

  shell(on)
  session(on)
  await $.session.start(START)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_a', command: HANDED })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_b', command: `orca terminal create --title b --command "fleet-run codex-build --cwd /w --spec ${OTHER} --out /w/a/find.out.md" --json` })

  const during = await roster($)

  expect(during).toContain('🐰 우사기 (탐색) ● 작업 중')
  expect(during).toContain('🦁 시사 (구현) ◐ 기다리는 중')

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: 100 } })

  await pane.press({ key: 'watch-shisa' })
  expect(await pane.find({ type: 'Text', text: /다른 작업이 같은 결과 파일을 쓰고 있어서/ })).toBeDefined()
  await pane.press({ key: 'watch-close' })
  await pane.unmount()

  // The one result is the first worker's: it ends that one, and what it cost is counted for that one alone.
  await clock.advance(60_000)
  put(META, PASSED)
  await clock.advance(4000)

  const after = await roster($)
  const usage = (await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })).text ?? ''

  expect(after).toContain('🐰 우사기 (탐색) ✓ 끝')
  expect(after).toContain('🦁 시사 (구현) ◐ 기다리는 중')
  expect(usage).toContain(`🐰 우사기: ${spent('ko', { fresh: 1000, cached: 0, out: 10 })}`)
  expect(usage).not.toContain('시사')

  // With no result of its own to learn its end from, the second is let go as one that named none.
  await clock.advance(3_610_000)
  expect(await roster($)).toContain('시사의 other · 결과가 없어 내려놓음')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test("a spec that already ends in a character's block runs as it is, as that character's task; one with the mark alone is said to have no copy", KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const cast = `# 찾기${orcaBlock('ko', 'kani', '조사')}`
  const { written } = disk(on, clock, { [SPEC]: cast, [OTHER]: `# 다른 일${orcaBlock('ja', 'momonga', '검토')}`, '/w/a/odd.spec.md': `# 손으로 쓴 지시\n\n${MARK}\n보고는 짧게 한다.` })
  const ran = shell(on)
  const launch = (spec: string, call: string): ReturnType<typeof $.tool.call> =>
    $.tool.call({ tool: 'Bash', tool_use_id: call, command: `orca terminal create --title t --command "fleet-run codex-scout --cwd /w --spec ${spec}" --json` })

  session(on)
  await $.session.start(START)

  // The worker reads the block that is there and reports as 카니: the page shows the task as 카니's, not as the one the role would have picked.
  const first = await launch(SPEC, 'toolu_a')

  expect(ran.at(-1)).toContain(`--spec ${SPEC}"`)
  expect(first.context?.join('\n')).toContain('작업은 카니(탐색)가 맡았다.')
  expect(first.context?.join('\n')).not.toContain('사본')
  // A block in another language names its character all the same.
  expect((await launch(OTHER, 'toolu_b')).context?.join('\n')).toContain('작업은 모몽가(탐색)가 맡았다.')

  const during = await roster($)

  expect(during).toContain('🦀 카니 (조사) ◐ 기다리는 중')
  expect(during).toContain('모몽가 (검토) ◐ 기다리는 중')
  expect(during).toContain('🐰 우사기 (탐색) ○ 대기')

  // The mark with no block of the mode's own under it names nobody: the task goes to the one the role picks, and the main loop is told no copy was made.
  const odd = await launch('/w/a/odd.spec.md', 'toolu_c')

  expect(ran.at(-1)).toContain('--spec /w/a/odd.spec.md"')
  expect(odd.context?.join('\n')).toContain('작업은 우사기(탐색)가 맡았다. 작업지시에 이미 배역 표식이 있어서 말투 사본은 만들지 않았다.')
  expect(written).toEqual([])
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('turned off while a prompt is going in, the mode does not take the main loop as told for good: it is told to stop beside the next', KO, async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []
  const box: { held?: Promise<void> } = {}

  on('prompt.submit', async ($, e) => {
    seen.push(e.context)
    await box.held

    return { text: e.text }
  })

  // A prompt that is held on its way in until the test lets it go.
  const holding = async (): Promise<{ sent: Promise<unknown>; open: () => void }> => {
    const wait = gate()

    const before = seen.length

    box.held = wait.held
    const sent = $.prompt.submit(TYPED)

    while (seen.length === before) await breathe()
    delete box.held

    return { sent, open: wait.open }
  }

  // Whatever the tests before left it told, the main loop starts here told nothing.
  await $.command.run({ command: 'chiikawa', args: 'off', ...RUN })
  await $.prompt.submit(TYPED)
  await $.command.run({ command: 'chiikawa', args: 'on', ...RUN })
  seen.length = 0

  const first = await holding()

  expect(seen[0]?.[0]).toContain('너는 하치와레')
  await $.command.run({ command: 'chiikawa', args: 'off', ...RUN })
  first.open()
  await first.sent

  // The prompt that told it to conduct went in after all, and the mode is off: the next one takes that back, once.
  await $.prompt.submit(TYPED)
  await $.prompt.submit(TYPED)
  expect(seen[1]?.[0]).toContain('치이카와 모드가 꺼졌다')
  expect(seen[2]).toBeUndefined()

  // Turned off and on again while it goes in, the mode tells it once more, as things are now.
  await $.command.run({ command: 'chiikawa', args: 'on', ...RUN })
  const second = await holding()

  expect(seen[3]?.[0]).toContain('너는 하치와레')
  await $.command.run({ command: 'chiikawa', args: 'off', ...RUN })
  await $.command.run({ command: 'chiikawa', args: 'on', ...RUN })
  second.open()
  await second.sent
  await $.prompt.submit(TYPED)
  await $.prompt.submit(TYPED)
  expect(seen[4]?.[0]).toContain('너는 하치와레')
  expect(seen[5]).toBeUndefined()
})

test("with 하치와레's voice set off, a main loop that was told to conduct is told to stop all the same, once", { options: { ...KO.options, leaderVoice: false } }, async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []

  on('prompt.submit', ($, e) => {
    seen.push(e.context)

    return { text: e.text }
  })

  const box = { isTold: false }

  // What the mode keeps of having told the main loop, as it stands where the voice was on before the setting was changed.
  on('state.get', { plugin: 'chiikawa', key: 'brief' }, async ($, e, next) => {
    const held = await next(e)

    return box.isTold && held.value !== undefined ? { value: { ...held.value, value: { isAlive: true, isStale: false, doubts: 0 } } } : held
  })

  // Told nothing, it is told nothing: with the voice off there is nothing to take back.
  await $.prompt.submit(TYPED)
  expect(seen[0]).toBeUndefined()
  box.isTold = true
  await $.prompt.submit(TYPED)
  expect(seen[1]?.[0]).toContain('치이카와 모드가 꺼졌다')
  // The mode wrote that it has taken it back: what it keeps now says so by itself.
  box.isTold = false
  await $.prompt.submit(TYPED)
  expect(seen[2]).toBeUndefined()
})

test('every end that comes before its task is told its id is kept in order, and the same turn told twice is counted once', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const gates = [gate(), gate()]
  const listed = [
    { id: 'agent_a', description: '로그인 폼 구현', type: 'general-purpose', status: 'running' as const },
    { id: 'agent_b', description: '로그인 폼 구현', type: 'general-purpose', status: 'running' as const },
  ]

  session(on)
  on('agent.spawn', async ($, e) => {
    const turn = e.tool_use_id === 'toolu_1' ? 0 : 1

    await gates[turn]?.held

    return { model: 'claude-sonnet-5-5', agentId: turn === 0 ? 'agent_a' : 'agent_b' }
  })
  on('agent.list', () => ({ value: listed }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.session.start(START)
  const first = $.agent.spawn(SPAWN)

  await breathe()
  const second = $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2' })

  await breathe()
  await clock.advance(4000)

  // Two turns of the second one end before either spawn has answered, and word of the first of them comes twice.
  await $.turn.complete({ ...DONE, turnId: 'turn_1', answer: '절반을 고쳤습니다.', agentId: 'agent_b', reason: 'answer', usage: USED })
  await $.turn.complete({ ...DONE, turnId: 'turn_1', answer: '절반을 고쳤습니다.', agentId: 'agent_b', reason: 'answer', usage: USED })
  await $.turn.complete({ ...DONE, turnId: 'turn_2', answer: '나머지도 고쳤습니다.', agentId: 'agent_b', reason: 'answer', usage: { ...USED, input_tokens: 2000, output_tokens: 20 } })
  expect(await roster($)).not.toContain('✓ 끝')

  gates[0]?.open()
  await first
  gates[1]?.open()
  await second

  const usage = (await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })).text ?? ''

  expect(await roster($)).toContain('🦦 랏코 (구현) ✓ 끝')
  expect(usage).toContain(`🦦 랏코: ${spent('ko', { fresh: 3000, cached: 0, out: 30 })}`)
  expect(usage).not.toContain('시사')

  // What it handed back is what its last turn said.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  await pane.press({ key: 'watch-rakko' })
  expect(await pane.find({ type: 'Text', text: /^나머지도 고쳤습니다\.$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^절반을 고쳤습니다\.$/ })).toBeUndefined()
  await pane.press({ key: 'watch-close' })
  await pane.unmount()
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('an agent whose row tells of other work is not taken for the one task that waits, and a task no agent is ever told to be whose is let go after two hours', { ...KO, timeoutMs: 30_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })

  session(on)
  // The spawn answers no id: the task waits to be told whose it is.
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5' }))
  on('agent.list', () => ({ value: [{ id: 'agent_9', description: '문서 정리', type: 'general-purpose', status: 'completed' as const }] }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  // Another agent, started by something else, ends: its row is under another title, and the one task waiting is not its.
  await $.turn.complete({ ...DONE, answer: '문서를 정리했습니다.', agentId: 'agent_9', reason: 'answer', usage: USED })
  await clock.advance(8000)

  const during = await roster($)

  expect(during).toContain('🦁 시사 (구현) ● 작업 중')
  expect(during).not.toContain('✓ 끝')
  expect((await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })).text).not.toContain('시사')

  // An hour on it is still waited for; past two, with no agent ever told to be its, it is let go and said to be.
  await clock.advance(3_600_000)
  expect(await roster($)).toContain('🦁 시사 (구현) ● 작업 중')
  await clock.advance(3_610_000)

  const gone = await roster($)

  expect(gone).toContain('🦁 시사 (구현) ○ 대기')
  expect(gone).toContain('(시사의 로그인 폼 구현 · 끝을 알 수 없어 내려놓음)')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('turned off, the mode still ends the tasks it had taken, with what they handed back and cost, and says nothing; one started while it is off is no task', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const box = { spawned: 0 }
  const toasts = session(on)

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(box.spawned += 1)}` }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  await $.command.run({ command: 'chiikawa', args: 'off', ...RUN })
  toasts.length = 0

  const before = await roster($)

  await $.turn.complete({ ...DONE, answer: '로그인 폼을 고쳤습니다.', agentId: 'agent_1', reason: 'answer', usage: USED })
  // Started while the mode is off: it is nobody's task, and what it cost is nobody's.
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', description: '문서 조사' })
  await $.turn.complete({ ...DONE, turnId: 'turn_2', answer: '문서를 찾았습니다.', agentId: 'agent_2', reason: 'answer', usage: USED })
  expect(toasts).toEqual([])

  await $.command.run({ command: 'chiikawa', args: 'on', ...RUN })
  const after = await roster($)
  const usage = (await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })).text ?? ''

  expect(after).toContain('🦁 시사 (구현) ✓ 끝')
  expect(usage).toContain(`🦁 시사: ${spent('ko', { fresh: 1000, cached: 0, out: 10 })}`)
  expect(usage.match(/입력/g)).toHaveLength(1)
  // No line of the conversation was added while it was off.
  expect(after.split('\n').filter(line => line.includes('“')).length).toBe(before.split('\n').filter(line => line.includes('“')).length)

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  await pane.press({ key: 'watch-shisa' })
  expect(await pane.find({ type: 'Text', text: /^로그인 폼을 고쳤습니다\.$/ })).toBeDefined()
  await pane.press({ key: 'watch-close' })
  await pane.unmount()
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test("what a task really cost is still its character's when word of it comes after the record of a guessed end was cleared", KO, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })

  session(on)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('agent.list', () => ({ value: [{ id: 'agent_1', description: '🦁 시사 · 로그인 폼 구현', type: 'general-purpose', status: 'completed' as const }] }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  const usage = async (): Promise<string> => (await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })).text ?? ''

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  // The list says it is done, which is a guess; the person clears the page before the task's own turn says what it cost.
  await clock.advance(4000)
  expect(await roster($)).toContain('🦁 시사 (구현) ✓ 끝')
  await $.command.run({ command: 'chiikawa', args: 'clear', ...RUN })
  expect(await usage()).not.toContain('시사')

  await $.turn.complete({ ...DONE, answer: '끝냈습니다.', agentId: 'agent_1', reason: 'answer', usage: USED })
  expect(await usage()).toContain(`🦁 시사: ${spent('ko', { fresh: 1000, cached: 0, out: 10 })}`)
  // The record is not brought back by it.
  expect(await roster($)).toContain('🦁 시사 (구현) ○ 대기')

  // Cleared with the accounts, nothing is listened for any more.
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2' })
  await clock.advance(4000)
  await $.command.run({ command: 'chiikawa', args: 'clear', ...RUN })
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
  await $.turn.complete({ ...DONE, turnId: 'turn_2', answer: '끝냈습니다.', agentId: 'agent_1', reason: 'answer', usage: USED })
  expect(await usage()).not.toContain('시사')
})

test('a pane short of room still names or counts everyone with no card, draws an empty conversation in its rows, and keeps what a sheet has to press', { ...KO, timeoutMs: 30_000 }, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const box = { spawned: 0 }

  session(on)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(box.spawned += 1)}` }))
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })

  const mount = (columns: number, rows: number): Promise<Mounted<'terminal', 'Pane'>> =>
    $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: columns, placement: 'inline', scroll: { offset: 0, bodyRows: rows } } })
  const draw = async (columns: number, rows: number): Promise<Drawn> => {
    const pane = await mount(columns, rows)
    const drawn = (await pane.drawn()) as Drawn

    await pane.unmount()

    return drawn
  }
  const keysOf = (drawn: Drawn, pattern: RegExp): string[] => [...new Set(keyed(drawn, pattern).map(node => (node !== null && typeof node === 'object' ? String(node.props?.key) : '')))]
  const press = async (...keys: string[]): Promise<void> => {
    const pane = await mount(72, 30)

    for (const key of keys) await pane.press({ key })
    await pane.unmount()
  }

  // With nothing said yet, the conversation alone is 하치와레 waiting: a line of it where there are no rows for a cut.
  await press('talk-only')
  for (const [columns, rows] of [[20, 3], [20, 4], [44, 3], [44, 4], [44, 5], [49, 12]] as const) {
    const drawn = await draw(columns, rows)

    expect(`${columns}x${rows} ${JSON.stringify(sizeOf(drawn, columns))}`).toBe(`${columns}x${rows} ${JSON.stringify({ width: columns, rows: 3 })}`)
    expect(textOf(drawn)).toContain('하치와레')
    expect(keysOf(drawn, /^talk-only$/)).toHaveLength(1)
  }
  expect(keyed(await draw(72, 30), /^cut-/)).toHaveLength(1)
  await press('talk-only')

  // Four at work, and room for one card or two: the others at work and the ones resting share the row of names.
  for (const [turn, title] of ['랏코: 디버깅', '포쉐트: 설정 화면', '모몽가: 보안 검토', '카니: 문서 조사'].entries()) await $.agent.spawn({ ...SPAWN, tool_use_id: `toolu_${turn}`, description: title })

  const named = async (columns: number, rows: number): Promise<string[]> => {
    const drawn = await draw(columns, rows)
    const lines = keyed(drawn, /^names/)
    const counted = lines.flatMap(line => [...textOf(line).matchAll(/\+(\d+)/g)]).reduce((sum, found) => sum + Number(found[1]), 0)
    const size = sizeOf(drawn, columns)

    // Everyone is on a card, named in the row, or counted in it; and nothing is drawn past the room.
    expect(`${columns}x${rows}: ${keysOf(drawn, /^watch-(?!close)/).length + counted} of 10 in ${size.width}x${size.rows}`).toBe(`${columns}x${rows}: 10 of 10 in ${columns}x${Math.min(rows, size.rows)}`)
    for (const line of lines) expect(sizeOf(line, columns)).toEqual({ width: columns, rows: 1 })

    return lines.map(line => [...written(line)].join(''))
  }

  // Both labels and a count for each have their room before any name does.
  expect(await named(26, 4)).toEqual(['일하는 중 +4  쉬는 중 +5'])
  expect(await named(32, 4)).toEqual(['일하는 중 랏코 +3  쉬는 중 +5'])
  expect(await named(44, 4)).toEqual(['일하는 중 랏코 · 카니 +2  쉬는 중 +5'])
  // With no room for both labels, the ones at work have the row, and the ones resting are counted with the rest of them.
  expect(await named(20, 4)).toEqual(['일하는 중 랏코 +8'])
  // A row to spare under the cards gives each group its own row.
  expect(await named(20, 7)).toEqual(['일하는 중 랏코 +3', '쉬는 중 치이카와 +4'])
  expect(await named(26, 9)).toHaveLength(2)
  for (const [columns, rows] of [[20, 5], [20, 6], [26, 6], [26, 8], [38, 5], [49, 7], [49, 10]] as const) await named(columns, rows)

  // A worker's sheet short of rows: what it tells goes before what can be pressed, the roles are cut short or put in two rows before they are left out, and the way to close it is the last to go.
  await press('watch-rakko')
  const ROLES = ['role-rakko-구현', 'role-rakko-검토', 'role-rakko-조사', 'role-rakko-탐색']
  const sheet = async (columns: number, rows: number): Promise<{ keys: string[]; labels: string[]; roleRows: number }> => {
    const drawn = await draw(columns, rows)
    const size = sizeOf(drawn, columns)

    expect(`${columns}x${rows} drew ${size.width}x${size.rows}`).toBe(`${columns}x${rows} drew ${columns}x${Math.min(rows, size.rows)}`)

    return { keys: keysOf(drawn, /^(?:role-|pick-|watch-close$)/), labels: keyed(drawn, /^role-/).flatMap(written), roleRows: keyed(drawn, /^roles-/).length }
  }

  for (const [columns, rows] of [[44, 5], [44, 6], [26, 5], [26, 6], [20, 5], [20, 6], [20, 7], [49, 5]] as const) {
    expect(`${columns}x${rows} ${(await sheet(columns, rows)).keys.sort().join()}`).toBe(`${columns}x${rows} ${['pick-rakko', ...ROLES, 'watch-close'].sort().join()}`)
  }
  expect(await sheet(44, 5)).toMatchObject({ labels: ['▶구현', '▷검토', '▷조사', '▷탐색'], roleRows: 1 })
  // Twenty columns hold two roles to a row: two rows where there are the rows, and one of names cut short where there are not.
  expect(await sheet(20, 6)).toMatchObject({ labels: ['▶구현', '▷검토', '▷조사', '▷탐색'], roleRows: 2 })
  expect(await sheet(20, 5)).toMatchObject({ labels: ['▶구', '▷검', '▷조', '▷탐'], roleRows: 1 })
  // Four rows hold the head and one button, three the head alone.
  expect((await sheet(44, 4)).keys.sort()).toEqual(['pick-rakko', 'watch-close'])
  expect((await sheet(20, 4)).keys.sort()).toEqual(['pick-rakko', 'watch-close'])
  expect((await sheet(44, 3)).keys).toEqual(['watch-close'])
  expect((await sheet(20, 3)).keys).toEqual(['watch-close'])
  await press('watch-close')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})


test('after a /clear the first press reads what is kept before it changes anything: a role given then is saved beside the ones kept', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const kept = new Map<string, unknown>([['roles', { kani: '구현' }]])
  const toasts = session(on)

  on('store.get', ($, e) => ({ value: kept.get(e.key) }))
  on('store.set', ($, e) => {
    kept.set(e.key, e.value)

    return { value: undefined }
  })

  // No session.start: the session holds nothing of what is kept, as after a `/clear`, and a drawing reads none of it in.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, scroll: { offset: 0, bodyRows: 60 } } })

  await pane.press({ key: 'watch-rakko' })
  await pane.press({ key: 'role-rakko-검토' })
  await breathe()
  // The role another character was given in an earlier session is kept beside the one pressed now.
  expect(kept.get('roles')).toEqual({ kani: '구현', rakko: '검토' })
  expect(toasts.at(-1)).toBe('🦦 랏코의 역할을 검토로 바꿨어요.')
  expect((await $.command.run({ command: 'chiikawa', args: 'role', ...RUN })).text).toContain('🦀 카니 · 구현')
  await pane.press({ key: 'watch-close' })
  await pane.unmount()
  await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })
})

test('roles that were never read into the session are not saved over what is kept: a change holds for the session, and is said to', KO, async ($, on) => {
  mock.clock(on, { now: 1000 })
  const saves: unknown[] = []
  const toasts = session(on)

  // What is kept cannot be read, though it could be written.
  on('store.get', () => {
    throw new Error('EACCES')
  })
  on('store.set', ($, e) => {
    saves.push(e.value)

    return { value: undefined }
  })

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, scroll: { offset: 0, bodyRows: 60 } } })

  await pane.press({ key: 'watch-rakko' })
  await pane.press({ key: 'role-rakko-검토' })
  await breathe()
  await pane.press({ key: 'watch-close' })
  await pane.unmount()
  expect(toasts.at(-1)).toBe('🦦 랏코의 역할을 검토로 바꿨어요. 저장하지는 못해서 이번 세션에만 적용돼요.')
  expect((await $.command.run({ command: 'chiikawa', args: 'role 시사 조사', ...RUN })).text).toContain('저장하지는 못해서 이번 세션에만 적용돼요.')
  expect((await $.command.run({ command: 'chiikawa', args: 'role', ...RUN })).text).toContain('🦦 랏코 · 검토')
  expect(saves).toEqual([])
  await $.command.run({ command: 'chiikawa', args: 'role reset', ...RUN })
})

test("an agent whose row only ends as a waiting task's title does is not that task's; the row under the name the spawn hook gave it is", { ...KO, timeoutMs: 30_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const rows = [{ id: 'agent_9', description: '무관한 로그인 폼 구현', type: 'general-purpose', status: 'completed' as const }]

  session(on)
  // The spawn answers no id: the task waits to be told whose it is.
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5' }))
  on('agent.list', () => ({ value: rows }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.session.start(START)
  await $.agent.spawn(SPAWN)
  // Another agent ends, whose title only ends in the waiting task's: by its turn's end and by the beat alike, the task is not its.
  await $.turn.complete({ ...DONE, answer: '다른 일을 끝냈습니다.', agentId: 'agent_9', reason: 'answer', usage: USED })
  await clock.advance(8000)

  const during = await roster($)

  expect(during).toContain('🦁 시사 (구현) ● 작업 중')
  expect(during).not.toContain('✓ 끝')
  expect((await $.command.run({ command: 'chiikawa', args: 'usage', ...RUN })).text).not.toContain('시사')

  // Its own row, under the name the spawn hook gave it, ends it.
  rows.push({ id: 'agent_1', description: '🦁 시사 · 로그인 폼 구현', type: 'general-purpose', status: 'completed' as const })
  await clock.advance(8000)
  expect(await roster($)).toContain('🦁 시사 (구현) ✓ 끝')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('of two workers taken at the same moment and told to write one result file, one alone is waited for at it', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  const wait = gate()
  const box: { held?: Promise<void> } = { held: wait.held }

  // Both launches are held where each looks for a result left by an earlier run, and let go together.
  disk(on, clock, { [SPEC]: '# 찾기', [OTHER]: '# 다른 일' }, { looking: () => box.held })
  shell(on)
  session(on)
  await $.session.start(START)

  const one = $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_a', command: HANDED })
  const two = $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_b', command: `orca terminal create --title b --command "fleet-run codex-build --cwd /w --spec ${OTHER} --out /w/a/find.out.md" --json` })

  await breathe()
  delete box.held
  wait.open()
  await one
  await two

  const during = await roster($)

  expect(during.match(/● 작업 중/g)).toHaveLength(1)
  expect(during.match(/◐ 기다리는 중/g)).toHaveLength(1)

  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: 100 } })

  await pane.press({ key: 'watch-shisa' })
  expect(await pane.find({ type: 'Text', text: /다른 작업이 같은 결과 파일을 쓰고 있어서/ })).toBeDefined()
  await pane.press({ key: 'watch-close' })
  await pane.unmount()
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})

test('a spec copy that does not read back as it was written is not used: the launch runs on the spec as it was written', KO, async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  // Something else puts its own file at the copy's place as the copy is written there.
  const { files } = disk(on, clock, { [SPEC]: '# 작업지시\n설정 파일을 찾는다.' }, { wrote: path => files.set(path, '# 남의 파일') })
  const ran = shell(on)
  const command = `fleet-run codex-scout --cwd /w --spec ${SPEC} --out /w/a/find.out.md`

  session(on)

  const answer = await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual([command])
  expect(files.get('/w/a/find.spec.chiikawa-usagi.md')).toBe('# 남의 파일')
  expect(answer.context?.join('\n')).toContain('작업은 우사기(탐색)가 맡았다.')
  expect(answer.context?.join('\n')).not.toContain('사본')
  await $.command.run({ command: 'chiikawa', args: 'clear all', ...RUN })
})
