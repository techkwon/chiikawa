/**
 * The painted meadow: a second backdrop, drawn after two picture-book
 * paintings of one spring field (by day and by night) as plain vector shapes.
 * A blossoming tree at the left edge, two cream clouds, low hills, a round
 * bush on the horizon, a cottage with a red roof on its hill at the right and
 * a dirt path winding down from it, clover and daisies along the foot.
 *
 * One drawing, two palettes: night is a block of rules laid over the day
 * rules, with a moon, stars, fireflies and a lit window shown by them alone.
 * The middle, where the words are, is open sky and plain grass.
 *
 * One meadow, four seasons: spring is the drawing as it was first made, and
 * summer, autumn and winter are the same field with its own rules laid over
 * the spring ones and its own things on the tree, in the air and at the foot.
 */

/** The season the meadow is drawn in. */
export type PaintSeason = 'spring' | 'summer' | 'autumn' | 'winter'

/** Puts a number on a fixed grid of pseudo-random places, the same every time. */
const spot = (index: number, salt: number): number => {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453

  return x - Math.floor(x)
}

const round = (value: number): number => Math.round(value * 10) / 10

/** A place on an outline, with how far the arc leaving it bulges (when not the usual). */
type Dot = readonly [number, number, number?]

/**
 * A scalloped outline through the places given, clockwise: each stretch
 * bulges outward as one soft lobe, a little unevenly, the way a pencil draws
 * a cloud or a crown of leaves. An open one is closed by a straight foot.
 */
const scallop = (dots: readonly Dot[], bulge: number, salt: number, open = false): string => {
  const at = dots.map(([x, y], index): [number, number] => [x + (spot(index, salt) - 0.5) * 5, y + (spot(index, salt + 1) - 0.5) * 5])
  const count = open ? at.length - 1 : at.length
  const [startX, startY] = at[0] ?? [0, 0]
  let drawn = `M${round(startX)} ${round(startY)}`

  for (let index = 0; index < count; index++) {
    const [px, py] = at[index] ?? [0, 0]
    const [qx, qy] = at[(index + 1) % at.length] ?? [0, 0]
    const lobe = (dots[index]?.[2] ?? bulge) * (0.85 + spot(index, salt + 2) * 0.3)

    drawn += `Q${round((px + qx) / 2 + (qy - py) * lobe)} ${round((py + qy) / 2 - (qx - px) * lobe)} ${round(qx)} ${round(qy)}`
  }

  return `${drawn}Z`
}

/** A scalloped round shape about a point. */
const blob = (cx: number, cy: number, rx: number, ry: number, lobes: number, salt: number, bulge = 0.5): string =>
  scallop(
    Array.from({ length: lobes }, (_, index): Dot => {
      const angle = ((index + spot(index, salt + 3) * 0.4) / lobes) * Math.PI * 2
      const reach = 0.9 + spot(index, salt + 4) * 0.18

      return [cx + Math.cos(angle) * rx * reach, cy + Math.sin(angle) * ry * reach]
    }),
    bulge,
    salt,
  )

/** A scalloped dome standing on a flat foot: a bush. */
const dome = (cx: number, base: number, rx: number, ry: number, lobes: number, salt: number, bulge = 0.5): string =>
  scallop(
    Array.from({ length: lobes + 1 }, (_, index): Dot => {
      const angle = Math.PI + (index / lobes) * Math.PI
      const reach = index === 0 || index === lobes ? 1 : 0.88 + spot(index, salt + 4) * 0.2

      return [cx + Math.cos(angle) * rx * reach, base + Math.sin(angle) * ry * reach]
    }),
    bulge,
    salt,
    true,
  )

/** Small dots of blossom scattered over a bush. */
const dots = (cx: number, base: number, rx: number, ry: number, count: number, salt: number): string =>
  Array.from({ length: count }, (_, index) => {
    const angle = Math.PI + (0.12 + spot(index, salt) * 0.76) * Math.PI
    const reach = 0.25 + spot(index, salt + 1) * 0.55

    return `<circle class="bd" cx="${round(cx + Math.cos(angle) * rx * reach)}" cy="${round(base - 3 + Math.sin(angle) * ry * reach)}" r="${round(1.8 + spot(index, salt + 2) * 1.6)}"/>`
  }).join('')

/** A bush: its dome, a lighter patch of leaves, and blossom when it has any. */
const bush = (cx: number, base: number, rx: number, ry: number, salt: number, bloom = 0, kind = 'bs'): string =>
  `<path class="${kind}" d="${dome(cx, base, rx, ry, Math.max(4, Math.round(rx / 13)), salt)}"/><path class="${kind}l" d="${blob(cx - rx * 0.2, base - ry * 0.5, rx * 0.42, ry * 0.26, 5, salt + 9, 0.4)}"/>${dots(cx, base, rx, ry, bloom, salt + 20)}`

/** A five-petal blossom of the tree, about a point. */
const blossom = (x: number, y: number, size: number, turn: number): string =>
  `<g transform="translate(${x} ${y}) rotate(${turn})">${[0, 1, 2, 3, 4].map(petal => `<ellipse class="pt" cy="${round(-size * 0.56)}" rx="${round(size * 0.43)}" ry="${round(size * 0.5)}" transform="rotate(${petal * 72})"/>`).join('')}<circle class="pc" r="${round(size * 0.27)}"/>${size > 14 ? [0, 1, 2, 3, 4].map(petal => `<circle class="pd" cx="${round(Math.cos(petal * 1.257 + 0.6) * size * 0.4)}" cy="${round(Math.sin(petal * 1.257 + 0.6) * size * 0.4)}" r="1.3"/>`).join('') : ''}</g>`

/** A petal let go by the tree, drifting down and fading. */
const PETALS = Array.from({ length: 7 }, (_, index) => {
  const time = round(9 + spot(index, 61) * 7)

  return `<g transform="translate(${round(40 + spot(index, 62) * 230)} ${round(330 + spot(index, 63) * 140)})"><path class="pt fall" style="animation-duration:${time}s;animation-delay:-${round(spot(index, 64) * time)}s" d="M0 0q5 -7 10 0q-5 7 -10 0Z"/></g>`
}).join('')

/** A tuft of grass: a few blades from one root, swaying about it. */
const tuft = (x: number, y: number, h: number, salt: number, kind = ''): string =>
  `<g class="tuft${kind}" style="transform-origin:${x}px ${y}px;animation-delay:-${round(spot(salt, 71) * 3)}s"><path d="M${x} ${y}q-5 -${round(h * 0.6)} -${round(h * 0.45)} -${h}M${x} ${y}q1 -${round(h * 0.7)} ${round(h * 0.08)} -${round(h * 1.2)}M${x} ${y}q6 -${round(h * 0.55)} ${round(h * 0.5)} -${round(h * 0.9)}M${round(x + 5)} ${y}q5 -${round(h * 0.3)} ${round(h * 0.7)} -${round(h * 0.55)}"/></g>`

const LEAF = '<path class="cl" d="M0 0C-11 -5 -15 -17 -8 -22C-3 -25 0 -20 0 -18C0 -20 3 -25 8 -22C15 -17 11 -5 0 0Z"/><path class="cv" d="M0 -3V-15"/>'

/** A clover: three heart leaves on a thin stem, nodding about its root. */
const clover = (x: number, y: number, h: number, scale: number, salt: number, kind = ''): string =>
  `<g class="nod${kind}" style="transform-origin:${x}px ${y}px;animation-delay:-${round(spot(salt, 72) * 5)}s"><path class="st" d="M${x} ${y}q${round((spot(salt, 73) - 0.5) * 12)} -${round(h / 2)} 0 -${h}"/><g transform="translate(${x} ${y - h}) scale(${scale}) rotate(${Math.round(spot(salt, 74) * 40 - 20)})">${LEAF}<g transform="rotate(120)">${LEAF}</g><g transform="rotate(240)">${LEAF}</g></g></g>`

