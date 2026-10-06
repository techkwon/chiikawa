// What the tests of the screen share: the tree a surface is handed, read as
// text and measured the way the surface lays it out.

import { cells } from '../hooks/view'

export type Drawn = string | number | boolean | null | undefined | { type: string; props?: Record<string, unknown>; children?: readonly Drawn[] }

export const textOf = (node: Drawn): string => (typeof node === 'string' || typeof node === 'number' ? String(node) : node === null || typeof node !== 'object' ? '' : (node.children ?? []).map(textOf).join(''))

/** A text the surface cuts to the room it has, where one without the mark runs on past it. */
const isCut = (node: Drawn): boolean => node !== null && typeof node === 'object' && node.type === 'Text' && node.props?.wrap === 'truncate-end'

/**
 * The cells and rows a drawn tree takes, laid out as the surface lays it: a
 * box's children side by side, or one under another in a column, inside its
 * frame and padding. A box given a width is no narrower than that, and is
 * wider where what is in it does not fit.
 */
export const sizeOf = (node: Drawn, room = Infinity): { width: number; rows: number } => {
  if (typeof node === 'string' || typeof node === 'number') return { width: cells(String(node)), rows: 1 }
  if (node === null || typeof node !== 'object') return { width: 0, rows: 0 }
  const props = node.props ?? {}

  if (node.type === 'Text') return { width: isCut(node) ? Math.min(cells(textOf(node)), room) : cells(textOf(node)), rows: 1 }
  if (node.type === 'Button') return { width: cells(String(props.label ?? '')) + (props.plain === true ? 0 : 4), rows: 1 }
  if (node.type === 'Raster') return { width: Number(props.columns), rows: Number(props.rows) }
  const edge = props.borderStyle === undefined ? 0 : 2
  const frame = edge + 2 * Number(props.paddingX ?? 0)
  const given = typeof props.width === 'number' ? props.width : undefined
  const inner = (given ?? room) - frame
  const children = (node.children ?? []).filter(child => child !== null && child !== undefined && typeof child !== 'boolean')
  const gaps = Number(props.gap ?? 0) * Math.max(0, children.length - 1)

  if (props.flexDirection === 'column') {
    const sizes = children.map(child => sizeOf(child, inner))

    return { width: Math.max(given ?? 0, Math.max(0, ...sizes.map(size => size.width)) + frame), rows: sizes.reduce((sum, size) => sum + size.rows, gaps) + edge }
  }
  // The texts that are cut share what the rest of the row leaves.
  const box = { left: inner - gaps - children.filter(child => !isCut(child)).reduce<number>((sum, child) => sum + sizeOf(child, inner).width, 0) }
  const sizes = children.map(child => {
    const size = sizeOf(child, isCut(child) ? Math.max(0, box.left) : inner)

    if (isCut(child)) box.left -= size.width

    return size
  })

  return { width: Math.max(given ?? 0, sizes.reduce((sum, size) => sum + size.width, gaps) + frame), rows: Math.max(0, ...sizes.map(size => size.rows)) + edge }
}

/** The first box in a drawn tree that holds the thing with that key right under it. */
export const rowWith = (node: Drawn, key: string): Drawn => {
  if (node === null || typeof node !== 'object') return undefined
  const children = node.children ?? []

  if (children.some(child => child !== null && typeof child === 'object' && child.props?.key === key)) return node

  return children.map(child => rowWith(child, key)).find(found => found !== undefined)
}

/** Every piece of writing a drawn tree holds, in the order it is drawn: each text whole, each button by its label. */
export const written = (node: Drawn): string[] => {
  if (node === null || typeof node !== 'object') return []
  if (node.type === 'Text') return [textOf(node)]
  if (node.type === 'Button') return [String(node.props?.label ?? '')]

  return (node.children ?? []).flatMap(written)
}

/** Every thing in a drawn tree whose key reads so, in the order drawn. */
export const keyed = (node: Drawn, pattern: RegExp): Drawn[] => {
  if (node === null || typeof node !== 'object') return []
  const own = typeof node.props?.key === 'string' && pattern.test(node.props.key) ? [node] : []

  return [...own, ...(node.children ?? []).flatMap(child => keyed(child, pattern))]
}
