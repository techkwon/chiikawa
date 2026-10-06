import { expect, test } from 'claude-code/testing'

import type { Situation } from '../hooks/cast'
import { CAST, isGesture, MEMBERS, ORDER, readingOf, reported, say, shortName, soundsOf, specialistOf, roleOfAgent, WORK_ROLES, WORKERS } from '../hooks/cast'
import { RENDERED } from '../hooks/cast.en'
import { cells, fit, fitEnd, pad } from '../hooks/view'
import { firstLines, fleetNote, isMarked, leaderSection, MARKS, memberBlock, memberNamed, namedMember, orcaBlock, pickNote, roleNamed, roleNote, standDown, tookNote, unvoiced } from '../hooks/voice'
import { asIs, LANGS, langKeptFrom, langNamed, localeLang, typedLang, WORDS } from '../hooks/words'
import type { Lang } from '../types'

const SITUATIONS: readonly Situation[] = ['idle', 'start', 'done', 'fail', 'slow', 'denied']

/** The lines a character's voice lists: what stands between quotation marks. */
const listed = (lang: Lang, id: (typeof ORDER)[number]): string[] => CAST[lang].lines[id].flatMap(line => [...line.matchAll(/"([^"]+)"/g)].map(found => found[1] ?? ''))

test('the letters of a typed prompt tell Korean from Japanese, and nothing else tells a language', () => {
  expect(typedLang('로그인 버그를 고쳐 줘')).toBe('ko')
  expect(typedLang('ログインのバグを直して')).toBe('ja')
  expect(typedLang('ﾛｸﾞｲﾝ')).toBe('ja')
  // Latin letters and Han characters are written in more than one language.
  expect(typedLang('fix the login bug')).toBeUndefined()
  expect(typedLang('確認')).toBeUndefined()
  expect(typedLang('ー・…―')).toBeUndefined()
  expect(typedLang('')).toBeUndefined()
  // Where both are there, the one there is more of; neither where they are even.
  expect(typedLang('ちいかわ를 한국어로 설명해 줘')).toBe('ko')
  expect(typedLang('치이카와 는 ちいかわ のことです')).toBe('ja')
  expect(typedLang('가나 かな')).toBeUndefined()
  // A slash command is not a prompt, whatever follows it.
  expect(typedLang('/chiikawa 랏코')).toBeUndefined()
  expect(typedLang('  /review こんにちは')).toBeUndefined()
  // What comes after the first two thousand characters is taken to be pasted.
  expect(typedLang(`${'a'.repeat(2000)}こんにちは`)).toBeUndefined()
  expect(typedLang(`${'a'.repeat(1995)}こんにちは`)).toBe('ja')
  expect(typedLang(`안녕 ${'a'.repeat(2000)}${'あ'.repeat(50)}`)).toBe('ko')
})

test('a setting or a locale names Korean or Japanese by how it starts, and no other language', () => {
  for (const value of ['ko', 'ko_KR.UTF-8', 'ko-KR', 'Korean', 'korean (한국어)', '한국어', ' KO ']) expect(`${value} ${String(localeLang(value))}`).toBe(`${value} ko`)
  for (const value of ['ja', 'ja_JP.UTF-8', 'ja-JP', 'Japanese', '日本語', 'JA_JP.eucJP']) expect(`${value} ${String(localeLang(value))}`).toBe(`${value} ja`)
  // Javanese and Kongo are not Japanese and Korean.
  for (const value of ['en_US.UTF-8', 'English', 'C', 'POSIX', '', 'javanese', 'jav', 'kon', 'kok_IN', 'zh_CN.UTF-8', 'de_DE']) expect(`${value} ${String(localeLang(value))}`).toBe(`${value} undefined`)
})

test('a language is chosen by its code or its name in any of the three, and what was kept is read with care', () => {
  for (const word of ['en', 'EN', 'english', '영어', '英語']) expect(langNamed(word)).toBe('en')
  for (const word of ['ko', 'Korean', '한국어', '韓国語']) expect(langNamed(word)).toBe('ko')
  for (const word of ['ja', 'japanese', '일본어', '日本語']) expect(langNamed(word)).toBe('ja')
  for (const word of ['auto', 'fr', '', 'jap', 'k']) expect(langNamed(word)).toBeUndefined()

  expect(langKeptFrom({ chosen: 'ja', typed: 'ko' })).toEqual({ chosen: 'ja', typed: 'ko' })
  expect(langKeptFrom({ chosen: 'fr', typed: 'ko', other: 1 })).toEqual({ typed: 'ko' })
  for (const kept of [undefined, null, 'ja', 3, [], { chosen: 1 }]) expect(langKeptFrom(kept)).toEqual({})
})

test('kana, Han characters and full-width signs take two cells; half-width kana and the plain marks take one', () => {
  expect(cells('ちいかわ')).toBe(8)
  expect(cells('ハチワレ')).toBe(8)
  expect(cells('古本屋')).toBe(6)
  expect(cells('ラッコー')).toBe(8)
  expect(cells('ー')).toBe(2)
  expect(cells('～')).toBe(2)
  expect(cells('！？')).toBe(4)
  expect(cells('「」、。')).toBe(8)
  expect(cells('ﾊﾁﾜﾚ')).toBe(4)
  expect(cells('ｶﾞ')).toBe(2)
  expect(cells('…')).toBe(1)
  expect(cells('―')).toBe(1)
  expect(cells('‼')).toBe(1)
  expect(cells('○×')).toBe(2)
  expect(cells('スイッ‼スイッ‼')).toBe(14)
  expect(cells('わぁ～……')).toBe(8)
  expect(cells('Pochette no Yoroi-san')).toBe(21)

  expect(fit('ポシェットの鎧さん', 11)).toBe('ポシェット…')
  expect(fit('ポシェットの鎧さん', 12)).toBe('ポシェット…')
  expect(cells(fit('くりまんじゅう', 9))).toBeLessThanOrEqual(9)
  expect(fit('ﾎﾟｼｪｯﾄの鎧さん', 8)).toBe('ﾎﾟｼｪｯﾄ…')
  expect(fitEnd('/作業/結果/find.out.md', 12)).toBe('…find.out.md')
  expect(pad('実装', 7)).toBe('実装   ')
})

test('every language has a name, a short name that is no longer, and a label for every role', () => {
  for (const lang of LANGS) {
    const cast = CAST[lang]

    for (const id of ORDER) {
      expect(cast.names[id]).not.toBe('')
      expect(cells(shortName(lang, id))).toBeLessThanOrEqual(cells(cast.names[id]))
      // The band names everyone by the short name: none is so long that a narrow band could not seat the three.
      expect(cells(shortName(lang, id))).toBeLessThanOrEqual(14)
      expect(cast.titles[id]).not.toBe('')
      expect(cast.jobs[id]).not.toBe('')
      expect(cast.manner[id]).not.toBe('')
      expect(cast.lines[id].length).toBeGreaterThan(0)
    }
    for (const role of [...WORK_ROLES, '지휘'] as const) {
      expect(cast.roles[role]).not.toBe('')
      expect(cast.job[role]).not.toBe('')
      // A role's own label gives the role back, so the list a command prints can be typed as it reads.
      if (role !== '지휘') expect(roleNamed(cast.roles[role])).toBe(role)
    }
    // A sheet's labels fit its column of eight cells, a cell to spare.
    for (const label of Object.values(WORDS[lang].labels)) expect(cells(label)).toBeLessThanOrEqual(7)
  }
})

test('a line on the screen is one the character has in its list, in every language', () => {
  for (const lang of LANGS) {
    for (const id of ORDER) {
      const lines = listed(lang, id)

      for (const situation of SITUATIONS) {
        for (let turn = 0; turn < 4; turn += 1) {
          const quote = say(lang, id, situation, turn)

          expect(quote).not.toBe('')
          // A quotation mark inside a line would cut it short in the list.
          expect(quote.includes('"')).toBe(false)
          if (!isGesture(quote)) expect(`${lang} ${id} ${quote} ${String(lines.includes(quote))}`).toBe(`${lang} ${id} ${quote} true`)
        }
      }
      // One that cannot talk says no sentence the person could take for a report: its voice lists what its screen shows.
      if (!MEMBERS[id].speaks) expect(soundsOf(lang, id).length).toBeGreaterThan(0)
    }
    // 하치와레's own lines as the conductor are his too, but for the one he makes by filling his question.
    const { leader } = CAST[lang]

    for (const quote of [leader.idle, leader.allDone, leader.sweep, leader.trouble, leader.cry, leader.cheer, leader.sure]) expect(`${lang} ${quote} ${String(listed(lang, 'hachiware').includes(quote))}`).toBe(`${lang} ${quote} true`)
  }
  // On finding a place he has a line of his own in Korean; its original was not found, so the other two ask it back.
  expect(CAST.ko.leader.found).toBe('있구나~. 이런 곳에도.')
  expect(CAST.ja.leader.found).toBe('それって "ここにあった" ってコト!?')
  expect(CAST.en.leader.found).toBe('So that means "it was here"?!')
})

test('the Korean screen has no Japanese letters in its own words or its cast, but for the three lines the cast keeps as the comic writes them', () => {
  /** Every text held in a table, however deep; what a function would make is not among them. */
  const texts = (held: unknown): string[] => (typeof held === 'string' ? [held] : typeof held === 'object' && held !== null ? Object.values(held).flatMap(texts) : [])
  const japanese = (text: string): boolean => /[\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Han}]/u.test(text)
  // A voice's list is for the model, and names each line's original beside it: it is not on the screen.
  const { lines, ...cast } = CAST.ko

  expect(lines.shisa.some(japanese)).toBe(true)
  // 시사's two words of the Miyako language, and the 古本 of the bookseller's banner.
  expect(texts(cast).filter(japanese)).toEqual(['んみゃーち', 'たんでぃがーたんでぃ', '(古本 표지판을 세운다)'])
  expect(texts(WORDS.ko).filter(japanese)).toEqual([])
  expect(WORDS.ko.on).toBe('켜짐')
  expect(WORDS.ko.off).toBe('꺼짐')
})

