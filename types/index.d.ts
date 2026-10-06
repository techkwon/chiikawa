export type MemberId =
  | 'hachiware'
  | 'chiikawa'
  | 'usagi'
  | 'rakko'
  | 'shisa'
  | 'kurimanju'
  | 'kani'
  | 'pochette'
  | 'momonga'
  | 'rodo'
/** The languages the screen and the characters' voices come in. */
export type Lang = 'en' | 'ko' | 'ja'
/**
 * Words the mode says, in every language, made when they were said: the
 * screen shows the ones of the language it is in just then. Words that are
 * someone else's (a task's title, what a tool is on, a report) are the same
 * in each.
 */
export type Phrase = Record<Lang, string>
/** The languages kept from one session to the next: the one the person chose, and the one their prompts were last typed in. */
export type LangKept = { chosen?: Lang; typed?: Lang }
/** A role as the mode keeps it, whatever the language of the screen: the screen has its own word for each. */
export type Role = '지휘' | '구현' | '검토' | '조사' | '탐색'
/** A kind of work a character can be given; conducting is 하치와레's alone. */
export type WorkRole = Exclude<Role, '지휘'>
/** The roles the person gave: a character not named here has its own. */
export type Roles = Partial<Record<MemberId, WorkRole>>
export type TaskStatus = 'running' | 'waiting' | 'done' | 'failed'
/** The face a character wears for a line. */
export type Mood = 'calm' | 'glad' | 'sad' | 'shock' | 'tired'

/** What a piece of work cost: tokens read fresh, read from cache, written. */
export type Tokens = {
  fresh: number
  cached: number
  out: number
  /** Dollars, where the engine that did the work states them. */
  usd?: number
}

export type Task = {
  /** An agent's id, `spawn:<tool_use_id>` until it is known, or `orca:<id>`. */
  id: string
  kind: 'agent' | 'orca'
  member: MemberId
  role: Role
  /** The subagent type, or the fleet-run profile. */
  engine: string
  /** What whoever handed the task over called it. */
  title: string
  /** The title in each language, where the mode named the task itself: a demonstration's. */
  titles?: Phrase
  status: TaskStatus
  startedAt: number
  endedAt?: number
  tool?: string
  /** What the tool is on: a file's name, a command's start. */
  detail?: string
  /** The first line of what the character handed back, once it has: as it was written, but for a sound or a gesture of the character's own, which is as each language has it. */
  report?: Phrase
  /** The first few lines of it, for the one who asks to see the task, as they were written: the first is the report. */
  summary?: string[]
  toolCount: number
  /** A line or a gesture the wiki records for the character; a gesture is in parentheses. */
  quote: Phrase
  /** What the line is about, in plain words. */
  note: Phrase
  mood: Mood
  isSlow?: boolean
  /** An Orca worker's result file, once known. */
  out?: string
  /** When that file's meta was last written, where one was there before the worker started: a meta of that moment is an earlier run's. */
  staleAt?: number
  /** The tool call that started it: an Agent call's id, or a Bash call's. */
  call?: string
  tokens?: Tokens
  /** A demonstration's task: when it ends by itself, and how. */
  due?: { at: number; isOk: boolean }
  /** Its end was read off the engine's list, not told by its own turn: that word, coming later, overrules it. */
  isGuessed?: boolean
}

/** A hand lent to the main loop's own work: what it is on, when, and when its character last said so. */
export type Aid = {
  what: Phrase
  /** The same in a word or two, for a cut with little room. */
  brief?: Phrase
  at: number
  saidAt: number
}
export type Aids = Partial<Record<MemberId, Aid>>

/** A line of the conversation: who said it, the words and what they are about in each language, when, and with what face. */
export type Said = { member: MemberId; quote: Phrase; note: Phrase; at: number; mood: Mood }

export type Limit = {
  /** `five_hour`, `seven_day`, or a gateway's `spend_limit`. */
  kind: string
  percentUsed: number
  /** When the window resets, in the clock's milliseconds. */
  resetsAt?: number
}

/** The session's own figures, as the status line has them. */
export type Usage = {
  contextPercent?: number
  contextTokens?: number
  contextWindow: number
  limits: Limit[]
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    chiikawa: {
      isOn: boolean
      tasks: Task[]
      now: number
      waveAt: number
      isPaneOpen: boolean
      /** The person closed the pane by hand: it stays closed until they ask for it. */
      isPaneDismissed: boolean
      /** The conversation so far, newest last. */
      feed: Said[]
      usage: Usage | null
      leaderTokens: Tokens
      /** What the main loop was told, beside a prompt, of conducting as 하치와레. Whether it stands and whether it must be told again are two things: out of date, it still stands, and is taken back when the main loop no longer conducts. */
      brief: {
        /** Whether what it was told stands in the conversation: from the prompt that carried it until it is told to stop, or a compaction or a `/clear` takes it away. */
        isAlive: boolean
        /** Whether what stands is out of date, as after the language changed: it is told again while the main loop conducts. */
        isStale: boolean
        /** How many times what it was told has been put in doubt: the mode turned on or off, the language changed, the conversation compacted. */
        doubts: number
      }
      /** The character the person chose in the band for their next prompt. */
      picked: MemberId | null
      /** The character whose task the pane shows in full, where the person asked to see one. */
      watched: MemberId | null
      /** Whether the person's theme is a light one: the drawings take the deeper tones. */
      isLight: boolean
      /** The drawings' frame, counted on while a character is at work. */
      frame: number
      /** The hands the three lend to the main loop's own work. */
      aids: Aids
      /** Whether the pane shows the usage in full: it does until the person puts it away. */
      isUsageOpen: boolean
      /** How many lines back from the last the pane's conversation is turned; 0 shows the last ones. */
      talkBack: number
      /** Whether the pane shows the conversation alone. */
      isTalkOnly: boolean
      /** The roles the person gave the characters, kept over sessions in the store. */
      roles: Roles
      /** How many times the roles have changed this session. */
      roleVersion: number
      /** The change of the roles the main loop was last told of, beside a prompt that went in. */
      toldRoleVersion: number
      /** What each character's tasks have cost this session, summed apart from the tasks so that letting a task go keeps it. */
      paid: Partial<Record<MemberId, Tokens>>
      /** The agents whose records were let go while how they ended was a guess, each with its character: what its own turn says it cost is still that character's. */
      owed: { id: string; member: MemberId }[]
      /** The language of the screen and of the characters' voices, where the mode's own setting leaves it to the person. */
      lang: Lang
      /** What the person chose and what they type in, kept over sessions in the store. */
      langKept: LangKept
      /** Whether what is kept over sessions was read into this session: a `/clear` starts a session with none of it and no `session.start`. */
      isLoaded: boolean
      /** Whether the roles kept in the store were ever read into this session: until they are, the session's roles are not saved over them. */
      isRolesRead: boolean
      /** The same of the languages kept. */
      isLangRead: boolean
      /** Whether the languages as they stand are still to be kept: a save of them failed, and is tried again with the next prompt. */
      isLangUnkept: boolean
    }
  }
}
