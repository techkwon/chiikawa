import type { Color } from 'claude-code'

import type { MemberId, Mood } from '../types'

import { toneOf } from './cast'

// Two drawings of each character, both made for this mod from the wiki's
// description of how each looks (not the official art): a three-row picture in
// keyboard characters for the conversation, and a small pixel icon for the
// pane's cards.

// ---- pictures in keyboard characters: nine cells by three rows

export type Art = {
  top: string
  /** The middle row, one for each mood. */
  faces: Record<Mood, string>
  feet: string
  /** A letter a cell for each row, naming its color in `colors`; `.` is the terminal's own ink. */
  masks: readonly [string, string, string]
  colors: Readonly<Record<string, Color>>
}

export const ART_COLUMNS = 9
export const ART_ROWS = 3

const ARMOR_FACES: Record<Mood, string> = {
  calm: '  |[=]|  ',
  glad: '  |[^]|  ',
  sad: '  |[;]|  ',
  shock: '  |[=]|? ',
  tired: '  |[-]|  ',
}

export const ARTS: Record<MemberId, Art> = {
  // A white cat whose blue hair parts in the middle, with a blue tail.
  hachiware: {
    top: ' /\\___/\\ ',
    faces: { calm: "(##'v'##)", glad: '(##>v<##)', sad: '(##;v;##)', shock: "(##'o'##)", tired: '(##-v-##)' },
    feet: ' (")_(")~',
    masks: ['.bbbbbbb.', '.bb...bb.', '........b'],
    colors: { b: '#6fa0ea' },
  },
  // Small round ears and eyebrows; pink is its color.
  chiikawa: {
    top: ' o     o ',
    faces: { calm: "( `'w'` )", glad: "( >'w'< )", sad: "( ;'w'; )", shock: "( o'A'o )", tired: "( -'w'- )" },
    feet: ' (")_(") ',
    masks: ['.p.....p.', 'p.......p', '.ppppppp.'],
    colors: { p: '#f7a8c0' },
  },
  // Long ears, a yellow coat, a mouth that is always open.
  usagi: {
    top: ' (\\   /) ',
    faces: { calm: " ( 'o' ) ", glad: ' ( >O< ) ', sad: " ( 'A' )?", shock: " ( 'A' )?", tired: ' ( -o- ) ' },
    feet: ' (")_(") ',
    masks: ['.yy...yy.', '.y.....y.', '.yyyyyyy.'],
    colors: { y: '#f3dc6b' },
  },
  // A light yellow coat, a cross-shaped scar on the right of the face, a cape.
  rakko: {
    top: ' .-"""-. ',
    faces: { calm: " (`'w'+) ", glad: ' ( ^w^+) ', sad: " (`'~'+) ", shock: " (`'o'+) ", tired: ' (`-_-+) ' },
    feet: ' /|___|\\ ',
    masks: ['.lllllll.', '.l....rl.', '.lllllll.'],
    colors: { l: '#d8c36a', r: '#e0605a' },
  },
  // An orange mane round an apricot face.
  shisa: {
    top: ' @@@@@@@ ',
    faces: { calm: "@( 'W' )@", glad: '@( >W< )@', sad: '@( ;W; )@', shock: "@( 'O' )@", tired: '@( -W- )@' },
    feet: ' (")_(") ',
    masks: ['.ooooooo.', 'oa.....ao', '.aaaaaaa.'],
    colors: { o: '#f08a24', a: '#f6c9a0' },
  },
  // A chestnut-brown head, no eyebrows; it answers with an O or an X of the hand.
  kurimanju: {
    top: ' .-###-. ',
    faces: { calm: ' ( . . ) ', glad: ' ( . . )O', sad: ' ( . . )X', shock: ' ( o o )X', tired: ' ( - - ) ' },
    feet: ' (")_(") ',
    masks: ['.nnnnnnn.', '.e.....e.', '.eeeeeee.'],
    colors: { n: '#c08a52', e: '#f0dcb4' },
  },
  // A crab's claws on a headband, two-line eyebrows, many pointed teeth.
  kani: {
    top: ' V     V ',
    faces: { calm: " (='m'=) ", glad: " (/'m'/) ", sad: " (='m'=)?", shock: " (='m'=)?", tired: " (='m'=);" },
    feet: ' (")_(") ',
    masks: ['.r.....r.', '.k.....k.', '.kkkkkkk.'],
    colors: { r: '#e8566a', k: '#f29bb0' },
  },
  // Light grey armor; the pink pochette it made hangs at its side.
  pochette: {
    top: '  .---.  ',
    faces: ARMOR_FACES,
    feet: '  /|_|\\@ ',
    masks: ['..ggggg..', '..gg.gg..', '..gggggp.'],
    colors: { g: '#c9c9c9', p: '#f48fb1' },
  },
  // A big sky-blue tail and long cheek fur; the scowl is its resting face.
  momonga: {
    top: ' ,^   ^, ',
    faces: { calm: "<( `w' )>", glad: '<( *w* )>', sad: '<( >A< )>', shock: '<( >A< )>', tired: '<( -A- )>' },
    feet: ' (")_(")@',
    masks: ['.ss...ss.', 's.......s', '........s'],
    colors: { s: '#a8d8f0' },
  },
  // Grey-brown armor, and the bell it rings when work is posted.
  rodo: {
    top: '  .---.  ',
    faces: ARMOR_FACES,
    feet: '  /|_|\\A ',
    masks: ['..ttttt..', '..tt.tt..', '..ttttty.'],
    colors: { t: '#a89f91', y: '#f3dc6b' },
  },
}