test('a gesture is a gesture in every language, at the same place', () => {
  for (const id of ORDER) {
    for (const situation of SITUATIONS) {
      const ja = CAST.ja.quotes[id][situation]
      const en = CAST.en.quotes[id][situation]

      expect(en).toHaveLength(ja.length)
      ja.forEach((quote, at) => expect(`${id} ${quote} ${String(isGesture(en[at] ?? ''))}`).toBe(`${id} ${quote} ${String(isGesture(quote))}`))
    }
  }
  // A check that passed is an O of the hand whatever the turn, in every language.
  for (const lang of LANGS) expect(isGesture(say(lang, 'kurimanju', 'done', 0))).toBe(true)
})

test('the English cast says the Japanese cast, line for line, and no line of its own', () => {
  const originals = new Set(ORDER.flatMap(id => [...Object.values(CAST.ja.quotes[id]).flat(), ...listed('ja', id)]).filter(quote => !isGesture(quote)))

  // Every English line stands for an original the Japanese cast has.
  for (const original of Object.keys(RENDERED)) expect(`${original} ${String(originals.has(original))}`).toBe(`${original} true`)
  // Every original the Japanese cast has is given in English, but for the question 하치와레 fills in.
  for (const original of originals) {
    if (!original.includes('○○')) expect(`${original} ${String(RENDERED[original] !== undefined)}`).toBe(`${original} true`)
  }
  for (const id of ORDER) {
    for (const situation of SITUATIONS) {
      CAST.ja.quotes[id][situation].forEach((quote, at) => {
        if (!isGesture(quote)) expect(CAST.en.quotes[id][situation][at]).toBe(RENDERED[quote]?.en)
      })
    }
    // What the English voice lists is the English of an original, with that original beside it.
    for (const quote of listed('en', id).filter(one => !isGesture(one) && !one.includes('○○'))) {
      const original = Object.keys(RENDERED).find(key => RENDERED[key]?.en === quote)

      expect(`${id} ${quote} ${String(original !== undefined)}`).toBe(`${id} ${quote} true`)
      expect(`${id} ${quote} ${String(CAST.en.lines[id].some(line => line.includes(`"${quote}"`) && line.includes(original ?? '\n')))}`).toBe(`${id} ${quote} true`)
    }
  }
  // Only the two cries the official site spells are official.
  expect(
    Object.values(RENDERED)
      .filter(line => line.kind === 'official')
      .map(line => line.en)
      .sort(),
  ).toEqual(['Ura!', 'Yaha!'])
  // The Korean cast keeps the lines it had.
  expect(say('ko', 'usagi', 'start', 0)).toBe('우라')
  expect(say('ko', 'rodo', 'start', 0)).toBe('빠른 사람이 임자!')
  expect(say('ja', 'usagi', 'start', 0)).toBe('ウラ')
  expect(say('en', 'usagi', 'start', 1)).toBe('Yaha!')
})

