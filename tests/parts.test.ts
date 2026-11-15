import { expect, test } from 'claude-code/testing'

import { ART_COLUMNS, artRows, ARTS, ICON_COLUMNS, ICON_ROWS, iconOf, SPRITES } from '../hooks/art'
import { CAST, CORE, isGesture, jobOf, MEMBERS, ORDER, pickMember, readingOf, roleOf, roleOfAgent, rolesFrom, say, shown, specialistOf, toneOf, withRole, WORKERS } from '../hooks/cast'
import { findFleetRuns, tidyPath, voicedSpecPath } from '../hooks/orca'
import { pictureState } from '../hooks/desk'
import { cardOf, cells, ENDED_MS, fit, onStage, planOf, seatOf, spentBy, ZERO } from '../hooks/view'
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

test('치이카와 and 우사기 take the work first; a guest comes only when both are busy, the specialist, then the role\'s own, then any free one', () => {
  const mains = [task('chiikawa', 'running'), task('usagi', 'running')]

  // The main two first: 우사기 for finding and looking things up, 치이카와 for the rest, a specialist or not.
  expect(pickMember('구현', [])).toBe('chiikawa')
  expect(pickMember('검토', [])).toBe('chiikawa')
  expect(pickMember('지휘', [])).toBe('chiikawa')
  expect(pickMember('조사', [])).toBe('usagi')
  expect(pickMember('탐색', [])).toBe('usagi')
  expect(pickMember('구현', [], 'pochette')).toBe('chiikawa')
  expect(pickMember('구현', [task('chiikawa', 'running')])).toBe('usagi')
  expect(pickMember('탐색', [task('usagi', 'running')])).toBe('chiikawa')
  expect(pickMember('구현', [task('chiikawa', 'done')])).toBe('chiikawa')
  // With both at work, a guest: the role's own character, the next free one while that one is busy.
  expect(pickMember('구현', mains)).toBe('shisa')
  expect(pickMember('검토', mains)).toBe('kurimanju')
  expect(pickMember('조사', mains)).toBe('kani')
  expect(pickMember('탐색', mains)).toBe('kani')
  expect(pickMember('구현', [...mains, task('shisa', 'running')])).toBe('rakko')
  // A specialist before the role's own, and the role's own while the specialist is busy.
  expect(pickMember('구현', mains, 'pochette')).toBe('pochette')
  expect(pickMember('구현', [...mains, task('pochette', 'running')], 'pochette')).toBe('shisa')
  // With the role's own all busy, any other guest with free hands.
  expect(pickMember('검토', [...mains, task('kurimanju', 'running'), task('momonga', 'running'), task('rakko', 'running')])).toBe('shisa')
  // With every hand full, the first main one takes one more.
  const everyone = WORKERS.map(id => task(id, 'running'))

  expect(pickMember('구현', everyone)).toBe('chiikawa')
  expect(pickMember('검토', everyone, 'momonga')).toBe('chiikawa')
  expect(pickMember('조사', everyone)).toBe('usagi')
  // 하치와레 conducts and 노동 갑옷 씨 takes none.
  expect(WORKERS.includes('rodo')).toBe(false)
  expect(WORKERS.includes('hachiware')).toBe(false)
})

test('a role the person gave puts that character first for it, and takes it out of the role it left', () => {
  const given = withRole({}, 'rakko', '검토')

  expect(given).toEqual({ rakko: '검토' })
  expect(roleOf('rakko', given)).toBe('검토')
  expect(jobOf('ko', 'rakko', given)).toBe('검토, 검증')
  expect(jobOf('ko', 'rakko')).toBe('어려운 구현, 디버깅')
  const mains = [task('chiikawa', 'running'), task('usagi', 'running')]

  // One the person gave the role comes first, before the main two.
  expect(pickMember('검토', [], undefined, given)).toBe('rakko')
  // Busy, the main two are next, then the role's own; and it no longer backs up the role it left, nor takes its old specialty.
  expect(pickMember('검토', [task('rakko', 'running')], undefined, given)).toBe('chiikawa')
  expect(pickMember('검토', [...mains, task('rakko', 'running')], undefined, given)).toBe('kurimanju')
  expect(pickMember('구현', [...mains, task('shisa', 'running')], undefined, given)).toBe('pochette')
  expect(pickMember('구현', mains, 'rakko', given)).toBe('shisa')
  // A main one given another role leaves this one to the other main one, and takes the one it was given first.
  expect(pickMember('구현', [], undefined, { chiikawa: '검토' })).toBe('usagi')
  expect(pickMember('검토', [], undefined, { chiikawa: '검토', kurimanju: '구현' })).toBe('chiikawa')
  expect(pickMember('탐색', [], undefined, { usagi: '구현' })).toBe('chiikawa')
  // A role with everyone moved out of it falls back on those it was first given to, past the main two.
  expect(pickMember('조사', [], undefined, { kani: '검토', shisa: '검토', usagi: '검토' })).toBe('chiikawa')
  expect(pickMember('조사', [task('chiikawa', 'running')], undefined, { kani: '검토', shisa: '검토', usagi: '검토' })).toBe('kani')
  // With the role's own busy, the last free guest is not one the person moved to another role.
  const busy = ['chiikawa', 'usagi', 'shisa', 'pochette', 'kani', 'kurimanju', 'momonga'].map(id => task(id as never, 'running'))

  expect(pickMember('구현', busy, undefined, { rakko: '검토' })).toBe('chiikawa')
  expect(pickMember('구현', busy)).toBe('rakko')
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
  // The specialties are named to the main loop.
  for (const note of [reset, changed]) expect(note).toContain('손님 가운데서는 전문 분야가 정해진 일(화면·디자인은 포쉐트 갑옷 씨, 어려운 디버깅은 랏코, 보안·반박 검토는 모몽가, 오타·포맷은 치이카와)의 담당이 먼저다')
  // One the person gave the role comes before the specialist; with it and the main two busy, the specialist comes before the role's own.
  expect(pickMember('구현', [], 'pochette', { shisa: '구현' })).toBe('shisa')
  expect(pickMember('구현', [task('shisa', 'running'), task('chiikawa', 'running'), task('usagi', 'running')], 'pochette', { shisa: '구현' })).toBe('pochette')
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
  expect(findFleetRuns('X=/fixture/b.md fleet-run codex-build --spec "$X"')[0]).toEqual({ profile: 'codex-build', title: 'codex-build', hasOut: false, isBackground: false, isDetached: false, isRefused: true, isLacking: true, ownsExit: true })

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
    'X="$(pwd)/a.md"; fleet-run codex-build --spec "$X"',
    'X=/fixture/a.md; read X; fleet-run codex-build --spec $X',
    'fleet-run codex-build --spec $UNSET/a.md',
    'P="/fixture/a b"; orca terminal create --command "fleet-run codex-build --spec $P.md"',
  ]) {
    const [unsure] = findFleetRuns(command)

    expect(`${command} ${unsure?.profile} ${unsure?.spec} ${unsure?.specSpan}`).toBe(`${command} codex-build undefined undefined`)
  }
  // A loop through words written out runs its body once for each, each round going on from what the one before assigned.
  expect(findFleetRuns('X=/fixture/a.md; for turn in 1 2; do fleet-run codex-build --spec $X; X=/fixture/b.md; done').map(run => run.spec)).toEqual(['/fixture/a.md', '/fixture/b.md'])
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
  // What stands behind `command` and is not sure to have assigned seals nothing: an assignment after it is read.
  ['X=/fixture/a.md; command export X=/fixture/b.md; X=/fixture/c.md; fleet-run codex-build --spec "$X"', 'codex-build /fixture/c.md $X - waited'],
  // Behind what runs the command named after it, in the background, and in a script handed on.
  ['X=/fixture/a.md; nohup fleet-run codex-build --spec "$X" > /fixture/log 2>&1 &', 'codex-build /fixture/a.md $X - away'],
  ['X=/fixture/a.md; timeout 600 fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; env A=1 fleet-run codex-build --spec "$X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; bash -c "fleet-run codex-build --spec $X"', 'codex-build /fixture/a.md $X - waited'],
  ['X=/fixture/a.md; sh -c \'X=/fixture/b.md; fleet-run codex-build --spec "$X"\'', 'codex-build /fixture/b.md $X - waited'],
  ['X=/fixture/a.md; cat <(fleet-run codex-build --spec "$X")', 'codex-build /fixture/a.md $X - away'],
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
  // A builtin that assigns, behind a word that runs the command named after it: bash and sh run it behind `command`, where zsh looks
  // for a program of its name and assigns nothing. Behind any such word it is not read as an assignment, whichever shell would make it.
  'command export X=/fixture/b.md',
  'command readonly X=/fixture/b.md',
  'command command export X=/fixture/b.md',
  'command export X=/fixture/b.md Y=/fixture/c.md',
  'Y=/fixture/c.md command export X=/fixture/b.md',
  '\\command export X=/fixture/b.md',
  '/usr/bin/command export X=/fixture/b.md',
  'command declare X=/fixture/b.md',
  'command typeset X=/fixture/b.md',
  'command local X=/fixture/b.md',
  'builtin export X=/fixture/b.md',
  'builtin readonly X=/fixture/b.md',
  'command builtin export X=/fixture/b.md',
  'exec export X=/fixture/b.md',
  'env export X=/fixture/b.md',
  'env readonly X=/fixture/b.md',
  'nohup export X=/fixture/b.md',
  'nohup typeset X=/fixture/b.md',
  'timeout 5 export X=/fixture/b.md',
  'time export X=/fixture/b.md',
  'noglob export X=/fixture/b.md',
  'nocorrect readonly X=/fixture/b.md',
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
  // `readonly` behind `command` seals the variable in bash and sh, and not in zsh: an assignment after it is made in zsh alone.
  'X=/fixture/a.md; command readonly X=/fixture/b.md; X=/fixture/c.md; fleet-run codex-build --spec "$X" --out "$X.out"',
  'command readonly X=/fixture/a.md; X=/fixture/b.md; fleet-run codex-build --spec "$X"',
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

test('an ended task marks its friend in the band for a while, and then the friend sits as resting; every friend at work shows its time', () => {
  const done: Task = { ...task('chiikawa', 'done'), endedAt: 10_000 }
  const now = (at: number): Scene => ({ ...scene([done]), now: at })

  expect(seatOf(now(10_000 + ENDED_MS), onStage(now(10_000 + ENDED_MS)), 'chiikawa').glyph).not.toBe('')
  expect(seatOf(now(10_001 + ENDED_MS), onStage(now(10_001 + ENDED_MS)), 'chiikawa').glyph).toBe('')

  // 하치와레 lending hands to the main loop's own work shows how long the stretch has run.
  const helping: Scene = { ...scene(), now: 65_000, aids: { hachiware: { what: asIs('Bash'), at: 64_000, saidAt: 64_000, since: 0 } } }

  expect(seatOf(helping, onStage(helping), 'hachiware').time).toBe(' 1:05')
})

test('a friend with one task running and a newer one waiting is shown at work, and one waiting with a newer one done is shown waiting, picture and all', () => {
  const at = (member: Task['member'], status: Task['status'], startedAt: number, id: string): Task => ({ ...task(member, status), id, startedAt, ...(status === 'done' ? { endedAt: startedAt + 1000 } : {}) })
  const working = { ...scene([at('usagi', 'running', 1000, 'u1'), at('usagi', 'waiting', 2000, 'u2')]), now: 4000 }

  expect(cardOf('usagi', working).isRunning).toBe(true)
  expect(seatOf(working, onStage(working), 'usagi').isBusy).toBe(true)
  expect(pictureState(working, cardOf('usagi', working))).toBe('working')

  const waiting = { ...scene([at('usagi', 'waiting', 1000, 'u1'), at('usagi', 'done', 2000, 'u2')]), now: 4000 }

  expect(cardOf('usagi', waiting).status).toMatch(/^◐/)
  expect(pictureState(waiting, cardOf('usagi', waiting))).toBe('waiting')
})

