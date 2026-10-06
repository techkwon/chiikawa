import type { AgentSpawnInput, On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Mounted, TestBody } from 'claude-code/testing'

import { ORDER, WORK_ROLES } from '../hooks/cast'
import { cells } from '../hooks/view'
import { MARKS, memberBlock } from '../hooks/voice'
import { LANGS } from '../hooks/words'

import type { Drawn } from './drawn'
import { keyed, rowWith, sizeOf, textOf, written } from './drawn'

type Engine = Parameters<TestBody>[0]

const SPAWN: AgentSpawnInput = {
  tool_use_id: 'toolu_1',
  prompt: 'Fix the login form.',
  description: 'the login form',
  subagentType: 'general-purpose',
  provider: { plugin: 'core', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
}
const BAND = { hasSurvey: false, isWorking: true, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const PANE = { title: 'Chiikawa', isFocused: false, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} } as const
const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const DONE = { durationMs: 1000, isAborted: false, turnId: 'turn_1' } as const
const FACTS = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: ['Agent'], outputStyle: null, traits: [] } as const

/** The mode's own setting left to the person and their machine, which is what the language is settled from. */
const AUTO = { options: { language: 'auto' } } as const

/**
 * What a session rests on, each part the test's to change: what the store
 * keeps and whether it can be reached, written to, or is slow to answer for
 * one key, the environment, and the language Claude Code itself is set to.
 * Answers those and the clock, with what the mode did: the keys it read from the store,
 * the command as it was registered each time, what went beside each prompt,
 * what it asked to be drawn again, and the toasts it raised.
 */
const world = (
  on: On,
): {
  kept: Map<string, unknown>
  env: Record<string, string>
  set: { language?: string; isStoreBroken: boolean; isStoreClosed: boolean; slow?: { key: string; held: Promise<void> } }
  clock: ReturnType<typeof mock.clock>
  reads: string[]
  registered: { description: string; argumentHint?: string }[]
  told: (readonly string[] | undefined)[]
  invalidated: string[]
  toasts: string[]
} => {
  const kept = new Map<string, unknown>()
  const env: Record<string, string> = {}
  const set: { language?: string; isStoreBroken: boolean; isStoreClosed: boolean; slow?: { key: string; held: Promise<void> } } = { isStoreBroken: false, isStoreClosed: false }
  const reads: string[] = []
  const registered: { description: string; argumentHint?: string }[] = []
  const told: (readonly string[] | undefined)[] = []
  const invalidated: string[] = []
  const toasts: string[] = []

  const clock = mock.clock(on, { now: 1000 })

  on('store.get', async ($, e) => {
    if (set.isStoreBroken) throw new Error('EACCES')
    // What is kept is answered as it was when it was asked for, however long the answer takes.
    const value = kept.get(e.key)

    reads.push(e.key)
    if (set.slow?.key === e.key) await set.slow.held

    return { value }
  })
  on('store.set', ($, e) => {
    if (set.isStoreBroken || set.isStoreClosed) throw new Error('EACCES')
    kept.set(e.key, e.value)

    return { value: undefined }
  })
  on('env.get', ($, e) => ({ value: env[e.name] }))
  on('config.list', () => ({
    value: set.language === undefined ? [] : [{ key: 'language', label: 'Language', kind: 'choice' as const, value: set.language, provider: { plugin: 'engine', tier: 'core' as const }, isLocked: false }],
  }))
  on('command.register', ($, e) => {
    registered.push({ description: e.description, ...(e.argumentHint === undefined ? {} : { argumentHint: e.argumentHint }) })

    return { value: { command: e.name } }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.invalidate', ($, e) => {
    invalidated.push(e.event)

    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    told.push(e.context)

    return { text: e.text }
  })

  return { kept, env, set, clock, reads, registered, told, invalidated, toasts }
}

const run = async ($: Engine, args: string): Promise<string> => (await $.command.run({ command: 'chiikawa', args, ...RUN })).text ?? ''

const enter = ($: Engine, text: string, kind: 'composer' | 'bridge' | 'sdk' | 'task-notification' = 'composer'): Promise<unknown> => $.prompt.submit({ text, wait: false, origin: { kind } })

/** The language the screen is in, by the mode's name and state in the pane's first row. */
const screen = async ($: Engine): Promise<string> => {
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })
  const [title = ''] = written((await pane.drawn()) as Drawn)

  await pane.unmount()

  return title.trim().replace(/\s+/g, ' ')
}

const RESTING = { en: 'Chiikawa Resting', ko: '먼작귀 쉬는 중', ja: 'ちいかわ 休憩中' } as const