test('하치와레 reads a friend who cannot talk in his own way in each language', () => {
  expect(readingOf('ja', 'chiikawa', 'start', '구현')).toBe('それって "まかせて" ってコト!?')
  expect(readingOf('ja', 'chiikawa', 'fail', '구현')).toBe('泣いちゃった!!!')
  expect(readingOf('ja', 'kurimanju', 'done', '검토')).toBe('それって "合格" ってコト!?')
  expect(readingOf('en', 'chiikawa', 'done', '구현')).toBe('So that means "all done"?!')
  expect(readingOf('en', 'kani', 'fail', '조사')).toBe('So that means "it didn\'t work"?!')
  expect(readingOf('en', 'shisa', 'fail', '구현')).toBe('Just work out somehow—!!')
  for (const lang of LANGS) expect(readingOf(lang, 'rakko', 'done', '구현')).toBeUndefined()
})

test("the conductor's section says in each language what it must: who it is, whose voice goes where, and what comes first", () => {
  const must: Record<Lang, readonly string[]> = {
    ko: ['# 치이카와 모드', '너는 하치와레', '말투는 사용자에게 보이는 글에만 입힌다', '형식이나 언어에 관한 다른 지침(CLAUDE.md 등)이 있으면 그것이 우선한다', '목록에 없는 유행어를 지어내지 않는다', '"[치이카와 배역]" 블록', '🦦 랏코 (해달, 토벌 랭킹 1위): 어려운 구현, 디버깅'],
    en: [
      '# Chiikawa mode',
      'You are Hachiware',
      'The voice goes only on writing the user sees',
      'Any other instruction about format or language (CLAUDE.md and the like) comes first',
      'Do not make up catchphrases that are not on the list',
      '"[Chiikawa cast]" block',
      '🦦 Rakko (sea otter, #1 in the monster-hunting rankings): hard implementation, debugging',
      "this mode's casting, not something the comic says",
      '"What, what!?" (なになに!?',
    ],
    ja: [
      '# ちいかわモード',
      'あなたはハチワレ',
      '話し方はユーザーに見える文章にだけ付ける',
      '形式や言語についてのほかの指示（CLAUDE.md など）があれば、そちらを優先する',
      'リストにない決まり文句を作らない',
      '「[ちいかわ配役]」ブロック',
      '🦦 ラッコ（討伐の上位ランカー）：難しい実装、デバッグ',
      '原作の設定ではなく、このモードの配役',
      '"なになに!?"',
    ],
  }

  for (const lang of LANGS) {
    const section = leaderSection(lang)

    for (const sentence of must[lang]) expect(`${lang} ${sentence} ${String(section.includes(sentence))}`).toBe(`${lang} ${sentence} true`)
    // Everyone who takes tasks is in it by name, and the ones who cannot talk are told apart.
    for (const id of WORKERS) expect(section).toContain(`${MEMBERS[id].mark} ${CAST[lang].names[id]}`)
    expect(leaderSection(lang, true)).toContain(CAST[lang].politeLeader)
    expect(leaderSection(lang, true)).not.toContain(`${CAST[lang].manner.hachiware}\n`)
    expect(leaderSection(lang, false, false).length).toBeLessThan(section.length)
    expect(leaderSection(lang, false, true, { rakko: '검토' })).toContain(CAST[lang].duty.검토)
    expect(standDown(lang)).not.toBe('')
  }
  // Said politely, he is polite in Japanese by the form of his sentences, and in English by a line that says so.
  expect(CAST.ja.politeLeader).toContain('です・ます')
  expect(CAST.en.politeLeader).toContain('polite and calm')
  expect(CAST.ja.manner.hachiware).toContain('ってコト!?')
})

