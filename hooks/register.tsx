import { atom, read, update } from 'claude-code'
import type { AgentInfo, Elements, EngineInterface, Register, Timer } from 'claude-code'

import type { Aid, Aids, Lang, MemberId, Phrase, Role, Roles, Said, Task, Tokens, Usage, WorkRole } from '../types'

import type { Situation } from './cast'
import { CAST, isActive, jobOf, LEAD, MEMBERS, MOODS, pickMember, PROFILES, readingOf, reported, roleOf, roleOfAgent, rolesFrom, say, shown, specialistOf, titleOf, toneOf, withRole, WORK_ROLES, WORKERS } from './cast'
import type { FleetRun } from './orca'
import { findFleetRuns, readMeta, squeezed, voicedSpecPath } from './orca'
import { clearLook, keepLook, keepSeason, lookKept, SCENES, sceneAsked, seasonKept, seasonNow, setLook, unpainted } from './look'
import type { LookKept, SeasonKept } from './look'
import { artSource, drawDeskBand, drawDeskPane, drawDeskTurn } from './desk'
import { bandPictureOf, loadPictures, type PicturesRead, stampOf, usePictures } from './pictures'
import type { Kit, Scene } from './view'
import { AID_MS, drawBand, drawPane, lastSaid, plus, rosterLines, talkLines, usageLines, ZERO } from './view'
import { castIn, firstLines, fleetNote, isMarked, leaderSection, memberBlock, memberNamed, namedMember, openerOf, orcaBlock, pickNote, roleNamed, roleNote, standDown, tookNote, unvoiced } from './voice'
import type { LangFrom, Words } from './words'
import { asIs, inAll, isSaid, LANG_NAMES, langKeptFrom, langNamed, LANGS, configLang, localeLang, typedLang, WORDS } from './words'

const PANE = 'chiikawa'
const TICK_MS = 2000
/** How long a frame of the drawings stands while a character is at work. */
const FRAME_MS = 500
const FRAMES = 600
/** Lines of a report kept for the one who asks to see the task. */
const SUMMARY_LINES = 6
/** How long one of the three waits before it says again that it is lending a hand. */
const AID_SAY_MS = 20_000
/** The main loop's own tools that look for something: 우사기 lends a hand. */
const SEEK = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebSearch', 'WebFetch'])
/** The ones that change a file: 치이카와 does. */
const MEND = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SLOW_MS = 180_000
const LINGER_MS = 45_000
/** Finished tasks kept; one still at work is never let go. */
const KEPT = 40
const FEED_KEPT = 120
const PANE_SIZE = { rows: 40, columns: 72 } as const
const LOST_MS = 3_600_000
/** Ends kept for one agent whose task has yet to be told its id, and agents they are kept for: past these the oldest goes. */
const EARLY_KEPT = 16
/** Agents whose records were let go on a guess of how they ended, and are still listened for. */
const OWED_KEPT = 40
/** Beats in a row the engine's list must be without an agent before it is taken to have ended. */
const UNLISTED_BEATS = 3
/** Copies of one spec a character may have beside it before a launch goes without one. */
const COPIES = 9
const TYPED = new Set(['composer', 'bridge', 'sdk'])

const isOn = atom({ plugin: 'chiikawa', key: 'isOn' } as const, true)
const tasks = atom({ plugin: 'chiikawa', key: 'tasks' } as const, [])
const clockNow = atom({ plugin: 'chiikawa', key: 'now' } as const, 0)
const waveAt = atom({ plugin: 'chiikawa', key: 'waveAt' } as const, 0)
/** When the demonstration's wave began: real work and a demonstration are each counted from their own start. */
const demoWaveAt = atom({ plugin: 'chiikawa', key: 'demoWaveAt' } as const, 0)
const isPaneOpen = atom({ plugin: 'chiikawa', key: 'isPaneOpen' } as const, false)
const usage = atom({ plugin: 'chiikawa', key: 'usage' } as const, null)
const leaderTokens = atom({ plugin: 'chiikawa', key: 'leaderTokens' } as const, { fresh: 0, cached: 0, out: 0 })
const brief = atom({ plugin: 'chiikawa', key: 'brief' } as const, { isAlive: false, isStale: false, doubts: 0 })
const isPaneDismissed = atom({ plugin: 'chiikawa', key: 'isPaneDismissed' } as const, false)
const feed = atom({ plugin: 'chiikawa', key: 'feed' } as const, [])
const picked = atom({ plugin: 'chiikawa', key: 'picked' } as const, null)
/** Whether the band lists the friends to send the next prompt to. */
const isPicking = atom({ plugin: 'chiikawa', key: 'isPicking' } as const, false)
const isDemoHeld = atom({ plugin: 'chiikawa', key: 'isDemoHeld' } as const, false)

/** A demonstration's task: the mode makes these itself, named by this id. */
const isDemoTask = (task: Pick<Task, 'id'>): boolean => task.id.startsWith('orca:demo:')
const watched = atom({ plugin: 'chiikawa', key: 'watched' } as const, null)
const isLight = atom({ plugin: 'chiikawa', key: 'isLight' } as const, false)
const frame = atom({ plugin: 'chiikawa', key: 'frame' } as const, 0)
const pictures = atom({ plugin: 'chiikawa', key: 'pictures' } as const, {})
const picturesAt = atom({ plugin: 'chiikawa', key: 'picturesAt' } as const, '')
const aids = atom({ plugin: 'chiikawa', key: 'aids' } as const, {})
const isUsageOpen = atom({ plugin: 'chiikawa', key: 'isUsageOpen' } as const, true)
const talkBack = atom({ plugin: 'chiikawa', key: 'talkBack' } as const, 0)
const isTalkOnly = atom({ plugin: 'chiikawa', key: 'isTalkOnly' } as const, false)
const roles = atom({ plugin: 'chiikawa', key: 'roles' } as const, {})
const roleVersion = atom({ plugin: 'chiikawa', key: 'roleVersion' } as const, 0)
const toldRoleVersion = atom({ plugin: 'chiikawa', key: 'toldRoleVersion' } as const, 0)
const paid = atom({ plugin: 'chiikawa', key: 'paid' } as const, {})
const owed = atom({ plugin: 'chiikawa', key: 'owed' } as const, [])
const today = atom({ plugin: 'chiikawa', key: 'today' } as const, { day: '', done: [], failed: [] })
/** How many of a day's ends are told apart: enough for any day's work. */
const TODAY_KEPT = 2000

