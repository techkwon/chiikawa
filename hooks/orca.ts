// Reads `fleet-run <profile> --spec <file> --out <file>` out of a shell
// command: the Orca worker launches the conductor makes through Bash.
//
// The command is read the way a shell reads it, as far as that is plain: a
// statement at a time, word by word, its quotes, comments and here-documents
// told apart. A launch counts only where the shell is sure to run it, and a
// path only where what it comes to is sure: written out, or made of
// variables this very command assigned as plain text, with nothing run since
// that may have assigned them again. What is sure is told narrowly, the same
// for bash, zsh and sh, and anything else is left out, so that nothing is
// tracked or written over on a guess.

import type { Tokens } from '../types'

import type { Words } from './words'

export type FleetRun = {
  profile: string
  /**
   * Where in the command the spec's path stands, without its quotes: from,
   * and up to. Only with `spec`, and only where another path can be written
   * there.
   */
  specSpan?: readonly [number, number]
  /** The paths with the command's own variables filled in, when plain. */
  spec?: string
  out?: string
  title: string
  /** Whether `--out` was given at all: given and not here, its path could not be read. */
  hasOut: boolean
  /** An `&` closes its command: the shell does not wait for it. */
  isBackground: boolean
  /** It is handed to something that answers at once, an Orca terminal or `nohup`: the command does not wait for it either. */
  isDetached: boolean
  /** fleet-run turns it away before any worker starts, an option it needs missing or one it does not know: it leaves no result to wait for. */
  isRefused?: true
  /**
   * It may not run: it stands in a block that may be passed by, after `&&` or `||` or in what they lead to, a pipeline or a
   * parenthesis, past a word that may have left the shell early, or past what is not followed here.
   */
  isMaybe?: true
  /** Whether it is turned away for lacking one of the three paths it needs. */
  isLacking?: true
  /**
   * How it exits is how the whole command exits: it is the last thing the command runs, in no pipeline, behind no `!` and in no block.
   * Of any other, the command's exit tells nothing.
   */
  ownsExit?: true
}

/**
 * A stretch of a word read one way: bare, inside one kind of quotes, or a
 * command run to make it, `$(…)` or `<(…)`. Its place is its text's, without
 * the quotes or the parentheses. A command of `<(…)` or `>(…)` runs aside:
 * the shell does not wait for it.
 */
type Piece = { text: string; quote: '' | '"' | "'" | '('; from: number; to: number; isAside?: true; isUnsure?: true }
/** A word of a command, and its place with its quotes. One that runs into a `<` with no space between is cut: what it comes to is not told. */
type Word = { pieces: Piece[]; from: number; to: number; isCut?: boolean; isInside?: true }
/** One command of a script: its words, and the operators it stands between. One that is odd holds something not read here as the shell reads it. */
type Statement = { words: Word[]; before: string; after: string; isOdd: boolean; isRedirected: boolean; asides: Piece[] }
/** What the variables assigned so far are sure to hold. */
type Vars = Map<string, string>
/** A script a command hands a shell in quotes, as that shell reads it, and where in the command each character of it was written. */
type Script = { text: string; from: number[]; to: number[] }
/** What is sure of the shell at one point of a script. */
type Shell = {
  /** The variables, the home directory among them as `HOME`. */
  vars: Vars
  /** The variables made read-only: assigning one again does not go as written. */
  sealed: Set<string>
  /** Whether what a variable written bare holds stays one word: nothing so far may have changed where the shell parts it. */
  isWhole: boolean
  /** Nothing is sure from here on: something was met that this does not follow. */
  isLost: boolean
  /** A word that leaves the shell early, as `exit`, was met: what stands after it may not run. */
  isLeft: boolean
  /** The shell was told to leave at the first command that fails, as by `set -e`: what stands after any command may not run. */
  isStrict: boolean
  /** How many more statements loops may be read over again for, in the whole command: shared by every shell it starts. */
  budget: { left: number }
  /** Whether the shell is known to be zsh: where it and bash read a command apart, it is read as zsh does. Not known, as is safe for both. */
  isZsh?: boolean
  /**
   * Whether the shell is known to read as POSIX says: `sh`, or one told `set -o posix`. Such a shell leaves at a redirection that
   * cannot be opened on one of its special commands, told to leave at a failure or not.
   */
  isPosix?: boolean
}

/** The commands POSIX sets apart: a shell reading as it says leaves where one of them fails by its redirection. */
const SPECIALS = new Set([':', '.', 'break', 'continue', 'eval', 'exec', 'exit', 'export', 'readonly', 'return', 'set', 'shift', 'times', 'trap', 'unset', 'source'])