test('a block tells a character how it talks in each language, and one that cannot talk not to', () => {
  const must: Record<Lang, readonly [mute: readonly string[], voiced: readonly string[]]> = {
    ko: [
      ['너는 지휘자 하치와레가 아니라 치이카와다', '치이카와는 원작에서 말을 하지 않는다', '둘째 줄부터는 캐릭터 말투 없이', '보고의 첫 줄은 "🐹 치이카와:"로 시작한다'],
      ['너는 지휘자 하치와레가 아니라 랏코다', '쓸 수 있는 랏코의 실제 대사', '목록에 없는 유행어는 지어내지 않는다', '사실, 숫자, 경로, 오류 내용은 정확히 그대로 쓴다'],
    ],
    en: [
      ['You are not Hachiware the conductor: you are Chiikawa', 'Chiikawa does not talk in the comic', 'From the second line on, report in plain, exact writing with no character voice', 'Start the first line of the report with "🐹 Chiikawa:"', '"Fu!!" / "Yaa!!" (フ！, ヤーッ!!'],
      ['You are not Hachiware the conductor: you are Rakko', "Rakko's real lines you may use", 'Do not make up catchphrases that are not on the list', 'Give facts, numbers, paths and error text exactly as they are', '"The usual." (いつもの'],
    ],
    ja: [
      ['あなたは指揮者のハチワレではなく、ちいかわだ', 'ちいかわは原作で言葉を話さない', '2行目からは、キャラクターの話し方をせず', '報告の1行目は「🐹 ちいかわ:」で始める', '"フ！" / "ヤーッ!!"'],
      ['あなたは指揮者のハチワレではなく、ラッコだ', '使ってよいラッコの実際のセリフ', 'リストにない決まり文句は作らない', '事実、数字、パス、エラーの内容は正確にそのまま書く', '"お前たちの方が…『先生』だなッ"'],
    ],
  }

  for (const lang of LANGS) {
    const [mute, voiced] = must[lang]
    const silent = memberBlock(lang, 'chiikawa', '구현')
    const spoken = memberBlock(lang, 'rakko', '구현')

    for (const sentence of mute) expect(`${lang} ${sentence} ${String(silent.includes(sentence))}`).toBe(`${lang} ${sentence} true`)
    for (const sentence of voiced) expect(`${lang} ${sentence} ${String(spoken.includes(sentence))}`).toBe(`${lang} ${sentence} true`)
    for (const block of [silent, spoken, orcaBlock(lang, 'kani', '조사')]) {
      expect(block.startsWith(`\n\n---\n${MARKS[lang]}\n`)).toBe(true)
      // The role is told by the language's own word for it.
      expect(block).not.toContain(lang === 'ko' ? 'Build' : '구현')
    }
    expect(silent).toContain(CAST[lang].roles.구현)
    expect(pickNote(lang, 'rakko')).toContain(`${CAST[lang].names.rakko}: `)
    expect(pickNote(lang, 'hachiware')).toContain(CAST[lang].names.hachiware)
    expect(roleNote(lang, { rakko: '검토' })).toContain(CAST[lang].specialties)
    expect(tookNote(lang, 'usagi', '탐색').startsWith(MARKS[lang])).toBe(true)
    expect(tookNote(lang, 'usagi', '탐색')).toContain('○○')
    expect(tookNote(lang, 'rakko', '구현')).not.toContain('○○')
    expect(fleetNote(lang, 'usagi', '탐색', 'codex-scout', 'find', '/w/a/find.spec.usagi.md')).toContain('/w/a/find.spec.usagi.md')
    expect(fleetNote(lang, 'usagi', '탐색', 'codex-scout', 'find')).not.toContain('.md')
  }
  expect(MARKS).toEqual({ en: '[Chiikawa cast]', ko: '[치이카와 배역]', ja: '[ちいかわ配役]' })
})