test("fleet-run's options are read as its argparse reads them: cut short, after the profile or before it, and a launch it turns away is told", () => {
  const [cut] = findFleetRuns('fleet-run codex-scout --cw /w --sp /w/a.md --ou=/w/a.out.md')

  expect([cut?.spec, cut?.out, cut?.isRefused]).toEqual(['/w/a.md', '/w/a.out.md', undefined])
  const [first] = findFleetRuns('fleet-run --cwd /w codex-build --spec /w/a.md --out /w/a.out.md --no-browser')

  expect([first?.profile, first?.spec, first?.isRefused]).toEqual(['codex-build', '/w/a.md', undefined])
  // An option it needs missing, a flag given a value, or one it does not know: it stops before any worker.
  for (const command of [
    'fleet-run codex-scout --spec /w/a.md --out /w/a.out.md',
    'fleet-run codex-scout --cwd /w --spec /w/a.md',
    'fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.out.md --brows=yes',
    'fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.out.md --worktree x',
    'fleet-run codex-scout extra --cwd /w --spec /w/a.md --out /w/a.out.md',
    'fleet-run codex-scout --cwd /w --spec /w/a.md --out',
  ]) expect(`${command} ${findFleetRuns(command)[0]?.isRefused}`).toBe(`${command} true`)
  // An option whole in quotes, the profile after `--`, and words the shell fills in, which may come to nothing: none is turned away.
  for (const command of [
    'fleet-run codex-scout "--cwd=/w" --spec /w/a.md --out /w/b.md',
    'fleet-run --cwd /w --spec /w/a.md --out /w/b.md -- codex-scout',
    'EXTRA=; fleet-run codex-scout $EXTRA --cwd /w --spec /w/a.md --out /w/b.md',
    'fleet-run codex-scout $ARGS',
    "ARGS='/w --spec /w/a.md'; fleet-run codex-scout --cwd $ARGS --out /w/b.md",
    'fleet-run codex-scout --cwd /w --spec"=/w/a.md" --out /w/b.md',
  ]) {
    const [run] = findFleetRuns(command)

    expect(`${command} ${run?.profile} ${run?.isRefused}`).toBe(`${command} codex-scout undefined`)
  }
  // Help and a dry run start no worker at all.
  expect(findFleetRuns('fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.out.md --dry-run')).toEqual([])
  expect(findFleetRuns('fleet-run codex-scout -h')).toEqual([])
})

test('a result path is one file however it is written', () => {
  // A `..` may follow a link: it stays as written.
  expect(findFleetRuns('fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a/./b/../find.out.md')[0]?.out).toBe('/w/a/b/../find.out.md')
  expect(findFleetRuns('fleet-run codex-scout --cwd . --spec a.md --out ./runs//find.out.md')[0]?.out).toBe('runs/find.out.md')
  expect(tidyPath('../a/./b')).toBe('../a/b')
  expect(tidyPath('/var/../a')).toBe('/var/../a')
})

test('a loop through words written out launches once for each, with its variable holding that word; other loops are read once', () => {
  const each = (command: string): string[] => findFleetRuns(command, '/home/me').map(run => `${run.spec} ${run.out} ${run.isBackground} ${run.specSpan}`)

  expect(each('RUN=/w/r; for t in a b; do fleet-run codex-scout --cwd /w --spec $RUN/$t.md --out $RUN/$t.out.md & done; wait')).toEqual([
    '/w/r/a.md /w/r/a.out.md true undefined',
    '/w/r/b.md /w/r/b.out.md true undefined',
  ])
  expect(each('for t in a; do for u in x y; do fleet-run codex-scout --cwd /w --spec /w/$t/$u.md --out /w/$t/$u.out; done; done')).toEqual([
    '/w/a/x.md /w/a/x.out false undefined',
    '/w/a/y.md /w/a/y.out false undefined',
  ])
  expect(each('if true; then for t in a b; do fleet-run codex-scout --cwd /w --spec /w/$t.md --out /w/$t.o; done; fi')).toHaveLength(2)
  // What the shell matches, and a loop that runs while something holds, are not counted: each is one launch, its paths unsure.
  expect(each('for t in *.md; do fleet-run codex-scout --cwd /w --spec $t --out o.md; done')).toEqual(['undefined o.md false undefined'])
  expect(each('while true; do fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/b.md; done')).toHaveLength(1)
  // A variable the body sets again holds, in the next round, what it was set to; one set where it is not sure is not sure from then on.
  expect(each('X=/w/a.md; for t in 1 2; do fleet-run codex-scout --cwd /w --spec $X --out /w/$t.o; X=/w/b.md; done').map(one => one.split(' ')[0])).toEqual(['/w/a.md', '/w/b.md'])
  expect(each('X=/w/a.md; N=X; for t in 1 2; do fleet-run codex-scout --cwd /w --spec "$X" --out /w/$t.o; printf -v "$N" %s /w/b.md; done').map(one => one.split(' ')[0])).toEqual(['/w/a.md', 'undefined'])
  // What a round left past all following, `eval` among it, holds after the loop as it does after an `eval` anywhere.
  expect(each('for t in 1 2; do eval "$CMD"; done; fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/b.md').map(one => one.split(' ')[0])).toEqual(each('eval "$CMD"; fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/b.md').map(one => one.split(' ')[0]))
  // A variable the shell keeps for itself does not hold the word: the loop is read once, its paths unsure.
  expect(each('for RANDOM in 1 2; do fleet-run codex-scout --cwd /w --spec /w/$RANDOM.md --out /w/$RANDOM.o; done')).toEqual(['undefined undefined false undefined'])
  // A body that may leave early is read once.
  expect(each('for t in a b; do fleet-run codex-scout --cwd /w --spec /w/$t.md --out /w/$t.o; break; done')).toHaveLength(1)
  expect(each('for t in a b; do fleet-run codex-scout --cwd /w --spec /w/$t.md --out /w/$t.o; "break"; done')).toHaveLength(1)
  expect(each('for t in a b; do exec fleet-run codex-scout --cwd /w --spec /w/$t.md --out /w/$t.o; done')).toHaveLength(1)
  // A round that runs what is not known, which may be `break`, leaves the rounds after it unsure: they are not read.
  expect(each('STOP=break; for t in a b; do fleet-run codex-scout --cwd /w --spec /w/$t.md --out /w/$t.o; "$STOP"; done')).toHaveLength(1)
  expect(each('for t in a b; do fleet-run codex-scout --cwd /w --spec /w/$t.md --out /w/$t.o; $LEAVE; done')).toHaveLength(1)
  expect(each('for t in ~ a; do fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/$t.out.md; done')).toEqual(['/w/a.md undefined false 55,62'])
  expect(each('for t in =sh a; do fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/$t.out.md; done')).toEqual(['/w/a.md undefined false 57,64'])
  // A loop in a shell of its own leaves what follows the shell as sure as ever.
  expect(each('(for t in a b; do true; done); X=/w; fleet-run codex-scout --cwd /w --spec $X/a.md --out $X/b.md')).toEqual(['/w/a.md /w/b.md false 75,82'])
  expect(each('for t in a b; do fleet-run codex-scout --cwd /w --spec /w/$t.md --out /w/$t.o; \\break; done')).toHaveLength(1)
  // Loops in loops are read over only so much, all told: the command is read at once all the same.
  const deep = `${'for a in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do '.repeat(5)}true${'; done'.repeat(5)}; fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/b.md`
  const began = Date.now()

  expect(each(deep)).toHaveLength(1)
  expect(Date.now() - began).toBeLessThan(500)
})

test('fleet-run run by its Python interpreter, given its path, is a launch too', () => {
  expect(findFleetRuns('python3 ~/.claude/skills/orca-fleet/scripts/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/b.md', '/home/me')[0]?.spec).toBe('/w/a.md')
  expect(findFleetRuns('python3 -u /x/fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md')[0]?.profile).toBe('codex-build')
  expect(findFleetRuns('python3 other.py codex-scout --cwd /w --spec /w/a.md --out /w/b.md')).toEqual([])
  // Code or a module given to it runs no file: `-c fleet-run` is Python's own words.
  expect(findFleetRuns('python3 -c fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')).toEqual([])
  expect(findFleetRuns('python3 -uc fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')).toEqual([])
  expect(findFleetRuns('python3 -m fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')).toEqual([])
  expect(findFleetRuns('python3 -W ignore /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')[0]?.spec).toBe('/w/a.md')
  // A value run together with its option is no option of its own: the `h` and `c` in it ask for nothing.
  expect(findFleetRuns('python3 -Xfaulthandler /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')[0]?.spec).toBe('/w/a.md')
  expect(findFleetRuns('python3 -uWignore::DeprecationWarning /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')[0]?.spec).toBe('/w/a.md')
  expect(findFleetRuns('python3 -uX dev /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')[0]?.spec).toBe('/w/a.md')
  expect(findFleetRuns('python3 -hX dev /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')).toEqual([])
  expect(findFleetRuns('python3 -z /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')).toEqual([])
  expect(findFleetRuns('python3 -OOBs /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o')[0]?.spec).toBe('/w/a.md')
  for (const asked of ['--version', '-V', '-h', '--help', '-uV']) expect(findFleetRuns(`python3 ${asked} /x/fleet-run codex-scout --cwd /w --spec /w/a.md --out /w/a.o`)).toEqual([])
})

test('a spec value that opens at its quotes is written over whole, quotes and all; one that opens inside them is not written over', () => {
  const command = 'D=/w; fleet-run codex-scout --cwd /w --spec="$D"/a.md --out /w/o.md'
  const [run] = findFleetRuns(command)

  expect(run?.spec).toBe('/w/a.md')
  expect(command.slice(run?.specSpan?.[0], run?.specSpan?.[1])).toBe('"$D"/a.md')
  // A character escaped with a backslash starts at the backslash, after the `=`.
  for (const [written, path] of [['--spec=\\a.md', '\\a.md'], ['--spec="a".md', '"a".md'], ['--spec \\a.md', '\\a.md'], ["--spec='a'.md", "'a'.md"]]) {
    const line = `fleet-run codex-scout --cwd /w ${written} --out /w/o.md`
    const [one] = findFleetRuns(line)

    expect(line.slice(one?.specSpan?.[0], one?.specSpan?.[1])).toBe(path)
  }
  const inside = 'D=/w; fleet-run codex-scout --cwd /w "--spec=$D"/a.md --out /w/o.md'
  const [cut] = findFleetRuns(inside)

  expect(cut?.profile).toBe('codex-scout')
  expect(cut?.specSpan).toBeUndefined()
})

test('a word a script handed on fills with what is not known here may come to nothing or to options: fleet-run is not taken to turn it away', () => {
  expect(findFleetRuns('orca terminal create --title t --command "fleet-run codex-build $FLAGS --cwd /w --spec /w/a.md --out /w/b.md" --json')[0]?.isRefused).toBeUndefined()
  expect(findFleetRuns('F="--no-browser --timeout-min 5"; bash -lc "fleet-run codex-build $F --cwd /w --spec /w/a.md --out /w/b.md"')[0]?.isRefused).toBeUndefined()
  expect(findFleetRuns('sh -c "fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md $EXTRA"')[0]?.isRefused).toBeUndefined()
  expect(findFleetRuns('sh -c "fleet-run codex-build --cwd /w --spec /w/a.md --out $OUT"')[0]?.isRefused).toBeUndefined()
  // A word it surely does not take is still turned away, and said so.
  const odd = findFleetRuns('sh -c "fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md --bogus"')[0]

  expect(odd?.isRefused).toBe(true)
  expect(odd?.isLacking).toBeUndefined()
  expect(findFleetRuns('fleet-run codex-build --spec /w/a.md --out /w/b.md')[0]?.isLacking).toBe(true)
})

