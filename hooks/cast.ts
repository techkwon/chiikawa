import type { Color } from 'claude-code'

import type { Lang, MemberId, Mood, Phrase, Role, Roles, Task, WorkRole } from '../types'

import { EN } from './cast.en'
import { JA } from './cast.ja'
import { KO } from './cast.ko'
import { asIs, inAll, LANGS } from './words'

/** What a character is whatever the language: its mark, its own role, whether it talks, its colors. */
export type Member = {
  id: MemberId
  /** A mark in plain text, for a toast and an agent's description. */
  mark: string
  role: Role
  /** Whether the character says whole sentences in the comic. */
  speaks: boolean
  /** The symbol color: the name badge. */
  color: string
  ink: string
  /** The same hue as a line on a dark terminal; `toneOf` gives its fellow for a light one. */
  line: Color
}

export const PINK = '#f7a8c0'
export const LEAD: MemberId = 'hachiware'
/** The three the comic is about: always on the page, whatever they are doing. */
export const CORE: readonly MemberId[] = ['hachiware', 'chiikawa', 'usagi']

// The pastel hues are drawn for a dark terminal; on a light one each gives
// way to a deeper fellow that reads against white.
const ON_LIGHT: Readonly<Record<string, string>> = {
  '#6fa0ea': '#2f62b8',
  '#f7a8c0': '#c2457a',
  '#f3dc6b': '#8a6d00',
  '#d8c36a': '#7a6a1c',
  '#e0605a': '#b8322c',
  '#f08a24': '#b05a00',
  '#f6c9a0': '#a8703a',
  '#c08a52': '#7a4a1e',
  '#f0dcb4': '#9a7a3c',
  '#e8566a': '#b82f48',
  '#f29bb0': '#c23a66',
  '#c9c9c9': '#6e6e6e',
  '#f48fb1': '#b8477a',
  '#a8d8f0': '#1f7fa8',
  '#a89f91': '#6b6257',
}

/** One of this mod's colors as it reads on the person's theme; a theme's own key is left to the theme. */
export const toneOf = (color: Color, isLight: boolean): Color => (isLight ? (ON_LIGHT[color] ?? color) : color)

export const MEMBERS: Record<MemberId, Member> = {
  hachiware: {
    id: 'hachiware',
    mark: '🐱',
    role: '지휘',
    speaks: true,
    color: '#4a7fd4',
    ink: '#ffffff',
    line: '#6fa0ea',
  },
  chiikawa: {
    id: 'chiikawa',
    mark: '🐹',
    role: '구현',
    speaks: false,
    color: '#f7a8c0',
    ink: '#000000',
    line: '#f7a8c0',
  },
  usagi: {
    id: 'usagi',
    mark: '🐰',
    role: '탐색',
    speaks: false,
    color: '#f3dc6b',
    ink: '#000000',
    line: '#f3dc6b',
  },
  rakko: {
    id: 'rakko',
    mark: '🦦',
    role: '구현',
    speaks: true,
    color: '#8c7a2e',
    ink: '#ffffff',
    line: '#d8c36a',
  },
  shisa: {
    id: 'shisa',
    mark: '🦁',
    role: '구현',
    speaks: true,
    color: '#f08a24',
    ink: '#000000',
    line: '#f08a24',
  },
  kurimanju: {
    id: 'kurimanju',
    mark: '🌰',
    role: '검토',
    speaks: false,
    color: '#8a5a2b',
    ink: '#ffffff',
    line: '#c08a52',
  },
  kani: {
    id: 'kani',
    mark: '🦀',
    role: '조사',
    speaks: false,
    color: '#e8566a',
    ink: '#ffffff',
    line: '#f29bb0',
  },
  pochette: {
    id: 'pochette',
    mark: '👛',
    role: '구현',
    speaks: true,
    color: '#c9c9c9',
    ink: '#000000',
    line: '#f48fb1',
  },
  momonga: {
    id: 'momonga',
    mark: '🍑',
    role: '검토',
    speaks: true,
    color: '#a8d8f0',
    ink: '#000000',
    line: '#a8d8f0',
  },
  rodo: {
    id: 'rodo',
    mark: '🔔',
    role: '지휘',
    speaks: true,
    color: '#a89f91',
    ink: '#000000',
    line: '#a89f91',
  },
}

export const ORDER: readonly MemberId[] = ['hachiware', 'chiikawa', 'usagi', 'rakko', 'shisa', 'kurimanju', 'kani', 'pochette', 'momonga', 'rodo']
/** The ones who take tasks: 하치와레 conducts, and 노동 갑옷 씨 only rings the bell. */
export const WORKERS: readonly MemberId[] = ['chiikawa', 'usagi', 'rakko', 'shisa', 'kurimanju', 'kani', 'pochette', 'momonga']