test('with nothing else to go by the language is English; the environment, Claude Code, the letters typed and the choice made each come before the one after', AUTO, async ($, on) => {
  const { kept, env, set, registered } = world(on)

  // 5. Nothing says anything: English.
  await $.session.start(START)
  expect(await screen($)).toBe(RESTING.en)
  expect(await run($, 'lang')).toBe('The language is English. Nothing else settled it, so it is the default.\nChange: /chiikawa lang <en|ko|ja> · Back to automatic: /chiikawa lang auto')
  expect(registered.at(-1)?.description).toContain('Chiikawa mode')
  expect(registered.at(-1)?.argumentHint).toContain('lang [auto|en|ko|ja]')

  // 4. The environment: the first of the three that is set, in their order.
  env.LANG = 'ja_JP.UTF-8'
  expect(await run($, 'lang')).toContain('いまの言語は日本語です。環境変数（LC_ALL, LC_MESSAGES, LANG）に合わせました。')
  expect(await screen($)).toBe(RESTING.ja)
  // The command says what it takes in the new language from then on.
  expect(registered.at(-1)?.description).toContain('ちいかわモード')
  env.LC_MESSAGES = 'ko_KR.UTF-8'
  expect(await run($, 'lang')).toContain('지금 언어는 한국어예요. 환경 변수(LC_ALL, LC_MESSAGES, LANG)를 따랐어요.')
  env.LC_ALL = 'ja_JP.UTF-8'
  expect(await run($, 'lang')).toContain('いまの言語は日本語です。')
  env.LC_ALL = 'en_US.UTF-8'
  expect(await run($, 'lang')).toContain('The language is English. It follows the environment (LC_ALL, LC_MESSAGES, LANG).')
  env.LC_ALL = 'C'
  expect(await run($, 'lang')).toContain('The language is English. Nothing else settled it')
  env.LC_ALL = 'ko_KR.UTF-8'
  expect(await screen($)).toBe(RESTING.en)
  expect(await run($, 'lang')).toContain('지금 언어는 한국어예요.')

  // 3. Claude Code's own language, where it is one of the three: English there is English, whatever the environment says. Any other leaves it to the environment.
  set.language = '日本語'
  expect(await run($, 'lang')).toContain('いまの言語は日本語です。Claude Code の言語設定に合わせました。')
  for (const english of ['english', 'English (US)', 'en', 'en-GB', 'en_US']) {
    set.language = english
    expect(await run($, 'lang')).toContain("The language is English. It follows Claude Code's language setting.")
  }
  expect(await screen($)).toBe(RESTING.en)
  for (const other of ['français', 'entish', 'de']) {
    set.language = other
    expect(await run($, 'lang')).toContain('지금 언어는 한국어예요. 환경 변수')
  }
  set.language = 'japanese'

  // 2. The letters of a prompt the person types.
  await enter($, '로그인 버그를 고쳐 줘')
  expect(await run($, 'lang')).toContain('지금 언어는 한국어예요. 입력한 프롬프트의 글자를 보고 정했어요.')
  expect(kept.get('lang')).toEqual({ typed: 'ko' })

  // 1. The language the person chose.
  expect(await run($, 'lang en')).toBe('The language is now English. This holds in later sessions too.')
  expect(kept.get('lang')).toEqual({ typed: 'ko', chosen: 'en' })
  expect(await screen($)).toBe(RESTING.en)
  await enter($, 'こんにちは')
  expect(await run($, 'lang')).toContain('The language is English. You chose it with /chiikawa lang.')
  expect(await run($, 'language 日本語')).toBe('言語を日本語にしました。次のセッションでもそのままです。')
  expect(await run($, '언어 한국어')).toBe('언어를 한국어로 정했어요. 다음 세션에도 그대로예요.')
  expect(await run($, '言語 英語')).toContain('The language is now English.')

  // Taken back, the choice goes and so does what was noted from the letters typed: the language is settled by what comes after them, and the answer says so.
  expect(await run($, 'lang auto')).toBe(
    '言語を自動で決めるようにしました。選んだ言語と、入力した文字から覚えた言語はどちらも消しました。次に入力する文字からもう一度見ます。\nいまの言語は日本語です。Claude Code の言語設定に合わせました。',
  )
  expect(kept.get('lang')).toEqual({})
  expect(await screen($)).toBe(RESTING.ja)
  set.language = undefined
  expect(await run($, 'lang')).toContain('지금 언어는 한국어예요. 환경 변수')
  env.LC_ALL = 'C'
  expect(await run($, 'lang auto')).toBe(
    'The language is settled automatically again. Both the language you chose and the one noted from the letters you typed are forgotten, and the letters are read afresh from the next prompt you type.\nThe language is English. Nothing else settled it, so it is the default.',
  )
  // The letters are read again from the next prompt typed.
  await enter($, 'こんにちは')
  expect(kept.get('lang')).toEqual({ typed: 'ja' })
  expect(await screen($)).toBe(RESTING.ja)

  // What is no language is told so, and changes nothing.
  expect(await run($, 'lang fr')).toBe('わからない言語です。/chiikawa lang [auto|en|ko|ja] のどれかを使ってください。')
  expect(await run($, 'lang ko ja')).toContain('わからない言語です。')
  expect(kept.get('lang')).toEqual({ typed: 'ja' })
})

test('only a prompt the person typed tells the language, by its Hangul or its kana, and a prompt with neither changes nothing', AUTO, async ($, on) => {
  const { kept, set } = world(on)

  kept.set('lang', {})
  set.language = undefined
  await $.session.start(START)
  expect(await screen($)).toBe(RESTING.en)

  const after = async (text: string, kind?: 'composer' | 'bridge' | 'sdk' | 'task-notification'): Promise<string> => {
    await enter($, text, kind)

    return screen($)
  }

  // What was not typed by the person is not theirs to be read by.
  expect(await after('<task-notification>끝났습니다</task-notification>', 'task-notification')).toBe(RESTING.en)
  expect(await after('안녕, 로그인 폼을 고쳐 줘')).toBe(RESTING.ko)
  // A Korean reader's command in English does not turn the screen back to English, and Han characters alone say nothing.
  expect(await after('fix the login bug')).toBe(RESTING.ko)
  expect(await after('確認')).toBe(RESTING.ko)
  expect(await after('ログインのバグを直して', 'bridge')).toBe(RESTING.ja)
  expect(await after('run the tests', 'sdk')).toBe(RESTING.ja)
  // Both in one prompt: the one there is more of, and no change where they are even.
  expect(await after('ちいかわ를 한국어로 설명해 줘')).toBe(RESTING.ko)
  expect(await after('가나 かな')).toBe(RESTING.ko)
  // A slash command and what follows it, and a long text pasted after two thousand characters, are not read.
  expect(await after('/review こんにちは')).toBe(RESTING.ko)
  expect(await after(`${'a'.repeat(2000)}こんにちは`)).toBe(RESTING.ko)
  expect(await after(`${'a'.repeat(100)}こんにちは`)).toBe(RESTING.ja)
  expect(kept.get('lang')).toEqual({ typed: 'ja' })
  await run($, 'clear all')
})

test('letters that turn the screen to another language are told of once, in that language, with the way back; one letter of a language turns nothing', AUTO, async ($, on) => {
  const { kept, toasts } = world(on)

  kept.set('lang', {})
  await $.session.start(START)
  await run($, 'on')
  toasts.length = 0

  // One letter quoted in a prompt in another language is not the language the person writes in.
  await enter($, 'rename the 가 key to ga')
  await enter($, 'what does の mean here?')
  expect(await screen($)).toBe(RESTING.en)
  expect(kept.get('lang')).toEqual({})
  expect(toasts).toEqual([])

  // Two are: the screen turns, and the person is told which language it is now and how to go back.
  await enter($, '안녕')
  expect(await screen($)).toBe(RESTING.ko)
  expect(toasts).toEqual(['입력한 글자를 보고 언어를 한국어로 바꿨어요. 되돌리려면 /chiikawa lang en'])
  // Told once: more of the same language says nothing new.
  await enter($, '로그인 버그를 고쳐 줘')
  expect(toasts).toHaveLength(1)
  await enter($, 'ログインのバグを直して')
  expect(toasts.at(-1)).toBe('入力した文字から、言語を日本語に切り替えました。戻すには /chiikawa lang ko')
  expect(toasts).toHaveLength(2)

  // The way back it names is taken: no letters turn the screen after it, and nothing is said.
  await run($, 'lang ko')
  toasts.length = 0
  await enter($, 'こんにちは、元気ですか')
  expect(await screen($)).toBe(RESTING.ko)
  expect(toasts).toEqual([])

  // Left to the letters again, the screen is English until they tell another, which is told in its turn.
  await run($, 'lang auto')
  expect(await screen($)).toBe(RESTING.en)
  toasts.length = 0
  await enter($, 'こんにちは')
  expect(toasts).toEqual(['入力した文字から、言語を日本語に切り替えました。戻すには /chiikawa lang en'])

  // Turned off, the mode says nothing of the language it follows all the same.
  await run($, 'lang auto')
  await run($, 'off')
  toasts.length = 0
  await enter($, '안녕하세요')
  expect(toasts).toEqual([])
  expect(kept.get('lang')).toEqual({ typed: 'ko' })
  await run($, 'on')
  await run($, 'clear all')
})

