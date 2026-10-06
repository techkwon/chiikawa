import type { Color, Elements, RenderElement } from 'claude-code'

import type { Aid, Aids, Lang, MemberId, Mood, Roles, Said, Task, Tokens, Usage, WorkRole } from '../types'

import { ART_COLUMNS, ART_ROWS, artRows, ICON_COLUMNS, ICON_ROWS, iconOf } from './art'
import { CAST, CORE, isActive, isGesture, jobOf, LEAD, MEMBERS, ORDER, PINK, roleOf, say, shortName, shown, toneOf, WORK_ROLES, WORKERS } from './cast'
import type { Words } from './words'
import { WORDS } from './words'

/** How the drawings look just now: the tones of the person's theme, and the frame of what moves. */
export type Look = { isLight: boolean; frame: number }

export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Raster' | 'Button'> & Look

export type Scene = {
  /** The language the screen is written in. */
  lang: Lang
  tasks: readonly Task[]
  now: number
  waveAt: number
  usage: Usage | null
  leaderTokens: Tokens
  feed: readonly Said[]
  /** The character the person's next prompt goes to, where they chose one. */
  picked: MemberId | null
  /** The character the pane tells of in full, where they asked about one. */
  watched: MemberId | null
  /** The hands lent to the main loop's own work, by whom and when. */
  aids: Aids
  /** Whether the pane shows the usage in full; one line of it otherwise. */
  isUsageOpen: boolean
  /** How many lines back from the last the pane's conversation is turned. */
  talkBack: number
  /** Whether the pane shows the conversation alone, as much of it as the pane holds. */
  isTalkOnly: boolean
  /** The roles the person gave; a character not named has its own. */
  roles: Roles
  /** What each character's tasks have cost so far, whatever has become of the tasks. */
  paid: Partial<Record<MemberId, Tokens>>
}

/** The room a pane has: the cells across its body, and the rows it may take. */
export type Room = { columns: number; rows: number }

/** Shows one character's task in full, or with `null` puts it away. */
export type OnWatch = (id: MemberId | null) => void

const MARK: Record<Task['status'], string> = { running: '●', waiting: '◐', done: '✓', failed: '✗' }
const TINT: Record<Task['status'], Color | undefined> = {
  running: undefined,
  waiting: 'warning',
  done: 'success',
  failed: 'error',
}

/** The mark of one at work, a frame at a time. */
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const spin = (kit: Kit): string => SPIN[kit.frame % SPIN.length] ?? MARK.running

const lineOf = (kit: Kit, id: MemberId): Color => toneOf(MEMBERS[id].line, kit.isLight)

/** A name under the pointer: lit in the character's own colors. */
const lit = (id: MemberId): { backgroundColor: Color; color: Color; bold: true } => ({ backgroundColor: MEMBERS[id].color, color: MEMBERS[id].ink, bold: true })

/** How long a hand lent to the main loop's work shows as one. */
export const AID_MS = 12_000

/** The hand a character is lending just now, if it is. */
export const aidOf = (scene: Pick<Scene, 'aids' | 'now'>, id: MemberId): Aid | undefined => {
  const aid = scene.aids[id]

  return aid !== undefined && scene.now - aid.at < AID_MS ? aid : undefined
}

const WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f1e6, 0x1f1ff],
  [0x1f300, 0x1faff],
  [0x20000, 0x3fffd],
]

const JOINED = /^(?:\p{M}|[‍︎️\u{1f3fb}-\u{1f3ff}])$/u
const FLAG = /^[\u{1f1e6}-\u{1f1ff}]$/u
/** A sign a terminal draws as a picture with no selector asking for it: `✅`, `⌚`, `⏰`. */
const PICTURED = /^\p{Emoji_Presentation}/u

/** The text as the units a terminal draws: a letter with its accents, an emoji with all that is joined to it. */
const clusters = (text: string): string[] => {
  const units: string[] = []
  let isJoining = false

  for (const char of text) {
    const last = units[units.length - 1]
    const isPair = last !== undefined && FLAG.test(last) && FLAG.test(char)

    if (last !== undefined && (isJoining || isPair || JOINED.test(char))) units[units.length - 1] = last + char
    else units.push(char)
    isJoining = char === '‍'
  }

  return units
}

const cellsOfCluster = (unit: string): number => {
  const code = unit.codePointAt(0) ?? 0

  // A mark with nothing to sit on takes no cell.
  if (JOINED.test(String.fromCodePoint(code))) return 0

  // A sign in its picture form is two cells, whatever its own width: one the selector asks it of, or one drawn so unasked.
  return unit.includes('️') || PICTURED.test(unit) || WIDE.some(([from, to]) => code >= from && code <= to) ? 2 : 1
}

/** Cells a string takes on a terminal row: Hangul, kana and emoji take two. */
export const cells = (text: string): number => clusters(text).reduce((total, unit) => total + cellsOfCluster(unit), 0)

/** The start of the text that goes in a width in cells, with nothing standing for the rest. */
const clip = (text: string, width: number): string => {
  let kept = ''
  let used = 0

  for (const unit of clusters(text)) {
    const next = cellsOfCluster(unit)

    if (used + next > width) break
    kept += unit
    used += next
  }

  return kept
}

/** The text cut to a width in cells, an ellipsis standing for what was cut. */
export const fit = (text: string, width: number): string => {
  if (width <= 0) return ''

  return cells(text) <= width ? text : `${clip(text, width - 1)}…`
}

/** The text cut to a width from its start, an ellipsis standing for what was cut: a path keeps its file's name. */
export const fitEnd = (text: string, width: number): string => {
  if (width <= 0) return ''
  if (cells(text) <= width) return text
  const units = clusters(text)
  let kept = ''
  let used = 0

  for (let at = units.length - 1; at >= 0; at -= 1) {
    const unit = units[at] ?? ''
    const next = cellsOfCluster(unit)

    if (used + next > width - 1) break
    kept = unit + kept
    used += next
  }

  return `…${kept}`
}

export const pad = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - cells(text)))

const wordsOf = (scene: Pick<Scene, 'lang'>): Words => WORDS[scene.lang]

const nameOf = (scene: Pick<Scene, 'lang'>, id: MemberId): string => CAST[scene.lang].names[id]

/** A character's name in a width: its short one where the whole does not go in, cut where even that does not. */
const nameIn = (lang: Lang, id: MemberId, width: number, most = width): string => {
  const whole = CAST[lang].names[id]

  return cells(whole) <= width ? whole : fit(shortName(lang, id), most)
}

export const clock = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export const elapsed = (task: Task, now: number): number => (task.endedAt ?? Math.max(now, task.startedAt)) - task.startedAt

/** The tasks of the wave in hand: the active ones first, then the newest. */
export const onStage = (scene: Scene): Task[] =>
  scene.tasks
    .filter(task => task.startedAt >= scene.waveAt || isActive(task))
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.startedAt - a.startedAt)

/** The last line said, by anyone or by one character. */
export const lastSaid = (scene: Pick<Scene, 'feed'>, id?: MemberId): Said | undefined => {
  for (let at = scene.feed.length - 1; at >= 0; at -= 1) {
    const said = scene.feed[at]

    if (said !== undefined && (id === undefined || said.member === id)) return said
  }

  return undefined
}

const isRunning = (task: Task): boolean => task.status === 'running'

/** The ones at work. One whose task waits, on an answer or on a result that has not come, is not: it rests until it goes on. */
const busyOf = (scene: Scene): MemberId[] => WORKERS.filter(id => scene.tasks.some(task => task.member === id && isRunning(task)))

const waitingOf = (scene: Scene): MemberId[] => WORKERS.filter(id => !scene.tasks.some(task => task.member === id && isRunning(task)) && scene.tasks.some(task => task.member === id && isActive(task)))

/** Whether a character is at work: one with a task in hand or lending a hand, and 하치와레 while anyone has a task. */
const isAtWork = (scene: Scene, id: MemberId): boolean => aidOf(scene, id) !== undefined || scene.tasks.some(task => isRunning(task) && (id === LEAD || task.member === id))

const Badge = ({ Text }: Kit, id: MemberId, name: string): RenderElement => (
  <Text backgroundColor={MEMBERS[id].color} color={MEMBERS[id].ink} bold>
    {` ${name} `}
  </Text>
)

const Dot = (kit: Kit, id: MemberId): RenderElement => <kit.Text color={lineOf(kit, id)}>● </kit.Text>