/** A daisy on its stem: white with thin petals, or yellow with round ones. */
const daisy = (x: number, y: number, h: number, scale: number, tone: number, salt: number, kind = ''): string => {
  const head =
    tone === 0
      ? [0, 1, 2, 3, 4, 5, 6, 7].map(petal => `<ellipse rx="2.9" ry="6" cy="-7" transform="rotate(${petal * 45})"/>`).join('')
      : [0, 1, 2, 3, 4].map(petal => `<circle cy="-5.6" r="4.6" transform="rotate(${petal * 72})"/>`).join('')
  const lean = round((spot(salt, 75) - 0.5) * 14)

  return `<g class="nod${kind}" style="transform-origin:${x}px ${y}px;animation-delay:-${round(spot(salt, 76) * 5)}s"><path class="st" d="M${x} ${y}q${lean} -${round(h / 2)} 0 -${h}M${x} ${round(y - h * 0.35)}q${round(8 * scale)} -${round(7 * scale)} ${round(12 * scale)} -${round(1 * scale)}"/><g class="d${tone}" transform="translate(${x} ${y - h}) scale(${scale})">${head}<circle class="dc" r="${tone === 0 ? 3.7 : 3}"/></g></g>`
}

/** [x, y, height, scale, tone or -1 for a clover, 1 when a narrow window leaves it out] */
type Plant = readonly [number, number, number, number, number, number?]

/** A cosmos on its thin stem: eight notched petals, pink, white or magenta. */
const cosmos = (x: number, y: number, h: number, scale: number, tone: number, salt: number): string => {
  const lean = round((spot(salt, 75) - 0.5) * 16)

  return `<g class="nod" style="transform-origin:${x}px ${y}px;animation-delay:-${round(spot(salt, 76) * 5)}s"><path class="st" d="M${x} ${y}q${lean} -${round(h / 2)} 0 -${h}M${x} ${round(y - h * 0.3)}l${round(9 * scale)} -${round(8 * scale)}M${x} ${round(y - h * 0.45)}l-${round(8 * scale)} -${round(7 * scale)}M${x} ${round(y - h * 0.6)}l${round(6 * scale)} -${round(6 * scale)}"/><g class="k${tone}" transform="translate(${x} ${y - h}) scale(${scale})">${[0, 1, 2, 3, 4, 5, 6, 7].map(petal => `<path d="M0 -2.5L-3.7 -10.5L-1.6 -12.6L0 -11.4L1.6 -12.6L3.7 -10.5Z" transform="rotate(${petal * 45})"/>`).join('')}<circle class="dc" r="2.9"/></g></g>`
}

/** A sunflower: a thick stem with two leaves, and a wide head that nods slowly. */
const sunflower = (x: number, y: number, h: number, scale: number, salt: number): string => {
  const lean = round((spot(salt, 77) - 0.5) * 12)
  const low = round(y - h * 0.34)
  const high = round(y - h * 0.58)

  return `<g class="nod" style="transform-origin:${x}px ${y}px;animation-duration:6.4s;animation-delay:-${round(spot(salt, 78) * 6)}s"><path class="st sf" d="M${x} ${y}q${lean} -${round(h / 2)} 0 -${h}"/><path class="sl" d="M${x} ${low}q-${round(15 * scale)} -${round(17 * scale)} -${round(32 * scale)} -${round(5 * scale)}q${round(16 * scale)} ${round(12 * scale)} ${round(32 * scale)} ${round(5 * scale)}ZM${x} ${high}q${round(14 * scale)} -${round(16 * scale)} ${round(29 * scale)} -${round(5 * scale)}q-${round(14 * scale)} ${round(11 * scale)} -${round(29 * scale)} ${round(5 * scale)}Z"/><g class="sun" transform="translate(${x} ${y - h}) scale(${scale})">${Array.from({ length: 12 }, (_, petal) => `<ellipse rx="4.3" ry="9.5" cy="-15.5" transform="rotate(${petal * 30})"/>`).join('')}<circle class="so" r="10"/><circle class="si" r="5.2"/></g></g>`
}

/** [x, y, height, scale] */
type Tall = readonly [number, number, number, number]

const sunflowers = (list: readonly Tall[]): string => list.map(([x, y, h, scale], index) => sunflower(x, y, h, scale, x + index)).join('')

const WEST_SUNS: readonly Tall[] = [[44, 872, 124, 1.2], [128, 912, 104, 1.05], [214, 950, 88, 0.92]]
const EAST_SUNS: readonly Tall[] = [[1250, 944, 98, 1], [1346, 904, 80, 0.86]]
const CORNER_SUNS: readonly Tall[] = [[1572, 966, 112, 1.1]]

/**
 * A plant as its season has it. Spring and summer keep the daisies and the clover; autumn turns the daisies to cosmos, and every
 * other clover with them; winter has none (the patches are not drawn then).
 */
const plant = ([x, y, h, scale, tone]: Plant, index: number, season: PaintSeason): string => {
  if (season !== 'autumn') return tone < 0 ? clover(x, y, h, scale, x + index) : daisy(x, y, h, scale, tone, x + index)
  if (tone >= 0) return cosmos(x, y, Math.round(h * 1.35), scale, tone, x + index)

  return index % 2 === 0 ? cosmos(x, y, Math.round(h * 0.9), scale * 0.9, 2, x + index) : clover(x, y, h, scale, x + index)
}

/**
 * The plants of a patch, the far ones first so the near ones stand before them: those a narrow window keeps, or those it leaves
 * out. Each is drawn as it stands among them all, whichever are asked for.
 */
const patch = (plants: readonly Plant[], isInner = false, season: PaintSeason = 'spring'): string =>
  [...plants]
    .sort((one, other) => one[1] - other[1])
    .map((one, index) => ((one[5] === 1) === isInner ? plant(one, index, season) : ''))
    .join('')

const WEST_PLANTS: readonly Plant[] = [
  [75, 735, 32, 0.9, 0], [154, 785, 28, 0.8, 0], [112, 792, 22, 0.7, 1], [46, 802, 20, 0.65, 1],
  [73, 882, 50, 1.25, 0], [34, 908, 40, 1.1, 0], [179, 916, 26, 0.8, 0], [295, 952, 42, 1.05, 0], [222, 978, 36, 1, 0], [352, 974, 34, 0.95, 1, 1],
  [125, 932, 62, 1.25, -1], [172, 968, 58, 1.1, -1], [78, 978, 60, 1.15, -1], [21, 990, 52, 1, -1], [258, 994, 40, 0.9, -1], [330, 998, 30, 0.8, -1, 1], [8, 860, 26, 0.75, -1],
]

/** Left of the path, at the foot. */
const EAST_PLANTS: readonly Plant[] = [
  [1217, 962, 40, 1, 0], [1261, 974, 44, 1.05, 0], [1332, 926, 30, 0.9, 1], [1373, 880, 26, 0.8, 1], [1396, 886, 32, 0.9, 0], [1180, 988, 24, 0.8, 0, 1],
  [1282, 952, 44, 1, -1], [1272, 996, 40, 1.05, -1], [1236, 998, 34, 0.9, -1], [1362, 928, 30, 0.8, -1], [1424, 852, 22, 0.7, -1],
]

/** Right of the path, in the corner. */
const CORNER_PLANTS: readonly Plant[] = [
  [1536, 988, 44, 1.15, 0], [1576, 962, 30, 0.9, 0], [1592, 1004, 30, 0.9, 1], [1560, 1004, 48, 1.2, -1], [1502, 1008, 36, 1, -1], [1596, 936, 26, 0.8, -1],
]

const WEST_TUFTS = [[234, 932, 34], [15, 884, 26], [140, 994, 30], [300, 994, 24], [195, 802, 16], [90, 778, 18], [-6, 772, 20], [118, 776, 16]] as const
const EAST_TUFTS = [[1200, 994, 20], [1320, 958, 22], [1442, 842, 16], [1108, 996, 16]] as const
const CORNER_TUFTS = [[1522, 1002, 26], [1586, 716, 14], [1572, 742, 12]] as const

const tufts = (list: readonly (readonly [number, number, number])[], kind = ''): string => list.map(([x, y, h], index) => tuft(x, y, h, x + index, kind)).join('')

/** Short pencil marks of grass in one side of the meadow, drawn as one path. */
const ticks = (from: number, to: number, count: number, salt: number, keep: (x: number, y: number) => boolean): string =>
  `<path class="tick" d="${Array.from({ length: count }, (_, index) => {
    const x = round(from + spot(index, salt) * (to - from))
    const y = round(668 + spot(index, salt + 1) * 320)
    const h = round(5 + ((y - 660) / 340) * 6)

    return keep(x, y) ? `M${x} ${y}l-2 -${h}M${round(x + 4)} ${y}l1 -${round(h * 1.2)}M${round(x + 8)} ${y}l3 -${h}` : ''
  }).join('')}"/>`

/** A few low tufts under the message box, so the foot is not bare. */
const FOOT = Array.from({ length: 7 }, (_, index) => tuft(round(470 + index * 100 + spot(index, 31) * 50), round(975 + spot(index, 32) * 20), round(9 + spot(index, 33) * 6), index + 40, ' low')).join('')

