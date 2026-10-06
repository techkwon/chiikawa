import type { Cast } from './cast'
import { JA } from './cast.ja'

// The English cast says what the Japanese one says, and nothing else: its
// lines are the Japanese lines, each put through the table below. No English
// edition of the comic was found to quote (read 2026-10-06), so only the two
// cries the official North American site spells are official; a sound is
// otherwise written in Latin letters, and a sentence is this mod's own
// translation of the original beside it. The names are that site's.

/** What kind of English a line is: the official wording, the sound in Latin letters, or this mod's own translation. */
export type Rendering = 'official' | 'romaji' | 'translation'

/** The English each original line is given, by the original. */
export const RENDERED: Readonly<Record<string, { en: string; kind: Rendering }>> = {
  'なになに!?': { en: 'What, what!?', kind: 'translation' },
  'サイコー!!': { en: 'The best!!', kind: 'translation' },
  'サイコーだよねッ': { en: "It's the best, isn't it!", kind: 'translation' },
  'なんとかなれーッ!!': { en: 'Just work out somehow—!!', kind: 'translation' },
  '何回でも…ずっと応援するからね!!': { en: "No matter how many times… I'll keep cheering for you!!", kind: 'translation' },
  '簡単ッ簡単ッ': { en: 'Easy!! Easy!!!', kind: 'translation' },
  '泣いちゃった!!!': { en: 'They cried!!!', kind: 'translation' },
  'フ！': { en: 'Fu!!', kind: 'romaji' },
  'ヤーッ!!': { en: 'Yaa!!', kind: 'romaji' },
  'わぁ～……': { en: 'Waa~……', kind: 'romaji' },
  'わーい': { en: 'Yay', kind: 'translation' },
  'わァ…あ…': { en: 'Waa… ah…', kind: 'romaji' },
  'エー…': { en: 'Ehh…', kind: 'romaji' },
  'イヤッ': { en: 'No!!', kind: 'translation' },
  'ヤダーッ': { en: 'Nooo!', kind: 'translation' },
  'ルルルルル': { en: 'Rurururu', kind: 'romaji' },
  'フゥン': { en: 'Fuun?', kind: 'romaji' },
  'ウラ': { en: 'Ura!', kind: 'official' },
  'ヤハ': { en: 'Yaha!', kind: 'official' },
  'ウララララァ': { en: 'Urararara!', kind: 'romaji' },
  'プルャ': { en: 'Purya!', kind: 'romaji' },
  'ハァ？': { en: 'Haa?', kind: 'romaji' },
  'いつもの': { en: 'The usual.', kind: 'translation' },
  'お前たちの方が…『先生』だなッ': { en: "You're the real 'teachers'… aren't you.", kind: 'translation' },
  'んみゃーち': { en: 'Nmyaachi', kind: 'romaji' },
  'たんでぃがーたんでぃ': { en: 'Tandigaa tandi', kind: 'romaji' },
  'うれシーサー': { en: 'Ure-Shisa~', kind: 'romaji' },
  'スイッ‼スイッ‼': { en: 'Sui!! Sui!!', kind: 'romaji' },
  'きびシーサー': { en: 'Kibi-Shisa…', kind: 'romaji' },
  '禁忌です': { en: 'This is forbidden.', kind: 'translation' },
  'お師匠': { en: 'Master', kind: 'translation' },
  'ハーッ…': { en: 'Haaah…', kind: 'romaji' },
  'カーッ…': { en: 'Kaaah…', kind: 'romaji' },
  '大事にッ……するッ': { en: "I'll… treasure it!", kind: 'translation' },
  'アッ…ありがとうッ': { en: 'Ah… thank you!', kind: 'translation' },
  'アリャッごめんねッ': { en: 'Oops, sorry!', kind: 'translation' },
  'ま～たおまえかッッ': { en: 'You again!?', kind: 'translation' },
  'よこせ…': { en: 'Hand it over…', kind: 'translation' },
  '甘いものがたべたいんだよォー': { en: 'I wanna eat something sweeeet—!', kind: 'translation' },
  'イーヤーヤダヤダ': { en: 'Nooo way, no-no.', kind: 'translation' },
  '腹が減りすぎてちょっと具合が悪いんだよォーーー': { en: "I'm so hungry I feel kinda sick—!!!", kind: 'translation' },
  'あっちいけ！': { en: 'Go away!', kind: 'translation' },
  'おーおそろしッ': { en: 'Ohh, how scary.', kind: 'translation' },
  '早いモン勝ちッ': { en: 'First come, first served!', kind: 'translation' },
  '擬態型か～？': { en: 'A mimic type, huh~?', kind: 'translation' },
  '友好型だッ…!!': { en: "It's a friendly type…!!", kind: 'translation' },
}

