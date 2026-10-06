import type { Lang, LangKept, Phrase, TaskStatus } from '../types'

/** The languages, the one the mode falls back on first. */
export const LANGS: readonly Lang[] = ['en', 'ko', 'ja']

/** Words made in every language at once, each as that language makes them. */
export const inAll = (make: (lang: Lang) => string): Phrase => ({ en: make('en'), ko: make('ko'), ja: make('ja') })

/** Words that are someone else's, as they were written: the same in every language. */
export const asIs = (text: string): Phrase => inAll(() => text)

/** What each language calls itself. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', ko: '한국어', ja: '日本語' }

/**
 * What settled the language, the first of these that holds: the mode's own
 * setting, the person's choice by `/chiikawa lang`, the letters of the prompts
 * they type, Claude Code's own language, the environment's locale, or nothing.
 */
export type LangFrom = 'setting' | 'chosen' | 'typed' | 'config' | 'env' | 'default'

const WORDED: readonly (readonly [RegExp, Lang])[] = [
  [/^(?:en|english|영어|英語)$/i, 'en'],
  [/^(?:ko|korean|한국어|韓国語)$/i, 'ko'],
  [/^(?:ja|japanese|일본어|日本語)$/i, 'ja'],
]

/** The language a word of the person's names, in any of the three. */
export const langNamed = (word: string): Lang | undefined => WORDED.find(([pattern]) => pattern.test(word.trim()))?.[1]

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/g
/** Kana alone: the long-vowel mark and the middle dot are written in other languages too. */
const KANA = /[ぁ-ゖァ-ヺｦ-ｯｱ-ﾝ]/g
/** How much of a prompt is read for its letters: what follows is taken to be pasted. */
const TYPED_CHARS = 2000
/** The fewest letters of a language that tell a prompt is written in it. */
const TYPED_LEAST = 2

/**
 * The language a typed prompt is written in, by its letters: Hangul is Korean
 * and kana Japanese, whichever there is more of, and at least two of it, so
 * that one letter quoted in another language's prompt tells nothing. Latin
 * letters and Han characters alone say nothing, so a command in English
 * changes no language, and neither does a slash command with whatever
 * follows it.
 */
export const typedLang = (text: string): Lang | undefined => {
  const typed = text.trimStart()

  if (typed.startsWith('/')) return undefined
  const read = typed.slice(0, TYPED_CHARS)
  const hangul = read.match(HANGUL)?.length ?? 0
  const kana = read.match(KANA)?.length ?? 0

  if (Math.max(hangul, kana) < TYPED_LEAST) return undefined

  return hangul > kana ? 'ko' : kana > hangul ? 'ja' : undefined
}

/** Korean or Japanese as a setting or a locale names it (`ko_KR.UTF-8`, `Japanese`, `日本語`); nothing for any other. */
export const localeLang = (value: string): Lang | undefined => {
  const named = value.trim()

  if (/^(?:ko(?![a-z])|korean|한국어)/i.test(named)) return 'ko'

  return /^(?:ja(?![a-z])|japanese|日本語)/i.test(named) ? 'ja' : undefined
}

/** The language Claude Code's own setting names, where it is one of the three: English as well, which a locale is not read for. */
export const configLang = (value: string): Lang | undefined => localeLang(value) ?? (/^(?:en(?![a-z])|english)/i.test(value.trim()) ? 'en' : undefined)

/** The languages an earlier session kept, with whatever is not one of the three left out. */
export const langKeptFrom = (kept: unknown): LangKept => {
  if (typeof kept !== 'object' || kept === null) return {}
  const held: Readonly<Record<string, unknown>> = { ...kept }
  const chosen = LANGS.find(lang => lang === held.chosen)
  const typed = LANGS.find(lang => lang === held.typed)

  return { ...(chosen === undefined ? {} : { chosen }), ...(typed === undefined ? {} : { typed }) }
}

/**
 * Everything the screen and the command's answers say, in one language. A
 * sentence that holds a value is a function, and what a language does to a
 * word beside a value (a Korean particle, an English plural, a Japanese
 * counter) is done inside it.
 */