export type Situation = 'idle' | 'start' | 'done' | 'fail' | 'slow' | 'denied'

export const MOODS: Record<Situation, Mood> = { idle: 'calm', start: 'calm', done: 'glad', fail: 'sad', slow: 'tired', denied: 'shock' }

const SITUATIONS: readonly Situation[] = ['idle', 'start', 'done', 'fail', 'slow', 'denied']

/** 하치와레's own lines for what he does as the conductor. */
export type Leader = Record<'idle' | 'allDone' | 'sweep' | 'trouble' | 'cry' | 'cheer' | 'sure' | 'found', string>

/**
 * The cast in one language: what each character is called and known for, the
 * work it takes, how it talks and what it says. A language has every part,
 * so one that lacks a line does not load.
 */
export type Cast = {
  names: Record<MemberId, string>
  /** A character's name where there is little room for it, for one whose name is long. */
  short: Partial<Record<MemberId, string>>
  /** The animal the character is drawn after; none where its name already says so. */
  kinds: Record<MemberId, string>
  /** What the character is known for, the reason it gets its kind of work. */
  titles: Record<MemberId, string>
  /** The work it takes, in a few words. */
  jobs: Record<MemberId, string>
  /** What the roles are called on the screen. */
  roles: Record<Role, string>
  /** What the kinds of work are called in the comic's own words. */
  job: Record<Role, string>
  /** The work of a role in a few words, for a character given a role that is not its own. */
  duty: Record<WorkRole, string>
  /** Whose each kind of work is, for the lines that tell of a role changed. */
  specialties: string
  /** A line or a gesture the character has for each occasion; a gesture is in parentheses. */
  quotes: Record<MemberId, Record<Situation, readonly string[]>>
  leader: Leader
  /** His way of reading a friend who cannot talk: "그 말은 ○○라는 거?" with the blank filled. */
  means: (what: string) => string
  /** What the blank is filled with: a task taken, failed, passed, a thing found, a task done, a hand lent to find or to mend. */
  read: Record<'taken' | 'failed' | 'passed' | 'found' | 'done' | 'seeking' | 'mending', string>
  /**
   * Every line a character's voice may use, for the instruction blocks. Each is
   * a line or a sound the character has in the comic; where it was checked
   * against a Japanese source, the original stands beside it.
   */
  lines: Record<MemberId, readonly string[]>
  manner: Record<MemberId, string>
  /** 하치와레 said politely, for a person who would rather be spoken to so. */
  politeLeader: string
}

export const CAST: Record<Lang, Cast> = { en: EN, ko: KO, ja: JA }

/** A character's name where there is little room for it. */
export const shortName = (lang: Lang, id: MemberId): string => CAST[lang].short[id] ?? CAST[lang].names[id]

/** One of the character's own lines for the situation; `turn` rotates them. */
export const say = (lang: Lang, member: MemberId, situation: Situation, turn: number): string => {
  const lines = CAST[lang].quotes[member][situation]

  return lines[Math.abs(turn) % lines.length] ?? lines[0] ?? ''
}

