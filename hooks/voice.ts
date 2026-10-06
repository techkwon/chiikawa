import type { Lang, MemberId, Role, Roles, WorkRole } from '../types'

import { CAST, jobOf, LEAD, MEMBERS, ORDER, roleOf, soundsOf, WORKERS } from './cast'
import { EN } from './voice.en'
import { JA } from './voice.ja'
import { KO } from './voice.ko'
import { LANGS } from './words'

/**
 * What the mode tells the model, in one language: the section the conductor
 * works by, the block that makes a task's worker a character, and the lines
 * that go beside a prompt or a tool's result.
 */
export type Script = {
  /** What opens the block that tells a task's worker which character it is, and the line that tells the main loop who took a task. */
  mark: string
  /** How every block closes: the asked-for format comes before the character. */
  strict: string
  /** How a block's own words open, after its mark. */
  bodyHead: string
  /** What the main loop is told once the mode is turned off. */
  standDown: string
  /** A few things named one after another. */
  list: (parts: readonly string[]) => string
  /** The section the main loop's system prompt gains: it conducts as 하치와레. */
  leader: (it: { voice: string; lines: string; isTrioShown: boolean; roster: string; mute: readonly string[] }) => string
  rosterRow: (it: { mark: string; name: string; about: string; job: string; given?: string; speaks: boolean }) => string
  body: (it: { name: string; about: string; role: string; speaks: boolean; manner: string; opening: string; lines: string }) => string
  memberTail: (opening: string) => string
  orcaTail: (opening: string) => string
  pickLead: string
  pickFriend: (name: string) => string
  /** One character with the role it has now, and the work that comes with it. */
  roleOne: (name: string, role: string, job: string) => string
  roleNote: (changed: string | undefined, own: string | undefined, specialties: string) => string
  /** What follows an Agent call's result: who took the task. */
  took: (name: string, role: string, speaks: boolean) => string
  /** What follows a fleet-run launch: who took the task, and the copy of its spec it ran from. */
  fleetTook: (engine: string, title: string, name: string, role: string, copy?: string) => string
  /** What that line ends with where the spec already held the mode's mark and no character could be read from it: it ran as written. */
  uncopied: string
}

const SCRIPTS: Record<Lang, Script> = { en: EN, ko: KO, ja: JA }

/** What opens the mode's block and its line after a tool's result, in each language. */
export const MARKS: Record<Lang, string> = { en: EN.mark, ko: KO.mark, ja: JA.mark }

/** Whether a text holds the mode's mark, in whichever language it was written. */
export const isMarked = (text: string): boolean => LANGS.some(lang => text.includes(MARKS[lang]))

const lines = (lang: Lang, id: MemberId): string =>
  CAST[lang].lines[id].map(line => `  - ${line}`).join('\n')

const MUTE = WORKERS.filter(id => !MEMBERS[id].speaks)

/** What a character is known for: its kind, where its name does not say it, and what the comic gives it. */
const aboutOf = (lang: Lang, id: MemberId): string => SCRIPTS[lang].list([CAST[lang].kinds[id], CAST[lang].titles[id]].filter(part => part !== ''))

const roster = (lang: Lang, roles: Roles): string =>
  WORKERS.map(id => {
    const given = roles[id]

    return SCRIPTS[lang].rosterRow({
      mark: MEMBERS[id].mark,
      name: CAST[lang].names[id],
      about: aboutOf(lang, id),
      job: jobOf(lang, id, roles),
      ...(given === undefined ? {} : { given: CAST[lang].roles[given] }),
      speaks: MEMBERS[id].speaks,
    })
  }).join('\n')

export const leaderSection = (lang: Lang, isPolite = false, isTrioShown = true, roles: Roles = {}): string =>
  SCRIPTS[lang].leader({
    voice: isPolite ? CAST[lang].politeLeader : CAST[lang].manner.hachiware,
    lines: lines(lang, LEAD),
    isTrioShown,
    roster: roster(lang, roles),
    mute: MUTE.map(id => CAST[lang].names[id]),
  })

/** What the main loop is told once the mode is turned off. */
export const standDown = (lang: Lang): string => SCRIPTS[lang].standDown

const opening = (lang: Lang, id: MemberId): string => `${MEMBERS[id].mark} ${CAST[lang].names[id]}:`

/** How a block opens, under a rule that sets it off from the task above it. */
const blockHead = (lang: Lang): string => `

---
${MARKS[lang]}
`

