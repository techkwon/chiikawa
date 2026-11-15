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
 */

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

const plant = ([x, y, h, scale, tone]: Plant, index: number): string => (tone < 0 ? clover(x, y, h, scale, x + index) : daisy(x, y, h, scale, tone, x + index))

/**
 * The plants of a patch, the far ones first so the near ones stand before them: those a narrow window keeps, or those it leaves
 * out. Each is drawn as it stands among them all, whichever are asked for.
 */
const patch = (plants: readonly Plant[], isInner = false): string =>
  [...plants]
    .sort((one, other) => one[1] - other[1])
    .map((one, index) => ((one[5] === 1) === isInner ? plant(one, index) : ''))
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
const fireflies = (from: number, salt: number): string =>
  Array.from({ length: 6 }, (_, index) => {
    const x = round(from + spot(index, salt) * 320)
    const y = round(740 + spot(index, salt + 1) * 220)
    const time = round(5 + spot(index, salt + 2) * 4)

    return `<g class="fire" style="animation-duration:${time}s;animation-delay:-${round(spot(index, salt + 3) * time)}s"><circle class="fg" cx="${x}" cy="${y}" r="9"/><circle cx="${x}" cy="${y}" r="2.8"/></g>`
  }).join('')

/** A butterfly: its wings beat while it wanders a small loop. */
const butterfly = (x: number, y: number, tone: number, time: number): string =>
  `<g transform="translate(${x} ${y})"><g class="fly" style="animation-duration:${time}s"><g class="wing w${tone}"><path d="M0 -2C-6 -16 -19 -15 -17 -4C-16 2 -6 3 0 1C6 3 16 2 17 -4C19 -15 6 -16 0 -2Z"/><path d="M0 1C-7 2 -13 7 -9 12C-5 16 -1 9 0 4C1 9 5 16 9 12C13 7 7 2 0 1Z"/></g><path class="bug" d="M0 -8V9M0 -8q-3 -5 -6 -6M0 -8q3 -5 6 -6"/></g></g>`

const CLOUD_WEST: readonly Dot[] = [
  [-22, 138], [-6, 94], [44, 70], [86, 34], [152, 20], [214, 42], [240, 82], [292, 86], [332, 116, 0.6], [312, 150, 0.16], [240, 160, 0.14], [160, 150, 0.16], [90, 160, 0.14], [20, 156, 0.3],
]