export type Words = {
  /** The mode's name: on the band, on the pane and as its title. */
  brand: string
  /** What stands in the pane's far corner while the mode is on, and while it is off. */
  on: string
  off: string

  // ---- times and amounts
  /** A length of time as it is said. */
  spoken: (ms: number) => string
  /** A token count as a reader of the language says it. */
  amount: (tokens: number) => string
  tokens: (fresh: string, cached: string, out: string) => string
  /** When a window resets, so many minutes on. */
  until: (minutes: number) => string
  took: (seconds: number) => string
  exitCode: (code: string) => string

  // ---- what a character is doing
  status: Record<TaskStatus, string>
  idle: string
  leading: string
  receiving: string
  alone: string
  together: string
  helping: string
  aidingLead: string
  awaiting: string
  atWork: (names: readonly string[]) => string
  handed: (count: number) => string
  withFriend: (name: string) => string
  more: (count: number) => string
  tools: (count: number) => string
  today: (done: number, failed: number) => string
  tally: (done: number, failed: number) => string

  // ---- the usage
  usage: string
  usageTitle: string
  seeUsage: string
  noUsage: string
  fold: string
  battery: string
  limits: Record<string, string>
  left: (percent: number, used: string, window: string) => string
  used: (percent: number) => string
  session: (usd: string) => string
  sessionCost: (usd: string) => string
  pay: string

  // ---- the band
  sent: (to: string) => string
  auto: string
  working: (count: number) => string
  resting: (count: number) => string

  // ---- the pane
  busy: (count: number) => string
  trio: string
  waiting: (count: number) => string
  rest: string
  atWorkLabel: string
  workers: string
  bench: string
  help: string
  talk: string
  earlier: (range: string) => string
  older: string
  newer: string
  all: string
  allShort: string
  only: string

  // ---- a character's sheet
  labels: { now: string; today: string; pay: string; ended: string; report: string; role: string; result: string; said: string }
  bell: string
  conducting: (count: number) => string
  close: string
  ownRole: (role: string) => string
  askLead: string
  askFriend: string
  picked: string

  // ---- what a line of the conversation is about
  spinner: Record<string, string>
  doing: (name: string, job: string) => string
  started: (job: string, title: string) => string
  bellNote: string
  reading: (name: string) => string
  mourning: (name: string) => string
  paired: string
  seeking: string
  mending: string
  lending: (name: string, verb: string) => string
  ended: (job: string, isOk: boolean) => string
  waveFailed: (total: number, failed: number) => string
  waveDone: (total: number) => string
  letGo: (name: string, title: string) => string
  /** A subagent's task no agent was ever told to be whose, let go. */
  lost: (name: string, title: string) => string
  keeping: (job: string, time: string) => string
  waitingFor: (name: string, time: string) => string
  denied: (tool: string) => string
  watching: (name: string, tool: string) => string
  noResult: string
  noPath: string
  /** Its result file is one another worker is still waited for at. */
  sharedOut: string
  launchFailed: string
  stopped: string
  unseen: string
  apiError: string
  refused: string

  // ---- the demonstration
  demo: string
  /** The four made-up tasks: finding a place, a hard fix, a small fix that fails, a review. */
  demoTitles: readonly [string, string, string, string]
  demoReport: (title: string) => string

  // ---- the command and its answers
  description: string
  argumentHint: string
  turnedOn: string
  turnedOff: string
  cleared: string
  clearedAll: string
  demoOff: string
  demoStarted: string
  talkOnly: string
  talkAll: string
  autoSet: string
  autoHow: string
  autoBack: (who: string) => string
  unpicked: (who: string) => string
  pickedToast: (mark: string, name: string) => string
  pickedSay: (mark: string, name: string) => string
  opened: string
  recent: string

  // ---- the roles
  unkept: string
  rolesTitle: string
  roleRow: (who: string, role: string, job: string, own?: string) => string
  roleHelp: (roles: readonly string[], specialties: string) => string[]
  roleToast: (who: string, role: string, isOwn: boolean, isKept: boolean) => string
  rolesReset: (isKept: boolean) => string
  rolesSame: string
  leadRole: string
  roleUnknown: string
  roleSame: (who: string, role: string) => string
  roleBack: (who: string, role: string, isKept: boolean) => string
  roleGiven: (who: string, name: string, role: string, own: string, specialties: string, isKept: boolean) => string

  // ---- the language
  langNow: (name: string, from: LangFrom) => string
  langHow: string
  langChosen: (name: string, isKept: boolean) => string
  langAuto: string
  /** The letters of a prompt turned the screen to this language; `back` is the code of the one it was in. */
  langTyped: (name: string, back: Lang, isKept: boolean) => string
  langFixed: (name: string) => string
  langUnknown: string
}

/** A figure cut to three digits: `4.6`, `17.1`, `120`. */
const short = (value: number): string => (value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10))

const whole = (ms: number): { minutes: number; seconds: number } => {
  const seconds = Math.max(0, Math.round(ms / 1000))

  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 }
}

/** `검토로`, `구현으로`: a role as what something is changed to. */
const toRole = (role: string): string => `${role}${role === '구현' || role === '탐색' ? '으로' : '로'}`

const KO_UNKEPT = '저장하지는 못해서 이번 세션에만 적용돼요.'
const koSpecialtyFirst = (specialties: string): string =>
  `화면·디버깅·보안처럼 전문 분야가 정해진 일(${specialties})은 역할과 상관없이 그 담당이 먼저 맡아요(그 담당의 역할을 바꾼 경우는 빼고요).`