test("fleet-run's arguments are turned away as argparse turns them away, before the paths it lacks are looked at; what a script handed on fills in is not sure", () => {
  const brief = (command: string): string => JSON.stringify(findFleetRuns(command).map(run => [run.profile, run.spec, run.out, run.isRefused, run.isLacking]))

  expect(brief('fleet-run --spec=$S codex-build --cwd /w --out /w/b.md')).toBe('[["codex-build",null,"/w/b.md",null,null]]')
  expect(brief('sh -c "fleet-run --spec=$S codex-build --cwd /w --out /w/b.md"')).toBe('[["codex-build",null,"/w/b.md",null,null]]')
  expect(brief('orca terminal create --command "fleet-run --cwd=$C codex-build --spec /w/a.md --out /w/b.md"')).toBe('[["codex-build","/w/a.md","/w/b.md",null,null]]')
  expect(brief('C="/a b"; sh -c "fleet-run --cwd=$C codex-build --spec /w/a.md --out /w/b.md"')).toBe('[["codex-build","/w/a.md","/w/b.md",null,null]]')
  expect(brief('sh -c "for x in $A b; do fleet-run codex-build --cwd /w --spec /w/\\$x.md --out /w/\\$x.out.md; done"')).toBe('[["codex-build",null,null,null,null]]')
  expect(brief('for x in $A b; do fleet-run codex-build --cwd /w --spec /w/$x.md --out /w/$x.out.md; done')).toBe('[["codex-build",null,null,null,null]]')
  expect(brief('fleet-run codex-build --cwd /w --spec -a.md --out /w/b.md')).toBe('[["codex-build",null,"/w/b.md",true,null]]')
  expect(brief('fleet-run codex-build --browser=1 --spec /w/a.md --out /w/b.md')).toBe('[["codex-build","/w/a.md","/w/b.md",true,null]]')
  expect(brief('for x in ~/a; do fleet-run codex-build --cwd /w --spec $x --out /w/b.md; done')).toBe('[["codex-build",null,"/w/b.md",null,null]]')
  expect(brief('for x in a=b.md; do fleet-run codex-build --cwd /w --spec "$x" --out /w/b.md; done')).toBe('[["codex-build","a=b.md","/w/b.md",null,null]]')
  expect(brief('sh -c "fleet-run $P codex-build --cwd /w --spec /w/a.md --out /w/b.md"')).toBe('[]')
  expect(brief('fleet-run codex-build --spec /w/a.md --out /w/b.md --bogus')).toBe('[["codex-build","/w/a.md","/w/b.md",true,null]]')
  expect(brief('fleet-run codex-build --cwd "" --spec /w/a.md --out /w/b.md')).toBe('[["codex-build","/w/a.md","/w/b.md",true,true]]')
  expect(brief('fleet-run codex-build --cwd= --spec /w/a.md --out /w/b.md')).toBe('[["codex-build","/w/a.md","/w/b.md",true,true]]')
  // Braces and patterns the shell turns into other words leave it unsure, never turned away.
  expect(brief('fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md --{browser,no-browser}')).toBe('[["codex-build","/w/a.md","/w/b.md",null,null]]')
  expect(brief('fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md --brow*')).toBe('[["codex-build","/w/a.md","/w/b.md",null,null]]')
  expect(brief('fleet-run codex-build --cwd /w --spec /w/{a,b}.md --out /w/b.md')[0]).toBe('[')
  expect(findFleetRuns('fleet-run codex-build --cwd /w --spec /w/{a,b}.md --out /w/b.md')[0]?.isRefused).toBeUndefined()
  // A negative number, a lone dash and a word with a space are values all the same.
  expect(brief('fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md --timeout-min -5')).toBe('[["codex-build","/w/a.md","/w/b.md",null,null]]')
  expect(brief('fleet-run codex-build --cwd /w --spec "- a.md" --out /w/b.md')).toBe('[["codex-build","- a.md","/w/b.md",null,null]]')
})

test('what shells read each their own way is never taken for sure: no launch is turned away for it, and no path or launch is made of it', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const brief = (command: string): string => JSON.stringify(findFleetRuns(command, '/home/me').map(run => [run.profile, run.spec, run.out, run.isRefused, run.isLacking]))

  // zsh reads these where bash and sh read otherwise, or Python where a reading here would not: fleet-run may take them all.
  for (const odd of [
    `{ ${F} }`,
    `${F} >! log.txt`,
    'fleet-run codex-build --cwd /w --spec =(true) --out /w/b.md',
    'fleet-run codex-build --cwd /w --spec /w/a.md --out 12>log.txt',
    'fleet-run codex-build `true` --cwd /w --spec /w/a.md --out /w/b.md',
    `${F} \\`,
    'fleet-run codex-build --cwd /w --spec /w/a.md --out {x}>/dev/null',
    'fleet-run codex-build --cwd /w --spec -\u0663 --out /w/b.md',
    'fleet-run codex-build --cwd /w --spec "-1\n" --out /w/b.md',
  ]) {
    expect(`${odd} ${findFleetRuns(odd)[0]?.isRefused}`).toBe(`${odd} undefined`)
  }
  // A plain redirection is read alike everywhere: what is surely lacking is still told.
  expect(brief('fleet-run codex-build --spec /w/a.md --out /w/b.md > log 2>&1')).toBe('[["codex-build","/w/a.md","/w/b.md",true,true]]')
  // An assignment before `export` is made before zsh fills in its arguments, and after bash does.
  expect(brief('X=/w/old.md; X=/w/new.md export Y=$X; fleet-run codex-build --cwd /w --spec $Y --out /w/b.md')).toBe('[["codex-build",null,"/w/b.md",null,null]]')
  expect(brief('X=1 export Y=~/a.md; fleet-run codex-build --cwd /w --spec /w$Y --out /w/b.md')).toBe('[["codex-build",null,"/w/b.md",null,null]]')
  // Past an `exec` of fleet-run, nothing more runs; a loop that makes its variable read-only ends at the next round.
  expect(findFleetRuns(`exec ${F}; ${F}`)).toHaveLength(1)
  expect(findFleetRuns(`for t in a b; do readonly t; ${F}; done`)).toHaveLength(1)
  // Behind any wrapper but `env`, and as a word that assigns, `NAME=` names no program that is run.
  for (const none of [`nohup X=1 ${F}`, `timeout 5 X=1 ${F}`, `command X=1 ${F}`, `exec X=1 ${F}`, 'a[1]=/w/fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md']) {
    expect(`${none} ${findFleetRuns(none).length}`).toBe(`${none} 0`)
  }
  expect(findFleetRuns(`env X=1 ${F}`)).toHaveLength(1)
  // A number of two figures before a redirection is a word to zsh, and what it opens to bash: the value after `--out` is not sure.
  expect(findFleetRuns('zsh -c \'fleet-run grok-research --cwd sub --spec "/w/s p.md" --out 12>x.log "/w/s p.md"\'')[0]?.out).toBeUndefined()
  // A here-document whose closing word goes on past its quotes is not followed: what it holds is no command.
  expect(findFleetRuns(`cat <<"E"F\nE\n${F}\nEF`)).toEqual([])
})

test('a launch that may be passed by is told so: in a block that may not run, or after `&&` or `||`', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const sure of [F, `cd /w; ${F}`, `{ ${F}; }`, `(${F})`, `for t in a b; do ${F}; done`, `${F} && echo done`, `echo x | ${F}`, `if ${F}; then :; fi`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} ${maybe(sure).map(() => '').join()}`)
  }
  // zsh stops at a pattern that matches nothing, a `~name` with no such user or an `=name` with no such program.
  for (const risky of [`${F} --brow*`, 'fleet-run codex-build --cwd /w --spec /w/a.md --out=*.md', `${F} --timeout-min ~nobody`, `${F} =nothing`]) {
    expect(`${risky} ${maybe(risky).join()}`).toBe(`${risky} true`)
  }
  expect(maybe(`${F} --timeout-min ~/x`)).toEqual([undefined])
  for (const passed of [`cd /w && ${F}`, `true || ${F}`, `if false; then ${F}; fi`, `while false; do ${F}; done`, `[ -d /w ] && sh -c "${F}"`, `if true; then for t in a; do ${F}; done; fi`]) {
    expect(`${passed} ${maybe(passed).join()}`).toBe(`${passed} ${maybe(passed).map(() => 'true').join()}`)
  }
})

test('a launch that hangs on an `&&` or `||` may be passed by all the same in a pipeline or a parenthesis after it', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const passed of [`cd /w && (${F})`, `cd /w && (${F} &)`, `false && echo x | ${F}`, `true || (${F} | cat)`, `false && (echo a; ${F})`, `false && { echo a; } | ${F}`, `[ -d /w ] && (cd /w; sh -c "${F}")`]) {
    expect(`${passed} ${maybe(passed).join()}`).toBe(`${passed} true`)
  }
  // What follows the parenthesis or the list hangs on nothing: it runs whatever came before.
  for (const sure of [`(${F})`, `echo x | ${F}`, `false && echo a; (${F})`, `(false && echo a); ${F}`, `{ false && echo a; }; ${F}`, `false && (echo a); ${F}`, `(cd /w; ${F}) && echo done`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
})

test('a line that ends in `&&`, `||` or `|` goes on in the next: what stands there hangs on it, and assigns nothing for sure', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const G = 'fleet-run codex-build --cwd /w --spec $X --out /w/b.md'

  expect(findFleetRuns(`cd /w &&\n${F}`).map(run => run.isMaybe)).toEqual([true])
  expect(findFleetRuns(`cd /w ||\n\n  ${F}`).map(run => run.isMaybe)).toEqual([true])
  expect(findFleetRuns(`cd /w &&\n# then the worker\n(${F})`).map(run => run.isMaybe)).toEqual([true])
  expect(findFleetRuns(`echo x |\n${F}`).map(run => run.isMaybe)).toEqual([undefined])
  // The assignment on the next line is made only if the line before went that way: the variable is not known after it.
  for (const joined of ['false &&\nX=/w/z.md\n', 'true ||\nX=/w/z.md\n', 'true |\nX=/w/z.md\n']) {
    expect(`${joined} ${findFleetRuns(`X=/w/a.md; ${joined}${G}`)[0]?.spec}`).toBe(`${joined} undefined`)
  }
  expect(findFleetRuns(`X=/w/a.md\nX=/w/z.md\n${G}`)[0]?.spec).toBe('/w/z.md')
})

test('a launch past a word that may have left the shell may be passed by: an `exit`, a `return` or an `exec` before it, or a `break` in no loop', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const left of [`exit 0; ${F}`, `cd /w || exit 0\n${F}`, `[ -s /w/a.md ] || { echo missing; exit 0; }; ${F}`, `if [ -f /w/b.md ]; then exit 0; fi; ${F}`, `exec true; ${F}`, `return 0 2>/dev/null; ${F}`, `command exit; ${F}`, `break 2>/dev/null; ${F}`, `if true; then continue 2>/dev/null; fi; ${F}`]) {
    expect(`${left} ${maybe(left).join()}`).toBe(`${left} true`)
  }
  // One that leaves after the launch, or leaves another shell or only a loop, or is only a word printed, passes nothing by.
  for (const sure of [`${F}; exit 0`, `sh -c "exit 0"; ${F}`, `echo exit; ${F}`, `exec ${F}`, `while [ ! -s /w/a.md ]; do sleep 1; break; done; ${F}`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
})

