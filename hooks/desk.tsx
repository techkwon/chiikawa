// The drawings for the desktop app: the same friends, the same lines and the
// same presses as the terminal's, drawn with what a desktop window has (no
// cell-grid art). Each friend is its emoji mark and its name in its own
// colors; one at work has a dot of its color that bobs (a CSS animation in
// an Svg, no script). Nothing here is handed the engine: only the scene, the
// surface's elements and the callbacks a press runs.

import type { Color, Elements, RenderElement } from 'claude-code'

import type { Lang, MemberId, Said } from '../types'

import { CAST, CORE, isGesture, jobOf, LEAD, MEMBERS, ORDER, PINK, roleOf, shortName, shown, WORK_ROLES, WORKERS } from './cast'
import type { Band, Card, PaneActs, Scene, Sheet } from './view'
import { aidOf, bar, busyOf, MARK, cardOf, taskShown, gaugeParts, GUESTS, hasRole, lastSaid, metersOf, onStage, seatOf, sheetOf, shownOf, spendersOf, spent, spentBy, waitingOf, waitingSaid } from './view'
import type { PictureState } from './pictures'
import { bandPictureOf, pictureOf } from './pictures'
import { WORDS } from './words'

/** The desktop's elements a drawing here uses, and whether what is at work may move. */
export type DeskKit = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Svg'> & { isAnimated: boolean }

/** Where the desktop seated the pane: `widget` is its small form, where a click may not reach. */
export type DeskSeat = 'dock' | 'inline' | 'widget'

/** The narrowest a friend's card is drawn, in cells. */
const CARD_COLUMNS = 26
/** Lines of the conversation the pane shows, and the band. */
const TALK_LINES = 8
const TALK_ONLY_LINES = 40