test('the language typed or chosen in an earlier session is the language of the next from its first screen', AUTO, async ($, on) => {
  const { kept, env, registered, told } = world(on)

  // An earlier session's prompts were in Japanese; this machine's environment says Korean.
  kept.set('lang', { typed: 'ja' })
  env.LANG = 'ko_KR.UTF-8'
  await $.session.start(START)
  expect(registered.at(-1)?.description).toContain('ちいかわモード')
  expect(await screen($)).toBe(RESTING.ja)
  // A prompt with no letters of either leaves it so, and the main loop is told in Japanese.
  await enter($, 'hello')
  expect(told.at(-1)?.join('\n')).toContain('# ちいかわモード')

  // What was chosen comes before what was typed, and what is kept that is no language is passed by.
  kept.set('lang', { typed: 'ja', chosen: 'ko' })
  await $.session.start(START)
  expect(await screen($)).toBe(RESTING.ko)
  kept.set('lang', { typed: 'klingon', chosen: 7 })
  await $.session.start(START)
  expect(await screen($)).toBe(RESTING.ko)
  expect(await run($, 'lang')).toContain('환경 변수')
  await run($, 'clear all')
})

test('a session that began with no session.start, as one does after /clear, reads what is kept the first time the mode is used', AUTO, async ($, on) => {
  const { kept, registered } = world(on)

  kept.set('lang', { chosen: 'ja' })
  kept.set('roles', { kani: '구현' })
  // The first thing asked of the mode has it read what is kept, and answers in that language.
  expect(await run($, 'lang')).toContain('日本語')
  expect(registered.at(-1)?.description).toContain('ちいかわモード')
  expect(await screen($)).toBe(RESTING.ja)
  // The roles given in an earlier session are in force too: putting them back changes what the list says.
  const given = await run($, 'role')

  await run($, 'role reset')
  expect(await run($, 'role')).not.toBe(given)
  await run($, 'clear all')
})

test('a language that cannot be saved or read holds for the session, and the person is told it was not kept', AUTO, async ($, on) => {
  const { kept, set } = world(on)

  kept.set('lang', {})
  await $.session.start(START)
  expect(await screen($)).toBe(RESTING.en)

  set.isStoreBroken = true
  expect(await run($, 'lang ja')).toBe('言語を日本語にしました。保存できなかったので、このセッションだけに適用されます。')
  expect(await screen($)).toBe(RESTING.ja)
  // The letters typed are noted all the same, and the choice still comes first.
  await enter($, '안녕하세요')
  expect(await screen($)).toBe(RESTING.ja)
  // A session that cannot read what was kept goes on with what it has.
  await $.session.start(START)
  expect(await screen($)).toBe(RESTING.ja)
  // Taken back, the choice and the letters noted both go, for the session at least.
  expect(await run($, 'lang auto')).toBe(
    'The language is settled automatically again. Both the language you chose and the one noted from the letters you typed are forgotten, and the letters are read afresh from the next prompt you type.\nIt could not be saved, so it holds for this session only.\nThe language is English. Nothing else settled it, so it is the default.',
  )
  expect(await screen($)).toBe(RESTING.en)
  expect(kept.get('lang')).toEqual({})
  await enter($, '안녕하세요')
  expect(await screen($)).toBe(RESTING.ko)

  set.isStoreBroken = false
  await run($, 'lang en')
  expect(kept.get('lang')).toEqual({ typed: 'ko', chosen: 'en' })
  await run($, 'clear all')
})

test("the mode's own language setting holds against everything else, and a choice made under it waits", { options: { language: 'ja' } }, async ($, on) => {
  const { kept, env, set, registered } = world(on)

  env.LC_ALL = 'ko_KR.UTF-8'
  set.language = 'korean'
  kept.set('lang', { typed: 'ko', chosen: 'ko' })
  await $.session.start(START)
  expect(registered.at(-1)?.description).toContain('ちいかわモード')
  expect(await screen($)).toBe(RESTING.ja)
  await enter($, '안녕하세요')
  expect(await screen($)).toBe(RESTING.ja)
  expect(await run($, 'lang')).toContain('いまの言語は日本語です。モードの設定（language）で決めてあります。')
  expect(await run($, 'lang en')).toBe('モードの設定（language）が日本語に固定されているので、画面はそのままです。選んだ値は、設定を auto に戻すと使われます。')
  expect(kept.get('lang')).toEqual({ typed: 'ko', chosen: 'en' })
  expect(await screen($)).toBe(RESTING.ja)
})

test('a language setting that is none of the three is read as auto', { options: { language: 'klingon' } }, async ($, on) => {
  const { kept, env } = world(on)

  kept.set('lang', {})
  env.LANG = 'ko_KR.UTF-8'
  await $.session.start(START)
  expect(await screen($)).toBe(RESTING.ko)
  expect(await run($, 'lang')).toContain('환경 변수')
})

test('after the language changes, the main loop is told once more beside the next prompt, in the new language, and its section follows', AUTO, async ($, on) => {
  const { kept, told, registered, invalidated } = world(on)

  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }))

  kept.set('lang', {})
  await $.session.start(START)
  // Whatever an earlier prompt told, the main loop has now been told in English.
  await enter($, 'hello')
  await enter($, 'hello again')
  expect(told.at(-1)).toBeUndefined()
  expect((await $.prompt.compose(FACTS)).sections[1]?.text).toContain('# Chiikawa mode')

  // The prompt that turns the language carries the new telling itself: once, and not the one after.
  const before = registered.length
  const marks = invalidated.length

  await enter($, '이제 한국어로 할게')
  expect(told.at(-1)).toHaveLength(1)
  expect(told.at(-1)?.[0]).toContain('# 치이카와 모드')
  expect(told.at(-1)?.[0]).not.toContain('# Chiikawa mode')
  expect(invalidated.slice(marks)).toEqual(['prompt.section'])
  expect(registered.slice(before).map(one => one.description)).toEqual(['치이카와 모드: 먼작귀 친구들 현황 패널을 열거나 켜고 끈다'])
  expect((await $.prompt.compose(FACTS)).sections[1]?.text).toContain('# 치이카와 모드')
  await enter($, '계속해 줘')
  expect(told.at(-1)).toBeUndefined()
  expect(registered).toHaveLength(before + 1)

  // Chosen by the command, the change is told beside the next prompt, though that prompt is in another language.
  await run($, 'lang ja')
  await enter($, '계속해 줘')
  expect(told.at(-1)).toHaveLength(1)
  expect(told.at(-1)?.[0]).toContain('# ちいかわモード')
  await enter($, '계속해 줘')
  expect(told.at(-1)).toBeUndefined()

  // With the mode off nothing is told of it, and the telling waits for it to be on again.
  await run($, 'off')
  await enter($, 'ok')
  expect(told.at(-1)?.[0]).toContain('ちいかわモードがオフになった')
  await run($, 'lang en')
  await enter($, 'ok')
  expect(told.at(-1)).toBeUndefined()
  await run($, 'on')
  await enter($, 'ok')
  expect(told.at(-1)?.[0]).toContain('# Chiikawa mode')
  await run($, 'lang auto')
  await run($, 'clear all')
})

