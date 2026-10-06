import { expect, test } from 'claude-code/testing'

import { ART_COLUMNS, artRows, ARTS, ICON_COLUMNS, ICON_ROWS, iconOf, SPRITES } from '../hooks/art'
import { CAST, CORE, isGesture, jobOf, MEMBERS, ORDER, pickMember, readingOf, roleOf, roleOfAgent, rolesFrom, say, shown, specialistOf, toneOf, withRole, WORKERS } from '../hooks/cast'
import { findFleetRuns, voicedSpecPath } from '../hooks/orca'
import { cells, fit, planOf, spentBy, ZERO } from '../hooks/view'
import type { Scene } from '../hooks/view'
import { firstLine, firstLines, leaderSection, MARKS, memberBlock, memberNamed, namedMember, orcaBlock, pickNote, roleNamed, roleNote, unvoiced } from '../hooks/voice'
import { asIs } from '../hooks/words'
import type { Mood, Task } from '../types'

const MOODS: readonly Mood[] = ['calm', 'glad', 'sad', 'shock', 'tired']
/** The tests here read the Korean cast and screen. */
const { lines: LINES, means, names: NAMES } = CAST.ko
const MARK = MARKS.ko

const task = (member: Task['member'], status: Task['status']): Task => ({
  id: member,
  kind: 'agent',
  member,
  role: MEMBERS[member].role,
  engine: 'general-purpose',
  title: '일',
  status,
  startedAt: 0,
  toolCount: 0,
  quote: asIs(''),
  note: asIs(''),
  mood: 'calm',
})

const scene = (tasks: Task[] = []): Scene => ({ lang: 'ko', tasks, now: 0, waveAt: 0, usage: null, leaderTokens: { fresh: 0, cached: 0, out: 0 }, feed: [], picked: null, watched: null, aids: {}, isUsageOpen: false, talkBack: 0, isTalkOnly: false, roles: {}, paid: {} })

test('every picture is nine keyboard characters wide in every mood, and every icon ten pixels by eight', () => {
  for (const id of ORDER) {
    const art = ARTS[id]

    for (const mood of MOODS) {
      for (const row of [art.top, art.faces[mood], art.feet]) {
        expect(`${id} ${mood} ${row.length}`).toBe(`${id} ${mood} ${ART_COLUMNS}`)
        expect(/^[\x20-\x7e]+$/.test(row)).toBe(true)
      }
      expect(artRows(id, mood).map(runs => runs.map(run => run.text).join(''))).toEqual([art.top, art.faces[mood], art.feet])
    }
    expect(art.masks.map(mask => mask.length)).toEqual([ART_COLUMNS, ART_COLUMNS, ART_COLUMNS])
    expect(SPRITES[id].rows.map(row => row.length)).toEqual(Array.from({ length: ICON_ROWS * 2 }, () => ICON_COLUMNS))
  }
})

test("a picture's colored cells come out as runs of the character's own color", () => {
  expect(artRows('hachiware', 'calm')[1]).toEqual([
    { text: '(', color: undefined },
    { text: '##', color: '#6fa0ea' },
    { text: "'v'", color: undefined },
    { text: '##', color: '#6fa0ea' },
    { text: ')', color: undefined },
  ])
  expect(artRows('kurimanju', 'glad')[1]?.map(run => run.text).join('')).toBe(' ( . . )O')
  expect(artRows('kurimanju', 'sad')[1]?.map(run => run.text).join('')).toBe(' ( . . )X')
})

test('on a light theme the drawings take deeper tones of the same colors', () => {
  expect(toneOf('#f7a8c0', false)).toBe('#f7a8c0')
  expect(toneOf('#f7a8c0', true)).toBe('#c2457a')
  // A theme key is the theme's own to turn.
  expect(toneOf('success', true)).toBe('success')
  expect(artRows('hachiware', 'calm', true)[1]?.[1]).toEqual({ text: '##', color: '#2f62b8' })
  for (const id of ORDER) {
    // Every line color has a tone that reads on a light ground.
    expect(`${id} ${String(toneOf(MEMBERS[id].line, true) !== MEMBERS[id].line)}`).toBe(`${id} true`)
    expect(iconOf(id, true)).not.toBe(iconOf(id))
  }
})

test('a character at work moves: its feet step and its icon bobs, in the same room', () => {
  for (const id of ORDER) {
    const still = artRows(id, 'calm').map(runs => runs.map(run => run.text).join(''))
    const stepping = artRows(id, 'calm', false, true).map(runs => runs.map(run => run.text).join(''))

    expect(stepping.slice(0, 2)).toEqual(still.slice(0, 2))
    expect(`${id} ${stepping[2]?.length}`).toBe(`${id} ${ART_COLUMNS}`)
    expect(`${id} ${String(iconOf(id, false, true) !== iconOf(id))}`).toBe(`${id} true`)
  }
  // The three the comic is about are seen to step.
  for (const id of CORE) expect(artRows(id, 'calm', false, true)[2]).not.toEqual(artRows(id, 'calm')[2])
})

test('the role picks its own character, the next free one while that one is busy, and a specialist before either', () => {
  expect(pickMember('구현', [])).toBe('shisa')
  expect(pickMember('검토', [])).toBe('kurimanju')
  expect(pickMember('조사', [])).toBe('kani')
  expect(pickMember('탐색', [])).toBe('usagi')
  expect(pickMember('구현', [task('shisa', 'running')])).toBe('rakko')
  expect(pickMember('구현', [task('shisa', 'done')])).toBe('shisa')
  expect(pickMember('구현', [], 'pochette')).toBe('pochette')
  expect(pickMember('구현', [task('pochette', 'running')], 'pochette')).toBe('shisa')
  expect(WORKERS.includes('rodo')).toBe(false)
  expect(WORKERS.includes('hachiware')).toBe(false)
})

test('a role the person gave puts that character first for it, and takes it out of the role it left', () => {
  const given = withRole({}, 'rakko', '검토')

  expect(given).toEqual({ rakko: '검토' })
  expect(roleOf('rakko', given)).toBe('검토')
  expect(jobOf('ko', 'rakko', given)).toBe('검토, 검증')
  expect(jobOf('ko', 'rakko')).toBe('어려운 구현, 디버깅')
  expect(pickMember('검토', [], undefined, given)).toBe('rakko')
  // Busy, the role's own are next; and it no longer backs up the role it left, nor takes its old specialty.
  expect(pickMember('검토', [task('rakko', 'running')], undefined, given)).toBe('kurimanju')
  expect(pickMember('구현', [task('shisa', 'running')], undefined, given)).toBe('pochette')
  expect(pickMember('구현', [], 'rakko', given)).toBe('shisa')
  // A role with everyone moved out of it falls back on those it was first given to.
  expect(pickMember('조사', [], undefined, { kani: '검토', shisa: '검토', usagi: '검토' })).toBe('kani')
  // Its own role again is no change kept; 하치와레 and 노동 갑옷 씨 have no role to change.
  expect(withRole(given, 'rakko', '구현')).toEqual({})
  expect(withRole(given, 'rakko', null)).toEqual({})
  expect(withRole({}, 'hachiware', '검토')).toEqual({})
  expect(withRole({}, 'rodo', '검토')).toEqual({})
  // What was kept is read back with only what holds.
  expect(rolesFrom({ rakko: '검토', shisa: '구현', kani: '지휘', hachiware: '검토', nobody: '검토' })).toEqual({ rakko: '검토' })
  expect(rolesFrom('검토')).toEqual({})
  expect(roleNamed('검정')).toBe('검토')
  expect(roleNamed('토벌')).toBe('구현')
  expect(roleNamed('지휘')).toBeUndefined()
  // The main loop is told who takes what now.
  expect(leaderSection('ko', false, true, given)).toContain('🦦 랏코 (해달, 토벌 랭킹 1위): 검토, 검증 (사용자가 바꾼 역할: 검토)')
  expect(leaderSection('ko')).toContain('🦦 랏코 (해달, 토벌 랭킹 1위): 어려운 구현, 디버깅')
  expect(roleNote('ko', given)).toContain('랏코는 검토(검토, 검증)')
  expect(roleNote('ko', {})).toContain('모두 원래대로 돌렸다')
})

