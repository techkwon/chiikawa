/**
 * The desktop look: the Code tab's colors and a moving meadow behind the
 * conversation, sent once with `$.theme.set`. The terminal and editors draw no
 * look, and the mode works the same without one.
 *
 * The drawing is the mode's own: a sky, hills, grass to weed, flowers, a
 * mobile with a little bell, rice-ball rocks and floating fluff, all plain
 * shapes. No character from the comic is drawn.
 */
import type { EngineInterface, ThemeColors, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { paintedSceneAt } from './painted'
import type { PaintSeason } from './painted'

type Engine = EngineInterface

/** The scene's name among this mod's backdrops. */
export const SCENE_NAME = 'meadow'

/** Where the person's `/chiikawa look on|off` is kept from one session to the next. */
export const LOOK_KEPT = 'look'

/**
 * The painted meadow's own tones: pale sky by day, its navy starry
 * sky by night, with an accent of the season's as the one thing that changes. Every
 * surface takes the look's own hue and sits a few percent from its neighbor.
 * Built by the design system's own helper, so every name in the theme is one
 * the app reads.
 */
const colorsOf = (label: string, id: string, accent: string): ReturnType<typeof makeColors> => makeColors({
  label,
  id,
  roles: { accent, danger: '#d9534f', success: '#56a04a', warning: '#cf8a1d', pro: '#7785d8' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#c8dbed',
        'surface-1': '#d5e4f1',
        'surface-2': '#e4eef6',
        'text-primary': '#1e2b38',
        'text-secondary': '#3b4b5a',
        'text-muted': '#475767',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#181d42',
        'surface-1': '#1e2449',
        'surface-2': '#232a51',
        'surface-3': '#262e56',
        'text-primary': '#f2f4fc',
        'text-secondary': '#d2d8ee',
        'text-muted': '#aeb7d6',
      },
    },
  },
})

/** The season the meadow is drawn in. */
export type Season = PaintSeason

/** The four seasons, in the year's order from spring. */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']

/**
 * Each season's colors: the same surfaces and words, with the accent taken from the season's own drawing. Spring keeps the blossom
 * pink (and the name the look always had), summer its sky, autumn a maple leaf, winter the berries on the snowy bushes.
 */
const PALETTES: Record<Season, ReturnType<typeof makeColors>> = {
  spring: colorsOf('Chiikawa meadow', 'chiikawa-meadow', '#e2557f'),
  summer: colorsOf('Chiikawa summer meadow', 'chiikawa-meadow-summer', '#1b8fd6'),
  autumn: colorsOf('Chiikawa autumn meadow', 'chiikawa-meadow-autumn', '#d2622a'),
  winter: colorsOf('Chiikawa winter meadow', 'chiikawa-meadow-winter', '#c2485a'),
}

/** The line that would stop the desktop painting the colors of any season, if the helper found one. */
export const unpainted: string | undefined = SEASONS.flatMap(season => PALETTES[season].problems).find(line => line.startsWith("Desktop won't paint"))

/** The season a month of the year falls in (0 is January): March to May is spring, and so on by threes; December to February is winter. */
export const seasonOfMonth = (month: number): Season => SEASONS[Math.floor((((month % 12) + 12 + 10) % 12) / 3)] ?? 'spring'

/** The season a moment falls in, where the person is. */
export const seasonAt = (at: number): Season => seasonOfMonth(new Date(at).getMonth())

/**
 * The veil between the meadow and the words. The desktop app lays it over the
 * whole window, so a thick one hides the meadow altogether: kept as light as
 * the official example themes (about 0.3 to 0.55), with a little blur so no
 * edge of the drawing crosses a line of text. No tint, so the panel takes the
 * palette's own color in each mode.
 */
export const GLASS = { blur: 6, opacity: 0.22 }

/** When the meadow is drawn: following the app's mode, or always by day or by night. */
export type LookTime = 'auto' | 'day' | 'night'

const TIMES: readonly LookTime[] = ['auto', 'day', 'night']

/**
 * The scene's name for each time and season. Spring has no word of its own, so the names the look was first set under (`meadow`,
 * `meadow-day`, `meadow-night`) are the spring ones still; the others are `meadow-summer`, `meadow-summer-day` and so on.
 */
export const sceneNameOf = (time: LookTime, season: Season = 'spring'): string => [SCENE_NAME, ...(season === 'spring' ? [] : [season]), ...(time === 'auto' ? [] : [time])].join('-')

/** The twelve scenes, by the name each is set under: the meadow painted for this mod in each season, by day, by night, or following the app's mode. */
export const SCENES: Record<string, string> = Object.fromEntries(SEASONS.flatMap(season => TIMES.map(time => [sceneNameOf(time, season), paintedSceneAt(time, season)])))

/** The spring meadow that follows the app's mode. */
export const SCENE = SCENES.meadow as string

/** What a set came to, as one line for the person. */
export type LookResult = { isDrawn: boolean; reason?: string }