/** A character's picture in keyboard characters, wearing the mood's face; one at work walks. */
const Picture = (kit: Kit, id: MemberId, mood: Mood, isWalking = false): RenderElement => {
  const { Box, Text } = kit

  return (
    <Box flexDirection="column" width={ART_COLUMNS}>
      {artRows(id, mood, kit.isLight, isWalking && kit.frame % 2 === 1).map((runs, row) => (
        <Text key={`art-${row}`}>
          {runs.map((run, index) => (
            <Text key={`run-${index}`} color={run.color}>
              {run.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

/** A character's pixel icon; one at work bounces. */
const Icon = (kit: Kit, id: MemberId, isBouncing = false): RenderElement => (
  <kit.Raster key={`icon-${id}`} columns={ICON_COLUMNS} rows={ICON_ROWS} cells={iconOf(id, kit.isLight, isBouncing && kit.frame % 2 === 1)} />
)

/** A line or a gesture in the character's color; a gesture is told plainly, a line in italics. */
const Quote = (kit: Kit, id: MemberId, quote: string, width: number): RenderElement => (
  <kit.Text color={lineOf(kit, id)} italic={!isGesture(quote)}>
    {fit(shown(quote), width)}
  </kit.Text>
)

// ---- usage

export const ZERO: Tokens = { fresh: 0, cached: 0, out: 0 }

export const plus = (a: Tokens, b: Tokens | undefined): Tokens => {
  if (b === undefined) return a
  const usd = a.usd === undefined && b.usd === undefined ? undefined : (a.usd ?? 0) + (b.usd ?? 0)

  return { fresh: a.fresh + b.fresh, cached: a.cached + b.cached, out: a.out + b.out, usd }
}

export const spent = (lang: Lang, tokens: Tokens): string => {
  const { amount, tokens: told } = WORDS[lang]
  const cost = tokens.usd === undefined ? '' : ` · $${tokens.usd.toFixed(2)}`

  return `${told(amount(tokens.fresh), amount(tokens.cached), amount(tokens.out))}${cost}`
}

/** What each character has spent so far: what its tasks have cost, 하치와레's the main loop's. */
export const spentBy = (scene: Pick<Scene, 'paid' | 'leaderTokens'>): Record<MemberId, Tokens> => {
  const by = Object.fromEntries(ORDER.map(id => [id, scene.paid[id] ?? ZERO])) as Record<MemberId, Tokens>

  by[LEAD] = scene.leaderTokens

  return by
}

const isSpent = (tokens: Tokens): boolean => tokens.fresh + tokens.cached + tokens.out > 0 || tokens.usd !== undefined

/** When a window resets, as the language says it. */
export const until = (lang: Lang, at: number, now: number): string => WORDS[lang].until(Math.max(0, Math.round((at - now) / 60_000)))

const bar = (percent: number): string => {
  const lit = percent <= 0 ? 0 : Math.max(1, Math.min(10, Math.round(percent / 10)))

  return '▰'.repeat(lit) + '▱'.repeat(10 - lit)
}

/** The context window still free, 0 to 100, when the engine has a reading. */
export const batteryOf = (usage: Usage | null): number | undefined =>
  usage?.contextPercent === undefined ? undefined : Math.max(0, 100 - usage.contextPercent)

/** The band's one-glance gauge, the part to keep longest first: battery left, and the five-hour window. */
export const gaugeParts = (lang: Lang, usage: Usage | null): string[] => {
  const words = WORDS[lang]
  const free = batteryOf(usage)
  const window = usage?.limits.find(limit => limit.kind === 'five_hour')

  return [free === undefined ? '' : `${words.battery} ${Math.round(free)}%`, window === undefined ? '' : `${words.limits.five_hour ?? ''} ${window.percentUsed}%`].filter(part => part !== '')
}

type Meter = { label: string; percent: number; tint: Color; text: string }

/** The cells a meter's label takes with the cell after it: the widest the language has. */
const labelCells = (words: Words): number => Math.max(cells(words.battery), ...Object.values(words.limits).map(cells)) + 1

const metersOf = (scene: Scene): Meter[] => {
  const { usage } = scene
  const words = wordsOf(scene)
  const free = batteryOf(usage)
  const meters: Meter[] = []

  if (usage !== null && free !== undefined) {
    meters.push({
      label: words.battery,
      percent: free,
      tint: free < 20 ? 'error' : free < 40 ? 'warning' : 'success',
      text: words.left(Math.round(free), words.amount(usage.contextTokens ?? 0), words.amount(usage.contextWindow)),
    })
  }
  for (const limit of usage?.limits ?? []) {
    const reset = limit.resetsAt === undefined ? '' : ` · ${until(scene.lang, limit.resetsAt, scene.now)}`

    meters.push({
      label: words.limits[limit.kind] ?? limit.kind,
      percent: limit.percentUsed,
      tint: limit.percentUsed >= 90 ? 'error' : limit.percentUsed >= 70 ? 'warning' : 'success',
      text: `${words.used(limit.percentUsed)}${reset}`,
    })
  }

  return meters
}

const spendersOf = (scene: Scene): MemberId[] => {
  const by = spentBy(scene)

  return ORDER.filter(id => isSpent(by[id]))
}

/** The cells a spender's name has in the usage card, with the cell after it. */
const PAID_NAME = 15

/** Rows the usage card takes, frame and all. */
const usageRows = (scene: Scene): number => {
  const spenders = spendersOf(scene).length
  const rows = metersOf(scene).length + (spenders === 0 ? 0 : spenders + 1)

  return 2 + 1 + Math.max(1, rows)
}

/** The usage card: the session's battery, the plan's windows, who earned what. */
const UsageCard = (kit: Kit, scene: Scene, width: number, onUsage: () => void): RenderElement => {
  const { Box, Text, Button } = kit
  const inner = width - 4
  const words = wordsOf(scene)
  const meters = metersOf(scene)
  const by = spentBy(scene)
  const spenders = spendersOf(scene)
  const usd = scene.usage?.usd
  const label = labelCells(words)

  return (
    <Box borderStyle="round" borderColor="subtle" paddingX={1} flexDirection="column" width={width}>
      <Box justifyContent="space-between" width={inner}>
        <Box gap={1}>
          <Text bold>{words.usage}</Text>
          {usd !== undefined && <Text dimColor>{fit(words.session(usd.toFixed(2)), inner - cells(words.usage) - cells(words.fold) - 3)}</Text>}
        </Box>
        <Button key="usage-less" label={words.fold} plain dimColor onPress={() => onUsage()} />
      </Box>
      {meters.map(meter => (
        <Text key={meter.label} wrap="truncate-end">
          <Text dimColor>{pad(meter.label, label)}</Text>
          <Text color={meter.tint}>{bar(meter.percent)}</Text>
          <Text>{` ${fit(meter.text, inner - label - 11)}`}</Text>
        </Text>
      ))}
      {spenders.length > 0 && <Text dimColor>{fit(words.pay, inner)}</Text>}
      {spenders.map(id => (
        <Text key={id} wrap="truncate-end">
          {Dot(kit, id)}
          <Text>{pad(nameIn(scene.lang, id, PAID_NAME - 1), PAID_NAME)}</Text>
          <Text dimColor>{fit(spent(scene.lang, by[id]), inner - PAID_NAME - 2)}</Text>
        </Text>
      ))}
      {meters.length === 0 && spenders.length === 0 && <Text dimColor>{fit(words.noUsage, inner)}</Text>}
    </Box>
  )
}

// ---- the conversation, a line to a row: where there is no room for a comic

/** One line of the conversation: who, what was said or done, and what it was about. */
const TalkRow = (kit: Kit, lang: Lang, said: Said, width: number, key: string): RenderElement => {
  const { Text } = kit
  const name = CAST[lang].names[said.member]
  const room = width - cells(name) - 3
  const quote = fit(shown(said.quote), room)
  const noteRoom = room - cells(quote) - 1

  return (
    <Text key={key} wrap="truncate-end">
      {Badge(kit, said.member, name)}
      <Text> </Text>
      {Quote(kit, said.member, said.quote, room)}
      {said.note !== '' && noteRoom >= 6 && <Text dimColor>{` ${fit(said.note, noteRoom)}`}</Text>}
    </Text>
  )
}

/** What stands for the conversation before anything was said: 하치와레, waiting for work. */
const waitingSaid = (scene: Pick<Scene, 'lang'>): Said => ({ member: LEAD, quote: CAST[scene.lang].leader.idle, note: wordsOf(scene).awaiting, at: 0, mood: 'calm' })

/** The last lines of the conversation, oldest first, beside the picture of whoever spoke last. */
const Talk = (kit: Kit, scene: Scene, width: number, lines: number, withPicture: boolean): RenderElement => {
  const { Box } = kit
  const waiting = waitingSaid(scene)
  const said = scene.feed.length === 0 ? [waiting] : scene.feed.slice(-Math.max(1, lines))
  const latest = said[said.length - 1] ?? waiting
  const room = withPicture ? width - ART_COLUMNS - 1 : width

  return (
    <Box gap={1} width={width}>
      {withPicture && Picture(kit, latest.member, latest.mood, isAtWork(scene, latest.member))}
      <Box flexDirection="column" width={room} justifyContent="flex-end">
        {said.map((one, index) => TalkRow(kit, scene.lang, one, room, `said-${one.at}-${index}`))}
      </Box>
    </Box>
  )
}

// ---- the conversation as a comic: a picture, and a balloon for what was said

/** The narrowest a cut is drawn: a picture, and a balloon that holds a short line. */
const CUT_COLUMNS = 46
const MAX_CUTS = 8
/** The cuts the conversation has before the ones resting are given seats. */
const MIN_CUTS = 3

const isShout = (quote: string): boolean => /[!！]\s*$/.test(quote)

/**
 * One cut of the comic: the speaker's picture, and a balloon with its name on
 * the rim and its tail toward the picture. A gesture is a caption instead, a
 * square box with no tail. What the line is about stands dim beside the
 * balloon, or on its lower rim where there is no room beside. `isTurned` puts
 * the picture on the right, so that two cuts face each other.
 */
const Cut = (kit: Kit, lang: Lang, said: Said, width: number, isTurned: boolean, isWalking: boolean, key: string): RenderElement => {
  const { Box, Text } = kit
  const line = lineOf(kit, said.member)
  const isCaption = isGesture(said.quote)
  const words = isCaption ? said.quote.replace(/^\((.*)\)$/, '$1') : said.quote
  const room = width - ART_COLUMNS - 1
  const name = nameIn(lang, said.member, Math.max(2, room - 6))
  const own = Math.max(cells(words), cells(name) + 2) + 4
  const isBeside = said.note !== '' && room - own - 1 >= Math.min(cells(said.note), 10)
  const outer = Math.max(cells(name) + 6, Math.min(room, isBeside || said.note === '' ? own : Math.max(own, cells(said.note) + 6)))
  const [topLeft, topRight, bottomLeft, bottomRight] = isCaption ? ['┌', '┐', '└', '┘'] : ['╭', '╮', '╰', '╯']
  const text = fit(words, outer - 4)
  const fill = ' '.repeat(Math.max(0, outer - 4 - cells(text)))
  const beside = isBeside ? fit(said.note, room - outer - 1) : ''
  const under = isBeside || said.note === '' ? '' : fit(said.note, outer - 6)
  const rim = '─'.repeat(Math.max(0, outer - 5 - cells(name)))
  const foot = '─'.repeat(Math.max(0, under === '' ? outer - 2 : outer - 5 - cells(under)))
  const push = ' '.repeat(Math.max(0, room - outer))
  const lead = beside === '' ? push : `${' '.repeat(Math.max(0, room - outer - 1 - cells(beside)))}${beside} `
  const tail = isCaption ? '│' : isTurned ? '>' : '<'
  const picture = Picture(kit, said.member, said.mood, isWalking)

  return (
    <Box key={key} gap={1} width={width}>
      {!isTurned && picture}
      <Box flexDirection="column" width={room}>
        <Text wrap="truncate-end">
          <Text color={line}>{isTurned ? `${push}${topLeft}${rim}` : `${topLeft}─`}</Text>
          {Badge(kit, said.member, name)}
          <Text color={line}>{isTurned ? `─${topRight}` : `${rim}${topRight}`}</Text>
        </Text>
        <Text wrap="truncate-end">
          {isTurned && <Text dimColor>{lead}</Text>}
          <Text color={line}>{isTurned ? '│ ' : `${tail} `}</Text>
          <Text color={line} italic={!isCaption} bold={isShout(words)}>
            {text}
          </Text>
          <Text color={line}>{`${fill} ${isTurned ? tail : '│'}`}</Text>
          {!isTurned && beside !== '' && <Text dimColor>{` ${beside}`}</Text>}
        </Text>
        <Text wrap="truncate-end">
          <Text color={line}>{`${isTurned ? push : ''}${bottomLeft}${under === '' ? '' : '─ '}`}</Text>
          {under !== '' && <Text dimColor>{under}</Text>}
          <Text color={line}>{`${under === '' ? '' : ' '}${foot}${bottomRight}`}</Text>
        </Text>
      </Box>
      {isTurned && picture}
    </Box>
  )
}

/** Which lines of the conversation a page of `count` cuts holds, turned back as far as the person turned it. */
const shownOf = (scene: Scene, count: number): { from: number; to: number } => {
  const size = Math.max(1, count)
  const to = Math.max(Math.min(size, scene.feed.length), scene.feed.length - Math.max(0, scene.talkBack))

  return { from: Math.max(0, to - size), to }
}

/** The last lines of the conversation as cuts down a page, oldest first: the friends on the left, 하치와레 answering from the right. */
const Page = (kit: Kit, scene: Scene, width: number, count: number): RenderElement => {
  const { from, to } = shownOf(scene, count)
  const said = scene.feed.length === 0 ? [waitingSaid(scene)] : scene.feed.slice(from, to)

  return (
    <kit.Box flexDirection="column" width={width}>
      {said.map((one, index) => Cut(kit, scene.lang, one, width, one.member === LEAD, isAtWork(scene, one.member), `cut-${one.at}-${index}`))}
    </kit.Box>
  )
}

// ---- the band

/** What the band shows and what a press in it asks for. */
export type Band = {
  /** Whether there is a conversation to show under the row of friends. */
  isLive: boolean
  /** A friend was pressed: the pane shows what it is doing. */
  onSeat: (id: MemberId) => void
  /** The count of friends the row has no room to name was pressed: the pane opens. */
  onOpen: () => void
  /** The usage was pressed: the pane opens with the usage in full. */
  onUsage: () => void
  /** Who takes the next prompt was pressed: a chosen friend is let go, and 하치와레 decides again. */
  onAuto: () => void
}

type Seat = {
  id: MemberId
  /** The mark of its task in this wave; none for one with no task. */
  glyph: string
  isRunning: boolean
  tint: Color | undefined
  label: string
  /** How long its task has run, while it runs. */
  time: string
  isBusy: boolean
  isDim: boolean
}

const SEAT_GAP = 2
const GUESTS: readonly MemberId[] = WORKERS.filter(id => !CORE.includes(id))

const seatOf = (scene: Scene, stage: readonly Task[], id: MemberId): Seat => {
  const task = id === LEAD ? stage.find(isRunning) : stage.find(one => one.member === id)
  const isHelping = aidOf(scene, id) !== undefined && (task === undefined || !isActive(task))
  // One that waits keeps its mark and its time, and is counted with the ones resting.
  const isBusy = isHelping || (task !== undefined && isRunning(task))
  const isPicked = scene.picked === id

  return {
    id,
    glyph: isHelping ? MARK.running : task === undefined ? '' : id === LEAD ? MARK.running : MARK[task.status],
    isRunning: isHelping || (task !== undefined && (id === LEAD || task.status === 'running')),
    tint: isHelping || task === undefined || id === LEAD ? undefined : TINT[task.status],
    label: `${isPicked ? '▶' : ''}${shortName(scene.lang, id)}`,
    time: id !== LEAD && task !== undefined && isActive(task) ? ` ${clock(elapsed(task, scene.now))}` : '',
    isBusy,
    isDim: !isPicked && !isBusy,
  }
}

const seatCells = (seat: Seat, hasTime: boolean): number => SEAT_GAP + (seat.glyph === '' ? 0 : 2) + cells(seat.label) + (hasTime ? cells(seat.time) : 0)

type BandRow = {
  /** The three the comic is about: always named. */
  core: Seat[]
  /** The others the row names. */
  guests: Seat[]
  /** What stands for the others it has no room to name; empty where it names them all. */
  rest: string
  hasTime: boolean
  /** Who takes the next prompt; empty where there is no room to say. */
  to: string
  gauge: string
}

/**
 * The fullest row the band's width holds, least room last: everyone by name,
 * then the three and whoever is at work with the rest as a count, then the
 * three alone; the time a task has run goes before a name does, then the
 * gauge's second half, then who takes the next prompt.
 */
const rowOf = (scene: Scene, columns: number): BandRow => {
  const stage = onStage(scene)
  const core = CORE.map(id => seatOf(scene, stage, id))
  const guests = GUESTS.map(id => seatOf(scene, stage, id))
  const called = guests.filter(seat => seat.isBusy || scene.picked === seat.id)
  const words = wordsOf(scene)
  // The mode's name in its badge, a cell either side.
  const title = cells(words.brand) + 2
  const parts = gaugeParts(scene.lang, scene.usage)
  const whole = parts.length === 0 ? words.usage : parts.join(' · ')
  const brief = parts[0] ?? whole
  const sent = words.sent(scene.picked === null ? words.auto : shortName(scene.lang, scene.picked))
  const tries: readonly (readonly [named: Seat[], hasTime: boolean, gauge: string, to: string])[] = [
    [guests, true, whole, sent],
    [guests, false, whole, sent],
    [guests, false, brief, sent],
    [called, true, whole, sent],
    [called, false, whole, sent],
    [called, false, brief, sent],
    [[], false, brief, sent],
    [[], false, brief, ''],
    [[], false, '', ''],
  ]

  for (const [named, hasTime, gauge, to] of tries) {
    const unnamed = guests.filter(seat => !named.includes(seat))
    const atWork = unnamed.filter(seat => seat.isBusy).length
    const resting = unnamed.length - atWork
    const counts = [atWork === 0 ? '' : words.working(atWork), resting === 0 ? '' : words.resting(resting)].filter(part => part !== '')
    const seats = [...core, ...named].reduce((total, seat) => total + seatCells(seat, hasTime), 0)

    // Both counts where they fit, and the one of those at work where they do not.
    for (const rest of counts.length === 2 ? [counts.join(' · '), counts[0] ?? ''] : [counts[0] ?? '']) {
      const used = title + seats + (named.length === 0 ? 0 : SEAT_GAP + 1) + (rest === '' ? 0 : SEAT_GAP + cells(rest)) + (to === '' ? 0 : SEAT_GAP + cells(to)) + (gauge === '' ? 0 : SEAT_GAP + cells(gauge))

      if (used <= columns) return { core, guests: named, rest, hasTime, to, gauge }
    }
  }

  return { core: [], guests: [], rest: '', hasTime: false, to: '', gauge: title + 1 + cells(brief) <= columns ? brief : '' }
}

/** One friend in the band's row: the mark of its task, its name to press, and how long the task has run. */
const SeatBox = (kit: Kit, seat: Seat, hasTime: boolean, onSeat: (id: MemberId) => void): RenderElement => {
  const { Box, Text, Button } = kit
  const tone = seat.tint ?? lineOf(kit, seat.id)

  return (
    <Box key={seat.id}>
      {seat.glyph !== '' && <Text color={tone}>{`${seat.isRunning ? spin(kit) : seat.glyph} `}</Text>}
      <Button key={`seat-${seat.id}`} label={seat.label} plain dimColor={seat.isDim} hover={lit(seat.id)} onPress={() => onSeat(seat.id)} />
      {hasTime && seat.time !== '' && <Text color={tone}>{seat.time}</Text>}
    </Box>
  )
}

/**
 * The band above the prompt: the friends by name, each to press, the three
 * the comic is about first and the others after a rule; at the right end
 * who takes the next prompt (하치와레 decides, unless a friend was chosen)
 * and the usage; and under them the last line said, as one cut, while there
 * is a conversation the pane is not showing.
 */
export const drawBand = (kit: Kit, scene: Scene, columns: number, rows: number, band: Band): RenderElement => {
  const { Box, Text, Button } = kit
  const row = rowOf(scene, columns)
  const isTalking = band.isLive && scene.feed.length > 0
  const latest = isTalking ? scene.feed[scene.feed.length - 1] : undefined
  const isComic = rows - 1 >= ART_ROWS && columns >= CUT_COLUMNS

  return (
    <Box flexDirection="column" width={columns}>
      <Box justifyContent="space-between" width={columns}>
        <Box gap={SEAT_GAP}>
          <Text backgroundColor={PINK} color="#000000" bold>
            {` ${wordsOf(scene).brand} `}
          </Text>
          {row.core.map(seat => SeatBox(kit, seat, row.hasTime, band.onSeat))}
          {row.guests.length > 0 && <Text dimColor>│</Text>}
          {row.guests.map(seat => SeatBox(kit, seat, row.hasTime, band.onSeat))}
          {row.rest !== '' && <Button key="rest" label={row.rest} plain dimColor onPress={() => band.onOpen()} />}
        </Box>
        <Box gap={SEAT_GAP}>
          {row.to !== '' && <Button key="to" label={row.to} plain dimColor={scene.picked === null} onPress={() => band.onAuto()} />}
          {row.gauge !== '' && <Button key="usage" label={row.gauge} plain dimColor onPress={() => band.onUsage()} />}
        </Box>
      </Box>
      {latest !== undefined && isComic && Cut(kit, scene.lang, latest, Math.min(columns, 84), false, isAtWork(scene, latest.member), 'cut')}
      {latest !== undefined && !isComic && rows >= 2 && TalkRow(kit, scene.lang, latest, columns, 'said')}
    </Box>
  )
}

// ---- the pane: the three the comic is about, a card for each guest at work, the rest on the bench

/** What a press in the pane asks for. */
export type PaneActs = {
  onWatch: OnWatch
  /** The character whose sheet is open is to take the person's next prompt, or no longer to. */
  onPick: (id: MemberId) => void
  /** The usage is to be shown in full, or put back to its one line. */
  onUsage: () => void
  /** The conversation is to be turned so many lines back from the last; 0 for the last ones. */
  onTalk: (back: number) => void
  /** The conversation is to be shown alone, or the whole page again. */
  onStory: () => void
  /** A character is given a role; its own role gives it back what it had. */
  onRole: (id: MemberId, role: WorkRole) => void
}

type Card = {
  id: MemberId
  name: string
  sub: string
  status: string
  tint: Color | undefined
  isIdle: boolean
  /** At work this moment: its mark turns and its picture moves. */
  isRunning: boolean
  /** Its task has ended. */
  isEnded: boolean
  work: string
  /** The task's name alone, where the card is about one. */
  title?: string
  quote: string
  note: string
  /** What it is on now, or what it handed back. */
  last: string
}

/** The day so far, for 하치와레's card: the tasks that ended well, and the ones that failed; nothing before any has ended. */
const tally = (scene: Scene): { done: number; failed: number } | undefined => {
  const ended = scene.tasks.filter(task => !isActive(task))
  const failed = ended.filter(task => task.status === 'failed').length

  return ended.length === 0 ? undefined : { done: ended.length - failed, failed }
}

/** A character's tasks, the newest first. */
const tasksOf = (scene: Scene, id: MemberId): Task[] => scene.tasks.filter(task => task.member === id).sort((a, b) => b.startedAt - a.startedAt)

/** The engine a task runs on: an Orca worker's profile is told as one; a demonstration, which is due at a set time, has only its own word. */
const engineOf = (task: Task): string => (task.kind === 'orca' && task.due === undefined ? `Orca ${task.engine}` : task.engine)

const doingOf = (words: Words, task: Task): string => {
  const on = task.detail === undefined || task.detail === '' ? '' : ` ${task.detail}`

  return task.tool === undefined ? '' : `▸ ${task.tool}${on} · ${words.tools(task.toolCount)}`
}

const cardOf = (id: MemberId, scene: Scene): Card => {
  const words = wordsOf(scene)
  const cast = CAST[scene.lang]
  const name = cast.names[id]
  const sub = [cast.kinds[id], cast.titles[id], cast.job[roleOf(id, scene.roles)]].filter(part => part !== '').join(' · ')
  const idle = `○ ${words.idle}`

  if (id === LEAD || id === 'rodo') {
    const busy = busyOf(scene)
    const said = lastSaid(scene, id)
    const doing = id === LEAD ? words.leading : words.receiving
    const day = tally(scene)
    // With no friend called in, 하치와레 is at the work himself, the other two lending a hand.
    const own = id === LEAD && busy.length === 0 ? aidOf(scene, LEAD) : undefined
    const hands = CORE.filter(one => one !== LEAD && aidOf(scene, one) !== undefined)
    const isAlone = busy.length === 0 && own === undefined

    return {
      id,
      name,
      sub,
      status: isAlone ? idle : `${MARK.running} ${own === undefined ? doing : hands.length === 0 ? words.alone : words.together}`,
      tint: undefined,
      isIdle: isAlone,
      isRunning: !isAlone,
      isEnded: false,
      work: own !== undefined ? own.what : busy.length === 0 ? words.awaiting : words.atWork(busy.map(one => cast.names[one])),
      // In a cut: how many have the work, or whose hand he has; the sheet has the rest.
      ...(id !== LEAD ? {} : busy.length > 0 ? { title: words.handed(busy.length) } : own !== undefined ? { title: own.brief ?? own.what.split(' · ')[0] ?? own.what } : {}),
      quote: said?.quote ?? say(scene.lang, id, 'idle', 0),
      note: said?.note ?? '',
      last: id === LEAD && day !== undefined ? words.tally(day.done, day.failed) : '',
    }
  }

  const own = tasksOf(scene, id)
  const task = own.find(isActive) ?? own[0]
  const aid = aidOf(scene, id)

  if (aid !== undefined && (task === undefined || !isActive(task))) {
    const said = lastSaid(scene, id)

    return { id, name, sub, status: `${MARK.running} ${words.helping}`, tint: undefined, isIdle: false, isRunning: true, isEnded: false, work: aid.what, quote: said?.quote ?? say(scene.lang, id, 'start', 0), note: said?.note ?? '', last: '' }
  }
  if (task === undefined) {
    return { id, name, sub, status: idle, tint: undefined, isIdle: true, isRunning: false, isEnded: false, work: jobOf(scene.lang, id, scene.roles), quote: say(scene.lang, id, 'idle', 0), note: '', last: '' }
  }

  const active = own.filter(isActive).length
  const more = active > 1 ? ` ${words.more(active - 1)}` : ''
  const back = task.report === undefined ? '' : `↳ ${task.report}`

  return {
    id,
    name,
    sub,
    status: `${MARK[task.status]} ${words.status[task.status]} ${clock(elapsed(task, scene.now))}`,
    tint: TINT[task.status],
    isIdle: false,
    isRunning: task.status === 'running',
    isEnded: !isActive(task),
    work: `${task.title}${more} · ${engineOf(task)}`,
    title: `${task.title}${more}`,
    quote: task.quote,
    note: task.note,
    last: isActive(task) ? doingOf(words, task) : back,
  }
}

/** A card's state as drawn: the mark of one at work turns. */
const statusOf = (kit: Kit, card: Card): string => (card.isRunning ? card.status.replace(MARK.running, spin(kit)) : card.status)

/** A card's state in its color. */
const State = (kit: Kit, card: Card): RenderElement => (
  <kit.Text color={card.tint} bold={!card.isIdle} dimColor={card.isIdle}>
    {statusOf(kit, card)}
  </kit.Text>
)

/**
 * A character's name as the thing to press: the pane then shows what that
 * character is doing. It lights up in the character's colors while its card
 * is under the pointer.
 */
const Name = (kit: Kit, id: MemberId, onWatch: OnWatch, label: string, isDim = false): RenderElement => (
  <kit.Button key={`watch-${id}`} label={label} plain dimColor={isDim} hover={lit(id)} onPress={() => onWatch(id)} />
)

/** A card's first row: the name to press, short where the whole of it would push the state past the edge, and its state at the right edge. */
const Head = (kit: Kit, lang: Lang, card: Card, width: number, onWatch: OnWatch): RenderElement => (
  <kit.Box justifyContent="space-between" width={width}>
    <kit.Box>
      {Dot(kit, card.id)}
      {Name(kit, card.id, onWatch, nameIn(lang, card.id, width - 3 - cells(card.status)))}
    </kit.Box>
    {State(kit, card)}
  </kit.Box>
)

/** Two rows a character behind a bar of its color: for a pane a few rows tall. */
const SlimCard = (kit: Kit, lang: Lang, card: Card, width: number, onWatch: OnWatch): RenderElement => {
  const { Box, Text } = kit
  const line = lineOf(kit, card.id)
  const quote = fit(shown(card.quote), Math.min(24, Math.floor(width / 2)))

  return (
    <Box key={card.id} flexDirection="column" width={width}>
      <Box width={width}>
        <Text color={line}>▌</Text>
        {Head(kit, lang, card, width - 1, onWatch)}
      </Box>
      <Text wrap="truncate-end">
        <Text color={line}>▌</Text>
        <Text dimColor={card.isIdle}>{`  ${fit(card.work, width - 4 - cells(quote))} `}</Text>
        <Text color={line} italic={!isGesture(card.quote)}>
          {quote}
        </Text>
      </Text>
    </Box>
  )
}

/** A row with what it holds set in its middle by hand: a Button takes the start of the row it is given. */
const Middle = (kit: Kit, width: number, used: number, held: RenderElement): RenderElement => {
  const lead = Math.max(0, Math.floor((width - used) / 2))

  return (
    <kit.Box width={width}>
      {lead > 0 && <kit.Text>{' '.repeat(lead)}</kit.Text>}
      {held}
    </kit.Box>
  )
}

/** Rows a cut holds inside its frame: the icon, the name, its state, and what it is on. */
const PANEL_ROWS = ICON_ROWS + 3

/**
 * A character on the page, as a cut of its own: the icon over the name to
 * press, its state, and one line of what it is on, handed back or last said.
 * The frame takes the character's color while it is at work; who it is and
 * the rest of what it is doing are on its sheet.
 */
const Panel = (kit: Kit, lang: Lang, card: Card, width: number, onWatch: OnWatch): RenderElement => {
  const { Box, Text } = kit
  const inner = width - 4
  const line = lineOf(kit, card.id)
  const name = nameIn(lang, card.id, inner)
  // With nothing in hand and nothing handed back, the cut shows what the character last said.
  const isTold = card.isIdle || (card.isEnded && card.last === '')
  const about = isTold ? shown(card.quote) : card.isEnded ? card.last : (card.title ?? card.work)

  return (
    <Box key={card.id} borderStyle="round" borderColor={card.isIdle ? 'subtle' : line} paddingX={1} flexDirection="column" alignItems="center" width={width}>
      {Icon(kit, card.id, card.isRunning)}
      {Middle(kit, inner, cells(name), Name(kit, card.id, onWatch, name))}
      <Text color={card.tint} bold={!card.isIdle} dimColor={card.isIdle} wrap="truncate-end">
        {fit(statusOf(kit, card), inner)}
      </Text>
      <Text color={isTold ? line : undefined} italic={isTold && !isGesture(card.quote)} wrap="truncate-end">
        {fit(about, inner)}
      </Text>
    </Box>
  )
}

/** Cuts to a row: the three the comic is about fill one. */
const ACROSS = CORE.length

/** Characters as rows of cuts, three across; a row with fewer has them in its middle. */
const Panels = (kit: Kit, scene: Scene, ids: readonly MemberId[], width: number, onWatch: OnWatch): RenderElement[] => {
  const each = Math.floor(width / ACROSS)
  const rows: MemberId[][] = []

  for (let at = 0; at < ids.length; at += ACROSS) rows.push(ids.slice(at, at + ACROSS))

  return rows.map((row, index) => (
    <kit.Box key={`cuts-${row[0] ?? index}`} justifyContent="center" width={width}>
      {row.map(id => Panel(kit, scene.lang, cardOf(id, scene), each, onWatch))}
    </kit.Box>
  ))
}

/** What the rule over the conversation is written with: its label, the ways back and on, and the way to the conversation alone. */
type TalkWords = readonly [label: string, older: string, newer: string, story: string]

/**
 * The rule over the conversation. Where more was said than the page holds,
 * it has the way back through it at its end: the lines before these, the
 * lines after, and which of them are shown while it is turned back. Last is
 * the way to the conversation alone, and from there back to the whole page.
 * Short of room it is written with fewer words, so that it stays one row.
 */
const TalkRule = (kit: Kit, scene: Scene, count: number, width: number, { onTalk, onStory }: Pick<PaneActs, 'onTalk' | 'onStory'>): RenderElement => {
  const { Box, Text, Button } = kit
  const { from, to } = shownOf(scene, count)
  const total = scene.feed.length
  const back = total - to
  const size = Math.max(1, count)
  const range = `${from + 1}~${to}/${total}`
  // The page of the conversation alone, and the way back from it to the whole page.
  const words = wordsOf(scene)
  const tries: readonly TalkWords[] = [
    [back > 0 ? words.earlier(range) : words.talk, words.older, words.newer, scene.isTalkOnly ? words.all : words.only],
    [back > 0 ? range : words.talk, '▲', '▼', scene.isTalkOnly ? words.all : words.only],
    [back > 0 ? range : words.talk, '▲', '▼', scene.isTalkOnly ? words.allShort : words.talk],
  ]
  const usedBy = ([, older, newer, story]: TalkWords): number => (from > 0 ? cells(older) + 2 : 0) + (back > 0 ? cells(newer) + 2 : 0) + cells(story) + 2
  const [label, older, newer, story] = tries.find(one => cells(one[0]) + 2 + usedBy(one) <= width) ?? tries[tries.length - 1] ?? ['', '', '', '']

  return (
    <Box width={width}>
      {Rule(kit, label, width - usedBy([label, older, newer, story]))}
      {from > 0 && <Text>{'  '}</Text>}
      {from > 0 && <Button key="talk-older" label={older} plain onPress={() => onTalk(Math.min(total - 1, back + size))} />}
      {back > 0 && <Text>{'  '}</Text>}
      {back > 0 && <Button key="talk-newer" label={newer} plain onPress={() => onTalk(Math.max(0, back - size))} />}
      <Text>{'  '}</Text>
      <Button key="talk-only" label={story} plain dimColor={!scene.isTalkOnly} onPress={() => onStory()} />
    </Box>
  )
}

/** A dim rule across the page with a label in its middle, the label cut to what the rule holds. */
const Rule = (kit: Kit, label: string, width: number): RenderElement => {
  const text = fit(label, width - 2)
  const side = Math.max(0, width - cells(text) - 2)
  const middle = text === '' ? '─'.repeat(Math.min(2, Math.max(0, width))) : ` ${text} `

  return <kit.Text dimColor>{`${'─'.repeat(Math.floor(side / 2))}${middle}${'─'.repeat(side - Math.floor(side / 2))}`}</kit.Text>
}

// ---- the sheet: what one character is doing, for the one who pressed its name

type SheetRow = { label: string; text: string; tint?: Color; isPath?: boolean }
type Sheet = { id: MemberId; rows: SheetRow[]; canPick: boolean }

/** Tasks in hand a sheet tells one by one before it counts the rest. */
const LISTED = 3
const LABEL = 8

/** One task in hand: its name, the engine and how long it has run, the tool in its hand, why it waits, where its result goes. */
const taskRows = (words: Words, task: Task, now: number, label: string): SheetRow[] => {
  const tint = TINT[task.status]
  const rows: SheetRow[] = [
    { label, text: `${MARK[task.status]} ${task.title}`, ...(tint === undefined ? {} : { tint }) },
    { label: '', text: `  ${engineOf(task)} · ${words.status[task.status]} ${clock(elapsed(task, now))}` },
  ]
  const doing = doingOf(words, task)

  if (doing !== '') rows.push({ label: '', text: `  ${doing}` })
  if (task.status === 'waiting' && task.note !== '') rows.push({ label: '', text: `  ${task.note}` })
  if (task.out !== undefined) rows.push({ label: words.labels.result, text: task.out, isPath: true })

  return rows
}

const saidRows = (scene: Scene, id: MemberId): SheetRow[] =>
  scene.feed
    .filter(one => one.member === id)
    .slice(-2)
    .map((one, index) => ({ label: index === 0 ? wordsOf(scene).labels.said : '', text: `${shown(one.quote)}${one.note === '' ? '' : ` ${one.note}`}` }))

/** The sheet of the character the person asked about; none where they asked about no one. */
const sheetOf = (scene: Scene): Sheet | undefined => {
  const id = scene.watched

  if (id === null) return undefined
  const words = wordsOf(scene)
  const { labels } = words
  const cost = spentBy(scene)[id]
  const paid: SheetRow[] = isSpent(cost) ? [{ label: labels.pay, text: spent(scene.lang, cost) }] : []

  if (id === 'rodo') return { id, rows: [{ label: labels.now, text: words.bell }, ...saidRows(scene, id)], canPick: false }
  if (id === LEAD) {
    const active = scene.tasks.filter(isActive).sort((a, b) => a.startedAt - b.startedAt)
    const day = tally(scene)
    const own = aidOf(scene, LEAD)
    const rows: SheetRow[] = [{ label: labels.now, text: active.length > 0 ? words.conducting(active.length) : own === undefined ? words.awaiting : `${MARK.running} ${words.alone} · ${own.what}` }]

    for (const task of active.slice(0, LISTED * 2)) {
      const tint = TINT[task.status]

      rows.push({ label: '', text: `${MARK[task.status]} ${nameOf(scene, task.member)}: ${task.title} · ${words.status[task.status]} ${clock(elapsed(task, scene.now))}`, ...(tint === undefined ? {} : { tint }) })
    }
    if (active.length > LISTED * 2) rows.push({ label: '', text: words.more(active.length - LISTED * 2) })
    if (day !== undefined) rows.push({ label: labels.today, text: words.today(day.done, day.failed) })

    return { id, rows: [...rows, ...paid, ...saidRows(scene, id)], canPick: true }
  }

  const own = tasksOf(scene, id)
  const active = own.filter(isActive)
  const ended = own.find(task => !isActive(task))
  const aid = aidOf(scene, id)
  const resting: SheetRow = aid === undefined ? { label: labels.now, text: `${words.rest} · ${jobOf(scene.lang, id, scene.roles)}` } : { label: labels.now, text: `${MARK.running} ${words.aidingLead} · ${aid.what}` }
  const rows: SheetRow[] = active.length === 0 ? [resting] : active.slice(0, LISTED).flatMap((task, index) => taskRows(words, task, scene.now, index === 0 ? labels.now : ''))

  if (active.length > LISTED) rows.push({ label: '', text: words.more(active.length - LISTED) })
  if (ended !== undefined) {
    const tint = TINT[ended.status]
    const told = ended.summary ?? (ended.report === undefined ? [] : [ended.report])

    rows.push({ label: labels.ended, text: `${MARK[ended.status]} ${ended.title} · ${words.spoken(elapsed(ended, scene.now))}`, ...(tint === undefined ? {} : { tint }) })
    rows.push(...told.map((line, index) => ({ label: index === 0 ? labels.report : '', text: line })))
  }

  return { id, rows: [...rows, ...paid, ...saidRows(scene, id)], canPick: true }
}

/** Only one who takes tasks has a role the person can change. */
const hasRole = (id: MemberId): boolean => WORKERS.includes(id)

/** A role to give, as its button is labeled. */
type RoleButton = { role: WorkRole; label: string }

/** Rows of the roles a sheet may be given where it is as narrow as a pane gets: a role to a row. */
const ROLE_ROWS = WORK_ROLES.length
/** The cells the roles to give take in a row, as a language names them: each with its mark, and a cell between two. */
const roleCells = (lang: Lang): number => WORK_ROLES.reduce((sum, one) => sum + cells(CAST[lang].roles[one]) + 2, -1)

/**
 * The roles to give, as rows of buttons in a width, `most` rows at the most.
 * Each is named whole where the rows are there for it, as many to a row as go
 * in. With fewer rows, the names are cut to share those; a width the cut
 * names cannot be told apart in has no buttons, for a button that may give
 * either of two roles is worse than none.
 */
const roleRowsOf = (lang: Lang, width: number, most: number): RoleButton[][] => {
  const whole = WORK_ROLES.map(role => ({ role, label: CAST[lang].roles[role] }))
  const flowed: RoleButton[][] = []
  let used = 0

  if (most <= 0) return []
  for (const one of whole) {
    const wanted = cells(one.label) + 1
    const last = flowed[flowed.length - 1]

    if (last !== undefined && used + 1 + wanted <= width) {
      last.push(one)
      used += 1 + wanted
    } else {
      flowed.push([one])
      used = wanted
    }
  }
  if (flowed.length <= most && whole.every(one => cells(one.label) + 1 <= width)) return flowed
  const each = Math.ceil(whole.length / most)
  const room = Math.floor((width - (each - 1)) / each) - 1
  const cut = whole.map(one => ({ ...one, label: clip(one.label, room) }))

  if (cut.some(one => one.label === '') || new Set(cut.map(one => one.label)).size < cut.length) return []

  return Array.from({ length: Math.ceil(cut.length / each) }, (_, row) => cut.slice(row * each, (row + 1) * each))
}

/** Rows a sheet's buttons take under its head, in a width: the one that hands the character the next prompt, and the roles. */
const controlRows = (sheet: Sheet, lang: Lang, width: number): number =>
  Number(sheet.canPick) + (hasRole(sheet.id) ? roleRowsOf(lang, width - 4, ROLE_ROWS).length : 0)

/** Rows a sheet takes in a width, frame and all. */
const sheetRows = (sheet: Sheet | undefined, lang: Lang, width: number): number => (sheet === undefined ? 0 : sheet.rows.length + 3 + controlRows(sheet, lang, width))

/**
 * The sheet, framed in the character's color: who and in what state, the
 * rows, the roles to give the character with the one it has marked, a button
 * that hands the character the person's next prompt, and one that puts the
 * sheet away. Given fewer rows than it would take, it draws no more than
 * those, and keeps what can be pressed the longest: the rows go first, from
 * the last up, then the roles, cut short before they are left out, then the
 * button, down to the head alone in its frame, with the way to put it away.
 */
const SheetCard = (kit: Kit, scene: Scene, sheet: Sheet, width: number, acts: PaneActs, rows = sheetRows(sheet, scene.lang, width)): RenderElement => {
  const { Box, Text, Button } = kit
  const inner = width - 4
  const words = wordsOf(scene)
  const labels = CAST[scene.lang].roles
  const card = cardOf(sheet.id, scene)
  // The head keeps the way to put the sheet away: the name is cut to what that leaves, and the state and what follows it are there with room.
  const name = nameIn(scene.lang, sheet.id, Math.max(1, inner - cells(words.close) - 3))
  const stateRoom = inner - (cells(name) + 2) - 1 - cells(words.close) - 1
  const hasState = cells(statusOf(kit, card)) <= stateRoom
  const subRoom = stateRoom - cells(statusOf(kit, card)) - 1
  const isPicked = scene.picked === sheet.id
  const ask = sheet.id === LEAD ? words.askLead : words.askFriend
  const role = roleOf(sheet.id, scene.roles)
  const own = words.ownRole(labels[MEMBERS[sheet.id].role])
  const across = roleCells(scene.lang)
  const spare = rows - 3
  const canPick = sheet.canPick && spare >= 1
  const roleRows = hasRole(sheet.id) ? roleRowsOf(scene.lang, inner, spare - Number(canPick)) : []
  // With room beside the roles in their one row, what the row is and the role the character has of its own are told.
  const hasRoleLabel = roleRows.length === 1 && inner >= LABEL + across
  const roleRoom = inner - LABEL - across - 1

  return (
    <Box key="sheet" borderStyle="round" borderColor={lineOf(kit, sheet.id)} paddingX={1} flexDirection="column" width={width}>
      <Box justifyContent="space-between" width={inner}>
        <Box gap={1}>
          {Badge(kit, sheet.id, name)}
          {hasState && State(kit, card)}
          {subRoom >= 4 && <Text dimColor>{fit(card.sub, subRoom)}</Text>}
        </Box>
        <Button key="watch-close" label={words.close} plain dimColor onPress={() => acts.onWatch(null)} />
      </Box>
      {sheet.rows.slice(0, Math.max(0, spare - Number(canPick) - roleRows.length)).map((row, index) => (
        <Text key={`sheet-${index}`} wrap="truncate-end">
          <Text dimColor>{pad(row.label, LABEL)}</Text>
          <Text color={row.tint}>{row.isPath === true ? fitEnd(row.text, inner - LABEL) : fit(row.text, inner - LABEL)}</Text>
        </Text>
      ))}
      {roleRows.map((row, index) => (
        <Box key={`roles-${index}`} gap={1}>
          {hasRoleLabel && <Text dimColor>{pad(words.labels.role, LABEL - 1)}</Text>}
          {row.map(one => (
            <Button key={`role-${sheet.id}-${one.role}`} label={`${one.role === role ? '▶' : '▷'}${one.label}`} plain dimColor={one.role !== role} onPress={() => acts.onRole(sheet.id, one.role)} />
          ))}
          {hasRoleLabel && role !== MEMBERS[sheet.id].role && roleRoom >= cells(own) + 1 && <Text dimColor>{own}</Text>}
        </Box>
      ))}
      {canPick && (
        <Box>
          <Button key={`pick-${sheet.id}`} label={fit(isPicked ? words.picked : ask, inner)} plain dimColor={!isPicked} onPress={() => acts.onPick(sheet.id)} />
        </Box>
      )}
    </Box>
  )
}

/** Ones with no card, named together in a row under what they are doing. */
type Group = { label: string; ids: readonly MemberId[]; isAtWork: boolean }
/** A group as a row has room for it: its label with what parts it from the group before, the ones named, and how many are not. */
type Named = { head: string; shown: MemberId[]; more: number; isAtWork: boolean }

/** The cells a count of the ones not named is kept room for. */
const MORE_CELLS = 4

/** The groups of the ones with no card that have anyone in them: the ones at work first. */
const groupsOf = (scene: Pick<Scene, 'lang'>, hidden: readonly MemberId[], bench: readonly MemberId[]): Group[] =>
  [
    { label: wordsOf(scene).atWorkLabel, ids: hidden, isAtWork: true },
    { label: wordsOf(scene).rest, ids: bench, isAtWork: false },
  ].filter(group => group.ids.length > 0)

/** One group in the cells it is given: its label, the names that go in with room kept for a count, and the count of the rest. With no room for the label, the count alone. */
const groupIn = (lang: Lang, { label, ids, isAtWork }: Group, lead: string, width: number): Named => {
  const head = `${lead}${label} `
  const shown: MemberId[] = []
  let used = cells(head)

  if (used > width - MORE_CELLS + 1) return { head: '', shown, more: ids.length, isAtWork }
  for (const [index, id] of ids.entries()) {
    const wanted = cells(shortName(lang, id)) + (index === 0 ? 0 : 3)

    if (used + wanted > width - MORE_CELLS) break
    shown.push(id)
    used += wanted
  }

  return { head, shown, more: ids.length - shown.length, isAtWork }
}

/** The count of the ones a group does not name, parted from the last name before it. */
const moreOf = ({ head, shown, more }: Named): string => (more === 0 ? '' : `${head !== '' && shown.length === 0 ? '' : ' '}+${more}`)

/** The cells a group as a row has room for it takes. */
const namedCells = (lang: Lang, named: Named): number =>
  cells(named.head) + named.shown.reduce((sum, id, index) => sum + cells(shortName(lang, id)) + (index === 0 ? 0 : 3), 0) + cells(moreOf(named))

/**
 * The ones with no card as one row of names, the ones at work told apart from
 * the ones resting. Both labels and a count for each are given their room
 * before any name is, so that the ones at work never push the ones resting
 * off the row unsaid. A row with no room for both labels has the first alone,
 * and counts the rest with its own.
 */
const namedIn = (scene: Pick<Scene, 'lang'>, groups: readonly Group[], width: number): Named[] => {
  const [first, second] = groups
  const least = (group: Group): number => cells(group.label) + MORE_CELLS

  if (first === undefined) return []
  if (second === undefined) return [groupIn(scene.lang, first, '', width)]
  if (least(first) + 2 + least(second) > width) {
    const alone = groupIn(scene.lang, first, '', width)

    return [{ ...alone, more: alone.more + second.ids.length }]
  }
  const named = groupIn(scene.lang, first, '', width - 2 - least(second))

  return [named, groupIn(scene.lang, second, '  ', width - namedCells(scene.lang, named))]
}

export type Density = 'full' | 'slim'

const SLIM_ROWS = 2
const SEAT_ROWS = ICON_ROWS + 1
/** The fewest rows a page of cuts is drawn in: the title, the three, and one cut of the conversation. */
const FULL_ROWS = 1 + PANEL_ROWS + 2 + 1 + ART_ROWS + 3

/** How long a guest keeps its cut after its work ended, before it goes back to the bench. */
const CARD_LINGER_MS = 30_000

/** The characters on the page: the three the comic is about, then each guest with work in hand or only just ended. */
export const carded = (scene: Scene): MemberId[] => {
  const held = new Set(scene.tasks.filter(task => isRunning(task) || (task.endedAt !== undefined && scene.now - task.endedAt < CARD_LINGER_MS)).map(task => task.member))

  return [...CORE, ...GUESTS.filter(id => held.has(id))]
}

export type Plan = {
  density: Density
  /** On the page, in the order they are drawn: the three, then the guests with work. */
  cards: MemberId[]
  /** At work, with no card for want of room. */
  hidden: MemberId[]
  /** With no work in hand: waiting as characters. */
  bench: MemberId[]
  /** Seats to a row where the bench is drawn as icons; 0 where it is a line of names. */
  strip: number
  /** Cuts of the conversation on a page of cuts, lines of it in a list; 0 where there is no room. */
  talk: number
  /** Of the rows under the cards (the bench, the usage, the help, kept in that order), how many there is room for. */
  extras: number
  /** Whether the person asked about a character: its sheet is drawn. */
  hasSheet: boolean
  /** Whether the sheet is all there is room for besides the title. */
  isSheetOnly: boolean
  /** Whether the ones at work with no card and the ones resting have a row of names each: one row does not name them all, and there is a row to spare. */
  isBenchSplit: boolean
}

/**
 * The layout the room holds. A page of cuts where it is wide and tall enough
 * for the three and one cut of the conversation. The conversation has its
 * last three lines; the rows left go to the bench's icons, then to more of
 * the conversation, and a page too long for its pane scrolls. A list, two
 * rows a character, where it is not.
 */
export const planOf = (scene: Scene, room: Room): Plan => {
  const all = carded(scene)
  const busy = new Set(busyOf(scene))
  const sheet = sheetOf(scene)
  const asked = sheetRows(sheet, scene.lang, room.columns)

  // The conversation alone: every row under the title and the rule is its own, a cut each where the pane is wide and has the rows for one, a line each where it is not.
  if (scene.isTalkOnly) {
    const isWide = room.columns >= 50 && room.rows - 2 >= ART_ROWS
    const talk = Math.max(1, isWide ? Math.floor((room.rows - 2) / ART_ROWS) : room.rows - 2)

    return { density: isWide ? 'full' : 'slim', cards: [], hidden: [], bench: ORDER.filter(id => !CORE.includes(id)), strip: 0, talk, extras: 0, hasSheet: false, isSheetOnly: false, isBenchSplit: false }
  }

  if (room.columns >= 50 && room.rows >= FULL_ROWS) {
    const guests = all.length - CORE.length
    const bench = ORDER.filter(id => !all.includes(id))
    const guestRows = guests === 0 ? 0 : 1 + Math.ceil(guests / ACROSS) * (PANEL_ROWS + 2)
    const usage = scene.isUsageOpen ? usageRows(scene) : 1
    const base = Math.max(1, Math.min(MIN_CUTS, scene.feed.length))
    let left = room.rows - (1 + PANEL_ROWS + 2 + asked + guestRows + 1 + base * ART_ROWS + 1 + usage + 1)
    const widest = Math.max(1, Math.floor((room.columns + 1) / (ICON_COLUMNS + 1)))
    const seatRows = Math.ceil(bench.length / widest)
    // The seats are shared out evenly: seven sit four and three, not six and one.
    const strip = bench.length > 0 && left >= seatRows * SEAT_ROWS ? Math.ceil(bench.length / seatRows) : 0

    if (strip > 0) left -= seatRows * SEAT_ROWS
    const talk = base + Math.max(0, Math.min(MAX_CUTS - base, Math.floor(left / ART_ROWS), scene.feed.length - base))

    return { density: 'full', cards: all, hidden: [], bench, strip, talk, extras: 3, hasSheet: sheet !== undefined, isSheetOnly: false, isBenchSplit: false }
  }

  const around = 1 + asked + 3
  const held = Math.max(1, Math.min(all.length, Math.floor((room.rows - around) / SLIM_ROWS)))
  // Where not everyone fits: 하치와레, then the ones at work, then the other two of the three, then the ones who have finished.
  const rank = (id: MemberId): number => (id === LEAD ? 0 : busy.has(id) ? 1 : CORE.includes(id) ? 2 : 3)
  const chosen = new Set([...all].sort((a, b) => rank(a) - rank(b)).slice(0, held))
  const cards = all.filter(id => chosen.has(id))
  const hidden = all.filter(id => !chosen.has(id) && busy.has(id))
  const bench = ORDER.filter(id => !chosen.has(id) && !hidden.includes(id))
  const left = room.rows - around - cards.length * SLIM_ROWS
  const talk = left >= 3 ? Math.min(3, left) : 0
  const extras = Math.max(0, Math.min(3, room.rows - 1 - asked - cards.length * SLIM_ROWS))
  // With no room for a card beside it, the sheet is what the person asked for.
  const isSheetOnly = sheet !== undefined && room.rows - around < SLIM_ROWS
  const isBenchSplit = left >= 1 && talk === 0 && hidden.length > 0 && bench.length > 0 && namedIn(scene, groupsOf(scene, hidden, bench), room.columns).some(group => group.more > 0)

  return { density: 'slim', cards, hidden, bench, strip: 0, talk, extras, hasSheet: sheet !== undefined, isSheetOnly, isBenchSplit }
}

/** The ones with no card in a row of names, in its groups: the ones at work, and the ones resting. */
const NameRow = (kit: Kit, scene: Scene, groups: readonly Group[], width: number, onWatch: OnWatch, key: string): RenderElement => {
  const { Box, Text } = kit

  return (
    <Box key={key} width={width}>
      {namedIn(scene, groups, width).flatMap(named => [
        named.head !== '' && (
          <Text key={`label-${named.head}`} bold={named.isAtWork} dimColor={!named.isAtWork}>
            {named.head}
          </Text>
        ),
        ...named.shown.flatMap((id, index) => [
          index > 0 && (
            <Text key={`dot-${id}`} dimColor>
              {' · '}
            </Text>
          ),
          <Box key={id}>{Name(kit, id, onWatch, shortName(scene.lang, id), !named.isAtWork)}</Box>,
        ]),
        named.more > 0 && (
          <Text key={`more-${named.head}`} dimColor>
            {moreOf(named)}
          </Text>
        ),
      ])}
    </Box>
  )
}

/**
 * The ones with no card, waiting as characters. Where there is room, rows of
 * seats under a rule, shared out evenly and centered, each an icon over its
 * name to press, one whose work in this wave has ended marked so; where not,
 * a line of names, or one for the ones at work and one for the ones resting.
 */
const Bench = (kit: Kit, scene: Scene, plan: Plan, width: number, onWatch: OnWatch): RenderElement => {
  const { Box } = kit
  const groups = groupsOf(scene, plan.hidden, plan.bench)

  if (plan.strip === 0 && plan.isBenchSplit) {
    return (
      <Box flexDirection="column" width={width}>
        {groups.map((group, index) => NameRow(kit, scene, [group], width, onWatch, `names-${index}`))}
      </Box>
    )
  }
  if (plan.strip === 0) return NameRow(kit, scene, groups, width, onWatch, 'names')
  const each = Math.floor(width / plan.strip)
  const rows: MemberId[][] = []
  const stage = onStage(scene)
  const named = (id: MemberId): string => {
    const ended = stage.find(task => task.member === id)
    const name = nameIn(scene.lang, id, each - 4, each - (ended === undefined ? 1 : 3))

    return ended === undefined ? name : `${name} ${MARK[ended.status]}`
  }

  for (let at = 0; at < plan.bench.length; at += plan.strip) rows.push(plan.bench.slice(at, at + plan.strip))

  return (
    <Box flexDirection="column" width={width}>
      {Rule(kit, wordsOf(scene).bench, width)}
      {rows.map((row, index) => (
        <Box key={`bench-${index}`} justifyContent="center" width={width}>
          {row.map(id => (
            <Box key={id} flexDirection="column" alignItems="center" width={each}>
              {Icon(kit, id)}
              {Middle(kit, each, cells(named(id)), Name(kit, id, onWatch, named(id), true))}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

/** The usage in one line to press: the card is drawn in its place. */
const UsageLine = (kit: Kit, scene: Scene, width: number, onUsage: () => void): RenderElement => {
  const meters = metersOf(scene)
  const label = meters.length === 0 ? wordsOf(scene).seeUsage : meters.map(meter => `${meter.label} ${Math.round(meter.percent)}%`).join(' · ')

  return (
    <kit.Box width={width}>
      <kit.Button key="usage-more" label={fit(label, width)} plain dimColor onPress={() => onUsage()} />
    </kit.Box>
  )
}

/**
 * The pane, laid out as a page of the comic: the three it is about in a row
 * of cuts, the sheet of the character the person asked about, the guests at
 * work in cuts of the same shape, the last of the conversation as balloons,
 * the ones resting as characters, and the usage in a line.
 */
export const drawPane = (kit: Kit, scene: Scene, isOn: boolean, room: Room, acts: PaneActs): RenderElement => {
  const { Box, Text } = kit
  const width = Math.max(16, Math.min(room.columns, 84))
  const plan = planOf(scene, { columns: width, rows: room.rows })
  const busy = busyOf(scene)
  const isTrioAtWork = CORE.some(id => aidOf(scene, id) !== undefined)
  const waiting = waitingOf(scene).length
  const words = wordsOf(scene)
  const head = busy.length > 0 ? words.busy(busy.length) : isTrioAtWork ? words.trio : waiting > 0 ? words.waiting(waiting) : words.rest
  const sheet = plan.hasSheet ? sheetOf(scene) : undefined
  const isFull = plan.density === 'full'
  const guests = plan.cards.filter(id => !CORE.includes(id))
  const title = (
    <Box justifyContent="space-between" width={width}>
      <Text wrap="truncate-end">
        <Text backgroundColor={PINK} color="#000000" bold>
          {` ${words.brand} `}
        </Text>
        <Text bold>{` ${head}`}</Text>
      </Text>
      <Text color={isOn ? toneOf(PINK, kit.isLight) : undefined} dimColor={!isOn}>
        {isOn ? words.on : words.off}
      </Text>
    </Box>
  )

  if (scene.isTalkOnly) {
    const { from, to } = shownOf(scene, plan.talk)

    return (
      <Box flexDirection="column" width={width}>
        {title}
        {TalkRule(kit, scene, plan.talk, width, acts)}
        {isFull ? Page(kit, scene, width, plan.talk) : (scene.feed.length === 0 ? [waitingSaid(scene)] : scene.feed.slice(from, to)).map((one, index) => TalkRow(kit, scene.lang, one, width, `said-${one.at}-${index}`))}
      </Box>
    )
  }

  // With room for little else, the answer to what the person asked comes first, and before the title where the rows are short: the title is there once the sheet has its buttons and a row to tell under it.
  if (plan.isSheetOnly && sheet !== undefined) {
    const hasTitle = room.rows - 1 >= 3 + controlRows(sheet, scene.lang, width) + Math.min(1, sheet.rows.length)

    return (
      <Box flexDirection="column" width={width}>
        {hasTitle && title}
        {SheetCard(kit, scene, sheet, width, acts, room.rows - Number(hasTitle))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={width}>
      {title}
      {isFull && Panels(kit, scene, CORE, width, acts.onWatch)}
      {sheet !== undefined && SheetCard(kit, scene, sheet, width, acts)}
      {isFull && guests.length > 0 && Rule(kit, words.workers, width)}
      {isFull && Panels(kit, scene, guests, width, acts.onWatch)}
      {isFull && TalkRule(kit, scene, plan.talk, width, acts)}
      {plan.talk > 0 && (isFull ? Page(kit, scene, width, plan.talk) : Talk(kit, scene, width, plan.talk, false))}
      {!isFull && plan.cards.map(id => SlimCard(kit, scene.lang, cardOf(id, scene), width, acts.onWatch))}
      {plan.extras >= 1 && Bench(kit, scene, plan, width, acts.onWatch)}
      {plan.extras >= 2 && (scene.isUsageOpen && isFull ? UsageCard(kit, scene, width, acts.onUsage) : UsageLine(kit, scene, width, acts.onUsage))}
      {plan.extras >= 3 && (
        <Text dimColor wrap="truncate-end">
          {fit(words.help, width)}
        </Text>
      )}
    </Box>
  )
}

// ---- plain text, for a command's answer and a surface with no colors

export const rosterLines = (scene: Scene): string[] =>
  [LEAD, ...WORKERS].map(id => {
    const card = cardOf(id, scene)

    return `${MEMBERS[id].mark} ${card.name} (${CAST[scene.lang].roles[roleOf(id, scene.roles)]}) ${card.status}${card.isIdle ? '' : ` · ${card.work}`}`
  })

/** The conversation as plain lines, oldest first. */
export const talkLines = (scene: Scene, lines: number): string[] =>
  scene.feed.slice(-lines).map(said => `${nameOf(scene, said.member)}: ${shown(said.quote)}${said.note === '' ? '' : ` (${said.note})`}`)

/** The usage as plain lines: what `/chiikawa usage` prints. */
export const usageLines = (scene: Scene): string[] => {
  const words = wordsOf(scene)
  const by = spentBy(scene)
  const lines = metersOf(scene).map(meter => `${pad(meter.label, labelCells(words))}${bar(meter.percent)} ${meter.text}`)

  if (scene.usage?.usd !== undefined) lines.push(words.sessionCost(scene.usage.usd.toFixed(2)))
  const spenders = spendersOf(scene)

  if (spenders.length > 0) lines.push(words.pay)
  for (const id of spenders) lines.push(`${MEMBERS[id].mark} ${nameOf(scene, id)}: ${spent(scene.lang, by[id])}`)

  return lines.length === 0 ? [words.noUsage] : lines
}