test('what is said from then on is in the new language, and what was said before is shown in it too, but for what someone else wrote', AUTO, async ($, on) => {
  const { kept } = world(on)
  const seen: AgentSpawnInput[] = []

  on('agent.spawn', ($, e) => {
    seen.push(e)

    return { model: 'claude-sonnet-5-5', agentId: `agent_${seen.length}` }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  kept.set('lang', { chosen: 'ko' })
  await $.session.start(START)
  await $.agent.spawn({ ...SPAWN, description: '랏코: 로그인 버그 토벌' })
  expect(seen[0]?.description).toBe('🦦 랏코 · 로그인 버그 토벌')
  expect(seen[0]?.prompt).toContain(MARKS.ko)

  expect(await run($, 'lang en')).toContain('The language is now English.')
  // The conversation shows a line in the language of the screen: the start said in Korean reads in English, and the task's title, which the mode did not write, stays as written.
  const first = await run($, '')

  expect(first).toContain('🦦 Rakko (Build) ● working')
  expect(first).toContain('Rakko: “The usual.” (Hunt begins · 로그인 버그 토벌)')
  // The task taken in Korean ends in English, and a new one is taken in English.
  await $.turn.complete({ ...DONE, answer: '🦦 랏코: 온다!\n고쳤다.', agentId: 'agent_1', reason: 'answer' })
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', description: 'Kurimanju: look over the change' })
  expect(seen[1]?.description).toBe('🌰 Kurimanju · look over the change')
  expect(seen[1]?.prompt).toContain(MARKS.en)
  expect(seen[1]?.prompt).toContain('You are not Hachiware the conductor: you are Kurimanju')

  const answer = await run($, '')

  expect(answer).toContain('🦦 Rakko (Build) ✓ done')
  expect(answer).toContain('🌰 Kurimanju (Review) ● working')
  expect(answer).toMatch(/Rakko: .+ \(Hunt done · \d+s\)/)
  expect(answer).toContain('Kurimanju: (makes an O with both hands) (Exam begins · look over the change)')

  // A task handed on with a Korean block at its end gets the English block of who has it now, and that one alone.
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_3', description: 'Shisa: fix the form', prompt: `Fix the login form.${memberBlock('ko', 'rakko', '구현')}` })
  expect(LANGS.reduce((count, lang) => count + (seen[2]?.prompt ?? '').split(MARKS[lang]).length - 1, 0)).toBe(1)
  expect(seen[2]?.prompt.startsWith(`Fix the login form.\n\n---\n${MARKS.en}\n`)).toBe(true)
  expect(seen[2]?.prompt).toContain('you are Shisa')
  expect(seen[2]?.prompt).not.toContain('랏코')

  await run($, 'lang auto')
  await run($, 'clear all')
})

/**
 * Everything the mode shows of what was said and done, as it is written: the
 * command's answer, the page of cuts, the sheet of the friend asked about
 * and the conductor's, the conversation alone as cuts and as lines, the list
 * a short pane has, and the band with the last line as a cut and as a line.
 */
const pages = async ($: Engine, friend = 'kani'): Promise<string[]> => {
  const all = [await run($, '')]
  const pane = async (columns: number, rows: number, ...keys: string[]): Promise<void> => {
    const mounted = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } } })

    for (const key of keys) await mounted.press({ key })
    all.push(...written((await mounted.drawn()) as Drawn))
    await mounted.unmount()
  }

  await pane(84, 70)
  await pane(84, 70, `watch-${friend}`)
  await pane(84, 70, 'watch-hachiware')
  await pane(84, 70, 'watch-close', 'talk-only')
  await pane(44, 30)
  await pane(44, 12, 'talk-only')
  // The band has the conversation only while the pane is not up to show it: a session that starts again finds none up.
  await $.session.start(START)
  for (const [columns, maxRows] of [[150, 4], [60, 2]] as const) {
    const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: columns, maxRows } })

    all.push(...written((await band.drawn()) as Drawn))
    await band.unmount()
  }

  return all
}

/** What a friend's work comes to in each language: the lines the mode says of it, a few of the many. */
const SAID = {
  en: ['Ura!', 'looking · working.md', 'So that means "I\'ll look for it"?!', 'reading Usagi', 'Forage begins · sort the notes', 'blushes happily', 'Forage done · 2s', 'So that means "found it"?!', 'reading Furuhonya', 'Easy!! Easy!!!', '2 tasks done', 'with Usagi'],
  ko: ['우라', '찾는 중 · working.md', '그 말은 "찾아볼게"라는 거?', '우사기의 말 풀이', '채집 시작 · sort the notes', '볼에 빗금을 띄우며 기뻐한다', '채집 끝 · 2초', '그 말은 "찾았어"라는 거?', '카니의 말 풀이', '간단!! 간단!!!', '2개 작업 끝', '우사기와 함께'],
  ja: ['ウラ', 'さがし中 · working.md', 'それって "さがしてみる" ってコト!?', 'うさぎの言葉の読みとき', '採取開始 · sort the notes', '頬を染めて喜ぶ', '採取完了 · 2秒', 'それって "見つけた" ってコト!?', '古本屋の言葉の読みとき', '簡単ッ簡単ッ', '2件の作業が完了', 'うさぎといっしょ'],
} as const