test('a word that leaves a parenthesis leaves only that shell: a launch after the parenthesis is sure, and one after the word inside it is not', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const sure of [`(exit 0); ${F}`, `(cd /w || exit 0; echo there); ${F}`, `(echo a; (return 0); echo b)\n${F}`, `echo "$(exit 0)"; ${F}`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
  for (const left of [`(exit 0; ${F})`, `(cd /w || exit 0; ${F})`, `{ exit; }; ${F}`, `exit 0; (echo a); ${F}`, `(exit 0; (echo a); ${F})`]) {
    expect(`${left} ${maybe(left).join()}`).toBe(`${left} true`)
  }
  // One sure and one not, each side of the parenthesis's end.
  expect(maybe(`(exit 0; ${F}); ${F}`)).toEqual([true, undefined])
})

test('a launch the statement that leaves the shell itself runs is not past it: the script an `exec` hands on is sure, and what follows is not', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const sure of [`exec sh -c '${F}'`, `exec bash -c "${F}"`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
  expect(maybe(`exec sh -c '${F}'; ${F}`)).toEqual([undefined, true])
})

test('a word that leaves only a shell of its own, left running behind or piped on to another command, passes no launch by; the last of a pipeline may', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const sure of [`exit 0 & ${F}`, `exit 0 | cat; ${F}`, `exit 0 | ${F}`, `return 0 2>/dev/null |& cat\n${F}`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
  // zsh runs the last command of a pipeline in the shell itself.
  for (const left of [`echo | exit; ${F}`, `exit 0 | cat | exit 0; ${F}`, `exit 0 & exit 0; ${F}`]) {
    expect(`${left} ${maybe(left).join()}`).toBe(`${left} true`)
  }
})

test('a launch in a `{` group surely runs where the group does: it may be passed by only as the group may, or as any launch may', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const sure of [`{ echo prep; ${F}; }`, `{ ${F}; }`, `{\n  echo prep\n  { echo more; ${F}; }\n}`, `{ false && echo a; ${F}; }`, `{ echo a; } && echo b; ${F}`, `{ if true; then echo a; fi; ${F}; }`, `{ (cd /w || exit 0); echo a | cat; ${F}; }`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
  for (const passed of [`false && { ${F}; }`, `false && { echo a; ${F}; }`, `if true; then { ${F}; }; fi`, `if true; then { echo a; ${F}; }; fi`, `{ echo a; false && ${F}; }`, `{ echo a; exit 0; ${F}; }`, `while true; do { echo a; ${F}; }; break; done`, `false || { echo a; { echo b; ${F}; }; }`]) {
    expect(`${passed} ${maybe(passed).join()}`).toBe(`${passed} true`)
  }
  expect(maybe(`false && { echo a; ${F}; }; { echo b; ${F}; }`)).toEqual([true, undefined])
  // A function's body is not read: it may never be called.
  expect(maybe(`f() { echo a; ${F}; }`)).toEqual([])
})

test('a `{` group left running behind or piped on runs in a shell of its own: a word that leaves, in it, passes no later launch by', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const sure of [`{ exit 0; } | cat; ${F}`, `{ exit 0; } & ${F}`, `{ echo a; { exit 0; } | cat; }; ${F}`, `{ cd /w || exit 0; echo a; } 2>&1 | cat\n${F}`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
  for (const left of [`{ exit 0; }; ${F}`, `echo | { exit 0; }; ${F}`, `exit 0; { echo a; } | cat; ${F}`, `{ exit 0; ${F}; } | cat`, `{ { exit 0; }; echo a; } | cat | { exit 0; }; ${F}`]) {
    expect(`${left} ${maybe(left).join()}`).toBe(`${left} true`)
  }
})

test('a `case` hides where a command run to make a word ends only where a command may stand in it: one in a path or an argument is a word', () => {
  const read = (command: string): string[] => findFleetRuns(command).map(run => `${run.spec ?? '?'} ${run.out ?? '?'} ${run.isMaybe === true ? 'maybe' : 'sure'}`)

  for (const plain of ['echo "$(cat /w/case.md)"', 'X=$(basename /w/case); echo $X', 'echo $(echo case closed)', 'echo $(echo time case)', 'echo "$(echo ! case a; echo -p case b)"', 'echo $(echo noglob case)']) {
    expect(`${plain} ${read(`${plain}; fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md`).join()}`).toBe(`${plain} /w/a.md /w/b.md sure`)
  }
  // Behind a word a pipeline or a command may begin with, it is a `case` all the same: the text it prints may hold what looks like a launch.
  const printed = 'a in a) echo esac " ; fleet-run codex-build --cwd /w --spec /w/c.md --out /w/d.md ; " ;; esac)"'

  for (const lead of ['!', 'time', 'time -p', '! time', 'time !', 'coproc', 'noglob', 'nocorrect', 'true; ! time -p', 'if', 'f()', 'function f', 'repeat 2', 'for x (a)']) {
    const runs = findFleetRuns(`echo "$(${lead} case ${printed}`)

    expect(`${lead} ${runs.filter(run => run.isMaybe !== true || run.spec !== undefined || run.specSpan !== undefined).length}`).toBe(`${lead} 0`)
  }
  // A backslash before a line's end joins the two lines before any word is read.
  for (const split of ['ca\\\nse', '\\\ncase', '! \\\ncase', 'ti\\\nme c\\\nase', 'case\\\n']) {
    const runs = findFleetRuns(`echo "$(${split} ${printed}`)

    expect(`${JSON.stringify(split)} ${runs.filter(run => run.isMaybe !== true || run.spec !== undefined || run.specSpan !== undefined).length}`).toBe(`${JSON.stringify(split)} 0`)
  }
  for (const knotty of ['echo "$(case a in b) : ;; esac)"', 'echo $(time case a in a) : ;; esac)', 'echo $(! case a in a) : ;; esac)', 'X=$(case a in b) echo c ;; esac)', 'echo $(true; case a in a) echo b ;; esac)', 'echo $(if true; then case a in a) : ;; esac; fi)']) {
    expect(`${knotty} ${read(`${knotty}; fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md`).join()}`).toMatch(/maybe$/)
  }
})

test('a group, a parenthesis, a loop or a handed script piped on to another command may be ended at what it writes: only a launch in its first statement is sure', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const G = 'fleet-run codex-scout --cwd /w --spec /w/c.md --out /w/d.md'
  const maybe = (command: string): string => findFleetRuns(command).map(run => `${run.profile === 'codex-build' ? 'F' : 'G'}${run.isMaybe === true ? '?' : ''}`).join(' ')

  for (const [command, read] of [
    [`{ ${F}; } | tee log`, 'F'],
    [`(${F}) | tee log`, 'F'],
    [`{ ${F}; echo done; } | cat`, 'F'],
    [`sh -c '${F}' | cat`, 'F'],
    // A statement of no word, or of only the word that opens the group, is not its first.
    [`sh -c '${F};' | cat`, 'F'],
    [`sh -c '\n${F}\n' | cat`, 'F'],
    [`{\n${F};\n} | cat`, 'F'],
    [`(\n${F}\n) | cat`, 'F'],
    [`{\n\n  ${F}\n  echo done\n} | tee log`, 'F'],
    [`{\n  echo hi\n  ${F}\n} | cat`, 'F?'],
    [`{ echo hi; ${F}; } | ${G}`, 'F? G'],
    [`(echo hi; ${F}) | cat; ${G}`, 'F? G'],
    [`{ ${F}; ${G}; } |& cat`, 'F G?'],
    [`{ { ${F}; echo; ${G}; }; } | cat`, 'F G?'],
    [`for x in a b; do echo $x; ${F}; done | cat`, 'F? F?'],
    [`sh -c 'echo hi; ${F}' | cat`, 'F?'],
    // Not piped on, or the last of the pipeline, each writes to what does not go away.
    [`{ echo hi; ${F}; }; ${G}`, 'F G'],
    [`echo a | { echo hi; ${F}; }`, 'F'],
    [`for x in a b; do echo $x; ${F}; done`, 'F F'],
    [`bash -c "echo hi; ${F}"`, 'F'],
  ] as const) {
    expect(`${command} => ${maybe(command)}`).toBe(`${command} => ${read}`)
  }
})

test('an `esac` that ends no `case` read here ends one not seen, as one an alias stands for: no launch before it or after it is sure', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const G = 'fleet-run codex-scout --cwd /w --spec /w/c.md --out /w/d.md'
  const sure = (command: string): number => findFleetRuns(command).filter(run => run.isMaybe !== true).length

  for (const hidden of [`echo $(c a in a) echo x; ${F}; esac); ${G}`, `c a in a) echo x; ${F}; esac; ${G}`, `sh -c 'c a in a) ${F}; esac; ${G}'`, `eval 'case a in a) ${F};; esac'`, `eval "$X"; ${G}`]) {
    expect(`${hidden} ${sure(hidden)}`).toBe(`${hidden} 0`)
  }
  // After the hidden one ends, no path is taken as read.
  expect(findFleetRuns(`echo $(c a in a) echo x; ${F}; esac); ${G}`).at(-1)?.spec).toBeUndefined()
  // The word as an argument is a word like any other, and a `case` that is read ends at its own.
  for (const plain of [`echo esac; ${F}`, `echo case esac; ${F}`, `${F}; case a in a) echo b;; esac`]) {
    expect(`${plain} ${sure(plain)}`).toBe(`${plain} 1`)
  }
})

test('a word that ends a block, or goes on with one, where no such block was read belongs to one not seen: no launch before it or after it is sure', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const G = 'fleet-run codex-scout --cwd /w --spec /w/c.md --out /w/d.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.profile === 'codex-build' ? 'F' : 'G'}${run.isMaybe === true ? '?' : ''}`).join(' ')

  for (const hidden of [`w false; do ${F}; done; ${G}`, `i false; then ${F}; fi; ${G}`, `i false; then echo a; else ${F}; fi; ${G}`, `g ${F}; }; ${G}`, `${F}; done`, `${F}; fi; ${G}`, `sh -c 'w false; do ${F}; done'; ${G}`, `if true; then ${F}; done; ${G}`, `{ ${F}; fi; ${G}`]) {
    expect(`${hidden} => ${read(hidden).replace(/[FG]\?/g, '').trim()}`).toBe(`${hidden} => ${hidden.startsWith('sh -c') ? 'G' : ''}`)
  }
  // Blocks that are read, each ended by its own word, and the same words as arguments, in quotes or in a here-document, are as they were.
  for (const [command, runs] of [
    [`for x in a b; do ${F}; done; ${G}`, 'F F G'],
    [`for x in a b\ndo\n  ${F}\ndone\n${G}`, 'F F G'],
    [`while false; do ${F}; done; ${G}`, 'F? G'],
    [`until true; do echo a; done; ${G}`, 'G'],
    [`if true; then ${F}; elif false; then echo b; else echo c; fi; ${G}`, 'F? G'],
    [`{ ${F}; }; ${G}`, 'F G'],
    [`{ if true; then echo a; fi; while false; do echo b; done; }; ${G}`, 'G'],
    [`echo done fi then do else elif esac; ${F}`, 'F'],
    [`echo 'done'; echo "fi"; echo }; ${F}`, 'F'],
    [`cat <<EOF\ndone\nfi\n}\nesac\nEOF\n${F}`, 'F'],
    [`select x in a b; do echo $x; break; done; ${G}`, 'G'],
  ] as const) {
    expect(`${command} => ${read(command)}`).toBe(`${command} => ${runs}`)
  }
  // A function's body is not read, and what follows a definition is not sure as before.
  expect(read(`f() { if true; then echo a; fi; }; ${G}`)).toBe('G?')
})

