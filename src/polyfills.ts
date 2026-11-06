/**
 * Полифиллы для браузеров старше ~2023 года (Safari < 16, Chrome < 110).
 * Сборка понижает синтаксис до Safari 14, а этот файл добавляет недостающие
 * методы, которые используют библиотеки (Radix вызывает toSorted при старте).
 * Импортируется первым в main.tsx.
 */
/* eslint-disable no-extend-native */

type Cmp<T> = ((a: T, b: T) => number) | undefined

function define(target: object, name: string, value: unknown) {
  if (!(name in target)) Object.defineProperty(target, name, { value, writable: true, configurable: true })
}

const AP = Array.prototype as unknown as Record<string, unknown>

define(AP, 'at', function <T>(this: T[], i: number) {
  const n = Math.trunc(i) || 0
  return this[n < 0 ? this.length + n : n]
})
define(AP, 'toSorted', function <T>(this: T[], cmp: Cmp<T>) {
  return this.slice().sort(cmp)
})
define(AP, 'toReversed', function <T>(this: T[]) {
  return this.slice().reverse()
})
define(AP, 'toSpliced', function <T>(this: T[], start: number, del?: number, ...items: T[]) {
  const copy = this.slice()
  if (del === undefined) copy.splice(start)
  else copy.splice(start, del, ...items)
  return copy
})
define(AP, 'with', function <T>(this: T[], i: number, v: T) {
  const copy = this.slice()
  copy[i < 0 ? copy.length + i : i] = v
  return copy
})
define(AP, 'findLast', function <T>(this: T[], fn: (v: T, i: number, a: T[]) => unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn(this[i], i, this)) return this[i]
  return undefined
})
define(AP, 'findLastIndex', function <T>(this: T[], fn: (v: T, i: number, a: T[]) => unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn(this[i], i, this)) return i
  return -1
})
define(String.prototype, 'at', function (this: string, i: number) {
  const n = Math.trunc(i) || 0
  return this[n < 0 ? this.length + n : n]
})
define(String.prototype, 'replaceAll', function (this: string, search: string | RegExp, replacement: string) {
  if (search instanceof RegExp) return this.replace(search, replacement)
  return this.split(search).join(replacement)
})
define(Object, 'hasOwn', (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k))

if (typeof globalThis.structuredClone !== 'function') {
  ;(globalThis as Record<string, unknown>).structuredClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
}

export {}