/** Every sound and gesture a character has, as the comic spells it: its lines for each situation, and the ones its voice lists. */
export const soundsOf = (lang: Lang, member: MemberId): string[] => [
  ...Object.values(CAST[lang].quotes[member]).flat(),
  ...CAST[lang].lines[member].flatMap(line => [...line.matchAll(/"([^"]+)"/g)].map(found => found[1] ?? '')),
]

/** A gesture is told, not said: it is drawn without quotation marks. */
export const isGesture = (quote: string): boolean => quote.startsWith('(')

export const shown = (quote: string): string => (isGesture(quote) ? quote : `“${quote}”`)

/** A gesture as what was done, without the parentheses that mark it; a line as it is. */
export const bare = (quote: string): string => quote.replace(/^\((.*)\)$/, '$1')

/**
 * The places where the Korean cast has the very sound or gesture the Japanese
 * one has, for the friends who cannot talk: each checked by hand, a sound
 * against the original the Korean cast's own list names beside it, a gesture
 * against what it tells. Two lines that only share a place are not here, as
 * 나도! and ヤーッ!!, nor two that are one sound at different places, as 푸랴!
 * and プルャ: nothing is made of those. The English cast is the Japanese one
 * put into English place for place, so every place of those two is one line.
 */
const ALIKE: Readonly<Partial<Record<MemberId, Partial<Record<Situation, readonly number[]>>>>> = {
  chiikawa: { start: [0], fail: [0], denied: [0, 1] },
  usagi: { idle: [0, 1], start: [0, 1], fail: [0], slow: [0] },
  kurimanju: { idle: [0], start: [0], done: [0, 1, 2], fail: [0], slow: [0], denied: [0] },
  kani: { idle: [0, 1], start: [0], done: [0, 1], fail: [0], slow: [0], denied: [0] },
}

/** Each sound and gesture of a character as the languages have it, a place at a time: the Korean one only where it is that very line. */
const voicesOf = (member: MemberId): Partial<Phrase>[] =>
  SITUATIONS.flatMap(situation =>
    CAST.ja.quotes[member][situation].map((ja, at) => ({
      ja,
      en: CAST.en.quotes[member][situation][at],
      ko: ALIKE[member]?.[situation]?.includes(at) === true ? CAST.ko.quotes[member][situation][at] : undefined,
    })),
  )

/**
 * The first line of a report as each language shows it. It is the worker's
 * own writing and stays as written, but for one case: a character that
 * cannot talk wrote one of its own sounds or gestures, letter for letter, and
 * another language has that very line and no other for it. A gesture written
 * without its parentheses is known by what it tells, and is shown without
 * them. No line is made up: a language with no such line shows the one written.
 */
export const reported = (member: MemberId, line: string): Phrase => {
  if (MEMBERS[member].speaks) return asIs(line)
  const told = (voice: string): string => (isGesture(line) ? voice : bare(voice))
  const known = voicesOf(member).filter(voice => LANGS.some(lang => voice[lang] !== undefined && told(voice[lang]) === line))

  return inAll(lang => {
    const [only, ...others] = new Set(known.flatMap(voice => voice[lang] ?? []))

    return only === undefined || others.length > 0 ? line : told(only)
  })
}

/** How 하치와레 reads what a friend who cannot talk just did. */
export const readingOf = (lang: Lang, member: MemberId, situation: 'start' | 'done' | 'fail', role: Role): string | undefined => {
  const { leader, means, read } = CAST[lang]

  if (MEMBERS[member].speaks) return situation === 'fail' ? leader.trouble : undefined
  if (situation === 'start') return means(read.taken)
  if (situation === 'fail') return member === 'chiikawa' ? leader.cry : means(read.failed)
  if (role === '검토') return means(read.passed)
  if (role === '탐색') return leader.found

  return means(role === '조사' ? read.found : read.done)
}

export const isActive = (task: Task): boolean => task.status === 'running' || task.status === 'waiting'

/** What a task is called on a screen in that language: as it was handed over, but for one the mode named itself. */
export const titleOf = (lang: Lang, task: Pick<Task, 'title' | 'titles'>): string => task.titles?.[lang] ?? task.title

const PREFERENCE: Record<WorkRole, readonly MemberId[]> = {
  구현: ['shisa', 'rakko', 'pochette', 'chiikawa'],
  검토: ['kurimanju', 'momonga', 'rakko'],
  조사: ['kani', 'shisa', 'usagi'],
  탐색: ['usagi', 'kani', 'chiikawa'],
}

/**
 * A test for the English words of a pattern taken whole, so that `format` is
 * not found in `information`, and for the Korean and Japanese ones wherever
 * they stand.
 */
const worded = (english: string, ...others: readonly string[]): RegExp => new RegExp([`(?<![a-z])(?:${english})(?![a-z])`, ...others].join('|'), 'i')

const SPECIALTY: readonly (readonly [RegExp, MemberId])[] = [
  [worded('security|adversarial|agy-review', '반박|보안', 'セキュリティ|反論|脆弱性'), 'momonga'],
  [worded('front-?end|agy-pro|ui|(?:re)?design(?:s|er|ers|ed|ing)?|css', '화면|디자인|스타일', '画面|デザイン|スタイル'), 'pochette'],
  [worded('root-cause|performance|codex-hard|debug(?:s|ged|ger|ging)?', '디버그|디버깅|원인|어려운', 'デバッグ|原因|難しい'), 'rakko'],
  [worded('agy-fast|renam(?:e|es|ed|ing)|(?:re)?format(?:s|ted|ter|ting)?|typos?|clean-?up', '오타|포맷|이름 바꾸|풀 ?뽑기', '誤字|タイポ|フォーマット|リネーム|草むしり'), 'chiikawa'],
]
const SMALL = worded('haiku')

/**
 * The character a kind of work belongs to before its role is weighed: screens
 * to 포쉐트 갑옷 씨, hard bugs to 랏코. Where two fit, the earlier test wins: a
 * security check of a screen is 모몽가's, a screen's bug 포쉐트 갑옷 씨's.
 */
export const specialistOf = (engine: string, title: string, role?: Role): MemberId | undefined => {
  const text = `${engine} ${title}`

  return SPECIALTY.find(([test]) => test.test(text))?.[1] ?? (role === '구현' && SMALL.test(text) ? 'chiikawa' : undefined)
}

export const WORK_ROLES: readonly WorkRole[] = ['구현', '검토', '조사', '탐색']

/** The role a character has: the one the person gave it, or its own. */
export const roleOf = (id: MemberId, roles: Roles = {}): Role => roles[id] ?? MEMBERS[id].role

/** The work a character takes, in a few words: its own, or that of the role the person gave it. */
export const jobOf = (lang: Lang, id: MemberId, roles: Roles = {}): string => {
  const given = roles[id]

  return given === undefined ? CAST[lang].jobs[id] : CAST[lang].duty[given]
}

/** The roles with one character's set: its own role, or none, is no change kept, and only one who takes tasks has a role to change. */
export const withRole = (roles: Roles, id: MemberId, role: WorkRole | null): Roles => {
  const rest: Roles = Object.fromEntries(Object.entries(roles).filter(([key]) => key !== id))

  return role === null || role === MEMBERS[id].role || !WORKERS.includes(id) ? rest : { ...rest, [id]: role }
}

/** The roles an earlier session kept, with whatever is not a role of one who takes tasks left out. */
export const rolesFrom = (kept: unknown): Roles => {
  if (typeof kept !== 'object' || kept === null) return {}
  const held: Readonly<Record<string, unknown>> = { ...kept }

  return WORKERS.reduce<Roles>((roles, id) => {
    const role = WORK_ROLES.find(one => one === held[id])

    return role === undefined ? roles : withRole(roles, id, role)
  }, {})
}

/**
 * The specialist, or the role's own character, or while that one is busy the
 * next with free hands. A specialty is a kind of work, so its character comes
 * before one the person gave the role; that one comes before those whose own
 * the role is; one given another role leaves this one, and its specialty too.
 */
export const pickMember = (role: Role, tasks: readonly Task[], specialist?: MemberId, roles: Roles = {}): MemberId => {
  const wanted = role === '지휘' ? '구현' : role
  const given = WORKERS.filter(id => roles[id] === wanted)
  const stayed = PREFERENCE[wanted].filter(id => roles[id] === undefined)
  const own = given.length + stayed.length > 0 ? [...given, ...stayed] : PREFERENCE[wanted]
  const first = specialist !== undefined && roles[specialist] === undefined ? specialist : undefined
  const order = first === undefined ? own : [first, ...own.filter(id => id !== first)]
  const free = order.find(id => !tasks.some(task => task.member === id && isActive(task)))

  return free ?? order[0] ?? 'shisa'
}

// A kind that looks things up is not one that finds a place, whatever else its name holds: the first test that fits wins.
const TYPE_ROLES: readonly (readonly [RegExp, Role])[] = [
  [worded('research(?:er)?|writer|document(?:s|er|ation)?|requirements?|learning|mentor|plan(?:ner|ning)?'), '조사'],
  [worded('explorer?|scout|search(?:er)?|guide'), '탐색'],
  [worded('review(?:er)?|security|quality|audit(?:or)?|test(?:s|er|ing)?|root-cause|analy(?:st|sis|ze|zer|tics)'), '검토'],
  [worded('architect|engineer|expert|refactor(?:ing)?'), '구현'],
]
const WORK_WORDS: readonly (readonly [RegExp, Role])[] = [
  [worded('review(?:s|ed|er|ing)?|verif(?:y|ies|ied|ication)|audit(?:s|ed|ing)?', '검토|리뷰|검증|다시 보', 'レビュー|検証|見直'), '검토'],
  [worded('explor(?:e|es|ed|ing)|locat(?:e|es|ed|ing)|find(?:s|ing)?', '탐색|찾|위치', '探索|探す|さがす|場所'), '탐색'],
  [worded('research(?:es|ed|ing)?|document(?:s|ed|ing|ation)?|summar(?:y|ies|ize|izes|ized|izing)', '조사|정리|문서', '調査|整理|文書|ドキュメント|まとめ'), '조사'],
  [worded('implement(?:s|ed|ing|ation)?|fix(?:es|ed|ing)?|(?:re)?build(?:s|ing)?|(?:re)?writ(?:e|es|ing)', '구현|수정|고치|작성|만들|토벌', '実装|修正|直す|作成|作る|討伐'), '구현'],
]

/** The role an agent type or a description tells, when one does. */
export const roleOfAgent = (subagentType: string, description: string): Role | undefined =>
  (TYPE_ROLES.find(([test]) => test.test(subagentType)) ?? WORK_WORDS.find(([test]) => test.test(description)))?.[1]

export const PROFILES: Record<string, Role> = {
  'codex-build': '구현',
  'codex-hard': '구현',
  'codex-scout': '탐색',
  'grok-research': '조사',
  'grok-build': '구현',
  'agy-fast': '구현',
  'agy-pro': '구현',
  'agy-review': '검토',
  'claude-build': '구현',
  'claude-review': '검토',
}