/** Stars gather at the top of the sky and thin out toward the middle, where the words are. */
const STARS = Array.from({ length: 76 }, (_, index) => {
  const x = round(spot(index, 1) * 1600)
  const depth = spot(index, 2)
  const y = round(10 + depth * depth * 450)
  const size = round(0.9 + spot(index, 3) * 1.1)
  const delay = `style="animation-delay:-${round(spot(index, 4) * 5)}s"`

  if (index % 4 !== 0) return `<circle class="star" cx="${x}" cy="${y}" r="${size}" ${delay}/>`

  const arm = round(size * 3.4)

  return `<path class="star" ${delay} d="M${x} ${round(y - arm)}Q${x} ${y} ${round(x + arm)} ${y}Q${x} ${y} ${x} ${round(y + arm)}Q${x} ${y} ${round(x - arm)} ${y}Q${x} ${y} ${x} ${round(y - arm)}Z"/>`
}).join('')

/** Fireflies of one bottom corner, lit at night alone. */
const fireflies = (from: number, salt: number, count = 6, top = 740, wide = 320, tall = 220): string =>
  Array.from({ length: count }, (_, index) => {
    const x = round(from + spot(index, salt) * wide)
    const y = round(top + spot(index, salt + 1) * tall)
    const time = round(5 + spot(index, salt + 2) * 4)

    return `<g class="fire" style="animation-duration:${time}s;animation-delay:-${round(spot(index, salt + 3) * time)}s"><circle class="fg" cx="${x}" cy="${y}" r="9"/><circle cx="${x}" cy="${y}" r="2.8"/></g>`
  }).join('')

/** A butterfly: its wings beat while it wanders a small loop. */
const butterfly = (x: number, y: number, tone: number, time: number): string =>
  `<g transform="translate(${x} ${y})"><g class="fly" style="animation-duration:${time}s"><g class="wing w${tone}"><path d="M0 -2C-6 -16 -19 -15 -17 -4C-16 2 -6 3 0 1C6 3 16 2 17 -4C19 -15 6 -16 0 -2Z"/><path d="M0 1C-7 2 -13 7 -9 12C-5 16 -1 9 0 4C1 9 5 16 9 12C13 7 7 2 0 1Z"/></g><path class="bug" d="M0 -8V9M0 -8q-3 -5 -6 -6M0 -8q3 -5 6 -6"/></g></g>`

/** A dragonfly: it hangs in the air, darts to another place and hangs there, its four wings a blur. */
const dragonfly = (x: number, y: number, time: number, delay: number, turn = 0): string =>
  `<g transform="translate(${x} ${y}) rotate(${turn})"><g class="dart" style="animation-duration:${time}s;animation-delay:-${delay}s"><g class="buzz"><ellipse class="dw" cx="3" cy="-12" rx="3.2" ry="12" transform="rotate(14 3 0)"/><ellipse class="dw" cx="-3" cy="-11" rx="3" ry="11" transform="rotate(-16 -3 0)"/><ellipse class="dw" cx="3" cy="12" rx="3.2" ry="12" transform="rotate(-14 3 0)"/><ellipse class="dw" cx="-3" cy="11" rx="3" ry="11" transform="rotate(16 -3 0)"/></g><path class="db" d="M-22 0H7"/><circle class="dh" cx="9.5" r="3.4"/></g></g>`

const LEAF_SHAPE = 'M0 0Q3 -10 14 -8Q12 3 0 0ZM0 0L-5 3'

/** Leaves let go by the tree in autumn: each falls from side to side, turning over and over. */
const LEAVES = Array.from({ length: 10 }, (_, index) => {
  const time = round(8 + spot(index, 65) * 7)

  return `<g transform="translate(${round(20 + spot(index, 66) * 260)} ${round(300 + spot(index, 67) * 170)})"><path class="lv${index % 3} fall leaf" style="animation-duration:${time}s;animation-delay:-${round(spot(index, 68) * time)}s" d="${LEAF_SHAPE}"/></g>`
}).join('')

/** Leaves already down, lying where they fell about the foot of the tree. */
const FALLEN = Array.from(
  { length: 12 },
  (_, index) => `<path class="lv${index % 3}" transform="translate(${round(6 + spot(index, 91) * 330)} ${round(772 + spot(index, 92) * 200)}) rotate(${Math.round(spot(index, 93) * 360)})" d="${LEAF_SHAPE}"/>`,
).join('')

/** Dandelion fluff on a summer day: seeds lifted off the grass, carried up and along. */
const fluff = (from: number, top: number, count: number, salt: number): string =>
  Array.from({ length: count }, (_, index) => {
    const time = round(13 + spot(index, salt) * 9)

    return `<g transform="translate(${round(from + spot(index, salt + 1) * 300)} ${round(top + spot(index, salt + 2) * 170)})"><path class="fall fluff" style="animation-duration:${time}s;animation-delay:-${round(spot(index, salt + 3) * time)}s" d="M0 0v10M0 0l-6 -3M0 0l6 -3M0 0l-4 -6M0 0l4 -6M0 0v-7"/></g>`
  }).join('')

/**
 * Snow over the whole picture, in three depths. Each depth is one sheet of flakes drawn twice, the second a whole picture's height
 * above the first, and the pair slides down by exactly that height: where it ends is where it began, so the fall never jumps.
 * Only the three pairs move; no flake is moved alone.
 */
const snowfall = (count: number, small: number, large: number, time: number, salt: number): string => {
  const flakes = (lift: number): string =>
    Array.from({ length: count }, (_, index) => `<circle cx="${round(-70 + spot(index, salt) * 1670 - (lift === 0 ? 0 : 60))}" cy="${round(spot(index, salt + 1) * 1000 - lift)}" r="${round(small + spot(index, salt + 2) * (large - small))}"/>`).join('')

  return `<g class="snow" style="animation-duration:${time}s;animation-delay:-${round(spot(salt, 5) * time)}s">${flakes(0)}${flakes(1000)}</g>`
}

const SNOW = `${snowfall(20, 1.2, 2, 27, 201)}${snowfall(15, 2, 3.2, 18, 211)}${snowfall(10, 3.2, 4.6, 12, 221)}`

/** [middle, foot, half width, height] */
type Mound = readonly [number, number, number, number]

/** Low heaps of snow where the flowers stand in the other seasons. */
const mounds = (list: readonly Mound[]): string => list.map(([cx, base, rx, ry], index) => `<path class="sm" d="${dome(cx, base, rx, ry, 4, cx + index, 0.24)}"/>`).join('')

const WEST_MOUNDS: readonly Mound[] = [[150, 792, 40, 12], [26, 812, 44, 15], [76, 906, 64, 22], [214, 962, 74, 24], [318, 994, 50, 15]]
const EAST_MOUNDS: readonly Mound[] = [[1396, 884, 36, 12], [1338, 934, 46, 15], [1250, 980, 66, 22]]
const CORNER_MOUNDS: readonly Mound[] = [[1592, 942, 30, 11], [1548, 994, 58, 20]]

const CLOUD_WEST: readonly Dot[] = [
  [-22, 138], [-6, 94], [44, 70], [86, 34], [152, 20], [214, 42], [240, 82], [292, 86], [332, 116, 0.6], [312, 150, 0.16], [240, 160, 0.14], [160, 150, 0.16], [90, 160, 0.14], [20, 156, 0.3],
]

const CLOUD_EAST: readonly Dot[] = [
  [1256, 264], [1282, 240], [1332, 238], [1366, 214], [1400, 180], [1422, 140], [1480, 118], [1542, 126], [1602, 150], [1650, 192], [1662, 250, 0.5], [1602, 276, 0.14], [1502, 270, 0.16], [1422, 280, 0.14], [1332, 272, 0.2], [1282, 282, 0.4],
]

/** The summer cloud at the right: a tall cumulus, flat at its foot and piled up in heads. */
const CLOUD_TALL: readonly Dot[] = [
  [1330, 300], [1344, 262], [1386, 246], [1396, 204], [1434, 180], [1440, 134], [1482, 104], [1500, 62], [1556, 38], [1612, 56], [1634, 100], [1676, 120], [1690, 170], [1724, 196], [1740, 252, 0.5],
  [1700, 296, 0.14], [1610, 290, 0.16], [1520, 300, 0.14], [1430, 292, 0.2], [1370, 304, 0.4],
]