export type Run = { text: string; color: Color | undefined }

const STEP: Readonly<Record<string, string>> = { '"': "'", '/': '\\', '\\': '/', '~': '-' }

/** The feet a step on: paws lifted, arms swung the other way, the tail flicked. */
const stepped = (feet: string): string => [...feet].map(char => STEP[char] ?? char).join('')

/**
 * A character's picture for a mood, each row as runs of one color, in the
 * tones of a dark terminal or a light one. `isStepping` is the other frame of
 * its walk: the same picture a step on.
 */
export const artRows = (id: MemberId, mood: Mood, isLight = false, isStepping = false): Run[][] => {
  const art = ARTS[id]

  return [art.top, art.faces[mood], isStepping ? stepped(art.feet) : art.feet].map((row, index) => {
    const mask = art.masks[index] ?? ''
    const runs: Run[] = []

    for (const [column, char] of [...row].entries()) {
      const own = art.colors[mask.charAt(column)]
      const color = own === undefined ? undefined : toneOf(own, isLight)
      const last = runs[runs.length - 1]

      if (last !== undefined && last.color === color) last.text += char
      else runs.push({ text: char, color })
    }

    return runs
  })
}

// ---- pixel icons: ten pixels by eight, two pixels to a cell

type Sprite = { rows: readonly string[]; colors: Readonly<Record<string, number>> }

const INK = 0x3a2d2d
const WHITE = 0xf7f3ea
const BLUSH = 0xf7a8c0

const armor = (plate: number, held: number): Sprite => ({
  rows: ['..GGGGGG..', '.GGGGGGGG.', '.GKKKKKKG.', '.GGGGGGGG.', '..GGGGGG..', '.GGGGGGGHH', '.GGGGGGGHH', '..GG..GG..'],
  colors: { G: plate, K: 0x2a2a2a, H: held },
})