test('a `case` after a `]]` in a command run to make a word is one all the same, as in a short `if` of zsh', () => {
  const printed = 'a in a) echo esac " ; fleet-run codex-build --cwd /w --spec /w/c.md --out /w/d.md ; " ;; esac)"'
  const runs = findFleetRuns(`echo "$(if [[ -n x ]] case ${printed}`)

  expect(runs.filter(run => run.isMaybe !== true || run.spec !== undefined || run.specSpan !== undefined).length).toBe(0)
  // A test with no `case` after it hides nothing.
  expect(findFleetRuns('echo "$([[ -n x ]] && echo case)"; fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md').map(run => `${run.spec ?? '?'} ${run.isMaybe === true ? 'maybe' : 'sure'}`)).toEqual(['/w/a.md sure'])
})

test('a launch whose name or words are written over two lines, joined by a backslash, is read as the same launch written on one', () => {
  const whole = findFleetRuns('fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md').map(({ specSpan: _span, ...run }) => run)

  for (const split of ['fleet-\\\nrun codex-build --cwd /w --spec /w/a.md --out /w/b.md', 'fle\\\net-run codex-build --cwd /w --sp\\\nec /w/a.md --out /w/b\\\n.md', 'fleet-run \\\n  codex-build --cwd /w \\\n  --spec /w/a.md --out /w/b.md']) {
    expect(findFleetRuns(split).map(({ specSpan: _span, ...run }) => run)).toEqual(whole)
  }
  expect(whole.map(run => `${run.spec ?? '?'} ${run.out ?? '?'} ${run.isMaybe === true ? 'maybe' : 'sure'}`)).toEqual(['/w/a.md /w/b.md sure'])
})

test('an `esac` anywhere after a command run to make a word opens may end a `case` not seen in it: nothing in the command is sure, and no path is read', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string[] => findFleetRuns(command).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '?'} ${run.specSpan === undefined ? 'unplaced' : 'placed'}`)

  // Behind an alias the `case` is not seen: the text it prints holds what looks like a launch, outside where the reader ends the command.
  for (const hidden of [`echo "$(c a in a) echo esac " ; ${F} ; " ;; esac)"`, `echo "$(c a in a) echo es\\\nac " ; ${F} ; " ;; esac)"`, `echo \`c a in a) echo x ;; esac\`; ${F}`]) {
    expect(`${hidden} ${read(hidden).join()}`).toBe(`${hidden} maybe ? unplaced`)
  }
  // The word as an argument there is taken the same way: what is lost is only that the launch is sure.
  for (const argued of [`echo "$(grep -c esac /w/notes.md)"; ${F}`, `${F}; echo $(echo esac)`]) {
    expect(`${argued} ${read(argued).join()}`).toBe(`${argued} maybe ? unplaced`)
  }
  // With no such command before it, the word is a word.
  for (const plain of [`echo esac; ${F}`, `grep -c esac /w/notes.md; ${F}`, `echo esac; echo "$(date)"; ${F}`]) {
    expect(`${plain} ${read(plain).join()}`).toBe(`${plain} sure /w/a.md placed`)
  }
})

test('a loop or an `if` left running behind or piped on runs in a shell of its own: a word that leaves, in it, passes no later launch by', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): (true | undefined)[] => findFleetRuns(command).map(run => run.isMaybe)

  for (const sure of [`while true; do exit 0; done | cat; ${F}`, `for x in a; do exit 0; done & ${F}`, `for x in $L; do exit 0; done & ${F}`, `until false; do exit 0; done |& cat; ${F}`, `select x in a; do exit 0; done | cat; ${F}`, `if true; then exit 0; fi | cat; ${F}`]) {
    expect(`${sure} ${maybe(sure).join()}`).toBe(`${sure} `)
  }
  for (const left of [`while true; do exit 0; done; ${F}`, `for x in a; do exit 0; done; ${F}`, `for x in $L; do exit 0; done; ${F}`, `echo | while true; do exit 0; done; ${F}`, `if true; then exit 0; fi; ${F}`, `exit 0; while false; do echo a; done | cat; ${F}`]) {
    expect(`${left} ${maybe(left).join()}`).toBe(`${left} true`)
  }
})

test('a loop whose `do` stands on a line of its own is read as one written on one line: each round with its paths, and the shell not lost', () => {
  const read = (command: string): string[] => findFleetRuns(command).map(run => `${run.profile} ${run.spec ?? '?'} ${run.out ?? '?'} ${run.isMaybe === true ? 'maybe' : 'sure'}`)
  const body = 'fleet-run codex-build --cwd /w --spec /w/$x.md --out /w/$x.out.md'
  const after = 'fleet-run codex-scout --cwd /w --spec /w/c.md --out /w/d.md'
  const rounds = ['codex-build /w/a.md /w/a.out.md sure', 'codex-build /w/b.md /w/b.out.md sure', 'codex-scout /w/c.md /w/d.md sure']

  for (const loop of [`for x in a b; do ${body}; done; ${after}`, `for x in a b;\ndo\n  ${body}\ndone\n${after}`, `for x in a b\ndo\n  ${body}\ndone\n${after}`, `for x in a b\n\ndo ${body}\ndone; ${after}`, `for x in a b;\n# each\ndo\n\n  ${body}\n\ndone\n${after}`]) {
    expect(`${JSON.stringify(loop)} ${read(loop).join()}`).toBe(`${JSON.stringify(loop)} ${rounds.join()}`)
  }
  // A loop that is not gone through here has its `do` in it all the same: what follows it is sure.
  for (const loop of [`while false\ndo\n  echo a\ndone\n${after}`, `until true;\ndo\n  echo a\ndone\n${after}`, `for x in $L\ndo\n  echo $x\ndone\n${after}`]) {
    expect(`${JSON.stringify(loop)} ${read(loop).join()}`).toBe(`${JSON.stringify(loop)} codex-scout /w/c.md /w/d.md sure`)
  }
  // One that stands in no loop, after a statement, belongs to a loop not seen.
  expect(read(`w false; do ${after}; done`)).toEqual(['codex-scout ? ? maybe'])
})

test('a launch exits as its command does only where it is the last thing the command runs, alone: in no pipeline, behind no `!`, in no block, with nothing after it', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const owns = (command: string): string => findFleetRuns(command).map(run => (run.ownsExit === true ? 'own' : 'not')).join()

  for (const last of [F, `cd /w; ${F}`, `cd /w && ${F}`, `echo a\n${F}\n# done\n`, `${F} > /w/log 2>&1`, `nohup ${F}`, `env X=1 ${F}`, `timeout 600 ${F}`, `(cd /w; ${F})`, `sh -c '${F}'`, `bash -lc "cd /w && ${F}"`, `echo a | cat; ${F};`, `{ ${F}; }`, `{ cd /w; ${F}; }`, `{\n  ${F}\n} 2>/w/log`, `{ { ${F}; }; }`]) {
    expect(`${last} ${owns(last)}`).toBe(`${last} own`)
  }
  for (const other of [`${F} || true`, `${F} 2>&1 | tail -5`, `${F}; echo done`, `${F} && echo ok`, `if ${F}; then echo ok; fi`, `! ${F}`, `${F} &`, `echo a | ${F}`, `{ ${F}; } | cat`, `{ ${F}; }; echo done`, `{ ${F}; } || true`, `(${F}) | cat`, `(${F}) &`, `{ ${F}; } &`, `if true; then { ${F}; }; fi`, `for x in a; do ${F}; done`, `echo $(${F})`, `sh -c '${F}; echo done'`, `sh -c '${F}' | cat`, `sh -c '${F}'; echo done`, `while ${F}; do sleep 1; done`]) {
    expect(`${other} ${owns(other)}`).toBe(`${other} not`)
  }
  // Behind a `!`, a parenthesis, a group or a pipeline exits as the other of what it ran: no launch in it, however deep, exits as the command does.
  for (const turned of [`! ( ${F} )`, `! (${F})`, `! ( true; ${F} )`, `! ( ( ${F} ) )`, `time ! ( ${F} )`, `! ( ${F} ) 2>&1`, `set -e; ! ( ${F} )`, `! ${F}`, `! { ${F}; }`, `! { true; ${F}; }`, `! { true; ( ${F} ); }`, `! { true; { ${F}; }; }`, `! ( { ${F}; } )`, `! ( sh -c '${F}' )`, `! true | ( ${F} )`]) {
    expect(`${turned} ${owns(turned)}`).toBe(`${turned} not`)
  }
  // One that follows what the `!` turns, or stands in a parenthesis with a `!` of its own inside, is not behind it.
  for (const past of [`! (true); (${F})`, `! { true; }; ( ${F} )`, `! true; ( ${F} )`, `( ! true; ${F} )`, `( ( ${F} ) )`]) {
    expect(`${past} ${owns(past)}`).toBe(`${past} own`)
  }
  // An `exec` that surely runs takes the shell's place: what is written after it never runs, and the command exits as the launch does.
  for (const taking of [`exec ${F}; echo x`, `exec ${F}\necho x`, `cd /w; exec ${F}; echo x`, `exec nohup ${F}; echo x`, `exec env X=1 ${F}; echo x`, `exec ${F} && echo ok`, `exec ${F} || echo no`, `set -e; exec ${F}; echo x`]) {
    expect(`${taking} ${owns(taking)}`).toBe(`${taking} own`)
  }
  // Not where it may not run, or runs in a shell of its own. After `cd /w &&` a failing `cd` skips it and `echo x` ends the command with 0.
  // In a group it is not followed: the group may be piped or redirected where it closes. With a redirection of its own, bash and
  // zsh go on past one that fails: `exec F > /no/such/file; echo x` launches nothing and exits 0.
  for (const kept of [`cd /w && exec ${F}; echo x`, `false || exec ${F}; echo x`, `{ exec ${F}; }; echo x`, `exec ${F} | cat`, `exec ${F} | cat; echo x`, `cat /w/a | exec ${F}; echo x`, `(exec ${F}); echo x`, `exec ${F} & echo x`, `if true; then exec ${F}; fi; echo x`, `for x in a; do exec ${F}; done; echo x`, `exec ${F} > /w/log; echo x`, `exec ${F} < /w/in; echo x`, `command exec ${F}; echo x`, `nohup exec ${F}; echo x`, `! exec ${F}; echo x`, `time exec ${F}; echo x`]) {
    expect(`${kept} ${owns(kept)}`).toBe(`${kept} not`)
  }
  expect(owns(`exec ${F} > /w/log`)).toBe('own')
  // A script the `exec` hands to a shell takes the shell's place as well: its last launch owns the exit, by the script's own rules.
  for (const handed of [`exec sh -c '${F}'; echo x`, `exec bash -lc "cd /w; ${F}"; echo x`]) {
    expect(`${handed} ${owns(handed)}`).toBe(`${handed} own`)
  }
  for (const kept of [`exec sh -c '${F}; echo y'; echo x`, `exec bash -c '${F}' > /w/log; echo x`, `sh -c '${F}'; echo x`, `cd /w && exec sh -c '${F}'; echo x`, `exec sh -c '${F}' | cat; echo x`]) {
    expect(`${kept} ${owns(kept)}`).toBe(`${kept} not`)
  }
  // Sure or not as before: owning the exit changes nothing of that.
  expect(findFleetRuns(`exec ${F}; echo x`).map(run => run.isMaybe === true)).toEqual([false])
  expect(findFleetRuns(`cd /w && exec ${F}; echo x`).map(run => run.isMaybe === true)).toEqual([true])
})