/** A path that goes into a command as it is, with nothing for a shell to read into it: letters and digits of any script, and the few signs a path is written with. */
const PLAIN = /^[\p{L}\p{N}\p{M}_@%+=:,./~-]+$/u
/** Such a path with spaces in it, which only quotes hold together. */
const SPACED = /^[\p{L}\p{N}\p{M}_@%+=:,./~ -]+$/u
/** What parts two words for the shell: no other space does, however much it looks like one. */
const BLANK = /^[ \t]$/
const BARE = /[^ \t\n\\'"`;&|()<>]+/y
const OPERATOR = /;;|&&|\|\||\|&|[;&|()`]/y
const REDIRECT = /&>>?|[<>][<>&|]*/y
const HERE = /<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s\\'"`;&|()<>]+))/y
/** What stands right before a redirection as a part of it: the number of what is redirected, or the variable it is kept in. */
const REDIRECTED = /^(?:\d+|\{\w+\})$/
const ASSIGNED = /^([A-Za-z_]\w*)(\+?)=/
const NAME = /^[A-Za-z_]\w*$/
const FUNCTION_NAME = /^[A-Za-z_][\w.:-]*$/
/** A command's name written out: a program's, with its path or not, or a builtin's. */
const COMMAND = /^(?:[:[]|[\p{L}\p{N}_./~][\p{L}\p{N}_.+/-]*)$/u
/**
 * What the shell fills in with more than a variable holds, or what is not
 * read here as the shell reads it: a `${…}` that is not a name alone or a
 * name with a plain default or a plain cut, arithmetic, a subscript, a
 * backquote.
 */
const ODD = /\$\{(?!#?[A-Za-z_]\w*(?:(?::?[-+]|%%?|##?)[\w./*?-]*)?\})|\$\(\(|\$\[|\$\w+\[|`/
/**
 * In a command run to make a word, what hides where it ends: a here-document, a `case`, a quote of another kind. A `case` only where a
 * command may stand, behind any of the words a pipeline or a command may begin with, as `!`, `time -p` or zsh's `noglob`: one in a path or
 * among the arguments is a word like any other. So it may stand as a function's body, after the name's parentheses or the name, or behind
 * zsh's short loops. It is looked for in the text with each backslash before a line's end taken out with that end, as the shell joins
 * them before it reads a word.
 */
const KNOTTY = /<<|(?:^|[;&|(){\n]|\]\]\s|\b(?:do|then|else|elif|if|while|until)\s|\b(?:function|repeat)\s+\S+\s)\s*(?:(?:!|time|coproc|nocorrect|noglob|-\w+)\s+)*case\s|\$['"]/
const JOINED = /\\\n/g
/**
 * A text with each run of blanks and line ends as one: a line end where it holds one, a space where not. What looks for a word behind
 * any run of them reads the same of it, and reads no run again from each place in it.
 */
export const squeezed = (text: string): string => text.replace(/\s+/g, run => (run.includes('\n') ? '\n' : ' '))
/** What `set` is given to stop at an error or to show what is run: nothing a word is read by. */
const SET = /^(?:[-+][euvx]*o?|errexit|nounset|pipefail|verbose|xtrace)$/
/** After a variable written bare with no braces, what is sure to be no part of its name, a modifier or a subscript, in quotes and out of them. */
const AFTER = { '': /^[/.-]?$/, '"': /^[^:[\p{L}\p{N}\p{M}]?$/u } as const

/** The character at a place of a text, whole where it is written as two units; none past the end. */
const charAt = (text: string, at: number): string => {
  const point = text.codePointAt(at)

  return point === undefined ? '' : String.fromCodePoint(point)
}

/** Reserved words a command may stand behind, and how each moves the count of the blocks around it. */
const KEYWORDS = new Map<string, number>([
  ['if', 1],
  ['case', 1],
  ['while', 1],
  ['until', 1],
  ['for', 1],
  ['select', 1],
  ['{', 1],
  ['fi', -1],
  ['esac', -1],
  ['done', -1],
  ['}', -1],
  ['then', 0],
  ['do', 0],
  ['else', 0],
  ['elif', 0],
  ['!', 0],
  ['time', 0],
])
const LOOPS = new Set(['while', 'until', 'for', 'select'])
/** Commands that name a variable and, given only names and values written out, do not fail where any command may stand. */
const UNFAILING = new Set(['export', 'readonly', 'declare', 'typeset'])
/** Whether a word holds no command run to make it: its value is what is written, or what a variable holds. */
const isWritten = (word: Word): boolean => word.pieces.every(piece => piece.quote !== '(' && (piece.quote === "'" || !/`|\$\(/.test(piece.text)))
/** Whether a reserved word that goes on with a block or ends one stands where the block open is one of its kind. */
const isPaired = (key: string, open: string | undefined): boolean =>
  key === 'fi' || key === 'then' || key === 'elif' || key === 'else' ? open === 'if' : key === 'done' || key === 'do' ? LOOPS.has(open ?? '') : key === '}' ? open === '{' : key === 'esac' ? open === 'case' : true
/** The Python interpreters fleet-run may be run by. */
const PYTHONS = /^python(?:3(?:\.\d+)?)?$/

/** Where the file an interpreter runs is named among its arguments: none where it runs code given to it (`-c`), a module (`-m`), or what it reads in. */
const scriptAt = (args: readonly Word[]): number => {
  for (let at = 0; at < args.length; at += 1) {
    const text = literalOf(args[at])

    if (text === undefined || text === '-') return -1
    if (!text.startsWith('-')) return at
    if (text === '--') return at + 1 < args.length ? at + 1 : -1
    // A long option, `--version` and `--help` among them, is not followed: what it does to the file named after it is not sure.
    if (text.startsWith('--')) return -1
    // Short options run together end in the one that takes a value: `-uc` is `-u -c`, and `-Xdev` is `-X dev`, the rest of the word
    // its value, or the next word where nothing is left. Help and the version end it before any file.
    const flags = text.slice(1)
    const valued = flags.search(/[WX]/)
    const own = valued < 0 ? flags : flags.slice(0, valued)

    // Only the options Python knows run the file: any other, as `-z`, stops it, and so do code, a module, help and the version.
    if (!/^[bBdEiIOPqsSuvx]*$/.test(own)) return -1
    if (valued >= 0 && valued === flags.length - 1) at += 1
  }

  return -1
}
/** Commands that run the command named after them. */
const WRAPPERS = new Set(['nohup', 'exec', 'command', 'env'])
/** Commands whose arguments assign, where the shell has them: only where they stand alone, with no option, is no more than that done. */
const DECLARES = new Set(['declare', 'typeset', 'local'])
/** Every builtin whose arguments assign. Behind a word that runs the command named after it, none is sure to be the shell's own. */
const ASSIGNERS = new Set(['export', 'readonly', ...DECLARES])
/** Builtins that assign variables and do no more: nothing known before one is sure after it. */
const WRITERS = new Set(['read', 'unset', 'getopts', 'mapfile', 'readarray', 'let', 'shift', 'print', 'getln', 'set'])
/** Builtins given a count, which zsh reads as arithmetic. */
const COUNTED = new Set(['break', 'continue', 'exit', 'return'])
/** What `printf` is told to print with no option and no number in it: text, `%s`, `%b` and `%q`. */
const FORMAT = /^(?!-)(?:[^%]|%%|%[-0-9.]*[sbq])*$/
/** What `test` is given that some shell reads a word after it as arithmetic for. */
const TESTED = /^-(?:[tvR]|eq|ne|lt|le|gt|ge)$/
/**
 * Every other word bash, zsh and sh keep for themselves that may change the
 * shell: its variables' kinds, its options, what a name runs. Past one,
 * nothing is sure. A builtin in none of these lists changes no variable, and
 * neither does a program.
 */
const SHELL_WORDS = new Set(
  (
    '. alias autoload bg bind bindkey builtin bye caller compadd comparguments compcall compctl compdescribe compfiles compgen compgroups complete compopt compquote compset comptags comptry compvalues ' +
    'coproc disable echotc echoti emulate enable end eval fc fg float foreach function functions help history integer limit log logout nocorrect noglob private pushln r rehash repeat sched setopt shopt ' +
    'source suspend trap ttyctl unalias unfunction unhash unlimit unsetopt vared zcompile zformat zle zmodload zparseopts zregexparse zstyle'
  ).split(' '),
)
/** Variables the shells keep for themselves, by how their names begin and by name: what one holds is the shell's to change, and is never taken as known. */
const SPECIAL = new RegExp(
  `^(?:(?:BASH|ZSH_|zsh_|COMP_|READLINE_|ZLE_|dis_|EPOCH|LC_)\\w*|${(
    '_ ARGC BAUD CDPATH CHILD_MAX COLUMNS COPROC CPUTYPE DIRSTACK DIRSTACKSIZE EGID EMACS ENV ERRNO EUID EXECIGNORE FCEDIT FIGNORE FPATH FUNCNAME FUNCNEST GID GLOBIGNORE GROUPS HISTCHARS HISTCMD HISTCONTROL ' +
    'HISTFILE HISTFILESIZE HISTIGNORE HISTSIZE HISTTIMEFORMAT HOST HOSTFILE HOSTNAME HOSTTYPE IFS IGNOREEOF INPUTRC INSIDE_EMACS KEYBOARD_HACK KEYTIMEOUT LANG LINENO LINES LISTMAX LOGCHECK LOGNAME MACHTYPE MAIL ' +
    'MAILCHECK MAILPATH MANPATH MAPFILE MATCH MBEGIN MEND MODULE_PATH NULLCMD OLDPWD OPTARG OPTERR OPTIND OSTYPE PATH PERIOD PIPESTATUS POSIXLY_CORRECT POSTEDIT PPID PROMPT PROMPT2 PROMPT3 PROMPT4 PROMPT_COMMAND ' +
    'PROMPT_DIRTRIM PS0 PS1 PS2 PS3 PS4 PSVAR PWD RANDOM READNULLCMD REPLY REPORTMEMORY REPORTTIME RPROMPT RPROMPT2 RPS1 RPS2 SAVEHIST SECONDS SHELL SHELLOPTS SHLVL SPROMPT SRANDOM STTY TERM TERMINFO TIMEFMT ' +
    'TIMEFORMAT TMOUT TMPPREFIX TMPSUFFIX TRY_BLOCK_ERROR TRY_BLOCK_INTERRUPT TTY TTYIDLE UID USERNAME VENDOR WATCH WATCHFMT WORDCHARS ZBEEP ZDOTDIR aliases argv auto_resume builtins cdpath commands dirstack ' +
    'epochtime errnos fignore fpath funcfiletrace funcsourcetrace funcstack functions functions_source functrace galiases histchars history historywords jobdirs jobstates jobtexts keymaps langinfo mailpath manpath ' +
    'mapfile match mbegin mend module_path modules nameddirs options parameters patchars path pipestatus prompt psvar reply reswords saliases signals status sysparams termcap terminfo userdirs usergroups watch widgets'
  ).replace(/ /g, '|')})$`,
)
/** Those of them a shell is ruled by: one assigned, the shell may read what follows another way, or run what it holds as it shows each command. */
const RULING = new Set(['POSIXLY_CORRECT', 'BASH_COMPAT', 'BASH_ENV', 'BASHOPTS', 'SHELLOPTS', 'ENV', 'ZDOTDIR', 'HISTCHARS', 'histchars', 'NULLCMD', 'READNULLCMD', 'PS4', 'PROMPT4'])
const SHELLS = new Set(['bash', 'zsh', 'sh'])
/** After one of these a statement runs only if the one before it went a certain way, or in a shell of its own. */
const CONDITIONAL = new Set(['&&', '||', '|', '|&'])
/** Before one of these a statement runs in a shell of its own. */
const UNWAITED = new Set(['&', '|', '|&'])

const found = (pattern: RegExp, text: string, at: number): RegExpExecArray | null => {
  pattern.lastIndex = at

  return pattern.exec(text)
}

/**
 * How much reading one command is still given, in characters parted into commands: a script in a script is parted again at each depth,
 * and one written to be read many times over would be read without end. Held while a command's launches are looked for, by all that
 * read it; with none left the reading is given up.
 */
let work: { left: number } | undefined
/** What a reading is given whatever the command's length, and for each of its characters. */
const WORK = 2_000_000
const WORK_EACH = 16
/** Thrown where no reading is left: the command is then not read at all. */
const SPENT = new Error('spent')

/** Where the parenthesis opened before `at` closes, the quotes and the comments inside it passed over; -1 where it does not. */
const parenEnd = (text: string, at: number): number => {
  let depth = 1

  for (let end = at; end < text.length; end += 1) {
    const char = text[end]

    if (char === '\\') end += 1
    else if (char === "'") end = text.indexOf("'", end + 1)
    else if (char === '"') end = quoteEnd(text, end + 1)
    else if (char === '#' && /^[\s;&|()]$/.test(text[end - 1] ?? '')) end = text.indexOf('\n', end)
    else if (char === '(') depth += 1
    else if (char === ')' && (depth -= 1) === 0) return end
    if (end < 0) return -1
  }

  return -1
}

/** Where the double quote opened before `at` closes, the commands it holds passed over; -1 where it does not. */
const quoteEnd = (text: string, at: number): number => {
  for (let end = at; end < text.length; end += 1) {
    const char = text[end]

    if (char === '"') return end
    if (char === '\\') end += 1
    else if (char === '`') end = text.indexOf('`', end + 1)
    else if (char === '$' && text[end + 1] === '(') end = parenEnd(text, end + 2)
    if (end < 0) return -1
  }

  return -1
}

/** Whether a stretch of a word holds something not read here as the shell reads it. */
const isOddPiece = ({ text, quote }: Piece): boolean => quote !== "'" && (ODD.test(text) || ((quote === '(' || text.includes('$(')) && KNOTTY.test(squeezed(text.replace(JOINED, '')))))

/**
 * A script as its commands, in the order written. A comment and the lines
 * of a here-document are no part of any, and neither is a redirection: its
 * sign, the number before it and the word it leads to are none of the
 * command's words, wherever among them they stand. A command run to make a
 * word, `$(…)` or `<(…)`, is a piece of that word. Undefined where a quote
 * or such a command is left open: nothing after it can be told.
 */
const statementsOf = (text: string): Statement[] | undefined => {
  if (work !== undefined && (work.left -= text.length + 1) < 0) throw SPENT
  const statements: Statement[] = []
  /** The here-documents opened on this line: the line that closes each, whether tabs before it are dropped, whether the shell fills its lines in, and the statement it is of. */
  const waiting: { mark: string; isIndented: boolean; isFilled: boolean; owner: number }[] = []
  let words: Word[] = []
  let word: Word | undefined
  let before = ''
  let at = 0
  /** Whether the next word is what a redirection leads to. */
  let isTarget = false
  /** Whether the statement being read holds something not read here as the shell reads it. */
  let isOdd = false
  /** Whether the statement being read holds a redirection: one that fails keeps the command from being run. */
  let isRedirected = false
  /** The commands run by what the statement's redirections lead to. */
  let asides: Piece[] = []
  const add = (piece: Piece, from: number, to: number): void => {
    word ??= { pieces: [], from, to }
    word.pieces.push(piece)
    word.to = to
    isOdd ||= isOddPiece(piece)
  }
  /** Ends the word being read, and with an operator the statement. */
  const close = (after?: string): void => {
    if (word !== undefined && !isTarget) words.push(word)
    // What a redirection leads to is no word of the command, but a command it runs is run all the same: `done < <(…)`.
    else if (word !== undefined) asides.push(...word.pieces.filter(piece => piece.quote === '('))
    if (word !== undefined || after !== undefined) isTarget = false
    word = undefined
    if (after === undefined) return
    statements.push({ words, before, after, isOdd, isRedirected, asides })
    words = []
    asides = []
    before = after
    isOdd = false
    isRedirected = false
  }
  /** Takes the command run to make a part of the word being read, whose parenthesis opens at `open`. Answers whether it closes. */
  const run = (open: number, from: number, isAside = open > from, isUnsure = false): boolean => {
    const end = parenEnd(text, open + 1)

    if (end >= 0) add({ text: text.slice(open + 1, end), quote: '(', from: open + 1, to: end, ...(isAside ? { isAside: true as const } : {}), ...(isUnsure ? { isUnsure: true as const } : {}) }, from, end + 1)
    at = end + 1

    return end >= 0
  }

  while (at < text.length) {
    const char = text[at] ?? ''
    const last = word?.pieces.at(-1)
    /** Whether a `$` written bare stands right before this character. */
    const isDollared = last?.quote === '' && last.text.endsWith('$')

    if (char === '\\') {
      // A backslash keeps the next character as it is written; at a line's end it joins the next line on.
      if (text[at + 1] !== '\n') add({ text: text[at + 1] ?? '', quote: "'", from: at, to: at + 2 }, at, at + 2)
      at += 2
    } else if (char === "'" || char === '"') {
      const end = char === "'" ? text.indexOf("'", at + 1) : quoteEnd(text, at + 1)

      if (end < 0) return undefined
      // `$'…'` and `$"…"` are quotes of another kind, and a quote that runs over a line's end moves where a here-document begins.
      if (isDollared || (waiting.length > 0 && text.slice(at, end).includes('\n'))) isOdd = true
      add({ text: text.slice(at + 1, end), quote: char, from: at + 1, to: end }, at, end + 1)
      at = end + 1
    } else if (char === '\n') {
      // A line that ends in `&&`, `||` or `|` goes on in the next: the line's end parts nothing there.
      // A redirection alone is a command all the same, with no word of its own: `false && > /dev/null ` ends at its line's end.
      if (word !== undefined || words.length > 0 || isTarget || isRedirected || !CONDITIONAL.has(before)) close('\n')
      at += 1
      for (const { mark, isIndented, isFilled, owner } of waiting.splice(0)) {
        const from = at
        const opened = statements[owner]

        while (at < text.length) {
          const end = text.indexOf('\n', at)
          const line = text.slice(at, end < 0 ? text.length : end)

          at = end < 0 ? text.length : end + 1
          if ((isIndented ? line.replace(/^\t+/, '') : line) === mark) break
        }
        if (isFilled && opened !== undefined && ODD.test(text.slice(from, at))) opened.isOdd = true
      }
    } else if (BLANK.test(char)) {
      close()
      at += 1
    } else if (char === '#' && word === undefined) {
      const end = text.indexOf('\n', at)

      // Right after a parenthesis, zsh reads it as a part of a pattern.
      if (text[at - 1] === '(') isOdd = true
      at = end < 0 ? text.length : end
    } else if ((char === '(' && isDollared) || ((char === '<' || char === '>') && text[at + 1] === '(')) {
      // `$((…))` is arithmetic, which may assign.
      if (text[at + 1] === '(' && char === '(') isOdd = true
      if (!run(char === '(' ? at : at + 1, at)) return undefined
    } else {
      const here = found(HERE, text, at)
      const sign = here ?? found(REDIRECT, text, at)
      const operator = sign ?? found(OPERATOR, text, at)
      const bare = operator ?? found(BARE, text, at)

      if (here !== null) {
        waiting.push({ mark: here[2] ?? here[3] ?? here[4] ?? '', isIndented: here[1] === '-', isFilled: here[4] !== undefined && !here[0].includes('\\'), owner: statements.length })
        // A closing line written partly in quotes is not the one read here.
        if (/^[^\s;&|()<>]$/.test(text[at + here[0].length] ?? '')) return undefined
      }
      // A redirection parts two words, and an operator ends the statement.
      if (sign !== null) {
        isRedirected = true
        // A number of two figures or more before it is what it opens to bash and sh, and a word of its own to zsh: it is no word that is sure.
        if (word !== undefined && /^\d{2,}$/.test(bareOf(word) ?? '')) word.isCut = true
        else if (word !== undefined && REDIRECTED.test(bareOf(word) ?? '')) {
          // `{name}>` assigns the variable the number of what it opens.
          if (bareOf(word)?.startsWith('{') === true) isOdd = true
          word = undefined
        }
        // `<1-9>` right after a word is a part of a pattern to zsh.
        else if (word !== undefined && sign[0].startsWith('<')) word.isCut = true
        close()
        // A here-document's sign has its closing line with it; any other leads to the word after it.
        isTarget = here === null
        // `>!` is one sign to zsh, and a file named `!` to the others.
        if (text[at + sign[0].length] === '!') isOdd = true
      } else if (operator?.[0] === '(' && isTarget && word === undefined) {
        // A parenthesis where a redirection's word is looked for opens no shell of its own. Right after `<<`, zsh runs it as `<(…)`
        // and bash runs nothing; after a space, or any other sign, no two shells agree on whether it runs at all.
        if (!run(at, at, true, text.slice(at - 2, at) !== '<<' || text[at - 3] === '<')) return undefined
        continue
      } else if (operator !== null) {
        // A backquote, arithmetic, and a parenthesis that goes on a word, as an array's or a pattern's does, are not followed; a function's own `()` is.
        if (operator[0] === '`' || (operator[0] === '(' && (text[at + 1] === '(' || (word !== undefined && !/^[ \t]*\)/.test(text.slice(at + 1)))))) isOdd = true
        close(operator[0])
      } else if (bare !== null) add({ text: bare[0], quote: '', from: at, to: at + bare[0].length }, at, at + bare[0].length)
      at += bare?.[0].length ?? 1
    }
  }
  close('')

  return statements
}

/** A word written bare with nothing for the shell to fill in: an option, a keyword, a profile. */
const bareOf = (word: Word | undefined): string | undefined => {
  const [piece, ...more] = word?.pieces ?? []

  return piece !== undefined && more.length === 0 && piece.quote === '' && !piece.text.includes('$') ? piece.text : undefined
}

/** A word the shell hands on as it is written, in quotes or not, with nothing to fill in: a profile, an option. */
const literalOf = (word: Word | undefined): string | undefined => {
  const pieces = word?.pieces ?? []
  const isFilled = pieces.some(piece => piece.quote === '(' || (piece.quote !== "'" && /[$`\\]/.test(piece.text)))

  return pieces.length === 0 || isFilled || word?.isCut === true ? undefined : pieces.map(piece => piece.text).join('')
}

/** The command a word names: the last part of its path, where that part is written out. */
const nameOf = (word: Word | undefined): string | undefined => {
  const pieces = word?.pieces ?? []
  const text = pieces.map(piece => piece.text).join('')
  const name = text.slice(text.lastIndexOf('/') + 1)

  // A word with `=` before its path, as `a[1]=/x/fleet-run`, assigns, or names no program at all.
  return word === undefined || pieces.some(piece => piece.quote === '(') || /[$`\\]/.test(name) || /^[^/]*=/.test(text) ? undefined : name
}

/** What a word assigns, where it is an assignment: `NAME=` at its start, written bare. */
const assigned = (word: Word | undefined): RegExpExecArray | null => {
  const first = word?.pieces[0]

  return first?.quote === '' ? ASSIGNED.exec(first.text) : null
}

/** A word from so many characters into its first piece: what follows `NAME=` or `--option=`. */
const rest = (word: Word, skip: number): Word => {
  const [first, ...more] = word.pieces

  if (first === undefined) return word
  const from = first.from + skip
  const head = { ...first, text: first.text.slice(skip), from }

  return { ...word, pieces: head.text === '' ? more : [head, ...more], from }
}

/**
 * What a word comes to once the shell has filled it in, where that is sure
 * and plain: single quotes keep what they hold, a variable is one assigned
 * earlier, and `~/` opening a bare word is the home directory. A space is
 * plain only in a word that is one stretch in quotes: there the shell does
 * not part what a variable holds, and a path written in its place stays
 * inside the quotes.
 *
 * A variable is followed only as `$NAME` or `${NAME}`, and `$NAME` only
 * before what no shell takes for more of the name, a modifier or a
 * subscript. Bare, where the shell may part what it holds, it is followed
 * only while nothing may have changed how: `isParted` is off for an
 * assignment's own value, which no shell parts. A `~` anywhere else and an
 * `=` that opens a word are filled in by some shell, and are not followed.
 */
const resolve = (word: Word, shell: Shell, isTildeRead = true, isParted = true): string | undefined => {
  const home = shell.vars.get('HOME')
  let isSure = !shell.isLost && word.isCut !== true
  const text = word.pieces
    .map((piece, index) => {
      const { text: written, quote } = piece

      if (quote === "'") return written
      if (quote === '(') {
        isSure = false

        return ''
      }
      const filled = written.replace(/\$\{(\w+)\}|\$(\w+)|\$/g, (whole, braced: string | undefined, bare: string | undefined, at: number) => {
        const value = shell.vars.get(braced ?? bare ?? '')
        const isJoined = bare !== undefined && !AFTER[quote].test(charAt(written, at + whole.length))

        if (value === undefined || isJoined || (quote === '' && isParted && !shell.isWhole)) isSure = false

        return value ?? ''
      })

      if (quote === '"' || !/^=|~/.test(written)) return filled
      if (index > 0 || !isTildeRead || home === undefined || !/^~\/[^~]*$/.test(written)) isSure = false

      return `${home ?? ''}${filled.slice(1)}`
    })
    .join('')

  const [only, ...more] = word.pieces
  const isHeld = only !== undefined && more.length === 0 && only.quote !== ''

  return isSure && (isHeld ? SPACED : PLAIN).test(text) && !/^[~=]/.test(text) ? text : undefined
}

/** Leaves nothing known of the variables: any of them may have been assigned. */
const forget = (shell: Shell): void => shell.vars.clear()

/** Leaves nothing sure from here on. */
const lose = (shell: Shell): void => {
  shell.isLost = true
  shell.vars.clear()
}

/** Leaves the variables some words assign unknown. One the shell is ruled by, or one that is read-only, leaves nothing sure. */
const strike = (words: readonly Word[], shell: Shell): void => {
  for (const word of words) {
    const name = assigned(word)?.[1] ?? bareOf(word) ?? ''

    shell.vars.delete(name)
    if (shell.sealed.has(name) || RULING.has(name)) lose(shell)
  }
}

/**
 * Takes the assignments the shell is sure to make: one of plain text is
 * kept, and one that is not (appended to, not plain, or of a variable the
 * shells keep for themselves) leaves its variable unknown. `known` is what
 * their own variables are read from.
 */
const assign = (words: readonly Word[], shell: Shell, known: Vars, isParted: boolean): void => {
  for (const word of words) {
    const [whole, name, plus] = assigned(word) ?? []

    if (whole === undefined || name === undefined) continue
    const value = plus === '' && !SPECIAL.test(name) ? resolve(rest(word, whole.length), { ...shell, vars: known }, true, isParted) : undefined

    strike([word], shell)
    if (value !== undefined && !shell.isLost) shell.vars.set(name, value)
  }
}

/** The value an option is given, as the next word or after `=` in its own; none where it is given twice or not at all. */
const valueOf = (args: readonly Word[], name: string): { word: Word; isApart: boolean } | undefined => {
  const flag = `--${name}`
  const given = args.flatMap((word, index) => {
    const next = args[index + 1]
    const how = givenAs(word, flag)

    if (how === 'apart') return next === undefined ? [] : [{ word: next, isApart: true }]

    return how === 'joined' ? [{ word: rest(word, flag.length + 1), isApart: false }] : []
  })

  return given.length === 1 ? given[0] : undefined
}

/** How a word gives an option its value: as the word after it, or after `=` in the word itself. */
const givenAs = (word: Word, flag: string): 'apart' | 'joined' | undefined => {
  const first = word.pieces[0]

  if (literalOf(word) === flag) return 'apart'

  return first?.quote === '' && first.text.startsWith(`${flag}=`) ? 'joined' : undefined
}

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** A path with its `.` and doubled slashes read away: two ways of writing one file are one. */
export const tidyPath = (path: string): string => {
  const isRoot = path.startsWith('/')
  const parts: string[] = []

  for (const part of path.split('/')) {
    // A `..` after a link leads where the link's target is: it is kept as written.
    if (part !== '' && part !== '.') parts.push(part)
  }

  const joined = parts.join('/')

  return isRoot ? `/${joined}` : joined === '' ? '.' : joined
}

/** Whether the shell may part a word into several: something is filled in where no quotes hold it. */
const isSplit = (word: Word): boolean => isExpanding(word) || word.pieces.some(piece => piece.quote === '(' || (piece.quote === '' && /[$`]/.test(piece.text)) || isUnknown(piece.text))

/** Whether zsh may stop at a word, not running the command at all: a pattern, or a `~name` or `=name` it looks up. */
const isRisky = (word: Word): boolean =>
  word.pieces.some(piece => piece.quote === '' && /[*?[]/.test(piece.text)) || (word.pieces[0]?.quote === '' && /^(?:~[^/\s]|=)/.test(word.pieces[0].text))

/** Whether the shell may make several words of a word, or other ones, out of braces or a match against files. */
const isExpanding = (word: Word): boolean => word.pieces.some(piece => piece.quote === '' && /[*?[{]/.test(piece.text))

/** Whether argparse takes a word as an option rather than as a value: a dash before it, unless it is one alone, a negative number or holds a space. */
const isOptionLike = (text: string): boolean => /^-[A-Za-z-]/.test(text) && !/\s/.test(text)

/** Whether text holds a place a script handed on fills with what is not known here: it may come to nothing, or to several words. */
const isUnknown = (text: string): boolean => text.includes('\0')

/** The text a word opens with as written, up to the first piece the shell fills in. */
const leadOf = (word: Word): string => {
  const filled = word.pieces.findIndex(piece => piece.quote === '(' || (piece.quote !== "'" && /[$`\\]/.test(piece.text)))
  const piece = word.pieces[filled]
  // The piece that is filled in is read up to where its filling begins.
  const part = piece === undefined || piece.quote === '(' ? '' : piece.text.slice(0, piece.text.search(/[$`\\]/))

  return (filled < 0 ? word.pieces : word.pieces.slice(0, filled)).map(one => one.text).join('') + part
}

/** A word less its first characters, across as many of its pieces as they take. */
const after = (word: Word, skip: number): Word => {
  const pieces = [...word.pieces]
  let left = skip

  while (pieces.length > 0 && left >= (pieces[0]?.text.length ?? 0)) {
    left -= pieces[0]?.text.length ?? 0
    pieces.shift()
  }
  const [first, ...more] = pieces

  if (first === undefined) return { ...word, pieces: [], from: word.to }
  const head = { ...first, text: first.text.slice(left), from: first.from + left }
  // A word that starts at its quotes starts at the quote itself; one that starts inside them, with more after, has no place of its own to be written over.
  // A piece in quotes has its place inside them; a character escaped with `\\` has its own at the backslash, which it then starts at.
  const isQuoted = (first.quote === '"' || first.quote === "'") && first.to - first.from === first.text.length
  const from = isQuoted && left === 0 ? first.from - 1 : head.from
  const isInside = left > 0 && first.quote !== '' && more.length > 0

  return { ...word, pieces: head.text === '' ? more : [head, ...more], from, ...(isInside ? { isInside: true as const } : {}) }
}

/** fleet-run's own options, each with whether it takes a value: its argparse also takes any start of a long one that names it alone. */
const FLEET_OPTIONS: Readonly<Record<string, boolean>> = { cwd: true, spec: true, out: true, 'timeout-min': true, browser: false, 'no-browser': false, 'dry-run': false, help: false }

const optionOf = (typed: string): string | undefined => {
  if (typed === '-h') return 'help'
  if (!typed.startsWith('--') || typed.length < 3) return undefined
  const name = typed.slice(2)

  if (Object.hasOwn(FLEET_OPTIONS, name)) return name
  const named = Object.keys(FLEET_OPTIONS).filter(one => one.startsWith(name))

  return named.length === 1 ? named[0] : undefined
}

/** A `fleet-run`'s arguments as its argparse reads them: the profile wherever it stands, each option's values, and whether it is turned away. */
const fleetArgsOf = (args: readonly Word[]): { profile?: Word; values: Map<string, { word: Word; isApart: boolean }[]>; flags: Set<string>; isRefused: boolean; isUnsure: boolean } => {
  const values = new Map<string, { word: Word; isApart: boolean }[]>()
  const flags = new Set<string>()
  const give = (name: string, word: Word, isApart: boolean): void => {
    const held = values.get(name)

    // Added to the list kept, not to a copy of it: an option given very many times is gone through once.
    if (held === undefined) values.set(name, [{ word, isApart }])
    else held.push({ word, isApart })
  }
  let profile: Word | undefined
  let isRefused = false
  // A word the shell fills in may come to nothing, or to options: what it is turned away for is then not sure.
  let isUnsure = false
  let isPast = false

  for (let index = 0; index < args.length; index += 1) {
    const word = args[index]

    if (word === undefined) continue
    // An option's own name stands at the word's start, bare or in quotes, in one piece or several: what it is given after `=` may be filled in.
    const head = leadOf(word)
    const equals = head.startsWith('--') ? head.indexOf('=') : -1
    const known = equals > 0 ? head : literalOf(word)
    // What is filled in after `=` is the option's value: its name is still known.
    // A word the shell may part or match against files, as `--{browser,no-browser}`, is not sure to reach it as written.
    const text = known === undefined || isUnknown(equals > 0 ? known.slice(0, equals) : known) || (equals <= 0 && isExpanding(word)) ? undefined : known

    if (text === undefined) {
      if (profile === undefined) profile = word
      else isUnsure = true
      continue
    }
    // After `--` every word is one the program is handed as it is.
    if (!isPast && text === '--') {
      isPast = true
      continue
    }
    if (isPast || !text.startsWith('-') || text === '-') {
      // One word the profile, and any other one more than it takes.
      if (profile === undefined) profile = word
      else isRefused = true
      continue
    }
    const name = optionOf(equals > 0 ? text.slice(0, equals) : text)

    if (name === undefined) {
      isRefused = true
      continue
    }
    if (FLEET_OPTIONS[name] !== true) {
      if (equals > 0) isRefused = true
      flags.add(name)
    } else if (equals > 0) {
      const value = after(word, equals + 1)

      if (isSplit(value)) isUnsure = true
      give(name, value, false)
    } else {
      const next = args[index + 1]
      const nextText = literalOf(next)

      // A word that looks like an option is not taken as a value: argparse says the option has none.
      if (next === undefined || (nextText !== undefined && isOptionLike(nextText))) {
        isRefused = true
        continue
      } else {
        // A value the shell fills in bare may part into several words, the options it lacks among them.
        if (isSplit(next)) isUnsure = true
        give(name, next, true)
      }
      index += 1
    }
  }

  return { ...(profile === undefined ? {} : { profile }), values, flags, isRefused, isUnsure }
}

/** The launch a `fleet-run`'s arguments make, its paths as far as they are sure; none where no profile is named, or where it only shows or tries. */
const runOf = (args: readonly Word[], shell: Shell, isBackground: boolean, isDetached: boolean): FleetRun | undefined => {
  const read = fleetArgsOf(args)
  const profile = literalOf(read.profile)

  if (profile === undefined || !/^[a-z]+-[a-z]+$/.test(profile)) return undefined
  // Help, or a dry run, starts no worker at all.
  if (read.flags.has('help') || read.flags.has('dry-run')) return undefined
  // An option given twice is taken at its last by argparse, yet which of them the shell keeps is not sure here: none is read.
  const once = (name: string): { word: Word; isApart: boolean } | undefined => {
    const all = read.values.get(name) ?? []

    return all.length === 1 ? all[0] : undefined
  }
  const given = once('spec')
  const kept = once('out')
  // A `~` after `--spec=` is not the home directory: only one that opens a word is.
  const spec = given === undefined ? undefined : resolve(given.word, shell, given.isApart)
  const out = kept === undefined ? undefined : resolve(kept.word, shell, kept.isApart)
  const named = baseName(spec ?? out ?? '').replace(/\.(?:spec|out)\.md$|\.md$/, '')
  const run: FleetRun = { profile, title: named === '' ? profile : named, hasOut: read.values.has('out'), isBackground, isDetached }
  // Without all three of its paths, or with words it does not know, fleet-run stops at once. A profile this mode does not know may be the person's own: it is run.
  // A path given empty is none: fleet-run asks for each to be something. Given twice, the last one counts.
  const isLacking = !['cwd', 'spec', 'out'].every(name => {
    const all = read.values.get(name) ?? []

    // Written empty, in quotes or after `=`: every piece of it holds nothing.
    return all.length > 0 && !(all[all.length - 1]?.word.pieces ?? []).every(piece => piece.text === '')
  })

  // zsh stops a command at a pattern that matches no file, a `~name` with no such user or an `=name` with no such program.
  if (args.some(isRisky)) run.isMaybe = true
  if (!read.isUnsure && (read.isRefused || isLacking)) {
    run.isRefused = true
    // argparse turns away a word it does not take first: the paths are looked at only after it has read them all.
    if (!read.isRefused) run.isLacking = true
  }

  if (given !== undefined && spec !== undefined && given.word.isInside !== true) {
    const [piece, ...more] = given.word.pieces

    run.spec = spec
    // One piece is written over inside its quotes; a word of several, quotes and all.
    run.specSpan = piece !== undefined && more.length === 0 ? [piece.from, piece.to] : [given.word.from, given.word.to]
  }
  if (out !== undefined) run.out = tidyPath(out)

  return run
}

/**
 * The word a command hands a shell to run: `orca terminal create --command
 * <word>`, `sh -c <word>`. A shell given any option before its `-c` may read
 * the word another way: it is not plain.
 */
const handedOf = (name: string | undefined, args: readonly Word[]): { word: Word; isPlain: boolean } | undefined => {
  const command = name === 'orca' && bareOf(args[0]) === 'terminal' && bareOf(args[1]) === 'create' ? valueOf(args, 'command')?.word : undefined

  if (command !== undefined) return { word: command, isPlain: true }
  if (name === undefined || !SHELLS.has(name)) return undefined
  for (const [index, arg] of args.entries()) {
    const flag = bareOf(arg)
    const word = args[index + 1]

    if (flag === '-c' || flag === '-lc') return word === undefined ? undefined : { word, isPlain: index === 0 }
    if (flag === undefined || !flag.startsWith('-')) return undefined
  }

  return undefined
}

/**
 * A handed word as the script the shell it is handed to reads. Only a word
 * that is one quoted stretch is read, and not one that runs a command to
 * make its text. Double quotes are filled in before the script is handed
 * on: an escape gives its character, a variable what it holds, and one not
 * known a character no path has. So does one that holds a space, where the
 * shell it is handed to parts it, and anything else a `$` opens.
 */
const scriptOf = (word: Word, shell: Shell): Script | undefined => {
  const [piece, ...more] = word.pieces
  const script: Script = { text: '', from: [], to: [] }

  if (piece === undefined || more.length > 0 || piece.quote === '' || piece.quote === '(' || (piece.quote === '"' && /`|\$\(/.test(piece.text))) return undefined
  const { text: written } = piece
  let at = piece.from

  for (const { 0: whole, 1: escaped, 2: braced, 3: bare, index } of written.matchAll(piece.quote === '"' ? /\\([\s\S])|\$\{(\w+)\}|\$(\w+)|[\s\S]/g : /[\s\S]/g)) {
    const held = shell.vars.get(braced ?? bare ?? '')
    const isJoined = bare !== undefined && !AFTER['"'].test(charAt(written, index + whole.length))
    const filled = held === undefined || held.includes(' ') || isJoined ? '\0' : held
    const text = escaped !== undefined ? (escaped === '\n' ? '' : '"\\$`'.includes(escaped) ? escaped : whole) : piece.quote === '"' && whole.startsWith('$') ? filled : whole

    script.text += text
    for (let unit = 0; unit < text.length; unit += 1) {
      script.from.push(at)
      script.to.push(at + whole.length)
    }
    at += whole.length
  }

  return script
}

/**
 * A run found in a script handed on, with its spec's place given in the
 * command the script stands in. A place that begins or ends partway through
 * what a variable was filled with is not one to write a path into: the run
 * then has none.
 */
const placed = (run: FleetRun, script: Script, isBackground: boolean, isDetached: boolean): FleetRun => {
  const { specSpan, ...more } = run
  const moved = { ...more, isBackground: run.isBackground || isBackground, isDetached: run.isDetached || isDetached }
  const from = specSpan === undefined ? undefined : script.from[specSpan[0]]
  const to = specSpan === undefined ? undefined : script.to[specSpan[1] - 1]

  if (specSpan === undefined || from === undefined || to === undefined || from === script.from[specSpan[0] - 1] || to === script.to[specSpan[1]]) return moved

  return { ...moved, specSpan: [from, to] }
}

/**
 * How many words of a statement open a function's definition: `name` before
 * its own `()`, or `function name`. The compound command that comes next is
 * the function's body.
 */
const definedAt = (statements: readonly Statement[], index: number): number | undefined => {
  const { words = [], after = '' } = statements[index] ?? {}
  const next = statements[index + 1]
  const first = bareOf(words[0])
  const second = bareOf(words[1])

  if (first === 'function' && second !== undefined && FUNCTION_NAME.test(second)) return 2
  const isNamed = words.length === 1 && after === '(' && next !== undefined && next.words.length === 0 && next.after === ')'

  return isNamed && first !== undefined && FUNCTION_NAME.test(first) && !KEYWORDS.has(first) ? 1 : undefined
}

/**
 * Whether the list a statement is of may run in a shell of its own:
 * `a && b &` runs both in one. Where a list ends is not followed past a
 * block or a parenthesis.
 */
const isApart = (statements: readonly Statement[], index: number): boolean => {
  let at = index

  while (CONDITIONAL.has(statements[at]?.after ?? '')) {
    at += 1
    if (KEYWORDS.has(bareOf(statements[at]?.words[0]) ?? '')) return true
  }

  return /^[&(]$/.test(statements[at]?.after ?? '')
}

/**
 * Whether a builtin that changes no variable by itself is sure to change
 * none as it is given here. `printf -v` and `wait -p` assign. zsh reads as
 * arithmetic, which may assign, what `printf` prints as a number, what a
 * loop or the shell is left with, and what `test -t` is given; a newer bash
 * reads so the subscript of what `test -v` names, and a Korn shell what
 * `test` compares as numbers.
 */
const isTame = (name: string, args: readonly Word[], shell: Shell): boolean => {
  /** Whether a word is sure to open with no `-`, whatever it is filled in with: it is no option. */
  const isGiven = (arg: Word): boolean => arg.pieces[0]?.quote !== '(' && /^[^-$`\\]/.test(arg.pieces[0]?.text ?? '')
  const [format] = args

  if (name === 'printf') return format?.pieces.every(piece => piece.quote === "'" || (piece.quote !== '(' && !/[$`]/.test(piece.text))) === true && FORMAT.test(format.pieces.map(piece => piece.text).join(''))
  if (name === 'wait') return args.every(isGiven)
  if (COUNTED.has(name)) return args.every(arg => /^\d+$/.test(literalOf(arg) ?? ''))
  if (name === 'test' || name === '[') return args.every(arg => !TESTED.test(literalOf(arg) ?? resolve(arg, shell) ?? '-t'))

  return !WRITERS.has(name) && !DECLARES.has(name)
}

/**
 * Takes what a command may have done to the shell it ran in. A program, and
 * a builtin that only prints, tests or moves about, changes no variable.
 * `export` and `readonly` with nothing but names and assignments assign as
 * a statement of assignments does, where the shell is sure to run them. A
 * builtin that assigns, or that may as it is given here, leaves no variable
 * known. Anything else the shells keep for themselves, and a name not
 * written out, leave nothing sure.
 */
const affect = (word: Word | undefined, args: readonly Word[], shell: Shell, isRun: boolean): void => {
  const name = bareOf(word) ?? ''
  const isNamed = args.every(arg => assigned(arg) !== null || NAME.test(bareOf(arg) ?? ''))
  const isWritten = args.every(arg => literalOf(arg) !== undefined)

  if (!COMMAND.test(name) || SHELL_WORDS.has(name)) return lose(shell)
  // A name with a path in it is a program's.
  if (name.includes('/')) return
  if (name === 'export' || name === 'readonly') {
    // An option makes it more than an assignment, and a variable that may or may not have been made read-only is not one to assign again.
    if (!isNamed || (name === 'readonly' && !isRun)) return lose(shell)
    if (isRun) assign(args, shell, new Map(shell.vars), true)
    else {
      strike(args, shell)
      forget(shell)
    }
    if (name === 'readonly') for (const arg of args) shell.sealed.add(assigned(arg)?.[1] ?? bareOf(arg) ?? '')

    return
  }
  if ((DECLARES.has(name) && !isNamed) || (name === 'set' && !args.every(arg => SET.test(literalOf(arg) ?? '')))) return lose(shell)
  if (isTame(name, args, shell)) return
  strike(args, shell)
  forget(shell)
  // A name that is filled in may be the one the shell parts words by.
  if (!isWritten) shell.isWhole = false
}

/** Words that leave a loop, or a round of it, or the shell, early: `exec` hands the shell over to what it runs. */
const LEAVES = new Set(['break', 'continue', 'exit', 'return', 'exec'])
/** Those of them that leave the shell itself, and its like: `logout` and `bye` are `exit` by other names. */
const EXITS = new Set(['exit', 'return', 'exec', 'logout', 'bye'])
/** How many statements loops are read over again for in one command, all told: past it, a loop is read once, as any other. */
const LOOP_BUDGET = 400
/** How many times a loop is read over at most: one going through more is read once, as any other loop. */
const LOOP_ITEMS = 20

/**
 * A `for` loop that goes through words written out: its variable, the words,
 * and the statement its `done` stands in. None where what it goes through is
 * filled in or matched by the shell, or where it does not close.
 */
const loopOf = (statements: readonly Statement[], index: number, left: number): { name: string; items: string[]; end: number } | undefined => {
  const said = statements[index]?.words ?? []
  // A loop may open a block's body: `do for …`, `then for …`.
  const opens = said.findIndex(word => !['do', 'then', 'else'].includes(bareOf(word) ?? ''))
  const words = opens < 0 ? [] : said.slice(opens)
  const name = bareOf(words[1])

  // A variable the shell keeps for itself, as `RANDOM` or `SECONDS`, does not hold what it is given.
  if (bareOf(words[0]) !== 'for' || name === undefined || !/^[A-Za-z_]\w*$/.test(name) || RULING.has(name) || SPECIAL.test(name) || bareOf(words[2]) !== 'in') return undefined
  // A word the shell matches against files, or opens with a bare `~` for a home directory or, in zsh, a bare `=` for a program's path, is not the word written.
  const items = words.slice(3).map(word => (word.pieces.some(piece => piece.quote === '' && /[*?[{]/.test(piece.text)) || (word.pieces[0]?.quote === '' && /^[~=]/.test(word.pieces[0].text)) || isUnknown(literalOf(word) ?? '') ? undefined : literalOf(word)))

  if (items.length === 0 || items.length > LOOP_ITEMS || items.some(item => item === undefined)) return undefined
  let depth = 1
  // A loop of more statements than are left to read over again is read once, as any other: its end is not looked for past them, so
  // that loops inside loops are not each gone through to the end.
  const last = Math.min(statements.length - 1, index + Math.floor(left / items.length))

  for (let at = index + 1; at <= last; at += 1) {
    const next = statements[at]?.words ?? []

    for (let key = 0; key < next.length && KEYWORDS.has(bareOf(next[key]) ?? ''); key += 1) {
      depth += KEYWORDS.get(bareOf(next[key]) ?? '') ?? 0
      if (depth !== 0) continue
      // A body that may leave the loop, or a round of it, early does not run once for each word.
      // So does one that may make its variable read-only, which ends the loop at the next round.
      const isCut = statements
        .slice(index + 1, at)
        .some(one => one.words.some(word => LEAVES.has(word.pieces.map(piece => (piece.quote === '' ? piece.text.replace(/\\/g, '') : piece.text)).join('')) || ['readonly', ...DECLARES].includes(bareOf(word) ?? '')))

      return isCut ? undefined : { name, items: items.filter(item => item !== undefined), end: at }
    }
  }

  return undefined
}

/**
 * The launches a list of statements makes, in the order written, with what
 * is sure of the shell kept as each statement is passed. `home` is the home
 * directory the command began with.
 */
const scan = (statements: readonly Statement[], shell: Shell, home: string | undefined): FleetRun[] => {
  const runs: FleetRun[] = []
  let blocks = 0
  /** What opened each block: a `{` group always runs, and any other, a branch or a loop's body, may not. */
  const opened: string[] = []
  /** For each `{` group open, whether it hangs on an `&&` or `||`. */
  const braced: boolean[] = []
  /** For each block open, whether the shell may have been left before it. */
  const openedLeft: boolean[] = []
  /** For each block open, whether the shell was told to leave at a command that fails before it. */
  const openedStrict: boolean[] = []
  /** Whether an element before this one, in the pipeline being read, may fail: told so, a shell takes the pipeline to fail with it. */
  let isPipedOn = false
  /** Whether the pipeline being read stands behind a `!`: the word turns round how all of it ends. */
  let isTurned = false
  /** For each block open, what that was as it opened. */
  const openedPiped: boolean[] = []
  /** For each block open, whether it stands behind a `!`: it exits as the other of what it ran. */
  const openedTurned: boolean[] = []
  /** For each block open, whether what is being read is its condition: what an `if` or a `while` asks, up to its `then` or `do`. */
  const asking: boolean[] = []
  /** How many blocks open are no `{` group, and how many are at their condition: kept as each opens and closes, and asked at every statement. */
  let unsure = 0
  let asked = 0
  const open = (key: string, isAsking: boolean): void => {
    // More blocks open at once than are read: the command is not read at all, as one of too many parentheses is not.
    if (opened.length >= DEPTH) throw SPENT
    opened.push(key)
    asking.push(isAsking)
    if (key !== '{') unsure += 1
    if (isAsking) asked += 1
  }
  const shut = (): string | undefined => {
    const key = opened.pop()

    if (key !== undefined && key !== '{') unsure -= 1
    if (asking.pop() === true) asked -= 1

    return key
  }
  /**
   * For each `{` group and each parenthesis open, how many launches were read when its first statement ended; none until it has. Piped on
   * to another command, what stands after that statement may never run: the group's shell is ended at what it writes once that command
   * has gone.
   */
  const bracedFirst: { from?: number }[] = []
  const parenFirst: { from?: number }[] = []
  /** For each parenthesis and each block open, how many launches were read when it opened. */
  const parenAt: number[] = []
  const openedAt: number[] = []
  /**
   * How many launches were read when the list being read began: the pipelines joined by `&&` and `||` up to the next `;`, `&` or line's
   * end. An `&` leaves all of it running behind in bash and sh, and its last pipeline in zsh: none of it is waited for for sure.
   */
  let listAt = 0
  /**
   * Where the pipeline being read began among the launches: zsh leaves only the last pipeline of `a && b &` running behind, and waits
   * for what stands before it.
   */
  let lastAt = 0
  /** For each parenthesis and each block open, where the pipeline it stands in began. */
  const parenLast: number[] = []
  const openedLast: number[] = []
  /** Where what an `&` leaves running behind begins: the list it closes, or to zsh the last pipeline of it. */
  const behindAt = (): number => (shell.isZsh === true ? lastAt : listAt)
  /** For each parenthesis and each block open, where the list it stands in began. */
  const parenList: number[] = []
  const openedList: number[] = []
  /**
   * Tells every launch read since a group opened as left running behind, where an `&` closes the group: the shell does not wait for
   * what the group runs, and the group's end is not the command's.
   */
  const leave = (from: number | undefined, next: string): void => {
    if (from === undefined || next !== '&') return
    for (let at = from; at < runs.length; at += 1) {
      const run = runs[at]

      if (run !== undefined) runs[at] = { ...within(run), isBackground: true }
    }
  }
  /** Whether a statement runs nothing: it has no word, or only the word that closes a `{` group. */
  const isBare = (one: Statement): boolean => one.words.every(word => bareOf(word) === '}')
  /** Whether a statement of any word has been read: a loop's rounds are read from its `do` on, which then stands before any. */
  let isBegun = false
  /** Marks the end of a statement: the first of each group that has ended none yet. */
  const endFirst = (): void => {
    for (const group of bracedFirst) group.from ??= runs.length
    for (const group of parenFirst) group.from ??= runs.length
  }
  /** Tells every launch read since a group's first statement as one that may not have run, where the group is piped on. */
  const pipe = (group: { from?: number } | undefined, next: string): void => {
    if (group?.from === undefined || (next !== '|' && next !== '|&')) return
    for (let at = group.from; at < runs.length; at += 1) {
      const run = runs[at]

      if (run !== undefined) runs[at] = { ...run, isMaybe: true }
    }
  }
  /** How many of the blocks open are loops: a `break` or a `continue` in one leaves no more than it. */
  let loops = 0
  let parens = 0
  /** A function's body: due after its name, or open since the blocks and parentheses around it were this many. */
  let body: 'due' | number | undefined
  /** Whether a `[[` is open: what stands up to its `]]` is a test's words, and no command. */
  let isTesting = false
  /** The statements already read, a loop's body once for each word it goes through. */
  let skip = 0
  /** Whether the statement being read hangs on an `&&` or `||` before it: it stands after one, or in a pipeline or a parenthesis that does. */
  let isHung = false
  /** For each parenthesis open, whether it hangs so. */
  const hung: boolean[] = []
  /** For each parenthesis open, whether the shell may have been left before it: a word that leaves, in one, leaves only its own shell. */
  const left: boolean[] = []
  const strict: boolean[] = []
  /** For each parenthesis open, whether it stands behind a `!`: its failing is then only asked after. */
  const turned: boolean[] = []
  /** A launch whose end is not the command's own: one read in a loop's round, or in a command run to make a word. */
  const within = ({ ownsExit: _ownsExit, ...run }: FleetRun): FleetRun => run

  /** For each statement, whether it and all after it are lines of no word but a `}`, none piped on or left behind: read once, from the end. */
  const alone: boolean[] = []

  for (let at = statements.length - 1; at >= 0; at -= 1) {
    const one = statements[at]

    alone[at] = (alone[at + 1] ?? true) && one !== undefined && isBare(one) && !UNWAITED.has(one.after)
  }
  for (const [index, { words, before, after, isOdd, isRedirected, asides }] of statements.entries()) {
    if (index < skip) continue
    // After `&&` or `||` a statement hangs on the one before it, and so does the rest of its pipeline and all that a parenthesis in it holds.
    // What follows a parenthesis goes on from where it opened; a new list in one hangs as the parenthesis does; a block's own end is no new list.
    if (before === '&&' || before === '||') isHung = true
    else if (before === ')') isHung = hung.pop() ?? false
    else if (before !== '|' && before !== '|&' && before !== '(' && blocks === 0) isHung = hung.at(-1) ?? false
    // A new list in a `{` group hangs as the group does.
    else if (before !== '|' && before !== '|&' && before !== '(' && opened.at(-1) === '{') isHung = braced.at(-1) ?? isHung
    /** Whether the parenthesis this statement closes stood behind a `!`. */
    let wasTurned = false

    if (before === ')') listAt = parenList.pop() ?? listAt
    else if (before !== '&&' && before !== '||' && before !== '|' && before !== '|&') listAt = runs.length
    if (before === ')') lastAt = parenLast.pop() ?? lastAt
    else if (before !== '|' && before !== '|&') lastAt = runs.length
    if (before === ')') {
      shell.isLeft = left.pop() ?? shell.isLeft
      shell.isStrict = strict.pop() ?? shell.isStrict
      pipe(parenFirst.pop(), after)
      const from = parenAt.pop()

      leave(from, after)
      wasTurned = turned.pop() ?? false
      // Behind a `!` the parenthesis exits as the other of what it ran: no launch in it, however deep, exits as the command does.
      if (wasTurned) for (let at = from ?? runs.length; at < runs.length; at += 1) runs[at] = within(runs[at] as FleetRun)
      // A parenthesis that fails is a command that fails, save where no failing ends the shell: in a condition, before an `&&` or `||`,
      // or behind a `!`.
      if (shell.isStrict && !UNWAITED.has(after) && after !== '&&' && after !== '||' && asked === 0 && !wasTurned) shell.isLeft = true
    }
    /** Whether the shell leaves at a command that fails, as this statement begins. */
    const wasStrict = shell.isStrict

    if (after === '(') {
      hung.push(isHung)
      left.push(shell.isLeft)
      strict.push(shell.isStrict)
      turned.push(false)
      parenFirst.push({})
      parenAt.push(runs.length)
      parenList.push(listAt)
      parenLast.push(lastAt)
    }
    // A `;;` stands only in a `case`, which is not followed: met anywhere else, what it parts is not what is read here.
    if (before === ';;' || after === ';;') lose(shell)
    // What stands in a block that may not run, as an `if`'s branch or a `while`'s body, or hangs on an `&&` or `||`, may not run at all.
    const isMaybe = unsure > 0 || isHung
    // Neither may what stands past a word that may have left the shell, or past what is not followed here.
    const maybe = (run: FleetRun): FleetRun => (isMaybe || shell.isLeft || shell.isLost ? { ...run, isMaybe: true } : run)
    const found = typeof body !== 'number' && !isTesting && !isOdd ? loopOf(statements, index, shell.budget.left) : undefined
    // Each round is the body's statements read once more, out of what the whole command may have read.
    const cost = found === undefined ? 0 : found.items.length * (found.end - index)
    const loop = found !== undefined && !shell.sealed.has(found.name) && !shell.isLost && cost <= shell.budget.left ? found : undefined

    if (loop !== undefined) shell.budget.left -= cost

    if (loop !== undefined) {
      // Each time round, the variable holds the next word, and nothing else known before is sure. Each launch is one of its own, and none
      // has one place in the command where a copy of its spec could be written for it alone.
      // Each round goes on from what the one before left, the variable holding the next word.
      const inner: Shell = { ...shell, vars: new Map(shell.vars), sealed: new Set(shell.sealed) }
      const from = runs.length

      // A loop is many statements: none of its launches is the first of a group around it.
      endFirst()
      for (const item of loop.items) {
        if (inner.sealed.has(loop.name)) lose(inner)
        else inner.vars.set(loop.name, item)
        for (const { specSpan: _span, ...run } of scan(statements.slice(index + 1, loop.end), inner, home)) runs.push(maybe(within(run)))
        // A round that ran what is not known, as a variable that may hold `break`, may have left the loop: no round after it is sure.
        if (inner.isLost) break
      }
      // After it, what the rounds made unsure stays so, and nothing they assigned is sure.
      shell.isLost ||= inner.isLost
      // Left running behind or piped on, the loop ran in a shell of its own: a word that leaves, in it, left only that.
      if (!UNWAITED.has(statements[loop.end]?.after ?? '')) shell.isLeft ||= inner.isLeft
      // Waited for, it leaves the shell told what its last round left it told.
      // One that may not have run can only have told it to leave.
      if (!UNWAITED.has(statements[loop.end]?.after ?? '')) shell.isStrict = isMaybe || opened.length > 0 ? shell.isStrict || inner.isStrict : inner.isStrict
      shell.isWhole &&= inner.isWhole
      for (const name of inner.sealed) shell.sealed.add(name)
      forget(shell)
      // A redirection on the loop's `done` that cannot be opened fails the loop: told to leave at a failure, zsh leaves there, and bash
      // and sh go on. The `done` is passed over with the loop, so it is asked here, save where no failing ends the shell, as for a
      // parenthesis: in a condition, before an `&&` or `||`, or piped on or left running behind.
      const doneAfter = statements[loop.end]?.after ?? ''
      if (statements[loop.end]?.isRedirected === true && (wasStrict || shell.isStrict) && !UNWAITED.has(doneAfter) && doneAfter !== '&&' && doneAfter !== '||' && asked === 0) shell.isLeft = true
      skip = loop.end + 1
      // The loop's first line and its `done` may each open or close a shell of their own around it.
      for (const edge of [after, statements[loop.end]?.after]) {
        if (edge === '(') parens += 1
        else if (edge === ')') parens = Math.max(0, parens - 1)
      }
      // Piped on itself, it may be ended at what it writes as a group may.
      pipe({ from }, statements[loop.end]?.after ?? '')
      leave(statements[loop.end]?.after === '&' ? behindAt() : undefined, '&')
      continue
    }
    const defined = definedAt(statements, index)
    let at = defined ?? 0
    let isTimed = false
    let isNegated = false
    /** Whether the statement only tells the shell how to go on, as `set` does: it does not fail. */
    let isTelling = false
    /** Whether the statement's command is one of those POSIX sets apart, run by this shell itself. */
    let isSpecial = false
    let isHeader = false

    // A function may stand for any command, and the shell calls some by itself, as zsh calls `chpwd` after a `cd`: past a definition, as past what is odd, nothing is sure.
    if (isOdd || defined !== undefined || (words.length === 0 && before === '(' && after === ')')) lose(shell)
    if (defined !== undefined) body = 'due'
    // The body opens with the word after the name, or with what follows the name's own parentheses.
    if (body === 'due' && (at < words.length || (defined === undefined && !(words.length === 0 && before === '(' && after === ')')))) body = blocks + parens
    for (let key = bareOf(words[at]) ?? ''; KEYWORDS.has(key) && !isTesting; key = bareOf(words[at]) ?? '') {
      // A loop runs its body again with what the body assigned: nothing known before it is sure inside.
      if (LOOPS.has(key)) forget(shell)
      loops = Math.max(0, loops + (LOOPS.has(key) ? 1 : key === 'done' ? -1 : 0))
      // A `case` has patterns that close parentheses they did not open: where it ends is not followed.
      if (key === 'case') lose(shell)
      isTimed ||= key === 'time'
      isNegated ||= key === '!'
      // A loop's first line names its variable and what it goes through: there is no command in it.
      isHeader ||= key === 'for' || key === 'select'
      blocks = Math.max(0, blocks + (KEYWORDS.get(key) ?? 0))
      if (KEYWORDS.get(key) === 1) {
        open(key, key === 'if' || key === 'while' || key === 'until')
        openedLeft.push(shell.isLeft)
        openedStrict.push(shell.isStrict)
        openedPiped.push(isPipedOn)
        openedTurned.push(isNegated || (isTurned && (before === '|' || before === '|&')))
        isPipedOn = false
        openedAt.push(runs.length)
        openedList.push(listAt)
        openedLast.push(lastAt)
        lastAt = runs.length
        // What a group or a block holds is lists of its own, whatever it stands after: an `&` in it leaves nothing outside it behind.
        listAt = runs.length
        if (key === '{') {
          braced.push(isHung)
          bracedFirst.push({})
        }
      } else if (!isPaired(key, opened.at(-1)) && !(key === 'do' && !isBegun)) {
        // An `esac`, a `done`, a `fi` or a `}` that ends no block read here, or a `then` or a `do` in none, belongs to one that was not
        // seen, as one an alias stands for: what was read up to it may stand in a branch of it, and nothing after it is sure. A loop's
        // rounds are read from its `do` on.
        if (KEYWORDS.get(key) === -1) {
          shut()
          openedLeft.pop()
          openedStrict.pop()
          isPipedOn = openedPiped.pop() ?? false
          openedTurned.pop()
          openedAt.pop()
          listAt = openedList.pop() ?? listAt
          lastAt = openedLast.pop() ?? lastAt
        }
        lose(shell)
        pipe({ from: 0 }, '|')
      } else if (KEYWORDS.get(key) === -1) {
        const was = openedLeft.pop()
        const wasTold = openedStrict.pop()

        isPipedOn = openedPiped.pop() ?? false
        const from = openedAt.pop()

        leave(from, after)
        // Behind a `!`, no launch in the block exits as the command does.
        if (openedTurned.pop() === true) for (let place = from ?? runs.length; place < runs.length; place += 1) runs[place] = within(runs[place] as FleetRun)
        listAt = openedList.pop() ?? listAt
        lastAt = openedLast.pop() ?? lastAt
        if (shut() === '{') {
          braced.pop()
          pipe(bracedFirst.pop(), after)
        }
        // A group, a loop or an `if` left running behind, or piped on to another command, ran in a shell of its own: a word that leaves,
        // in it, left only that.
        if (UNWAITED.has(after) && was !== undefined) shell.isLeft = was
        if (UNWAITED.has(after) && wasTold !== undefined) shell.isStrict = wasTold
      }
      // A condition runs from the word that asks to its `then` or `do`.
      if ((key === 'then' || key === 'do' || key === 'elif') && asking.length > 0 && isPaired(key, opened.at(-1))) {
        asked += (key === 'elif' ? 1 : 0) - (asking.at(-1) === true ? 1 : 0)
        asking[asking.length - 1] = key === 'elif'
      }
      at += 1
    }
    /** Whether the statement stands in a condition, of the block around it or of any around that. */
    const wasAsking = asked > 0

    // A parenthesis that opens right after a group or a block does stands in the list that begins there.
    if (after === '(' && parenList.length > 0) parenList[parenList.length - 1] = listAt
    if (after === '(' && parenLast.length > 0) parenLast[parenLast.length - 1] = lastAt
    // An assignment holds from here on only where the shell is sure to make it, in the shell the next statements run in.
    const isRun = blocks + parens === 0 && !CONDITIONAL.has(before) && !UNWAITED.has(after) && !isTimed && !isApart(statements, index)
    const first = at

    while (assigned(words[at]) !== null) at += 1
    const prefixed = words.slice(first, at)

    if (isTesting || nameOf(words[at]) === '[[') {
      // A test may assign, as arithmetic does.
      isTesting = !words.some(word => bareOf(word) === ']]')
      forget(shell)
    } else if (typeof body !== 'number') {
      // Whether a function is called is not told here: nothing in its body is taken to be run or assigned.
      // A command run to make a word runs in a shell of its own, which begins with what this one holds, less what this statement assigns.
      // The statement's assignments are found once, not for each such command: a statement of many is gone through once.
      const assigning = words.filter(word => assigned(word) !== null)

      for (const piece of [...words.flatMap(word => word.pieces.filter(one => one.quote === '(')), ...asides]) {
        const inner = { ...shell, vars: new Map(shell.vars), sealed: new Set(shell.sealed) }

        strike(assigning, inner)
        // What `<(…)` or `>(…)` runs is not waited for, and may outlast the shell: a launch in it is left running behind.
        for (const run of scan(statementsOf(piece.text) ?? [], inner, home).map(within)) runs.push(maybe({ ...run, ...(piece.isAside === true ? { isBackground: true } : {}), ...(piece.isUnsure === true ? { isMaybe: true as const } : {}), ...(run.specSpan === undefined ? {} : { specSpan: [run.specSpan[0] + piece.from, run.specSpan[1] + piece.from] as [number, number] }) }))
      }
      // An assignment of what is written out does not fail.
      if (at === words.length) isTelling = words.every(isWritten)
      if (at === words.length && isRun) assign(prefixed, shell, shell.vars, false)
      else if (at === words.length) {
        // One made under a condition, in a block or in a shell of its own may not have been made.
        strike(prefixed, shell)
        if (prefixed.length > 0) forget(shell)
      } else if (!isHeader) {
        const wrappers: string[] = []
        let name = nameOf(words[at])

        // What is assigned before a command is that command's alone: its own arguments are filled in without it.
        while (name === 'timeout' || (name !== undefined && WRAPPERS.has(name))) {
          wrappers.push(name)
          at += name === 'timeout' ? 2 : 1
          // Only `env` takes assignments before its command: behind any other the word is the program's name, and no such program is run.
          if (name === 'env') while (assigned(words[at]) !== null) at += 1
          name = nameOf(words[at])
        }
        const args = words.slice(at + 1)
        /** What this command alone is given, before it or after `env`. */
        const lent = words.slice(first, at).map(word => assigned(word)?.[1] ?? '')
        const isDetached = wrappers.includes('nohup')

        // Behind `command` or `builtin` it is a command like any other; `exec` is one of them itself, whatever it runs.
        isSpecial = wrappers[0] === 'exec' || (wrappers.length === 0 && SPECIALS.has(name ?? ''))

        // A variable a shell is ruled by, given to a command, rules the shell that command starts.
        if (lent.some(one => RULING.has(one))) lose(shell)
        // fleet-run is a Python script: it may be run by its interpreter, given its path.
        const script = PYTHONS.test(name ?? '') ? scriptAt(args) : -1
        const isScripted = script >= 0 && nameOf(args[script]) === 'fleet-run'
        const run = name === 'fleet-run' || isScripted ? runOf(isScripted ? args.slice(script + 1) : args, shell, after === '&', isDetached) : undefined
        const handed = run === undefined ? handedOf(name, args) : undefined
        const text = handed === undefined ? undefined : scriptOf(handed.word, shell)

        // The command exits as its last statement does, where that is one command alone: nothing after it but lines of no word, no
        // pipeline it is of, no `!` before it, no block around it, and not left running behind.
        // A `{` group around it changes nothing of that, and neither does the word that closes one; what closes a group or a
        // parenthesis after it must not pipe it on or leave it behind.
        const isLast =
          unsure === 0 &&
          before !== '|' &&
          before !== '|&' &&
          !UNWAITED.has(after) &&
          !isNegated &&
          (alone[index + 1] ?? true)

        // An `exec` that surely runs takes the shell's place: nothing written after it runs, and the command exits as the launch does.
        // Not one hung on `&&` or `||`, in a block, a group or a parenthesis, piped or left behind, where what follows may run without
        // it; not one behind another wrapper, which may look for a program named `exec`; and not one with a redirection, which
        // bash and zsh go on past when it fails: `exec L > /no/such/file; echo x` launches nothing and exits 0.
        const isTaking = wrappers[0] === 'exec' && isRun && !isHung && !isNegated && !isRedirected && before !== '|' && before !== '|&'

        if (run !== undefined) runs.push(maybe(isLast || isTaking ? { ...run, ownsExit: true } : run))
        // Told to leave at the first command that fails, the shell may be gone past any command.
        if (name === 'set' && wrappers.every(one => one === 'command' || one === 'builtin')) {
          isTelling = true
          for (const [place, arg] of args.entries()) {
            const flag = bareOf(arg) ?? ''
            const isNamed = /^[-+]o$/.test(bareOf(args[place - 1]) ?? '') && flag === 'errexit'

            // Told to read as POSIX says, wherever and however: from then on it may.
            if (flag === 'posix') shell.isPosix = true

            // Told to leave in an element of a pipeline that is not its last, or left running behind, a shell of its own is told, and not this one.
            // The last element zsh runs in this shell.
            if ((/^-[A-Za-z]+$/.test(flag) && flag.includes('e')) || (isNamed && bareOf(args[place - 1]) === '-o')) shell.isStrict ||= !UNWAITED.has(after)
            // Told to stay, only where the telling surely runs in this shell: in no block, on no `&&` or `||`, in no pipeline.
            // Nor behind `command` or `builtin`: zsh looks for a program of that name, finds none, and leaves.
            else if (((/^\+[A-Za-z]+$/.test(flag) && flag.includes('e')) || isNamed) && wrappers.length === 0 && opened.length === 0 && !isHung && before !== '|' && before !== '|&' && !UNWAITED.has(after)) shell.isStrict = false
          }
        }
        // Neither does a command that only answers yes, or one that names a variable to what is written out.
        if (wrappers.length === 0 && (name === 'true' || name === ':' || (UNFAILING.has(name ?? '') && args.every(arg => isWritten(arg) && !(bareOf(arg) ?? '-').startsWith('-'))))) isTelling = true
        // Past an `exec` that surely runs a program, this shell runs nothing more: the program took its place.
        if (wrappers.includes('exec') && isRun && run !== undefined) return runs
        // The shell a script is handed to has this one's home directory only while this one has the one it began with, and is given no other.
        if (handed !== undefined && text !== undefined) {
          // A script handed to zsh is read as zsh reads it only where this shell is known: one handed to any other is read as is safe for all.
          const inner = runsIn(text.text, shell.vars.get('HOME') === home && !lent.includes('HOME') ? home : undefined, shell.isLost || !handed.isPlain, shell.budget, shell.isZsh === true && name === 'zsh', name === 'sh')

          // Piped on, a script of more than one statement may be ended at what it writes before it reaches a launch.
          const isPiped = (after === '|' || after === '|&') && (statementsOf(text.text)?.filter(one => one.words.length > 0).length ?? 2) > 1

          runs.push(...inner.map(one => maybe(placed(isLast || isTaking ? one : within(one), text, after === '&', isDetached || name === 'orca'))).map(one => (isPiped ? { ...one, isMaybe: true as const } : one)))
        }
        // Past an `exit`, a `return` or an `exec`, wherever it stands, the shell may be gone for what follows: `cd there || exit 0`. What the
        // statement itself runs, as the script an `exec` hands on, is not past it. So it may be past a `break` or a
        // `continue` in no loop, which zsh stops at.
        // One left running behind, or piped on to another command, runs in a shell of its own and leaves only that. The last of a pipeline zsh
        // runs in this shell.
        if (!UNWAITED.has(after) && (wrappers.includes('exec') || EXITS.has(name ?? '') || (loops === 0 && LEAVES.has(name ?? '')))) shell.isLeft = true
        // `exec` may hand the shell's own variables on, and where it stands in a shell of its own zsh goes on from it in that one too, running
        // what follows twice; `env`, `nohup` and `timeout` run a program, which changes none; `command -v` only asks. Behind any of them a
        // builtin that assigns is not sure to assign: `command` runs it in bash and sh, and zsh looks for a program of its name.
        if (wrappers.includes('exec') && !isRun) lose(shell)
        else if (wrappers.includes('exec')) forget(shell)
        else if (wrappers.length > 0 && ASSIGNERS.has(bareOf(words[at]) ?? '')) affect(words[at], args, shell, false)
        // An assignment before `export` or `readonly` is made before the arguments are filled in by zsh, and after by bash: what it
        // assigns is not sure.
        else if (wrappers.every(one => one === 'command') && !(wrappers.length > 0 && /^-[vV]$/.test(bareOf(words[at]) ?? ''))) {
          affect(words[at], args, shell, isRun)
          if (prefixed.length > 0 && ASSIGNERS.has(bareOf(words[at]) ?? '')) strike(args, shell)
        }
        // Yet what is assigned before a command may outlast it, as before `export` or a special builtin of `sh`: what the variable held before is not sure after.
        strike(prefixed, shell)
      }
    }
    if (after === '(') parens += 1
    else if (after === ')') parens = Math.max(0, parens - 1)
    if (typeof body === 'number' && blocks + parens <= body) body = undefined
    // A statement of no word, or of only the words that open or close a block, runs nothing: it is not the first of any group.
    // An `&` leaves the whole list it closes running behind, each pipeline of it and what each group in it holds.
    leave(behindAt(), after)
    if (first < words.length) endFirst()
    // A command that fails ends a shell told to leave at the first that does: none read here is known not to.
    // One whose failing is taken in, by `|| true` after it, ends nothing.
    const isTaken = after === '||' && /^(?:true|:)$/.test(bareOf(statements[index + 1]?.words[0]) ?? '') && statements[index + 1]?.words.length === 1

    // Nor does one whose failing is only asked after: in the condition of an `if` or a loop, before an `&&` or `||`, or behind a `!`.
    const isBehind: boolean = isNegated || wasTurned || (isTurned && (before === '|' || before === '|&'))

    if (after === '(') turned[turned.length - 1] = isBehind
    const isAsked = wasAsking || after === '&&' || after === '||' || isBehind

    // A pipeline fails with any element of it, where the shell is told so: one that ends in what does not fail may fail all the same.
    // A redirection fails where what it leads to cannot be opened, whatever the command, and with no command at all: `: > /no/such/file`,
    // `x=1 > /no/such/file` and a bare `> /no/such/file` each fail, in bash, zsh and sh alike.
    const mayFail = (first < words.length ? !isTelling || isPipedOn : words.length > 0 && isPipedOn) || isRedirected

    // `sh -c ': > /no/such/file; L'` runs no `L`, in macOS's sh as in bash told to read as POSIX says; bash and zsh as they are go on.
    const isLeaving = shell.isPosix === true && isSpecial && isRedirected

    if (((wasStrict && mayFail) || isLeaving) && !isTaken && !isAsked && !UNWAITED.has(after)) shell.isLeft = true
    isPipedOn = after === '|' || after === '|&' ? isPipedOn || isRedirected || !(first < words.length && isTelling) : false
    isTurned = (after === '|' || after === '|&') && isBehind
    isBegun ||= words.length > 0
  }

  return runs
}

/** The launches a script makes, read by a shell that begins with this home directory; `isLost` where how that shell reads is not sure. */
const runsIn = (script: string, home: string | undefined, isLost: boolean, budget: { left: number } = { left: LOOP_BUDGET }, isZsh = false, isPosix = false): FleetRun[] => {
  const shell: Shell = {
    budget,
    isZsh,
    isPosix,
    vars: new Map(home === undefined ? [] : [['HOME', home]]),
    sealed: new Set(),
    // `IFS` named anywhere may be `IFS` assigned: what a variable written bare holds may then be parted at any character.
    isWhole: !/\bIFS\b/.test(script),
    isLost,
    isLeft: false,
    isStrict: false,
  }

  return scan(statementsOf(script) ?? [], shell, home)
}

/** How many parentheses a command may have open at once and still be read. */
const DEPTH = 200

/**
 * Whether a command opens more parentheses inside one another than is read here, counted as written, in quotes or not: each is read
 * by a reading of its own, and very many take long and then fail. Such a command is not read at all: no launch is told of it.
 */
const isDeep = (command: string): boolean => {
  let depth = 0

  for (let at = command.indexOf('('); at >= 0 && at < command.length; at += 1) {
    const char = command[at]

    if (char === '(') {
      depth += 1
      if (depth > DEPTH) return true
    } else if (char === ')' && depth > 0) depth -= 1
  }

  return false
}

/**
 * Whether an `esac` stands as a word of its own after a command run to make a word opens, or in one: in a comment, in quotes or in a
 * here-document's lines it is text, and closes nothing. A script in quotes is looked through as a script of its own only where it is
 * handed on to be run, as the launches in it are read: after `sh -c` and its like, or an Orca terminal's `--command`, wherever in the
 * statement those stand. Any other word in quotes is text. Where the text cannot be parted into commands, any `esac` after the
 * opening counts.
 */
const knotted = (text: string, isInside: boolean): boolean => {
  const opener = isInside ? 0 : text.search(/\$\(|`/)

  if (opener < 0 || !/\besac\b/.test(text.slice(opener))) return false
  const statements = statementsOf(text)

  if (statements === undefined) return true

  // A word handed on is read whole, as the script it is: its quotes may part it into several stretches.
  const whole = (word: Word): string => word.pieces.map(piece => (piece.quote === '(' ? `$(${piece.text})` : piece.text)).join('')

  return statements.some(({ words, asides }) => {
    // In double quotes a command is run to make the word all the same: a word with any is looked through whole from where one opens,
    // as quotes inside the command may part it into several stretches.
    // The words handed on to be run, whatever stands before the command that hands them: a wrapper, or a name given a value.
    // Each is asked of the few words that can answer it, and not of all that follow: a statement of many words is gone through once.
    const commands = words.flatMap((word, index) => (givenAs(word, '--command') === 'joined' || (givenAs(word, '--command') === 'apart' && index + 1 < words.length) ? [index] : []))
    const scripts = words.flatMap((word, index) => {
      const name = bareOf(word)

      if (name === 'orca') {
        // The one `--command` after it, where there is one alone: with none or two, no word is handed on.
        const [last, more] = [commands.at(-1), commands.at(-2)]

        return last === undefined || last <= index || (more !== undefined && more > index) ? [] : (handedOf(name, [...words.slice(index + 1, index + 3), ...words.slice(Math.max(last, index + 3), last + 2)])?.word ?? [])
      }
      if (name === undefined || !SHELLS.has(name)) return []
      // A shell's options, up to the first word that is none or the `-c` that hands the next word on.
      let end = index + 1

      for (;;) {
        const flag = bareOf(words[end])

        if (flag === undefined || !flag.startsWith('-') || flag === '-c' || flag === '-lc') break
        end += 1
      }

      return handedOf(name, words.slice(index + 1, end + 2))?.word ?? []
    })

    // Each word is looked through once: whole where it has double quotes or is handed on, which takes in the commands run to make
    // it, and by those commands alone where it is neither.
    const handed = new Set(scripts.filter(word => word.pieces.some(piece => piece.quote === '"' || piece.quote === "'")))
    const own = new Set(words)
    const others = [...handed].filter(word => !own.has(word))

    return (
      words.some(word => (bareOf(word) === 'esac' ? word.from >= opener : handed.has(word) || word.pieces.some(piece => piece.quote === '"') ? knotted(whole(word), false) : word.pieces.some(piece => piece.quote === '(' && knotted(piece.text, true)))) ||
      others.some(word => knotted(whole(word), false)) ||
      asides.some(piece => knotted(piece.text, true))
    )
  })
}

/**
 * The launches a command makes, in the order written: each `fleet-run` that
 * stands as a command of its own, behind `nohup` and its like or not, and
 * each in a script handed to a shell or to an Orca terminal in quotes. One
 * that is only text (a comment, a here-document's line, an argument another
 * command prints) is none, and neither is one in a function's body, which
 * runs only where the function is called. Told the shell that runs the
 * command is zsh, what zsh and bash read apart is read as zsh does; told
 * nothing, or bash, as is safe for both.
 */
export const findFleetRuns = (command: string, home?: string, tool?: 'zsh' | 'bash'): FleetRun[] => {
  // A `case` may stand in a command run to make a word unseen, as behind an alias: its patterns then close parentheses they did not open, and
  // where that command ends is not where it is read to end. An `esac` anywhere after one opens is the sign of it: nothing is then sure.
  if (isDeep(command)) return []
  work = { left: WORK + WORK_EACH * command.length }
  try {
    const isKnotted = knotted(command.replace(JOINED, ''), false)
    const runs = runsIn(command, home, isKnotted, undefined, tool === 'zsh').map(run => (isKnotted ? { ...run, isMaybe: true as const } : run))

    // That fleet-run turns a launch away is told only from a command with nothing in it that shells read each their own way.
    return isPlainScript(command) ? runs : runs.map(({ isRefused: _isRefused, isLacking: _isLacking, ...run }) => run)
  } catch (error) {
    // A command that takes more reading than it is given is not read at all, as one too deep is not: no launch is told of it.
    if (error === SPENT) return []
    throw error
  } finally {
    work = undefined
  }
}

/** The plain redirections every shell reads alike: to a file, or onto one of the three first. */
const PLAIN_REDIRECT = /(^|[\s;&|])(?:[012]?>>?|<)(?:&[012-]|[ \t]*[\w./~@%+,:-]+)/g

/** Whether a command holds only what bash, sh and zsh read alike: words, plain quotes, variables, plain redirections and operators. */
const isPlainScript = (command: string): boolean => {
  const bare = command.replace(PLAIN_REDIRECT, '$1')

  return /^[\w./:@%+,=~\- \t\n"';&|$]*$/.test(bare) && !/(?:^|\s)=/.test(bare) && !/\$(?![A-Za-z_])/.test(bare)
}

/** Where a character's copy of a spec goes: beside it, one name on, the character's own so that two do not share one. */
export const voicedSpecPath = (spec: string, who: string): string =>
  spec.endsWith('.md') ? `${spec.slice(0, -3)}.chiikawa-${who}.md` : `${spec}.chiikawa-${who}.md`

export type Meta = { isOk: boolean; note: string; tokens?: Tokens }

const count = (usage: Record<string, unknown>, key: string): number => {
  const value = usage[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * A worker's usage as one shape. Each engine spells its own: Codex counts
 * the cached tokens inside `input_tokens`, the others beside them.
 */
export const readTokens = (usage: unknown): Tokens | undefined => {
  if (typeof usage !== 'object' || usage === null) return undefined
  const row = usage as Record<string, unknown>
  const inside = count(row, 'cached_input_tokens')
  const cached = inside + count(row, 'cache_read_input_tokens') + count(row, 'cache_read_tokens')
  const fresh = count(row, 'input_tokens') - inside + count(row, 'cache_creation_input_tokens')
  const out = count(row, 'output_tokens')
  const usd = typeof row.cost_usd === 'number' ? row.cost_usd : undefined

  return fresh + cached + out === 0 && usd === undefined ? undefined : { fresh: Math.max(0, fresh), cached, out, usd }
}

/** What a worker's `<out>.meta.json` says about how it ended. */
export const readMeta = (text: string, words: Pick<Words, 'took' | 'exitCode'>): Meta | undefined => {
  try {
    const meta: unknown = JSON.parse(text)

    if (typeof meta !== 'object' || meta === null) return undefined
    const { exit_code: code, model, seconds, status, usage } = meta as Record<string, unknown>
    const isOk = code === 0
    const took = typeof seconds === 'number' ? words.took(Math.round(seconds)) : ''
    const how = isOk ? '' : typeof status === 'string' ? status : words.exitCode(String(code))
    const note = [typeof model === 'string' ? model : '', took, how].filter(part => part !== '').join(' · ')

    return { isOk, note, tokens: readTokens(usage) }
  } catch {
    return undefined
  }
}