// Nothing moves on the screen, so that one drawing can be held against another made at a later moment.
test('lines said in one language are shown in whichever language the screen turns to, as if they had been said in it: only what someone else wrote stays', { options: { language: 'auto', animate: false } }, async ($, on) => {
  const { kept, clock } = world(on)
  const box = { spawned: 0 }

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(box.spawned += 1)}` }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
  kept.set('lang', {})
  await $.session.start(START)

  // The three at a file, then two friends who cannot talk take a task each and end it: one with a gesture alone, one with a gesture and a report under it.
  const play = async (): Promise<void> => {
    const from = box.spawned

    await $.tool.call({ tool: 'Read', file_path: '/w/notes/working.md' })
    await $.agent.spawn({ ...SPAWN, tool_use_id: `toolu_${from + 1}`, description: 'Furuhonya: sort the notes' })
    await $.agent.spawn({ ...SPAWN, tool_use_id: `toolu_${from + 2}`, description: 'Kurimanju: look over the change' })
    await clock.advance(2000)
    await $.turn.complete({ ...DONE, turnId: `turn_${from + 1}`, answer: '🦀 Furuhonya: (blushes happily)', agentId: `agent_${from + 1}`, reason: 'answer' })
    await $.turn.complete({ ...DONE, turnId: `turn_${from + 2}`, answer: '🌰 Kurimanju: (makes an O with both hands)\nThe change holds up.', agentId: `agent_${from + 2}`, reason: 'answer' })
  }
  const has = (drawn: readonly string[], piece: string): string => `${piece} ${String(drawn.some(text => text.includes(piece)))}`
  // What the screen shows of it where it was said in the screen's own language from the first.
  const straight: Partial<Record<(typeof LANGS)[number], string[]>> = {}

  for (const lang of LANGS) {
    await run($, `lang ${lang}`)
    await play()
    straight[lang] = await pages($)
    for (const piece of SAID[lang]) expect(has(straight[lang] ?? [], piece)).toBe(`${piece} true`)
    await run($, 'clear all')
  }
  expect(straight.ko).not.toEqual(straight.en)

  // Said in English, and the screen turned to Korean by the letters of a prompt, then to Japanese and back by the command.
  await run($, 'lang auto')
  await play()
  expect(await pages($)).toEqual(straight.en)
  await enter($, '이제 한국어로 할게')
  const turned = await pages($)

  expect(turned).toEqual(straight.ko)
  for (const piece of SAID.en) expect(has(turned, piece)).toBe(`${piece} false`)
  // A gesture a friend who cannot talk wrote as its whole report is one of its own: it is shown as Korean has it, on its cut and on its sheet.
  expect(has(turned, '↳ (볼에 빗금을')).toContain('true')
  expect(turned.filter(text => /^보고 +\(볼에 빗금을 띄우며 기뻐한다\)$/.test(text))).toHaveLength(1)
  // What someone else wrote stays as written: a task's title, what a tool was on, a line of a report.
  for (const piece of ['sort the notes', 'look over the change', 'working.md', 'The change holds up.']) expect(has(turned, piece)).toBe(`${piece} true`)
  await run($, 'lang ja')
  expect(await pages($)).toEqual(straight.ja)
  await run($, 'lang en')
  expect(await pages($)).toEqual(straight.en)
  await run($, 'lang auto')
  await run($, 'clear all')
})

test("a demonstration's tasks are named, told of and reported in the language the screen turns to", AUTO, async ($, on) => {
  const { kept, clock } = world(on)

  kept.set('lang', {})
  await $.session.start(START)
  await run($, 'demo')
  await clock.advance(6000)
  const has = (drawn: readonly string[], piece: string): string => `${piece} ${String(drawn.some(text => text.includes(piece)))}`
  // One has ended and three are at work: the names of the tasks, the word for what runs them and what was handed back.
  const shown = {
    en: ['Demo: find the config file', 'Demo: hunt the login bug', '· demo', 'Scout begins · Demo: find the config file', 'Scout done · 4s · demo', 'This was a demo, so nothing was really done (find the config file)'],
    ko: ['시연: 설정 파일 위치 찾기', '시연: 로그인 버그 토벌', '· 시연', '탐색 시작 · 시연: 설정 파일 위치 찾기', '탐색 끝 · 4초 · 시연', '시연이라 실제로 한 일은 없어요 (설정 파일 위치 찾기)'],
    ja: ['デモ: 設定ファイルの場所をさがす', 'デモ: ログインバグの討伐', '· デモ', '探索開始 · デモ: 設定ファイルの場所をさがす', '探索完了 · 4秒 · デモ', 'デモなので、実際には何もしていません (設定ファイルの場所をさがす)'],
  } as const

  for (const lang of ['en', 'ko', 'ja', 'en'] as const) {
    await run($, `lang ${lang}`)
    const drawn = await pages($, 'usagi')

    for (const piece of shown[lang]) expect(has(drawn, piece)).toBe(`${piece} true`)
    for (const other of LANGS.filter(one => one !== lang)) for (const piece of shown[other]) expect(has(drawn, piece)).toBe(`${piece} false`)
  }
  // Its end, which comes while the screen is in another language than it began in, is told in every one too.
  await run($, 'lang ko')
  await clock.advance(12_000)
  const ended = await pages($, 'kurimanju')

  for (const piece of ['4개 가운데 1개 실패', '몇 번이라도 계속 응원할 테니까!!', '검정 끝 · 14초 · 시연']) expect(has(ended, piece)).toBe(`${piece} true`)
  expect(ended.filter(text => /demo/i.test(text))).toEqual([])
  await run($, 'lang auto')
  await run($, 'clear all')
})

test('what a session under way still holds as one text each, from before words were kept in every language, is drawn as that text whatever the language, and a task held so ends', { options: { language: 'auto', animate: false } }, async ($, on) => {
  const { kept, clock } = world(on)
  const box = { isOld: true }
  // What stood in the session then: a line's words, a task's and a hand's, each as the one text it was said in.
  const one = (held: unknown): unknown => (typeof held === 'object' && held !== null && 'en' in held ? held.en : held)
  const old = (held: unknown, keys: readonly string[]): unknown => (typeof held === 'object' && held !== null ? Object.fromEntries(Object.entries(held).map(([key, value]) => [key, keys.includes(key) ? one(value) : value])) : held)
  /** A list or a table the session holds, each thing in it with those of its words as one text, while the session is taken to be an old one. */
  const aged = <T,>(held: T, ...keys: string[]): T => {
    if (!box.isOld || typeof held !== 'object' || held === null) return held

    return (Array.isArray(held) ? held.map(item => old(item, keys)) : Object.fromEntries(Object.entries(held).map(([id, item]) => [id, old(item, keys)]))) as T
  }

  on('state.get', { plugin: 'chiikawa', key: 'feed' }, async ($, e, next) => {
    const held = await next(e)

    return held.value === undefined ? held : { value: { ...held.value, value: aged(held.value.value, 'quote', 'note') } }
  })
  on('state.get', { plugin: 'chiikawa', key: 'tasks' }, async ($, e, next) => {
    const held = await next(e)

    return held.value === undefined ? held : { value: { ...held.value, value: aged(held.value.value, 'quote', 'note', 'report') } }
  })
  on('state.get', { plugin: 'chiikawa', key: 'aids' }, async ($, e, next) => {
    const held = await next(e)

    return held.value === undefined ? held : { value: { ...held.value, value: aged(held.value.value, 'what', 'brief') } }
  })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'agent_1' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
  kept.set('lang', {})
  await $.session.start(START)
  const has = (drawn: readonly string[], piece: string): string => `${piece} ${String(drawn.some(text => text.includes(piece)))}`
  const english = ['Ura!', 'looking · working.md', 'Forage begins · sort the notes', 'reading Furuhonya']

  // A hand lent, held so, is told as it was on a Korean screen.
  await $.tool.call({ tool: 'Read', file_path: '/w/notes/working.md' })
  await run($, 'lang ko')
  const lent = await pages($)

  for (const piece of ['with Usagi', 'looking with Usagi · working.md']) expect(has(lent, piece)).toBe(`${piece} true`)
  await $.agent.spawn({ ...SPAWN, description: 'Furuhonya: sort the notes' })
  await clock.advance(2000)

  // Every drawing is made, on a Korean screen and a Japanese one, and the words held as one text are that text on both.
  for (const [lang, frame] of [['ko', '먼작귀'], ['ja', 'ちいかわ']] as const) {
    await run($, `lang ${lang}`)
    const drawn = await pages($)

    expect(has(drawn, ` ${frame} `)).toContain('true')
    for (const piece of english) expect(has(drawn, piece)).toBe(`${piece} true`)
  }

  // The task held so ends as any other: its end is said in every language, under the lines that stay as they were.
  await run($, 'lang ko')
  await $.turn.complete({ ...DONE, answer: '🦀 Furuhonya: (blushes happily)', agentId: 'agent_1', reason: 'answer' })
  box.isOld = false
  const ended = await pages($)

  for (const piece of ['🦀 카니 (조사) ✓ 끝', '채집 끝 · 2초', '그 말은 "찾았어"라는 거?', 'Forage begins · sort the notes', 'reading Furuhonya']) expect(has(ended, piece)).toBe(`${piece} true`)
  expect(ended.filter(text => /^보고 +\(볼에 빗금을 띄우며 기뻐한다\)$/.test(text))).toHaveLength(1)
  // What it handed back, held as one text, is that text.
  box.isOld = true
  expect((await pages($)).filter(text => /^보고 +\(blushes happily\)$/.test(text))).toHaveLength(1)
  box.isOld = false
  await run($, 'lang auto')
  await run($, 'clear all')
})

/**
 * Every size of the pane and the band drawn before anything was said, then
 * with the friends at work, some done, one failed, the conversation long
 * enough to be turned back through, and the sheets of the ones with the
 * longest names open: each that takes more cells or rows than it was given
 * is noted, and so is each where one with no card is neither named nor
 * counted, or a sheet is short of what it has to press.
 */
const overflows = async ($: Engine, on: On, names: { long: string; lead: string }): Promise<string[]> => {
  mock.clock(on, { now: 1000 })
  const box = { spawned: 0 }

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(box.spawned += 1)}` }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 1_000_000, tokens: 646_000, percent: 65 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 91, resetsAt: new Date(1000 + 299 * 60_000).toISOString() },
        { kind: 'seven_day', percentUsed: 72, resetsAt: new Date(1000 + 6 * 24 * 60 * 60_000).toISOString() },
        { kind: 'spend_limit', percentUsed: 100 },
      ],
      cost: { usd: 123.45 },
    },
  }))

  const mount = (columns: number, rows: number): Promise<Mounted<'terminal', 'Pane'>> =>
    $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: columns, placement: 'inline', scroll: { offset: 0, bodyRows: rows } } })
  const found: string[] = []
  const over = async (what: string): Promise<void> => {
    for (const [columns, rows] of [
      [44, 12],
      [60, 30],
      ...[20, 26, 32, 38, 44, 49, 60, 72, 100].flatMap(wide => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 30].map(tall => [wide, tall])),
    ] as const) {
      const pane = await mount(columns, rows)
      const drawn = (await pane.drawn()) as Drawn
      const size = sizeOf(drawn, columns)
      // A page of cuts, where there is room for one, scrolls in its pane: only its width is held to.
      const isList = columns < 50 || rows < 16
      const lines = keyed(drawn, /^names/)
      const pressed = new Set(keyed(drawn, /^watch-(?!close)/).map(node => (node !== null && typeof node === 'object' ? node.props?.key : undefined)))
      const counted = lines.flatMap(line => [...textOf(line).matchAll(/\+(\d+)/g)]).reduce((sum, one) => sum + Number(one[1]), 0)

      if (size.width > columns || (isList && size.rows > rows)) found.push(`${what}: pane ${columns}x${rows} drew ${size.width}x${size.rows}`)
      // Where the ones with no card have their row of names, everyone is on a card, named in the row, or counted in it.
      if (lines.length > 0 && keyed(drawn, /^sheet$/).length === 0 && pressed.size + counted !== ORDER.length) found.push(`${what}: pane ${columns}x${rows} names or counts ${pressed.size + counted} of ${ORDER.length}`)
      await pane.unmount()
    }
    for (let columns = 40; columns <= 120; columns += 10) {
      for (const maxRows of [1, 2, 4]) {
        const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: columns, maxRows } })
        const size = sizeOf((await band.drawn()) as Drawn, columns)

        if (size.width > columns || size.rows > maxRows) found.push(`${what}: band ${columns}x${maxRows} drew ${size.width}x${size.rows}`)
        await band.unmount()
      }
    }
  }
  const press = async (...keys: string[]): Promise<void> => {
    const pane = await mount(72, 30)

    for (const key of keys) await pane.press({ key })
    await pane.unmount()
  }

  // Before anything is said, the conversation alone is the conductor waiting: a cut where there is room for one, a line where there is not.
  await press('talk-only')
  await over('the conversation alone, with nothing said')
  for (const [columns, rows] of [[20, 3], [44, 4], [49, 12]] as const) {
    const quiet = await mount(columns, rows)

    expect(`${columns}x${rows} ${JSON.stringify(sizeOf((await quiet.drawn()) as Drawn, columns))}`).toBe(`${columns}x${rows} ${JSON.stringify({ width: columns, rows: 3 })}`)
    expect(await quiet.find({ key: 'talk-only' })).toBeDefined()
    await quiet.unmount()
  }
  await press('talk-only')

  const usage = { input_tokens: 123_456, output_tokens: 98_765, cache_read_input_tokens: 123_456_789, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' }
  const titles = [`${names.long}: redesign the settings screen and every dialog that opens from it`, 'security review of the login flow', 'find where the configuration is read', 'fix a typo', 'research the docs', 'review the change']

  for (let turn = 1; turn <= 24; turn += 1) {
    await $.agent.spawn({ ...SPAWN, tool_use_id: `toolu_${turn}`, description: titles[turn % titles.length] ?? '' })
    if (turn % 4 !== 0) await $.turn.complete({ ...DONE, answer: 'Done, with a report long enough that a narrow pane has to cut it somewhere.', agentId: `agent_${turn}`, reason: turn % 5 === 0 ? 'error' : 'answer', usage })
  }

  await over('at work')
  await run($, names.long)
  await over('a friend picked')
  await press('watch-pochette')
  await over("the longest name's sheet")

  // The sheet in a pane 44 across: its head keeps the way to close it, and its rows and buttons stay inside the frame.
  const sheet = await mount(44, 12)

  expect(await sheet.find({ key: 'watch-close' })).toBeDefined()
  expect(sizeOf(rowWith((await sheet.drawn()) as Drawn, 'watch-close'), 40).width).toBeLessThanOrEqual(40)
  expect(cells(String((await sheet.find({ key: 'pick-pochette' }))?.props.label))).toBeLessThanOrEqual(40)
  await sheet.unmount()

  // Short of rows, the sheet keeps what can be pressed before what it tells: the roles and the button down to five rows, the button in four, and the way to close it in three.
  const keysIn = async (columns: number, rows: number): Promise<string> => {
    const short = await mount(columns, rows)
    const keys = new Set(keyed((await short.drawn()) as Drawn, /^(?:role-|pick-|watch-close$)/).map(node => (node !== null && typeof node === 'object' ? String(node.props?.key) : '')))

    await short.unmount()

    return `${columns}x${rows} ${[...keys].sort().join()}`
  }
  const whole = ['pick-pochette', ...WORK_ROLES.map(role => `role-pochette-${role}`), 'watch-close'].sort().join()

  for (const [columns, rows] of [[26, 6], [32, 5], [32, 6], [44, 5], [44, 6], [49, 5], [49, 8]] as const) expect(await keysIn(columns, rows)).toBe(`${columns}x${rows} ${whole}`)
  // Twenty columns hold every role whole in two rows of them, and in one row only where the names cut that short can still be told apart.
  expect(await keysIn(20, 6)).toBe(`20x6 ${whole}`)
  expect(await keysIn(26, 5)).toBe(`26x5 ${whole}`)
  for (const columns of [20, 44]) {
    expect(await keysIn(columns, 4)).toBe(`${columns}x4 pick-pochette,watch-close`)
    expect(await keysIn(columns, 3)).toBe(`${columns}x3 watch-close`)
  }

  // In a roomy pane the roles are there to press, each by the language's word for it, and stay in one row inside the frame.
  const roomy = await mount(60, 30)
  const roles = rowWith((await roomy.drawn()) as Drawn, 'role-pochette-검토')

  expect(roles).toBeDefined()
  expect(sizeOf(roles, 56)).toMatchObject({ rows: 1 })
  expect(sizeOf(roles, 56).width).toBeLessThanOrEqual(56)
  await roomy.unmount()

  await press('watch-hachiware')
  await over(`${names.lead}'s sheet`)
  await press('watch-rodo')
  await over("the bell ringer's sheet")
  await press('watch-close', 'talk-older', 'talk-older')
  await over('turned back')
  await press('talk-only')
  await over('the conversation alone')

  // The conversation alone at 44 across: its rule is one row, with the ways back and on and the way to the whole page.
  const alone = await mount(44, 12)
  const rule = rowWith((await alone.drawn()) as Drawn, 'talk-only')

  expect(sizeOf(rule, 44)).toEqual({ width: 44, rows: 1 })
  expect(textOf(rule)).toMatch(/\d+~\d+\/\d+/)
  expect(sizeOf((await alone.drawn()) as Drawn, 44).rows).toBeLessThanOrEqual(12)
  await alone.unmount()
  await press('talk-only', 'usage-less')
  await over('the usage folded')
  await press('usage-more')
  await run($, 'demo')
  await over('a demonstration')
  await run($, 'clear all')

  return found
}