const body = (lang: Lang, id: MemberId, role: Role): string =>
  SCRIPTS[lang].body({
    name: CAST[lang].names[id],
    about: aboutOf(lang, id),
    role: CAST[lang].roles[role],
    speaks: MEMBERS[id].speaks,
    manner: CAST[lang].manner[id],
    opening: opening(lang, id),
    lines: lines(lang, id),
  })

/** What a subagent's task gains at its end: the character it works as. */
export const memberBlock = (lang: Lang, id: MemberId, role: Role): string => `${blockHead(lang)}${body(lang, id, role)}
${SCRIPTS[lang].memberTail(opening(lang, id))}`

/**
 * A subagent's task without the block at its end, where it has one: the
 * mode's own in whichever language, from its rule to its last line, as when a
 * task is handed on again. A task that only mentions the mark is left as it is.
 */
export const unvoiced = (prompt: string): string => {
  const ended = prompt.trimEnd()
  const at = Math.max(...LANGS.map(lang => (ended.endsWith(SCRIPTS[lang].strict) ? prompt.lastIndexOf(`${blockHead(lang)}${SCRIPTS[lang].bodyHead}`) : -1)))

  return at >= 0 ? prompt.slice(0, at) : prompt
}

/** What an Orca worker's spec gains at its end. */
export const orcaBlock = (lang: Lang, id: MemberId, role: Role): string => `${blockHead(lang)}${body(lang, id, role)}
${SCRIPTS[lang].orcaTail(opening(lang, id))}`

/** What follows an Agent call's result: who took the task. */
export const tookNote = (lang: Lang, id: MemberId, role: Role): string => SCRIPTS[lang].took(CAST[lang].names[id], CAST[lang].roles[role], MEMBERS[id].speaks)

/**
 * The character a spec is already cast as: the one named by the last block of
 * the mode's own in it, in whichever language the block was written. None
 * where the text holds no block that opens as the mode's does.
 */
export const castIn = (text: string): MemberId | undefined =>
  LANGS.flatMap(lang => WORKERS.map(id => ({ id, name: CAST[lang].names[id], at: text.lastIndexOf(`${MARKS[lang]}\n${SCRIPTS[lang].bodyHead}${CAST[lang].names[id]}`) })))
    .filter(one => one.at >= 0)
    // The last block is the one the worker reads last, and of two names that open alike the longer is the one written.
    .sort((a, b) => b.at - a.at || b.name.length - a.name.length)[0]?.id

/** What follows a fleet-run launch: who took the task, and the copy of its spec it ran from, or that none was made of a spec that held the mark already. */
export const fleetNote = (lang: Lang, id: MemberId, role: Role, engine: string, title: string, copy?: string, isUncopied = false): string =>
  `${SCRIPTS[lang].fleetTook(engine, title, CAST[lang].names[id], CAST[lang].roles[role], copy)}${isUncopied ? SCRIPTS[lang].uncopied : ''}`

// Each character by the names it goes by in the three languages.
const ALIASES: readonly (readonly [string, MemberId])[] = [
  ['치이카와|CHIIKAWA|ちいかわ', 'chiikawa'],
  ['우사기|토끼|USAGI|うさぎ|ウサギ', 'usagi'],
  ['랏코|해달|RAKKO|ラッコ', 'rakko'],
  ['시사|SHISA|シーサー', 'shisa'],
  ['쿠리만쥬|밤만쥬|KURIMANJU|くりまんじゅう|栗まんじゅう|くりまん', 'kurimanju'],
  ['카니|헌책방|KANI|FURUHONYA|古本屋|カニ|かに', 'kani'],
  ['포[셰쉐]트(?:\\s*갑옷\\s*씨)?|POCHETTE(?:\\s*NO[\\s-]*YOROI-?SAN)?|ポシェット(?:の鎧さん)?', 'pochette'],
  ['모몽가|하늘다람쥐|MOMONGA|モモンガ', 'momonga'],
]

const NAMES: readonly (readonly [RegExp, MemberId])[] = ALIASES.map(([names, id]) => [new RegExp(`^\\s*(?:${names})\\s*[:：,)\\]-]`, 'i'), id])

const WHOLE: readonly (readonly [RegExp, MemberId])[] = ALIASES.map(([names, id]) => [new RegExp(`^\\s*(?:${names})\\s*$`, 'i'), id])

/** The character a word names, by its name or one it also goes by. */
export const memberNamed = (word: string): MemberId | undefined =>
  /^\s*(?:하치와레|HACHIWARE|ハチワレ)\s*$/i.test(word) ? LEAD : WHOLE.find(([pattern]) => pattern.test(word))?.[1]