const KO: Words = {
  brand: '먼작귀',
  on: '켜짐',
  off: '꺼짐',

  spoken: ms => {
    const { minutes, seconds } = whole(ms)

    return minutes === 0 ? `${seconds}초` : `${minutes}분 ${seconds}초`
  },
  // 4.6천, 17.1만, 1.2억.
  amount: tokens => {
    if (tokens >= 100_000_000) return `${short(tokens / 100_000_000)}억`
    if (tokens >= 10_000) return `${short(tokens / 10_000)}만`
    if (tokens >= 1_000) return `${short(tokens / 1_000)}천`

    return String(Math.round(tokens))
  },
  tokens: (fresh, cached, out) => `입력 ${fresh} · 캐시 ${cached} · 출력 ${out}`,
  until: minutes => {
    const hours = Math.floor(minutes / 60)

    if (hours >= 48) return `${Math.floor(hours / 24)}일 뒤 초기화`

    return hours === 0 ? `${minutes}분 뒤 초기화` : `${hours}시간 ${minutes % 60}분 뒤 초기화`
  },
  took: seconds => `${seconds}초`,
  exitCode: code => `종료 코드 ${code}`,

  status: { running: '작업 중', waiting: '기다리는 중', done: '끝', failed: '실패' },
  idle: '대기',
  leading: '지휘 중',
  receiving: '접수 중',
  alone: '직접 하는 중',
  together: '같이 하는 중',
  helping: '거드는 중',
  aidingLead: '하치와레를 거드는 중',
  awaiting: '일감을 기다리는 중',
  atWork: names => `일하는 친구: ${names.join(', ')}`,
  handed: count => `친구 ${count}명에게 맡김`,
  withFriend: name => `${name}와 함께`,
  more: count => `외 ${count}개`,
  tools: count => `도구 ${count}회`,
  today: (done, failed) => `${done}개 끝${failed === 0 ? '' : ` · ${failed}개 실패`}`,
  tally: (done, failed) => `오늘 한 일: ${KO.today(done, failed)}`,

  usage: '사용량',
  usageTitle: '먼작귀 사용량',
  seeUsage: '사용량 보기',
  noUsage: '아직 읽은 사용량이 없어요.',
  fold: '접기',
  battery: '배터리',
  limits: { five_hour: '5시간', seven_day: '7일', spend_limit: '지출' },
  left: (percent, used, window) => `${percent}% 남음 · 컨텍스트 ${used} / ${window}`,
  used: percent => `${percent}% 사용`,
  session: usd => `Claude 세션 $${usd}`,
  sessionCost: usd => `Claude 세션 비용 $${usd}`,
  pay: '친구별 보수 (토큰, 이번 세션 누적)',

  sent: to => `보내기: ${to}`,
  auto: '자동',
  working: count => `일하는 친구 ${count}`,
  resting: count => `쉬는 친구 ${count}`,

  busy: count => `일하는 중 ${count}명`,
  trio: '셋이 같이 하는 중',
  waiting: count => `기다리는 친구 ${count}명`,
  rest: '쉬는 중',
  atWorkLabel: '일하는 중',
  workers: '일하는 친구들',
  bench: '쉬는 친구들',
  help: '이름을 누르면 그 친구가 하는 일이 보여요',
  talk: '이야기',
  earlier: range => `지난 이야기 ${range}`,
  older: '▲ 이전',
  newer: '▼ 다음',
  all: '전체 보기',
  allShort: '전체',
  only: '이야기만',

  labels: { now: '지금', today: '오늘', pay: '보수', ended: '끝낸 일', report: '보고', role: '역할', result: '결과', said: '한 말' },
  bell: '일을 맡지 않아요. 일감이 걸리면 종을 흔들어요.',
  conducting: count => `지휘 중 · 친구들이 맡은 일 ${count}개`,
  close: '닫기',
  ownRole: role => `원래 ${role}`,
  askLead: '▷ 다음 명령은 하치와레가 직접 하기',
  askFriend: '▷ 이 친구에게 다음 명령 맡기기',
  picked: '▶ 다음 명령을 맡기로 했어요 · 누르면 취소',

  spinner: {
    requesting: '하치와레 일감 살피는 중',
    thinking: '하치와레 궁리하는 중',
    responding: '하치와레 말하는 중',
    'tool-input': '하치와레 일감 적는 중',
    'tool-use': '하치와레 지휘 중',
  },
  doing: (name, job) => `${name} ${job} 중`,
  started: (job, title) => `${job} 시작 · ${title}`,
  bellNote: '일감 접수',
  reading: name => `${name}의 말 풀이`,
  mourning: name => `${name}의 실패를 보고`,
  paired: '둘이 같이 일하는 걸 보고',
  seeking: '찾는 중',
  mending: '고치는 중',
  lending: (name, verb) => `${name}와 ${verb}`,
  ended: (job, isOk) => `${job} ${isOk ? '끝' : '실패'}`,
  waveFailed: (total, failed) => `${total}개 가운데 ${failed}개 실패`,
  waveDone: total => `${total}개 작업 끝`,
  letGo: (name, title) => `${name}의 ${title} · 결과가 없어 내려놓음`,
  lost: (name, title) => `${name}의 ${title} · 끝을 알 수 없어 내려놓음`,
  keeping: (job, time) => `${job} 계속하는 중 · ${time} 지남`,
  waitingFor: (name, time) => `${name}를 ${time}째 기다리는 중`,
  denied: tool => `${tool} 거절당함`,
  watching: (name, tool) => `${name}의 ${tool}을 지켜보다가`,
  noResult: '한 시간이 넘도록 결과 파일이 안 보여요. 직접 확인해 주세요',
  noPath: '결과 파일 경로를 읽지 못해서, 끝났는지는 직접 확인해야 해요',
  sharedOut: '다른 작업이 같은 결과 파일을 쓰고 있어서, 이 작업의 결과는 직접 확인해야 해요',
  launchFailed: '실행 명령이 오류로 끝남',
  stopped: '중단됨',
  unseen: '결과는 직접 확인',
  apiError: 'API 오류',
  refused: '거절',

  demo: '시연',
  demoTitles: ['시연: 설정 파일 위치 찾기', '시연: 로그인 버그 토벌', '시연: 오타 고치기', '시연: 바뀐 코드 다시 보기'],
  demoReport: title => `시연이라 실제로 한 일은 없어요 (${title})`,

  description: '치이카와 모드: 먼작귀 친구들 현황 패널을 열거나 켜고 끈다',
  argumentHint: '[on|off|usage|talk|role [친구 역할]|lang [auto|en|ko|ja]|clear [all]|demo|auto|친구 이름]',
  turnedOn: '치이카와 모드를 켰어요.',
  turnedOff: '치이카와 모드를 껐어요. /chiikawa on 으로 다시 켭니다.',
  cleared: '끝난 작업과 대화 기록을 지웠어요. 친구별 보수(누적 사용량)는 그대로예요. 진행 중으로 남은 것과 보수까지 지우려면 /chiikawa clear all',
  clearedAll: '진행 중으로 남아 있던 것까지 모든 작업과 대화 기록, 친구별 보수(누적 사용량)를 지웠어요.',
  demoOff: '치이카와 모드가 꺼져 있어요. /chiikawa on 으로 켠 뒤에 시연할 수 있어요.',
  demoStarted: '시연을 시작했어요. 실제 작업이 아니라 화면을 보여 주는 가짜 작업 4개가 15초쯤 돌아갑니다.',
  talkOnly: '패널에 이야기만 보여요. 한 번 더 입력하거나 패널의 `전체 보기`를 누르면 돌아가요.',
  talkAll: '패널을 전체 보기로 돌렸어요.',
  autoSet: '보내기를 자동으로 했어요. 가벼운 일은 하치와레·치이카와·우사기가 같이 하고, 힘든 일만 다른 친구를 불러요.',
  autoHow: '보내기 자동: 가벼운 일은 하치와레·치이카와·우사기가 같이 하고, 힘든 일만 다른 친구를 불러요. 정해서 맡기려면 친구 이름을 누른 뒤 맡기기를 눌러요.',
  autoBack: who => `${who} 지명을 풀었어요. 보내기는 다시 자동이에요.`,
  unpicked: who => `${who} 지명을 취소했어요.`,
  pickedToast: (mark, name) => `${mark} 다음 명령은 ${name}에게 맡겨요. 다시 고르면 취소돼요.`,
  pickedSay: (mark, name) => `${mark} 다음에 입력하는 명령은 ${name}에게 맡겨요. 같은 이름을 다시 고르면 취소돼요.`,
  opened: '먼작귀 친구들 현황 패널을 열었어요.',
  recent: '최근 대화',

  unkept: KO_UNKEPT,
  rolesTitle: '친구들의 역할',
  roleRow: (who, role, job, own) => `${who} · ${role} (${job})${own === undefined ? '' : ` ← 원래 ${own}`}`,
  roleHelp: (roles, specialties) => [
    `바꾸기: /chiikawa role <친구 이름> <${roles.join('|')}>`,
    '한 명 되돌리기: /chiikawa role <친구 이름> 기본 · 모두 되돌리기: /chiikawa role reset',
    '패널에서 친구 이름을 누른 뒤 역할을 눌러도 바뀌어요.',
    `역할을 받은 친구가 그 일을 먼저 맡아요. 다만 ${koSpecialtyFirst(specialties)}`,
  ],
  roleToast: (who, role, isOwn, isKept) => `${who}의 역할을 ${toRole(role)} 바꿨어요.${isOwn ? ' 원래 역할이에요.' : ''}${isKept ? '' : ` ${KO_UNKEPT}`}`,
  rolesReset: isKept => `친구들의 역할을 모두 원래대로 돌렸어요.${isKept ? '' : ` ${KO_UNKEPT}`}`,
  rolesSame: '바뀐 역할이 없어요. 모두 원래 역할이에요.',
  leadRole: '하치와레는 지휘를 맡고 있어서 역할을 바꿀 수 없어요.',
  roleUnknown: '누구에게 어떤 역할을 줄지 알 수 없어요.',
  roleSame: (who, role) => `${who}는 이미 ${role} 역할이에요.`,
  roleBack: (who, role, isKept) => `${who}의 역할을 원래대로 ${toRole(role)} 돌렸어요.${isKept ? '' : ` ${KO_UNKEPT}`}`,
  roleGiven: (who, name, role, own, specialties, isKept) =>
    `${who}의 역할을 ${toRole(role)} 바꿨어요(원래 ${own}). 이제 ${role} 일은 ${name}가 먼저 맡아요. 다만 ${koSpecialtyFirst(specialties)} ${isKept ? '다음 세션에도 그대로예요.' : KO_UNKEPT}`,

  langNow: (name, from) =>
    `지금 언어는 ${name}예요. ${
      {
        setting: '모드 설정(language)으로 정해 두었어요.',
        chosen: '/chiikawa lang 으로 고른 언어예요.',
        typed: '입력한 프롬프트의 글자를 보고 정했어요.',
        config: 'Claude Code의 언어 설정을 따랐어요.',
        env: '환경 변수(LC_ALL, LC_MESSAGES, LANG)를 따랐어요.',
        default: '따로 정해진 것이 없어서 기본인 영어예요.',
      }[from]
    }`,
  langHow: '바꾸기: /chiikawa lang <en|ko|ja> · 자동으로 되돌리기: /chiikawa lang auto',
  langChosen: (name, isKept) => `언어를 ${name}로 정했어요.${isKept ? ' 다음 세션에도 그대로예요.' : ` ${KO_UNKEPT}`}`,
  langAuto: '언어를 자동으로 정하게 했어요. 고른 언어와 입력한 글자로 기억해 둔 언어를 모두 지웠고, 다음에 입력하는 글자부터 다시 봐요.',
  langTyped: (name, back, isKept) => `입력한 글자를 보고 언어를 ${name}로 바꿨어요.${isKept ? '' : ` ${KO_UNKEPT}`} 되돌리려면 /chiikawa lang ${back}`,
  langFixed: name => `모드 설정(language)이 ${name}로 고정되어 있어서 화면은 그대로예요. 고른 값은 설정을 auto로 돌리면 쓰여요.`,
  langUnknown: '알 수 없는 언어예요. /chiikawa lang [auto|en|ko|ja] 가운데 하나를 써 주세요.',
}