test('a launch in `<(…)` or `>(…)` is left running behind, wherever it stands: the shell does not wait for it, and it does not exit as the command does', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.isBackground ? 'behind' : 'waited'}${run.ownsExit === true ? ' own' : ''}`).join()

  for (const aside of [`sleep 1; true <(${F} >/dev/null 2>&1)`, `cat <(${F})`, `echo x | tee >(${F})`, `cat < <(${F})`, `echo x > >(${F})`, `while read x; do :; done < <(${F})`, `(cat <(${F}))`, `x=$(cat <(${F}))`, `bash -c 'cat <(${F})'`, `bash -c "cat <(${F})"`]) {
    expect(`${aside} ${read(aside)}`).toBe(`${aside} behind`)
  }
  expect(read(`diff <(${F}) <(${F})`)).toBe('behind,behind')
  // A command run to make a word is waited for, and one in quotes is only text.
  expect(read(`echo $(${F})`)).toBe('waited')
  expect(read(`cat < $(${F})`)).toBe('waited')
  expect(read(`echo '<(${F})'`)).toBe('')
})

test('a parenthesis where a redirection looks for its word opens no shell of its own: a launch in it is left running behind, and is sure only right after `<<`', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.isBackground ? 'behind' : 'waited'}${run.ownsExit === true ? ' own' : ''}`).join()

  // zsh reads `<<(…)` as `< <(…)`, and bash runs nothing and fails.
  expect(read(`cat <<(${F})`)).toBe('sure behind')
  // After a space, or any other sign, bash runs nothing and zsh runs it or not.
  for (const odd of [`cat << (${F})`, `cat < (${F})`, `cat > (${F})`, `cat >> (${F})`, `cat >>(${F})`, `cat <<<(${F})`, `cat 2> (${F})`, `echo a &> (${F})`]) {
    expect(`${odd} ${read(odd)}`).toBe(`${odd} maybe behind`)
  }
  // A parenthesis that begins a statement is a shell of its own, as before.
  for (const plain of [`(${F})`, `cat < /w/f; (${F})`, `cat <<EOF\nhi\nEOF\n(${F})`]) {
    expect(`${plain} ${read(plain)}`).toBe(`${plain} sure waited own`)
  }
})

test('a command of a hundred thousand lines is read in time that grows with its length, not with its square', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const took = (command: string): number => {
    const times = [0, 0].map(() => {
      const from = performance.now()

      expect(findFleetRuns(command)).toHaveLength(1)

      return performance.now() - from
    })

    return Math.min(...times)
  }

  for (const [name, command] of [
    ['lines', `${':\n'.repeat(100_000)}${F}`],
    ['lines after', `${F}\n${':\n'.repeat(100_000)}`],
    ['and-or', `${': && '.repeat(100_000)}${F}`],
    // A long run of line ends inside a command run to make a word, and a long word given to `set`.
    ['line ends in $(', `${'$('.repeat(8)}${'\n'.repeat(16_000)}true${')'.repeat(8)}\n${F}`],
    ['set flag', `set -${'e'.repeat(50_000)}!; ${F}`],
  ] as const) {
    expect(`${name} ${took(command) < 1500 ? 'in time' : 'too slow'}`).toBe(`${name} in time`)
  }
})

test('a command with more parentheses open at once than is read tells of no launch, and at once: one a little less deep is read as ever', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const nested = (depth: number): string => `echo ${'$('.repeat(depth)}true${')'.repeat(depth)}; ${F}`
  const from = performance.now()

  expect(findFleetRuns(nested(8000))).toEqual([])
  expect(findFleetRuns(nested(125_000))).toEqual([])
  expect(findFleetRuns(`echo ${'$('.repeat(8000)}${F}${')'.repeat(8000)}`)).toEqual([])
  expect(performance.now() - from < 500 ? 'in time' : 'too slow').toBe('in time')
  expect(findFleetRuns(nested(100)).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'}`)).toEqual(['sure /w/a.md'])
  // Many opened one after another are not deep.
  expect(findFleetRuns(`echo${' $(true)'.repeat(1000)}; ${F}`).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'}`)).toEqual(['sure /w/a.md'])
})

test('a script handed on inside a script handed on, many times over, is looked through once at each depth: the reading does not double with each, and one that would take too long is given up with no launch told', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const wraps: Record<string, (script: string) => string> = {
    'sh -c "$(…)"': script => `sh -c "$(${script})"`,
    'sh -c "`…`"': script => `sh -c "\`${script}\`"`,
    'bash -lc "$(…)"': script => `bash -lc "$(${script})"`,
    'orca terminal create --command "$(…)"': script => `orca terminal create --command "$(${script})"`,
    'a word of both': script => `sh -c $(${script})"$(${script.length > 40 ? 'true' : script})"`,
  }

  for (const [name, wrap] of Object.entries(wraps)) {
    for (const depth of [20, 40]) {
      const command = `${Array.from({ length: depth }).reduce<string>(wrap, "echo 'esac'")}; ${F}`
      const from = performance.now()
      const runs = findFleetRuns(command)
      const took = performance.now() - from

      expect(`${name} ${depth} ${took < 200 ? 'in time' : 'too slow'}`).toBe(`${name} ${depth} in time`)
      // Read through, the launch after them is found; given up, none is. Never one told as sure with what stands before it unread.
      expect(runs.length <= 1).toBe(true)
    }
  }
  // Long text deep inside commands run to make a word is parted again at each depth: past what a reading is given, it is given up.
  const from = performance.now()

  expect(findFleetRuns(`echo ${'$('.repeat(190)}${'a '.repeat(100_000)}${')'.repeat(190)}; ${F}`)).toEqual([])
  expect(performance.now() - from < 1500 ? 'in time' : 'too slow').toBe('in time')
  // The same wrapped a few times is read as ever.
  expect(findFleetRuns(`sh -c "$(sh -c "$(echo 'esac')")"; ${F}`).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'}`)).toEqual(['sure /w/a.md'])
  expect(findFleetRuns(`sh -c "$(sh -c "$(case a in a) echo;; esac)")"; ${F}`).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'}`)).toEqual(['maybe -'])
})

test('a redirection alone after `&&`, `||` or `|` is a command of its own, which its line ends: the launch on the next line surely runs, whatever stands between the redirection and the line end', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'} ${run.ownsExit === true ? 'owns' : 'not'}`).join()

  // bash, zsh and sh each run the next line after every one of these.
  for (const line of ['false && > /dev/null ', 'false && >/dev/null', 'false && > /dev/null', 'false && 2>/dev/null ', 'false && 2> /dev/null\t', 'false || <in ', 'false && >f', 'false && >f ', 'false && > /dev/null # note', 'true | > /dev/null ', 'false && <<EOF \nbody\nEOF', 'false && > /dev/null 2>&1 ']) {
    expect(`${JSON.stringify(line)} ${read(`${line}\n${F}`)}`).toBe(`${JSON.stringify(line)} sure /w/a.md owns`)
  }
  // With nothing after the sign the line goes on in the next, as ever: the launch is hung on it.
  for (const line of ['false && ', 'false &&', 'false || \t', 'false && # note']) {
    expect(`${JSON.stringify(line)} ${read(`${line}\n${F}`)}`).toBe(`${JSON.stringify(line)} maybe /w/a.md owns`)
  }
})

test('a command of a quarter of a million characters is read in time that grows with its length, whatever it is made of: blocks in blocks, long chains, many statements, here-documents, words or options', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  /** Each form, with how many launches are read of it: none where more blocks stand open at once than are read. */
  const forms: [string, string, number][] = [
    ['groups in groups', `${'{ '.repeat(50_000)}${F}${'; }'.repeat(50_000)}`, 0],
    ['parentheses in parentheses', `${'( '.repeat(50_000)}${F}${' )'.repeat(50_000)}`, 0],
    ['commands run to make words, in one another', `echo ${'$('.repeat(60_000)}${F}${')'.repeat(60_000)}`, 0],
    ['if in if', `${'if true; then '.repeat(12_000)}${F}${'; fi'.repeat(12_000)}`, 0],
    ['while in while', `${'while true; do '.repeat(12_000)}${F}${'; done'.repeat(12_000)}`, 0],
    ['for in for', `${'for a in b; do '.repeat(12_000)}${F}${'; done'.repeat(12_000)}`, 0],
    ['case in case', `${'case a in a) '.repeat(12_000)}${F}${';; esac'.repeat(12_000)}`, 0],
    ['if after if', `${'if true; then :; fi; '.repeat(12_000)}${F}`, 1],
    ['while after while', `${'while false; do :; done; '.repeat(10_000)}${F}`, 1],
    ['for after for', `${'for a in b; do :; done; '.repeat(10_000)}${F}`, 1],
    ['case after case', `${'case a in a) :;; esac; '.repeat(10_000)}${F}`, 1],
    ['group after group', `${'{ :; }; '.repeat(30_000)}${F}`, 1],
    ['parenthesis after parenthesis', `${'( : ); '.repeat(35_000)}${F}`, 1],
    ['functions', `${'f() { :; }; '.repeat(20_000)}${F}`, 1],
    ['a chain of &&', `${': && '.repeat(50_000)}${F}`, 1],
    ['a chain of ||', `${': || '.repeat(50_000)}${F}`, 1],
    ['a pipeline', `${': | '.repeat(60_000)}${F}`, 1],
    ['commands left behind', `${': & '.repeat(60_000)}${F}`, 1],
    ['statements on one line', `${':; '.repeat(80_000)}${F}`, 1],
    ['here-documents', `${'cat <<EOF\nx\nEOF\n'.repeat(15_000)}${F}`, 1],
    ['quoted words', `echo${' \'a\' "b"'.repeat(30_000)}; ${F}`, 1],
    ['assignments before a command', `${'A=1 '.repeat(60_000)}${F}`, 1],
    ['assignments', `${'A=1; '.repeat(50_000)}${F}`, 1],
    ['redirections', `echo${' >f'.repeat(80_000)}; ${F}`, 1],
    ['wrappers', `${'nohup '.repeat(40_000)}${F}`, 1],
    ['launches', `${`${F}; `.repeat(3500)}:`, 3500],
    ['an option given over and over', `${F}${' --timeout-min 5'.repeat(15_000)}`, 1],
    ['scripts handed on', `${"sh -c ':'; ".repeat(22_000)}${F}`, 1],
    ['tests', `${'[[ -n x ]]; '.repeat(20_000)}${F}`, 1],
    ['patterns of a case', `case a in ${'a) :;; '.repeat(35_000)}esac; ${F}`, 1],
    ['backquotes', `echo${' `x`'.repeat(50_000)}; ${F}`, 1],
  ]

  for (const [name, command, count] of forms) {
    const from = performance.now()
    const runs = findFleetRuns(command)
    const took = performance.now() - from

    expect(`${name} ${runs.length} ${took < 500 ? 'in time' : 'too slow'}`).toBe(`${name} ${count} in time`)
  }
})

test('blocks open in one another are read to two hundred deep, of any kind: past that the command is not read at all, and no launch is told of it', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'}`).join()
  const nests: [string, string, string, string][] = [
    ['{ ', '; }', 'sure /w/a.md', '{'],
    ['if true; then ', '; fi', 'maybe /w/a.md', 'if'],
    ['while true; do ', '; done', 'maybe /w/a.md', 'while'],
    ['for a in b; do ', '; done', 'maybe /w/a.md', 'for'],
    ['case a in a) ', ';; esac', 'maybe -', 'case'],
  ]

  for (const [opens, closes, shallow, name] of nests) {
    expect(`${name} ${read(`${opens.repeat(150)}${F}${closes.repeat(150)}`)}`).toBe(`${name} ${shallow}`)
    // The innermost few of a `for` in a `for` are read over again as loops, each a reading of its own: those count from none.
    expect(`${name} ${read(`${opens.repeat(name === 'for' ? 700 : 250)}${F}${closes.repeat(name === 'for' ? 700 : 250)}`)}`).toBe(`${name} `)
  }
  // Kinds mixed count together, and blocks one after another do not count at all.
  expect(read(`${'{ if true; then '.repeat(125)}${F}${'; fi; }'.repeat(125)}`)).toBe('')
  expect(read(`${'{ :; }; '.repeat(1000)}${F}`)).toBe('sure /w/a.md')
})