/** A cloud, drifting a little way and back. */
const cloud = (shape: readonly Dot[], salt: number, lines: string, time: number, delay: number): string =>
  `<g class="drift" style="animation-duration:${time}s;animation-delay:-${delay}s"><path class="cd" fill="url(#cloud)" d="${scallop(shape, 0.55, salt)}"/><path class="cdl" d="${lines}"/></g>`

/**
 * The tree at the left edge. It is drawn whole, past the edge of the picture,
 * so it stays a tree when a narrow window brings the corner inward. The trunk
 * stands still; the boughs, leaves and blossoms sway about the fork.
 */
const BOUGHS = ['M44 505Q64 432 150 384Q204 356 256 342', 'M42 490Q52 404 72 332Q84 290 112 250', 'M36 484Q22 404 -14 350Q-40 316 -70 300']
const TWIGS = ['M122 400Q156 424 218 428', 'M76 322Q122 302 164 292', 'M168 374Q192 332 202 300', 'M-2 368Q-10 310 4 262', 'M96 276Q70 236 56 210', 'M208 362Q240 372 262 392']

const LEAVES_OF_TREE = `<path class="lf0" d="${blob(92, 312, 208, 186, 17, 7, 0.52)}"/>
<path class="lfd" d="${blob(40, 380, 80, 60, 7, 8, 0.45)}"/><path class="lfd" d="${blob(170, 350, 70, 46, 7, 9, 0.45)}"/>
<path class="bo b1" d="${BOUGHS.join('')}"/><path class="bo b2" d="${TWIGS.join('')}"/><path class="bi b1" d="${BOUGHS.join('')}"/><path class="bi b2" d="${TWIGS.join('')}"/>
<path class="lf1" d="${blob(64, 226, 86, 62, 9, 11)}"/><path class="lf1" d="${blob(196, 282, 74, 56, 8, 12)}"/><path class="lf1" d="${blob(-40, 262, 70, 60, 8, 13)}"/><path class="lf1" d="${blob(212, 424, 64, 44, 7, 14)}"/><path class="lf1" d="${blob(112, 452, 56, 34, 6, 15)}"/><path class="lf1" d="${blob(-24, 420, 52, 40, 6, 16)}"/><path class="lf1" d="${blob(130, 168, 60, 34, 6, 17)}"/>
<path class="lf2" d="${blob(70, 204, 44, 26, 5, 21, 0.4)}"/><path class="lf2" d="${blob(206, 264, 36, 22, 5, 22, 0.4)}"/><path class="lf2" d="${blob(216, 412, 30, 18, 5, 23, 0.4)}"/><path class="lf2" d="${blob(-36, 240, 34, 22, 5, 24, 0.4)}"/>`

const BLOSSOMS = `${blossom(30, 344, 30, 8)}${blossom(108, 292, 21, 30)}${blossom(14, 216, 19, -12)}${blossom(88, 226, 12, 20)}${blossom(170, 312, 12, 50)}${blossom(180, 440, 11, 0)}${blossom(216, 420, 9, 36)}${blossom(62, 252, 9, 64)}${blossom(150, 208, 11, 14)}${blossom(240, 318, 10, 40)}${blossom(-50, 300, 16, 22)}`

/** Patches of the crown that have gone red in autumn, where the blossoms were. */
const RED_LEAVES = [[150, 250, 42, 26, 31], [8, 304, 38, 26, 32], [232, 378, 30, 20, 33], [92, 402, 34, 20, 34], [-34, 344, 28, 20, 35], [116, 176, 30, 16, 36]]
  .map(([x = 0, y = 0, rx = 0, ry = 0, salt = 0]) => `<path class="lf3" d="${blob(x, y, rx, ry, 6, salt, 0.42)}"/>`)
  .join('')

/** The thin ends of the boughs, seen once the leaves are down. */
const BARE_TWIGS = ['M256 342Q290 330 318 300', 'M256 342Q296 352 322 372', 'M112 250Q120 204 150 172', 'M112 250Q92 214 96 170', 'M-70 300Q-100 280 -110 250', 'M150 384Q150 340 130 316', 'M164 292Q200 280 222 250', 'M56 210Q40 180 44 150', 'M202 300Q230 286 246 262', 'M218 428Q256 432 280 452', 'M4 262Q-20 232 -22 200', 'M262 392Q290 396 306 418', 'M72 332Q30 318 6 290', 'M150 172Q170 150 196 144']

/** Snow lying in the forks and on the ends of the bare boughs. */
const SNOW_CAPS = [[256, 336, 20, 8], [112, 244, 18, 8], [164, 287, 16, 7], [202, 295, 14, 6], [56, 205, 15, 7], [218, 423, 17, 7], [150, 168, 14, 6], [318, 297, 13, 6], [4, 257, 14, 6], [96, 166, 12, 6], [-70, 296, 16, 7], [322, 369, 12, 5], [44, 478, 22, 8]]
  .map(([x = 0, y = 0, rx = 0, ry = 0], index) => `<path class="sc" d="${blob(x, y, rx, ry, 5, 140 + index, 0.36)}"/>`)
  .join('')

/** What sways about the fork, by season: the crown in leaf (in blossom, or turned red in places), or the bare boughs under snow. */
const CROWN: Record<PaintSeason, string> = {
  spring: `${LEAVES_OF_TREE}\n${BLOSSOMS}`,
  summer: LEAVES_OF_TREE,
  autumn: `${LEAVES_OF_TREE}\n${RED_LEAVES}`,
  winter: `<path class="bo b1" d="${BOUGHS.join('')}"/><path class="bo b2" d="${TWIGS.join('')}"/><path class="bo b3" d="${BARE_TWIGS.join('')}"/><path class="bi b1" d="${BOUGHS.join('')}"/><path class="bi b2" d="${TWIGS.join('')}"/><path class="bi b3" d="${BARE_TWIGS.join('')}"/>
<path class="sn s1" transform="translate(-1 -5)" d="${BOUGHS.join('')}"/><path class="sn s2" transform="translate(0 -2.5)" d="${TWIGS.join('')}"/>
${SNOW_CAPS}`,
}

const tree = (season: PaintSeason): string => `<g class="sway" style="transform-origin:44px 500px">
${CROWN[season]}
</g>
<path class="tk" d="M-44 774C-12 760 6 720 12 660C18 590 20 540 26 474L64 482C60 540 62 600 70 668C76 716 94 752 132 772C92 780 70 772 52 764C40 776 8 780 -44 774Z"/>
<path class="tke" d="M26 478C20 540 18 590 12 660C6 720 -12 760 -44 774M64 486C60 540 62 600 70 668C76 716 94 752 132 772M52 764Q44 742 46 716"/>
<path class="tkl" d="M32 520Q28 600 22 684M48 544Q50 622 58 704M40 600Q40 664 38 730M24 716Q14 748 -8 764"/>`

/** The cottage, drawn about the left foot of its gable wall. */
const cottage = (season: PaintSeason): string => {
  const isSnowy = season === 'winter'
  /** Snow on the chimney and smoke rising from it, on the roof with a scalloped lower edge, and along the gable. */
  const cap = isSnowy
    ? `<path class="snr" d="M93 -103q3 -9 15 -9q12 0 15 9Z"/>${[0, 2.3, 4.6].map(delay => `<circle class="smoke" cx="108" cy="-120" r="7" style="transform-origin:108px -120px;animation-delay:-${delay}s"/>`).join('')}`
    : ''
  const roof = isSnowy ? '<path class="snr" d="M27 -86L183 -84L199 -52Q190 -46 182 -53Q172 -44 160 -52Q150 -44 138 -51Q128 -43 116 -51Q106 -44 94 -50Q86 -45 78 -50L58 -50Z"/>' : ''
  const gable = isSnowy ? '<path class="sne" d="M-7 -42L32 -85L69 -43"/>' : ''

  return `<g transform="translate(1466 598)"><g>
<path class="chim" d="M100 -98h16v30h-16Z"/><path class="chim" d="M96 -104h24v8h-24Z"/>${cap}
<path class="wall2" d="M62 -42H186V0H62Z"/>
<path class="roof" d="M30 -82L180 -80L202 -38L68 -38Z"/>
<path class="tile" d="M70 -66h12M96 -70h12M124 -64h12M152 -70h12M86 -52h12M114 -50h12M144 -54h12M172 -50h10"/>${roof}
<path class="wall" d="M0 0V-42L32 -76L64 -42V0Z"/>
<path class="eave" d="M-9 -35L32 -80L71 -36"/><path class="eave2" d="M-9 -35L32 -80L71 -36"/>${gable}
<path class="win" d="M18 -34h28v24h-28Z"/><path class="bar" d="M32 -34v24M18 -22h28"/>
<path class="win" d="M98 -30h22v18h-22Z"/><path class="bar" d="M109 -30v18M98 -21h22"/>
<path class="sill" d="M15 -9h34M95 -11h28"/>
</g><circle class="lit" cx="32" cy="-22" r="74" fill="url(#lamp)"/></g>`
}