test('in English no pane and no band draws wider than its columns or taller than its rows, whatever is on it', { options: { language: 'en' }, timeoutMs: 60_000 }, async ($, on) => {
  expect(await overflows($, on, { long: 'Pochette no Yoroi-san', lead: 'Hachiware' })).toEqual([])
  // The words on the screen are English ones.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /^ Chiikawa $/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Friends resting/ })).toBeDefined()
  expect(await pane.find({ key: 'talk-only' })).toMatchObject({ props: { label: 'Talk only' } })
  expect(await pane.find({ key: 'watch-pochette' })).toMatchObject({ props: { label: 'Pochette' } })
  expect(await pane.find({ type: 'Text', text: /[가-힣]/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^on$/ })).toBeDefined()
  await pane.unmount()

  // Nor are they Japanese ones, with the mode on or off and with lines said, but for what is quoted as the comic writes it: the 古本 of the bookseller's banner.
  await run($, 'demo')
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_kani', description: 'Furuhonya: sort the notes' })
  const drawn: string[] = []

  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 150 } })

  drawn.push(...written((await band.drawn()) as Drawn))
  await band.unmount()
  // Turned off, the mode draws no band, and the pane that is up says so.
  for (const state of ['on', 'off'] as const) {
    await run($, state)
    const busy = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: 100 } })

    drawn.push(...written((await busy.drawn()) as Drawn))
    await busy.unmount()
  }
  expect(drawn.filter(line => line.includes('古本'))).not.toEqual([])
  expect(drawn.filter(line => /[\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Han}]/u.test(line.replaceAll('古本', '')))).toEqual([])
  await run($, 'on')
  await run($, 'clear all')
})