/** `1 task`, `3 tasks`. */
const some = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`

const EN_UNKEPT = 'It could not be saved, so it holds for this session only.'
const enSpecialtyFirst = (specialties: string): string =>
  `However, work that has a specialist, such as screens, debugging and security (${specialties}), goes to that specialist first whatever the roles, unless the specialist's own role was changed.`

const EN: Words = {
  brand: 'Chiikawa',
  on: 'on',
  off: 'off',

  spoken: ms => {
    const { minutes, seconds } = whole(ms)

    return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
  },
  // 4.6k, 171k, 1.2M.
  amount: tokens => {
    if (tokens >= 1_000_000_000) return `${short(tokens / 1_000_000_000)}B`
    if (tokens >= 1_000_000) return `${short(tokens / 1_000_000)}M`
    if (tokens >= 1_000) return `${short(tokens / 1_000)}k`

    return String(Math.round(tokens))
  },
  tokens: (fresh, cached, out) => `in ${fresh} · cache ${cached} · out ${out}`,
  until: minutes => {
    const hours = Math.floor(minutes / 60)

    if (hours >= 48) return `resets in ${Math.floor(hours / 24)}d`

    return hours === 0 ? `resets in ${minutes}m` : `resets in ${hours}h ${minutes % 60}m`
  },
  took: seconds => `${seconds}s`,
  exitCode: code => `exit code ${code}`,

  status: { running: 'working', waiting: 'waiting', done: 'done', failed: 'failed' },
  idle: 'idle',
  leading: 'leading',
  receiving: 'at the desk',
  alone: 'on it alone',
  together: 'on it together',
  helping: 'lending a hand',
  aidingLead: 'lending Hachiware a hand',
  awaiting: 'waiting for work',
  atWork: names => `at work: ${names.join(', ')}`,
  handed: count => `handed to ${some(count, 'friend')}`,
  withFriend: name => `with ${name}`,
  more: count => `+${count} more`,
  tools: count => some(count, 'tool call'),
  today: (done, failed) => `${done} done${failed === 0 ? '' : ` · ${failed} failed`}`,
  tally: (done, failed) => `Today: ${EN.today(done, failed)}`,

  usage: 'Usage',
  usageTitle: 'Chiikawa usage',
  seeUsage: 'Show usage',
  noUsage: 'No usage has been read yet.',
  fold: 'Hide',
  battery: 'Battery',
  limits: { five_hour: '5h', seven_day: '7d', spend_limit: 'Spend' },
  left: (percent, used, window) => `${percent}% left · context ${used} / ${window}`,
  used: percent => `${percent}% used`,
  session: usd => `Claude session $${usd}`,
  sessionCost: usd => `Claude session cost $${usd}`,
  pay: 'Pay per friend (tokens, this session so far)',

  sent: to => `To: ${to}`,
  auto: 'auto',
  working: count => `${count} working`,
  resting: count => `${count} resting`,

  busy: count => `${count} working`,
  trio: 'The three, together',
  waiting: count => `${count} waiting`,
  rest: 'Resting',
  atWorkLabel: 'Working',
  workers: 'Friends at work',
  bench: 'Friends resting',
  help: 'Press a name to see what that friend is doing',
  talk: 'Talk',
  earlier: range => `Earlier ${range}`,
  older: '▲ Older',
  newer: '▼ Newer',
  all: 'Show all',
  allShort: 'All',
  only: 'Talk only',

  labels: { now: 'Now', today: 'Today', pay: 'Pay', ended: 'Done', report: 'Report', role: 'Role', result: 'Result', said: 'Said' },
  bell: 'Takes no tasks. Rings the bell when work comes in.',
  conducting: count => `leading · ${some(count, 'task')} with friends`,
  close: 'Close',
  ownRole: role => `own: ${role}`,
  askLead: '▷ Have Hachiware do the next prompt',
  askFriend: '▷ Hand this friend the next prompt',
  picked: '▶ Takes the next prompt · press to cancel',

  spinner: {
    requesting: 'Hachiware is looking over the work',
    thinking: 'Hachiware is thinking it over',
    responding: 'Hachiware is talking',
    'tool-input': 'Hachiware is writing up the work',
    'tool-use': 'Hachiware is leading',
  },
  doing: (name, job) => `${name} is on a ${job}`,
  started: (job, title) => `${job} begins · ${title}`,
  bellNote: 'work is in',
  reading: name => `reading ${name}`,
  mourning: name => `seeing ${name} fail`,
  paired: 'seeing two at work together',
  seeking: 'looking',
  mending: 'fixing',
  lending: (name, verb) => `${verb} with ${name}`,
  ended: (job, isOk) => `${job} ${isOk ? 'done' : 'failed'}`,
  waveFailed: (total, failed) => `${failed} of ${total} failed`,
  waveDone: total => `${some(total, 'task')} done`,
  letGo: (name, title) => `${name}'s ${title} · no result came, so it was let go`,
  lost: (name, title) => `${name}'s ${title} · its end could not be learned, so it was let go`,
  keeping: (job, time) => `${job} still going · ${time} in`,
  waitingFor: (name, time) => `${time} waiting for ${name}`,
  denied: tool => `${tool} was denied`,
  watching: (name, tool) => `watching ${name}'s ${tool}`,
  noResult: 'No result file after more than an hour. Please check it yourself',
  noPath: 'The path of the result file could not be read, so please check yourself whether it has finished',
  sharedOut: 'Another task is using the same result file, so please check the result of this one yourself',
  launchFailed: 'the launch command ended in an error',
  stopped: 'stopped',
  unseen: 'check the result yourself',
  apiError: 'API error',
  refused: 'refused',

  demo: 'demo',
  demoTitles: ['Demo: find the config file', 'Demo: hunt the login bug', 'Demo: fix a typo', 'Demo: look over the changed code'],
  demoReport: title => `This was a demo, so nothing was really done (${title})`,

  description: "Chiikawa mode: open the friends' status pane, or turn the mode on and off",
  argumentHint: '[on|off|usage|talk|role [friend role]|lang [auto|en|ko|ja]|clear [all]|demo|auto|friend]',
  turnedOn: 'Chiikawa mode is on.',
  turnedOff: 'Chiikawa mode is off. Turn it back on with /chiikawa on.',
  cleared: "Cleared the finished tasks and the conversation. Each friend's pay (the usage so far) is kept. To clear what is still listed as running and the pay as well: /chiikawa clear all",
  clearedAll: "Cleared every task, even those still listed as running, along with the conversation and each friend's pay (the usage so far).",
  demoOff: 'Chiikawa mode is off. Turn it on with /chiikawa on, then run the demo.',
  demoStarted: 'The demo has started. These are not real tasks: four made-up ones run for about 15 seconds to show the screen.',
  talkOnly: 'The pane now shows the talk alone. Run this again, or press `Show all` in the pane, to go back.',
  talkAll: 'The pane shows everything again.',
  autoSet: 'Prompts go by auto again. Hachiware, Chiikawa and Usagi do the light work together, and other friends are called in only for the heavy work.',
  autoHow: "To: auto. Hachiware, Chiikawa and Usagi do the light work together, and other friends are called in only for the heavy work. To hand a prompt to one friend, press the friend's name and then the button on the sheet.",
  autoBack: who => `${who} is no longer picked. Prompts go by auto again.`,
  unpicked: who => `${who} is no longer picked.`,
  pickedToast: (mark, name) => `${mark} The next prompt goes to ${name}. Pick again to cancel.`,
  pickedSay: (mark, name) => `${mark} The next prompt you type goes to ${name}. Pick the same name again to cancel.`,
  opened: "Opened the friends' status pane.",
  recent: 'Recent talk',

  unkept: EN_UNKEPT,
  rolesTitle: "The friends' roles",
  roleRow: (who, role, job, own) => `${who} · ${role} (${job})${own === undefined ? '' : ` ← originally ${own}`}`,
  roleHelp: (roles, specialties) => [
    `Change: /chiikawa role <friend> <${roles.join('|')}>`,
    'Put one back: /chiikawa role <friend> default · Put everyone back: /chiikawa role reset',
    "Pressing a friend's name in the pane and then a role changes it too.",
    `A friend given a role takes that work first. ${enSpecialtyFirst(specialties)}`,
  ],
  roleToast: (who, role, isOwn, isKept) => `${who} now has the ${role} role.${isOwn ? ' That is the original role.' : ''}${isKept ? '' : ` ${EN_UNKEPT}`}`,
  rolesReset: isKept => `Everyone is back to their original role.${isKept ? '' : ` ${EN_UNKEPT}`}`,
  rolesSame: 'No role had been changed. Everyone has their original role.',
  leadRole: 'Hachiware leads, so that role cannot be changed.',
  roleUnknown: 'Could not tell who should be given which role.',
  roleSame: (who, role) => `${who} already has the ${role} role.`,
  roleBack: (who, role, isKept) => `${who} is back to the original role, ${role}.${isKept ? '' : ` ${EN_UNKEPT}`}`,
  roleGiven: (who, name, role, own, specialties, isKept) =>
    `${who} now has the ${role} role (originally ${own}). From now on ${name} takes ${role} work first. ${enSpecialtyFirst(specialties)} ${isKept ? 'This holds in later sessions too.' : EN_UNKEPT}`,

  langNow: (name, from) =>
    `The language is ${name}. ${
      {
        setting: "The mode's own `language` setting fixes it.",
        chosen: 'You chose it with /chiikawa lang.',
        typed: 'It follows the letters of the prompts you type.',
        config: "It follows Claude Code's language setting.",
        env: 'It follows the environment (LC_ALL, LC_MESSAGES, LANG).',
        default: 'Nothing else settled it, so it is the default.',
      }[from]
    }`,
  langHow: 'Change: /chiikawa lang <en|ko|ja> · Back to automatic: /chiikawa lang auto',
  langChosen: (name, isKept) => `The language is now ${name}.${isKept ? ' This holds in later sessions too.' : ` ${EN_UNKEPT}`}`,
  langAuto: 'The language is settled automatically again. Both the language you chose and the one noted from the letters you typed are forgotten, and the letters are read afresh from the next prompt you type.',
  langTyped: (name, back, isKept) => `Going by the letters you typed, the language is now ${name}.${isKept ? '' : ` ${EN_UNKEPT}`} To go back: /chiikawa lang ${back}`,
  langFixed: name => `The mode's own \`language\` setting is fixed to ${name}, so the screen stays as it is. Your choice applies once that setting is back on auto.`,
  langUnknown: 'That is not a language the mode has. Use one of: /chiikawa lang [auto|en|ko|ja]',
}