test('a statement of very many words after a command run to make a word, with an `esac` in it, is looked through for scripts handed on in time that grows with its length', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const took = (command: string): number => {
    const times = [0, 0].map(() => {
      const from = performance.now()

      expect(findFleetRuns(command)).toHaveLength(1)

      return performance.now() - from
    })

    return Math.min(...times)
  }

  // About 250 KiB each: plain words, shells with nothing handed on, and Orca terminals with no `--command` or with one far off.
  for (const [name, command] of [
    ['words', `echo $(echo "esac")${' a'.repeat(125_000)}; ${F}`],
    ['shells', `echo $(echo "esac")${' sh'.repeat(83_000)}; ${F}`],
    ['shells with options', `echo $(echo "esac")${' sh -x'.repeat(42_000)}; ${F}`],
    ['terminals', `echo $(echo "esac")${' orca terminal create'.repeat(12_000)}; ${F}`],
    ['terminals before a command', `echo $(echo "esac")${' orca terminal create'.repeat(12_000)} --command 'true'; ${F}`],
    // Very many commands run to make words, and very many that redirections lead to, in one statement.
    ['commands in words', `echo $(echo "esac")${' $(x)'.repeat(50_000)}; ${F}`],
    ['commands redirected to', `echo $(echo "esac")${' <(x)'.repeat(50_000)}; ${F}`],
  ] as const) {
    expect(`${name} ${took(command) < 500 ? 'in time' : 'too slow'}`).toBe(`${name} in time`)
  }
})

test('an `&` that closes `a && b` leaves both running behind to bash and only `b` to zsh: read as zsh does only where the shell is known to be zsh', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const G = 'fleet-run codex-scout --cwd /w --spec /w/c.md --out /w/d.md'
  const read = (command: string, tool?: 'zsh' | 'bash'): string =>
    findFleetRuns(command, undefined, tool)
      .map(run => `${run.profile === 'codex-build' ? 'F' : 'G'}${run.isBackground ? '&' : ''}${run.isMaybe === true ? '?' : ''}${run.ownsExit === true ? '!' : ''}`)
      .join(' ')

  // What stands before the last pipeline is waited for by zsh: it is sure or not as anywhere, and does not exit as the command does.
  for (const [command, safe, zsh] of [
    [`${F} && echo done &`, 'F&', 'F'],
    [`${F} || ${G} &`, 'F& G&?', 'F G&?'],
    [`true; ${F} && ${G} &`, 'F& G&?', 'F G&?'],
    [`${F} && ${G} | cat &`, 'F& G&?', 'F G&?'],
    [`${F} | cat && ${G} &`, 'F& G&?', 'F G&?'],
    [`${F} &&\n${G} &`, 'F& G&?', 'F G&?'],
    [`${F} && { ${G}; } &`, 'F& G&?', 'F G&?'],
    [`${F} && ( ${G} ) &`, 'F& G&?', 'F G&?'],
    [`{ ${F}; } && ${G} &`, 'F& G&?', 'F G&?'],
    [`( ${F} ) && ${G} &`, 'F& G&?', 'F G&?'],
    [`${F} && true && ${G} &`, 'F& G&?', 'F G&?'],
    [`cd /w && ${F} && ${G} &`, 'F&? G&?', 'F? G&?'],
    [`if true; then ${F} && ${G} & fi`, 'F&? G&?', 'F? G&?'],
    [`echo $(${F} && ${G} &)`, 'F& G&?', 'F G&?'],
    [`zsh -c '${F} && ${G} &'`, 'F& G&?', 'F G&?'],
  ] as const) {
    expect(`${command} ${read(command)}`).toBe(`${command} ${safe}`)
    expect(`${command} ${read(command, 'bash')}`).toBe(`${command} ${safe}`)
    expect(`${command} ${read(command, 'zsh')}`).toBe(`${command} ${zsh}`)
  }
  // Where the two read alike, or the script is handed to another shell, knowing changes nothing.
  for (const [command, both] of [
    [`${F} &`, 'F&'],
    [`${F} | cat &`, 'F&'],
    [`cd /w && ${F} &`, 'F&?'],
    [`{ ${F} && ${G}; } &`, 'F& G&?'],
    [`( ${F} && ${G} ) &`, 'F& G&?'],
    [`bash -c '${F} && ${G} &'`, 'F& G&?'],
    [`sh -c '${F} && ${G} &'`, 'F& G&?'],
    [`${F} && ${G}`, 'F G?!'],
  ] as const) {
    expect(`${command} ${read(command)}`).toBe(`${command} ${both}`)
    expect(`${command} ${read(command, 'zsh')}`).toBe(`${command} ${both}`)
  }
})

test('an `esac` after a command run to make a word unties what is read only where it is a word of its own: in a comment, in quotes or in a here-document it is text', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'}`).join()

  for (const text of [`X=$(printf ok); ${F} # esac`, `X=$(printf ok); echo 'esac'; ${F}`, `X=$(printf ok); echo "an esac"; ${F}`, `X=$(printf ok); cat <<EOF\nesac\nEOF\n${F}`, `X=$(echo "esac"); ${F}`, `X=$(echo 'a) esac'); ${F}`, `${F}; X=$(echo) # esac`]) {
    expect(`${JSON.stringify(text)} ${read(text)}`).toBe(`${JSON.stringify(text)} sure /w/a.md`)
  }
  // A real one, in the command or after it, in backquotes, in double quotes or in a script handed on, still does; so does a bare word.
  for (const real of [`X=$(case a in a) echo;; esac); ${F}`, `X=$(case a in (a) echo;; esac); ${F}`, 'X=`case a in a) echo;; esac`; ' + F, `echo "$(case a in a) echo;; esac)"; ${F}`, `sh -c 'X=$(case a in a) echo;; esac); ${F}'`, `X=$(echo); c a in a) : ;; esac; ${F}`, `X=$(printf ok); echo esac; ${F}`, `X=$(echo ok) \\\nesac; ${F}`]) {
    expect(`${JSON.stringify(real)} ${read(real)}`).toBe(`${JSON.stringify(real)} maybe -`)
  }
})