/** The day a moment falls on, where the person is. */
const dayOf = (at: number): string => {
  const date = new Date(at)

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

/** How many times all was cleared: an end begun to be settled before the last time is not counted. */
let clears = 0

/** Where a day stands among others, for days written as `dayOf` writes them; none is before any. */
const dayRank = (day: string): number => {
  const [year = 0, month = 0, date = 0] = day.split('-').map(Number)

  return year * 10_000 + month * 100 + date
}

/**
 * Counts a task's end in the day's work, once, as it went last: a guess overruled moves it. A demonstration is no work done. An end
 * that is sure is not moved by a guess, even one that, held long, is counted after it.
 */
const countEnd = async ($: Engine, id: string, isFailed: boolean, now: number, isSure: boolean, made: number): Promise<unknown> => {
  const day = dayOf(now)
  // A day first counted here starts from the tasks kept that ended on it, as a session under way before the count was kept still has them.
  const ended = (await read($, tasks)).filter(task => !isActive(task) && !isDemoTask(task) && task.endedAt !== undefined && dayOf(task.endedAt) === day)

  return update($, today, was => {
    // An end counted late, after a later day's were, leaves that day's count as it is; so does one begun before all was cleared.
    if (made !== clears || dayRank(day) < dayRank(was.day)) return was
    const base =
      was.day === day
        ? was
        : {
            day,
            done: ended.filter(task => task.status !== 'failed').map(task => task.id),
            failed: ended.filter(task => task.status === 'failed').map(task => task.id),
            sure: ended.filter(task => task.isGuessed !== true).map(task => task.id),
          }
    const sure = base.sure ?? []

    if (!isSure && sure.includes(id)) return base
    const done = base.done.filter(one => one !== id)
    const failed = base.failed.filter(one => one !== id)
    const kept = isSure ? [...sure.filter(one => one !== id), id].slice(-TODAY_KEPT) : sure

    return isFailed ? { day, done, failed: [...failed, id].slice(-TODAY_KEPT), sure: kept } : { day, done: [...done, id].slice(-TODAY_KEPT), failed, sure: kept }
  })
}
const lang = atom({ plugin: 'chiikawa', key: 'lang' } as const, 'en')
const langKept = atom({ plugin: 'chiikawa', key: 'langKept' } as const, {})
const isLoaded = atom({ plugin: 'chiikawa', key: 'isLoaded' } as const, false)
const isRolesRead = atom({ plugin: 'chiikawa', key: 'isRolesRead' } as const, false)
const isLangRead = atom({ plugin: 'chiikawa', key: 'isLangRead' } as const, false)
const isLangUnkept = atom({ plugin: 'chiikawa', key: 'isLangUnkept' } as const, false)
/** Where the roles the person gave are kept from one session to the next. */
const ROLES_KEPT = 'roles'
/** Where the language the person chose, and the one they type in, are kept from one session to the next. */
const LANG_KEPT = 'lang'

type Engine = EngineInterface
type Draft = Pick<Task, 'id' | 'kind' | 'role' | 'engine' | 'title'> & Pick<Task, 'titles' | 'out' | 'call' | 'due' | 'staleAt' | 'owner' | 'isTied'>
/** A line of the conversation before it has its moment: who, on what occasion, and in each language the words and what they are about. */
type Line = readonly [member: MemberId, situation: Situation, quote: Phrase, note: Phrase]
/** How a task ended. */
type Outcome = {
  isOk: boolean
  /** Why it ended so, as a language says it. */
  why?: (words: Words) => string
  tokens?: Tokens
  /** What the mode itself has it hand back, where no worker wrote anything: a demonstration's. */
  report?: Phrase
  /** The first lines of what it handed back: the first is its report. */
  summary?: string[]
  /** The friend who cannot talk whose name opens what it handed back, where that is one line and no more. */
  opener?: MemberId
  /** Read off the engine's list, not told by the task's own turn. */
  isGuessed?: boolean
}

/** The language the mode's own setting fixes; `auto` leaves it to the person and their machine. */
let langWanted: Lang | 'auto' = 'auto'

/** The language the screen and the voices are in just now. */
const langOf = async ($: Engine): Promise<Lang> => (langWanted === 'auto' ? read($, lang) : langWanted)

/**
 * Words the session holds, in each language. A session under way when the
 * mode was loaded again may still hold them as the one text they were said
 * in: that text then stands in every language.
 */
const phraseOf = (held: Phrase | string): Phrase => (typeof held === 'string' ? asIs(held) : held)

/** The conversation so far, each line with its words in each language. */
const talkOf = async ($: Engine): Promise<Said[]> => (await read($, feed)).map(said => ({ ...said, quote: phraseOf(said.quote), note: phraseOf(said.note) }))

/** The tasks, each with its words in each language. */
const tasksOf = async ($: Engine): Promise<Task[]> =>
  (await read($, tasks)).map(task => ({ ...task, quote: phraseOf(task.quote), note: phraseOf(task.note), ...(task.report === undefined ? {} : { report: phraseOf(task.report) }) }))

/** The hands lent, each with its words in each language. */
const aidsOf = async ($: Engine): Promise<Aids> =>
  Object.fromEntries(Object.entries(await read($, aids)).map(([id, aid]) => [id, { ...aid, what: phraseOf(aid.what), ...(aid.brief === undefined ? {} : { brief: phraseOf(aid.brief) }) }]))

/** The stamp of the pictures this copy of the module holds for its drawings; none until a drawing has read them. */
let picturesSeen: string | undefined

/**
 * Has the module hold the person's pictures for the drawing about to be made.
 * The table is megabytes of data URIs, so a drawing reads its short stamp (and
 * is drawn again when that changes) and the table only when the stamp is not
 * the one this copy of the module last read it at.
 */
const seePictures = async ($: Engine): Promise<void> => {
  const stamp = await read($, picturesAt)

  if (stamp === picturesSeen) return
  usePictures(await read($, pictures))
  picturesSeen = stamp
}

/**
 * Whether a command writes a file, by its path or its own name, outside the one place given: a redirection to it, or a
 * program that writes or replaces files with it among its words. Reading it, or a variable set to it, is no write.
 */
const isWrittenElsewhere = (command: string, [start, end]: readonly [number, number], path: string): boolean => {
  const name = (path.split('/').pop() ?? path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rest = `${command.slice(0, start)} ${command.slice(end)}`
  const ends = `(?=$|[\\s'";&|)<>])`

  if (name === '') return false

  return (
    new RegExp(`>[>|]?\\s*['"]?(?:[^\\s'";&|<>]*/)?${name}${ends}`).test(rest) ||
    new RegExp(`(?:^|[\\s;&|(])(?:tee|cp|mv|install|ln|rsync|touch|truncate|dd|curl|wget|sed\\s+-i)\\b[^;&|\\n]*?(?:[\\s'"/=])${name}${ends}`).test(rest)
  )
}

/** Reads the person's picture folder and keeps what it holds in the session's state, which redraws every drawing that shows them. */
const keepPictures = async ($: Engine): Promise<PicturesRead> => {
  // The reading fills the module's own place: a drawing made meanwhile, or after, reads the table again.
  picturesSeen = undefined
  const found = await loadPictures($).catch((): PicturesRead => ({ folder: '', found: [], files: 0, small: 0, skipped: [], table: {} }))
  const stamp = stampOf(found.table)

  picturesSeen = undefined
  // The same pictures as before are not written again: nothing is drawn again for them.
  if (stamp !== (await read($, picturesAt).catch(() => undefined))) {
    // The stamp moves only once the table is written: a write that failed is tried again on the next reading of the same pictures.
    const isWritten = await update($, pictures, () => found.table).then(
      () => true,
      () => false,
    )

    if (isWritten) await update($, picturesAt, () => stamp).catch(() => undefined)
  }

  return found
}

/** What the drawings are made of. Every read of one dispatch is of one moment, so they are asked for together and not one after another. */
const sceneOf = async ($: Engine): Promise<Scene> => {
  const [spoke, list, now, wave, figures, lead, said, chosen, seen, lent, isOpen, back, isAlone, given, costs, day] = await Promise.all([
    langOf($),
    tasksOf($),
    read($, clockNow),
    read($, waveAt),
    read($, usage),
    read($, leaderTokens),
    talkOf($),
    read($, picked),
    read($, watched),
    aidsOf($),
    read($, isUsageOpen),
    read($, talkBack),
    read($, isTalkOnly),
    read($, roles),
    read($, paid),
    read($, today),
  ])
  const isToday = day.day === dayOf(now)

  return {
    lang: spoke,
    tasks: list,
    now,
    waveAt: wave,
    usage: figures,
    leaderTokens: lead,
    feed: said,
    picked: chosen,
    watched: seen,
    aids: lent,
    isUsageOpen: isOpen,
    talkBack: back,
    isTalkOnly: isAlone,
    roles: given,
    paid: costs,
    ...(isToday && day.done.length + day.failed.length > 0 ? { today: { done: day.done.length, failed: day.failed.length } } : {}),
  }
}

/** The surface's elements with how the drawings look just now: the theme's tones, the frame of what moves. */
const kitOf = async ($: Engine, { Box, Text, Raster, Button }: Elements['terminal']): Promise<Kit> => ({
  Box,
  Text,
  Raster,
  Button,
  isLight: await read($, isLight),
  frame: await read($, frame),
})

/** Which tones the mode's own setting asks for; `auto` follows the person's theme. */
let themeWanted = 'auto'

type Settings = Awaited<ReturnType<Engine['config']['list']>>

/**
 * The language and what settled it, the first of these that holds: the
 * mode's own setting, the one the person chose, the one their prompts are
 * typed in, Claude Code's own language where that is one of the three, the
 * locale of the environment, and English. `settings` is what `/config`
 * holds, where it was already read.
 */
const settledLang = async ($: Engine, settings?: Settings): Promise<{ lang: Lang; from: LangFrom }> => {
  if (langWanted !== 'auto') return { lang: langWanted, from: 'setting' }
  const kept = await read($, langKept)

  if (kept.chosen !== undefined) return { lang: kept.chosen, from: 'chosen' }
  if (kept.typed !== undefined) return { lang: kept.typed, from: 'typed' }
  const set = (settings ?? (await $.config.list().catch(() => []))).find(row => row.key === 'language')?.value
  const configured = typeof set === 'string' ? configLang(set) : undefined

  if (configured !== undefined) return { lang: configured, from: 'config' }
  // The first of the three that is set is the one a program goes by.
  const locale = [await $.env.get('LC_ALL').catch(() => undefined), await $.env.get('LC_MESSAGES').catch(() => undefined), await $.env.get('LANG').catch(() => undefined)].find(
    value => value !== undefined && value !== '',
  )
  const named = locale === undefined ? undefined : localeLang(locale)

  if (named !== undefined) return { lang: named, from: 'env' }

  return { lang: 'en', from: locale !== undefined && /^en(?![a-z])/i.test(locale) ? 'env' : 'default' }
}

/**
 * Follows the person's settings as they are now: whether the theme is a
 * light one (the mode's own setting, else the theme `/config` holds), and
 * the language. A language other than the one in use turns the screen to it,
 * and what the main loop was told of how to talk is out of date from then on:
 * it is told again beside the next prompt while it conducts, and told to stop
 * where it no longer does. Answers whether the language changed.
 */
/** How many times the settings were begun to be followed: only the last one begun writes what it read. */
let looks = 0

const refreshLook = async ($: Engine, isMine: () => boolean = () => true): Promise<boolean> => {
  looks += 1
  const made = looks
  // Read late, after a newer read began or the load that asked was given up on, what it found is out of date: it writes nothing.
  const isCurrent = (): boolean => made === looks && isMine()
  const settings = themeWanted !== 'auto' && langWanted !== 'auto' ? [] : await $.config.list().catch(() => [])
  const theme = themeWanted !== 'auto' ? themeWanted : settings.find(row => row.key === 'theme')?.value
  const isNowLight = typeof theme === 'string' && /light/i.test(theme)

  if (!isCurrent()) return false
  if (isNowLight !== (await read($, isLight))) await update($, isLight, was => (isCurrent() ? isNowLight : was))
  const { lang: next } = await settledLang($, settings)

  if (!isCurrent() || next === (await read($, lang))) return false
  const box = { isChanged: false }

  await update($, lang, was => {
    if (!isCurrent()) return was
    box.isChanged = was !== next

    return next
  })
  if (!box.isChanged) return false
  await update($, brief, told => ({ ...told, isStale: true, doubts: told.doubts + 1 }))
  $.ui.invalidate('prompt.section')

  return true
}

/** Names the mode's command, and says what it takes, in the language in use. */
const enlist = async ($: Engine): Promise<void> => {
  const words = WORDS[await langOf($)]

  await $.command.register({ name: 'chiikawa', description: words.description, argumentHint: words.argumentHint, immediate: true })
}

/** Follows the person's settings, and where the language changed, has the command say what it takes in the new one. */
const follow = async ($: Engine): Promise<void> => {
  if (await refreshLook($)) await enlist($).catch(() => undefined)
}

/** Moves the clock the drawings read on to a moment; it does not run back. */
const stamp = async ($: Engine, moment?: number): Promise<void> => {
  const now = moment ?? (await $.clock.now())

  await update($, clockNow, at => Math.max(at, now))
}

/** Whether there is something to show unasked: work in hand, or a line just said. */
const isLive = (scene: Scene): boolean => {
  const at = lastSaid(scene)?.at ?? 0

  return scene.tasks.some(isActive) || (at > 0 && scene.now - at < LINGER_MS)
}

/** How long a piece of work may fairly take: one held past it by a call that never answers stops nothing after it. */
const STUCK_MS = 60_000

/** Resolves once `held` has been waited for as long as any work fairly takes, unless it ends first; never where no timer can be set. */
const giveUp = ($: Engine, held: Promise<unknown>): Promise<void> =>
  new Promise<void>(resolve => {
    try {
      const timer = $.clock.after(STUCK_MS, () => resolve())

      void held.then(
        () => timer.cancel(),
        () => timer.cancel(),
      )
    } catch {
      // No timer: the line waits as it always did.
    }
  })

/** Where each line stands: one thing at a time in each. */
const lines: Record<'turn' | 'copy' | 'save', { done: Promise<unknown>; started: Promise<void> }> = {
  turn: { done: Promise.resolve(), started: Promise.resolve() },
  copy: { done: Promise.resolve(), started: Promise.resolve() },
  save: { done: Promise.resolve(), started: Promise.resolve() },
}

/**
 * A line that work stands in: each piece starts once the one before it has
 * ended, however that went, or, in `turn` alone, has been stuck too long. In `turn`, taking a
 * task or ending one reads the list, writes it and speaks, and two doing so at
 * once would talk over each other; in `copy`, a spec's copies are made one at a
 * time, so that two launches do not take one place for two texts; in `save`, the
 * roles and the languages are saved one at a time, so that the last save is of
 * the last change.
 */
const inLine = <T,>($: Engine, line: 'turn' | 'copy' | 'save', work: () => Promise<T>): Promise<T> => {
  const before = lines[line]
  // Only the turns are passed by when stuck, counted from when the one before began: those behind it still go one at a time. A save or a
  // copy that ended late after one behind it would write over it.
  const gate = line === 'turn' ? Promise.race([before.done, before.started.then(() => giveUp($, before.done))]) : before.done
  const box: { begin?: () => void } = {}
  const started = new Promise<void>(resolve => {
    box.begin = resolve
  })
  const go = (): Promise<T> => {
    box.begin?.()

    return work()
  }
  const mine = gate.then(go, go)

  lines[line] = { done: mine.catch(() => undefined), started }

  return mine
}

/**
 * The characters say their lines, one after another: the conversation keeps
 * them, newest last, each a moment after the one before it whatever the clock
 * says, so that it reads in the order it was said. Answers the last moment.
 */
const tell = async ($: Engine, now: number, lines: readonly Line[]): Promise<number> => {
  let last = now

  await update($, feed, list => {
    const first = Math.max(now, (list[list.length - 1]?.at ?? -1) + 1)
    const said: Said[] = lines.map(([member, situation, quote, note], index) => ({ member, quote, note, at: first + index, mood: MOODS[situation] }))

    last = first + Math.max(0, lines.length - 1)

    return [...list, ...said].slice(-FEED_KEPT)
  })
  // A page turned back stays on the lines it was showing. Showing the last ones, nothing is written: a write draws the pane again, changed or not.
  if ((await read($, talkBack)) > 0) await update($, talkBack, back => (back > 0 ? Math.min(FEED_KEPT - 1, back + lines.length) : back))

  return last
}

/** One of a character's own lines for the occasion, in each language: one turn is the same place of the same occasion in each. */
const lineOf = (member: MemberId, situation: Situation, turn: number): Phrase => inAll(lang => say(lang, member, situation, turn))

/** How 하치와레 reads what a friend just did, in each language; nothing where he has nothing to read. */
const readOf = (member: MemberId, situation: 'start' | 'done' | 'fail', role: Role): Phrase | undefined =>
  LANGS.some(lang => readingOf(lang, member, situation, role) === undefined) ? undefined : inAll(lang => readingOf(lang, member, situation, role) ?? '')

/** What a tool call is on, in a few words: the file's name, the command's start. */
const detailOf = (input: object): string => {
  const { file_path: file, path, command, pattern, query, url, description } = input as Record<string, unknown>
  const named = [file, path].find(one => typeof one === 'string' && one !== '')

  if (typeof named === 'string') return named.slice(named.lastIndexOf('/') + 1)
  const said = [command, pattern, query, url, description].find(one => typeof one === 'string' && one !== '')

  return typeof said === 'string' ? said.replace(/\s+/g, ' ').slice(0, 48) : ''
}

/** The list with its oldest finished tasks let go. */
const kept = (list: readonly Task[]): Task[] => {
  const ended = list.filter(task => !isActive(task))
  const old = new Set(ended.slice(0, Math.max(0, ended.length - KEPT)))

  return list.filter(task => !old.has(task))
}

/**
 * Notes the agents whose records are let go: one whose end is still a guess
 * may yet send word of how it really went, and one that ended may be sent on
 * again; what each turn costs is still its character's. Only so many are
 * listened for.
 */
const owe = async ($: Engine, gone: readonly Task[]): Promise<void> => {
  const late = gone.filter(task => task.kind === 'agent').map(task => ({ id: task.id, member: task.member }))

  if (late.length > 0) await update($, owed, list => [...list.filter(one => !late.some(now => now.id === one.id)), ...late].slice(-OWED_KEPT))
}

let isAutoOpening = true
/** Whether a character is at work, as the last beat or the last task taken has it: the drawings move while it holds. */
let isBusy = false

/**
 * Adds a task and hands it to a character. 노동 갑옷 씨 rings the bell for a
 * new wave, the character answers, and 하치와레 reads the answer aloud where
 * the character cannot talk. `hint` is whatever else tells the kind of work,
 * such as the model asked for. A worker told to write where another is still
 * waited for is taken without its result file.
 */
const reserve = ($: Engine, draft: Draft, wanted?: MemberId, hint = ''): Promise<Task> =>
  inLine($, 'turn', async () => {
    const given = await read($, roles)
    // Taken after the roles are read, so that a read held long, and passed by in the line, starts its task when it truly does.
    const now = await $.clock.now()
    const { out, staleAt: _staleAt, ...unread } = draft
    const box: { task: Task; at: number; isWaveStart: boolean; isAlone: boolean; busy: number; gone: Task[] } = {
      at: now,
      task: { ...draft, member: 'shisa', status: 'running', startedAt: now, toolCount: 0, quote: asIs(''), note: asIs(''), mood: 'calm' },
      isWaveStart: false,
      isAlone: false,
      busy: 0,
      gone: [],
    }

    await update($, tasks, list => {
      const member = wanted ?? pickMember(draft.role, list, specialistOf(`${draft.engine} ${hint}`, draft.title, draft.role), given)
      const turn = list.filter(task => task.member === member).length
      // A result file another worker is still waited for at tells of that one alone. Whose it is is settled in the one write that
      // takes the task, so that two launches taken at once do not both have it.
      const isShared = out !== undefined && list.some(task => task.id !== draft.id && task.kind === 'orca' && task.out === out && (isActive(task) || isDoubted(task, now)))

      // Real work and a demonstration each start a wave of their own, with none of their kind at work: neither is counted in the other's.
      box.isWaveStart = !list.some(task => isActive(task) && isDemoTask(task) === isDemoTask(draft))
      // Taken late, as by a read held long while others went by, it starts where it is put among them: after the wave it did not
      // belong to, or no earlier than the one it joins.
      const same = list.filter(task => task.id !== draft.id && isDemoTask(task) === isDemoTask(draft))
      box.at = box.isWaveStart ? Math.max(now, ...same.map(task => (task.endedAt ?? task.startedAt) + 1)) : Math.max(now, ...same.filter(isActive).map(task => task.startedAt))
      box.isAlone = !list.some(isActive)
      box.busy = new Set([...list.filter(isActive).map(task => task.member), member]).size
      box.task = {
        ...(isShared ? unread : draft),
        member,
        status: 'running',
        startedAt: box.at,
        toolCount: 0,
        quote: lineOf(member, 'start', turn),
        note: inAll(lang => WORDS[lang].started(CAST[lang].job[draft.role], titleOf(lang, draft))),
        mood: 'calm',
      }
      const next = kept([...list.filter(task => task.id !== draft.id), box.task])

      box.gone = list.filter(task => task.id !== draft.id && !next.includes(task))

      return next
    })
    await owe($, box.gone)

    const { task } = box
    const reading = readOf(task.member, 'start', task.role)

    isBusy = true
    const lines: Line[] = []

    if (box.isWaveStart) {
      // What the drawings show as the wave in hand starts with real work, or with a demonstration begun alone; a demonstration begun beside real work leaves it.
      // A wave starts no earlier than one begun after it: a task taken late does not take the newer wave back.
      if (isDemoTask(task)) await update($, demoWaveAt, at => Math.max(at, box.at))
      if (!isDemoTask(task) || box.isAlone) await update($, waveAt, at => Math.max(at, box.at))
      lines.push(['rodo', 'start', lineOf('rodo', 'start', 0), inAll(lang => WORDS[lang].bellNote)])
    }
    lines.push([task.member, 'start', task.quote, task.note])
    if (reading !== undefined) lines.push([LEAD, 'start', reading, inAll(lang => WORDS[lang].reading(CAST[lang].names[task.member]))])
    if (box.busy === 2) {
      const since = await read($, waveAt)

      // 노동 갑옷 씨 remarks on two friends at work at once, once a wave.
      if (!(await talkOf($)).some(said => said.at >= since && isSaid(one => one.paired, said.note))) lines.push(['rodo', 'done', lineOf('rodo', 'done', 0), inAll(lang => WORDS[lang].paired)])
    }
    await stamp($, await tell($, now, lines))
    if (box.isWaveStart && isAutoOpening && !(await read($, isPaneOpen)) && !(await read($, isPaneDismissed))) {
      // Unasked, so the surface seats it only where there is width to spare;
      // where it does not, the band above the prompt carries the conversation.
      void $.ui.open({ id: PANE, title: WORDS[await langOf($)].brand, closeOnEscape: true, ...PANE_SIZE }).then(
        opened => (opened.isPlaced ? update($, isPaneOpen, () => true) : undefined),
        () => undefined,
      )
    }

    return task
  })

/**
 * The main loop is at a piece of work itself, no friend called in: 하치와레
 * is seen doing it, and where the tool looks for something or changes a
 * file, 우사기 or 치이카와 is seen lending a hand, saying so now and then
 * for 하치와레 to read aloud. One with a task of its own is left to it.
 */
/** When a stretch of lent hands began: kept while the hands are lent again within AID_MS, else now. */
const sinceOf = (was: Aid | undefined, now: number): number => (was !== undefined && now - was.at < AID_MS ? (was.since ?? was.at) : now)

const lend = ($: Engine, tool: string, detail: string): Promise<void> =>
  inLine($, 'turn', async () => {
    const now = await $.clock.now()
    const wanted: MemberId | undefined = SEEK.has(tool) ? 'usagi' : MEND.has(tool) ? 'chiikawa' : undefined
    const helper = wanted !== undefined && !(await read($, tasks)).some(task => task.member === wanted && isActive(task)) ? wanted : undefined
    const target = detail === '' ? '' : ` · ${detail}`
    const verb = (lang: Lang): string => (helper === 'usagi' ? WORDS[lang].seeking : WORDS[lang].mending)
    const doing = inAll(lang => `${verb(lang)}${target}`)
    const box = { isDue: false }

    await update($, aids, was => {
      const next: Aids = {
        ...was,
        [LEAD]:
          helper === undefined
            ? { what: asIs(`${tool}${target}`), at: now, saidAt: now, since: sinceOf(was[LEAD], now) }
            : { what: inAll(lang => `${WORDS[lang].lending(CAST[lang].names[helper], verb(lang))}${target}`), brief: inAll(lang => WORDS[lang].withFriend(CAST[lang].names[helper])), at: now, saidAt: now, since: sinceOf(was[LEAD], now) },
      }

      if (helper !== undefined) {
        const last = was[helper]?.saidAt

        box.isDue = last === undefined || now - last >= AID_SAY_MS
        next[helper] = { what: doing, at: now, saidAt: box.isDue || last === undefined ? now : last, since: sinceOf(was[helper], now) }
      }

      return next
    })
    isBusy = true
    if (helper === undefined || !box.isDue) return stamp($, now)
    const lines: Line[] = [
      [helper, 'start', lineOf(helper, 'start', Math.floor(now / AID_SAY_MS)), doing],
      [LEAD, 'start', inAll(lang => CAST[lang].means(helper === 'usagi' ? CAST[lang].read.seeking : CAST[lang].read.mending)), inAll(lang => WORDS[lang].reading(CAST[lang].names[helper]))],
    ]

    await stamp($, await tell($, now, lines))
  })

const drop = ($: Engine, id: string): Promise<unknown> => update($, tasks, list => list.filter(task => task.id !== id))

/** What a task has cost with a new figure in: a subagent's turns add up, an Orca worker's file states its whole. */
const costOf = (task: Task, tokens: Tokens | undefined): Tokens | undefined =>
  tokens === undefined ? task.tokens : task.kind === 'orca' ? tokens : plus(task.tokens ?? ZERO, tokens)

/** What a new figure adds to what a task has cost: a subagent's turn its own, an Orca worker's whole less what was counted before. */
const gainOf = (task: Task, tokens: Tokens | undefined): Tokens | undefined => {
  const was = task.tokens

  if (tokens === undefined || was === undefined || task.kind !== 'orca') return tokens

  return plus(tokens, { fresh: -was.fresh, cached: -was.cached, out: -was.out, usd: was.usd === undefined ? undefined : -was.usd })
}

/**
 * What a task has handed back, with an end's word of it in: what the mode
 * itself has it hand back, else the first line the worker wrote, else what
 * it had. The worker's line stands as written in every language, but for the
 * one line a character wrote after its own name as all its report: a sound
 * or a gesture of its own there is as each language has it.
 */
const toldOf = (task: Task, { report, summary, opener }: Outcome): Phrase | undefined => {
  const [first] = summary ?? []

  if (report !== undefined || first === undefined) return report ?? task.report

  return opener === task.member ? reported(task.member, first) : asIs(first)
}

/** The task as it stands once ended that way: the character's line for it, how long it took, what it handed back. */
const endOf = (task: Task, outcome: Outcome, now: number): Task => {
  const { tool: _tool, detail: _detail, isGuessed: _isGuessed, ...rest } = task
  const { isOk, why, tokens, summary, isGuessed = false } = outcome
  const situation = isOk ? 'done' : 'fail'
  const endedAt = task.endedAt ?? now
  const cost = costOf(task, tokens)
  const told = toldOf(task, outcome)

  return {
    ...rest,
    status: isOk ? 'done' : 'failed',
    endedAt,
    // A check that passed is an O of the hand, whatever the turn.
    quote: lineOf(task.member, situation, task.role === '검토' ? 0 : task.toolCount + task.title.length),
    note: inAll(lang => [WORDS[lang].ended(CAST[lang].job[task.role], isOk), WORDS[lang].spoken(endedAt - task.startedAt), why?.(WORDS[lang]) ?? ''].filter(part => part !== '').join(' · ')),
    mood: MOODS[situation],
    ...(cost === undefined ? {} : { tokens: cost }),
    ...(told === undefined ? {} : { report: told }),
    ...(summary === undefined || summary.length === 0 ? {} : { summary }),
    ...(isGuessed ? { isGuessed } : {}),
  }
}

/**
 * Ends a task: the character says how it went, 하치와레 reads it, and sums up
 * a finished wave. Word of a task that has already ended adds what it cost
 * and what it handed back; where the end was a guess, it also says how the
 * task really went. What it cost goes on its character's account, which
 * outlasts the task. Turned off, the mode still keeps the end and the cost,
 * and says nothing of them: no line, and no toast.
 */
const settle = ($: Engine, id: string, outcome: Outcome): Promise<void> =>
  inLine($, 'turn', async () => {
    // Cleared while it is settled, it is counted in no day.
    const made = clears
    const now = await $.clock.now()
    const box: { ended?: Task; all: Task[]; gain?: readonly [MemberId, Tokens] } = { all: [] }

    await update($, tasks, list => {
      box.ended = undefined
      box.gain = undefined
      box.all = list.map(task => {
        if (task.id !== id) return task
        const gain = gainOf(task, outcome.tokens)
        const cost = costOf(task, outcome.tokens)
        const told = toldOf(task, outcome)
        const lines = outcome.summary === undefined || outcome.summary.length === 0 ? task.summary : outcome.summary
        // A task at work is ended, and one ended on a guess is ended again as it really went; any other only gains what it cost and handed back.
        const next =
          isActive(task) || (task.isGuessed === true && outcome.isGuessed !== true)
            ? endOf(task, outcome, now)
            : { ...task, ...(cost === undefined ? {} : { tokens: cost }), ...(told === undefined ? {} : { report: told }), ...(lines === undefined ? {} : { summary: lines }) }

        if (isActive(task) || next.status !== task.status) box.ended = next
        if (gain !== undefined) box.gain = [task.member, gain]

        return next
      })

      return box.all
    })
    if (box.gain !== undefined) {
      const [member, gain] = box.gain

      await update($, paid, was => ({ ...was, [member]: plus(was[member] ?? ZERO, gain) }))
    }

    const { ended } = box

    if (ended !== undefined && !isActive(ended) && !isDemoTask(ended)) await countEnd($, ended.id, ended.status === 'failed', now, ended.isGuessed !== true, made).catch(() => undefined)
    if (ended === undefined || !(await read($, isOn))) return
    // A toast is read once and gone: it is in the language of the moment.
    const spoke = await langOf($)
    const isOk = ended.status === 'done'
    const situation = isOk ? 'done' : 'fail'
    const reading = readOf(ended.member, situation, ended.role)
    const lines: Line[] = [[ended.member, situation, ended.quote, ended.note]]
    const toasts = [`${MEMBERS[ended.member].mark} ${CAST[spoke].names[ended.member]} ${shown(ended.quote[spoke])} ${ended.note[spoke]}`]

    if (reading !== undefined) lines.push([LEAD, situation, reading, inAll(lang => (isOk ? WORDS[lang].reading : WORDS[lang].mourning)(CAST[lang].names[ended.member]))])
    // A demonstration and real work are each a wave of their own: a pretend failure is not told as one of the real work.
    const isSame = (task: Task): boolean => isDemoTask(task) === isDemoTask(ended)

    // The list as it is now: work taken while this end was held up is not missed.
    const current = await read($, tasks)

    if (!current.some(task => isSame(task) && isActive(task))) {
      const since = isDemoTask(ended) ? await read($, demoWaveAt) : await read($, waveAt)
      const wave = current.filter(task => isSame(task) && task.startedAt >= since)
      const failed = wave.filter(task => task.status === 'failed').length
      const quote = inAll(lang => (failed > 0 ? CAST[lang].leader.cheer : wave.length >= 2 ? CAST[lang].leader.sweep : CAST[lang].leader.allDone))
      const note = inAll(lang => (failed > 0 ? WORDS[lang].waveFailed(wave.length, failed) : WORDS[lang].waveDone(wave.length)))

      lines.push([LEAD, failed > 0 ? 'fail' : 'done', quote, note])
      if (wave.length >= 2) toasts.push(`${MEMBERS[LEAD].mark} ${CAST[spoke].names[LEAD]} “${quote[spoke]}” ${note[spoke]}`)
    }
    await stamp($, await tell($, now, lines))
    for (const toast of toasts) $.ui.toast(toast)
  })

const isUnnamed = (task: Task): boolean => task.kind === 'agent' && task.id.startsWith('spawn:') && isActive(task)

/** What the spawn hook names a subagent's task: the engine's list has its row under it. */
const described = (spoke: Lang, task: Pick<Task, 'member' | 'title'>): string => `${MEMBERS[task.member].mark} ${CAST[spoke].names[task.member]} · ${task.title}`

/** Whether a row of the engine's list is under the name the spawn hook gave a task, in whichever language it was given. */
const isDescribed = (description: string, task: Pick<Task, 'member' | 'title'>): boolean => LANGS.some(one => description === described(one, task))

/** Whether a row of the engine's list may be a task's: under the task's own title, whole, or under the name the spawn hook gave it. A title that only ends as the task's does is another's. */
const isRowOf = (description: string, task: Pick<Task, 'member' | 'title'>): boolean => description === task.title || isDescribed(description, task)

/** The Agent calls whose spawn has yet to answer: the task of each is still to be told its id. */
const asking = new Set<string>()
/** Ends that came before their task had its id, oldest first, each with the turn it is of: they wait for the task the id is given to. */
const early = new Map<string, { turn: string; outcome: Outcome }[]>()
/** The turns already heard of each agent, the last few of the last agents: one told again is not paid again. */
const heard = new Map<string, string[]>()
/** The turns being taken now, each as its agent and turn. */
const hearing = new Map<string, number>()
/** The turns whose end has let their agent's tied commands go, each as its agent and turn, oldest first. */
const untied = new Set<string>()
/** The tied commands a turn's end was to let go and could not, by their task: they are tried again, and no other command is. */
const pendingEnd = new Set<string>()
const PENDING_KEPT = 200
/**
 * The tied commands each subagent has left running since its last answer, by their tasks: kept here as they are begun, so that its next
 * answer knows them without reading anything, and takes none begun after it.
 */
const tiedBy = new Map<string, Set<string>>()
/**
 * Every tied command this copy of the module has begun, by its task, the last of them: such a one is owed its end by what is kept
 * above, at the answer it is tied to, and is never looked up in the list of tasks, where it would be taken by an earlier answer.
 */
const begun = new Set<string>()
const BEGUN_KEPT = 2000

/** Notes a tied command as begun here, before its task is written: from then on no reading of the list takes it. */
const begin = (id: string): void => {
  begun.delete(id)
  begun.add(id)
  for (const old of [...begun].slice(0, Math.max(0, begun.size - BEGUN_KEPT))) begun.delete(old)
}

/** Notes a command tied to its owner's next answer. */
const tie = (owner: string, id: string): void => {
  const held = tiedBy.get(owner) ?? new Set<string>()

  begin(id)
  held.add(id)
  tiedBy.delete(owner)
  tiedBy.set(owner, held)
  for (const old of [...tiedBy.keys()].slice(0, Math.max(0, tiedBy.size - HEARD_AGENTS))) tiedBy.delete(old)
}

/** Owes an end to every command the subagent has tied to this answer; what it ties from here on is the next answer's. */
const untie = (owner: string): void => {
  for (const id of tiedBy.get(owner) ?? []) pendingEnd.add(id)
  tiedBy.delete(owner)
}
const HEARD_KEPT = 20
const HEARD_AGENTS = 100

/** Ends the task an id was just given to, where word of its turns' ends came before the id did: each in the order it came. */
const catchUp = async ($: Engine, agentId: string): Promise<void> => {
  const waiting = early.get(agentId)

  if (waiting === undefined || !(await read($, tasks)).some(task => task.id === agentId)) return
  early.delete(agentId)
  for (const { outcome } of waiting) await settle($, agentId, outcome)
}

/**
 * Gives a subagent's task that waits for its id the one its loop's events
 * carry: the task the agent's own row tells, by its type and title and,
 * where several share those, by the name the spawn hook gave it. A row under
 * another title is no waiting task's, however few wait. Tasks that still
 * cannot be told apart are not guessed between while a spawn's answer is to
 * come and tell them. One write decides it, so no task is given two ids and
 * no id two tasks.
 */
const claim = async ($: Engine, agentId: string, info: Pick<AgentInfo, 'type' | 'description'>): Promise<void> => {
  await update($, tasks, list => {
    if (list.some(task => task.id === agentId)) return list
    const fits = list.filter(task => isUnnamed(task) && info.type === task.engine && isRowOf(info.description, task))
    const named = fits.filter(task => isDescribed(info.description, task))
    const alike = named.length > 0 ? named : fits
    // Alike in every way, and their spawns answered no id, so none is coming: either may have the row.
    const match = alike.length === 1 || alike.every(task => !asking.has(task.call ?? '')) ? alike[0] : undefined

    return match === undefined ? list : list.map(task => (task === match ? { ...task, id: agentId } : task))
  })
  await catchUp($, agentId)
}

/** Gives the task an Agent call made the id its spawn answered; a task that took that id by mistake goes back to waiting. */
const bind = async ($: Engine, call: string, agentId: string): Promise<void> => {
  await update($, tasks, list =>
    list.map(task => {
      if (task.kind !== 'agent') return task
      if (task.call === call) return { ...task, id: agentId }

      return task.id === agentId ? { ...task, id: `spawn:${task.call ?? agentId}` } : task
    }),
  )
  await catchUp($, agentId)
}

/** Gives a subagent's task the id its loop's events carry, where the engine's list has the agent's row to tell it by. */
const adopt = async ($: Engine, agentId: string): Promise<void> => {
  const list = await read($, tasks)

  if (list.some(task => task.id === agentId) || !list.some(isUnnamed)) return
  const info = (await $.agent.list().catch(() => [])).find(agent => agent.id === agentId)

  if (info !== undefined) await claim($, agentId, info)
}

/**
 * Word that a subagent's turn ended. Where a task still waits for its id,
 * the word is kept for the task the id is given to, so that it ends no
 * other; the same turn told twice is kept once. Where the task's record was
 * let go on a guess of how it ended, what the turn cost is still its
 * character's. Answers whether the turn was told now, and not before.
 */
const finish = async ($: Engine, agentId: string, turn: string, outcome: Outcome): Promise<boolean> => {
  const key = `${agentId}\n${turn}`

  const now = await $.clock.now().catch(() => 0)
  const since = hearing.get(key)

  // The same turn told twice is paid once: told again while it is taken, or after, it is passed by. One whose taking failed, or has hung
  // past what any fairly takes, may be told again.
  if ((heard.get(agentId) ?? []).includes(turn) || (since !== undefined && now - since < STUCK_MS)) return false
  hearing.set(key, now)
  try {
    await finishTurn($, agentId, turn, outcome)
    const told = heard.get(agentId) ?? []

    heard.delete(agentId)
    heard.set(agentId, [...told, turn].slice(-HEARD_KEPT))
    for (const id of [...heard.keys()].slice(0, Math.max(0, heard.size - HEARD_AGENTS))) heard.delete(id)
  } finally {
    if (hearing.get(key) === now) hearing.delete(key)
  }

  return true
}

const finishTurn = async ($: Engine, agentId: string, turn: string, outcome: Outcome): Promise<void> => {
  const made = clears

  await adopt($, agentId)
  const list = await read($, tasks)

  if (list.some(task => task.id === agentId)) return settle($, agentId, outcome)
  const member = (await read($, owed)).find(one => one.id === agentId)?.member

  if (member !== undefined) {
    await update($, paid, was => ({ ...was, [member]: plus(was[member] ?? ZERO, outcome.tokens) }))
    // How it really went is counted in the day's work, over the guess the record was let go on.
    if (outcome.isGuessed !== true) await countEnd($, agentId, !outcome.isOk, await $.clock.now(), true, made).catch(() => undefined)

    return
  }
  const waiting = early.get(agentId) ?? []

  if (!list.some(isUnnamed) || waiting.some(one => one.turn === turn)) return
  // The agent last heard of is the last to go when there are too many.
  early.delete(agentId)
  early.set(agentId, [...waiting, { turn, outcome }].slice(-EARLY_KEPT))
  for (const id of [...early.keys()].slice(0, Math.max(0, early.size - EARLY_KEPT))) early.delete(id)
}

/** Notes the tool a character's loop is on; a finished one who works again is back at work. */
const touch = async ($: Engine, agentId: string, tool: string, detail: string): Promise<void> => {
  await adopt($, agentId)
  if (!(await read($, tasks)).some(task => task.id === agentId)) return
  await update($, tasks, list =>
    list.map(task => {
      if (task.id !== agentId) return task
      const { endedAt: _endedAt, isGuessed: _isGuessed, ...rest } = task

      return isActive(task)
        ? { ...task, tool, detail, toolCount: task.toolCount + 1 }
        : { ...rest, status: 'running' as const, tool, detail, toolCount: task.toolCount + 1 }
    }),
  )
}

/** Why a subagent's turn ended short of an answer, as a language says it. */
const ENDS: Readonly<Record<string, (words: Words) => string>> = { aborted: words => words.stopped, error: words => words.apiError, refusal: words => words.refused }

const tokensOf = (spent: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }): Tokens => ({
  fresh: spent.input_tokens + spent.cache_creation_input_tokens,
  cached: spent.cache_read_input_tokens,
  out: spent.output_tokens,
})

/** Reads the session's own figures; writes them only when one moved. */
const refreshUsage = async ($: Engine): Promise<void> => {
  const figures = await $.session.usage()
  const next: Usage = {
    contextWindow: figures.context.window,
    limits: figures.rateLimits.map(limit => {
      const resetsAt = limit.resetsAt === undefined ? Number.NaN : Date.parse(limit.resetsAt)

      return { kind: limit.kind, percentUsed: limit.percentUsed, ...(Number.isNaN(resetsAt) ? {} : { resetsAt }) }
    }),
    ...(figures.context.percent === undefined ? {} : { contextPercent: figures.context.percent }),
    ...(figures.context.tokens === undefined ? {} : { contextTokens: figures.context.tokens }),
    ...(figures.cost === undefined ? {} : { usd: figures.cost.usd }),
  }

  if (JSON.stringify(next) !== JSON.stringify(await read($, usage))) await update($, usage, () => next)
}

/** When a file was last written; nothing where there is none to be found. */
const writtenAt = ($: Engine, path: string): Promise<number | undefined> =>
  $.fs.stat(path).then(
    stat => stat.mtimeMs,
    () => undefined,
  )

/**
 * Ends an Orca worker whose `<out>.meta.json` has landed since it started; one that was there before it started is an earlier run's.
 * Answers how the looking went: `ended` where it was read, `none` where there is no result of this run, and `unread` where one is
 * there, or may be, and could not be read: a file that cannot be looked at, or one not yet whole.
 */
const pollWorker = async ($: Engine, task: Task): Promise<'ended' | 'none' | 'unread'> => {
  if (task.out === undefined) return 'none'
  const path = `${task.out}.meta.json`
  const at = await writtenAt($, path)

  // No time read for it: there is none, or the looking failed.
  if (at === undefined) return (await $.fs.exists(path).catch(() => true)) ? 'unread' : 'none'
  if (at < task.startedAt - 1000 || at === task.staleAt) return 'none'
  const text = await $.fs.read(path).catch(() => '')
  // How it went and what it cost are the same in any language; how long it took and how it exited are said again as each says them.
  const meta = readMeta(text, WORDS.en)

  if (meta === undefined) return 'unread'
  const handed = await $.fs.read(task.out).catch(() => '')

  await settle($, task.id, { isOk: meta.isOk, why: words => readMeta(text, words)?.note ?? '', tokens: meta.tokens, summary: firstLines(handed, SUMMARY_LINES), opener: openerOf(handed) })

  return 'ended'
}

/**
 * Writes a character's copy of a spec, whose text was read, beside it and
 * answers where. A file found at the copy's place is not written over: one
 * that holds this very text is used as it is, and past any other the copy
 * takes the next numbered place with nothing at it. The engine has no write
 * that fails where a file is: the place is looked at right before the write
 * and read again after it, and a copy that does not read back as it was
 * written is not used. Nothing then, as where every place is taken: the
 * launch runs on the spec as it was written, without the voice.
 */
const voiceSpec = ($: Engine, spec: string, text: string, task: Task): Promise<string | undefined> =>
  inLine($, 'copy', async () => {
    const copy = text + orcaBlock(await langOf($), task.member, task.role)

    for (let turn = 1; turn <= COPIES; turn += 1) {
      const path = voicedSpecPath(spec, turn === 1 ? task.member : `${task.member}-${turn}`)
      // A link that leads nowhere is something there too: only a place where nothing can be found is written to.
      if ((await writtenAt($, path)) === undefined) {
        const landed = await $.fs
          .write(path, copy)
          .then(() => $.fs.read(path))
          .catch(() => undefined)

        return landed === copy ? path : undefined
      }
      if ((await $.fs.read(path).catch(() => undefined)) === copy) return path
    }

    return undefined
  })

/**
 * Takes a task whose end was never learned off the page, said aloud by
 * 노동 갑옷 씨 so it does not go quietly: it is not told as done or failed.
 * One that has ended in the meantime stays. `why` is the line for it: a
 * worker with no result, or a subagent never told apart from the others.
 */
const letGo = ($: Engine, id: string, now: number, why: (words: Words) => (name: string, title: string) => string): Promise<void> =>
  inLine($, 'turn', async () => {
    const box: { gone?: Task } = {}

    await update($, tasks, list => {
      box.gone = list.find(task => task.id === id && isActive(task))

      return box.gone === undefined ? list : list.filter(task => task !== box.gone)
    })

    const { gone } = box

    // Turned off, the mode lets it go all the same, and says nothing of it.
    if (gone === undefined || !(await read($, isOn))) return

    await stamp($, await tell($, now, [['rodo', 'slow', lineOf('rodo', 'slow', 0), inAll(lang => why(WORDS[lang])(CAST[lang].names[gone.member], titleOf(lang, gone)))]]))
  })

/** One beat of an Orca worker: a demonstration ends when it is due, a real one when its result has landed. */
const checkWorker = async ($: Engine, task: Task, now: number): Promise<void> => {
  if (task.due !== undefined) {
    const { at, isOk } = task.due
    // A demonstration's title opens with the word for one, in every language.
    const report = inAll(lang => WORDS[lang].demoReport(titleOf(lang, task).replace(/^[^:]+: /, '')))

    // One turned on to stay is held at work until it is turned off.
    if (now >= at && !(isDemoTask(task) && (await read($, isDemoHeld)))) await settle($, task.id, { isOk, why: words => words.demo, ...(isOk ? { report } : {}) })

    return
  }
  await pollWorker($, task)
  // A result that landed just now has ended it: only one still at work is let go or marked.
  if (!(await read($, tasks)).some(one => one.id === task.id && isActive(one))) return
  // Its end cannot be learned with no result file to watch, and is not coming after two hours with none: it is let go.
  if (now - task.startedAt > (task.out === undefined ? LOST_MS : LOST_MS * 2)) return letGo($, task.id, now, words => words.letGo)
  if (task.out !== undefined && task.status === 'running' && now - task.startedAt > LOST_MS) {
    const note = inAll(lang => WORDS[lang].noResult)

    await update($, tasks, list => list.map(one => (one.id === task.id && isActive(one) ? { ...one, status: 'waiting' as const, note } : one)))
  }
}

/**
 * Whether a worker's end is in doubt: its launch was taken to have failed
 * though it was handed on, so it may be running all the same, and its result
 * is still looked for as long as one at work would be waited for.
 */
const isDoubted = (task: Task, now: number): boolean => task.kind === 'orca' && task.isGuessed === true && task.out !== undefined && now - task.startedAt <= LOST_MS * 2

/** Beats in a row each agent has been missing from the engine's list. */
const unlisted = new Map<string, number>()

/** One beat of a subagent: what the engine's list says of it is what the task shows. */
const checkAgent = async ($: Engine, task: Task, agents: readonly AgentInfo[], now: number): Promise<void> => {
  const info = agents.find(agent => agent.id === task.id)

  if (info !== undefined) {
    unlisted.delete(task.id)
    if (info.status === 'completed') await settle($, task.id, { isOk: true, isGuessed: true })
    else if (info.status === 'failed' || info.status === 'killed') await settle($, task.id, { isOk: false, ...(info.status === 'killed' ? { why: words => words.stopped } : {}), isGuessed: true })
    else if ((info.status === 'waiting') !== (task.status === 'waiting')) {
      const status = info.status === 'waiting' ? ('waiting' as const) : ('running' as const)

      await update($, tasks, list => list.map(one => (one.id === task.id && isActive(one) ? { ...one, status } : one)))
    }

    return
  }
  if (task.id.startsWith('spawn:')) {
    // Its spawn answered no id: the list has it under the description the
    // spawn hook gave it, as a row no task holds yet.
    const held = new Set((await read($, tasks)).map(one => one.id))
    const found = agents.find(agent => !held.has(agent.id) && agent.type === task.engine && isRowOf(agent.description, task))

    if (found !== undefined) await claim($, found.id, found)

    return
  }
  if (now - task.startedAt <= 30_000) return
  const beats = (unlisted.get(task.id) ?? 0) + 1

  unlisted.set(task.id, beats)
  if (beats < UNLISTED_BEATS) return
  // The engine lists an agent until it drops its task: one it has not listed
  // for a while has ended, and its turn's end did not reach this hook.
  unlisted.delete(task.id)
  await settle($, task.id, { isOk: true, why: words => words.unseen, isGuessed: true })
}

/** A task three minutes on: its character says so, once, and 모몽가 with nothing to do grumbles at the wait. */
const nudge = async ($: Engine, id: string, now: number): Promise<void> => {
  const box: { slow?: Task; isMomongaBusy: boolean } = { isMomongaBusy: false }

  await update($, tasks, list => {
    box.slow = undefined
    box.isMomongaBusy = list.some(one => one.member === 'momonga' && isActive(one))

    return list.map(one => {
      if (one.id !== id || !isActive(one) || one.isSlow === true || now - one.startedAt < SLOW_MS) return one
      box.slow = { ...one, isSlow: true, quote: lineOf(one.member, 'slow', 0), note: inAll(lang => WORDS[lang].keeping(CAST[lang].job[one.role], WORDS[lang].spoken(now - one.startedAt))), mood: MOODS.slow }

      return box.slow
    })
  })

  const { slow } = box

  if (slow === undefined) return
  const lines: Line[] = [[slow.member, 'slow', slow.quote, slow.note]]

  if (!box.isMomongaBusy) lines.push(['momonga', 'slow', lineOf('momonga', 'slow', 0), inAll(lang => WORDS[lang].waitingFor(CAST[lang].names[slow.member], WORDS[lang].spoken(now - slow.startedAt)))])
  await tell($, now, lines)
}

/** The beat under way: when it began, and which it is. One held past `STUCK_MS` by a call that never answers is passed by. */
let ticking: { at: number; id: number } | undefined
let ticks = 0

/** One beat: asks after every character at work, and moves the clock the drawings read. */
const tick = async ($: Engine): Promise<void> => {
  const begun = await $.clock.now()

  if (ticking !== undefined && begun - ticking.at < STUCK_MS) return
  ticks += 1
  const mine = ticks

  ticking = { at: begun, id: mine }
  try {
    // A session begun by a `/clear` is given what is kept here, where nothing was asked of the mode yet: a drawing may not write.
    await ensure($).catch(() => undefined)
    if (!(await read($, isOn))) {
      isBusy = false

      return
    }
    await endPending($).catch(() => undefined)
    const list = await read($, tasks)
    const active = list.filter(isActive)
    const now = await $.clock.now()

    for (const task of list.filter(one => isDoubted(one, now))) await pollWorker($, task).catch(() => undefined)
    isBusy = active.length > 0
    if (active.length === 0) {
      unlisted.clear()
      early.clear()
      // The clock runs on until the last line said has aged out and the band
      // has left, and until a hand lent is seen to have been taken back;
      // after that a quiet session costs a few reads a beat.
      const said = await read($, feed)
      const drawn = await read($, clockNow)
      const lent = Object.values(await read($, aids))

      isBusy = lent.some(aid => now - aid.at < AID_MS)
      if (drawn - (said[said.length - 1]?.at ?? 0) < LINGER_MS || lent.some(aid => drawn - aid.at < AID_MS)) await stamp($, now)

      return
    }
    // A list that could not be read says nothing: nobody is ended on its silence.
    const agents = active.some(task => task.kind === 'agent' || task.owner !== undefined) ? await $.agent.list().catch(() => undefined) : []

    for (const task of active) {
      if (task.kind === 'orca') await checkWorker($, task, now)
      // A launch in a subagent's background command outlasts the subagent where the engine does not stop the command at its answer: its
      // result is still looked for, and the command's notice or its stopping ends it. Only one with no result to look for, whose subagent
      // failed or was killed, has an end that will not be learned.
      if (isLaunchIn(task) && task.out === undefined && agents?.some(agent => agent.id === task.owner && (agent.status === 'failed' || agent.status === 'killed')) === true) await endLaunch($, task)
      else if (task.kind === 'agent' && agents !== undefined) await checkAgent($, task, agents, now)
      // A background command whose notice never came after an hour has an end that cannot be learned: it is let go, as a worker with no result.
      else if (task.kind === 'shell' && now - task.startedAt > LOST_MS) await letGo($, task.id, now, words => words.lost)
      else if (task.kind === 'shell' && task.owner !== undefined && agents !== undefined) await checkShell($, task, agents, now)
      // A subagent's task no agent was told to be whose after two hours has an end that cannot be learned, as a worker's with no result: it is let go.
      if (isUnnamed(task) && now - task.startedAt > LOST_MS * 2) await letGo($, task.id, now, words => words.lost)
    }
    for (const task of (await read($, tasks)).filter(isActive)) {
      if (task.isSlow !== true && now - task.startedAt >= SLOW_MS) await nudge($, task.id, now)
    }

    await refreshUsage($).catch(() => undefined)
    await stamp($, now)
  } finally {
    if (ticking?.id === mine) ticking = undefined
  }
}

/** Opens the pane because the person asked for it: it seats at any width, and stays theirs to close. */
const openPane = async ($: Engine): Promise<void> => {
  await refreshUsage($).catch(() => undefined)
  await stamp($)
  await $.ui.open({ id: PANE, title: WORDS[await langOf($)].brand, closeOnEscape: true, ...PANE_SIZE })
  await update($, isPaneOpen, () => true)
  await update($, isPaneDismissed, () => false)
}

/** The band's open button: opens the pane, or closes it when it is open (closed by hand, so it is not opened again by itself). */
const togglePane = async ($: Engine): Promise<void> => {
  if (!(await read($, isPaneOpen))) return openPane($)
  await update($, isPaneDismissed, () => true)
  await $.ui.close({ id: PANE })
  await update($, isPaneOpen, () => false)
  await update($, watched, () => null)
}

/**
 * Shows one character's task in full in the pane, opening it; asking for the
 * one already shown, or for none, puts it away.
 */
const watch = async ($: Engine, id: MemberId | null): Promise<void> => {
  const box: { now: MemberId | null } = { now: null }

  await update($, watched, was => {
    box.now = was === id ? null : id

    return box.now
  })
  if (box.now !== null && !(await read($, isPaneOpen))) await openPane($)
}

/** A character with its mark before its name, as a line about it opens. */
const whoOf = (spoke: Lang, id: MemberId): string => `${MEMBERS[id].mark} ${CAST[spoke].names[id]}`

/** How many times the person has changed the language and the roles: what was kept is not read in over a change made while it was being read. */
const edits = { lang: 0, roles: 0 }

/**
 * Keeps the roles for later sessions and answers whether they were kept.
 * Each save is of the roles as they stand when its turn comes, so the last
 * one made holds the last change whatever order the changes were made in.
 * Roles that were never read into this session are not saved over: what is
 * kept may hold more than the session knows of.
 */
const keep = ($: Engine): Promise<boolean> =>
  inLine($, 'save', async () => {
    const box = { isRead: false }

    // Whether they were read may have been written by another hook's read, since this one began: what stands now is what an update is handed.
    await update($, isRolesRead, stands => (box.isRead = stands))

    return (
      box.isRead &&
      $.store.set(ROLES_KEPT, await read($, roles)).then(
        () => true,
        () => false,
      )
    )
  })

/**
 * Gives a character a role, or with none its own again; with no character
 * everyone has their own again. A change is kept for later sessions, and the
 * main loop is told of it beside the next prompt.
 */
const assign = async ($: Engine, id: MemberId | null, role: WorkRole | null): Promise<{ now: Roles; isChanged: boolean; isKept: boolean }> => {
  const box: { now: Roles; isChanged: boolean } = { now: {}, isChanged: false }

  edits.roles += 1
  await update($, roles, was => {
    box.now = id === null ? {} : withRole(was, id, role)
    box.isChanged = WORKERS.some(one => was[one] !== box.now[one])

    return box.now
  })
  if (!box.isChanged) return { ...box, isKept: true }
  await update($, roleVersion, version => version + 1)

  return { ...box, isKept: await keep($).catch(() => false) }
}

/** A role pressed on a character's sheet. */
const press = async ($: Engine, id: MemberId, role: WorkRole): Promise<void> => {
  const { isChanged, isKept } = await assign($, id, role)

  const spoke = await langOf($)

  if (isChanged) $.ui.toast(WORDS[spoke].roleToast(whoOf(spoke, id), CAST[spoke].roles[role], role === MEMBERS[id].role, isKept))
}

/** Who has which role, a line each, and how to change one. */
const roleLines = (spoke: Lang, given: Roles): string[] => {
  const words = WORDS[spoke]
  const { roles: labels, specialties } = CAST[spoke]

  return [
    words.rolesTitle,
    ...WORKERS.map(id => words.roleRow(whoOf(spoke, id), labels[roleOf(id, given)], jobOf(spoke, id, given), given[id] === undefined ? undefined : labels[MEMBERS[id].role])),
    '',
    ...words.roleHelp(
      WORK_ROLES.map(role => labels[role]),
      specialties,
    ),
  ]
}

/** The words that give a character, or everyone, the role that is its own, in any of the languages. */
const RESET = /^(?:reset|default|original|기본|원래|원래대로|초기화|リセット|デフォルト|初期化|元に戻す)$/

/** `/chiikawa role ...`: with nothing more who has which role; a name and a role gives it; `reset` gives everyone their own. */
const runRole = async ($: Engine, words: readonly string[]): Promise<string> => {
  const last = words.at(-1) ?? ''
  const spoke = await langOf($)
  const said = WORDS[spoke]
  const { names, roles: labels, specialties } = CAST[spoke]

  if (words.length === 0) return roleLines(spoke, await read($, roles)).join('\n')
  if (words.length === 1 && RESET.test(last)) {
    const { isChanged, isKept } = await assign($, null, null)

    return isChanged ? said.rolesReset(isKept) : said.rolesSame
  }
  const id = memberNamed(words.slice(0, -1).join(' '))
  const role = roleNamed(last)

  if (id === LEAD) return said.leadRole
  if (id === undefined || (role === undefined && !RESET.test(last))) return [said.roleUnknown, '', ...roleLines(spoke, await read($, roles))].join('\n')
  const { now, isChanged, isKept } = await assign($, id, role ?? null)
  const who = whoOf(spoke, id)
  const own = labels[MEMBERS[id].role]
  const given = labels[roleOf(id, now)]

  if (!isChanged) return said.roleSame(who, given)

  return now[id] === undefined ? said.roleBack(who, own, isKept) : said.roleGiven(who, names[id], given, own, specialties, isKept)
}

/** The person chooses who takes their next prompt; choosing the same one again takes the choice back. Answers the choice now. */
const pick = async ($: Engine, id: MemberId): Promise<MemberId | null> => {
  const box: { now: MemberId | null } = { now: null }

  await update($, picked, was => {
    box.now = was === id ? null : id

    return box.now
  })
  const spoke = await langOf($)

  $.ui.toast(box.now === null ? WORDS[spoke].unpicked(whoOf(spoke, id)) : WORDS[spoke].pickedToast(MEMBERS[id].mark, CAST[spoke].names[id]))

  return box.now
}

/** A friend, or auto, was chosen from the band's list: it takes the next prompt, and the list closes. */
const choose = async ($: Engine, id: MemberId | null): Promise<void> => {
  await update($, picked, () => id)
  await update($, isPicking, () => false)
  const spoke = await langOf($)

  $.ui.toast(id === null ? WORDS[spoke].autoHow : WORDS[spoke].pickedToast(MEMBERS[id].mark, CAST[spoke].names[id]))
}

/** Who takes the next prompt was pressed: a chosen friend is let go, and the person is told how the choosing goes. */
const auto = async ($: Engine): Promise<void> => {
  const was = await read($, picked)

  if (was !== null) await update($, picked, () => null)
  const spoke = await langOf($)

  $.ui.toast(was === null ? WORDS[spoke].autoHow : WORDS[spoke].autoBack(whoOf(spoke, was)))
}

/** The demonstration's four tasks, in the order of their titles: who takes each as what, for how long, and how it ends. */
const DEMO: readonly (readonly [Role, MemberId, number, boolean])[] = [
  ['탐색', 'usagi', 4000, true],
  ['구현', 'rakko', 11_000, true],
  ['구현', 'chiikawa', 7000, false],
  ['검토', 'kurimanju', 14_000, true],
]

/**
 * Keeps the languages for later sessions and answers whether they were kept.
 * Where they were not, they hold for this session all the same, and the
 * session notes that they are still to be kept. Languages that were never
 * read into this session are not saved over.
 */
const keepLang = ($: Engine): Promise<boolean> =>
  inLine($, 'save', async () => {
    const box = { isRead: false }

    await update($, isLangRead, stands => (box.isRead = stands))
    const isKept =
      box.isRead &&
      (await $.store.set(LANG_KEPT, await read($, langKept)).then(
        () => true,
        () => false,
      ))

    await update($, isLangUnkept, () => !isKept)

    return isKept
  })

/**
 * Notes the language a prompt was typed in, where it tells one, for this
 * session and the ones after it. Answers whether that is another than was
 * noted, and whether what is noted is kept: a save that failed is tried
 * again with each prompt until one holds, and nothing is said of that one.
 */
const noteTyped = async ($: Engine, text: string): Promise<{ isNews: boolean; isKept: boolean }> => {
  const typed = typedLang(text)
  const isNews = typed !== undefined && (await read($, langKept)).typed !== typed

  if (isNews) {
    edits.lang += 1
    await update($, langKept, was => ({ ...was, typed }))
  }

  return { isNews, isKept: isNews || (await read($, isLangUnkept)) ? await keepLang($).catch(() => false) : true }
}

const AUTO = /^(?:auto|자동|自動)$/

/**
 * `/chiikawa lang ...`: with nothing more the language and what settled it; a
 * language chooses it; `auto` takes the choice back, and with it the language
 * noted from the prompts typed so far, which is the way out of a language
 * the letters turned the screen to by mistake.
 */
const runLang = async ($: Engine, asked: readonly string[]): Promise<string> => {
  const [word = ''] = asked

  if (asked.length === 0) {
    const { lang: now, from } = await settledLang($)

    return [WORDS[now].langNow(LANG_NAMES[now], from), WORDS[now].langHow].join('\n')
  }
  const chosen = langNamed(word)

  if (asked.length > 1 || (chosen === undefined && !AUTO.test(word))) return WORDS[await langOf($)].langUnknown
  edits.lang += 1
  await update($, langKept, was => (chosen === undefined ? {} : { ...was, chosen }))
  const isKept = await keepLang($).catch(() => false)

  await follow($)
  const { lang: now, from } = await settledLang($)
  const words = WORDS[now]

  if (langWanted !== 'auto') return [words.langFixed(LANG_NAMES[langWanted]), ...(isKept ? [] : [words.unkept])].join('\n')

  return chosen === undefined ? [words.langAuto, ...(isKept ? [] : [words.unkept]), words.langNow(LANG_NAMES[now], from)].join('\n') : words.langChosen(LANG_NAMES[chosen], isKept)
}

let timer: Timer | undefined
let mover: Timer | undefined

/**
 * Reads what is kept over sessions into this one: the language, the roles,
 * whether the pane is up, the usage. What the person changed while it was
 * being read is the newer, and is left as they made it.
 */
const load = async ($: Engine, made: number): Promise<void> => {
  const { lang: spokenEdits, roles: roleEdits } = edits
  // A read begun anew after this one was given up on is the one that writes: this one, ending late, writes nothing.
  const isMine = (): boolean => made === loads
  // The language chosen or typed in an earlier session is the language from the first screen on. Where it cannot be read, it stays as it is.
  const spoken = await $.store.get(LANG_KEPT).then(langKeptFrom, () => undefined)

  // Only what was read in counts as read: what the session does not hold of what is kept, it must not save over.
  if (!isMine()) return
  if (spoken !== undefined && edits.lang === spokenEdits) {
    await update($, langKept, was => (isMine() ? spoken : was))
    await update($, isLangRead, was => isMine() || was)
  }
  if (!isMine()) return
  await refreshLook($, isMine).catch(() => false)
  if (!isMine()) return
  await enlist($)
  // The roles the person gave in an earlier session are the roles still. Where they cannot be read, the roles stay as they are.
  const kept = await $.store.get(ROLES_KEPT).then(rolesFrom, () => undefined)

  if (!isMine()) return
  if (kept !== undefined && edits.roles === roleEdits) {
    const box = { isChanged: false }

    await update($, roles, was => {
      if (!isMine()) return was
      box.isChanged = WORKERS.some(id => was[id] !== kept[id])

      return kept
    })
    await update($, isRolesRead, was => isMine() || was)
    // Read in a session under way, as on a reload, roles other than the ones in use are news to the main loop.
    if (box.isChanged) await update($, roleVersion, version => version + 1)
  }
  // A pane that stayed up over a reload is still showing the conversation.
  const isUp = await $.ui.panes().then(
    panes => panes.some(pane => pane.id === PANE),
    () => false,
  )

  if (!isMine()) return
  await update($, isPaneOpen, was => (isMine() ? isUp : was))
  if (!isMine()) return
  await refreshUsage($).catch(() => undefined)
  await update($, isLoaded, was => isMine() || was)
}

/** The read under way, so that a session starting and the hooks arriving with it share one. */
let loading: Promise<void> | undefined
/** How many reads were begun: only the last writes what it read. */
let loads = 0

/** Reads what is kept over sessions into this one, or waits for the read under way. */
const reload = ($: Engine): Promise<void> => {
  if (loading === undefined) {
    loads += 1
    const mine: Promise<void> = load($, loads).finally(() => {
      if (loading === mine) loading = undefined
    })

    loading = mine
  }
  const held = loading

  // A read held past what any fairly takes is not waited for again: the next one starts anew.
  return Promise.race([
    held,
    giveUp($, held).then(() => {
      if (loading === held) loading = undefined
    }),
  ])
}

/** Has this session hold what is kept over sessions: a `/clear` starts one with none of it, and no `session.start` fires for it. */
/** A command's kind of work, by what it runs: tests and checks are looked over, searches find, the rest is built. */
const SHELL_CHECKS = /\b(?:test|tests|pytest|jest|vitest|tsc|lint|eslint|validate|check)\b/i
const SHELL_LOOKS = /^\s*(?:grep|rg|find|ls|cat|curl|wget|git\s+(?:log|status|diff|show))\b/i
const shellRole = (command: string): Role => (SHELL_CHECKS.test(command) ? '검토' : SHELL_LOOKS.test(command) ? '탐색' : '구현')

/** What a Bash call answers of a command it left running in the background: its id, and whether it ends with its caller's final answer. */
type Backgrounded = { backgroundTaskId?: string; backgroundEndsWithFinalResponse?: boolean }

/**
 * A command left running in the background, by the loop's own choice or
 * moved there while it ran, is a task like a subagent's: a character takes
 * it, and its notification ends it. One a subagent left is its own task too,
 * with the subagent as its owner: the subagent's task may end with its turn
 * while the command it waits for runs on.
 */
const watchShell = async ($: Engine, call: string, background: string, command: string, description: string | undefined, owner?: { id: string; isTied: boolean }): Promise<void> => {
  const title = description?.trim() || (command.split('\n')[0] ?? '').trim().slice(0, 60)

  if (owner?.isTied === true) begin(`shell:${background}`)
  await reserve($, { id: `shell:${background}`, kind: 'shell', role: shellRole(command), engine: 'Bash', title, call, ...(owner === undefined ? {} : { owner: owner.id, ...(owner.isTied ? { isTied: true } : {}) }) })
  if (owner?.isTied === true) tie(owner.id, `shell:${background}`)
}

/** Whether a task is a launch in a command left in the background, which the command's end ends too. */
const isLaunchIn = (task: Task, id?: string): boolean => task.kind === 'orca' && task.shell !== undefined && (id === undefined || task.shell === id)

/**
 * Ends a launch whose command has ended: by its result where it wrote one, and let go where it did not, as how it ended is then not known.
 * Where a result is there, or may be, and could not be read, it is neither: the launch stays owed its end, and is tried again at the
 * next beat. Answers whether it is owed nothing more.
 */
const endLaunch = async ($: Engine, task: Task): Promise<boolean> => {
  const how = await pollWorker($, task).catch(() => 'unread' as const)

  if (how === 'unread') {
    pendingEnd.add(task.id)

    return false
  }
  if ((await read($, tasks)).some(one => one.id === task.id && isActive(one))) await letGo($, task.id, await $.clock.now(), words => words.lost)

  return true
}

/**
 * Lets go the background commands the engine stops at their owner's final
 * answer: no notice comes for one. It may have ended well before that, its
 * result read by its owner with no hook told: how it ended is not known.
 */
const endTied = async ($: Engine, owner: string): Promise<void> => {
  // The commands tied to this answer are the ones held now: each is kept by its task until it is ended, so that one whose ending fails
  // is tried again by itself, and what the subagent leaves running after this is not taken with it. The ones begun while this copy of
  // the module ran are owed already; the list is read for any begun before it, and a reading that fails leaves those to the beat.
  // This comes after the turn is taken, which may be long after its answer: one begun here is the next answer's by then, and is left.
  const held = await read($, tasks).catch(() => [])

  for (const task of held.filter(one => (one.kind === 'shell' || isLaunchIn(one)) && one.owner === owner && one.isTied === true && isActive(one) && !begun.has(one.id))) pendingEnd.add(task.id)
  await endPending($)
}

/** Ends each tied command still owed its end; one whose ending fails again stays owed, and one no longer at work is owed nothing. */
const endPending = async ($: Engine): Promise<void> => {
  for (const old of [...pendingEnd].slice(0, Math.max(0, pendingEnd.size - PENDING_KEPT))) pendingEnd.delete(old)
  if (pendingEnd.size === 0) return
  const held = await read($, tasks)

  for (const id of [...pendingEnd]) {
    const task = held.find(one => one.id === id && isActive(one))

    try {
      if (task?.kind === 'shell') await letGo($, task.id, await $.clock.now(), words => words.lost)
      else if (task !== undefined && !(await endLaunch($, task))) continue
      pendingEnd.delete(id)
    } catch {
      // Still owed.
    }
  }
}

/**
 * One beat of a background command a subagent left running. Its notice goes
 * to the subagent, and may reach no hook. Once the subagent has ended, or the
 * engine no longer lists it, nobody is known to wait for the command: how it
 * ended was never seen, so it is let go, told as neither done nor failed. A
 * subagent that answered may yet be woken by the notice of a command that
 * outlived the answer: it is given a few beats first.
 */
const checkShell = async ($: Engine, task: Task, agents: readonly AgentInfo[], now: number): Promise<void> => {
  const info = agents.find(agent => agent.id === task.owner)
  const key = `shell-owner:${task.id}`

  if (info !== undefined && info.status !== 'completed' && info.status !== 'failed' && info.status !== 'killed') {
    unlisted.delete(key)

    return
  }
  if (info === undefined && now - task.startedAt <= 30_000) return
  const beats = (unlisted.get(key) ?? 0) + 1

  unlisted.set(key, beats)
  if ((info === undefined || info.status === 'completed') && beats < UNLISTED_BEATS) return
  unlisted.delete(key)
  await letGo($, task.id, now, words => words.lost)
}

/** Ends a background command its loop stopped, if it is still at work, and the launches that ran in it. */
const stopShell = async ($: Engine, id: string): Promise<void> => {
  const held = await read($, tasks)
  const task = held.find(one => one.id === `shell:${id}` && isActive(one))

  if (task !== undefined) await settle($, task.id, { isOk: false, why: words => words.stopped })
  for (const launch of held.filter(one => isLaunchIn(one, id) && isActive(one))) await endLaunch($, launch)
}

/** The shell the Bash tool runs commands in, asked once a session. */
const toolShell: { asked?: Promise<'zsh' | 'bash' | undefined> } = {}

/**
 * The shell the Bash tool runs commands in, as the engine picks it: the first of `CLAUDE_CODE_SHELL` and `SHELL` that names bash or zsh
 * and is there to run. One that is not there the engine passes by, and so is it here. Where none of them is there the engine looks in
 * places of its own, and the shell is not known; neither is it where a path names both, or where a path cannot be looked for.
 */
const shellOf = ($: Engine): Promise<'zsh' | 'bash' | undefined> => {
  toolShell.asked ??= (async () => {
    try {
      for (const path of [await $.env.get('CLAUDE_CODE_SHELL'), await $.env.get('SHELL')]) {
        const isZsh = path?.includes('zsh') === true
        const isBash = path?.includes('bash') === true

        if (path === undefined || (!isZsh && !isBash) || !(await $.fs.exists(path))) continue

        return isZsh && isBash ? undefined : isZsh ? 'zsh' : 'bash'
      }
    } catch {
      return undefined
    }

    return undefined
  })()

  return toolShell.asked
}

/** What a background task's notification says: its id, how it ended, and its one-line summary. */
const NOTICE_OPEN = '<task-notification>'
const NOTICE_CLOSE = '</task-notification>'
/** What each notice in a text holds, in order: read by its two tags, each place of the text once. One left open ends the reading. */
const noticesIn = (text: string): string[] => {
  const blocks: string[] = []
  let at = 0

  for (;;) {
    const open = text.indexOf(NOTICE_OPEN, at)
    const close = open < 0 ? -1 : text.indexOf(NOTICE_CLOSE, open + NOTICE_OPEN.length)

    if (close < 0) return blocks
    blocks.push(text.slice(open + NOTICE_OPEN.length, close))
    at = close + NOTICE_CLOSE.length
  }
}
const field = (block: string, name: string): string | undefined => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1]?.trim()