/** How the meadow looks at night: laid over the day rules. */
const NIGHT = `.sk0{stop-color:#1b2462}.sk1{stop-color:#232e73}.sk2{stop-color:#2e3d84}
.wash{opacity:.05}
.c0{stop-color:#46529c}.c1{stop-color:#353f86}.cd{stroke:#262f6c}.cdl{stroke:#2c3678}
.h0{fill:#2c5373;stroke:#22425f}.h1{fill:#294b6d;stroke:#22425f}
.m0{stop-color:#2f6c6c}.m1{stop-color:#2d6664}.m2{stop-color:#2a5d5e}.md{stroke:#22504f}.mdl{stroke:#255553}.mo{stop-color:#327170}.mnd{stroke:#22504f}
.tick{stroke:#3a7f70}.tuft path{stroke:#3f8c74}.st{stroke:#3c8570}
.bs{fill:#37766b;stroke:#235450}.bsl{fill:#42866f}.bd{fill:#cf93ad}.bp{fill:#a678a0;stroke:#775382}.bpl{fill:#b98ab0}
.path{fill:#7f769b;stroke:#5c557f}.peb{fill:#6a6288}
.wall{fill:#8189b0;stroke:#4c5281}.wall2{fill:#6d75a0;stroke:#4c5281}.roof{fill:#9c4f61;stroke:#6c3348}.tile{stroke:#7c3c52}.eave{stroke:#6c3348}.eave2{stroke:#a85a6c}.chim{fill:#7b6b88;stroke:#514768}
.win{fill:#ffd972;stroke:#b98a3c}.bar{stroke:#c9963f}.sill{stroke:#4c5281}.lit{display:inline}
.tk{fill:#7c6267}.tke{stroke:#503e4c}.tkl{stroke:#665058}.bo{stroke:#503e4c}.bi{stroke:#7c6267}
.lf0{fill:#2f6d69;stroke:#224f50}.lfd{fill:#2a6261}.lf1{fill:#3d8273;stroke:#265754}.lf2{fill:#4a927c}
.pt{fill:#eeb0c3;stroke:#b6728e}.pc{fill:#f3c987;stroke:#c08a5c}.pd{fill:#c9805e}
.cl{fill:#3f9172;stroke:#286454}.cv{stroke:#5fae8a}
.d0 ellipse{fill:#e2e6f3;stroke:#8990b6}.d1 circle{fill:#e8d27c;stroke:#a8924e}.d0 .dc,.d1 .dc{fill:#f1c95e;stroke:#b98a3c}
.star,.moon,.halo,.fire{display:inline}.fly{display:none}
`

/** When the meadow is drawn: following the app's mode, or always by day or by night. */
export type PaintTime = 'auto' | 'day' | 'night'

/** Each season's own day rules, laid over the spring ones; its moving things' rules are here too. Spring has none. */
const SEASON_DAY: Record<PaintSeason, string> = {
  spring: '',
  summer: `.sk0{stop-color:#4fa9ec}.sk1{stop-color:#86c8f4}.sk2{stop-color:#cdeaf9}
.wash{opacity:.2}
.c0{stop-color:#fff}.c1{stop-color:#dfeefa}.cd{stroke:#bcd3e8}.cdl{stroke:#cfe0ef}
.h0{fill:#93d3a2;stroke:#69b581}.h1{fill:#80c993;stroke:#69b581}
.m0{stop-color:#a8de7c}.m1{stop-color:#95d36a}.m2{stop-color:#a2d976}.md{stroke:#6fb552}.mdl{stroke:#7dbd5d}.mo{stop-color:#a0d874}.mnd{stroke:#6fb552}
.tick{stroke:#63b04b}.tuft path{stroke:#4c9f3e}.st{stroke:#4a9a40}
.bs{fill:#7cc468;stroke:#4f9a4c}.bsl{fill:#98d67c}.bd{fill:#fff3a8}.bp{fill:#aab7f1;stroke:#7a86cf}.bpl{fill:#c6cff8}
.lf0{fill:#5fae5a;stroke:#3f8a48}.lfd{fill:#509d50}.lf1{fill:#7cc468;stroke:#4f9a4c}.lf2{fill:#9ad67e}
.cl{fill:#84c878;stroke:#4c9a54}
.w0 path{fill:#d9ecff;stroke:#8fb4e0}
.sun ellipse{fill:#ffd23f;stroke:#d99a1c;stroke-width:1.2}.so{fill:#8a5a2b;stroke:#6b4320;stroke-width:1.4}.si{fill:#a8743a}.sl{fill:#6dbb5a;stroke:#4c9a54;stroke-width:1.6}.sf{stroke-width:3.2}
.fluff{fill:none;stroke:#fff;stroke-width:1.5;animation-name:float}
@keyframes float{0%{opacity:0;transform:translate(0,0) rotate(-12deg)}12%{opacity:.95}50%{transform:translate(130px,-80px) rotate(10deg)}88%{opacity:.8}100%{opacity:0;transform:translate(280px,-130px) rotate(-8deg)}}
`,
  autumn: `.sk0{stop-color:#9fc6e8}.sk1{stop-color:#c6ddee}.sk2{stop-color:#f4e7d0}
.c0{stop-color:#fffaf0}.c1{stop-color:#f9dcc0}.cd{stroke:#e3c4a6}.cdl{stroke:#efd3b6}
.h0{fill:#dccf8e;stroke:#bfa864}.h1{fill:#d3bf7a;stroke:#bfa864}
.m0{stop-color:#e6d48c}.m1{stop-color:#dcc67a}.m2{stop-color:#e3cf88}.md{stroke:#bfa25a}.mdl{stroke:#c8ab62}.mo{stop-color:#e2cf86}.mnd{stroke:#bfa25a}
.tick{stroke:#b89a4e}.tuft path{stroke:#a98a44}.st{stroke:#8f9a4e}
.bs{fill:#e6ab5a;stroke:#b97a35}.bsl{fill:#f2c474}.bd{fill:#c8452f}.bp{fill:#dc6a4e;stroke:#a8442f}.bpl{fill:#ea8f6c}
.lf0{fill:#e98d3c;stroke:#b9601f}.lfd{fill:#d9742e}.lf1{fill:#f5b24c;stroke:#c9802a}.lf2{fill:#fad26c}.lf3{fill:#de5c3c;stroke:#b03f2a;stroke-width:1.8}
.cl{fill:#c6b662;stroke:#8e8440}.cv{stroke:#e8de9c}
.lv0{fill:#e8622c;stroke:#b3441c}.lv1{fill:#f2a93b;stroke:#c07c20}.lv2{fill:#cf4a34;stroke:#9c3324}.lv0,.lv1,.lv2{stroke-width:1.2}
.leaf{animation-name:leaf}
.k0 path{fill:#f7a3c6;stroke:#d0669a}.k1 path{fill:#fff6fa;stroke:#d9b0c4}.k2 path{fill:#dc5a9e;stroke:#a83a78}.k0 path,.k1 path,.k2 path{stroke-width:1.1}.k0 .dc,.k1 .dc,.k2 .dc{fill:#f8d45e;stroke:#d8a546;stroke-width:1.2}
.dart{animation:dart ease-in-out infinite}.buzz{animation:buzz .16s linear infinite}.dw{fill:#fff;opacity:.75;stroke:#9fb0c0;stroke-width:1}.db{fill:none;stroke:#c8452f;stroke-width:2.6}.dh{fill:#c8452f}
.mc{stroke:none}
@keyframes leaf{0%{opacity:0;transform:translate(0,0) rotate(0)}8%{opacity:1}30%{transform:translate(72px,96px) rotate(210deg)}60%{transform:translate(38px,236px) rotate(430deg)}88%{opacity:.9}100%{opacity:0;transform:translate(118px,404px) rotate(720deg)}}
@keyframes dart{0%,22%{transform:translate(0,0)}30%,52%{transform:translate(92px,-34px)}60%,82%{transform:translate(38px,-76px)}90%,100%{transform:translate(0,0)}}
@keyframes buzz{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.35)}}
`,
  winter: `.sk0{stop-color:#a9c1dc}.sk1{stop-color:#c6d6e8}.sk2{stop-color:#e6edf5}
.wash{opacity:.3}
.c0{stop-color:#fff}.c1{stop-color:#dde5ee}.cd{stroke:#bfcbd9}.cdl{stroke:#ced8e3}
.h0{fill:#e4edf6;stroke:#b6c7da}.h1{fill:#d9e5f1;stroke:#b6c7da}
.m0{stop-color:#f3f8fc}.m1{stop-color:#e6eff8}.m2{stop-color:#eff5fb}.md{stroke:#b4c6db}.mdl{stroke:#c0d0e2}.mo{stop-color:#f1f6fb}.mnd{stroke:#b4c6db}
.tick{stroke:#c3d2e3}.tuft path{stroke:#b9a887}
.bs{fill:#e3ecf5;stroke:#a6bace}.bsl{fill:#fff}.bd{fill:#d9534f}.bp{fill:#e9f0f7;stroke:#a6bace}.bpl{fill:#fff}
.path{fill:#dde5ee;stroke:#b0c0d2}.peb{fill:#b9c5d3}
.win{fill:#ffe08a;stroke:#b98a3c}.bar{stroke:#c9963f}
.tk{fill:#bfa48c}.tke{stroke:#93775f}.tkl{stroke:#a88c74}.bo{stroke:#93775f}.bi{stroke:#bfa48c}.bo.b3{stroke-width:4.6}.bi.b3{stroke-width:2.2}
.sn{fill:none;stroke:#fff}.sn.s1{stroke-width:6}.sn.s2{stroke-width:3.4}
.sc,.sm,.snr{fill:#fff;stroke:#a9bdd2;stroke-width:1.6}.sne{fill:none;stroke:#fff;stroke-width:6}
.smoke{fill:#fff;opacity:0;animation:puff 7s ease-out infinite}
.snow{animation:snow linear infinite}.snow circle{fill:#fff;stroke:#b3c6dc;stroke-width:.8}
@keyframes snow{from{transform:translate(0,0)}to{transform:translate(60px,1000px)}}
@keyframes puff{0%{opacity:0;transform:translate(0,0) scale(.5)}15%{opacity:.75}100%{opacity:0;transform:translate(34px,-84px) scale(1.9)}}
`,
}