/** A color as Svg markup may hold it: a plain hex color, or a neutral grey. */
const svgColor = (color: string): string => (/^#[0-9a-f]{3,8}$/i.test(color) ? color : '#9a9a9a')

/**
 * A dot in a friend's color. At work it bobs, unless movement is turned off
 * or the person's system asks for less motion; an image, so no script runs.
 */
export const dotSource = (color: string, isMoving: boolean): string => {
  const fill = svgColor(color)
  const motion = isMoving
    ? '.b{animation:b .9s ease-in-out infinite}@keyframes b{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@media (prefers-reduced-motion:reduce){.b{animation:none}}'
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="16" viewBox="0 0 12 16"><style>${motion}</style><circle class="b" cx="6" cy="11" r="4" fill="${fill}"/></svg>`
}

const Dot = (kit: DeskKit, id: MemberId, lang: Lang, isMoving: boolean): RenderElement => (
  <kit.Svg source={dotSource(MEMBERS[id].color, isMoving && kit.isAnimated)} alt={`${CAST[lang].names[id]} · ${WORDS[lang].status.running}`} width={12} height={16} />
)

/** A friend's picture as Svg markup around its PNG, drawn as a plain image (the desktop shows no picture inside an interactive frame). */
export const artSource = (uri: string, side: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 112 112"><image href="${uri}" width="112" height="112"/></svg>`

/** Which of a friend's pictures its card shows: waiting on a yes, at work (long at it: slow), its work ended well or not, or resting. */
export const pictureState = (scene: Scene, card: Card): PictureState => {
  // The task the card is drawn at: the picture tells the same.
  const task = taskShown([...scene.tasks].filter(one => one.member === card.id).sort((a, b) => b.startedAt - a.startedAt))

  if (task?.status === 'waiting') return 'waiting'
  if (card.isRunning) return task?.isSlow === true ? 'slow' : 'working'
  if (card.isEnded && task?.status === 'failed') return 'fail'
  if (card.isEnded && task?.status === 'done') return 'done'

  return 'idle'
}

/**
 * The most picture data one drawing carries, in characters. The desktop leaves
 * a drawing of about 250K characters or more undrawn and keeps showing the last
 * one it drew, so every picture is spent from this, in the order they matter,
 * with room left for the words; one that does not fit is drawn as its emoji.
 */
export const PICTURE_BUDGET = 160_000

/** What is left of the budget in the drawing under way. */
let room = PICTURE_BUDGET

/** Starts a drawing with the whole budget. */
const newDrawing = (): void => {
  room = PICTURE_BUDGET
}

/** A picture, if it fits what is left of the budget (and is then spent), else none. */
const spend = (uri: string | undefined): string | undefined => {
  if (uri === undefined || uri.length > room) return undefined
  room -= uri.length

  return uri
}

/** The small picture before a line or a name, if it fits. */
const markFace = (id: MemberId): string | undefined => spend(bandPictureOf(id, 'idle'))

/**
 * A friend's face: the person's picture for its state where there is one, else
 * its emoji mark at the given text size. A card among others takes the small
 * picture: a few large ones are past what one drawing can carry.
 */
const Face = (kit: DeskKit, scene: Scene, card: Card, side: number, size: 'heading' | 'title' | 'body', isCrowded = false): RenderElement => {
  const state = pictureState(scene, card)
  const uri = (isCrowded ? undefined : spend(pictureOf(card.id, state))) ?? spend(bandPictureOf(card.id, state))

  return uri === undefined ? (
    <kit.Text size={size}>{MEMBERS[card.id].mark}</kit.Text>
  ) : (
    <kit.Svg source={artSource(uri, side)} alt={CAST[scene.lang].names[card.id]} width={side} height={side} />
  )
}

/** A friend's small face, from the band folder, for a place beside a large one: a pane holding two large pictures may be too large to draw. */
const SmallFace = (kit: DeskKit, scene: Scene, card: Card, side: number): RenderElement => {
  const uri = spend(bandPictureOf(card.id, pictureState(scene, card)))

  return uri === undefined ? (
    <kit.Text size="heading">{MEMBERS[card.id].mark}</kit.Text>
  ) : (
    <kit.Svg source={artSource(uri, side)} alt={CAST[scene.lang].names[card.id]} width={side} height={side} />
  )
}

/** A friend's mark before its name in a line: its small band picture where there is one and it fits, else its emoji. */
const Mark = (kit: DeskKit, id: MemberId, lang: Lang, side: number, dim = false, face: string | undefined = markFace(id)): RenderElement => face === undefined ? (
    <kit.Text dimColor={dim}>{MEMBERS[id].mark}</kit.Text>
  ) : (
    <kit.Svg source={artSource(face, side)} alt={CAST[lang].names[id]} width={side} height={side} />
  )

/** A name in the friend's own colors: its badge, readable on a light window and a dark one alike. */
const Badge = (kit: DeskKit, id: MemberId, name: string): RenderElement => (
  <kit.Text backgroundColor={MEMBERS[id].color} color={MEMBERS[id].ink} weight="semibold">
    {` ${name} `}
  </kit.Text>
)

/** Ink for words on a friend's pale paper: the same on a light window and a dark one, since the paper is. */
const INK = '#2f1f28'
const INK_SOFT = '#6b5460'
/** Ink for the brand's pink. */
const BRAND_INK = '#3a1524'

/** A friend's color as pale paper: three parts white to one of the color, so dark ink reads on it in either mode. */
export const paperOf = (color: string): string => {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : '#c9c9c9'
  const part = (at: number): string =>
    Math.round(parseInt(hex.slice(at, at + 2), 16) * 0.26 + 255 * 0.74)
      .toString(16)
      .padStart(2, '0')

  return `#${part(1)}${part(3)}${part(5)}`
}

/** The brand of the mode, as the terminal draws it. */
const Brand = (kit: DeskKit, lang: Lang): RenderElement => (
  <kit.Text backgroundColor={PINK} color={BRAND_INK} weight="bold">
    {` ${WORDS[lang].brand} `}
  </kit.Text>
)

/**
 * A friend's line as a speech balloon: pale paper of its color, hugging the
 * words. The paper and the ink are both given, so it reads the same on the
 * day's pink and the night's indigo.
 */
const Balloon = (kit: DeskKit, id: MemberId, quote: string, note: string): RenderElement => (
  <kit.Box alignSelf="flex-start" backgroundColor={paperOf(MEMBERS[id].color)} borderStyle="round" borderColor={MEMBERS[id].color} paddingX="sm" flexShrink={1}>
    <kit.Text size="footnote" color={INK} wrap="wrap">
      <kit.Text italic={!isGesture(quote)} color={INK}>
        {shown(quote)}
      </kit.Text>
      {note !== '' && <kit.Text color={INK_SOFT}>{` ${note}`}</kit.Text>}
    </kit.Text>
  </kit.Box>
)

/** The side of the picture before a line said. */
const TALK_SIDE = 22

/** One line of the conversation: the speaker's small picture (else its mark) and name, what was said or done, and what it was about. */
const TalkLine = (kit: DeskKit, lang: Lang, said: Said, key: string, face: string | undefined = markFace(said.member)): RenderElement => {
  const { Box, Text } = kit
  const quote = said.quote[lang]
  const note = said.note[lang]

  return (
    <Box key={key} gap="sm" alignItems="flex-start">
      <Box gap="xs" alignItems="center" flexShrink={0}>
        {Mark(kit, said.member, lang, TALK_SIDE, false, face)}
        {Badge(kit, said.member, CAST[lang].names[said.member])}
      </Box>
      <Box flexShrink={1}>
        <Text wrap="wrap">
          <Text italic={!isGesture(quote)}>{shown(quote)}</Text>
          {note !== '' && <Text dimColor>{` ${note}`}</Text>}
        </Text>
      </Box>
    </Box>
  )
}

// ---- the pane

/** Whether a card is of one at work or waiting on its work: those come first. */
const isOnWork = (card: Card): boolean => card.isRunning || (!card.isIdle && !card.isEnded)

/** The cards in the order drawn: those at work, then those waiting, then the ones whose work ended, then the ones resting. */
export const deskCards = (scene: Scene): Card[] => {
  const rank = (card: Card): number => (card.isRunning ? 0 : isOnWork(card) ? 1 : card.isEnded ? 2 : 3)

  return ORDER.map(id => cardOf(id, scene))
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rank(a.card) - rank(b.card) || a.index - b.index)
    .map(({ card }) => card)
}

/**
 * A friend's card. One at work is framed in its color, its mark large: its
 * name to press with its state beside it, its role, the task in hand, what it
 * is doing, and its last line as a balloon. One resting is the same card
 * drawn small and quiet, so the ones at work stand out.
 */
const FriendCard = (kit: DeskKit, scene: Scene, card: Card, width: number, acts: PaneActs, isCrowded = false): RenderElement => {
  const { Box, Text, Button } = kit
  const { lang } = scene
  const member = MEMBERS[card.id]
  const cast = CAST[lang]
  const role = roleOf(card.id, scene.roles)
  // What it does and is known for, each said once: its role, the comic's word for that work, its kind where its name does not say it, its title.
  const about = [...new Set([cast.roles[role], cast.job[role], cast.kinds[card.id] === card.name ? '' : cast.kinds[card.id], cast.titles[card.id]])].filter(part => part !== '').join(' · ')
  const said = lastSaid(scene, card.id)
  const quote = said?.quote[lang] ?? card.quote
  const note = said === undefined ? card.note : said.note[lang]
  const isPicked = scene.picked === card.id
  const isBusy = isOnWork(card)
  const title = card.isIdle ? '' : (card.title ?? card.work)
  // The bobbing dot stands for the running mark, so the state is said once.
  const status = card.isRunning ? card.status.replace(/^[●◐✓✗○]\s*/u, '') : card.status

  return (
    <Box key={`card-${card.id}`} flexDirection="column" borderStyle="round" borderColor={isBusy ? member.color : 'subtle'} borderDimColor={!isBusy} paddingX="md" paddingY="xs" gap="xs" minWidth={width} flexGrow={1}>
      <Box gap="sm" alignItems="center">
        {Face(kit, scene, card, isBusy ? 72 : 52, isBusy ? 'title' : 'heading', isCrowded)}
        <Box flexDirection="column" flexShrink={1} flexGrow={1}>
          <Box gap="sm" alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Button key={`watch-${card.id}`} label={card.name} plain onPress={() => acts.onWatch(card.id)}>
              {Badge(kit, card.id, `${isPicked ? '▶ ' : ''}${card.name}`)}
            </Button>
            <Box gap="xs" alignItems="center">
              {card.isRunning && Dot(kit, card.id, lang, true)}
              <Text size={card.isIdle ? 'caption' : 'footnote'} color={card.tint} weight={card.isIdle ? 'regular' : 'semibold'} dimColor={card.isIdle} tabular>
                {status}
              </Text>
            </Box>
          </Box>
          <Text size="caption" dimColor wrap="wrap">
            {about}
          </Text>
        </Box>
      </Box>
      {title !== '' && (
        <Text weight="semibold" wrap="wrap">
          {title}
        </Text>
      )}
      {card.last !== '' && (
        <Text size="footnote" dimColor wrap="wrap">
          {card.last}
        </Text>
      )}
      {Balloon(kit, card.id, quote, note)}
    </Box>
  )
}

/** Cards side by side as the width holds them, each as wide as the others. */
const Cards = (kit: DeskKit, scene: Scene, cards: readonly Card[], columns: number, acts: PaneActs, key: string): RenderElement => {
  const across = Math.max(1, Math.floor((columns + 1) / (CARD_COLUMNS + 1)))
  // Never wider than the pane, however narrow it is.
  const width = Math.max(1, Math.min(columns, Math.max(CARD_COLUMNS, Math.floor((columns - (across - 1)) / across))))
  // Two or more large pictures are past what one drawing can carry: then every card takes its small one.
  const isCrowded = cards.filter(card => pictureOf(card.id, pictureState(scene, card)) !== undefined).length > 1

  return (
    <kit.Box key={key} flexWrap="wrap" gap={1}>
      {cards.map(card => FriendCard(kit, scene, card, width, acts, isCrowded))}
    </kit.Box>
  )
}

/** A label over a part of the pane. */
const Heading = (kit: DeskKit, label: string, key: string): RenderElement => (
  <kit.Text key={key} size="footnote" weight="semibold" dimColor>
    {label}
  </kit.Text>
)

/** The sheet of the friend the person pressed: its state, what it is doing, the roles to give it, and the way to hand it the next prompt. */
const SheetCard = (kit: DeskKit, scene: Scene, sheet: Sheet, acts: PaneActs): RenderElement => {
  const { Box, Text, Button } = kit
  const { lang } = scene
  const words = WORDS[lang]
  const card = cardOf(sheet.id, scene)
  const labels = CAST[lang].roles
  const role = roleOf(sheet.id, scene.roles)
  const own = MEMBERS[sheet.id].role
  const isPicked = scene.picked === sheet.id

  return (
    <Box key="sheet" flexDirection="column" borderStyle="round" borderColor={MEMBERS[sheet.id].color} paddingX="md" paddingY="xs" gap="xs">
      <Box justifyContent="space-between" alignItems="center" gap="sm">
        <Box gap="sm" alignItems="center" flexWrap="wrap" flexShrink={1}>
          {SmallFace(kit, scene, card, isOnWork(card) ? 72 : 52)}
          {Badge(kit, sheet.id, card.name)}
          {card.isRunning && Dot(kit, sheet.id, lang, true)}
          <Text color={card.tint} weight={card.isIdle ? 'regular' : 'semibold'} dimColor={card.isIdle} tabular>
            {card.status}
          </Text>
          {card.sub !== '' && (
            <Text size="caption" dimColor>
              {card.sub}
            </Text>
          )}
        </Box>
        <Button key="watch-close" label={words.close} onPress={() => acts.onWatch(null)} />
      </Box>
      {sheet.rows.map((row, index) => (
        <Text key={`sheet-${index}`} wrap="wrap">
          {row.label !== '' && <Text dimColor>{`${row.label}  `}</Text>}
          <Text color={row.tint}>{row.text}</Text>
        </Text>
      ))}
      {hasRole(sheet.id) && (
        <Box gap="xs" alignItems="center" flexWrap="wrap">
          <Text dimColor>{words.labels.role}</Text>
          {WORK_ROLES.map(one => (
            <Button key={`role-${sheet.id}-${one}`} label={`${one === role ? '▶' : '▷'}${labels[one]}`} plain dimColor={one !== role} onPress={() => acts.onRole(sheet.id, one)} />
          ))}
          {role !== own && (
            <Text size="caption" dimColor>
              {words.ownRole(labels[own])}
            </Text>
          )}
        </Box>
      )}
      {sheet.canPick && (
        <Box>
          <Button key={`pick-${sheet.id}`} label={isPicked ? words.picked : sheet.id === LEAD ? words.askLead : words.askFriend} variant={isPicked ? 'secondary' : 'primary'} onPress={() => acts.onPick(sheet.id)} />
        </Box>
      )}
    </Box>
  )
}

/** The conversation: its label with the ways back and on, and the lines, oldest first. */
const Talk = (kit: DeskKit, scene: Scene, count: number, acts: PaneActs): RenderElement => {
  const { Box, Button } = kit
  const words = WORDS[scene.lang]
  const { from, to } = shownOf(scene, count)
  const total = scene.feed.length
  const back = total - to
  const size = Math.max(1, count)
  const said = total === 0 ? [waitingSaid] : scene.feed.slice(from, to)
  // The newest lines take the pictures first: the oldest are the ones left with an emoji.
  const faces = said.map(() => undefined as string | undefined)

  for (let index = said.length - 1; index >= 0; index -= 1) faces[index] = markFace(said[index]?.member ?? 'hachiware')

  return (
    <Box key="talk" flexDirection="column" gap="xs">
      <Box justifyContent="space-between" alignItems="center" gap="sm">
        {Heading(kit, back > 0 ? words.earlier(`${from + 1}~${to}/${total}`) : words.talk, 'talk-label')}
        <Box gap="xs">
          {from > 0 && <Button key="talk-older" label={words.older} plain onPress={() => acts.onTalk(Math.min(total - 1, back + size))} />}
          {back > 0 && <Button key="talk-newer" label={words.newer} plain onPress={() => acts.onTalk(Math.max(0, back - size))} />}
          <Button key="talk-only" label={scene.isTalkOnly ? words.all : words.only} plain dimColor={!scene.isTalkOnly} onPress={() => acts.onStory()} />
        </Box>
      </Box>
      {said.map((one, index) => TalkLine(kit, scene.lang, one, `said-${one.at}-${index}`, faces[index]))}
    </Box>
  )
}

/** The usage: in full as a card, or as one line to press. */
const Usage = (kit: DeskKit, scene: Scene, acts: PaneActs): RenderElement => {
  const { Box, Text, Button } = kit
  const words = WORDS[scene.lang]
  const meters = metersOf(scene)

  if (!scene.isUsageOpen) {
    const label = meters.length === 0 ? words.seeUsage : meters.map(meter => `${meter.label} ${Math.round(meter.percent)}%`).join(' · ')

    return (
      <Box key="usage">
        <Button key="usage-more" label={label} plain dimColor onPress={() => acts.onUsage()} />
      </Box>
    )
  }
  const by = spentBy(scene)
  const spenders = spendersOf(scene)
  const usd = scene.usage?.usd

  return (
    <Box key="usage" flexDirection="column" borderStyle="round" borderColor="subtle" borderDimColor paddingX="md" paddingY="xs" gap="xs">
      <Box justifyContent="space-between" alignItems="center" gap="sm">
        <Box gap="sm">
          <Text size="footnote" weight="semibold" dimColor>
            {words.usage}
          </Text>
          {usd !== undefined && <Text dimColor>{words.session(usd.toFixed(2))}</Text>}
        </Box>
        <Button key="usage-less" label={words.fold} plain dimColor onPress={() => acts.onUsage()} />
      </Box>
      {meters.map(meter => (
        <Text key={meter.label} wrap="wrap">
          <Text dimColor>{`${meter.label}  `}</Text>
          <Text color={meter.tint} mono>
            {bar(meter.percent)}
          </Text>
          <Text tabular>{` ${meter.text}`}</Text>
        </Text>
      ))}
      {spenders.length > 0 && <Text dimColor>{words.pay}</Text>}
      {spenders.map(id => (
        <Box key={`paid-${id}`} gap="xs" alignItems="center">
          {Mark(kit, id, scene.lang, TALK_SIDE)}
          <Text wrap="wrap">
            <Text weight="medium">{CAST[scene.lang].names[id]}</Text>
            <Text dimColor>{`  ${spent(scene.lang, by[id])}`}</Text>
          </Text>
        </Box>
      ))}
      {meters.length === 0 && spenders.length === 0 && <Text dimColor>{words.noUsage}</Text>}
    </Box>
  )
}

/** What the pane's title says: how many are at work, the three at it together, how many wait, or that all rest. */
const headOf = (scene: Scene): string => {
  const words = WORDS[scene.lang]
  const busy = busyOf(scene).length
  const waiting = waitingOf(scene).length

  return busy > 0 ? words.busy(busy) : CORE.some(id => aidOf(scene, id) !== undefined) ? words.trio : waiting > 0 ? words.waiting(waiting) : words.rest
}

const Title = (kit: DeskKit, scene: Scene, isOn: boolean): RenderElement => {
  const { Box, Text } = kit
  const words = WORDS[scene.lang]

  return (
    <Box key="title" justifyContent="space-between" alignItems="center" gap="sm">
      <Box gap="sm" alignItems="center">
        {Brand(kit, scene.lang)}
        <Text weight="semibold">{headOf(scene)}</Text>
      </Box>
      <Text color={isOn ? 'success' : undefined} dimColor={!isOn}>
        {isOn ? words.on : words.off}
      </Text>
    </Box>
  )
}

/** The pane's small form: the friends' marks, the ones at work with their dots. Nothing to press, for a click may not reach it. */
const Glance = (kit: DeskKit, scene: Scene, isOn: boolean): RenderElement => {
  const { Box } = kit
  const latest = lastSaid(scene)

  return (
    <Box flexDirection="column" gap="xs">
      {Title(kit, scene, isOn)}
      <Box gap="sm" flexWrap="wrap" alignItems="center">
        {deskCards(scene).map(card => (
          <Box key={`glance-${card.id}`} gap="xs" alignItems="center">
            {card.isRunning && Dot(kit, card.id, scene.lang, true)}
            {Mark(kit, card.id, scene.lang, TALK_SIDE, !isOnWork(card))}
          </Box>
        ))}
      </Box>
      {latest !== undefined && TalkLine(kit, scene.lang, latest, 'said')}
    </Box>
  )
}

/**
 * The pane: a card for each friend, the ones at work first; the sheet of
 * the one the person pressed; the conversation; and the usage. Asked for the
 * conversation alone, the title and the conversation, more of it.
 */
export const drawDeskPane = (kit: DeskKit, scene: Scene, isOn: boolean, columns: number, seat: DeskSeat, acts: PaneActs): RenderElement => {
  const { Box } = kit
  const words = WORDS[scene.lang]

  newDrawing()

  if (seat === 'widget') return Glance(kit, scene, isOn)
  if (scene.isTalkOnly) {
    return (
      <Box flexDirection="column" gap="md">
        {Title(kit, scene, isOn)}
        {Talk(kit, scene, TALK_ONLY_LINES, acts)}
      </Box>
    )
  }
  const sheet = sheetOf(scene)
  const cards = deskCards(scene)
  // Only the friends at work are drawn: the resting ones stay off the pane, so it keeps short.
  const atWork = cards.filter(isOnWork)

  return (
    <Box flexDirection="column" gap="md">
      {Title(kit, scene, isOn)}
      {sheet !== undefined && SheetCard(kit, scene, sheet, acts)}
      {atWork.length > 0 && (
        <Box key="group-work" flexDirection="column" gap="xs">
          {Heading(kit, words.workers, 'workers-label')}
          {Cards(kit, scene, atWork, columns, acts, 'cards-work')}
        </Box>
      )}
      {Talk(kit, scene, TALK_LINES, acts)}
      {Usage(kit, scene, acts)}
    </Box>
  )
}

// ---- the band above the prompt

/** What the band is told besides the scene: what is pressed, whether the conversation is to show, and the room. */
export type DeskBand = Band & {
  rows: number
  isCollapsed: boolean
  /** Whether the list of friends to send the next prompt to is open under the row. */
  isPicking: boolean
  /** A friend, or auto (null), was chosen from that list. */
  onChoose: (id: MemberId | null) => void
  /** Whether the pane is open: the open button then reads close, and closes it. */
  isPaneOpen: boolean
}

/** Who the band's list offers to send the next prompt to: 하치와레 and every friend that takes work. */
export const SENDABLE: readonly MemberId[] = [LEAD, ...WORKERS]

/** The list under the band's row: auto first, then each friend with its name and what it is good at; the one chosen now stands out. */
const SendList = (kit: DeskKit, scene: Scene, onChoose: (id: MemberId | null) => void): RenderElement => {
  const { Box, Text, Button } = kit
  const words = WORDS[scene.lang]
  const entry = (key: string, label: string, isChosen: boolean, id: MemberId | null): RenderElement => (
    <Button key={key} label={label} variant={isChosen ? 'primary' : 'secondary'} onPress={() => onChoose(id)} />
  )
  // A friend with a small picture shows it beside its button, and its name then goes without the emoji.
  const friend = (id: MemberId): RenderElement => {
    const label = `${CAST[scene.lang].names[id]} · ${jobOf(scene.lang, id, scene.roles)}`

    const face = markFace(id)

    return face === undefined ? (
      entry(`send-${id}`, `${MEMBERS[id].mark} ${label}`, scene.picked === id, id)
    ) : (
      <Box key={`send-box-${id}`} gap="xs" alignItems="center">
        {Mark(kit, id, scene.lang, TALK_SIDE, false, face)}
        {entry(`send-${id}`, label, scene.picked === id, id)}
      </Box>
    )
  }

  return (
    <Box key="send-list" flexDirection="column" gap="xs" alignItems="center">
      <Text size="caption" dimColor>
        {words.pickWho}
      </Text>
      <Box columnGap="xs" rowGap="xs" flexWrap="wrap" justifyContent="center">
        {entry('send-auto', `${words.auto} · ${words.autoBrief}`, scene.picked === null, null)}
        {SENDABLE.map(friend)}
      </Box>
    </Box>
  )
}

/** A border drawn with no color to see: the desktop draws `transparent` as a dark line, and this not at all, keeping the border's room. */
const UNSEEN = '#00000000'

/** One friend in the band: its dot or the mark of its task, its emoji and name to press, and how long its task has run. */
const Chip = (kit: DeskKit, scene: Scene, id: MemberId, onSeat: (id: MemberId) => void): RenderElement => {
  const { Box, Text, Button, Svg } = kit
  const seat = seatOf(scene, onStage(scene), id)
  const member = MEMBERS[id]
  // One at work is a framed pill in its color; the others keep the same frame unseen, so a friend starting or ending work moves nothing in the row, its height above all.
  const frame = { borderStyle: 'round', borderColor: seat.isBusy ? member.color : UNSEEN, backgroundColor: seat.isBusy ? `${member.color}38` : UNSEEN, paddingX: 'sm' as const }
  const tint: Color | undefined = seat.tint
  const card = cardOf(id, scene)
  // Only a small picture goes in the band: a large one leaves the whole band undrawn.
  // The picture follows what the chip shows: a task ended a while ago has left its mark, and its picture goes with it.
  const state: PictureState = seat.isBusy ? pictureState(scene, card) : seat.glyph === MARK.failed ? 'fail' : seat.glyph === MARK.done ? 'done' : seat.glyph === MARK.waiting ? 'waiting' : 'idle'
  const face = spend(bandPictureOf(id, state))

  return (
    <Box key={`chip-${id}`} gap="xs" alignItems="center" {...frame}>
      {seat.isRunning && Dot(kit, id, scene.lang, true)}
      {/* A task done leaves no mark on the desktop: only a failure is shown, for a while. */}
      {!seat.isRunning && seat.glyph !== '' && seat.glyph !== MARK.done && <Text color={tint}>{seat.glyph}</Text>}
      {face !== undefined && <Svg source={artSource(face, 36)} alt={CAST[scene.lang].names[id]} width={36} height={36} />}
      <Button key={`seat-${id}`} label={face === undefined ? `${member.mark} ${seat.label}` : seat.label} plain dimColor={seat.isDim} onPress={() => onSeat(id)} />
      {seat.time !== '' && (
        <Text size="caption" weight="medium" tabular>
          {seat.time.trim()}
        </Text>
      )}
    </Box>
  )
}

/** The band's chips: the main three always, and a guest only while it works or takes the next prompt. */
export const bandSeats = (scene: Scene): MemberId[] => {
  const stage = onStage(scene)

  return [...CORE, ...GUESTS.filter(id => id === scene.picked || seatOf(scene, stage, id).isBusy)]
}

/**
 * The band: the friends as a row of chips, the ones at work framed in their
 * color with a bobbing dot; who takes the next prompt, the usage, and the way
 * to the pane; and under them the last line said, while there is a
 * conversation the pane is not showing.
 */
export const drawDeskBand = (kit: DeskKit, scene: Scene, band: DeskBand): RenderElement => {
  const { Box, Button } = kit

  newDrawing()
  const words = WORDS[scene.lang]
  const parts = gaugeParts(scene.lang, scene.usage)
  const gauge = parts.length === 0 ? words.usage : parts.join(' · ')
  const to = words.sent(scene.picked === null ? words.auto : shortName(scene.lang, scene.picked))
  const latest = band.isLive && !band.isCollapsed && band.rows >= 2 ? lastSaid(scene) : undefined

  return (
    <Box flexDirection="column" gap="xs" alignItems="center">
      <Box justifyContent="center" alignItems="center" flexWrap="wrap" columnGap="md" rowGap="xs">
        <Box columnGap="xs" rowGap="xs" alignItems="center" justifyContent="center" flexWrap="wrap" flexShrink={1}>
          <Box marginRight="xs">{Brand(kit, scene.lang)}</Box>
          {bandSeats(scene).map(id => Chip(kit, scene, id, band.onSeat))}
        </Box>
        <Box gap="sm" alignItems="center" justifyContent="center" flexWrap="wrap">
          <Button key="to" label={band.isPicking ? `${to} ▴` : `${to} ▾`} plain dimColor={scene.picked === null && !band.isPicking} onPress={() => band.onAuto()} />
          <Button key="usage" label={gauge} plain dimColor onPress={() => band.onUsage()} />
          <Button key="open" label={band.isPaneOpen ? words.closePane : words.openPane} onPress={() => band.onOpen()} />
        </Box>
      </Box>
      {band.isPicking && !band.isCollapsed && SendList(kit, scene, band.onChoose)}
      {latest !== undefined && TalkLine(kit, scene.lang, latest, 'said')}
    </Box>
  )
}

// ---- the line that closes a turn

/** 하치와레's word on a turn: a cheer after a long one, else one of his two, by the second it ended on. */
export const turnQuote = (lang: Lang, durationMs: number): string => {
  const { leader } = CAST[lang]

  return durationMs >= 600_000 ? leader.cheer : Math.floor(durationMs / 1000) % 2 === 0 ? leader.allDone : leader.sure
}

export const drawDeskTurn = (kit: DeskKit, lang: Lang, durationMs: number): RenderElement => {
  const { Box, Text } = kit

  newDrawing()

  return (
    <Box gap="sm" alignItems="center">
      {Mark(kit, LEAD, lang, TALK_SIDE)}
      {Badge(kit, LEAD, CAST[lang].names[LEAD])}
      <Text italic>{`“${turnQuote(lang, durationMs)}”`}</Text>
      <Text dimColor tabular>
        {WORDS[lang].spoken(durationMs)}
      </Text>
    </Box>
  )
}
