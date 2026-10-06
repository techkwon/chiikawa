import type { AgentSpawnInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { Drawn } from './drawn'
import { written } from './drawn'

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

// The Korean screen as version 0.1.0 drew it, before the mode had any other
// language: every piece of writing on each screen, in the order it is drawn,
// and each answer of the command whole. They were taken from that version
// running the steps below, and are not to be brought into line with a change.
const BEFORE = {
  idlePane: [
    " 먼작귀  쉬는 중",
    "ちいかわ",
    "      ",
    "하치와레",
    "○ 대기",
    "“뭐야 뭐야?”",
    "      ",
    "치이카와",
    "○ 대기",
    "“얌빰빰 루빠루빠”",
    "       ",
    "우사기",
    "○ 대기",
    "“루루루루루”",
    "─────────────────────────── 이야기 ───────────────────────────",
    "  ",
    "이야기만",
    "                                                ╭─ 하치와레 ─╮",
    "                             일감을 기다리는 중 │ 뭐야 뭐야? >",
    "                                                ╰────────────╯",
    " /\\___/\\ ",
    "(##'v'##)",
    " (\")_(\")~",
    "───────────────────────────── 쉬는 친구들 ──────────────────────────────",
    "       ",
    "랏코",
    "       ",
    "시사",
    "     ",
    "쿠리만쥬",
    "       ",
    "카니",
    "  ",
    "포쉐트 갑옷 씨",
    "      ",
    "모몽가",
    "   ",
    "노동 갑옷 씨",
    "사용량",
    "접기",
    "아직 읽은 사용량이 없어요.",
    "이름을 누르면 그 친구가 하는 일이 보여요",
  ],
  idleBand: [
    " 먼작귀 ",
    "하치와레",
    "치이카와",
    "우사기",
    "│",
    "랏코",
    "시사",
    "쿠리만쥬",
    "카니",
    "포쉐트",
    "모몽가",
    "보내기: 자동",
    "사용량",
  ],
  band150: [
    " 먼작귀 ",
    "⠋ ",
    "하치와레",
    "치이카와",
    "✓ ",
    "우사기",
    "│",
    "랏코",
    "⠋ ",
    "시사",
    " 1:05",
    "✗ ",
    "쿠리만쥬",
    "카니",
    "포쉐트",
    "모몽가",
    "보내기: 자동",
    "사용량",
  ],
  band60: [
    " 먼작귀 ",
    "⠋ ",
    "하치와레",
    "치이카와",
    "✓ ",
    "우사기",
    "일하는 친구 1",
  ],
  slim: [
    " 먼작귀  일하는 중 1명",
    "ちいかわ",
    "▌",
    "● ",
    "하치와레",
    "⠋ 지휘 중",
    "▌  일하는 친구: 시사 “그 말은 \"안 됐어\"라…",
    "▌",
    "● ",
    "치이카와",
    "○ 대기",
    "▌  작은 수정, 정리(풀 뽑… “얌빰빰 루빠루빠”",
    "▌",
    "● ",
    "우사기",
    "✓ 끝 1:05",
    "▌  설정 파일 위치 찾기 · Explore “푸랴!”",
    "▌",
    "● ",
    "시사",
    "⠋ 작업 중 1:05",
    "▌  로그인 폼 구현 · … “たんでぃがーたんでぃ”",
    "쉬는 중 ",
    "랏코",
    " · ",
    "쿠리만쥬",
    " · ",
    "카니",
    " · ",
    "포쉐트",
    " +2",
    "사용량 보기",
    "이름을 누르면 그 친구가 하는 일이 보여요",
  ],
  usage: "먼작귀 사용량\n배터리 ▰▰▰▰▰▰▰▰▱▱ 77% 남음 · 컨텍스트 4.6만 / 20만\n5시간  ▰▰▰▰▱▱▱▱▱▱ 41% 사용 · 2시간 4분 뒤 초기화\n7일    ▰▱▱▱▱▱▱▱▱▱ 12% 사용 · 2일 뒤 초기화\nClaude 세션 비용 $1.50\n친구별 보수 (토큰, 이번 세션 누적)\n🐰 우사기: 입력 2천 · 캐시 5만 · 출력 340",
  sheet: [
    " 먼작귀  일하는 중 1명",
    "ちいかわ",
    "      ",
    "하치와레",
    "⠋ 지휘 중",
    "친구 1명에게 맡김",
    "      ",
    "치이카와",
    "○ 대기",
    "“얌빰빰 루빠루빠”",
    "       ",
    "우사기",
    "✓ 끝 1:05",
    "↳ 설정 파일은 src/c…",
    " 우사기 ",
    "✓ 끝 1:05",
    "토끼 · 제초 2급 · 탐색",
    "닫기",
    "지금    쉬는 중 · 코드 탐색, 위치 찾기",
    "끝낸 일 ✓ 설정 파일 위치 찾기 · 1분 5초",
    "보고    설정 파일은 src/config.ts 에 있다.",
    "보수    입력 2천 · 캐시 5만 · 출력 340",
    "한 말   “우라” 탐색 시작 · 설정 파일 위치 찾기",
    "        “푸랴!” 탐색 끝 · 1분 5초",
    "역할   ",
    "▷구현",
    "▷검토",
    "▷조사",
    "▶탐색",
    "▷ 이 친구에게 다음 명령 맡기기",
    "──────────────────────────── 일하는 친구들 ─────────────────────────────",
    "        ",
    "시사",
    "⠋ 작업 중 1:05",
    "로그인 폼 구현",
    "      ",
    "쿠리만쥬",
    "✗ 실패 1:05",
    "(손으로 X를 그린다)",
    "─────────────────────── 이야기 ───────────────────────",
    "  ",
    "▲ 이전",
    "  ",
    "이야기만",
    "                                     ╭──────────── 하치와레 ─╮",
    "                    우사기의 말 풀이 │ 있구나~. 이런 곳에도. >",
    "                                     ╰───────────────────────╯",
    " /\\___/\\ ",
    "(##>v<##)",
    " (\")_(\")~",
    " .-###-. ",
    " ( . . )X",
    " (\")_(\") ",
    "┌─ 쿠리만쥬 ────────┐",
    "│ 손으로 X를 그린다 │ 검정 실패 · 1분 5초 · API 오류",
    "└───────────────────┘",
    "                                 ╭──────────────── 하치와레 ─╮",
    "          쿠리만쥬의 실패를 보고 │ 그 말은 \"안 됐어\"라는 거? >",
    "                                 ╰───────────────────────────╯",
    " /\\___/\\ ",
    "(##;v;##)",
    " (\")_(\")~",
    "쉬는 중 ",
    "랏코",
    " · ",
    "카니",
    " · ",
    "포쉐트",
    " · ",
    "모몽가",
    " · ",
    "노동 갑옷",
    "사용량",
    "Claude 세션 $1.50",
    "접기",
    "배터리 ▰▰▰▰▰▰▰▰▱▱ 77% 남음 · 컨텍스트 4.6만 / 20만",
    "5시간  ▰▰▰▰▱▱▱▱▱▱ 41% 사용 · 2시간 4분 뒤 초기화",
    "7일    ▰▱▱▱▱▱▱▱▱▱ 12% 사용 · 2일 뒤 초기화",
    "친구별 보수 (토큰, 이번 세션 누적)",
    "● 우사기         입력 2천 · 캐시 5만 · 출력 340",
    "이름을 누르면 그 친구가 하는 일이 보여요",
  ],
  roster: "먼작귀 친구들 현황 패널을 열었어요.\n🐱 하치와레 (지휘) ● 지휘 중 · 일하는 친구: 시사\n🐹 치이카와 (구현) ○ 대기\n🐰 우사기 (탐색) ✓ 끝 1:05 · 설정 파일 위치 찾기 · Explore\n🦦 랏코 (구현) ○ 대기\n🦁 시사 (구현) ● 작업 중 1:05 · 로그인 폼 구현 · general-purpose\n🌰 쿠리만쥬 (검토) ✗ 실패 1:05 · 바뀐 코드 다시 보기 · general-purpose\n🦀 카니 (조사) ○ 대기\n👛 포쉐트 갑옷 씨 (구현) ○ 대기\n🍑 모몽가 (검토) ○ 대기\n\n최근 대화\n하치와레: “그 말은 \"맡을게\"라는 거?” (우사기의 말 풀이)\n우사기: “푸랴!” (탐색 끝 · 1분 5초)\n하치와레: “있구나~. 이런 곳에도.” (우사기의 말 풀이)\n쿠리만쥬: (손으로 X를 그린다) (검정 실패 · 1분 5초 · API 오류)\n하치와레: “그 말은 \"안 됐어\"라는 거?” (쿠리만쥬의 실패를 보고)",
  roles: "친구들의 역할\n🐹 치이카와 · 구현 (작은 수정, 정리(풀 뽑기))\n🐰 우사기 · 탐색 (코드 탐색, 위치 찾기)\n🦦 랏코 · 구현 (어려운 구현, 디버깅)\n🦁 시사 · 구현 (일반 구현, 수정)\n🌰 쿠리만쥬 · 검토 (검토, 검증 (O/X))\n🦀 카니 · 조사 (조사, 문서, 정리)\n👛 포쉐트 갑옷 씨 · 구현 (화면, UI, 디자인)\n🍑 모몽가 · 검토 (반박 검토, 보안 점검)\n\n바꾸기: /chiikawa role <친구 이름> <구현|검토|조사|탐색>\n한 명 되돌리기: /chiikawa role <친구 이름> 기본 · 모두 되돌리기: /chiikawa role reset\n패널에서 친구 이름을 누른 뒤 역할을 눌러도 바뀌어요.\n역할을 받은 친구가 그 일을 먼저 맡아요. 다만 화면·디버깅·보안처럼 전문 분야가 정해진 일(화면·디자인은 포쉐트 갑옷 씨, 어려운 디버깅은 랏코, 보안·반박 검토는 모몽가, 오타·포맷은 치이카와)은 역할과 상관없이 그 담당이 먼저 맡아요(그 담당의 역할을 바꾼 경우는 빼고요).",
  given: "🦦 랏코의 역할을 검토로 바꿨어요(원래 구현). 이제 검토 일은 랏코가 먼저 맡아요. 다만 화면·디버깅·보안처럼 전문 분야가 정해진 일(화면·디자인은 포쉐트 갑옷 씨, 어려운 디버깅은 랏코, 보안·반박 검토는 모몽가, 오타·포맷은 치이카와)은 역할과 상관없이 그 담당이 먼저 맡아요(그 담당의 역할을 바꾼 경우는 빼고요). 저장하지는 못해서 이번 세션에만 적용돼요.",
  back: "🦦 랏코의 역할을 원래대로 구현으로 돌렸어요. 저장하지는 못해서 이번 세션에만 적용돼요.",
} as const

test("the Korean screen and the command's Korean answers are, to the letter, what they were before the other languages", { options: { language: 'ko' } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const box = { spawned: 0 }

  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent_${(box.spawned += 1)}` }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200_000, tokens: 46_000, percent: 23 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 41, resetsAt: new Date(1000 + 125 * 60_000).toISOString() },
        { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(1000 + 3 * 24 * 60 * 60_000).toISOString() },
      ],
      cost: { usd: 1.5 },
    },
  }))

  const band = async (columns: number): Promise<string[]> => {
    const mounted = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: columns } })
    const all = written((await mounted.drawn()) as Drawn)

    await mounted.unmount()

    return all
  }
  const pane = async (columns: number, rows: number, ...keys: string[]): Promise<string[]> => {
    const mounted = await $.ui.mount({ plugin: 'chiikawa', surface: 'terminal', component: 'Pane', requestId: 'chiikawa', props: { ...PANE, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } } })

    for (const key of keys) await mounted.press({ key })
    const all = written((await mounted.drawn()) as Drawn)

    await mounted.unmount()

    return all
  }
  const run = async (args: string): Promise<string> => (await $.command.run({ command: 'chiikawa', args, ...RUN })).text ?? ''

  // Nothing has happened yet: the three, the bench, and 하치와레 waiting for work.
  expect(await pane(72, 50)).toEqual([...BEFORE.idlePane])
  expect(await band(120)).toEqual([...BEFORE.idleBand])

  // Three friends take a task; one ends well, with a report and what it cost, and one fails.
  await $.agent.spawn(SPAWN)
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2', description: '쿠리만쥬: 바뀐 코드 다시 보기' })
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_3', subagentType: 'Explore', description: '설정 파일 위치 찾기' })
  await clock.advance(65_000)
  await $.turn.complete({
    answer: '🐰 우사기: 우라라라라\n설정 파일은 src/config.ts 에 있다.',
    durationMs: 65_000,
    isAborted: false,
    turnId: 'turn_1',
    agentId: 'agent_3',
    reason: 'answer',
    usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 50_000, cache_creation_input_tokens: 800, model: 'claude-haiku-4-5' },
  })
  await $.turn.complete({ answer: '', durationMs: 65_000, isAborted: false, turnId: 'turn_2', agentId: 'agent_2', reason: 'error' })

  expect(await band(150)).toEqual([...BEFORE.band150])
  expect(await band(60)).toEqual([...BEFORE.band60])
  expect(await pane(44, 12)).toEqual([...BEFORE.slim])
  expect(await run('usage')).toBe(BEFORE.usage)
  // A friend's sheet, over the page of cuts and the usage in full.
  expect(await pane(72, 50, 'watch-usagi')).toEqual([...BEFORE.sheet])
  expect(await run('')).toBe(BEFORE.roster)
  expect(await run('role')).toBe(BEFORE.roles)
  expect(await run('role 랏코 검토')).toBe(BEFORE.given)
  expect(await run('role 랏코 기본')).toBe(BEFORE.back)
})