/** Whether an engine refused a shape it does not take, rather than failing for another reason. */
const isNotThisEnginesWay = (error: unknown): boolean =>
  error instanceof Error && /does not know|not allowed|unknown|refus|overrideColorScheme|scene/i.test(error.message)

/**
 * Sets the whole look in one call: the colors, the meadow and, for day or
 * night, which mode the window takes. The newest engines read the scene as
 * `scene` and the mode beside the backdrop; earlier ones read `id` and the mode
 * inside it. Each engine lets the names it knows through, so the scene goes
 * under both, and a refused shape is tried again in the older one.
 */
export async function setLook($: Engine, time: LookTime = 'auto', season: Season = 'spring'): Promise<LookResult> {
  const colors: ThemeColors = PALETTES[season].theme
  const scene = sceneNameOf(time, season)
  const scheme = time === 'day' ? 'light' : time === 'night' ? 'dark' : undefined
  // Each build's types know one of the shapes, so each is cast to the call's argument.
  const newer = {
    colors,
    backdrop: { scene, id: scene, glass: GLASS },
    ...(scheme === undefined ? {} : { overrideColorScheme: scheme }),
  } as unknown as ThemeSetArgs
  const older = {
    colors,
    backdrop: { id: scene, glass: GLASS, ...(scheme === undefined ? {} : { colorScheme: scheme }) },
  } as unknown as ThemeSetArgs

  try {
    return await $.theme.set(newer)
  } catch (error) {
    if (!isNotThisEnginesWay(error)) throw error
  }

  return await $.theme.set(older)
}

/** Takes the look off: it clears whatever theme stands, so only on the person's ask. */
export async function clearLook($: Engine): Promise<LookResult> {
  return $.theme.clear()
}

/** What the person chose with `/chiikawa look`: off, or the time the meadow is drawn at. */
export type LookKept = 'off' | LookTime

/** The person's last choice, kept from one session to the next; `auto` where none was made. */
export async function lookKept($: Engine): Promise<LookKept> {
  // A choice that could not be kept holds for this session.
  if (lookHeld !== undefined) return lookHeld
  const kept = await $.store.get(LOOK_KEPT).catch(() => undefined)

  if (kept === 'off' || kept === 'day' || kept === 'night') return kept

  return 'auto'
}

/** Whether the person turned the look off with `/chiikawa look off` in an earlier session. */
export async function isLookKeptOff($: Engine): Promise<boolean> {
  return (await lookKept($)) === 'off'
}

/** A choice made in this session that could not be kept for the next: it holds here. */
let lookHeld: LookKept | undefined

/** Keeps the person's choice for the next session, and answers whether it was kept; where it was not, it holds for this session. */
export async function keepLook($: Engine, wanted: LookKept): Promise<boolean> {
  const isKept = await $.store.set(LOOK_KEPT, wanted === 'auto' ? 'on' : wanted).then(
    () => true,
    () => false,
  )

  lookHeld = isKept ? undefined : wanted

  return isKept
}

/** Where the person's `/chiikawa look season ...` is kept from one session to the next. */
export const SEASON_KEPT = 'season'

/** What the person chose with `/chiikawa look season`: one season always, or the one the month falls in. */
export type SeasonKept = 'auto' | Season

const isSeason = (value: unknown): value is Season => SEASONS.some(season => season === value)

/** A season chosen in this session that could not be kept for the next: it holds here. */
let seasonHeld: SeasonKept | undefined

/** The person's last choice of season, kept from one session to the next; `auto` where none was made. */
export async function seasonKept($: Engine): Promise<SeasonKept> {
  if (seasonHeld !== undefined) return seasonHeld
  const kept = await $.store.get(SEASON_KEPT).catch(() => undefined)

  return isSeason(kept) ? kept : 'auto'
}

/** Keeps the person's choice of season for the next session, and answers whether it was kept; where it was not, it holds for this session. */
export async function keepSeason($: Engine, wanted: SeasonKept): Promise<boolean> {
  const isKept = await $.store.set(SEASON_KEPT, wanted).then(
    () => true,
    () => false,
  )

  seasonHeld = isKept ? undefined : wanted

  return isKept
}

/** The season the meadow is drawn in now: the one the person fixed, or the one this month falls in where they are. */
export async function seasonNow($: Engine): Promise<Season> {
  const kept = await seasonKept($)

  return kept === 'auto' ? seasonAt(await $.clock.now().catch(() => Date.now())) : kept
}

/** The scene a Backdrop render asks for: `scene` from v2.1.323, `id` before. */
export const sceneAsked = (props: unknown): { plugin?: string; scene?: string } => {
  const asked = (props ?? {}) as { plugin?: unknown; scene?: unknown; id?: unknown }
  const scene = typeof asked.scene === 'string' ? asked.scene : typeof asked.id === 'string' ? asked.id : undefined

  return { plugin: typeof asked.plugin === 'string' ? asked.plugin : undefined, scene }
}