test("a block is known for the mode's own whatever language it was written in", () => {
  for (const written of LANGS) {
    const handed = `로그인 폼을 고쳐 줘.${memberBlock(written, 'shisa', '구현')}`

    expect(unvoiced(handed)).toBe('로그인 폼을 고쳐 줘.')
    expect(unvoiced(`fix the form${orcaBlock(written, 'rakko', '구현')}\n`)).toBe('fix the form')
    expect(isMarked(handed)).toBe(true)
    // Handed on in another language, the task has one block: that of who has it now.
    for (const now of LANGS) {
      const again = unvoiced(handed) + memberBlock(now, 'rakko', '구현')

      expect(LANGS.reduce((count, lang) => count + again.split(MARKS[lang]).length - 1, 0)).toBe(1)
      expect(again).toContain(MARKS[now])
    }
    // A task that only tells of the mark, or goes on after a block, is the person's own text.
    for (const told of [`"${MARKS[written]}" means what?`, `${handed}\n\nThat was last time. This time fix the tests only.`]) expect(unvoiced(told)).toBe(told)
  }
  expect(isMarked('a spec with nothing of the mode in it')).toBe(false)
})

test('a character and a role are known by their names in all three languages', () => {
  const names: readonly (readonly [string, ReturnType<typeof memberNamed>])[] = [
    ['ちいかわ', 'chiikawa'],
    ['Chiikawa', 'chiikawa'],
    ['うさぎ', 'usagi'],
    ['ウサギ', 'usagi'],
    ['ラッコ', 'rakko'],
    ['シーサー', 'shisa'],
    ['くりまんじゅう', 'kurimanju'],
    ['くりまん', 'kurimanju'],
    ['古本屋', 'kani'],
    ['カニ', 'kani'],
    ['Furuhonya', 'kani'],
    ['kani', 'kani'],
    ['ポシェットの鎧さん', 'pochette'],
    ['ポシェット', 'pochette'],
    ['Pochette no Yoroi-san', 'pochette'],
    ['pochette', 'pochette'],
    ['モモンガ', 'momonga'],
    ['ハチワレ', 'hachiware'],
    ['Hachiware', 'hachiware'],
    ['포쉐트 갑옷 씨', 'pochette'],
    ['ちい', undefined],
    ['Roudou', undefined],
  ]

  for (const [word, id] of names) expect(`${word} ${String(memberNamed(word))}`).toBe(`${word} ${String(id)}`)
  // Each language's own name for a character names it, whole and at the start of a description.
  for (const lang of LANGS) {
    for (const id of WORKERS) {
      expect(memberNamed(CAST[lang].names[id])).toBe(id)
      expect(memberNamed(shortName(lang, id))).toBe(id)
      expect(namedMember(`${CAST[lang].names[id]}: fix the login bug`)).toEqual({ member: id, rest: 'fix the login bug' })
    }
  }
  expect(namedMember('ラッコ：ログインバグの討伐')).toEqual({ member: 'rakko', rest: 'ログインバグの討伐' })
  expect(namedMember('Pochette no Yoroi-san - settings screen')).toEqual({ member: 'pochette', rest: 'settings screen' })
  expect(namedMember('ログインバグの討伐')).toEqual({ rest: 'ログインバグの討伐' })

  for (const word of ['実装', '討伐', 'Build', 'hunt']) expect(roleNamed(word)).toBe('구현')
  for (const word of ['レビュー', '検定', 'review', 'Exam']) expect(roleNamed(word)).toBe('검토')
  for (const word of ['調査', '採取', 'Research', 'forage']) expect(roleNamed(word)).toBe('조사')
  for (const word of ['探索', 'Explore', 'scout']) expect(roleNamed(word)).toBe('탐색')
  for (const word of ['指揮', 'Lead', '仕事']) expect(roleNamed(word)).toBeUndefined()
})