/** Each season's own night rules, laid over the spring night. */
const SEASON_NIGHT: Record<PaintSeason, string> = {
  spring: '',
  summer: `.sk0{stop-color:#141c5c}.sk1{stop-color:#1c2b72}.sk2{stop-color:#28457f}
.wash{opacity:.05}
.c0{stop-color:#46529c}.c1{stop-color:#353f86}.cd{stroke:#262f6c}.cdl{stroke:#2c3678}
.h0{fill:#2c5373;stroke:#22425f}.h1{fill:#294b6d;stroke:#22425f}
.m0{stop-color:#2f6c6c}.m1{stop-color:#2d6664}.m2{stop-color:#2a5d5e}.md{stroke:#22504f}.mdl{stroke:#255553}.mo{stop-color:#327170}.mnd{stroke:#22504f}
.tick{stroke:#3a7f70}.tuft path{stroke:#3f8c74}.st{stroke:#3c8570}
.bs{fill:#2f7064;stroke:#1f4f4a}.bsl{fill:#3a806a}.bd{fill:#c9c27c}.bp{fill:#7d85c4;stroke:#555c98}.bpl{fill:#959dd6}
.lf0{fill:#245f55;stroke:#1b4744}.lfd{fill:#205650}.lf1{fill:#2f7361;stroke:#1f4f48}.lf2{fill:#3b846c}
.cl{fill:#3f9172;stroke:#286454}
.sun ellipse{fill:#d9b654;stroke:#9a7a34}.so{fill:#5c4335;stroke:#40302a}.si{fill:#70523c}.sl{fill:#3a8468;stroke:#286454}
.fluff{display:none}
`,
  autumn: `.sk0{stop-color:#171c50}.sk1{stop-color:#272f6c}.sk2{stop-color:#453f78}
.c0{stop-color:#5a5494}.c1{stop-color:#453f7c}.cd{stroke:#322c66}.cdl{stroke:#3a3470}
.h0{fill:#4b5068;stroke:#3a3f56}.h1{fill:#454a62;stroke:#3a3f56}
.m0{stop-color:#665f4c}.m1{stop-color:#5c5648}.m2{stop-color:#544f46}.md{stroke:#454036}.mdl{stroke:#4c473a}.mo{stop-color:#696250}.mnd{stroke:#454036}
.tick{stroke:#857a52}.tuft path{stroke:#94864f}.st{stroke:#7f8052}
.bs{fill:#8a6248;stroke:#5a3e34}.bsl{fill:#9f7652}.bd{fill:#b04a3e}.bp{fill:#8f4e4a;stroke:#62343a}.bpl{fill:#a66258}
.lf0{fill:#8e4f3a;stroke:#5f3230}.lfd{fill:#7e4436}.lf1{fill:#ab6a40;stroke:#74402e}.lf2{fill:#c48a4c}.lf3{fill:#93403a;stroke:#662a30}
.cl{fill:#77744c;stroke:#504e38}.cv{stroke:#98966a}
.lv0{fill:#b3542e;stroke:#7c3822}.lv1{fill:#c28a3c;stroke:#8a6026}.lv2{fill:#9a3c30;stroke:#6c2a24}
.k0 path{fill:#c98aae;stroke:#8e5a82}.k1 path{fill:#d9d6e8;stroke:#8f8cae}.k2 path{fill:#a8508a;stroke:#74386a}
.moon{fill:#f6c463;stroke:#d39a3a}.mc{fill:#e3a646;opacity:.7}
.dart{display:none}
`,
  winter: `.sk0{stop-color:#0f1a4c}.sk1{stop-color:#1a2a68}.sk2{stop-color:#2b4382}
.wash{opacity:.05}
.c0{stop-color:#4a5aa2}.c1{stop-color:#38468c}.cd{stroke:#2a3878}.cdl{stroke:#303e80}
.h0{fill:#4c60a0;stroke:#37498a}.h1{fill:#465a9a;stroke:#37498a}
.m0{stop-color:#566aa6}.m1{stop-color:#4d619e}.m2{stop-color:#5266a2}.md{stroke:#3a4d8c}.mdl{stroke:#42559a}.mo{stop-color:#586ca8}.mnd{stroke:#3a4d8c}
.tick{stroke:#6076b2}.tuft path{stroke:#8f88a0}
.bs{fill:#6177b4;stroke:#3f5290}.bsl{fill:#7d92c8}.bd{fill:#c8566a}.bp{fill:#687dba;stroke:#3f5290}.bpl{fill:#8398cc}
.path{fill:#4a5c98;stroke:#394a86}.peb{fill:#3f5190}
.win{fill:#ffd972;stroke:#b98a3c}.bar{stroke:#c9963f}
.tk{fill:#6e5d74}.tke{stroke:#473a56}.tkl{stroke:#5a4b66}.bo{stroke:#473a56}.bi{stroke:#6e5d74}
.sn{stroke:#a9b9e4}.sc,.sm,.snr{fill:#8fa3d6;stroke:#5a6ea8}.sne{stroke:#9aaddc}
.smoke{fill:#8494c8}
.snow circle{fill:#e4ebfb;stroke:none;opacity:.85}
`,
}

/** The night rules of a scene: none by day, always by night, or only while the app is dark. */
const nightRules = (time: PaintTime, season: PaintSeason): string => {
  const night = `${NIGHT}${SEASON_NIGHT[season]}`

  return time === 'day' ? '' : time === 'night' ? night : `@media (prefers-color-scheme:dark){\n${night}}`
}

/** The moon and its glow: a thin crescent, set further left in summer to clear the tall cloud, and a wide amber harvest moon in autumn. */
const moon = (season: PaintSeason): string => {
  if (season === 'autumn') {
    return '<circle class="halo" cx="1160" cy="128" r="190" fill="url(#amber)"/><g class="moon" transform="translate(1160 128)"><circle r="60"/><circle class="mc" cx="-20" cy="-14" r="11"/><circle class="mc" cx="16" cy="18" r="15"/><circle class="mc" cx="22" cy="-26" r="7"/><circle class="mc" cx="-16" cy="27" r="6"/></g>'
  }
  const [x, y] = season === 'summer' ? ([1236, 86] as const) : ([1385, 96] as const)

  return `<circle class="halo" cx="${x}" cy="${y}" r="120" fill="url(#halo)"/><path class="moon" transform="translate(${x} ${y})" d="M8 -33A34 34 0 1 1 -33 8A29.5 29.5 0 0 0 8 -33Z"/>`
}