test('the word of a change of roles names who has which role now, and what a role does not change', () => {
  const reset = roleNote('ko', {})

  // Nothing rests on a list told earlier: everyone is named with the role they have.
  expect(reset).not.toContain('처음에 적힌 역할')
  for (const id of WORKERS) expect(reset).toContain(`${NAMES[id]}는 ${MEMBERS[id].role}(${jobOf('ko', id)})`)

  const changed = roleNote('ko', { rakko: '검토' })

  expect(changed).toContain('지금 바뀐 역할: 랏코는 검토(검토, 검증).')
  expect(changed).toContain('나머지 친구는 기본 역할이다: ')
  expect(changed).toContain('시사는 구현(')
  // A kind of work with its own character goes to that one before the one given the role.
  for (const note of [reset, changed]) expect(note).toContain('전문 분야가 정해진 일(화면·디자인은 포쉐트 갑옷 씨, 어려운 디버깅은 랏코, 보안·반박 검토는 모몽가, 오타·포맷은 치이카와)은 역할과 상관없이 그 담당이 먼저 맡는다')
  expect(pickMember('구현', [], 'pochette', { shisa: '구현' })).toBe('pochette')
})

test('the kind of work tells its specialist', () => {
  expect(specialistOf('frontend-architect', '설정 화면')).toBe('pochette')
  expect(specialistOf('general-purpose', '로그인 UI 고치기')).toBe('pochette')
  expect(specialistOf('security-engineer', '점검')).toBe('momonga')
  expect(specialistOf('agy-review', 'check')).toBe('momonga')
  expect(specialistOf('codex-hard', 'fix')).toBe('rakko')
  expect(specialistOf('root-cause-analyst', '왜 죽는지')).toBe('rakko')
  expect(specialistOf('general-purpose', '오타 고치기')).toBe('chiikawa')
  expect(specialistOf('general-purpose claude-haiku-4-5', '로그인 폼 구현', '구현')).toBe('chiikawa')
  expect(specialistOf('Explore claude-haiku-4-5', '위치 찾기', '탐색')).toBeUndefined()
  expect(specialistOf('general-purpose', '로그인 폼 구현')).toBeUndefined()
  // Where two fit, a security check of a screen is 모몽가's.
  expect(specialistOf('frontend-architect', '설정 화면 보안 점검')).toBe('momonga')
})

test('an agent type or a description tells the role', () => {
  expect(roleOfAgent('Explore', '로그인 코드 위치')).toBe('탐색')
  expect(roleOfAgent('quality-engineer', '테스트')).toBe('검토')
  expect(roleOfAgent('technical-writer', '문서')).toBe('조사')
  expect(roleOfAgent('general-purpose', '로그인 버그 토벌')).toBe('구현')
  expect(roleOfAgent('general-purpose', '이것저것')).toBeUndefined()
  // `research` is a word of its own, not the `search` in it: it is looking things up, not finding a place.
  expect(roleOfAgent('researcher', '자료 모으기')).toBe('조사')
  expect(roleOfAgent('deep-research-agent', '자료 모으기')).toBe('조사')
})

test('a word of the work is not read out of a longer word that holds it', () => {
  // `information` holds `format`, `guidelines` holds `ui`, `debugger` is still debugging.
  expect(specialistOf('general-purpose', 'gather information about the API')).toBeUndefined()
  expect(specialistOf('general-purpose', 'data transformation step')).toBeUndefined()
  expect(specialistOf('general-purpose', 'follow the guidelines')).toBeUndefined()
  expect(specialistOf('general-purpose', 'format the changelog')).toBe('chiikawa')
  expect(specialistOf('general-purpose', 'Formatting and typos')).toBe('chiikawa')
  expect(specialistOf('general-purpose', 'reformat the table')).toBe('chiikawa')
  expect(specialistOf('general-purpose', 'fix the settings UI')).toBe('pochette')
  expect(specialistOf('general-purpose', 'debugging the crash')).toBe('rakko')
  // `preview` holds `review`, `profound` holds `find`.
  expect(roleOfAgent('general-purpose', 'preview pane layout')).toBeUndefined()
  expect(roleOfAgent('general-purpose', 'a profound change')).toBeUndefined()
  expect(roleOfAgent('general-purpose', 'review the diff')).toBe('검토')
  expect(roleOfAgent('general-purpose', 'Find the config file')).toBe('탐색')
  // A Korean word of the work is one wherever it stands.
  expect(specialistOf('general-purpose', '설정화면고치기')).toBe('pochette')
  expect(roleOfAgent('general-purpose', '바뀐코드검토하기')).toBe('검토')
})

test('a character says its own lines in turn, and a gesture is told without quotation marks', () => {
  expect(say('ko', 'usagi', 'start', 0)).toBe('우라')
  expect(say('ko', 'usagi', 'start', 1)).toBe('야하')
  expect(say('ko', 'chiikawa', 'fail', 0)).toBe('와… 아…')
  expect(say('ko', 'chiikawa', 'fail', 1)).toBe('우우···')
  expect(say('ko', 'rodo', 'start', 0)).toBe('빠른 사람이 임자!')
  expect(isGesture(say('ko', 'kurimanju', 'done', 0))).toBe(true)
  expect(shown('(손으로 O를 그린다)')).toBe('(손으로 O를 그린다)')
  expect(shown('우라')).toBe('“우라”')

  // What a character says on the screen is a line its own voice is given: none is said that its instructions do not list.
  for (const id of ORDER) {
    for (const situation of ['idle', 'start', 'done', 'fail', 'slow', 'denied'] as const) {
      for (const turn of [0, 1, 2, 3]) {
        const quote = say('ko', id, situation, turn)

        if (!isGesture(quote)) expect(LINES[id].some(line => line.includes(`"${quote}"`))).toBe(true)
      }
    }
  }
})

test('하치와레 reads aloud the friends who cannot talk, and only them', () => {
  expect(readingOf('ko', 'chiikawa', 'start', '구현')).toBe(means('맡을게'))
  expect(readingOf('ko', 'chiikawa', 'done', '구현')).toBe('그 말은 "다 됐어"라는 거?')
  expect(readingOf('ko', 'chiikawa', 'fail', '구현')).toBe('울어 버렸다!')
  expect(readingOf('ko', 'kurimanju', 'done', '검토')).toBe('그 말은 "통과"라는 거?')
  expect(readingOf('ko', 'usagi', 'done', '탐색')).toBe('있구나~. 이런 곳에도.')
  expect(readingOf('ko', 'kani', 'fail', '조사')).toBe('그 말은 "안 됐어"라는 거?')
  expect(readingOf('ko', 'rakko', 'start', '구현')).toBeUndefined()
  expect(readingOf('ko', 'rakko', 'done', '구현')).toBeUndefined()
  expect(readingOf('ko', 'shisa', 'fail', '구현')).toBe('어떻게든 돼라~앗!')
})

test('a description that opens with a name hands the task to that character', () => {
  expect(namedMember('랏코: 로그인 버그 토벌')).toEqual({ member: 'rakko', rest: '로그인 버그 토벌' })
  expect(namedMember('토끼 - 설정 파일 찾기')).toEqual({ member: 'usagi', rest: '설정 파일 찾기' })
  expect(namedMember('포셰트 갑옷 씨: 버튼 색 고치기')).toEqual({ member: 'pochette', rest: '버튼 색 고치기' })
  expect(namedMember('헌책방: 문서 정리')).toEqual({ member: 'kani', rest: '문서 정리' })
  expect(namedMember('시사점 정리')).toEqual({ rest: '시사점 정리' })
  expect(memberNamed('해달')).toBe('rakko')
  expect(memberNamed(' 포쉐트 ')).toBe('pochette')
  expect(memberNamed('usage')).toBeUndefined()
  // 하치와레 by name is the main loop itself.
  expect(memberNamed('하치와레')).toBe('hachiware')
  expect(pickNote('ko', 'hachiware')).toContain('하치와레(주 세션)가 직접 처리한다')
  expect(pickNote('ko', 'rakko')).toContain('description을 "랏코: "로 시작한다')
})