test('an `esac` in a quoted word unties what is read only where the word is handed on to be run: one that is only printed or passed along is text', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.isMaybe === true ? 'maybe' : 'sure'} ${run.spec ?? '-'}`).join()

  for (const text of [`echo '$(echo esac)'; ${F}`, `echo '$(case a in a) echo;; esac)'; ${F}`, `printf '%s' 'X=$(echo); esac' > /w/note; ${F}`, `git commit -m 'fix $(case…esac) reading'; ${F}`, `X='$(echo esac)'; ${F}`]) {
    expect(`${JSON.stringify(text)} ${read(text)}`).toBe(`${JSON.stringify(text)} sure /w/a.md`)
  }
  // Handed to a shell or to an Orca terminal, behind a wrapper or a name given a value or not, it is a script, and still unties.
  for (const real of [`${F}; sh -c 'X=$(case a in a) echo;; esac)'`, `${F}; bash -lc 'X=$(case a in a) echo;; esac)'`, `${F}; env A=1 nohup zsh -c 'X=$(case a in a) echo;; esac)'`, `${F}; orca terminal create --command 'X=$(case a in a) echo;; esac)'`, `${F}; A=1 sh -c 'X=$(echo); esac'`]) {
    expect(`${JSON.stringify(real)} ${read(real)}`).toBe(`${JSON.stringify(real)} maybe -`)
  }
})

test('a shell told to leave at the first command that fails may be gone past any redirection, whatever its command or with none, and past an assignment of what a command makes: a launch after one is not sure', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): string => findFleetRuns(command).map(run => (run.isMaybe === true ? 'maybe' : 'sure')).join()

  // bash, zsh and sh each leave at every one of these where the file cannot be opened, or the command run for the value fails.
  for (const failing of [': >/nonexist/log', 'true >/nonexist/log', '>/nonexist/log', 'x=1 >/nonexist/log', ': <nofile', 'true 2>/nonexist/log', ': >>/nonexist/log', 'x=$(false)', 'x=`false`', 'x=1 y=$(false)', 'x=$(false) y=2', 'x=${y?}']) {
    expect(`${failing} ${maybe(`set -e; ${failing}; ${F}`)}`).toBe(`${failing} maybe`)
    expect(`${failing} on lines ${maybe(`set -e\n${failing}\n${F}`)}`).toBe(`${failing} on lines maybe`)
  }
  // With no redirection, a command that only answers yes and a name given what is written out cannot fail; nor does any of these
  // where the shell was not told to leave, or the failing is only asked after.
  for (const plain of [`set -e; :; ${F}`, `set -e; true; ${F}`, `set -e; x=1; ${F}`, `set -e; x=1 y=/w; ${F}`, `: >/nonexist/log; ${F}`, `>/nonexist/log; ${F}`, `x=$(false); ${F}`, `set -e; : >/nonexist/log || true; ${F}`, `set -e; if : >/nonexist/log; then :; fi; ${F}`, `set -e; set +e; : >/nonexist/log; ${F}`]) {
    expect(`${plain} ${maybe(plain)}`).toBe(`${plain} sure`)
  }
})

test('a shell told to leave at the first command that fails may be gone past any command: a launch after one is not sure', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): string => findFleetRuns(command).map(run => (run.isMaybe === true ? 'maybe' : 'sure')).join()

  for (const strict of [`set -e; test -f /nope; ${F}`, `set -eu\ncd /w\n${F}`, `set -o errexit; cd /w; ${F}`, `set -xe; cd /w; ${F}`, `set -euo pipefail; cd /w; ${F}`, `set -e; ${F}; ${F}`.replace(/^/, ''), `set -e; (cd /w); ${F}`, `bash -c 'set -e; cd /w; ${F}'`]) {
    expect(`${strict} ${maybe(strict).split(',').at(-1)}`).toBe(`${strict} maybe`)
  }
  // With no command between, with the telling taken back, or told in another shell, the launch is sure.
  for (const plain of [`set -e; ${F}`, `set -e\n\n${F}`, `set -e; set +e; cd /w; ${F}`, `set -o errexit; set +o errexit; cd /w; ${F}`, `set -u; cd /w; ${F}`, `set -x; cd /w; ${F}`, `(set -e; cd /w); cd /w; ${F}`, `sh -c 'set -e; true'; cd /w; ${F}`, `set -e; sleep 1 & ${F}`]) {
    expect(`${plain} ${maybe(plain)}`).toBe(`${plain} sure`)
  }
  expect(maybe(`set -e; ${F}; ${F}`)).toBe('sure,maybe')
  // A loop, a group or an `if` left behind or piped on is told in a shell of its own; one waited for leaves the shell as its end left it.
  for (const apart of [`for x in a; do set -e; done & false; ${F}`, `for x in $L; do set -e; done & false; ${F}`, `while true; do set -e; break; done | cat; false; ${F}`, `{ set -e; } & false; ${F}`, `if true; then set -e; fi | cat; false; ${F}`, `set -e; for x in a; do set +e; done; false; ${F}`, `for x in a b; do set -e; set +e; done; false; ${F}`]) {
    expect(`${apart} ${maybe(apart)}`).toBe(`${apart} sure`)
  }
  // A command whose failing is only asked after ends no shell: in the condition of an `if` or a loop, before an `&&` or `||`, behind a `!`.
  for (const asked of [`set -e; if false; then :; fi; ${F}`, `set -e; if false; then :; elif false; then :; fi; ${F}`, `set -e; while false; do :; done; ${F}`, `set -e; until true; do :; done; ${F}`, `set -e; false && true; ${F}`, `set -e; false || true; ${F}`, `set -e; ! true; ${F}`, `set -e; if false && true; then :; fi; ${F}`, `set -e; if false; true; then :; fi; ${F}`, `set -e; while false; false; do :; done; ${F}`, `set -e; if (false); then :; fi; ${F}`, `set -e; if { false; }; then :; fi; ${F}`, `set -e; (false) || true; ${F}`, `set -e; { false && true; }; ${F}`]) {
    expect(`${asked} ${maybe(asked)}`).toBe(`${asked} sure`)
  }
  // The last command of such a list, and what a branch or a body runs, end it as any command does.
  for (const ending of [`set -e; true && false; ${F}`, `set -e; false || false; ${F}`, `set -e; if true; then false; fi; ${F}`, `set -e; if false; then :; else false; fi; ${F}`, `set -e; while true; do false; done; ${F}`, `set -e; (false && true); ${F}`, `set -e; false && true || false; ${F}`, `set -e; test -f /nope && echo x; ${F}`]) {
    expect(`${ending} ${maybe(ending)}`).toBe(`${ending} maybe`)
  }
  // A pipeline may fail with any element of it, whatever it ends in.
  for (const piped of [`set -euo pipefail\ngrep -q x /nope | true\n${F}`, `set -euo pipefail; false | :; ${F}`, `set -e -o pipefail; false |& true; ${F}`, `set -o pipefail; set -e; false | true; ${F}`, `set -e; false | true | true; ${F}`, `set -e; { false; } | true; ${F}`, `set -e; false | { true; }; ${F}`, `set -e; (false) | true; ${F}`]) {
    expect(`${JSON.stringify(piped)} ${maybe(piped)}`).toBe(`${JSON.stringify(piped)} maybe`)
  }
  for (const taken of [`set -e; false | true || true; ${F}`, `set -e; false | true && true; ${F}`, `set -e; true | true; ${F}`, `set -e; x=1 | true; ${F}`, `set -e; if false | true; then :; fi; ${F}`, `set -e; ! false | true; ${F}`, `set -e; true | :; true; ${F}`]) {
    expect(`${taken} ${maybe(taken)}`).toBe(`${taken} sure`)
  }
  // Told to leave in an element of a pipeline that is not its last, or left running behind, another shell is told: this one stays.
  for (const apart of [`set -e | cat; false; ${F}`, `set -e & false; ${F}`, `set -o errexit |& cat; false; ${F}`, `set -eu | cat\nfalse\n${F}`]) {
    expect(`${apart} ${maybe(apart)}`).toBe(`${apart} sure`)
  }
  // The last element of a pipeline zsh runs in this shell, and one that may not run may have run.
  for (const here of [`cat | set -e; false; ${F}`, `true && set -e; false; ${F}`, `set -e; set -e | cat; false; ${F}`]) {
    expect(`${here} ${maybe(here)}`).toBe(`${here} maybe`)
  }
  // A parenthesis behind a `!` is only asked after, alone or as the first of a pipeline, and whatever fails in it.
  for (const turned of [`set -e; ! (false); ${F}`, `set -e; ! ( false ) | cat; ${F}`, `set -e; ! ( (false) ); ${F}`, `set -e; ! (true; (false)); ${F}`, `set -e; ! true | (false); ${F}`]) {
    expect(`${turned} ${maybe(turned)}`).toBe(`${turned} sure`)
  }
  for (const failing of [`set -e; (false); ${F}`, `set -e; ! (false); (false); ${F}`, `set -e; (! true; (false)); ${F}`]) {
    expect(`${failing} ${maybe(failing)}`).toBe(`${failing} maybe`)
  }
  // Behind `command` or `builtin`, the telling to stay is not sure: zsh looks for a program of that name.
  for (const behind of [`set -e; command set +e; false; ${F}`, `set -e; builtin set +e; false; ${F}`, `set -e; command set +o errexit; false; ${F}`]) {
    expect(`${behind} ${maybe(behind)}`).toBe(`${behind} maybe`)
  }
  // Told to stay only where that telling may not run, or runs in another shell, the shell is still told to leave.
  for (const unsure of [`set -e; true || set +e; false; ${F}`, `set -e; if ! true; then set +e; fi; false; ${F}`, `set -e; if true; then :; else set +e; fi; false; ${F}`, `set -e; until true; do set +e; done; false; ${F}`, `set -e; set +e | cat; false; ${F}`, `set -e; cat | { set +e; }; false; ${F}`, `set -e; if false; then set +e; fi; false; ${F}`, `set -e; true || for x in a; do set +e; done; false; ${F}`, `set -e; set +o errexit & false; ${F}`, `set -e; while true; do set +e; break; done; false; ${F}`]) {
    expect(`${unsure} ${maybe(unsure)}`).toBe(`${unsure} maybe`)
  }
  expect(maybe(`set -e; set +e; false; ${F}`)).toBe('sure')
  for (const told of [`for x in a; do set -e; done; false; ${F}`, `{ set -e; }; false; ${F}`, `set -e; for x in a; do set +e; done & false; ${F}`]) {
    expect(`${told} ${maybe(told)}`).toBe(`${told} maybe`)
  }
})

test('an `&` that closes a parenthesis, a `{` group or a block leaves every launch in it running behind: none of them ends with the command', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const G = 'fleet-run codex-scout --cwd /w --spec /w/c.md --out /w/d.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.profile === 'codex-build' ? 'F' : 'G'}${run.isBackground ? '&' : ''}${run.ownsExit === true ? '!' : ''}`).join(' ')

  for (const [command, runs] of [
    [`(${F}) &`, 'F&'],
    [`( cd /w; ${F} ) &`, 'F&'],
    [`{ ${F}; } &`, 'F&'],
    [`{ ${F}; ${G}; } &`, 'F& G&'],
    [`(${F}; (${G})) &`, 'F& G&'],
    [`if true; then ${F}; fi &`, 'F&'],
    [`for x in a b; do ${F}; done &`, 'F& F&'],
    [`while false; do ${F}; done &\n${G}`, 'F& G!'],
    [`(${F}) & ${G}`, 'F& G!'],
    [`${G}; { ${F}; } &`, 'G F&'],
    // A pipeline closed by an `&` is left behind whole, and so is a list of them joined by `&&` or `||`.
    [`${F} | cat &`, 'F&'],
    [`${F} 2>&1 | tail -5 &`, 'F&'],
    [`${F} |& cat &`, 'F&'],
    [`{ ${F}; } | cat &`, 'F&'],
    [`( ${F} ) | cat &`, 'F&'],
    [`true && ${F} | cat &`, 'F&'],
    [`${F} && echo done &`, 'F&'],
    [`${F} || true &`, 'F&'],
    [`{ ${F}; } && echo &`, 'F&'],
    [`${F} && ${G} &`, 'F& G&'],
    [`${G}; ${F} | cat &`, 'G F&'],
    [`${G}\n${F} && echo done &`, 'G F&'],
    [`${F} | cat & ${G}`, 'F& G!'],
    [`{ ${G}; ${F} | cat & }`, 'G F&'],
    [`(${G}; ${F} && echo ok &)`, 'G F&'],
    [`if true; then ${G}; fi; ${F} | cat &`, 'G F&'],
    // An `&` in a group or a block leaves behind only what stands in its own list there, whatever the group stands after.
    [`${F} && { ${G} & }`, 'F G&'],
    [`${F} || { ${G} & }`, 'F G&'],
    [`${F} | { ${G} & }`, 'F G&'],
    [`${F} && { ${G} & echo b; }`, 'F G&'],
    [`${F} && { { ${G} & }; }`, 'F G&'],
    [`${F} && ! { ${G} & }`, 'F G&'],
    [`${F} && { ${G} &\n}`, 'F G&'],
    [`{ ${F} && { ${G} & }; }`, 'F G&'],
    [`${F} && {\n${G} &\n}`, 'F G&'],
    [`${F} && ( ${G} & )`, 'F G&'],
    [`${F} && if true; then ${G} & fi`, 'F G&'],
    [`{ ${F}; ${G} & }`, 'F G&'],
    [`${F} | { ${G}; } &`, 'F& G&'],
    [`${F} && { ${G}; } &`, 'F& G&'],
    // So does one that closes a parenthesis in a group: the list it leaves behind begins in the group.
    [`${F} && { (${G}) & }`, 'F G&'],
    [`${F} || { { (${G}) & }; }`, 'F G&'],
    [`${F} | { ( ${G} ) & }`, 'F G&'],
    [`${F} && if true; then (${G}) & fi`, 'F G&'],
    [`${F} && { (${G}) & } &`, 'F& G&'],
    // Waited for, each is as it was.
    [`${F} | cat`, 'F'],
    [`${F} && echo done`, 'F'],
    [`${F} & echo done`, 'F&'],
    [`${F}; echo done &`, 'F'],
    [`(${F})`, 'F!'],
    [`{ ${F}; }`, 'F!'],
    [`(${F}) && echo ok`, 'F'],
    [`(${F} &)`, 'F&'],
  ] as const) {
    expect(`${command} => ${read(command)}`).toBe(`${command} => ${runs}`)
  }
})

test('a shell told to leave at the first command that fails is not left by one that cannot fail: an assignment written out, `true`, `export` of a name, a failing taken in', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const maybe = (command: string): string => findFleetRuns(command).map(run => (run.isMaybe === true ? 'maybe' : 'sure')).join()

  for (const plain of [`set -euo pipefail\nexport X=1\n${F}`, `set -e; X=1; Y="$X/a"; ${F}`, `set -e; true; :; ${F}`, `set -e; readonly R=/w; declare D=1; typeset T; ${F}`, `set -e; set -x; ${F}`, `set -e; test -f /nope || true; ${F}`, `set -e; rm /w/old || :\n${F}`]) {
    expect(`${plain} ${maybe(plain)}`).toBe(`${plain} sure`)
  }
  for (const strict of [`set -e; cd /w; ${F}`, `set -e; X=$(cat /nope); ${F}`, `set -e; export X=\`cat /nope\`; ${F}`, `set -e; export X="$(cat /nope)"; ${F}`, `set -e; test -f /nope || echo no; ${F}`, `set -e; local X=1; ${F}`, `set -e; env true; ${F}`, `set -e; export -f f; ${F}`]) {
    expect(`${strict} ${maybe(strict)}`).toBe(`${strict} maybe`)
  }
})

test('a launch past what is not followed here may be passed by: it is told so, and no path of it is taken for sure', () => {
  const F = 'fleet-run codex-build --cwd /w --spec /w/a.md --out /w/b.md'
  const read = (command: string): string => findFleetRuns(command).map(run => `${run.isMaybe} ${run.spec} ${run.out}`).join()

  // The launch is a default never taken, a part of a quote that goes on, or an argument of `:` in zsh, which ends the `case` where it ends.
  for (const odd of [`X=1; : \${X:-$(${F})}`, `echo "\${U:-" ; ${F} ; "}"`, `: $(case a in b) : ;; esac) ${F}`, `X=$(case b in a) ${F}\n: ;; esac)`, `eval "$PRELUDE"; ${F}`, `case $1 in a) ${F} ;; esac`]) {
    expect(`${odd} ${read(odd)}`).toBe(`${odd} true undefined undefined`)
  }
  expect(read(F)).toBe('undefined /w/a.md /w/b.md')
})