/** What the engine begins a turn's text with where a background task's end woke the turn. */
const NOTICE_HEAD = '[SYSTEM NOTIFICATION - NOT USER INPUT]'

/**
 * The notices a subagent's turn begins with, where a background command's end woke it: the text opens with the engine's own heading or
 * with the notice itself, and the notices are the ones that stand together first. A message that only quotes one further on tells of no end.
 */
const wokenBy = (text: string): string | undefined => {
  const opened = text.trimStart()

  if (!opened.startsWith(NOTICE_HEAD) && !opened.startsWith('<task-notification>')) return undefined

  const from = opened.indexOf(NOTICE_OPEN)
  let at = from

  // Each notice, with only blanks before it, read once: a text is not read again from each of its places.
  for (;;) {
    const blank = /\s*/y

    blank.lastIndex = at
    const open = at + (blank.exec(opened)?.[0].length ?? 0)
    const close = opened.startsWith(NOTICE_OPEN, open) ? opened.indexOf(NOTICE_CLOSE, open + NOTICE_OPEN.length) : -1

    if (close < 0) return at === from ? undefined : opened.slice(from, at)
    at = close + NOTICE_CLOSE.length
  }
}

/**
 * Ends the background commands a notification tells of: a nonzero exit, a
 * failure or a stop is a failure. Given an owner, only that subagent's
 * commands: the text a subagent's turn begins with may quote a notice of
 * another's.
 */