test("a report's first line skips the sound a silent character opens with", () => {
  expect(firstLine('🐹 치이카와: 와, 와\n오타 3개를 고쳤다.')).toBe('오타 3개를 고쳤다.')
  expect(firstLine('🌰 쿠리만쥬: (손으로 X를 그린다)\n\n- 테스트 2개가 실패한다.')).toBe('테스트 2개가 실패한다.')
  expect(firstLine('🦁 시사: 로그인 폼을 고쳤습니다. 테스트도 모두 통과했어요.')).toBe('로그인 폼을 고쳤습니다. 테스트도 모두 통과했어요.')
  expect(firstLine('## 결과\n찾았다.')).toBe('결과')
  expect(firstLine('🐰 우사기: 우라')).toBe('우라')
  // A character that talks is taken at its word, however short the line.
  expect(firstLine('🦦 랏코: 결과: 실패\n검증: 테스트 20개 통과')).toBe('결과: 실패')
  // The one who asks to see a task is shown the first few lines.
  expect(firstLines('🐹 치이카와: 와, 와\n\n- 오타 3개를 고쳤다.\n- `README.md` 한 곳.\n\n---\n끝.', 6)).toEqual(['오타 3개를 고쳤다.', 'README.md 한 곳.', '끝.'])
  expect(firstLines('한 줄\n두 줄\n세 줄', 2)).toEqual(['한 줄', '두 줄'])
})

test("a silent character's first line is skipped only where it is that character's own sound", () => {
  // Short as it is, what the task came to is not a sound.
  expect(firstLine('🐹 치이카와: 결과: 실패\n검증: 테스트 20개 통과')).toBe('결과: 실패')
  expect(firstLine('🌰 쿠리만쥬: 통과\n테스트 20개가 모두 통과한다.')).toBe('통과')
  expect(firstLines('🦀 카니: 없음\n관련 문서를 찾지 못했다.', 6)).toEqual(['없음', '관련 문서를 찾지 못했다.'])
  // Its sound, drawn out or marked up as it may be, and a gesture of its own in its brackets, are.
  expect(firstLine('🐰 우사기: 우라라라라!\n설정 파일은 src/config.ts 에 있다.')).toBe('설정 파일은 src/config.ts 에 있다.')
  expect(firstLine('🐹 치이카와: "와… 아…"\n테스트가 실패했다.')).toBe('테스트가 실패했다.')
  expect(firstLine('🦀 카니: (쿡쿡 웃는다)\n문서 세 개를 정리했다.')).toBe('문서 세 개를 정리했다.')
  expect(firstLine('🦀 카니: *(물음표를 띄운다)*\n관련 문서를 찾지 못했다.')).toBe('관련 문서를 찾지 못했다.')
  // In whichever language it was written: the worker may have been cast in another.
  expect(firstLine('🦀 古本屋: (クスクス笑う)\n文書を三つ整理した。')).toBe('文書を三つ整理した。')
  // What only stands in brackets is no gesture: what the task came to is kept, and so is another character's gesture.
  expect(firstLine('🦀 카니: (결과: 실패)\n검증: 테스트 20개 중 2개 실패')).toBe('(결과: 실패)')
  expect(firstLines('🐹 치이카와: (테스트 2개 실패)\n로그인 폼의 검증이 깨졌다.', 6)).toEqual(['(테스트 2개 실패)', '로그인 폼의 검증이 깨졌다.'])
  expect(firstLine('🦀 카니: (손으로 X를 그린다)\n문서가 없다.')).toBe('(손으로 X를 그린다)')
})

test('the instruction blocks tell each character how it talks, and the silent ones not to', () => {
  const leader = leaderSection('ko')

  expect(leader).toContain('너는 하치와레')
  expect(leader).toContain('"그 말은 ○○라는 거?"')
  expect(leader).toContain('치이카와, 우사기, 쿠리만쥬, 카니는 원작에서 말을 하지 않는다')
  expect(leader).toContain('밝고 긍정적인 반말')
  // Light work is the three's own; the others are called in for what takes effort.
  expect(leader).toContain('가벼운 일(파일 몇 개 읽고 찾기, 작은 수정, 짧은 명령, 간단한 질문)은 친구를 부르지 않고 직접 한다')
  expect(leader).toContain('노력이 드는 일')
  expect(leader).toContain('우사기가 찾는 것으로')
  expect(leaderSection('ko', false, false)).not.toContain('우사기가 찾는 것으로')
  expect(leaderSection('ko', true)).toContain('밝고 긍정적인 존댓말')

  const mute = memberBlock('ko', 'chiikawa', '구현')

  expect(mute).toContain('[치이카와 배역]')
  expect(mute).toContain('너는 지휘자 하치와레가 아니라 치이카와다')
  expect(mute).toContain('둘째 줄부터는 캐릭터 말투 없이')
  expect(mute).toContain('"🐹 치이카와:"')

  const voiced = memberBlock('ko', 'shisa', '구현')

  expect(voiced).toContain('공손하고 성실한 존댓말')
  expect(voiced).toContain('"스이~ 스이~"')
  // Each one's habit of speech is told with the line it comes from.
  expect(voiced).toContain('"우레시사~" (うれシーサー, 기쁠 때)')
  expect(leader).toContain('～ってコト!?')
  expect(memberBlock('ko', 'momonga', '검토')).toContain('같은 말을 되풀이하며 떼를 쓴다')
  expect(memberBlock('ko', 'rakko', '구현')).toContain('짧게 끊어 단정적으로 말한다')
  expect(memberBlock('ko', 'usagi', '탐색')).toContain('"우라" / "야하" (ウラ, ヤハ')
  for (const id of ORDER) expect(LINES[id].length).toBeGreaterThan(0)
  // A format with no room for a name comes before the character.
  expect(mute).toContain('JSON만')
  expect(orcaBlock('ko', 'rakko', '구현')).toContain('이름과 대사는 모두 뺀다')
  // What is left out is the character's alone, never the result that was asked for.
  for (const told of [orcaBlock('en', 'rakko', '구현'), memberBlock('en', 'rakko', '구현')]) {
    expect(told).toContain("leave out only the character's name and the character's dialogue, and still give what was asked for, in exactly that format.")
    expect(told).not.toContain('every line')
  }
})

