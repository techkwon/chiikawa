// Pictures that stand in for a friend's emoji mark on the desktop: the
// person's own files in ~/.claude/chiikawa-pictures, named by friend
// (hachiware.gif) and by state (hachiware-working.gif, -idle, -done, -fail,
// -waiting, -slow). Read at session start and on `/chiikawa pictures`; a state
// with no file takes the friend's base one, and a friend with none its emoji.
import type { EngineInterface } from 'claude-code'

import type { MemberId, PictureTable } from '../types'

import { ORDER } from './cast'

/** What a friend's picture shows: one file for each, and `base` for any state without its own. */
export type PictureState = 'idle' | 'working' | 'done' | 'fail' | 'waiting' | 'slow'
export const PICTURE_STATES: readonly PictureState[] = ['idle', 'working', 'done', 'fail', 'waiting', 'slow']

/** Each friend's pictures as data URIs, by state, where they were found. */
export const PICTURES: Partial<Record<MemberId, Partial<Record<string, string>>>> = {}

/** The picture for a friend in a state: its own, else the friend's base one, else none (its emoji). */
export const pictureOf = (id: MemberId, state: PictureState): string | undefined => PICTURES[id]?.[state] ?? PICTURES[id]?.base

/**
 * The small picture for the band above the prompt, from the folder's `band`
 * folder (band/hachiware-working.gif): the band takes no large picture, as
 * every mod's row in it goes undrawn once one is too large.
 */
export const bandPictureOf = (id: MemberId, state: PictureState): string | undefined =>
  PICTURES[id]?.[`band-${state}`] ?? PICTURES[id]?.['band-base']

/** The band's folder, inside the picture folder. */
export const BAND_FOLDER = 'band'

/** The largest band picture used: a few small ones must fit the band together. */
export const BAND_BYTES = 10_000

/** The folder, under the person's home. */
export const PICTURE_FOLDER = '.claude/chiikawa-pictures'

/** The kinds read, by extension. */
const KINDS: Record<string, string> = { gif: 'image/gif', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

/** The largest file used: its data URI goes into one Svg, and a few go into one drawing, so each is kept well under the 131,072 characters an Svg holds. */
export const PICTURE_BYTES = 48_000

/** What a reading found: the friends drawn from a file, and the files left out with why. */
export type PicturesRead = { folder: string; found: MemberId[]; files: number; small: number; skipped: { file: string; why: 'large' | 'unread' }[]; table: PictureTable }

/**
 * A short stamp of a table, the same for the same pictures and another for any
 * other: the names, each picture's length, and a sum over every character.
 * A drawing reads this in place of the table to know whether it holds it.
 */
export const stampOf = (table: PictureTable): string => {
  let sum = 5381
  let count = 0

  for (const id of Object.keys(table).sort()) {
    const states = table[id as MemberId] ?? {}

    for (const state of Object.keys(states).sort()) {
      const text = `${id}/${state}:${states[state] ?? ''}`

      for (let at = 0; at < text.length; at += 1) sum = (Math.imul(sum, 33) ^ text.charCodeAt(at)) >>> 0
      count += text.length
    }
  }

  return `${count}:${sum.toString(36)}`
}

/** Puts the table kept in the session's state in the module's place, for the drawing about to be made. */
export const usePictures = (table: PictureTable | undefined): void => {
  for (const id of ORDER) delete PICTURES[id]
  for (const id of ORDER) if (table?.[id] !== undefined) PICTURES[id] = { ...table[id] }
}

/** Reads the folder again, replacing what was read before. */
export async function loadPictures($: EngineInterface): Promise<PicturesRead> {
  const home = await $.env.get('HOME').catch(() => undefined)
  const folder = home === undefined ? PICTURE_FOLDER : `${home.replace(/\/$/, '')}/${PICTURE_FOLDER}`
  const read: PicturesRead = { folder, found: [], files: 0, small: 0, skipped: [], table: {} }

  for (const id of ORDER) delete PICTURES[id]
  if (home === undefined || !(await $.fs.exists(folder).catch(() => false))) return read
  await readFolder($, folder, '', PICTURE_BYTES, read)
  if (await $.fs.exists(`${folder}/${BAND_FOLDER}`).catch(() => false)) await readFolder($, `${folder}/${BAND_FOLDER}`, `${BAND_FOLDER}-`, BAND_BYTES, read)

  read.found.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  for (const id of read.found) read.table[id] = { ...PICTURES[id] }

  return read
}

/** Reads one folder's pictures into PICTURES, each under its state with `prefix` before it. */
async function readFolder($: EngineInterface, folder: string, prefix: string, most: number, read: PicturesRead): Promise<void> {
  const entries = await $.fs.list(folder).catch(() => [])
  const shown = prefix === '' ? '' : `${prefix.slice(0, -1)}/`

  for (const entry of entries) {
    const lower = entry.name.toLowerCase()
    const dot = lower.lastIndexOf('.')
    const kind = dot < 0 ? undefined : KINDS[lower.slice(dot + 1)]
    const [id, state = 'base'] = (dot < 0 ? lower : lower.slice(0, dot)).split('-') as [MemberId, PictureState | 'base' | undefined]

    if (entry.kind !== 'file' || kind === undefined || !ORDER.includes(id) || (state !== 'base' && !PICTURE_STATES.includes(state))) continue
    if (entry.size > most) {
      read.skipped.push({ file: `${shown}${entry.name}`, why: 'large' })
      continue
    }
    try {
      const { base64 } = await $.fs.read(`${folder}/${entry.name}`, { as: 'bytes' })
      PICTURES[id] = { ...PICTURES[id], [`${prefix}${state}`]: `data:${kind};base64,${base64}` }
      if (prefix === '') read.files += 1
      else read.small += 1
      if (!read.found.includes(id)) read.found.push(id)
    } catch {
      read.skipped.push({ file: `${shown}${entry.name}`, why: 'unread' })
    }
  }
}