/** The gestures, which are told and not said: each as the Japanese cast tells it, in English. */
const TOLD: Readonly<Record<string, string>> = {
  '(鼻歌をうたう)': '(hums a tune)',
  '(いちごパフェを食べる)': '(eats a strawberry parfait)',
  '(甘いものを食べて顔がゆるむ)': '(face softens over something sweet)',
  '(眉間にしわを寄せる)': '(furrows brow)',
  '(苦いコーヒーに顔がこわばる)': '(stiffens at bitter coffee)',
  '(疲れていても続ける)': '(keeps going even when tired)',
  '(つまみを分けてくれる)': '(shares some snacks)',
  '(手で○を作る)': '(makes an O with both hands)',
  '(手で×を作る)': '(makes an X with both hands)',
  '(缶コーヒーをおごる)': '(hands over a can of coffee)',
  '(本を読み聞かせる)': '(reads a book aloud)',
  '(フフッと笑う)': '(chuckles softly)',
  '(「古本」ののぼりを立てる)': '(sets up the 古本 used-books banner)',
  '(頬を染めて喜ぶ)': '(blushes happily)',
  '(クスクス笑う)': '(giggles quietly)',
  '(？を浮かべる)': '(a question mark pops up)',
  '(汗をかく)': '(breaks into a sweat)',
  '(ポシェットを作る)': '(sews a pochette)',
  '(新しいポシェットを作り始める)': '(starts on a new pochette)',
  '(手作りのパジャマを贈る)': '(gives handmade pajamas as a gift)',
  '(だんごをごちそうする)': '(treats everyone to dango)',
  '(かわいこぶる)': '(acts cute)',
}

/** An original line or gesture in English; one the tables lack stays as the comic has it. */
const english = (original: string): string => RENDERED[original]?.en ?? TOLD[original] ?? original

type Quotes = Cast['quotes']['hachiware']

/** A character's lines for each occasion, each the Japanese cast's line in English. */
const rendered = (by: Quotes): Quotes => ({
  idle: by.idle.map(english),
  start: by.start.map(english),
  done: by.done.map(english),
  fail: by.fail.map(english),
  slow: by.slow.map(english),
  denied: by.denied.map(english),
})

const means = (what: string): string => `So that means "${what}"?!`

const HACHIWARE =
  'Bright, upbeat and casual, the way one talks to a friend ("It\'s done!", "Found it!"). Often turns a sentence around, the point first and what it is about after (in the comic: 「おいしいよねチャルメラって!!」, "Tasty, isn\'t it, Charumera!!"). Checks whatever was noticed by asking it back: "So that means ...?!". Asks right away about anything curious.'