test('the plan always has the three the comic is about, a card for each guest at work, and the rest on the bench', () => {
  const idle = planOf(scene(), { columns: 72, rows: 40 })

  expect(idle.density).toBe('full')
  expect(idle.cards).toEqual(['hachiware', 'chiikawa', 'usagi'])
  expect(idle.bench).toHaveLength(7)
  // Seven on the bench sit four and three.
  expect(idle.strip).toBe(4)
  expect(idle.hasSheet).toBe(false)
  expect(idle.extras).toBe(3)
  // With nothing said yet there is one cut: 하치와레 waiting.
  expect(idle.talk).toBe(1)

  const busy = planOf(scene([task('usagi', 'running'), task('rakko', 'running')]), { columns: 72, rows: 40 })

  expect(busy.cards).toEqual(['hachiware', 'chiikawa', 'usagi', 'rakko'])
  expect(busy.bench).toHaveLength(6)
  // Six sit in one row.
  expect(busy.strip).toBe(6)

  // A character asked about has its sheet, at work or resting; with little room the sheet is all there is.
  expect(planOf({ ...scene([task('rakko', 'running')]), watched: 'rakko' }, { columns: 72, rows: 50 })).toMatchObject({ hasSheet: true, isSheetOnly: false })
  expect(planOf({ ...scene(), watched: 'kani' }, { columns: 72, rows: 50 }).hasSheet).toBe(true)
  expect(planOf({ ...scene(), watched: 'kani' }, { columns: 44, rows: 14 })).toMatchObject({ density: 'slim', isSheetOnly: false, cards: ['hachiware', 'chiikawa'] })
  expect(planOf({ ...scene(), watched: 'kani' }, { columns: 44, rows: 10 })).toMatchObject({ density: 'slim', isSheetOnly: true })

  // A guest keeps its card a moment after its work ends, then waits on the bench as a character.
  const ended = { ...task('rakko', 'done'), endedAt: 1000 }

  expect(planOf({ ...scene([ended]), now: 10_000 }, { columns: 72, rows: 50 }).cards).toEqual(['hachiware', 'chiikawa', 'usagi', 'rakko'])
  expect(planOf({ ...scene([ended]), now: 40_000 }, { columns: 72, rows: 50 })).toMatchObject({ cards: ['hachiware', 'chiikawa', 'usagi'], strip: 4 })

  // The rows left over go to the seats of the ones resting first, then to more of the conversation: three cuts at most.
  const said = (at: number): Scene['feed'][number] => ({ member: 'usagi', quote: asIs('우라'), note: asIs(''), at, mood: 'calm' })
  const chatty = { ...scene(), feed: [1, 2, 3, 4, 5].map(said) }

  expect(planOf(chatty, { columns: 72, rows: 40 })).toMatchObject({ density: 'full', strip: 4, talk: 5 })
  expect(planOf(chatty, { columns: 72, rows: 34 })).toMatchObject({ density: 'full', strip: 4, talk: 3 })
  // Three cuts come before the seats.
  expect(planOf(chatty, { columns: 72, rows: 24 })).toMatchObject({ density: 'full', strip: 0, talk: 3 })
  // A long conversation fills a tall page, eight cuts at most.
  expect(planOf({ ...scene(), feed: Array.from({ length: 12 }, (_, at) => said(at)) }, { columns: 72, rows: 70 })).toMatchObject({ strip: 4, talk: 8 })
  // The usage in full takes its rows from the same room.
  expect(planOf({ ...chatty, isUsageOpen: true }, { columns: 72, rows: 40 }).talk).toBe(4)

  // The conversation alone has every row under the title and its rule: a cut each three rows, or a line each in a narrow pane.
  expect(planOf({ ...chatty, isTalkOnly: true }, { columns: 72, rows: 50 })).toMatchObject({ density: 'full', cards: [], strip: 0, talk: 16, extras: 0 })
  expect(planOf({ ...chatty, isTalkOnly: true }, { columns: 44, rows: 12 })).toMatchObject({ density: 'slim', cards: [], talk: 10 })

  // One whose task waits has no cut: it sits with the ones resting until its work goes on.
  const held = planOf(scene([task('shisa', 'waiting'), task('rakko', 'running')]), { columns: 72, rows: 50 })

  expect(held.cards).toEqual(['hachiware', 'chiikawa', 'usagi', 'rakko'])
  expect(held.bench.includes('shisa')).toBe(true)

  const tight = planOf(scene([task('usagi', 'running')]), { columns: 44, rows: 12 })

  expect(tight.density).toBe('slim')
  expect(tight.strip).toBe(0)

  // With room for one card, the one at work is named as at work, not seated among the resting.
  const cramped = planOf(scene([task('pochette', 'running'), task('usagi', 'done')]), { columns: 44, rows: 6 })

  expect(cramped.cards).toEqual(['hachiware'])
  expect(cramped.hidden).toEqual(['pochette'])
  expect(cramped.bench.includes('pochette')).toBe(false)
  expect(cramped.bench.includes('usagi')).toBe(true)

  // The rows around the cards go as the room does: the help first, the bench last.
  expect(planOf(scene(), { columns: 44, rows: 6 }).extras).toBe(3)
  expect(planOf(scene(), { columns: 44, rows: 4 }).extras).toBe(1)
  expect(planOf(scene(), { columns: 44, rows: 3 }).extras).toBe(0)
})

test('text is measured and cut in terminal cells, and a spec copy sits beside its spec', () => {
  expect(cells('하치와레')).toBe(8)
  expect(fit('하치와레가 지휘한다', 9)).toBe('하치와레…')
  expect(voicedSpecPath('/w/a/find.spec.md', 'usagi')).toBe('/w/a/find.spec.chiikawa-usagi.md')
  // A letter with its accent is one cell, an emoji with all joined to it two.
  expect(cells('e\u0301')).toBe(1)
  expect(cells('\u{1f469}\u200d\u{1f4bb}')).toBe(2)
  expect(cells('\u26a0\ufe0f')).toBe(2)
  expect(fit('\u{1f469}\u200d\u{1f4bb}', 2)).toBe('\u{1f469}\u200d\u{1f4bb}')
  expect(fit('가\u{1f469}\u200d\u{1f4bb}나', 4)).toBe('가…')
})

test('a sign the terminal draws as a picture is two cells, and one it draws as a letter is one', () => {
  // These are pictures with no selector asking for it.
  for (const sign of ['✅', '⌚', '⏰', '⭐']) expect(`${sign} ${cells(sign)}`).toBe(`${sign} 2`)
  // These are letters unless asked, and stay one cell.
  for (const sign of ['―', '…', '▶', '▷', '●', '✓', '─', '·']) expect(`${sign} ${cells(sign)}`).toBe(`${sign} 1`)
  expect(cells('한')).toBe(2)
  expect(cells('\u{1f1f0}\u{1f1f7}')).toBe(2)
  expect(cells('\u{1f469}\u200d\u{1f4bb}')).toBe(2)
  expect(cells('✅ 끝')).toBe(5)
  expect(fit('✅✅✅', 5)).toBe('✅✅…')
})

test('what a character was paid outlasts the tasks it was paid for', () => {
  const paid = { usagi: { fresh: 2000, cached: 50_000, out: 340 } }
  const by = spentBy({ paid, leaderTokens: { fresh: 10, cached: 0, out: 5 } })

  expect(by.usagi).toEqual(paid.usagi)
  expect(by.rakko).toEqual(ZERO)
  expect(by.hachiware).toEqual({ fresh: 10, cached: 0, out: 5 })
})

test('a task handed on again loses the block it ends with, and keeps one it only tells of', () => {
  const handed = `로그인 폼을 고쳐 줘.${memberBlock('ko', 'shisa', '구현')}`

  expect(unvoiced(handed)).toBe('로그인 폼을 고쳐 줘.')
  expect(unvoiced(`로그인 폼을 고쳐 줘.${orcaBlock('ko', 'rakko', '구현')}\n`)).toBe('로그인 폼을 고쳐 줘.')
  // The mark in the middle of a task is part of what was asked.
  for (const told of [`"${MARK}" 표시가 무엇인지 설명해 줘.`, `${handed}\n\n여기까지가 지난번 지시다. 이번에는 테스트만 고쳐 줘.`]) expect(unvoiced(told)).toBe(told)
})

test('a fleet-run is read where the shell runs it, with what its variables held then', () => {
  const later = findFleetRuns('X=/w/a.spec.md; fleet-run codex-build --spec $X --out /w/a.out.md; X=/w/b.spec.md')

  expect(later.map(run => run.spec)).toEqual(['/w/a.spec.md'])
  expect(later[0]?.title).toBe('a')
  // Single quotes keep the `$`: the path is not known.
  expect(findFleetRuns("X=/w/a.spec.md; fleet-run codex-build --spec '$X' --out /w/a.out.md")[0]?.spec).toBeUndefined()
  // A command another command prints, or a here-document holds, is not a launch.
  expect(findFleetRuns('printf "%s" "fleet-run codex-build --spec /w/a.md --out /w/a.out.md"')).toEqual([])
  expect(findFleetRuns("echo 'run later; fleet-run codex-build --spec /w/a.md'")).toEqual([])
  expect(findFleetRuns('cat > /w/go.sh <<EOF\nfleet-run codex-build --spec /w/a.md\nEOF')).toEqual([])
  expect(findFleetRuns('cat > /w/go.sh <<EOF\nhello\nEOF\nfleet-run codex-build --spec /w/a.md')).toHaveLength(1)

  const handed = 'RUN=/w/runs; orca terminal create --command "fleet-run codex-hard --cwd /w --spec $RUN/a.spec.md --out \\"$RUN/a.out.md\\"; echo done" --json'
  const [run] = findFleetRuns(handed)

  expect(run).toMatchObject({ profile: 'codex-hard', spec: '/w/runs/a.spec.md', out: '/w/runs/a.out.md', isBackground: false })
  expect(handed.slice(run?.specSpan?.[0], run?.specSpan?.[1])).toBe('$RUN/a.spec.md')
  // Handed on in single quotes, the outer shell's variables are not the worker's.
  expect(findFleetRuns("RUN=/w/runs; sh -c 'fleet-run codex-hard --spec $RUN/a.spec.md'")[0]?.spec).toBeUndefined()
})