/** What goes beside a prompt the person addressed to one character from the band. */
export const pickNote = (lang: Lang, id: MemberId): string => (id === LEAD ? SCRIPTS[lang].pickLead : SCRIPTS[lang].pickFriend(CAST[lang].names[id]))

/**
 * What goes beside a prompt once the person changed the roles: who takes
 * which work now, every character by name, so that nothing rests on a list
 * told earlier. A kind of work that has its own character still goes to
 * that one first, and the line says so.
 */
export const roleNote = (lang: Lang, roles: Roles): string => {
  const script = SCRIPTS[lang]
  const named = (ids: readonly MemberId[]): string | undefined =>
    ids.length === 0 ? undefined : script.list(ids.map(id => script.roleOne(CAST[lang].names[id], CAST[lang].roles[roleOf(id, roles)], jobOf(lang, id, roles))))

  return script.roleNote(named(WORKERS.filter(id => roles[id] !== undefined)), named(WORKERS.filter(id => roles[id] === undefined)), CAST[lang].specialties)
}

const ROLE_WORDS: readonly (readonly [RegExp, WorkRole])[] = [
  [/^(?:구현|토벌|build|hunt|実装|討伐)$/i, '구현'],
  [/^(?:검토|검정|review|exam|レビュー|検定)$/i, '검토'],
  [/^(?:조사|채집|research|forage|調査|採取)$/i, '조사'],
  [/^(?:탐색|찾기|explore|scout|探索)$/i, '탐색'],
]

/** The role a word names, by its name or the comic's word for it, in any of the languages. */
export const roleNamed = (word: string): WorkRole | undefined => ROLE_WORDS.find(([pattern]) => pattern.test(word.trim()))?.[1]

/** The character a description names at its start (`랏코: ...`), and the rest. */
export const namedMember = (description: string): { member?: MemberId; rest: string } => {
  for (const [pattern, member] of NAMES) {
    if (pattern.test(description)) {
      return { member, rest: description.replace(pattern, '').trim() }
    }
  }

  return { rest: description.trim() }
}

/** A name as a pattern reads it, letter for letter. */
const literal = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Every name a character opens a report with, in whichever language its block was written. */
const namesOf = (id: MemberId): string[] => LANGS.map(lang => literal(CAST[lang].names[id]))

// A mark may come first: an emoji, with the selector some carry after it.
const MARKED = String.raw`^(?:\p{Extended_Pictographic}\u{FE0F}?\s*)?`
const OPENING = new RegExp(`${MARKED}(?:${ORDER.flatMap(namesOf).join('|')}|포셰트 갑옷 씨)\\s*[:：]\\s*`, 'u')

/** A sound as its letters alone, a drawn-out one as short as it goes: `와아아~!` is `와아`, and `Waa~` is `wa`. */
const lettersOf = (sound: string): string =>
  sound
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/(.)\1+/gu, '$1')

/** How each character that cannot talk opens a report, and the sounds and gestures it is known to make. */
const SOUNDS: readonly (readonly [RegExp, ReadonlySet<string>])[] = MUTE.map(id => [
  new RegExp(`${MARKED}(?:${namesOf(id).join('|')})\\s*[:：]`, 'u'),
  new Set(
    LANGS.flatMap(lang => soundsOf(lang, id))
      .map(lettersOf)
      .filter(letters => letters !== ''),
  ),
])

/**
 * The first lines of a report that say something, without their markup and
 * the name the report opens with. A character that cannot talk opens with a
 * sound alone, so there the lines start after it: after one of its own
 * sounds, drawn out or not, or one of its own gestures. Any other first line
 * is part of the report however short and though it stands in parentheses,
 * as is all a character that talks says.
 */
export const firstLines = (text: string, count: number): string[] => {
  const said = text
    .split('\n')
    .map(one => one.replace(/^[\s#>*\-`]+/, '').trim())
    .filter(one => one !== '' && !/^[-=_*`]+$/.test(one))
  const [first = '', ...more] = said
  const rest = first.replace(OPENING, '')
  const sounds = SOUNDS.find(([opening]) => opening.test(first))?.[1]
  const isSound = sounds !== undefined && more.length > 0 && sounds.has(lettersOf(rest))

  return (isSound ? more : [rest, ...more])
    .map(one => one.replace(/[*`]/g, '').slice(0, 160))
    .filter(one => one !== '')
    .slice(0, count)
}

/** The first line of a report that says something. */
export const firstLine = (text: string): string => firstLines(text, 1)[0] ?? ''