/** What a season adds to the shared paints. */
const SEASON_DEFS: Record<PaintSeason, string> = {
  spring: '',
  summer: '',
  autumn: '<radialGradient id="amber"><stop offset=".3" stop-color="#f8c25e" stop-opacity=".42"/><stop offset="1" stop-color="#f8c25e" stop-opacity="0"/></radialGradient>\n',
  winter: '',
}

const EAST_CLOUD_LINES = 'M1420 180q26 -22 58 -10M1500 160q34 -16 62 6M1330 252q30 -14 58 0M1450 232q44 -12 84 4M1570 210q30 -8 50 10'

/** The cloud at the right: the tall cumulus in summer, the low one otherwise. */
const eastCloud = (season: PaintSeason): string =>
  season === 'summer'
    ? cloud(CLOUD_TALL, 4, 'M1500 62q30 -18 60 -4M1440 136q28 -16 54 -2M1600 110q30 -10 52 10M1400 206q30 -14 58 0M1520 180q44 -14 84 4M1650 190q30 -8 50 12M1380 262q40 -12 76 2M1560 250q50 -10 90 6', 96, 30)
    : cloud(CLOUD_EAST, 3, EAST_CLOUD_LINES, 78, 30)

/** What is let go into the air beside the tree: petals, fluff, leaves; in winter the snow has a layer of its own. */
const FALLING: Record<PaintSeason, string> = { spring: PETALS, summer: fluff(60, 720, 5, 161), autumn: LEAVES, winter: '' }

/** The right-hand corner by the path: its tufts, plants and night lights. */
const cornerFoot = (season: PaintSeason): string => {
  if (season === 'winter') return `${tufts(CORNER_TUFTS)}${mounds(CORNER_MOUNDS)}`

  return `${tufts(CORNER_TUFTS)}${season === 'summer' ? sunflowers(CORNER_SUNS) : ''}${patch(CORNER_PLANTS, false, season)}${fireflies(1260, 51)}`
}

/** The foot at the left, under the tree. Summer has more fireflies, further in. */
const westFoot = (season: PaintSeason): string => {
  if (season === 'winter') return `${tufts(WEST_TUFTS)}${mounds(WEST_MOUNDS)}`
  if (season === 'spring') return `${tufts(WEST_TUFTS)}${patch(WEST_PLANTS)}${butterfly(236, 772, 0, 17)}${fireflies(20, 41)}`
  if (season === 'summer') return `${tufts(WEST_TUFTS)}${sunflowers(WEST_SUNS)}${patch(WEST_PLANTS, false, season)}${butterfly(236, 772, 0, 17)}${fireflies(20, 41)}${fireflies(250, 43, 5, 690, 300, 210)}`

  return `${tufts(WEST_TUFTS)}${FALLEN}${patch(WEST_PLANTS, false, season)}${dragonfly(236, 742, 13, 2)}${dragonfly(120, 660, 17, 9, -12)}${fireflies(20, 41)}`
}

/** The foot at the right, left of the path. */
const eastFoot = (season: PaintSeason): string => {
  if (season === 'winter') return `${tufts(EAST_TUFTS)}${mounds(EAST_MOUNDS)}`
  if (season === 'spring') return `${tufts(EAST_TUFTS)}${patch(EAST_PLANTS)}${butterfly(1206, 826, 1, 21)}`
  if (season === 'summer') return `${tufts(EAST_TUFTS)}${sunflowers(EAST_SUNS)}${patch(EAST_PLANTS, false, season)}${butterfly(1206, 826, 1, 21)}${fluff(1090, 760, 3, 171)}${fireflies(1010, 53, 5, 700, 260, 210)}`

  return `${tufts(EAST_TUFTS)}${patch(EAST_PLANTS, false, season)}${dragonfly(1196, 800, 15, 5, 8)}`
}

/**
 * One layer of the picture: the whole drawing's own box laid over the whole window, held to one side of it. The desktop app moves a
 * scene only where its style asks nothing of the window's shape, so nothing here does: a window narrower than the drawing cuts each
 * layer at the side away from the one it is held to, and a wider one at the top or the foot. So a tall window keeps its tree at its
 * left edge and its cottage at its right, and a wide, short one its clouds at the top and its flowers at the foot.
 */
const layer = (hold: string, drawn: string): string => `<svg viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="${hold} slice">${drawn}</svg>`

/**
 * The plants nearest the middle, each side's held to the other side of the window: as the window narrows they go out at the edge
 * their own side keeps to, and a window less than six fifths as wide as it is tall has none of them.
 */
const inner = (season: PaintSeason): string =>
  season === 'winter'
    ? layer('xMaxYMax', tuft(402, 968, 22, 9))
    : `${layer('xMaxYMax', `${tuft(402, 968, 22, 9)}${patch(WEST_PLANTS, true, season)}`)}${layer('xMinYMax', patch(EAST_PLANTS, true, season))}`

/**
 * The painted meadow. What there is to look at keeps to the two sides, the
 * top band and the foot: the tree and its falling petals at the left, the
 * cottage, its path and the bush at the right, clouds (and a moon) above,
 * clover and daisies below. The middle is sky over plain grass.
 */