test('what only tells of a fleet-run is not one: a comment, a word printed, a line of a here-document', () => {
  for (const command of [
    'echo --command "fleet-run codex-build --spec /fixture/a.md"',
    'echo "orca terminal create --command \\"fleet-run codex-build --spec /fixture/a.md\\""',
    '# note; fleet-run codex-build --spec /fixture/a.md',
    'ls /w # fleet-run codex-build --spec /fixture/a.md\necho ok',
    'cat <<-EOF | tee /w/go.sh\n\tfleet-run codex-build --spec /fixture/a.md\n\tEOF',
    "cat <<'EOF'\norca terminal create --command \"fleet-run codex-build --spec /fixture/a.md\"\nEOF",
    'orca terminal create --title "fleet-run codex-hard" --json',
    'git commit -m "fleet-run codex-build --spec /fixture/a.md"',
    // A quote that is never closed is not a command this reads at all.
    'fleet-run codex-build --spec "/fixture/a.md',
  ]) {
    expect(`${command} ${findFleetRuns(command).length}`).toBe(`${command} 0`)
  }

  // Where the words are run, they are a launch: on their own, after a wrapper, handed to a shell or to Orca.
  for (const command of [
    'fleet-run codex-build --spec /fixture/a.md',
    '# 조사 맡기기\nfleet-run codex-build --spec /fixture/a.md',
    'nohup fleet-run codex-build --spec /fixture/a.md > /dev/null 2>&1 &',
    'FLEET_BROWSER=0 timeout 600 fleet-run codex-build --spec /fixture/a.md',
    'env A=1 /home/me/.local/bin/fleet-run codex-build --spec /fixture/a.md',
    'bash -lc "cd /w && fleet-run codex-build --spec /fixture/a.md"',
    'orca terminal create --worktree "id:$ORCA_WORKTREE_ID" --title "codex-build: a" \\\n  --command "fleet-run codex-build --spec /fixture/a.md; echo \'[fleet-run 끝]\'" --json',
    'HANDLE=$(orca terminal create --command "fleet-run codex-build --spec /fixture/a.md" --json | jq -r .handle)',
  ]) {
    const [run] = findFleetRuns(command)

    expect(`${command} ${run?.spec}`).toBe(`${command} /fixture/a.md`)
    expect(command.slice(run?.specSpan?.[0], run?.specSpan?.[1])).toBe('/fixture/a.md')
  }
})

test("a fleet-run's paths are filled in as the shell fills them, and left as written where that is not sure", () => {
  // What is assigned before a command is that command's alone: its own arguments are filled in without it.
  const prefixed = 'X=/fixture/a.md; X=/fixture/b.md fleet-run codex-build --spec "$X"'
  const [run] = findFleetRuns(prefixed)

  expect(run?.spec).toBe('/fixture/a.md')
  expect(prefixed.slice(run?.specSpan?.[0], run?.specSpan?.[1])).toBe('$X')
  expect(findFleetRuns('X=/fixture/b.md fleet-run codex-build --spec "$X"')[0]).toEqual({ profile: 'codex-build', title: 'codex-build', hasOut: false, isBackground: false, isDetached: false })

  // Single quotes keep `$` and `~` as they are written, and so do double quotes a `~`.
  const spec = (command: string): string | undefined => findFleetRuns(command, '/home/me')[0]?.spec

  expect(spec('fleet-run codex-build --spec ~/a.md')).toBe('/home/me/a.md')
  expect(spec("fleet-run codex-build --spec '~/a.md'")).toBeUndefined()
  expect(spec('fleet-run codex-build --spec "~/a.md"')).toBeUndefined()
  expect(spec("X=/fixture/a.md; fleet-run codex-build --spec '$X'")).toBeUndefined()

  // An assignment that may not have been made, or was made in another shell, fills nothing in.
  for (const command of [
    'X=/fixture/a.md; [ -d /w ] && X=/fixture/b.md; fleet-run codex-build --spec $X',
    'X=/fixture/a.md; (X=/fixture/b.md); fleet-run codex-build --spec $X',
    'X=/fixture/a.md; for turn in 1 2; do fleet-run codex-build --spec $X; X=/fixture/b.md; done',
    'X="$(pwd)/a.md"; fleet-run codex-build --spec "$X"',
    'X=/fixture/a.md; read X; fleet-run codex-build --spec $X',
    'fleet-run codex-build --spec $UNSET/a.md',
    'P="/fixture/a b"; orca terminal create --command "fleet-run codex-build --spec $P.md"',
  ]) {
    const [unsure] = findFleetRuns(command)

    expect(`${command} ${unsure?.profile} ${unsure?.spec} ${unsure?.specSpan}`).toBe(`${command} codex-build undefined undefined`)
  }
  // One made for sure, in the shell the launch runs in, does.
  expect(spec('X=/fixture/a.md; export X=/fixture/b.md; if true; then fleet-run codex-build --spec $X; fi')).toBe('/fixture/b.md')
})

test('an `&` after a fleet-run leaves it running, and a redirect or an `&&` does not', () => {
  const isBackground = (command: string): boolean | undefined => findFleetRuns(command)[0]?.isBackground

  expect(isBackground('fleet-run codex-build --spec /w/a.md --out /w/a.out.md & echo launched')).toBe(true)
  expect(isBackground('fleet-run codex-build --spec /w/a.md --out /w/a.out.md > /w/log 2>&1 &')).toBe(true)
  expect(isBackground('fleet-run codex-build --spec /w/a.md --out /w/a.out.md 2>&1 | tail -3')).toBe(false)
  expect(isBackground('fleet-run codex-build --spec /w/a.md --out /w/a.out.md && echo done')).toBe(false)
  expect(findFleetRuns('fleet-run codex-build --spec /w/a.md --out /w/a.out.md 2>&1 | tail -3')[0]?.out).toBe('/w/a.out.md')
})

/** Each launch a command makes, as it was read: its profile, its spec and the word of the command the spec was read from, its result, and how it is run. */
const read = (command: string): string[] =>
  findFleetRuns(command, '/home/me').map(run =>
    [run.profile, run.spec ?? '?', run.specSpan === undefined ? '?' : command.slice(run.specSpan[0], run.specSpan[1]), run.out ?? (run.hasOut ? '?' : '-'), run.isBackground || run.isDetached ? 'away' : 'waited'].join(' '),
  )