const JA_UNKEPT = '保存できなかったので、このセッションだけに適用されます。'
const jaSpecialtyFirst = (specialties: string): string =>
  `ただし、画面・デバッグ・セキュリティのように専門が決まっている仕事（${specialties}）は、役割に関係なくその担当が先に受けます（その担当の役割を変えた場合は除きます）。`

const JA: Words = {
  brand: 'ちいかわ',
  on: 'オン',
  off: 'オフ',

  spoken: ms => {
    const { minutes, seconds } = whole(ms)

    return minutes === 0 ? `${seconds}秒` : `${minutes}分${seconds}秒`
  },
  // 4600, 17.1万, 1.2億.
  amount: tokens => {
    if (tokens >= 100_000_000) return `${short(tokens / 100_000_000)}億`
    if (tokens >= 10_000) return `${short(tokens / 10_000)}万`

    return String(Math.round(tokens))
  },
  tokens: (fresh, cached, out) => `入力 ${fresh} · キャッシュ ${cached} · 出力 ${out}`,
  until: minutes => {
    const hours = Math.floor(minutes / 60)

    if (hours >= 48) return `${Math.floor(hours / 24)}日後にリセット`

    return hours === 0 ? `${minutes}分後にリセット` : `${hours}時間${minutes % 60}分後にリセット`
  },
  took: seconds => `${seconds}秒`,
  exitCode: code => `終了コード ${code}`,

  status: { running: '作業中', waiting: '待ち', done: '完了', failed: '失敗' },
  idle: '待機中',
  leading: '指揮中',
  receiving: '受付中',
  alone: 'じぶんで作業中',
  together: 'いっしょに作業中',
  helping: 'おてつだい中',
  aidingLead: 'ハチワレのおてつだい中',
  awaiting: '仕事待ち',
  atWork: names => `作業中のともだち: ${names.join('、')}`,
  handed: count => `ともだち${count}人におまかせ`,
  withFriend: name => `${name}といっしょ`,
  more: count => `ほか${count}件`,
  tools: count => `ツール${count}回`,
  today: (done, failed) => `${done}件完了${failed === 0 ? '' : ` · ${failed}件失敗`}`,
  tally: (done, failed) => `きょうの仕事: ${JA.today(done, failed)}`,

  usage: '使用量',
  usageTitle: 'ちいかわ 使用量',
  seeUsage: '使用量を見る',
  noUsage: 'まだ読み取った使用量がありません。',
  fold: 'たたむ',
  battery: 'バッテリー',
  limits: { five_hour: '5時間', seven_day: '7日', spend_limit: '支出' },
  left: (percent, used, window) => `残り${percent}% · コンテキスト ${used} / ${window}`,
  used: percent => `${percent}% 使用`,
  session: usd => `Claude セッション $${usd}`,
  sessionCost: usd => `Claude セッションの費用 $${usd}`,
  pay: 'ともだち別の報酬（トークン、このセッションの累計）',

  sent: to => `送り先: ${to}`,
  auto: 'おまかせ',
  working: count => `作業中 ${count}`,
  resting: count => `休憩中 ${count}`,

  busy: count => `${count}人が作業中`,
  trio: '3人でいっしょに作業中',
  waiting: count => `${count}人が待ち`,
  rest: '休憩中',
  atWorkLabel: '作業中',
  workers: '作業中のともだち',
  bench: '休憩中のともだち',
  help: '名前を押すと、そのともだちの仕事が見られます',
  talk: 'はなし',
  earlier: range => `これまでのはなし ${range}`,
  older: '▲ まえ',
  newer: '▼ つぎ',
  all: 'ぜんぶ表示',
  allShort: 'ぜんぶ',
  only: 'はなしだけ',

  labels: { now: 'いま', today: 'きょう', pay: '報酬', ended: '完了', report: '報告', role: '役割', result: '結果', said: 'せりふ' },
  bell: '仕事は受けません。仕事が入るとベルを鳴らします。',
  conducting: count => `指揮中 · ともだちの仕事 ${count}件`,
  close: '閉じる',
  ownRole: role => `もとは${role}`,
  askLead: '▷ 次の指示はハチワレがじぶんでやる',
  askFriend: '▷ 次の指示をこのともだちにまかせる',
  picked: '▶ 次の指示をまかされています · 押すと取り消し',

  spinner: {
    requesting: 'ハチワレ 仕事を確認中',
    thinking: 'ハチワレ 考え中',
    responding: 'ハチワレ おはなし中',
    'tool-input': 'ハチワレ 仕事を書き出し中',
    'tool-use': 'ハチワレ 指揮中',
  },
  doing: (name, job) => `${name} ${job}中`,
  started: (job, title) => `${job}開始 · ${title}`,
  bellNote: '仕事の受付',
  reading: name => `${name}の言葉の読みとき`,
  mourning: name => `${name}の失敗を見て`,
  paired: 'ふたりがいっしょに働くのを見て',
  seeking: 'さがし中',
  mending: '修正中',
  lending: (name, verb) => `${name}と${verb}`,
  ended: (job, isOk) => `${job}${isOk ? '完了' : '失敗'}`,
  waveFailed: (total, failed) => `${total}件のうち${failed}件失敗`,
  waveDone: total => `${total}件の作業が完了`,
  letGo: (name, title) => `${name}の${title} · 結果がないので手放した`,
  lost: (name, title) => `${name}の${title} · 終わりがわからないので手放した`,
  keeping: (job, time) => `${job}続行中 · ${time}経過`,
  waitingFor: (name, time) => `${name}を${time}待っている`,
  denied: tool => `${tool}を断られた`,
  watching: (name, tool) => `${name}の${tool}を見守っていて`,
  noResult: '1時間たっても結果ファイルが見当たりません。直接確認してください',
  noPath: '結果ファイルのパスを読み取れなかったので、終わったかどうかは直接確認してください',
  sharedOut: 'ほかの作業が同じ結果ファイルを使っているので、この作業の結果は直接確認してください',
  launchFailed: '実行コマンドがエラーで終了',
  stopped: '中断',
  unseen: '結果は直接確認',
  apiError: 'APIエラー',
  refused: '拒否',

  demo: 'デモ',
  demoTitles: ['デモ: 設定ファイルの場所をさがす', 'デモ: ログインバグの討伐', 'デモ: 誤字を直す', 'デモ: 変更したコードを見直す'],
  demoReport: title => `デモなので、実際には何もしていません (${title})`,

  description: 'ちいかわモード: ともだちの状況パネルを開く、モードをオン・オフする',
  argumentHint: '[on|off|usage|talk|role [ともだち 役割]|lang [auto|en|ko|ja]|clear [all]|demo|auto|ともだちの名前]',
  turnedOn: 'ちいかわモードをオンにしました。',
  turnedOff: 'ちいかわモードをオフにしました。/chiikawa on でまたオンにできます。',
  cleared: '終わった作業と会話の記録を消しました。ともだち別の報酬（累計使用量）はそのままです。進行中として残っているものと報酬まで消すには /chiikawa clear all',
  clearedAll: '進行中として残っていたものも含めて、すべての作業と会話の記録、ともだち別の報酬（累計使用量）を消しました。',
  demoOff: 'ちいかわモードがオフになっています。/chiikawa on でオンにしてからデモを実行できます。',
  demoStarted: 'デモを始めました。実際の作業ではなく、画面を見せるための見せかけの作業4件が15秒ほど動きます。',
  talkOnly: 'パネルにはなしだけを表示します。もう一度入力するか、パネルの `ぜんぶ表示` を押すと戻ります。',
  talkAll: 'パネルをぜんぶ表示に戻しました。',
  autoSet: '送り先をおまかせにしました。軽い仕事はハチワレ・ちいかわ・うさぎがいっしょにやり、大変な仕事だけほかのともだちを呼びます。',
  autoHow: '送り先おまかせ: 軽い仕事はハチワレ・ちいかわ・うさぎがいっしょにやり、大変な仕事だけほかのともだちを呼びます。決めてまかせるには、ともだちの名前を押してから、シートのボタンを押します。',
  autoBack: who => `${who}の指名を外しました。送り先はまたおまかせです。`,
  unpicked: who => `${who}の指名を取り消しました。`,
  pickedToast: (mark, name) => `${mark} 次の指示は${name}にまかせます。もう一度選ぶと取り消されます。`,
  pickedSay: (mark, name) => `${mark} 次に入力する指示は${name}にまかせます。同じ名前をもう一度選ぶと取り消されます。`,
  opened: 'ともだちの状況パネルを開きました。',
  recent: '最近の会話',

  unkept: JA_UNKEPT,
  rolesTitle: 'ともだちの役割',
  roleRow: (who, role, job, own) => `${who} · ${role} (${job})${own === undefined ? '' : ` ← もとは${own}`}`,
  roleHelp: (roles, specialties) => [
    `変える: /chiikawa role <ともだちの名前> <${roles.join('|')}>`,
    'ひとり戻す: /chiikawa role <ともだちの名前> リセット · 全員戻す: /chiikawa role reset',
    'パネルでともだちの名前を押してから役割を押しても変えられます。',
    `役割をもらったともだちが、その仕事を先に受けます。${jaSpecialtyFirst(specialties)}`,
  ],
  roleToast: (who, role, isOwn, isKept) => `${who}の役割を${role}に変えました。${isOwn ? 'もとの役割です。' : ''}${isKept ? '' : JA_UNKEPT}`,
  rolesReset: isKept => `ともだちの役割をすべてもとに戻しました。${isKept ? '' : JA_UNKEPT}`,
  rolesSame: '変わっている役割はありません。全員もとの役割です。',
  leadRole: 'ハチワレは指揮を担当しているので、役割は変えられません。',
  roleUnknown: 'だれにどの役割を渡すのかわかりません。',
  roleSame: (who, role) => `${who}はすでに${role}の役割です。`,
  roleBack: (who, role, isKept) => `${who}の役割をもとの${role}に戻しました。${isKept ? '' : JA_UNKEPT}`,
  roleGiven: (who, name, role, own, specialties, isKept) =>
    `${who}の役割を${role}に変えました（もとは${own}）。これからは${role}の仕事を${name}が先に受けます。${jaSpecialtyFirst(specialties)}${isKept ? '次のセッションでもそのままです。' : JA_UNKEPT}`,

  langNow: (name, from) =>
    `いまの言語は${name}です。${
      {
        setting: 'モードの設定（language）で決めてあります。',
        chosen: '/chiikawa lang で選んだ言語です。',
        typed: '入力したプロンプトの文字から判断しました。',
        config: 'Claude Code の言語設定に合わせました。',
        env: '環境変数（LC_ALL, LC_MESSAGES, LANG）に合わせました。',
        default: 'ほかに決め手がないので、既定の英語です。',
      }[from]
    }`,
  langHow: '変える: /chiikawa lang <en|ko|ja> · 自動に戻す: /chiikawa lang auto',
  langChosen: (name, isKept) => `言語を${name}にしました。${isKept ? '次のセッションでもそのままです。' : JA_UNKEPT}`,
  langAuto: '言語を自動で決めるようにしました。選んだ言語と、入力した文字から覚えた言語はどちらも消しました。次に入力する文字からもう一度見ます。',
  langTyped: (name, back, isKept) => `入力した文字から、言語を${name}に切り替えました。${isKept ? '' : JA_UNKEPT}戻すには /chiikawa lang ${back}`,
  langFixed: name => `モードの設定（language）が${name}に固定されているので、画面はそのままです。選んだ値は、設定を auto に戻すと使われます。`,
  langUnknown: 'わからない言語です。/chiikawa lang [auto|en|ko|ja] のどれかを使ってください。',
}

export const WORDS: Record<Lang, Words> = { en: EN, ko: KO, ja: JA }

/** Whether words kept in each language are these words of the screen's own: one language that has them tells. */
export const isSaid = (pick: (words: Words) => string, said: Phrase): boolean => LANGS.some(lang => pick(WORDS[lang]) === said[lang])