const endShells = async ($: Engine, text: string, owner?: string): Promise<void> => {
  const waited = (await read($, tasks)).filter(task => isActive(task) && (owner === undefined || task.owner === owner))
  const active = waited.filter(task => task.kind === 'shell')
  /** The launches in a command left in the background: the command's end is theirs. */
  const launched = waited.filter(task => task.kind === 'orca' && task.shell !== undefined)

  if (active.length === 0 && launched.length === 0) return
  for (const block of noticesIn(text)) {
    const id = field(block, 'task-id')
    const task = active.find(one => one.id === `shell:${id ?? ''}`)

    // A launch whose command has ended wrote its result by then, or never will: with none, how it ended is not known.
    for (const launch of launched.filter(one => one.shell === id)) await endLaunch($, launch)
    if (task === undefined) continue
    const status = field(block, 'status') ?? ''
    const summary = field(block, 'summary') ?? ''
    // The code is the one the notice ends with: the command's own description may hold the same words.
    const code = /\(exit code (\d+)\)\s*$/i.exec(summary)?.[1]

    await settle($, task.id, { isOk: status === 'completed' && (code === undefined || code === '0'), ...(summary === '' ? {} : { summary: [summary.slice(0, 200)] }) })
  }
}

const ensure = async ($: Engine): Promise<void> => {
  if (!(await read($, isLoaded))) await reload($)
}