test('a redirection is no word of the command it stands in: what it leads to is never the spec or the result', () => {
  const plain = ['codex-build /fixture/a.md /fixture/a.md - waited']
  const kept = ['codex-build /fixture/a.md /fixture/a.md /fixture/o.md waited']

  // Between the option and its value, apart from its target or joined to it, with a number before it or not.
  expect(read('fleet-run codex-build --spec > /fixture/log /fixture/a.md')).toEqual(plain)
  expect(read('fleet-run codex-build --spec >/fixture/log /fixture/a.md')).toEqual(plain)
  expect(read('fleet-run codex-build --spec 2>> /fixture/log /fixture/a.md')).toEqual(plain)
  expect(read('fleet-run codex-build --spec /fixture/a.md 2>/fixture/log --out /fixture/o.md')).toEqual(kept)
  expect(read('fleet-run codex-build --out > /fixture/log /fixture/o.md --spec /fixture/a.md')).toEqual(kept)
  expect(read('fleet-run codex-build 2>&1 --spec /fixture/a.md >>/fixture/log --out /fixture/o.md')).toEqual(kept)
  expect(read('fleet-run codex-build --spec /fixture/a.md &> /fixture/log --out /fixture/o.md')).toEqual(kept)
  expect(read('fleet-run codex-build --spec /fixture/a.md >& /fixture/log --out /fixture/o.md')).toEqual(kept)
  expect(read('fleet-run codex-build --spec /fixture/a.md < /fixture/in --out /fixture/o.md')).toEqual(kept)
  expect(read('fleet-run codex-build --spec /fixture/a.md <<< "in" --out /fixture/o.md')).toEqual(kept)
  expect(read('fleet-run codex-build --spec /fixture/a.md 3>&- --out /fixture/o.md')).toEqual(kept)
  // Before the command, and before its profile.
  expect(read('> /fixture/log fleet-run codex-build --spec /fixture/a.md')).toEqual(plain)
  expect(read('2>/fixture/log fleet-run codex-build --spec /fixture/a.md')).toEqual(plain)
  expect(read('fleet-run > /fixture/log codex-build --spec /fixture/a.md')).toEqual(plain)
  // With nothing after it but a redirection, the option was given no value: the launch is one all the same, with no spec to copy.
  expect(read('fleet-run codex-build --spec > /fixture/log')).toEqual(['codex-build ? ? - waited'])
  expect(read('fleet-run codex-build --spec /fixture/a.md --out > /fixture/log')).toEqual(['codex-build /fixture/a.md /fixture/a.md - waited'])
  // A number that is a word of its own is a word, and one that is a value stays one.
  expect(read('fleet-run codex-build --spec /fixture/a.md --retries 2 > /fixture/log')).toEqual(plain)
  expect(read('fleet-run codex-build --spec /fixture/2 > /fixture/log')).toEqual(['codex-build /fixture/2 /fixture/2 - waited'])
  // One kept in a variable assigns that variable: it is no word of the command either, and nothing beside it is sure.
  expect(read('fleet-run codex-build --spec /fixture/a.md {log}>/fixture/log --out /fixture/o.md')).toEqual(['codex-build ? ? ? waited'])
})

test('what is assigned before a command leaves its variable unknown after it, and a declaration is read only where it is sure', () => {
  const unknown = ['codex-build ? ? - waited']

  // The assignment may outlast its command, as before `export` or a special builtin of `sh`: neither value is sure after it.
  for (const between of ['X=/fixture/b.md export X', 'X=/fixture/b.md :', 'X=/fixture/b.md true', 'X=/fixture/b.md env ls', 'X=/fixture/b.md fleet-run codex-scout --spec /fixture/c.md']) {
    expect(read(`X=/fixture/a.md; ${between}; fleet-run codex-build --spec "$X"`).at(-1)).toBe(unknown[0])
  }
  // Another variable's is still known.
  expect(read('X=/fixture/a.md; Y=/fixture/b.md export Y; fleet-run codex-build --spec "$X"')).toEqual(['codex-build /fixture/a.md $X - waited'])
  // `export` and `readonly` that only assign are assignments; with an option before them, what they do is not sure.
  expect(read('X=/fixture/a.md; export X; fleet-run codex-build --spec "$X"')).toEqual(['codex-build /fixture/a.md $X - waited'])
  for (const declared of ['export', 'readonly']) {
    expect(read(`X=/fixture/a.md; ${declared} X=/fixture/b.md; fleet-run codex-build --spec "$X"`)).toEqual(['codex-build /fixture/b.md $X - waited'])
    expect(read(`X=/fixture/a.md; ${declared} -x X=/fixture/b.md; fleet-run codex-build --spec "$X"`)).toEqual(unknown)
    expect(read(`X=/fixture/a.md; true && ${declared} X=/fixture/b.md; fleet-run codex-build --spec "$X"`)).toEqual(unknown)
  }
  // The other declarations are not every shell's, and one of them fails outside a function: none is read.
  for (const declared of ['declare', 'typeset', 'local']) {
    expect(read(`X=/fixture/a.md; ${declared} X=/fixture/b.md; fleet-run codex-build --spec "$X"`)).toEqual(unknown)
    expect(read(`X=/fixture/a.md; ${declared} -x X=/fixture/b.md; fleet-run codex-build --spec "$X"`)).toEqual(unknown)
  }
})

test("a fleet-run in a function's body is no launch: whether the function is called is not told", () => {
  for (const defined of [
    'f() { fleet-run codex-build --spec /fixture/a.md; }',
    'f () {\n  fleet-run codex-build --spec /fixture/a.md\n}',
    'function f { fleet-run codex-build --spec /fixture/a.md; }',
    'function f() {\n  fleet-run codex-build --spec /fixture/a.md &\n}',
    'f() ( fleet-run codex-build --spec /fixture/a.md )',
    'f() { if true; then fleet-run codex-build --spec /fixture/a.md; fi; }',
    'run-it() { bash -c "fleet-run codex-build --spec /fixture/a.md"; }',
  ]) {
    expect(`${defined} => ${read(defined).join()}`).toBe(`${defined} => `)
    // What follows the body is a launch as before, with no path that is sure: a function may stand for any command.
    expect(read(`${defined}\nfleet-run codex-scout --spec /fixture/b.md`)).toEqual(['codex-scout ? ? - waited'])
    expect(read(`${defined}; f; run-it`)).toEqual([])
  }
  // A function may be called by its name or by the shell itself, as zsh calls `chpwd`: past a definition no variable is known.
  expect(read('X=/fixture/a.md; f() { X=/fixture/b.md; }; fleet-run codex-build --spec $X')).toEqual(['codex-build ? ? - waited'])
  expect(read('X=/fixture/a.md; f() { X=/fixture/b.md; }; f; fleet-run codex-build --spec $X')).toEqual(['codex-build ? ? - waited'])
  expect(read('X=/fixture/a.md; chpwd() { X=/fixture/b.md; }; cd /; fleet-run codex-build --spec "$X"')).toEqual(['codex-build ? ? - waited'])
  // Braces and parentheses that are no function's are read through.
  expect(read('{ fleet-run codex-build --spec /fixture/a.md; }')).toHaveLength(1)
  expect(read('( fleet-run codex-build --spec /fixture/a.md )')).toHaveLength(1)
  expect(read('if true; then fleet-run codex-build --spec /fixture/a.md; fi')).toHaveLength(1)
})

test('each launch of a command is handed on or waited for by what stands around it alone', () => {
  // The first is waited for, though the second is handed to an Orca terminal.
  expect(read('fleet-run codex-build --spec /fixture/a.md; orca terminal create --command "fleet-run codex-scout --spec /fixture/b.md"')).toEqual([
    'codex-build /fixture/a.md /fixture/a.md - waited',
    'codex-scout /fixture/b.md /fixture/b.md - away',
  ])
  expect(read('nohup fleet-run codex-build --spec /fixture/a.md; fleet-run codex-scout --spec /fixture/b.md')).toEqual(['codex-build /fixture/a.md /fixture/a.md - away', 'codex-scout /fixture/b.md /fixture/b.md - waited'])
  expect(read('nohup bash -c "fleet-run codex-build --spec /fixture/a.md" & fleet-run codex-scout --spec /fixture/b.md')).toEqual(['codex-build /fixture/a.md /fixture/a.md - away', 'codex-scout /fixture/b.md /fixture/b.md - waited'])
  expect(read('fleet-run codex-build --spec /fixture/a.md & fleet-run codex-scout --spec /fixture/b.md')).toEqual(['codex-build /fixture/a.md /fixture/a.md - away', 'codex-scout /fixture/b.md /fixture/b.md - waited'])
  // A word of the command that only reads like one of those hands nothing on.
  expect(read('echo nohup; fleet-run codex-build --spec /fixture/a.md')).toEqual(['codex-build /fixture/a.md /fixture/a.md - waited'])
  expect(read('fleet-run codex-build --spec /fixture/a.md # orca terminal create')).toEqual(['codex-build /fixture/a.md /fixture/a.md - waited'])
})