const CLOUD_EAST: readonly Dot[] = [
  [1256, 264], [1282, 240], [1332, 238], [1366, 214], [1400, 180], [1422, 140], [1480, 118], [1542, 126], [1602, 150], [1650, 192], [1662, 250, 0.5], [1602, 276, 0.14], [1502, 270, 0.16], [1422, 280, 0.14], [1332, 272, 0.2], [1282, 282, 0.4],
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

const TREE = `<g class="sway" style="transform-origin:44px 500px">
<path class="lf0" d="${blob(92, 312, 208, 186, 17, 7, 0.52)}"/>
<path class="lfd" d="${blob(40, 380, 80, 60, 7, 8, 0.45)}"/><path class="lfd" d="${blob(170, 350, 70, 46, 7, 9, 0.45)}"/>
<path class="bo b1" d="${BOUGHS.join('')}"/><path class="bo b2" d="${TWIGS.join('')}"/><path class="bi b1" d="${BOUGHS.join('')}"/><path class="bi b2" d="${TWIGS.join('')}"/>
<path class="lf1" d="${blob(64, 226, 86, 62, 9, 11)}"/><path class="lf1" d="${blob(196, 282, 74, 56, 8, 12)}"/><path class="lf1" d="${blob(-40, 262, 70, 60, 8, 13)}"/><path class="lf1" d="${blob(212, 424, 64, 44, 7, 14)}"/><path class="lf1" d="${blob(112, 452, 56, 34, 6, 15)}"/><path class="lf1" d="${blob(-24, 420, 52, 40, 6, 16)}"/><path class="lf1" d="${blob(130, 168, 60, 34, 6, 17)}"/>
<path class="lf2" d="${blob(70, 204, 44, 26, 5, 21, 0.4)}"/><path class="lf2" d="${blob(206, 264, 36, 22, 5, 22, 0.4)}"/><path class="lf2" d="${blob(216, 412, 30, 18, 5, 23, 0.4)}"/><path class="lf2" d="${blob(-36, 240, 34, 22, 5, 24, 0.4)}"/>
${blossom(30, 344, 30, 8)}${blossom(108, 292, 21, 30)}${blossom(14, 216, 19, -12)}${blossom(88, 226, 12, 20)}${blossom(170, 312, 12, 50)}${blossom(180, 440, 11, 0)}${blossom(216, 420, 9, 36)}${blossom(62, 252, 9, 64)}${blossom(150, 208, 11, 14)}${blossom(240, 318, 10, 40)}${blossom(-50, 300, 16, 22)}
</g>
<path class="tk" d="M-44 774C-12 760 6 720 12 660C18 590 20 540 26 474L64 482C60 540 62 600 70 668C76 716 94 752 132 772C92 780 70 772 52 764C40 776 8 780 -44 774Z"/>
<path class="tke" d="M26 478C20 540 18 590 12 660C6 720 -12 760 -44 774M64 486C60 540 62 600 70 668C76 716 94 752 132 772M52 764Q44 742 46 716"/>
<path class="tkl" d="M32 520Q28 600 22 684M48 544Q50 622 58 704M40 600Q40 664 38 730M24 716Q14 748 -8 764"/>`

/** The cottage, drawn about the left foot of its gable wall. */
const COTTAGE = `<g transform="translate(1466 598)"><g>
<path class="chim" d="M100 -98h16v30h-16Z"/><path class="chim" d="M96 -104h24v8h-24Z"/>
<path class="wall2" d="M62 -42H186V0H62Z"/>
<path class="roof" d="M30 -82L180 -80L202 -38L68 -38Z"/>
<path class="tile" d="M70 -66h12M96 -70h12M124 -64h12M152 -70h12M86 -52h12M114 -50h12M144 -54h12M172 -50h10"/>
<path class="wall" d="M0 0V-42L32 -76L64 -42V0Z"/>
<path class="eave" d="M-9 -35L32 -80L71 -36"/><path class="eave2" d="M-9 -35L32 -80L71 -36"/>
<path class="win" d="M18 -34h28v24h-28Z"/><path class="bar" d="M32 -34v24M18 -22h28"/>
<path class="win" d="M98 -30h22v18h-22Z"/><path class="bar" d="M109 -30v18M98 -21h22"/>
<path class="sill" d="M15 -9h34M95 -11h28"/>
</g><circle class="lit" cx="32" cy="-22" r="74" fill="url(#lamp)"/></g>`

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

const NIGHT_RULES: Record<PaintTime, string> = {
  auto: `@media (prefers-color-scheme:dark){\n${NIGHT}}`,
  day: '',
  night: NIGHT,
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
const INNER = `${layer('xMaxYMax', `${tuft(402, 968, 22, 9)}${patch(WEST_PLANTS, true)}`)}${layer('xMinYMax', patch(EAST_PLANTS, true))}`

/**
 * The painted meadow. What there is to look at keeps to the two sides, the
 * top band and the foot: the tree and its falling petals at the left, the
 * cottage, its path and the bush at the right, clouds (and a moon) above,
 * clover and daisies below. The middle is sky over plain grass.
 */
export const paintedSceneAt = (time: PaintTime): string => `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
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
${NIGHT_RULES[time]}
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
</defs>
${layer('xMidYMid', `<rect width="1600" height="1000" fill="url(#sky)"/>
<g class="wash"><ellipse cx="420" cy="170" rx="330" ry="130" fill="url(#wash)"/><ellipse cx="1010" cy="330" rx="420" ry="150" fill="url(#wash)"/><ellipse cx="760" cy="520" rx="520" ry="110" fill="url(#wash)"/><ellipse cx="1240" cy="60" rx="260" ry="90" fill="url(#wash)"/></g>
${STARS}`)}
${layer('xMaxYMin', `<circle class="halo" cx="1385" cy="96" r="120" fill="url(#halo)"/><path class="moon" transform="translate(1385 96)" d="M8 -33A34 34 0 1 1 -33 8A29.5 29.5 0 0 0 8 -33Z"/>${cloud(CLOUD_EAST, 3, 'M1420 180q26 -22 58 -10M1500 160q34 -16 62 6M1330 252q30 -14 58 0M1450 232q44 -12 84 4M1570 210q30 -8 50 10', 78, 30)}`)}
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
${COTTAGE}
${bush(1640, 612, 34, 22, 116, 3)}
${tufts(CORNER_TUFTS)}${patch(CORNER_PLANTS)}${fireflies(1260, 51)}`)}
${layer('xMinYMid', `${bush(88, 648, 64, 50, 117, 16)}${bush(190, 672, 34, 17, 118, 3)}
${TREE}
${PETALS}`)}
${layer('xMinYMax', `${tufts(WEST_TUFTS)}${patch(WEST_PLANTS)}${butterfly(236, 772, 0, 17)}${fireflies(20, 41)}`)}
${layer('xMaxYMax', `${tufts(EAST_TUFTS)}${patch(EAST_PLANTS)}${butterfly(1206, 826, 1, 21)}`)}
${INNER}
</svg>`