test('in Korean too, with as many at work at once and the longest names on their sheets, nothing draws past its room', { options: { language: 'ko' }, timeoutMs: 60_000 }, async ($, on) => {
  expect(await overflows($, on, { long: '포쉐트 갑옷 씨', lead: '하치와레' })).toEqual([])
  // The words on the screen are Korean ones, the mode's being on among them.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /^ 먼작귀 $/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^켜짐$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /쉬는 친구들/ })).toBeDefined()
  expect(await pane.find({ key: 'talk-only' })).toMatchObject({ props: { label: '이야기만' } })
  await pane.unmount()

  // None is a Japanese one, with the mode on or off and with lines said, but for what the Korean cast keeps as the comic writes it:
  // the 古本 of the bookseller's banner, and 시사's thanks in the Miyako language.
  await run($, 'demo')
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_kani', description: '카니: 메모 정리' })
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_shisa', description: '시사: 폼 고치기' })
  const drawn: string[] = []
  const kept = ['古本', 'たんでぃがーたんでぃ']

  const band = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 150 } })

  drawn.push(...written((await band.drawn()) as Drawn))
  await band.unmount()
  for (const state of ['on', 'off'] as const) {
    await run($, state)
    // A page of cuts, the list a narrow pane has, and the command's own answer.
    for (const columns of [100, 44]) {
      const busy = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: columns } })

      drawn.push(...written((await busy.drawn()) as Drawn))
      await busy.unmount()
    }
    drawn.push(await run($, ''))
  }
  for (const word of kept) expect(`${word} ${String(drawn.some(line => line.includes(word)))}`).toBe(`${word} true`)
  expect(drawn.filter(line => /[\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Han}]/u.test(kept.reduce((text, word) => text.replaceAll(word, ''), line)))).toEqual([])
  expect(drawn.filter(line => line === '꺼짐')).not.toEqual([])
  await run($, 'on')
  await run($, 'clear all')
})

test('in Japanese no pane and no band draws wider than its columns or taller than its rows, whatever is on it', { options: { language: 'ja' }, timeoutMs: 60_000 }, async ($, on) => {
  expect(await overflows($, on, { long: 'ポシェットの鎧さん', lead: 'ハチワレ' })).toEqual([])
  // The words on the screen are Japanese ones.
  const pane = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await pane.find({ type: 'Text', text: /^ ちいかわ $/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /休憩中のともだち/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^○ 待機中$/ })).toBeDefined()
  expect(await pane.find({ key: 'talk-only' })).toMatchObject({ props: { label: 'はなしだけ' } })
  expect(await pane.find({ key: 'watch-pochette' })).toMatchObject({ props: { label: 'ポシェット' } })
  expect(await pane.find({ type: 'Text', text: /[가-힣]/ })).toBeUndefined()
  await pane.unmount()
  await $.command.run({ command: 'chiikawa', args: 'talk', ...RUN })
  const alone = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: PANE })

  expect(await alone.find({ key: 'talk-only' })).toMatchObject({ props: { label: 'ぜんぶ表示' } })
  await alone.unmount()
  await $.command.run({ command: 'chiikawa', args: 'talk', ...RUN })
})