test('a profile in quotes is read, and a variable a script in single quotes leaves to its own shell is not', () => {
  expect(read("fleet-run 'codex-build' --spec /fixture/a.md")).toEqual(['codex-build /fixture/a.md /fixture/a.md - waited'])
  expect(read('fleet-run "codex-build" "--spec" /fixture/a.md "--out" /fixture/o.md')).toEqual(['codex-build /fixture/a.md /fixture/a.md /fixture/o.md waited'])
  expect(read('fleet-run "$PROFILE" --spec /fixture/a.md')).toEqual([])
  // The launch is one, with a result file named: where it is, and what the spec is, are not told.
  expect(read(`export X=/fixture/a.md; bash -c 'fleet-run codex-build --spec "$X" --out "$X.out"'`)).toEqual(['codex-build ? ? ? waited'])
})

test('a path is read in the letters of any script, and nothing that only looks like a space parts a word', () => {
  // Hangul, kana and Han characters, bare or in quotes, composed or not.
  expect(read('fleet-run codex-build --spec ./작업/지시.md --out ~/メモ/結果.md')).toEqual(['codex-build ./작업/지시.md ./작업/지시.md /home/me/メモ/結果.md waited'])
  expect(read('fleet-run codex-build --spec "/w/메모/지시.md" --out \'/w/メモ/けっか.md\'')).toEqual(['codex-build /w/메모/지시.md /w/메모/지시.md /w/メモ/けっか.md waited'])
  expect(read(`fleet-run codex-build --spec /w/${'가'.normalize('NFD')}/${'が'.normalize('NFD')}.md`)[0]).toContain(`codex-build /w/${'가'.normalize('NFD')}/${'が'.normalize('NFD')}.md`)
  expect(read('D=/w/작업; fleet-run codex-build --spec $D/지시.md --out="$D/結果.md"')).toEqual(['codex-build /w/작업/지시.md $D/지시.md /w/작업/結果.md waited'])
  expect(voicedSpecPath('/w/작업/지시.md', 'usagi')).toBe('/w/작업/지시.chiikawa-usagi.md')
  expect(voicedSpecPath('/w/メモ/しじ', 'kani')).toBe('/w/メモ/しじ.chiikawa-kani.md')
  // A space is read where one stretch of quotes holds the word together, and the path goes back inside those quotes.
  expect(read('fleet-run codex-build --spec "/w/내 작업/지시 1.md" --out \'/w/내 작업/결과.md\'')).toEqual(['codex-build /w/내 작업/지시 1.md /w/내 작업/지시 1.md /w/내 작업/결과.md waited'])
  expect(read('D="/w/내 작업"; fleet-run codex-build --spec "$D/지시.md"')).toEqual(['codex-build /w/내 작업/지시.md $D/지시.md - waited'])
  // Not where the shell would part it, or where the word is more than the one stretch.
  expect(read('D="/w/내 작업"; fleet-run codex-build --spec $D/지시.md')).toEqual(['codex-build ? ? - waited'])
  expect(read('fleet-run codex-build --spec "/w/내 작업"/지시.md')).toEqual(['codex-build ? ? - waited'])
  expect(read('fleet-run codex-build --spec /w/내\\ 작업/지시.md')).toEqual(['codex-build ? ? - waited'])
  // An ideographic space, a no-break space and full-width signs part no word for the shell: the word is read whole, and is not plain.
  for (const odd of ['　', ' ', '；', '＞', '＄', '’', '（']) {
    expect(read(`fleet-run codex-build --spec /w/a${odd}b.md --out /w/o${odd}.md`)).toEqual(['codex-build ? ? ? waited'])
    expect(read(`fleet-run${odd}codex-build --spec /w/a.md`)).toEqual([])
  }
})