test('the kind of work is told from Japanese words as from Korean and English ones', () => {
  expect(specialistOf('general-purpose', '設定画面のデザイン')).toBe('pochette')
  expect(specialistOf('general-purpose', 'セキュリティの点検')).toBe('momonga')
  expect(specialistOf('general-purpose', '原因を調べるデバッグ')).toBe('rakko')
  expect(specialistOf('general-purpose', '誤字を直す')).toBe('chiikawa')
  expect(roleOfAgent('general-purpose', '変更したコードのレビュー')).toBe('검토')
  expect(roleOfAgent('general-purpose', '設定ファイルの場所をさがす')).toBe('탐색')
  expect(roleOfAgent('general-purpose', '資料の調査')).toBe('조사')
  expect(roleOfAgent('general-purpose', 'ログインフォームの実装')).toBe('구현')
})

test("a silent character's opening sound is skipped in the language its block was written in", () => {
  expect(firstLines('🐹 Chiikawa: Waa~……\nAll the tests pass.', 3)).toEqual(['All the tests pass.'])
  expect(firstLines('🐹 Chiikawa: WAAA~!\nAll the tests pass.', 3)).toEqual(['All the tests pass.'])
  expect(firstLines('🐰 Usagi: Ura!\nFound it in src/config.ts.', 3)).toEqual(['Found it in src/config.ts.'])
  expect(firstLines('🐰 うさぎ: ウラ\n設定ファイルは src/config.ts にある。', 3)).toEqual(['設定ファイルは src/config.ts にある。'])
  expect(firstLines('🌰 くりまんじゅう: (手で○を作る)\n合格。', 3)).toEqual(['合格。'])
  expect(firstLines('🌰 Kurimanju: (makes an O with both hands)\nIt passes.', 3)).toEqual(['It passes.'])
  expect(firstLines('🦀 古本屋：（？を浮かべる）\n資料が見つからない。', 3)).toEqual(['資料が見つからない。'])
  // A first line that is not one of its sounds is part of the report, and so is all a character that talks says.
  expect(firstLines('🐹 Chiikawa: All the tests pass.\nNothing else changed.', 3)).toEqual(['All the tests pass.', 'Nothing else changed.'])
  expect(firstLines('🦦 ラッコ: いつもの\n直した。', 3)).toEqual(['いつもの', '直した。'])
  expect(firstLines('🦦 Rakko: The usual.\nFixed.', 3)).toEqual(['The usual.', 'Fixed.'])
})