export const SPRITES: Record<MemberId, Sprite> = {
  hachiware: {
    rows: ['.B......B.', 'BBB....BBB', 'BBBBWWBBBB', 'BBKWWWWKBB', 'WWWWKKWWWW', 'WWWWWWWWWW', '.WWWWWWWW.', '..WW..WWBB'],
    colors: { B: 0x5b8fd9, W: WHITE, K: INK },
  },
  chiikawa: {
    rows: ['.WW....WW.', 'WWWWWWWWWW', 'WWWWWWWWWW', 'WWKWWWWKWW', 'WPWWKKWWPW', 'WWWWWWWWWW', '.WWWWWWWW.', '..WW..WW..'],
    colors: { W: WHITE, K: INK, P: BLUSH },
  },
  usagi: {
    rows: ['.YY....YY.', '.YP....PY.', '.YP....PY.', '.YYYYYYYY.', 'YYKYYYYKYY', 'YYYYRRYYYY', '.YYYYYYYY.', '..YY..YY..'],
    colors: { Y: 0xf6e58d, P: BLUSH, K: INK, R: 0xe86a6a },
  },
  rakko: {
    rows: ['KK......KK', 'KLLLLLLLLK', 'LLLLLLLLLL', 'LLKLLLLKRL', 'LLLLKKLRRR', 'LLLLLLLLRL', 'KLLLLLLLLK', '..KK..KK..'],
    colors: { L: 0xf3e6a8, K: 0x2a2a2a, R: 0xd9534f },
  },
  shisa: {
    rows: ['.OOOOOOOO.', 'OOAAAAAAOO', 'OAAAAAAAAO', 'OAKAAAAKAO', 'OAAAKKAAAO', 'OOAAAAAAOO', '.OAAAAAAO.', '..AA..AA..'],
    colors: { O: 0xf08a24, A: 0xf6c9a0, K: INK },
  },
  kurimanju: {
    rows: ['..........', '.NNNNNNNN.', 'NNNNNNNNNN', 'EEEEEEEEEE', 'EEKEEEEKEE', 'EEEEKKEEEE', '.EEEEEEEE.', '..EE..EE..'],
    colors: { N: 0x8a5a2b, E: 0xf0dcb4, K: INK },
  },
  kani: {
    rows: ['R.R....R.R', 'RRR....RRR', '.HHHHHHHH.', 'PPPPPPPPPP', 'PPKPPPPKPP', 'PPPWKWKPPP', '.PPPPPPPP.', '..PP..PP..'],
    colors: { R: 0xe8566a, H: 0xf29bb0, P: 0xf9c9d4, K: INK, W: 0xffffff },
  },
  pochette: armor(0xc9c9c9, 0xf48fb1),
  momonga: {
    rows: ['.WS..SW.TT', 'WWWWWWWTTT', 'WWWWWWWTTT', 'WKWWWKWTTT', 'WWWKKWWTT.', 'WWWWWWWT..', '.WWWWWW...', '..W..W....'],
    colors: { W: WHITE, S: 0xa8d8f0, T: 0xa8d8f0, K: INK },
  },
  rodo: armor(0xa89f91, 0xf3dc6b),
}

export const ICON_COLUMNS = 10
export const ICON_ROWS = 4

const CLEAR = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584
const SPACE = 0x20
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const base64 = (bytes: Uint8Array): string => {
  let text = ''

  for (let at = 0; at < bytes.length; at += 3) {
    const a = bytes[at] ?? 0
    const b = bytes[at + 1] ?? 0
    const c = bytes[at + 2] ?? 0

    text += ALPHABET.charAt(a >> 2) + ALPHABET.charAt(((a & 3) << 4) | (b >> 4))
    text += at + 1 < bytes.length ? ALPHABET.charAt(((b & 15) << 2) | (c >> 6)) : '='
    text += at + 2 < bytes.length ? ALPHABET.charAt(c & 63) : '='
  }

  return text
}

/** A sprite as a Raster's cells: the upper pixel a cell's ink, the lower its ground. `ground` fills what the sprite leaves clear. */
const cellsOf = ({ rows, colors }: Sprite, ground: number): string => {
  const words: number[] = []
  const pixel = (row: number, column: number): number => colors[rows[row]?.charAt(column) ?? '.'] ?? ground

  for (let row = 0; row < ICON_ROWS; row += 1) {
    for (let column = 0; column < ICON_COLUMNS; column += 1) {
      const upper = pixel(row * 2, column)
      const lower = pixel(row * 2 + 1, column)

      if (upper === CLEAR && lower === CLEAR) words.push(SPACE, CLEAR, CLEAR)
      else if (upper === CLEAR) words.push(LOWER, lower, CLEAR)
      else words.push(UPPER, upper, lower)
    }
  }

  const bytes = new Uint8Array(words.length * 4)

  words.forEach((word, index) => new DataView(bytes.buffer).setUint32(index * 4, word, true))

  return base64(bytes)
}

// The sprites are pale creatures drawn for a dark terminal: on a light one
// each stands on a slate tile, or a white body would be lost against the page.
const TILE = 0x4f5868

/** The sprite a bounce on: a pixel lower, its feet under the edge. */
const bobbed = (sprite: Sprite): Sprite => ({ ...sprite, rows: ['.'.repeat(ICON_COLUMNS), ...sprite.rows.slice(0, -1)] })

const icons = new Map<string, string>()

/** A character's icon as a Raster's cells, for a dark terminal or a light one; `isBobbing` is the other frame of its bounce. */
export const iconOf = (id: MemberId, isLight = false, isBobbing = false): string => {
  const key = `${id}:${String(isLight)}:${String(isBobbing)}`
  const made = icons.get(key) ?? cellsOf(isBobbing ? bobbed(SPRITES[id]) : SPRITES[id], isLight ? TILE : CLEAR)

  icons.set(key, made)

  return made
}
