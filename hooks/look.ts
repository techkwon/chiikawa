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

type Engine = EngineInterface

/** The scene's name among this mod's backdrops. */
export const SCENE_NAME = 'meadow'

/** Where the person's `/chiikawa look on|off` is kept from one session to the next. */
export const LOOK_KEPT = 'look'

/**
 * The painted meadow's own tones: pale spring sky by day, its navy starry
 * sky by night, with the blossom pink as the accent. Every
 * surface takes the look's own hue and sits a few percent from its neighbor.
 * Built by the design system's own helper, so every name in the theme is one
 * the app reads.
 */
const { theme: COLORS, problems: COLOR_PROBLEMS } = makeColors({
  label: 'Chiikawa meadow',
  id: 'chiikawa-meadow',
  roles: { accent: '#e2557f', danger: '#d9534f', success: '#56a04a', warning: '#cf8a1d', pro: '#7785d8' },
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

/** The line that would stop the desktop painting the colors, if the helper found one. */
export const unpainted: string | undefined = COLOR_PROBLEMS.find(line => line.startsWith("Desktop won't paint"))

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

/** The three scenes, by the name each is set under: the meadow painted for this mod, by day, by night, or following the app's mode. */
export const SCENES: Record<string, string> = { meadow: paintedSceneAt('auto'), 'meadow-day': paintedSceneAt('day'), 'meadow-night': paintedSceneAt('night') }

/** The meadow that follows the app's mode. */
export const SCENE = SCENES.meadow as string

/** The scene's name for each time. */
export const sceneNameOf = (time: LookTime): string => (time === 'auto' ? SCENE_NAME : `${SCENE_NAME}-${time}`)

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
export async function setLook($: Engine, time: LookTime = 'auto'): Promise<LookResult> {
  const colors: ThemeColors = COLORS
  const scene = sceneNameOf(time)
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
  const kept = await $.store.get(LOOK_KEPT).catch(() => undefined)

  if (kept === 'off' || kept === 'day' || kept === 'night') return kept

  return 'auto'
}

/** Whether the person turned the look off with `/chiikawa look off` in an earlier session. */
export async function isLookKeptOff($: Engine): Promise<boolean> {
  return (await lookKept($)) === 'off'
}

/** Keeps the person's choice for the next session. */
export async function keepLook($: Engine, wanted: LookKept): Promise<void> {
  await $.store.set(LOOK_KEPT, wanted === 'auto' ? 'on' : wanted).catch(() => undefined)
}

/** The scene a Backdrop render asks for: `scene` from v2.1.323, `id` before. */
export const sceneAsked = (props: unknown): { plugin?: string; scene?: string } => {
  const asked = (props ?? {}) as { plugin?: unknown; scene?: unknown; id?: unknown }
  const scene = typeof asked.scene === 'string' ? asked.scene : typeof asked.id === 'string' ? asked.id : undefined

  return { plugin: typeof asked.plugin === 'string' ? asked.plugin : undefined, scene }
}