/**
 * What a press does, once this session holds what is kept over sessions: one
 * begun by a `/clear` holds none of it until something asks, a drawing may
 * not read it in, and a press that went ahead without it would save over
 * what is kept. A press that fails does no more.
 */
/** The words `/chiikawa look` takes, in the three languages, for each choice. */
const LOOK_WORDS: Record<string, LookKept> = {
  on: 'auto', auto: 'auto', 켜기: 'auto', 자동: 'auto', オン: 'auto', 自動: 'auto',
  day: 'day', light: 'day', 낮: 'day', 昼: 'day', ひる: 'day',
  night: 'night', dark: 'night', 밤: 'night', 夜: 'night', よる: 'night',
  off: 'off', 끄기: 'off', オフ: 'off',
}

/** The words that open `/chiikawa look season`, and the ones that name a season after it, in the three languages. */
const SEASON_VERBS = new Set(['season', 'seasons', '계절', '季節'])
const SEASON_WORDS: Record<string, SeasonKept> = {
  spring: 'spring', 봄: 'spring', 春: 'spring', はる: 'spring',
  summer: 'summer', 여름: 'summer', 夏: 'summer', なつ: 'summer',
  autumn: 'autumn', fall: 'autumn', 가을: 'autumn', 秋: 'autumn', あき: 'autumn',
  winter: 'winter', 겨울: 'winter', 冬: 'winter', ふゆ: 'winter',
  auto: 'auto', 자동: 'auto', 自動: 'auto',
}