test("a report's first line is shown as another language has it only where a friend who cannot talk wrote one of its own sounds or gestures, and that language surely has the same one", () => {
  expect(reported('kani', '(blushes happily)')).toEqual({ en: '(blushes happily)', ko: '(볼에 빗금을 띄우며 기뻐한다)', ja: '(頬を染めて喜ぶ)' })
  // Written without its parentheses, a gesture is known by what it tells, and is shown without them.
  expect(reported('kani', '頬を染めて喜ぶ')).toEqual({ en: 'blushes happily', ko: '볼에 빗금을 띄우며 기뻐한다', ja: '頬を染めて喜ぶ' })
  expect(reported('usagi', '우라')).toEqual({ en: 'Ura!', ko: '우라', ja: 'ウラ' })
  expect(reported('usagi', 'Haa?')).toEqual({ en: 'Haa?', ko: '하아?', ja: 'ハァ？' })
  expect(reported('chiikawa', '싫어~.')).toEqual({ en: 'Nooo!', ko: '싫어~.', ja: 'ヤダーッ' })
  expect(reported('kurimanju', 'ハーッ…')).toEqual({ en: 'Haaah…', ko: '하―앗…', ja: 'ハーッ…' })
  // English and Japanese are one line at every place; Korean shows the line as written where it has none that is surely the same.
  expect(reported('chiikawa', 'Yaa!!')).toEqual({ en: 'Yaa!!', ko: 'Yaa!!', ja: 'ヤーッ!!' })
  expect(reported('usagi', 'プルャ')).toEqual({ en: 'Purya!', ko: 'プルャ', ja: 'プルャ' })
  expect(reported('chiikawa', '(hums a tune)')).toEqual({ en: '(hums a tune)', ko: '(hums a tune)', ja: '(鼻歌をうたう)' })
  // A Korean line with no Japanese one that is surely the same stays as written in all three, though the two share an occasion.
  for (const [id, line] of [['chiikawa', '나도!'], ['chiikawa', '와아……'], ['chiikawa', '얌빰빰 루빠루빠'], ['usagi', '푸랴!'], ['usagi', '하? 하아?']] as const) expect(reported(id, line)).toEqual(asIs(line))
  // Anything else is the worker's own writing: a sentence, a sound drawn out, a gesture with more after it, a line of a friend who talks.
  for (const [id, line] of [['kani', 'Sorted the notes.'], ['usagi', 'Uraaa!'], ['kani', '(blushes happily) Done.'], ['rakko', 'The usual.'], ['shisa', 'うれシーサー']] as const) expect(reported(id, line)).toEqual(asIs(line))

  for (const id of ORDER.filter(one => !MEMBERS[one].speaks)) {
    const places = SITUATIONS.flatMap(situation => CAST.ja.quotes[id][situation].map((ja, at) => ({ ja, en: CAST.en.quotes[id][situation][at], ko: CAST.ko.quotes[id][situation][at] })))

    for (const { ja, en } of places) {
      const shown = reported(id, ja)

      // The English is the line at the same place, and comes back to the Japanese.
      expect(`${id} ${ja} ${shown.en}`).toBe(`${id} ${ja} ${en ?? ''}`)
      expect(`${id} ${ja} ${reported(id, shown.en).ja}`).toBe(`${id} ${ja} ${ja}`)
      // The Korean, where there is one, stands at a place the Japanese line stands at, is a gesture where that is one, and comes back to it.
      if (shown.ko !== ja) {
        expect(`${id} ${ja} ${shown.ko} ${String(places.some(place => place.ja === ja && place.ko === shown.ko))}`).toBe(`${id} ${ja} ${shown.ko} true`)
        expect(`${id} ${ja} ${String(isGesture(shown.ko))}`).toBe(`${id} ${ja} ${String(isGesture(ja))}`)
        expect(reported(id, shown.ko)).toEqual(shown)
      }
    }
  }
  // The pairs of Korean and Japanese that are held to be one line, each checked by hand: no more of them than these.
  expect(ORDER.flatMap(id => (MEMBERS[id].speaks ? [] : [...new Set(SITUATIONS.flatMap(situation => CAST.ja.quotes[id][situation]))].flatMap(ja => (reported(id, ja).ko === ja ? [] : [`${reported(id, ja).ko} = ${ja}`]))))).toEqual([
    '후!! = フ！',
    '와… 아… = わァ…あ…',
    '싫어!!! = イヤッ',
    '싫어~. = ヤダーッ',
    '루루루루루 = ルルルルル',
    '후웅? = フゥン',
    '우라 = ウラ',
    '야하 = ヤハ',
    '하아? = ハァ？',
    '(안주를 나눠 준다) = (つまみを分けてくれる)',
    '(손으로 O를 그린다) = (手で○を作る)',
    '하―앗… = ハーッ…',
    '캬아~ = カーッ…',
    '(손으로 X를 그린다) = (手で×を作る)',
    '(커피를 건넨다) = (缶コーヒーをおごる)',
    '(책을 읽어 준다) = (本を読み聞かせる)',
    '(후훗 하고 웃는다) = (フフッと笑う)',
    '(古本 표지판을 세운다) = (「古本」ののぼりを立てる)',
    '(볼에 빗금을 띄우며 기뻐한다) = (頬を染めて喜ぶ)',
    '(쿡쿡 웃는다) = (クスクス笑う)',
    '(물음표를 띄운다) = (？を浮かべる)',
    '(땀을 뻘뻘 흘린다) = (汗をかく)',
  ])
})