/** Commands whose launch every shell hands the same paths: each with how its launches are read. */
const SURE: readonly (readonly [string, ...string[]])[] = [
  ['fleet-run codex-build --spec /fixture/a.md --out /fixture/o.md', 'codex-build /fixture/a.md /fixture/a.md /fixture/o.md waited'],
  ['X=/fixture/a.md; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; fleet-run codex-build --spec $X', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; fleet-run codex-build --spec=$X', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; fleet-run codex-build --spec ${X} --out "${X}.out"', 'codex-build /fixture/a.md ${X} /fixture/a.md.out waited'],
  ['X=/fixture/a; fleet-run codex-build --spec $X.md --out $X-1.md', 'codex-build /fixture/a.md $X.md /fixture/a-1.md waited'],
  ['D=/fixture; fleet-run codex-build --spec $D/a.md --out "$D/o.md"', 'codex-build /fixture/a.md $D/a.md /fixture/o.md waited'],
  ['D=/fixture; S=$D/a.md; fleet-run codex-build --spec "$S"', 'codex-build /fixture/a.md $S - waited'],
  ['D=/fixture S=$D/a.md; fleet-run codex-build --spec "$S"', 'codex-build /fixture/a.md $S - waited'],
  ['X=/fixture/b.md; X=/fixture/a.md; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['export X=/fixture/a.md; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; export X; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['readonly X=/fixture/a.md; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; X=/fixture/b.md fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ["X='/fixture/내 작업/a.md'; fleet-run codex-build --spec \"$X\"", 'codex-build /fixture/내 작업/a.md $X - waited'],
  ['fleet-run codex-build --spec ~/a.md', 'codex-build /home/me/a.md ~/a.md - waited'],
  ['X=~/a.md; fleet-run codex-build --spec "$X"', 'codex-build /home/me/a.md $X - waited'],
  ['X=$HOME/a.md; fleet-run codex-build --spec "$X"', 'codex-build /home/me/a.md $X - waited'],
  ['HOME=/fixture; fleet-run codex-build --spec ~/a.md', 'codex-build /fixture/a.md ~/a.md - waited'],
  // Commands that change no variable stand between the assignment and the launch.
  ['X=/fixture/a.md; mkdir -p /fixture; echo "$X" > /fixture/log; ls /fixture | head -3; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; cd /fixture && fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; [ -f "$X" ] || echo missing; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; command -v fleet-run > /dev/null && fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; printf \'%s\\n\' "$X"; printf "%s %s\\n" a b; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; NOW=$(date +%s); echo "$(X=/fixture/b.md)"; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ["X=/fixture/a.md; cat > /fixture/note.md <<'EOF'\nX=/fixture/b.md; : $((X=2))\nEOF\nfleet-run codex-build --spec \"$X\"", 'codex-build /fixture/a.md $X - waited'],
  ['set -euo pipefail; X=/fixture/a.md; fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  // Behind what runs the command named after it, in the background, and in a script handed on.
  ['X=/fixture/a.md; nohup fleet-run codex-build --spec "$X" > /fixture/log 2>&1 &', 'codex-build /fixture/a.md $X - away'],
  ['X=/fixture/a.md; timeout 600 fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; env A=1 fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; bash -c "fleet-run codex-build --spec $X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; sh -c \'X=/fixture/b.md; fleet-run codex-build --spec "$X"\'', 'codex-build /fixture/b.md $X - waited'],
  ['X=/fixture/a.md; cat <(fleet-run codex-build --spec "$X")', 'codex-build /fixture/a.md $X - waited'],
  // The ways a conductor hands a task to an Orca terminal.
  [
    'R=/fixture/run; orca terminal create --worktree "id:$ORCA_WORKTREE_ID" --title "codex-hard: x" --command "fleet-run codex-hard --no-browser --cwd $R --spec $R/x.spec.md --out $R/x.out.md --timeout-min 40; echo \'[끝]\'" --json 2>&1 | grep handle',
    'codex-hard /fixture/run/x.spec.md $R/x.spec.md /fixture/run/x.out.md away',
  ],
  [
    'RUN=/fixture/run; mkdir -p "$RUN"; cat > "$RUN/a.spec.md" <<\'EOF\'\n# 작업지시\nfleet-run codex-build --spec /fixture/no.md\nEOF\norca terminal create --command "fleet-run codex-build --cwd $RUN --spec $RUN/a.spec.md --out $RUN/a.out.md" --json',
    'codex-build /fixture/run/a.spec.md $RUN/a.spec.md /fixture/run/a.out.md away',
  ],
  ['R=/fixture/run; HANDLE=$(orca terminal create --command "fleet-run codex-build --spec $R/a.spec.md --out $R/a.out.md" --json | jq -r .handle); echo "$HANDLE"', 'codex-build /fixture/run/a.spec.md $R/a.spec.md /fixture/run/a.out.md away'],
  ['R=/fixture/run; orca terminal create --command "bash -c \'fleet-run codex-build --spec $R/a.md\'"', 'codex-build /fixture/run/a.md $R/a.md - away'],
]

/** Statements after which what `X` holds is not what it was assigned, or may not be, in some shell. */
const CHANGING: readonly string[] = [
  // Arithmetic and expansions that assign.
  ': "$((X=2))"',
  ': $((X++))',
  '((X=2))',
  ': $[X=2]',
  'let X=2',
  ': ${X:=/fixture/b.md}',
  ': ${Y=1}',
  '[[ X=2 -eq 2 ]]',
  // Builtins that assign, or that may as they are given.
  'builtin printf -v X /fixture/b.md',
  'printf -v X /fixture/b.md',
  "printf '%d' X=5",
  'printf "$FORMAT" X',
  'read X',
  'unset X',
  'getopts a X',
  'mapfile X',
  'test -t X=5',
  '[ -v "A[X=5]" ]',
  '[ "$UNSET" X=5 ]',
  'break X=5',
  'wait -p X',
  'declare X=/fixture/b.md',
  'typeset -u X',
  'local X=/fixture/b.md',
  'true {X}>/dev/null',
  // What may run anything, or change how the shell reads.
  'eval X=/fixture/b.md',
  'source /fixture/env.sh',
  '. /fixture/env.sh',
  "trap 'X=/fixture/b.md' DEBUG",
  'f() { X=/fixture/b.md; }; f',
  'chpwd() { X=/fixture/b.md; }; cd /',
  'alias true="X=/fixture/b.md"',
  'set -f',
  'set -k',
  'set -x',
  'setopt shwordsplit',
  'shopt -s nullglob',
  "PS4='$((X=2))'; set -x",
  'POSIXLY_CORRECT=1',
  // Assignments that may not have been made, or that are not plain.
  'true && X=/fixture/b.md',
  'false || X=/fixture/b.md',
  '(X=/fixture/b.md)',
  '{ X=/fixture/b.md; }',
  'true | X=/fixture/b.md',
  'X=/fixture/b.md &',
  'X=/fixture/b.md && true &',
  'time X=/fixture/b.md',
  'if true; then X=/fixture/b.md; fi',
  'for X in /fixture/b.md; do :; done',
  'while false; do :; done',
  'case a in a) X=/fixture/b.md;; esac',
  'X=/fixture/b.md :',
  'X+=x',
  'X=$(pwd)/a.md',
  'X=`pwd`/a.md',
  'X="/fixture/*.md"',
  'X==ls',
  'X=/fixture/a.md:~/b',
  'X=~other/a.md',
]

/** Launches whose paths are not sure as they are written, whatever stands before them. */
const UNSURE: readonly string[] = [
  // A variable written bare is parted by what `IFS` holds, and at the spaces in it.
  'X=/a.md; IFS=/; fleet-run codex-build --spec $X',
  'IFS=:; X=/fixture/a.md; fleet-run codex-build --spec $X --out ${X}.out',
  'X=/fixture/a.md; OLD=$IFS; fleet-run codex-build --spec=$X',
  'X="/fixture/a b.md"; fleet-run codex-build --spec $X',
  // More than a variable's name after the `$`.
  'X=/fixture/a.md; fleet-run codex-build --spec "$X:h"',
  'X=/fixture/a.md; fleet-run codex-build --spec $X:h',
  'X=/fixture/a.md; fleet-run codex-build --spec "$X[1]"',
  'X=/fixture/a; fleet-run codex-build --spec $X한글.md',
  'X=/fixture/a.md; fleet-run codex-build --spec "${X%.md}.md"',
  'X=/fixture/a.md; fleet-run codex-build --spec ${X:-/fixture/b.md}',
  'X=/fixture/a.md; fleet-run codex-build --spec "${X^^}"',
  'X=/fixture/a.md; fleet-run codex-build --spec $~X',
  // What a shell fills in by itself.
  'fleet-run codex-build --spec =ls',
  'fleet-run codex-build --spec ~other/a.md',
  'fleet-run codex-build --spec=~/a.md',
  'fleet-run codex-build --spec ~/a~b.md',
  'fleet-run codex-build --spec /fixture/*.md',
  'fleet-run codex-build --spec /fixture/{a,b}.md',
  'fleet-run codex-build --spec "$(echo /fixture/a.md)"',
  'fleet-run codex-build --spec `echo /fixture/a.md`',
  "fleet-run codex-build --spec $'/fixture/a.md'",
  'fleet-run codex-build --spec $PWD/a.md',
  'SECONDS=/fixture; fleet-run codex-build --spec $SECONDS/a.md',
  // A shell that is given more than the script, or another home.
  'X=/fixture/a.md; bash -x -c "fleet-run codex-build --spec $X"',
  "env SHELLOPTS=keyword bash -c 'fleet-run codex-build --spec a=b.md'",
  "HOME=/fixture bash -c 'fleet-run codex-build --spec ~/a.md'",
  "env HOME=/fixture sh -c 'fleet-run codex-build --spec ~/a.md'",
  "X=/fixture/a.md; sh -c 'fleet-run codex-build --spec $X'",
  'P="/fixture/a b"; orca terminal create --command "fleet-run codex-build --spec $P.md"',
  'X=/fixture/a.md; X=/fixture/b.md | true; fleet-run codex-build --spec "$X" --out "$X.out"',
  // zsh goes on from an `exec` of redirections alone in the shell it was put in as well: what follows is run twice.
  'exec 3>&1 & X=/fixture/b.md; fleet-run codex-build --spec "$X"',
  'exec 3>&1 | cat; X=/fixture/b.md; fleet-run codex-build --spec "$X"',
  'true && exec 3>&1 & X=/fixture/b.md; fleet-run codex-build --spec "$X"',
]

test('a path is sure in the forms every shell hands on alike, and in no other', () => {
  expect(SURE.length).toBeGreaterThanOrEqual(20)
  expect(CHANGING.length + UNSURE.length).toBeGreaterThanOrEqual(20)
  for (const [command, ...launches] of SURE) expect(`${command} => ${read(command).join(' | ')}`).toBe(`${command} => ${launches.join(' | ')}`)

  /** The launches of a command that were read with a path, where none is to be. */
  const sure = (command: string): string => read(command).filter(launch => !/^\S+ \? \? [?-] \w+$/.test(launch)).join(' | ')

  for (const command of UNSURE) expect(`${command} => ${sure(command)}`).toBe(`${command} => `)
  // Past what may change a variable, it is unknown however it is written: bare, in quotes, in a script handed on.
  for (const between of CHANGING) {
    for (const launch of ['fleet-run codex-build --spec "$X"', 'fleet-run codex-build --spec $X --out ${X}.out', 'orca terminal create --command "fleet-run codex-build --spec $X --out $X.out; echo end"']) {
      const command = `X=/fixture/a.md; ${between}; ${launch}`

      expect(`${command} => ${read(command).length} ${sure(command)}`).toBe(`${command} => 1 `)
    }
  }
})