export const paintedSceneAt = (time: PaintTime, season: PaintSeason = 'spring'): string => `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
<style>
path,circle,ellipse{stroke-linejoin:round;stroke-linecap:round}
.sk0{stop-color:#a6cdef}.sk1{stop-color:#bbdaf3}.sk2{stop-color:#d6eaf6}
.wash{opacity:.34}
.c0{stop-color:#fffaf0}.c1{stop-color:#fce1d8}.cd{stroke:#e2c5bc;stroke-width:1.8}.cdl{fill:none;stroke:#efd3c9;stroke-width:1.6}
.drift{animation:drift ease-in-out infinite alternate}
.h0{fill:#bfe0c6;stroke:#98c7a6;stroke-width:1.6}.h1{fill:#afd8b7;stroke:#98c7a6;stroke-width:1.6}
.m0{stop-color:#cde7a6}.m1{stop-color:#c1e19b}.m2{stop-color:#cae5a5}.md{stroke:#9bc882;stroke-width:1.8}.mdl{fill:none;stroke:#a6cf8b;stroke-width:1.5;opacity:.7}.mo{stop-color:#c8e5a2}.mnd{fill:none;stroke:#9bc882;stroke-width:1.8}
.tick{fill:none;stroke:#96c97f;stroke-width:1.5;opacity:.75}
.tuft path{fill:none;stroke:#77b866;stroke-width:2.2}.tuft{animation:sway 3.6s ease-in-out infinite}.low{opacity:.55}
.st{fill:none;stroke:#70b064;stroke-width:2}
.nod{animation:nod 4.6s ease-in-out infinite}
.bs{fill:#a8d592;stroke:#7bb671;stroke-width:1.8}.bsl{fill:#bfe2a3}.bd{fill:#f7b4c4}.bp{fill:#f4bdcc;stroke:#dc93a9;stroke-width:1.8}.bpl{fill:#fbd3dc}
.path{fill:#edd4b6;stroke:#cfa888;stroke-width:1.8}.peb{fill:#dcbb99}
.wall{fill:#fcf0d8;stroke:#c7a688;stroke-width:1.8}.wall2{fill:#f4e3c6;stroke:#c7a688;stroke-width:1.8}.roof{fill:#ea8c82;stroke:#c8665e;stroke-width:1.8}.tile{fill:none;stroke:#d5746b;stroke-width:1.4}.eave{fill:none;stroke:#c8665e;stroke-width:8.5}.eave2{fill:none;stroke:#ef978c;stroke-width:5}.chim{fill:#e6b592;stroke:#c08e6e;stroke-width:1.8}
.win{fill:#cfe5f1;stroke:#a08a7c;stroke-width:1.8}.bar{fill:none;stroke:#a08a7c;stroke-width:1.5}.sill{fill:none;stroke:#c7a688;stroke-width:2.4}
.lit{display:none;animation:glow 5s ease-in-out infinite}
.tk{fill:#cba67e}.tke{fill:none;stroke:#a67f5c;stroke-width:2.2}.tkl{fill:none;stroke:#b8916b;stroke-width:1.4;opacity:.8}
.bo,.bi{fill:none}.bo{stroke:#a67f5c}.bi{stroke:#cba67e}.bo.b1{stroke-width:15}.bi.b1{stroke-width:11}.bo.b2{stroke-width:7.5}.bi.b2{stroke-width:4}
.lf0{fill:#aed58c;stroke:#86b96f;stroke-width:1.8}.lfd{fill:#9fcb82}.lf1{fill:#c9e69f;stroke:#9cc97e;stroke-width:1.8}.lf2{fill:#dcf0b4}
.sway{animation:sway2 7s ease-in-out infinite}
.pt{fill:#fcd5d9;stroke:#e59aa8;stroke-width:1.4}.pc{fill:#f9aaa2;stroke:#de8580;stroke-width:1.2}.pd{fill:#f6e39a}
.fall{opacity:0;animation:fall linear infinite}
.cl{fill:#a6d89c;stroke:#63a96a;stroke-width:1.8}.cv{fill:none;stroke:#d2eec4;stroke-width:1.4}
.d0 ellipse{fill:#fffdf6;stroke:#cdbfa8;stroke-width:1.2}.d1 circle{fill:#fbe78c;stroke:#d9b24c;stroke-width:1.2}.d0 .dc,.d1 .dc{fill:#f8d45e;stroke:#d8a546;stroke-width:1.2}
.fly{animation:wander ease-in-out infinite}.wing{animation:flap .55s ease-in-out infinite}.w0 path{fill:#fbc0cf;stroke:#e08fa6;stroke-width:1.4}.w1 path{fill:#fbe596;stroke:#d9b24c;stroke-width:1.4}.bug{fill:none;stroke:#8a6f66;stroke-width:1.8}
.star{display:none;fill:#f7dd88;opacity:.85;animation:twinkle 4.5s ease-in-out infinite}
.moon{display:none;fill:#f9e9a4;stroke:#d8bd68;stroke-width:1.8}.halo{display:none;animation:glow 8s ease-in-out infinite}
.fire{display:none;fill:#ffeaa0;opacity:.8;animation:fire ease-in-out infinite}.fg{opacity:.22}
${SEASON_DAY[season]}${nightRules(time, season)}
@keyframes drift{from{transform:translateX(-26px)}to{transform:translateX(34px)}}
@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(4deg)}}
@keyframes sway2{0%,100%{transform:rotate(-.9deg)}50%{transform:rotate(1.1deg)}}
@keyframes nod{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3.5deg)}}
@keyframes fall{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:.95}45%{transform:translate(62px,150px) rotate(140deg)}85%{opacity:.8}100%{opacity:0;transform:translate(96px,372px) rotate(300deg)}}
@keyframes twinkle{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes glow{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes wander{0%,100%{transform:translate(0,0) rotate(-8deg)}25%{transform:translate(50px,-44px) rotate(10deg)}50%{transform:translate(104px,-8px) rotate(-6deg)}75%{transform:translate(46px,24px) rotate(8deg)}}
@keyframes flap{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.3)}}
@keyframes fire{0%,100%{opacity:.08;transform:translate(0,0)}50%{opacity:1;transform:translate(12px,-16px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.fall{opacity:.85}}
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sk0"/><stop offset=".55" class="sk1"/><stop offset="1" class="sk2"/></linearGradient>
<linearGradient id="cloud" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" class="c0"/><stop offset="1" class="c1"/></linearGradient>
<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m0"/><stop offset=".45" class="m1"/><stop offset="1" class="m2"/></linearGradient>
<linearGradient id="mound" x1="0" y1="0" x2="0" y2="1"><stop offset=".3" class="mo"/><stop offset="1" class="mo" stop-opacity="0"/></linearGradient>
<radialGradient id="wash"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="lamp"><stop offset="0" stop-color="#ffd972" stop-opacity=".6"/><stop offset=".4" stop-color="#ffd972" stop-opacity=".2"/><stop offset="1" stop-color="#ffd972" stop-opacity="0"/></radialGradient>
<radialGradient id="halo"><stop offset=".25" stop-color="#f9e9a4" stop-opacity=".34"/><stop offset="1" stop-color="#f9e9a4" stop-opacity="0"/></radialGradient>
${SEASON_DEFS[season]}</defs>
${layer('xMidYMid', `<rect width="1600" height="1000" fill="url(#sky)"/>
<g class="wash"><ellipse cx="420" cy="170" rx="330" ry="130" fill="url(#wash)"/><ellipse cx="1010" cy="330" rx="420" ry="150" fill="url(#wash)"/><ellipse cx="760" cy="520" rx="520" ry="110" fill="url(#wash)"/><ellipse cx="1240" cy="60" rx="260" ry="90" fill="url(#wash)"/></g>
${STARS}`)}
${layer('xMaxYMin', `${moon(season)}${eastCloud(season)}`)}
${layer('xMinYMin', `${cloud(CLOUD_WEST, 5, 'M60 96q26 -20 54 -6M150 62q32 -14 56 8M40 132q36 -12 70 0M170 118q40 -12 72 4', 64, 12)}`)}
${layer('xMidYMid', `<path class="h0" d="M40 644C140 592 262 566 382 596S566 634 664 644Z"/><path class="h0" d="M800 644C900 602 1010 568 1112 570S1304 602 1404 644Z"/><path class="h1" d="M396 646C478 612 560 598 642 602S784 626 846 644Z"/>
<path class="md" fill="url(#grass)" d="M-600 630C-200 612 200 642 600 634S1100 610 1400 624S1900 604 2200 612V1100H-600Z"/>
<g class="wash"><ellipse cx="700" cy="800" rx="520" ry="130" fill="url(#wash)" opacity=".45"/><ellipse cx="330" cy="700" rx="260" ry="50" fill="url(#wash)" opacity=".35"/><ellipse cx="1080" cy="690" rx="260" ry="44" fill="url(#wash)" opacity=".35"/></g>
<path class="mdl" d="M210 668Q420 652 640 660M930 656Q1080 646 1200 652M300 742Q380 736 450 742M1120 760Q1200 752 1270 760"/>
${ticks(0, 380, 30, 81, (x, y) => !(x < 140 && y < 790))}${ticks(1200, 1440, 22, 85, (x, y) => x < 1700 - y * 0.4)}`)}
${layer('xMidYMax', FOOT)}
${layer('xMaxYMid', `<path fill="url(#mound)" d="M1296 646C1380 610 1480 592 1600 594S1900 600 2200 610V730C1800 736 1450 704 1296 646Z"/><path class="mnd" d="M1296 646C1380 610 1480 592 1600 594S1900 600 2200 610"/>
${bush(1180, 644, 30, 13, 111)}${bush(1286, 640, 84, 44, 112, 12)}
<path class="path" d="M1384 610C1450 606 1540 612 1546 634C1552 660 1470 672 1464 706C1458 742 1508 750 1500 790C1494 830 1468 846 1440 876C1400 920 1340 960 1280 1010H1450C1480 960 1530 910 1580 876C1620 850 1640 800 1600 760C1570 730 1546 730 1540 712C1528 680 1606 664 1592 628C1582 604 1450 598 1390 604Z"/>
<g class="peb"><ellipse cx="1502" cy="640" rx="5" ry="2"/><ellipse cx="1528" cy="672" rx="4" ry="1.8"/><ellipse cx="1500" cy="722" rx="5" ry="2.2"/><ellipse cx="1548" cy="776" rx="6" ry="2.6"/><ellipse cx="1522" cy="826" rx="5" ry="2.4"/><ellipse cx="1560" cy="846" rx="4" ry="2"/><ellipse cx="1486" cy="884" rx="6" ry="2.8"/><ellipse cx="1436" cy="930" rx="6" ry="3"/><ellipse cx="1470" cy="962" rx="5" ry="2.6"/><ellipse cx="1388" cy="980" rx="7" ry="3"/></g>
${bush(1404, 614, 42, 36, 113, 5)}${bush(1448, 608, 26, 26, 114, 7, 'bp')}${bush(1680, 604, 44, 34, 115, 4)}
${cottage(season)}
${bush(1640, 612, 34, 22, 116, 3)}
${cornerFoot(season)}`)}
${layer('xMinYMid', `${bush(88, 648, 64, 50, 117, 16)}${bush(190, 672, 34, 17, 118, 3)}
${tree(season)}
${FALLING[season]}`)}
${layer('xMinYMax', westFoot(season))}
${layer('xMaxYMax', eastFoot(season))}
${inner(season)}
${season === 'winter' ? `${layer('xMidYMid', SNOW)}\n` : ''}</svg>`