test('what the main loop was told stands, out of date or not, until it is taken back or compacted away: turned off right after the language changed, it is told to stop', AUTO, async ($, on) => {
  const { kept, told } = world(on)
  const box: { skip?: string } = {}
  const messages = [{ role: 'user' as const, text: 'hello', toolUses: [] }]

  on('session.compact', () => (box.skip === undefined ? { messages } : { skip: box.skip }))
  kept.set('lang', {})
  await $.session.start(START)
  await run($, 'on')
  // Whatever an earlier prompt told, the main loop has now been told in English.
  await enter($, 'hello')
  await enter($, 'hello again')
  expect(told.at(-1)).toBeUndefined()

  // The language changes and the mode goes off before another prompt: what was told in English still stands, and is taken back, once.
  await run($, 'lang ja')
  await run($, 'off')
  await enter($, 'hello')
  expect(told.at(-1)).toHaveLength(1)
  expect(told.at(-1)?.[0]).toContain('ちいかわモードがオフになった')
  await enter($, 'hello')
  expect(told.at(-1)).toBeUndefined()

  // The same with a role changed in between, and the language changed twice.
  await run($, 'on')
  await enter($, 'hello')
  expect(told.at(-1)?.[0]).toContain('# ちいかわモード')
  await run($, 'role rakko review')
  await run($, 'lang ko')
  await run($, 'lang en')
  await run($, 'off')
  await enter($, 'hello')
  expect(told.at(-1)).toHaveLength(1)
  expect(told.at(-1)?.[0]).toContain('Chiikawa mode has been turned off')
  await enter($, 'hello')
  expect(told.at(-1)).toBeUndefined()

  // Out of date and on again, it is told as things are now, once: nothing is taken back first.
  await run($, 'on')
  await enter($, 'hello')
  await run($, 'lang ja')
  await run($, 'off')
  await run($, 'on')
  await enter($, 'hello')
  expect(told.at(-1)?.[0]).toContain('# ちいかわモード')
  await enter($, 'hello')
  expect(told.at(-1)).toBeUndefined()

  // A compaction that was skipped, one of a subagent's own transcript and one worked out ahead leave the conversation as it was:
  // what was told stands, and is taken back.
  box.skip = 'not now'
  await $.session.compact({ trigger: 'manual', messages })
  delete box.skip
  await $.session.compact({ trigger: 'auto', agentId: 'agent_1', messages })
  await $.session.compact({ trigger: 'precompute', messages })
  await enter($, 'hello')
  expect(told.at(-1)).toBeUndefined()
  await run($, 'lang en')
  await run($, 'off')
  await enter($, 'hello')
  expect(told.at(-1)?.[0]).toContain('Chiikawa mode has been turned off')

  // One that was made took it away: there is nothing to take back, and with the mode on again it is told afresh.
  await run($, 'on')
  await enter($, 'hello')
  expect(told.at(-1)?.[0]).toContain('# Chiikawa mode')
  await $.session.compact({ trigger: 'manual', messages })
  await run($, 'lang ja')
  await run($, 'off')
  await enter($, 'hello')
  expect(told.at(-1)).toBeUndefined()
  await run($, 'on')
  await enter($, 'hello')
  expect(told.at(-1)?.[0]).toContain('# ちいかわモード')
  await run($, 'role reset')
  await run($, 'lang auto')
  await run($, 'clear all')
})

// The runtime's timer, which the plugin's types leave out as a plugin is given `$.clock` in its place.
declare const setTimeout: (run: () => void, ms: number) => unknown

/** Lets what is under way run as far as it can before the test goes on. */
const breathe = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10))

test('a session starting shares its read of what is kept with a command that arrives meanwhile, and what the person changes while it is read is not read over', AUTO, async ($, on) => {
  const { kept, set, reads } = world(on)

  /** Holds the next read of one key until the test lets it go. */
  const hold = (key: string): (() => void) => {
    const gate = { open: (): void => undefined }

    reads.length = 0
    set.slow = {
      key,
      held: new Promise<void>(resolve => {
        gate.open = resolve
      }),
    }

    return () => {
      delete set.slow
      gate.open()
    }
  }
  const reading = async (key: string): Promise<void> => {
    while (!reads.includes(key)) await breathe()
  }

  kept.set('lang', { chosen: 'ko' })
  kept.set('roles', { kani: '검토' })

  // A command arrives while the session's own read is under way: it waits for that read, and makes none of its own.
  const first = hold('lang')
  const started = $.session.start(START)

  await reading('lang')
  const chosen = run($, 'lang ja')

  await breathe()
  expect(reads).toEqual(['lang'])
  first()
  await started
  await chosen
  expect(reads).toEqual(['lang', 'roles'])
  expect(await screen($)).toBe(RESTING.ja)
  expect(kept.get('lang')).toEqual({ chosen: 'ja' })

  // A session starting again, as on a reload, reads again: a language chosen while it does is the newer, and stays.
  const second = hold('lang')
  const again = $.session.start(START)

  await reading('lang')
  await run($, 'lang en')
  second()
  await again
  expect(await screen($)).toBe(RESTING.en)
  expect(kept.get('lang')).toEqual({ chosen: 'en' })

  // And so does a role given while the roles are read.
  const third = hold('roles')
  const once = $.session.start(START)

  await reading('roles')
  await run($, 'role rakko review')
  const given = await run($, 'role')

  third()
  await once
  expect(await run($, 'role')).toBe(given)
  expect(kept.get('roles')).toEqual({ kani: '검토', rakko: '검토' })
  await run($, 'role reset')
  await run($, 'lang auto')
  await run($, 'clear all')
})

test('a language told by the letters that could not be saved is said to hold for this session only, and is saved beside a later prompt once it can be, with nothing said', AUTO, async ($, on) => {
  const { kept, set, toasts } = world(on)

  kept.set('lang', {})
  await $.session.start(START)
  await run($, 'on')
  toasts.length = 0

  // What is kept can be read, and for a while not written.
  set.isStoreClosed = true
  await enter($, '안녕하세요')
  expect(await screen($)).toBe(RESTING.ko)
  expect(toasts).toEqual(['입력한 글자를 보고 언어를 한국어로 바꿨어요. 저장하지는 못해서 이번 세션에만 적용돼요. 되돌리려면 /chiikawa lang en'])
  expect(kept.get('lang')).toEqual({})
  // More of the same language is no news, and the save that is tried again with it fails as quietly.
  await enter($, '로그인 버그를 고쳐 줘')
  expect(toasts).toHaveLength(1)
  expect(kept.get('lang')).toEqual({})
  await enter($, 'ログインのバグを直して')
  expect(toasts.at(-1)).toBe('入力した文字から、言語を日本語に切り替えました。保存できなかったので、このセッションだけに適用されます。戻すには /chiikawa lang ko')

  // Once it can be written, the next prompt keeps what was noted, whatever it is typed in, and says nothing.
  set.isStoreClosed = false
  await enter($, 'hello')
  expect(kept.get('lang')).toEqual({ typed: 'ja' })
  expect(toasts).toHaveLength(2)
  // Kept, it is not saved again.
  kept.set('lang', {})
  await enter($, 'hello again')
  expect(kept.get('lang')).toEqual({})
  await run($, 'lang auto')
  await run($, 'clear all')
})