const pressed = ($: Engine, act: () => Promise<unknown>): void =>
  void ensure($)
    .catch(() => undefined)
    .then(act)
    .catch(() => undefined)

/** How large a friend's picture is drawn before the desktop's progress line, in points. */
const SPIN_SIDE = 24

export const register: Register = (on, options) => {
  const isLeaderVoiced = options.leaderVoice !== false
  const isLeaderPolite = options.politeLeader === true
  const isMemberVoiced = options.memberVoice !== false
  const isOrcaVoiced = options.orcaVoice !== false
  const isBandShown = options.band !== false
  const isAnimated = options.animate !== false
  const isTrioShown = options.trio !== false

  themeWanted = options.theme === 'dark' || options.theme === 'light' ? options.theme : 'auto'
  langWanted = options.language === 'en' || options.language === 'ko' || options.language === 'ja' ? options.language : 'auto'

  isAutoOpening = options.autoOpen !== false
  const isLookWanted = options.desktopLook !== false

  on('session.start', async ($, e, next) => {
    // The shell the Bash tool runs is asked again each session.
    delete toolShell.asked
    await reload($)
    // The person's own pictures for the desktop cards, if any; a friend with none keeps its emoji. They are kept in the session's state, which every drawing reads (the band may be drawn where this copy of the module is not).
    await keepPictures($)
    // The desktop look is set once here: neither a reload nor --resume keeps a theme. Never cleared here, so another mod's theme is left alone when the look is off.
    if (isLookWanted) {
      const kept = await lookKept($)

      if (kept !== 'off') {
        if (unpainted !== undefined) $.ui.toast(unpainted)
        await setLook($, kept, await seasonNow($)).catch(() => undefined)
      }
    }
    timer?.cancel()
    timer = $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))
    mover?.cancel()
    // The drawings move only while a character is at work: a quiet session redraws nothing.
    mover = isAnimated
      ? $.clock.every(FRAME_MS, () => {
          if (isBusy) void update($, frame, at => (at + 1) % FRAMES).catch(() => undefined)
        })
      : undefined

    return next(e)
  })

  on('command.run', { command: 'chiikawa' }, async ($, e) => {
    // However many spaces the person put between the words, they are read as one.
    const asked = e.args.trim().replace(/\s+/g, ' ').toLowerCase()

    await ensure($).catch(() => undefined)
    // A theme or a language changed since the last prompt is followed from this command: no setting is watched as it is made.
    await follow($).catch(() => undefined)
    const spoke = await langOf($)
    const said = WORDS[spoke]
    const cast = CAST[spoke]

    if (asked === 'on' || asked === 'off') {
      await update($, isOn, () => asked === 'on')
      if (asked === 'off') {
        await update($, isDemoHeld, () => false)
        await update($, picked, () => null)
        await update($, watched, () => null)
        await update($, talkBack, () => 0)
      }
      await update($, brief, told => ({ ...told, doubts: told.doubts + 1 }))
      $.ui.invalidate('prompt.section')

      return { text: asked === 'on' ? `${whoOf(spoke, LEAD)} “${cast.leader.idle}” ${said.turnedOn}` : said.turnedOff }
    }
    if (asked === 'usage') {
      await refreshUsage($).catch(() => undefined)
      await stamp($)

      return { text: [said.usageTitle, ...usageLines(await sceneOf($))].join('\n') }
    }
    if (asked === 'clear' || asked === 'clear all') {
      // `all` also lets go of what still counts as at work, a task whose end never reached the mode, and of what everyone has been paid.
      const isAll = asked === 'clear all'
      const box: { gone: Task[] } = { gone: [] }

      // Without the time, no worker is still looked for.
      const now = await $.clock.now().catch(() => Number.POSITIVE_INFINITY)
      // A worker whose end is still being looked for stays: its result, and what it cost, may yet come.
      const stays = (task: Task): boolean => isActive(task) || isDoubted(task, now)

      await update($, tasks, list => {
        box.gone = isAll ? [] : list.filter(task => !stays(task))

        return isAll ? [] : list.filter(stays)
      })
      await update($, feed, () => [])
      await update($, watched, () => null)
      await update($, talkBack, () => 0)
      await update($, aids, () => ({}))
      if (isAll) {
        unlisted.clear()
        early.clear()
        heard.clear()
        untied.clear()
        pendingEnd.clear()
        tiedBy.clear()
        begun.clear()
        await update($, paid, () => ({}))
        await update($, owed, () => [])
        clears += 1
        await update($, today, () => ({ day: '', done: [], failed: [] }))
        await update($, leaderTokens, () => ZERO)
      } else await owe($, box.gone)

      return { text: isAll ? said.clearedAll : said.cleared }
    }
    if (asked === 'demo off') {
      const held = (await read($, tasks)).filter(task => isDemoTask(task) && isActive(task))
      const wasHeld = await read($, isDemoHeld)

      await update($, isDemoHeld, () => false)
      if (!wasHeld && held.length === 0) return { text: said.demoNone }
      // Each ends now, as it would have when due.
      for (const task of held) await checkWorker($, task, Number.MAX_SAFE_INTEGER)

      return { text: said.demoStopped }
    }
    if (asked === 'demo' || asked === 'demo on') {
      // The beat ends a demonstration's tasks, and the beat rests while the mode is off.
      if (!(await read($, isOn))) return { text: said.demoOff }
      const now = await $.clock.now()

      await update($, isDemoHeld, () => asked === 'demo on')

      for (const [index, [role, member, ms, isOk]] of DEMO.entries()) {
        // The mode names these itself: each has its title in every language, and the screen its own word for what runs it.
        await reserve($, { id: `orca:demo:${index}`, kind: 'orca', role, engine: said.demo, title: said.demoTitles[index] ?? said.demo, titles: inAll(lang => WORDS[lang].demoTitles[index] ?? WORDS[lang].demo), due: { at: now + ms, isOk } }, member)
      }

      return { text: asked === 'demo on' ? said.demoHeld : said.demoStarted }
    }

    const [verb = '', ...words] = asked.split(/\s+/)

    if (verb === 'look' || verb === '배경' || verb === '背景') {
      const word = words[0] ?? ''
      // Only the table's own words: a name every object has, `constructor` among them, is not a choice.
      const how = Object.hasOwn(LOOK_WORDS, word) ? LOOK_WORDS[word] : undefined

      if (SEASON_VERBS.has(word)) {
        const named = words[1] ?? ''
        const wanted = Object.hasOwn(SEASON_WORDS, named) ? SEASON_WORDS[named] : undefined

        if (wanted === undefined) return { text: said.lookSeasonHelp(await seasonNow($), (await seasonKept($)) !== 'auto') }
        const isKept = await keepSeason($, wanted)
        const season = await seasonNow($)
        const done = said.lookSeason(season, wanted !== 'auto')
        const told = isKept ? done : `${done} ${said.lookNotKept}`
        const time = await lookKept($)

        // The season is kept either way; a look that is off stays off, and is drawn in this season once it is on.
        if (time === 'off') return { text: `${told} ${said.lookSeasonOff}` }
        const set = await setLook($, time, season).catch((error: unknown) => ({ isDrawn: false, reason: String(error) }))

        return { text: set.isDrawn ? told : `${told} ${said.lookUndrawn(set.reason ?? '')}` }
      }
      if (how === 'off') {
        const isKept = await keepLook($, 'off')

        await clearLook($).catch(() => undefined)

        return { text: isKept ? said.lookOff : `${said.lookOff} ${said.lookNotKept}` }
      }
      if (how !== undefined) {
        const isKept = await keepLook($, how)
        const set = await setLook($, how, await seasonNow($)).catch((error: unknown) => ({ isDrawn: false, reason: String(error) }))

        if (!set.isDrawn) return { text: said.lookUndrawn(set.reason ?? '') }
        const done = how === 'day' ? said.lookDay : how === 'night' ? said.lookNight : said.lookOn

        return { text: isKept ? done : `${done} ${said.lookNotKept}` }
      }

      return { text: `${said.lookHelp(isLookWanted ? await lookKept($) : 'off')} ${said.lookSeasonHelp(await seasonNow($), (await seasonKept($)) !== 'auto')}` }
    }
    if (verb === 'pictures' || verb === 'picture' || verb === '그림' || verb === '絵') {
      const found = await keepPictures($)

      return { text: said.pictures(found.folder, found.found.map(id => CAST[spoke].names[id]), found.files, found.small, found.skipped) }
    }
    if (verb === 'role' || verb === 'roles' || verb === '역할' || verb === '役割') return { text: await runRole($, words) }
    if (verb === 'lang' || verb === 'language' || verb === '언어' || verb === '言語') return { text: await runLang($, words) }
    if (asked === 'talk' || asked === 'story' || asked === '이야기' || asked === 'はなし' || asked === '話') {
      const box = { isAlone: false }

      await update($, isTalkOnly, was => (box.isAlone = !was))
      await openPane($)

      return { text: box.isAlone ? said.talkOnly : said.talkAll }
    }
    if (AUTO.test(asked) || asked === 'おまかせ') {
      await update($, picked, () => null)

      return { text: said.autoSet }
    }

    const named = memberNamed(asked)

    if (named !== undefined) {
      const now = await pick($, named)

      return { text: now === null ? said.unpicked(cast.names[named]) : said.pickedSay(MEMBERS[named].mark, cast.names[named]) }
    }

    await openPane($)

    const scene = await sceneOf($)
    const talk = talkLines(scene, 5)

    return { text: [said.opened, ...rosterLines(scene), ...(talk.length === 0 ? [] : ['', said.recent, ...talk])].join('\n') }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await ensure($).catch(() => undefined)
    await update($, isPaneOpen, () => false)
    await update($, watched, () => null)
    if (e.origin.kind === 'person') await update($, isPaneDismissed, () => true)

    return next(e)
  }).catch(($, e, next) => next(e))

  // 하치와레 conducts: the main loop's system prompt gains his voice and the cast.
  on('prompt.compose', async ($, e, next) => {
    await ensure($).catch(() => undefined)
    const composed = await next(e)

    if (!isLeaderVoiced || e.traits.includes('bare') || e.traits.includes('sdk-preset') || !(await read($, isOn))) return composed

    return {
      ...composed,
      sections: [...composed.sections, { id: 'chiikawa:leader', text: leaderSection(await langOf($), isLeaderPolite, isTrioShown, await read($, roles)), scope: 'session' as const }],
    }
  })

  // A session already under way keeps the system prompt it began with, so the
  // main loop is also told once beside a prompt the person types, and told
  // again after a compaction took that away or a change of language put it
  // out of date. It counts as told only once the prompt that carried it has
  // gone in. While what it was told stands in the conversation, out of date
  // or not, it is told to stop when it is no longer to conduct: the mode
  // went off, or 하치와레's voice did.
  //
  // The character chosen in the band goes beside the same prompt, and the
  // choice is spent with it; a slash command is not a prompt to hand on.
  on('prompt.submit', async ($, e, next) => {
    // A background command's notification ends the task its character took.
    if (e.origin.kind === 'task-notification') await endShells($, e.text).catch(() => undefined)
    if (!TYPED.has(e.origin.kind)) return next(e)
    await ensure($).catch(() => undefined)
    const was = await langOf($)
    // The letters the person types in tell the language, where the mode's own setting leaves it to them.
    const typed = langWanted === 'auto' ? await noteTyped($, e.text).catch(() => undefined) : undefined

    // A theme or a language changed since the last prompt is followed from this one: no setting is watched as it is made.
    // It is followed before what the main loop was told is read, so that a new language is told beside this very prompt.
    await follow($).catch(() => undefined)
    const spoke = await langOf($)
    const told = await read($, brief)
    const isModeOn = await read($, isOn)
    const isLed = isLeaderVoiced && isModeOn
    const chosen = isModeOn && !e.text.trimStart().startsWith('/') ? await read($, picked) : null
    // The changes are read before what they count: one made in between is then told again, not missed.
    const version = await read($, roleVersion)
    const given = await read($, roles)
    // To conduct, it is told how unless what it was told stands and is up to date; no longer to conduct, it is told to stop while anything it was told stands.
    const word = isLed ? (told.isAlive && !told.isStale ? undefined : leaderSection(spoke, isLeaderPolite, isTrioShown, given)) : told.isAlive ? standDown(spoke) : undefined
    // The roles as they are now are in the section itself; alone they go as a line of their own.
    const isRoleNews = isLed && (await read($, toldRoleVersion)) < version
    const words = [...(word === undefined ? [] : [word]), ...(isRoleNews && word === undefined ? [roleNote(spoke, given)] : []), ...(chosen === null ? [] : [pickNote(spoke, chosen)])]

    // The letters turned the screen to another language: the person is told so once, in that language, with the way back, and where it could not be kept.
    if (typed?.isNews === true && spoke !== was && isModeOn) $.ui.toast(WORDS[spoke].langTyped(LANG_NAMES[spoke], was, typed.isKept))
    // They told the language the screen was in already: nothing turned, and that it is theirs from now on and could not be kept is told all the same, once.
    else if (typed?.isNews === true && !typed.isKept && isModeOn && (await settledLang($)).from === 'typed') $.ui.toast(`${WORDS[spoke].langNow(LANG_NAMES[spoke], 'typed')} ${WORDS[spoke].unkept}`)
    if (words.length === 0) return next(e)
    const sent = await next({ ...e, context: [...(e.context ?? []), ...words] })

    if (sent.drop === undefined) {
      if (word !== undefined) {
        // Told to stop, nothing it was told stands. Told to conduct, what it was told stands from now on, and is out of date
        // already where the mode went on or off, the language changed or the conversation was compacted while the prompt was
        // going in: it is then told to stop where the mode is off by now, and told again as things are where it is on.
        // Every read of one dispatch is of one moment, the one before the wait: what stands now is what an update is handed.
        await update($, brief, stands => ({ isAlive: isLed, isStale: isLed && stands.doubts !== told.doubts, doubts: stands.doubts }))
      }
      if (chosen !== null) await update($, picked, now => (now === chosen ? null : now))
      // Only the change this prompt carried counts as told: one made while it was going in is news still.
      if (isRoleNews) await update($, toldRoleVersion, was => Math.max(was, version)).catch(() => undefined)
    }

    return sent
  }).catch(($, e, next) => next(e))

  // A compaction of the main conversation takes away what the main loop was told beside a prompt. One of a subagent's own
  // transcript, one worked out ahead that installs nothing, and one that was skipped leave it standing.
  on('session.compact', async ($, e, next) => {
    const compacted = await next(e)

    if (e.agentId === undefined && e.trigger !== 'precompute' && compacted.skip === undefined) {
      await update($, brief, told => ({ isAlive: false, isStale: false, doubts: told.doubts + 1 })).catch(() => undefined)
    }

    return compacted
  }).catch(($, e, next) => next(e))

  // A subagent starts: a character takes the task and reports in its own way.
  on('agent.spawn', async ($, e, next) => {
    await ensure($).catch(() => undefined)
    if (e.fork || e.isTeammate === true || e.subagentType.startsWith('codex:') || !(await read($, isOn))) return next(e)
    const { member: wanted, rest } = namedMember(e.description)
    const title = rest === '' ? e.subagentType : rest
    // A named character with nothing said of the work takes it in the role it has now.
    const role = roleOfAgent(e.subagentType, title) ?? (wanted === undefined ? MEMBERS[specialistOf(e.subagentType, title) ?? 'shisa'].role : roleOf(wanted, await read($, roles)))
    const draft: Draft = { id: `spawn:${e.tool_use_id}`, kind: 'agent', role, engine: e.subagentType, title, call: e.tool_use_id }
    const task = await reserve($, draft, wanted, e.model ?? '')
    const spoke = await langOf($)
    const forget = (): Promise<unknown> => update($, tasks, list => list.filter(one => one.call !== e.tool_use_id || one.kind !== 'agent'))

    asking.add(e.tool_use_id)
    const started = await next({
      ...e,
      description: described(spoke, task),
      // A block the task already ends with, as when it is handed on again, gives way to the one of who has it now.
      prompt: isMemberVoiced ? unvoiced(e.prompt) + memberBlock(spoke, task.member, role) : e.prompt,
    })
      .catch(async (error: unknown) => {
        await forget()
        throw error
      })
      .finally(() => asking.delete(e.tool_use_id))

    if (started.deny !== undefined) await forget().catch(() => undefined)
    else if (started.agentId !== undefined) await bind($, e.tool_use_id, started.agentId).catch(() => undefined)

    return started
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const command = e.tool === 'Bash' ? e.command : ''
    // The name may be written over two lines, joined by a backslash, or with quotes or a backslash in it: the shell reads it as one word all the same.
    const isFleet = command.replace(/\\\n/g, '').replace(/['"\\]/g, '').includes('fleet-run')

    if (e.tool === 'Agent' || isFleet) await ensure($).catch(() => undefined)

    if (e.agentId === undefined && e.tool !== 'Agent' && !isFleet) {
      // The main loop's own work: the three are seen at it together.
      if (isTrioShown && (await read($, isOn).catch(() => false))) await lend($, e.tool, detailOf(e)).catch(() => undefined)
      if (e.tool === 'TaskStop') {
        const stopped = await next(e)
        const id = e.task_id ?? e.shell_id

        // A background command stopped by the main loop has ended: no notice may come for it.
        if (id !== undefined && stopped.deny === undefined && stopped.isError !== true) await stopShell($, id).catch(() => undefined)

        return stopped
      }
      if (e.tool !== 'Bash') return next(e)
      const ran = await next(e)
      // Left running in the background, asked for or moved there: a character watches it to its end.
      const background = ran.deny === undefined && ran.isError !== true ? (ran.result as Backgrounded | undefined)?.backgroundTaskId : undefined

      if (background !== undefined && (await read($, isOn).catch(() => false))) {
        await ensure($).catch(() => undefined)
        await watchShell($, e.tool_use_id, background, e.command, e.description).catch(() => undefined)
      }

      return ran
    }
    if (!(await read($, isOn))) {
      const ran = await next(e)
      const id = e.tool === 'TaskStop' ? (e.task_id ?? e.shell_id) : undefined

      // A command a subagent stops while the mode is off has ended all the same: no notice may come for it once the mode is on again.
      if (e.agentId !== undefined && id !== undefined && ran.deny === undefined && ran.isError !== true) await stopShell($, id).catch(() => undefined)

      return ran
    }
    if (e.agentId !== undefined) await touch($, e.agentId, e.tool, detailOf(e)).catch(() => undefined)

    if (e.tool === 'Bash' && isFleet) {
      const home = await $.env.get('HOME').catch(() => undefined)
      // Any change of folder in the command, in any quoting: a path not from the root is then not read where the command reads it.
      // Only where a command stands, after a separator or opening a script given to a shell: `echo 'cd'` moves nothing.
      const isMoved = /(?:^|[;&|(){}\n!]|\b(?:if|then|do|else|elif|while|until|time|exec|command|builtin)\s|(?:\s-[A-Za-z]*c|--command)[\s=]+['"]?)\s*(?:[A-Za-z_]\w*=\S*\s+)*(?:cd|pushd|popd|chdir)(?=$|[\s;&|)])/.test(squeezed(command.replace(/\\\n/g, ''))) ||
        // An Orca terminal opened at a worktree starts there, not where this session reads.
        /\borca\s+terminal\s+create\b[^\n]*\s--worktree\b/.test(command)
      const usable = (path: string | undefined): string | undefined =>
        path === undefined || (isMoved && !path.startsWith('/')) ? undefined : path
      const made: { task: Task; run: FleetRun; voiced?: string; isShared: boolean; isUncopied: boolean }[] = []

      const tool = await shellOf($).catch(() => undefined)
      // A command the reading fails on, as one nested deeper than it can follow, is run as it is written, as a command like any other.
      const found = ((): FleetRun[] => {
        try {
          return findFleetRuns(command, home, tool)
        } catch {
          return []
        }
      })()

      for (const [index, run] of found.entries()) {
        const role = PROFILES[run.profile] ?? '구현'
        const out = usable(run.out)
        // A result already at the worker's place is an earlier run's: it is known again by when it was written.
        const staleAt = out === undefined ? undefined : await writtenAt($, `${out}.meta.json`)
        const draft: Draft = { id: `orca:${e.tool_use_id}:${index}`, kind: 'orca', role, engine: run.profile, title: run.title, call: e.tool_use_id, ...(out === undefined ? {} : { out }), ...(staleAt === undefined ? {} : { staleAt }) }
        const spec = usable(run.spec)
        const text = isOrcaVoiced && spec !== undefined ? await $.fs.read(spec).catch(() => undefined) : undefined
        const isCast = text !== undefined && isMarked(text)
        // A spec that already ends in a character's block is run as it is, and its worker talks as that character: the task is that one's.
        const cast = isCast ? castIn(text) : undefined
        const task = await reserve($, draft, cast)
        // A command that names its spec anywhere else may write it before the worker runs: a copy made now would hold the old text, so it runs as it is.
        const isTouched = spec !== undefined && run.specSpan !== undefined && isWrittenElsewhere(command, run.specSpan, spec)
        const voiced = spec === undefined || text === undefined || isCast || isTouched || run.specSpan === undefined ? undefined : await voiceSpec($, spec, text, task)
        // A result file another worker is still waited for at was not given to this one: its end is not read off it.
        const isShared = out !== undefined && task.out === undefined

        made.push({ task, run, isShared, isUncopied: isCast && cast === undefined, ...(voiced === undefined ? {} : { voiced }) })
      }

      // Each copy takes its spec's own place in the command, the last one
      // first so that an earlier one's place has not moved.
      const rewritten = made
        .filter(one => one.voiced !== undefined)
        .sort((a, b) => (b.run.specSpan?.[0] ?? 0) - (a.run.specSpan?.[0] ?? 0))
        .reduce((text, { run, voiced }) => `${text.slice(0, run.specSpan?.[0])}${voiced ?? ''}${text.slice(run.specSpan?.[1])}`, command)
      // With no launch in it, the command is one like any other: the three are seen at the main loop's.
      if (made.length === 0 && e.agentId === undefined && isTrioShown) await lend($, e.tool, detailOf(e)).catch(() => undefined)
      const ran = await next(rewritten === command ? e : { ...e, command: rewritten }).catch(async (error: unknown) => {
        for (const { task } of made) await drop($, task.id)
        throw error
      })

      if (made.length === 0) {
        // And left running in the background, it is watched to its end as any other is.
        const background = ran.deny === undefined && ran.isError !== true ? (ran.result as Backgrounded | undefined) : undefined

        if (background?.backgroundTaskId !== undefined && (await read($, isOn).catch(() => false))) {
          await watchShell($, e.tool_use_id, background.backgroundTaskId, e.command, e.description, e.agentId === undefined ? undefined : { id: e.agentId, isTied: background.backgroundEndsWithFinalResponse === true }).catch(() => undefined)
        }

        return ran
      }
      // The command has run: nothing that fails from here on may reach the hook's own catch, which would run it again.
      try {
        if (ran.deny !== undefined) {
          for (const { task } of made) await drop($, task.id)

          return ran
        }

        const isFailed = ran.isError === true
        // The engine may leave the command running in the background by itself, at its timeout or at the person's key: it has not ended then, whatever it was asked.
        const shellId = isFailed ? undefined : (ran.result as Backgrounded | undefined)?.backgroundTaskId
        const isLeft = e.run_in_background === true || shellId !== undefined

        for (const { task, run, isShared } of made) {
          // Each launch by what hands it on, its own `&`, an Orca terminal or `nohup` around it: another launch of the same command is waited for all the same.
          const isAway = run.isBackground || run.isDetached || isLeft
          // With no result file to read its end from: one another worker has, or one whose path could not be read.
          const unread = task.out !== undefined ? undefined : isShared ? (words: Words) => words.sharedOut : run.hasOut ? (words: Words) => words.unseen : undefined

          // Turned away by fleet-run itself: no worker starts and nothing is written, so it ends now.
          // Only where it surely ran: one that may have been passed by was turned away by nothing.
          if (run.isRefused === true && run.isMaybe !== true) {
            await settle($, task.id, { isOk: false, why: words => (run.isLacking === true ? words.turnedAway : words.turnedAwayOdd) }).catch(() => undefined)
            continue
          }
          if (run.isRefused === true) {
            await letGo($, task.id, await $.clock.now(), words => words.lost).catch(() => undefined)
            continue
          }
          const how = task.out === undefined ? 'none' : await pollWorker($, task).catch(() => 'unread' as const)
          // The command's notice, when it ends in the background, tells that a launch it waited for has ended too.
          if (isAway && !isFailed && shellId !== undefined && !run.isBackground && !run.isDetached) {
            if (e.agentId !== undefined && (ran.result as Backgrounded | undefined)?.backgroundEndsWithFinalResponse === true) begin(task.id)
            await update($, tasks, list => list.map(one => (one.id === task.id && isActive(one) ? { ...one, shell: shellId, ...(e.agentId === undefined ? {} : { owner: e.agentId, ...((ran.result as Backgrounded | undefined)?.backgroundEndsWithFinalResponse === true ? { isTied: true } : {}) }) } : one))).catch(() => undefined)
            if (e.agentId !== undefined && (ran.result as Backgrounded | undefined)?.backgroundEndsWithFinalResponse === true) tie(e.agentId, task.id)
          }
          if (!isAway && (run.isMaybe === true || run.ownsExit !== true)) {
            // The launch may have been passed by, or run to a failure the command took in, as before `|| true` or a pipe; or the command
            // went on after it, and ended as something else did. With no result once the command
            // ended, which is not told. It is let go, as neither done nor failed, and not taken off unseen.
            // A result that is there, or may be, and could not be read is not none: the launch stays owed its end, and is read at the next beat.
            if (how === 'unread') {
              pendingEnd.add(task.id)
              continue
            }
            if ((await read($, tasks)).some(one => one.id === task.id && isActive(one))) {
              await letGo($, task.id, await $.clock.now(), words => words.lost).catch(() => undefined)
              continue
            }
          }
          // A launch that answered an error has failed. Handed on, its worker may be running all the same: that end is a guess, and the result is still looked for.
          if (isFailed) await settle($, task.id, isAway ? { isOk: false, why: words => words.launchFailed, isGuessed: true } : { isOk: false }).catch(() => undefined)
          else if (!isAway) await settle($, task.id, { isOk: true, ...(unread === undefined ? {} : { why: unread }) }).catch(() => undefined)
          else if (task.out === undefined) {
            const note = inAll(lang => (isShared ? WORDS[lang].sharedOut : WORDS[lang].noPath))

            await update($, tasks, list => list.map(one => (one.id === task.id && isActive(one) ? { ...one, status: 'waiting' as const, note } : one))).catch(() => undefined)
          }
        }
        // Turned off while the command ran, the mode adds no word of its own to the result.
        if (!(await read($, isOn).catch(() => false))) return ran
        const spoke = await langOf($)
        const lines = made.map(({ task, voiced, isUncopied }) => fleetNote(spoke, task.member, task.role, task.engine, task.title, voiced, isUncopied))

        return { ...ran, context: [...(ran.context ?? []), ...lines] }
      } catch {
        return ran
      }
    }

    const ran = await next(e)

    // The call has run: nothing that fails from here on may reach the hook's own catch, which would run it again.
    try {
      // A subagent's command left running in the background is watched as the main loop's is, and one it stops has ended.
      if (e.agentId !== undefined && e.tool === 'Bash' && !isFleet && ran.deny === undefined && ran.isError !== true) {
        const left = ran.result as Backgrounded | undefined

        // Turned off while the call ran, the mode takes no task for it.
        if (left?.backgroundTaskId !== undefined && (await read($, isOn).catch(() => false))) {
          await watchShell($, e.tool_use_id, left.backgroundTaskId, e.command, e.description, { id: e.agentId, isTied: left.backgroundEndsWithFinalResponse === true }).catch(() => undefined)
        }
      }
      if (e.agentId !== undefined && e.tool === 'TaskStop' && ran.deny === undefined && ran.isError !== true) {
        const id = e.task_id ?? e.shell_id

        if (id !== undefined) await stopShell($, id).catch(() => undefined)
      }
      if (e.agentId !== undefined && ran.deny !== undefined) {
        const task = (await read($, tasks)).find(one => one.id === e.agentId)

        if (task !== undefined) {
          await tell($, await $.clock.now(), [
            [task.member, 'denied', lineOf(task.member, 'denied', 0), inAll(lang => WORDS[lang].denied(e.tool))],
            ['rodo', 'denied', lineOf('rodo', 'denied', 0), inAll(lang => WORDS[lang].watching(CAST[lang].names[task.member], e.tool))],
          ])
        }
      }
      // Turned off while the call ran, the mode adds no word of its own to the result.
      if (e.tool === 'Agent' && e.agentId === undefined && ran.deny === undefined && (await read($, isOn).catch(() => false))) {
        const task = (await read($, tasks)).find(one => one.call === e.tool_use_id && one.kind === 'agent')

        if (task !== undefined) return { ...ran, context: [...(ran.context ?? []), tookNote(await langOf($), task.member, task.role)] }
      }
    } catch {
      // What the call answered is handed on as it is.
    }

    return ran
  }).catch(($, e, next) => next(e))

  // A subagent parked for its background command is woken by the command's notice: the turn that begins with it ends the command's task.
  on('turn.start', async ($, e, next) => {
    const notices = e.agentId === undefined ? undefined : wokenBy(e.text)

    if (e.agentId !== undefined && notices !== undefined) await endShells($, notices, e.agentId).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A task taken while the mode was on is ended by its turn though the mode is off by then; a task started while it is off is no task here, and the main loop's own turns are counted only while it is on.
  // A notice that comes while its loop is in a turn begins no turn: the engine hands it on beside the loop's next request, as a
  // message of its own that opens as a turn woken by one does. A subagent's ends its own commands only, as there.
  on('prompt.attachment', { type: 'queued_command' }, async ($, e, next) => {
    const notices = wokenBy(e.text)

    if (notices !== undefined) await endShells($, notices, e.agentId).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const spent = e.usage === undefined ? undefined : tokensOf(e.usage)

    if (e.agentId !== undefined) {
      const why = ENDS[e.reason]

      const key = `${e.agentId}\n${e.turnId}`
      // The same turn told again ends nothing more: what its subagent began since is another turn's. That is kept apart from
      // whether the turn was taken: one whose taking failed is taken when told again, and has let its commands go once all the same.
      const isFirst = !untied.has(key)

      untied.add(key)
      if (isFirst) untie(e.agentId)
      for (const old of [...untied].slice(0, Math.max(0, untied.size - HEARD_KEPT * HEARD_AGENTS))) untied.delete(old)
      await finish($, e.agentId, e.turnId, { isOk: e.reason === 'answer', ...(why === undefined ? {} : { why }), tokens: spent, summary: firstLines(e.answer, SUMMARY_LINES), opener: openerOf(e.answer) }).catch(() => false)
      // A turn told again lets go only what its first telling could not.
      if (isFirst) await endTied($, e.agentId).catch(() => undefined)
      else await endPending($).catch(() => undefined)
    } else if (await read($, isOn).catch(() => false)) {
      if (spent !== undefined) await update($, leaderTokens, total => plus(total, spent))
      await refreshUsage($).catch(() => undefined)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    // Every mod's backdrop comes here: draw only this mod's meadow, on the apps that draw one.
    const asked = sceneAsked(e.props)
    const scene = asked.scene === undefined ? undefined : SCENES[asked.scene]

    if (asked.plugin !== $.plugin.name || scene === undefined) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const { Svg } = $.ui.resolve(e)

    // The drawn meadow, for an engine that takes no painting as the ground.
    return <Svg source={scene} alt="A pastel meadow in its season: clouds drift, grass and flowers sway, and stars twinkle at night" isInteractive />
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const task = (await read($, tasks)).find(one => one.id === e.requestId && isActive(one))
    const spoke = await langOf($)
    const { spinner, doing } = WORDS[spoke]
    const who = task === undefined ? LEAD : task.member
    const said = task === undefined ? (spinner[e.props.mode] ?? spinner.thinking ?? '') : doing(CAST[spoke].names[task.member], CAST[spoke].job[task.role])

    // On the desktop the friend's own small picture stands before the line, where the person gave one. The desktop
    // draws the picture while the turn thinks, answers or writes a step; while a step runs it draws its own line instead.
    if (e.surface === 'desktop') {
      await seePictures($)
      const face = bandPictureOf(who, 'working')

      if (face !== undefined) {
        const { Box, Svg, Text } = $.ui.resolve(e)

        return (
          <Box gap="xs" alignItems="center">
            <Svg source={artSource(face, SPIN_SIDE)} alt={CAST[spoke].names[who]} width={SPIN_SIDE} height={SPIN_SIDE} />
            <Text>{said}</Text>
          </Box>
        )
      }
    }

    // Elsewhere, or with no picture, the line takes words alone, its emoji before them.
    return next({ ...e, props: { ...e.props, word: `${MEMBERS[who].mark} ${said}` } })
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (e.surface === 'desktop') {
      if (!(await read($, isOn))) return next(e)
      await seePictures($)
      const { Box, Text, Button, Svg } = $.ui.resolve(e)

      return drawDeskTurn({ Box, Text, Button, Svg, isAnimated }, await langOf($), e.props.durationMs)
    }
    if (e.surface !== 'terminal' || !(await read($, isOn))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const isLong = e.props.durationMs >= 600_000
    const spoke = await langOf($)
    const { leader, names } = CAST[spoke]
    const quote = isLong ? leader.cheer : Math.floor(e.props.durationMs / 1000) % 2 === 0 ? leader.allDone : leader.sure
    const lead = MEMBERS[LEAD]

    return (
      <Box gap={1}>
        <Text backgroundColor={lead.color} color={lead.ink} bold>
          {` ${names[LEAD]} `}
        </Text>
        <Text color={toneOf(lead.line, await read($, isLight))} italic>{`“${quote}”`}</Text>
        <Text dimColor>{WORDS[spoke].spoken(e.props.durationMs)}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isBandShown && e.surface === 'desktop' && !e.props.hasSurvey && (await read($, isOn))) {
      await seePictures($)
      const scene = await sceneOf($)
      const { Box, Text, Button, Svg } = $.ui.resolve(e)

      return drawDeskBand({ Box, Text, Button, Svg, isAnimated }, scene, {
        isLive: isLive(scene) && !(await read($, isPaneOpen)),
        rows: e.props.maxRows,
        isCollapsed: e.props.isCollapsed === true,
        isPicking: await read($, isPicking),
        onSeat: id => pressed($, () => watch($, id)),
        onOpen: () => pressed($, () => togglePane($)),
        onUsage: () => pressed($, () => update($, isUsageOpen, () => true).then(() => openPane($))),
        onAuto: () => pressed($, () => update($, isPicking, was => !was)),
        onChoose: id => pressed($, () => choose($, id)),
        isPaneOpen: await read($, isPaneOpen),
      })
    }
    if (!isBandShown || e.surface !== 'terminal' || e.props.hasSurvey || !(await read($, isOn))) return next(e)
    const scene = await sceneOf($)

    // The friends and the usage are always there to press; the conversation
    // joins them while there is one, unless the pane is already showing it.
    // A friend, pressed, is told of in the pane: what it is doing.
    return drawBand(await kitOf($, $.ui.resolve(e)), scene, e.props.bodyColumns, e.props.maxRows, {
      isLive: isLive(scene) && !(await read($, isPaneOpen)),
      onSeat: id => pressed($, () => watch($, id)),
      onOpen: () => pressed($, () => openPane($)),
      onUsage: () => pressed($, () => update($, isUsageOpen, () => true).then(() => openPane($))),
      onAuto: () => pressed($, () => auto($)),
    })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'desktop') await seePictures($)
    const scene = await sceneOf($)
    const isShown = await read($, isOn)

    if (e.surface === 'terminal') {
      const room = { columns: e.props.bodyColumns, rows: e.props.scroll.bodyRows }

      return drawPane(await kitOf($, $.ui.resolve(e)), scene, isShown, room, {
        onWatch: id => pressed($, () => watch($, id)),
        onPick: id => pressed($, () => pick($, id)),
        onUsage: () => pressed($, () => update($, isUsageOpen, was => !was)),
        onTalk: back => pressed($, () => update($, talkBack, () => back)),
        onStory: () => pressed($, () => update($, isTalkOnly, was => !was)),
        onRole: (id, role) => pressed($, () => press($, id, role)),
      })
    }
    if (e.surface === 'desktop') {
      const { Box, Text, Button, Svg } = $.ui.resolve(e)
      const seat = e.props.placement === 'widget' || e.props.placement === 'inline' ? e.props.placement : 'dock'

      return drawDeskPane({ Box, Text, Button, Svg, isAnimated }, scene, isShown, e.props.bodyColumns, seat, {
        onWatch: id => pressed($, () => watch($, id)),
        onPick: id => pressed($, () => pick($, id)),
        onUsage: () => pressed($, () => update($, isUsageOpen, was => !was)),
        onTalk: back => pressed($, () => update($, talkBack, () => back)),
        onStory: () => pressed($, () => update($, isTalkOnly, was => !was)),
        onRole: (id, role) => pressed($, () => press($, id, role)),
      })
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {[...rosterLines(scene), ...talkLines(scene, 8), ...usageLines(scene)].map(line => (
          <Text>{line}</Text>
        ))}
      </Box>
    )
  })
}