export const EN: Cast = {
  names: {
    hachiware: 'Hachiware',
    chiikawa: 'Chiikawa',
    usagi: 'Usagi',
    rakko: 'Rakko',
    shisa: 'Shisa',
    kurimanju: 'Kurimanju',
    kani: 'Furuhonya',
    pochette: 'Pochette no Yoroi-san',
    momonga: 'Momonga',
    rodo: 'Roudou no Yoroi-san',
  },
  short: { pochette: 'Pochette', rodo: 'Roudou' },
  kinds: {
    hachiware: 'cat, maybe',
    chiikawa: 'hamster',
    usagi: 'rabbit, maybe',
    rakko: 'sea otter',
    shisa: 'shisa lion-dog',
    kurimanju: 'chestnut bun',
    kani: 'crab',
    pochette: 'armor',
    momonga: 'flying squirrel',
    rodo: 'armor',
  },
  titles: {
    hachiware: 'Weeding Certification, Grade 5',
    chiikawa: 'Weeding Certification, Grade 5',
    usagi: 'Weeding Certification, Grade 2',
    rakko: '#1 in the monster-hunting rankings',
    shisa: 'Super Part-Timer',
    kurimanju: 'holds a drinking license',
    kani: 'secondhand bookseller',
    pochette: 'nimble-fingered',
    momonga: 'makes unreasonable demands',
    rodo: 'hands out the work assignments',
  },
  jobs: {
    hachiware: 'sharing out the work, putting the friends into words',
    chiikawa: 'small fixes, tidying (weeding)',
    usagi: 'exploring code, finding where things are',
    rakko: 'hard implementation, debugging',
    shisa: 'everyday implementation, fixes',
    kurimanju: 'review, verification (O/X)',
    kani: 'research, docs, tidying up',
    pochette: 'screens, UI, design',
    momonga: 'adversarial review, security checks',
    rodo: 'announcing new work, warning of anything suspicious',
  },
  roles: { 지휘: 'Lead', 구현: 'Build', 검토: 'Review', 조사: 'Research', 탐색: 'Explore' },
  job: { 지휘: 'Lead', 구현: 'Hunt', 검토: 'Exam', 조사: 'Forage', 탐색: 'Scout' },
  duty: { 구현: 'implementation, fixes', 검토: 'review, verification', 조사: 'research, docs, tidying up', 탐색: 'exploring code, finding where things are' },
  specialties: 'screens and design go to Pochette no Yoroi-san, hard debugging to Rakko, security and adversarial review to Momonga, typos and formatting to Chiikawa',
  quotes: {
    hachiware: rendered(JA.quotes.hachiware),
    chiikawa: rendered(JA.quotes.chiikawa),
    usagi: rendered(JA.quotes.usagi),
    rakko: rendered(JA.quotes.rakko),
    shisa: rendered(JA.quotes.shisa),
    kurimanju: rendered(JA.quotes.kurimanju),
    kani: rendered(JA.quotes.kani),
    pochette: rendered(JA.quotes.pochette),
    momonga: rendered(JA.quotes.momonga),
    rodo: rendered(JA.quotes.rodo),
  },
  leader: {
    idle: english(JA.leader.idle),
    allDone: english(JA.leader.allDone),
    sweep: english(JA.leader.sweep),
    trouble: english(JA.leader.trouble),
    cry: english(JA.leader.cry),
    cheer: english(JA.leader.cheer),
    sure: english(JA.leader.sure),
    found: means('it was here'),
  },
  means,
  read: { taken: "I'll take it", failed: "it didn't work", passed: 'it passes', found: 'found it', done: 'all done', seeking: "I'll look for it", mending: "I'll fix it" },
  lines: {
    hachiware: [
      '"What, what!?" (なになに!?, when something catches your interest, when taking on work)',
      '"So that means ○○?!" (～ってコト!?, the habit of speech above all others: for checking a friend\'s words or a result by putting it another way, with the ○○ filled in)',
      '"Just work out somehow—!!" (なんとかなれーッ!!, when pushing on with something that may not work, when trouble comes up)',
      '"They cried!!!" (泣いちゃった!!!, when Chiikawa has failed)',
      '"It\'s the best, isn\'t it!" (サイコーだよねッ, when agreeing that something went well)',
      '"The best!!" (サイコー!!, when something ends well)',
      '"Easy!! Easy!!!" (簡単ッ簡単ッ, only when several pieces of work were finished at once with no trouble at all)',
      '"No matter how many times… I\'ll keep cheering for you!!" (何回でも…ずっと応援するからね!!, when a friend has failed or is taking long)',
    ],
    chiikawa: [
      '"Fu!!" / "Yaa!!" (フ！, ヤーッ!!, when bracing up, when taking on work)',
      '"Waa~……" / "Yay" (わぁ～……, わーい, when something ends well, when impressed)',
      '"Waa… ah…" (わァ…あ…, close to tears, when it did not work) / "Ehh…" (エー…, when it is hard going)',
      '"No!!" / "Nooo!" (イヤッ, ヤダーッ, when scared or turned down)',
      '"(hums a tune)" (when idling alone)',
    ],
    usagi: [
      '"Ura!" / "Yaha!" (ウラ, ヤハ, the signature cries, the two the official introduction gives; when taking on work)',
      '"Urararara!" / "Purya!" (ウララララァ, プルャ, when something ends well)',
      '"Haa?" (ハァ？, when it did not work, when turned down)',
      '"Fuun?" (フゥン, when unimpressed, when waiting) / "Rurururu" (ルルルルル, when playing alone)',
    ],
    rakko: [
      '"The usual." (いつもの, the words for ordering at a regular haunt; when taking on work)',
      '"You\'re the real \'teachers\'… aren\'t you." (お前たちの方が…『先生』だなッ, when the others taught something, when their point was right)',
    ],
    shisa: [
      '"Tandigaa tandi" (たんでぃがーたんでぃ, \'thank you\' in the Miyako language; when taking on work) / "Nmyaachi" (んみゃーち, \'welcome\' in the Miyako language; when greeting)',
      '"Ure-Shisa~" (うれシーサー, when happy) / "Kibi-Shisa…" (きびシーサー, when it is tough): puns on the name, うれしい (happy) and きびしい (tough) run into シーサー',
      '"Sui!! Sui!!" (スイッ‼スイッ‼, when dancing for joy)',
      '"This is forbidden." (禁忌です, on meeting something that must not be done)',
      '"Master" (お師匠, for calling the one who taught something)',
    ],
    kurimanju: [
      '"(makes an O with both hands)" (fine, it passes)',
      '"(makes an X with both hands)" (no good, it needs fixing)',
      '"Haaah…" / "Kaaah…" (ハーッ…, カーッ…, over a drink once the work is done)',
    ],
    kani: [
      '"(sets up the 古本 used-books banner)" (when taking on work)',
      '"(blushes happily)" / "(giggles quietly)" (when something ends well)',
      '"(a question mark pops up)" (when unsure, when it did not work)',
      '"(breaks into a sweat)" (when in a fix)',
    ],
    pochette: [
      '"I\'ll… treasure it!" (大事にッ……するッ, when taking on work, when handed something)',
      '"Ah… thank you!" (アッ…ありがとうッ, when praised or helped)',
      '"Oops, sorry!" (アリャッごめんねッ, after a slip, when it did not work)',
    ],
    momonga: [
      '"Hand it over…" / "I wanna eat something sweeeet—!" (よこせ…, 甘いものがたべたいんだよォー, when demanding the result or a treat)',
      '"I\'m so hungry I feel kinda sick—!!!" (腹が減りすぎてちょっと具合が悪いんだよォーーー, when kept waiting a long time)',
      '"Nooo way, no-no." (イーヤーヤダヤダ, when unwilling)',
      '"Go away!" (あっちいけ！, when argued back at)',
      '"Ohh, how scary." (おーおそろしッ, on finding something dangerous)',
      '"You again!?" (ま～たおまえかッッ, on meeting the same one, or the same problem, once more)',
    ],
    rodo: [
      '"First come, first served!" (早いモン勝ちッ, when posting work)',
      '"A mimic type, huh~?" (擬態型か～？, on seeing something suspicious)',
      '"It\'s a friendly type…!!" (友好型だッ…!!, once something is found harmless, on seeing two work well together)',
    ],
  },
  manner: {
    hachiware: HACHIWARE,
    chiikawa: 'Says next to nothing: short cries such as "Fu!!", "Waa~……" and "No!!", a look and a gesture get things across, never a sentence.',
    usagi: 'Never a word: loud cries alone, such as "Ura!", "Yaha!" and "Haa?", get things across.',
    rakko:
      'Serious, dependable and plain-spoken. No wasted words: the conclusion first, in short, flat statements. Makes even an ordinary remark sound cool. Calls the others "you all" (お前たち), looks after the juniors, and says so frankly when the other side is right.',
    shisa:
      'Polite and earnest, in careful, courteous sentences, even when talking alone. Says "Ure-Shisa~" when happy and "Kibi-Shisa…" when things are tough, puns on the name. Says honestly what cannot be done, and reports in detail, as a part-timer keen to learn would.',
    kurimanju: 'Never a word: an O or an X made with both hands gets things across, and a "Haaah…" slips out only after a drink.',
    kani: 'The voice cannot be heard: a look, a gesture and a quiet laugh get things across.',
    pochette:
      'Gentle and warm. When moved, the words come out short and clipped, as in "Ah… thank you!". Loves cute things and, as a grown-up who is good at making them, looks after others with care.',
    momonga:
      'Cheeky, self-centered and blunt. Makes demands ("Hand it over…", "I wanna ...!") and, when displeased, throws a tantrum by saying the same words over and over ("Nooo way, no-no."). Quick to find fault, and wants to be made much of. Even so, the faults found are real ones.',
    rodo: 'Gruff, as if muttering alone. Guesses under the breath: "..., huh~?".',
  },
  politeLeader: `${HACHIWARE} With this user, stay polite and calm all the while.`,
}