test('a sentence with a value in it reads as its language says it', () => {
  const { en, ko, ja } = WORDS

  expect([ko.spoken(65_000), en.spoken(65_000), ja.spoken(65_000)]).toEqual(['1분 5초', '1m 5s', '1分5秒'])
  expect([ko.spoken(4000), en.spoken(4000), ja.spoken(4000)]).toEqual(['4초', '4s', '4秒'])
  expect([ko.amount(4600), en.amount(4600), ja.amount(4600)]).toEqual(['4.6천', '4.6k', '4600'])
  expect([ko.amount(171_000), en.amount(171_000), ja.amount(171_000)]).toEqual(['17.1만', '171k', '17.1万'])
  expect([ko.amount(120_000_000), en.amount(120_000_000), ja.amount(120_000_000)]).toEqual(['1.2억', '120M', '1.2億'])
  expect(en.amount(2_500_000_000)).toBe('2.5B')
  expect([ko.until(125), en.until(125), ja.until(125)]).toEqual(['2시간 5분 뒤 초기화', 'resets in 2h 5m', '2時間5分後にリセット'])
  expect([ko.until(60 * 50), en.until(60 * 50), ja.until(60 * 50)]).toEqual(['2일 뒤 초기화', 'resets in 2d', '2日後にリセット'])
  // English counts one and many apart.
  expect([en.handed(1), en.handed(3)]).toEqual(['handed to 1 friend', 'handed to 3 friends'])
  expect([en.tools(1), en.tools(2)]).toEqual(['1 tool call', '2 tool calls'])
  expect([en.waveDone(1), en.waveDone(4)]).toEqual(['1 task done', '4 tasks done'])
  // Korean chooses the particle by the role's last sound.
  expect(ko.roleToast('🦦 랏코', '검토', false, true)).toBe('🦦 랏코의 역할을 검토로 바꿨어요.')
  expect(ko.roleToast('🦦 랏코', '구현', true, false)).toBe('🦦 랏코의 역할을 구현으로 바꿨어요. 원래 역할이에요. 저장하지는 못해서 이번 세션에만 적용돼요.')
  expect(ja.tally(2, 1)).toBe('きょうの仕事: 2件完了 · 1件失敗')
  expect(en.tally(2, 0)).toBe('Today: 2 done')
  // The command says what it takes in each language, with the same English arguments.
  for (const lang of LANGS) expect(WORDS[lang].argumentHint).toContain('lang [auto|en|ko|ja]')
})
