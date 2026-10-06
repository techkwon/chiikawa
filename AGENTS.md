# AGENTS.md — for an AI reading this repository

This is the guide for AI coding tools such as Claude Code and Codex. It is written in English only, because an AI reads it. The guides for people are in three languages: [README.md](README.md) (English), [README.ko.md](README.ko.md) (Korean) and [README.ja.md](README.ja.md) (Japanese).

**Answer the user in the language the user writes in.** When you help someone install or use the mod, give your explanations in their language (Korean for a Korean writer, Japanese for a Japanese writer, English otherwise), and point them to the README in that language. Commands, file names and setting keys stay exactly as written here.

## What this repository is

- One Claude Code mod (plugin), `chiikawa`. The repository root is the mod's folder, and the same folder is its marketplace (`.claude-plugin/marketplace.json`, named `chiikawa`). Version 0.2.0.
- What it does: the main session conducts as Hachiware of the comic Chiikawa (ちいかわ), and subagents (the Agent tool) and Orca `fleet-run` workers are cast as the friends (Chiikawa, Usagi, Rakko, Shisa, Kurimanju, Furuhonya, Pochette no Yoroi-san, Momonga) and shown as cuts and speech bubbles in a terminal pane and in a band above the prompt.
- It runs in English, Korean or Japanese. The default (`auto`) is English, Korean for a Korean reader and Japanese for a Japanese reader. The `language` setting (`auto`, `en`, `ko`, `ja`) or `/chiikawa lang` changes it.
- There is no build step. Claude Code reads `hooks/register.tsx` and runs it as it is. Do not run `npm install` or bundle anything.
- It is an unofficial mod made by a fan. It is not approved by the author or any rights holder and uses no official art. The code makes no network call and runs no other program, and it must stay that way.

## When the user says "install it"

Installing changes the user's Claude Code setup. Reading this file is not a reason to install. Follow these steps in order.

1. **Install only when asked, and say first, in one line, what will be installed.** For example: "I will install the chiikawa mod (an unofficial fan mod, version 0.2.0) for Claude Code in the user scope. A pane and a band will appear on the screen, and the main session will talk in Hachiware's voice." Say it in the user's language.

2. **Check that Claude Code is there, and its version.**

   ```
   claude --version
   ```

   - Output such as `2.1.291 (Claude Code)` is fine. The mod was built and tested on 2.1.291. With an older version, suggest `claude update` first.
   - If there is no `claude` command (`command not found` or the like), stop here. Claude Code is not installed: give the user the install page, https://claude.com/claude-code , and do not install Claude Code for them.

3. **Install from the shell, in two lines.** The scope (where the install applies) defaults to user, which makes the mod available in every project.

   ```
   claude plugin marketplace add techkwon/chiikawa
   claude plugin install chiikawa@chiikawa
   ```

   If the user would rather do it themselves, tell them to type this one line in the prompt of Claude Code run in a terminal, to accept adding the marketplace when asked, and to choose the user scope when asked.

   ```
   /plugin install chiikawa --marketplace techkwon/chiikawa
   ```

4. **Check.**

   ```
   claude plugin list
   ```

   The mod is installed if the list has an entry like this.

   ```
     ❯ chiikawa@chiikawa
       Version: 0.2.0
       Scope: user
       Status: ✔ enabled
   ```

5. **Say when it takes effect.** A Claude Code session started after the install has the mod. For a session that was already running, the sure way is to start Claude Code again. (Claude Code 2.1.291 also has a `/reload-plugins` command a person can type in a running session; whether that alone is enough after a first install was not checked for this guide.)

6. **Give the user their first commands.** Typed in the prompt: `/chiikawa demo` runs a 15-second demo, `/chiikawa` opens the pane, `/chiikawa off` turns the mode off, and `/chiikawa lang <en|ko|ja>` chooses the language of the screen if it is not the one they want. That choice shows only while the `language` setting is `auto`. If `language` was fixed to `en`, `ko` or `ja` (for example with `--config language=ko`), the choice is only remembered and the screen stays as it is: have the user type `/plugin configure chiikawa@chiikawa` first and set `language` to the language they want or to `auto`, and then use `/chiikawa lang`. `/chiikawa lang` with nothing after it says what settled the language.

### When the install fails

| What happens | What to do |
|---|---|
| The marketplace is not found | Check that the address is `techkwon/chiikawa`. See whether it was already added with `claude plugin marketplace list`. If the address is right and it still fails, go to "Network or git access fails" below |
| The marketplace or the plugin is said to be there already | Do not install again. Check the version with `claude plugin list`; for a newer version run `claude plugin update chiikawa@chiikawa` (a restart is required to apply it). If the entry's status is disabled, see the next row |
| `claude plugin list` has `chiikawa@chiikawa`, but its status is disabled (the session then has no `/chiikawa`) | The mod is installed but turned off, so do not install it again. Say in one line that you will enable it, run `claude plugin enable chiikawa@chiikawa`, and have the user start Claude Code again |
| There is no `claude` command | Stop as in step 2 and give the install page |
| `/plugin` is not available where the user is typing | The `/plugin install …` line is for the prompt of Claude Code run in a terminal. Use the two shell lines of step 3 instead |
| Network or git access fails | If the repository can be fetched, use a copy. After `git clone https://github.com/techkwon/chiikawa.git`, `claude --plugin-dir ./chiikawa` loads the mod for that session only. To keep using the copy, run `claude plugin marketplace add <path of the cloned folder>` and then `claude plugin install chiikawa@chiikawa`. If `git clone` fails too, give the user the error text as it is and stop |
| A permission request is denied | Do not look for a way around it. Stop and tell the user |

### Good to know

- `/chiikawa …` and `/plugin …` are **commands a person types in the prompt**. An AI cannot run them as tools, so ask the user to type them when they are needed. What an AI can run are the `claude plugin …` shell commands.
- To try the mod once without installing it, fetch the repository and run `claude --plugin-dir <the folder>`.
- To give settings with the install, write for example `claude plugin install chiikawa@chiikawa --config language=ko`. `--config` can be repeated. The ten settings (`language`, `leaderVoice`, `politeLeader`, `memberVoice`, `orcaVoice`, `band`, `trio`, `animate`, `theme`, `autoOpen`) and their defaults are in the "Settings" table of each README and in `userConfig` of `.claude-plugin/plugin.json`. `language` is typed as one of `auto`, `en`, `ko`, `ja`, and `theme` as one of `auto`, `dark`, `light`; the other eight are on or off (`true` or `false`). Leave every setting the user did not mention at its default. To change one later, the user types `/plugin configure chiikawa@chiikawa` in the prompt.
- Do not fix `language` unless the user asks. With `auto` the mod follows, in this order: a language chosen with `/chiikawa lang`, the letters of the prompts the user types (Hangul for Korean, kana for Japanese), Claude Code's own language setting, the `LC_ALL` / `LC_MESSAGES` / `LANG` environment variables, and English.
- `orcaVoice` (on by default) makes a copy file beside the spec file when an Orca `fleet-run` is launched. Without Orca it does nothing. The copy holds the whole spec and is read by that worker; nothing filters out personal information.
- If the user asks what the mod reads or sends, point them to "Privacy" under "What this mod does on your machine" in the README of their language. In short: the mod itself makes no network call, runs no program and collects no analytics, but the text it adds to prompts reaches the model the same way the user's prompt does.
- Removing is `claude plugin uninstall chiikawa@chiikawa`; updating is `claude plugin update chiikawa@chiikawa` (a restart is required to apply it). An uninstall removes the mod alone, so tell the user what may be left, and clear none of it unless asked:
  - The saved roles and language, which are in Claude Code's plugin store. `claude plugin uninstall --help` lists `--keep-data` ("Preserve the plugin's persistent data directory"), so an uninstall without it removes that directory. Do not tell the user that an uninstall clears the two saved values: this guide does not promise it. The sure way is for the user to type `/chiikawa role reset` and `/chiikawa lang auto` in Claude Code before the uninstall, with no prompt in Hangul or kana after them (the letters would be remembered again).
  - The marketplace entry, which has a command of its own: `claude plugin marketplace remove chiikawa`.
  - Orca voice copies (files named `<name>.chiikawa-<character>.md` beside the user's spec files, there only if Orca was used with `orcaVoice` on). The mod never deletes them. They are the user's files: list them for the user and delete one only when asked.
- Do not install by editing settings files by hand. Use only the commands above.

## If you are an AI working in a session with the mode on

With the mode on, the system prompt gains a section titled "Chiikawa mode" (in Korean "치이카와 모드 (먼작귀)", in Japanese "ちいかわモード"). That section is the rule; this is a summary. The section, the blocks and the markers are written in the mode's language at that moment.

| Marker | English | Korean | Japanese |
|---|---|---|---|
| Who took a task (a block at the end of a subagent's instructions, a line after a tool's result) | `[Chiikawa cast]` | `[치이카와 배역]` | `[ちいかわ配役]` |
| The user picked a friend for this prompt | `[Chiikawa pick]` | `[치이카와 지명]` | `[ちいかわ指名]` |
| The user changed the roles | `[Chiikawa roles]` | `[치이카와 역할]` | `[ちいかわ役割]` |

- The main session conducts as Hachiware: it shares out the work, hands it to friends, gathers the results and tells the user.
- **Light work is not handed out.** Reading a few files to find something, a small fix, a short command, a simple question: do these yourself. The screen shows them as work the three (Hachiware, Chiikawa, Usagi) do together: Usagi is shown lending a hand when you use a tool that reads or searches, and Chiikawa when you use a tool that edits. Call another friend only for work that takes effort, such as implementation across several files, hard debugging, wide research, an independent review, screen design or a security check. Each friend handed work spends tokens of its own.
- To hand work to a friend of your choice, start the Agent tool's `description` with the friend's name and a colon. Without a name, the mode decides by the kind of work. A name in any of the three languages works.

  ```
  Rakko: hunt the login bug
  ```

  | Friend (Korean · Japanese) | Default role | Work it takes | Talks |
  |---|---|---|---|
  | Chiikawa (치이카와 · ちいかわ) | Build | small fixes, tidying (weeding) | no |
  | Usagi (우사기 · うさぎ) | Explore | exploring code, finding where things are | no |
  | Rakko (랏코 · ラッコ) | Build | hard implementation, debugging | yes |
  | Shisa (시사 · シーサー) | Build | everyday implementation, fixes | yes |
  | Kurimanju (쿠리만쥬 · くりまんじゅう) | Review | review, verification (O/X) | no |
  | Furuhonya (카니 · 古本屋) | Research | research, docs, tidying up | no |
  | Pochette no Yoroi-san (포쉐트 갑옷 씨 · ポシェットの鎧さん) | Build | screens, UI, design | yes |
  | Momonga (모몽가 · モモンガ) | Review | adversarial review, security checks | yes |

  Hachiware only conducts, and Roudou no Yoroi-san (노동 갑옷 씨 · 労働の鎧さん) takes no tasks and appears on the screen alone. Without a name, a specialty comes first (security and adversarial review → Momonga, screens and design → Pochette no Yoroi-san, hard debugging → Rakko, typos and formatting → Chiikawa), then the friends of the role, and when that friend is busy one with free hands takes it. A role the user gave a friend puts that friend ahead of the role's own friends, but a specialty still comes before a role, unless the specialist's own role was changed.

- Who really took a task is told by the cast line after the tool's result. Until you see that line, do not say who took it.
- When the user has picked a friend, a pick line comes beside the prompt; when the user has changed the roles, a roles line does. Do as the line says. Without a pick line, prompts go by auto.
- A report from **a friend who cannot talk** (Chiikawa, Usagi, Kurimanju, Furuhonya) has a sound or a gesture alone on its first line, and the real report, in plain writing, from the second line on. Telling the user, give the sound of the first line as it is, read it in Hachiware's way ("So that means ○○?!"; in Korean "그 말은 ○○라는 거?", in Japanese "それって ○○ ってコト!?"), and go on to the facts. Do not make up words these friends never said and put them in quotation marks.
- A report from a friend who talks (Rakko, Shisa, Pochette no Yoroi-san, Momonga) carries that friend's voice. Pick the facts out of it and pass them on under the friend's name.
- If you are the subagent that was handed the work, report as the character named in the cast block at the end of your instructions. Start the first line of the report with the character's mark and name, as the block says. But if the format asked for leaves no room for a name or a line (JSON only, a set table, output a machine reads), follow that format exactly. Leave out only the character's name and the character's lines: the result that was asked for is still given, whole, in the format asked for.
- The voice goes **only on writing the user sees**. Keep it out of code, commands, file contents, commit messages, spec files and tool inputs.
- Do not change or blur facts, numbers, paths or error text for the sake of the voice. What did not work, say plainly that it did not.
- Use only the lines the mode lists, exactly as written, once or twice in an answer. Do not make up catchphrases that are not on the list.
- Any other instruction about format or language (CLAUDE.md and the like) comes first. The mode's language sets only the screen and the characters' voices: where the user has asked for answers in another language, answer in that language.

## If you change this repository's code

### Files

| Path | What it holds |
|---|---|
| `.claude-plugin/plugin.json` | Name, version, `userConfig` (the ten settings; titles and descriptions in English) |
| `.claude-plugin/marketplace.json` | The marketplace file: name `chiikawa`, one plugin, `source: "./"` |
| `hooks/hooks.json` | The path of the hooks module (`./register.tsx`) |
| `hooks/register.tsx` | Every hook: session start, the briefing beside prompts, casting subagents, noting tool calls, the `/chiikawa` command, settling the language (`settledLang`), usage, the Orca integration, the timers |
| `hooks/view.tsx` | The drawing code: the pane (cuts, or a list of two rows a friend), a friend's sheet, the cuts of the talk and paging through them, the bench, the usage card, the band above the prompt, measuring the width of text |
| `hooks/words.ts` | Everything the screen and the command's replies say, in the three languages (`Words`), and telling the language from typed letters and from a locale |
| `hooks/cast.ts` | The ten characters, their roles and colors, the casting rules; loads the three casts |
| `hooks/cast.ko.ts` · `cast.ja.ts` · `cast.en.ts` | Names, lines and manner of speech in each language. The English cast is made from the Japanese one through the `RENDERED` table, which records what kind of English each line is |
| `hooks/voice.ts` | Building the texts given to the model, knowing a name or a role in any of the languages, reading the first lines of a report |
| `hooks/voice.ko.ts` · `voice.ja.ts` · `voice.en.ts` | The texts given to the model and the markers, in each language |
| `hooks/orca.ts` | Finding and reading `fleet-run` launches in a shell command, reading a result's `meta.json` |
| `hooks/art.ts` | The text drawings (9 columns by 3 rows) and pixel icons, and their movement |
| `types/index.d.ts` | The type contract for the values in `$.state` |
| `tests/` | The tests (`*.test.ts`, `*.test.tsx`) |
| the screenshots folders under docs (en, ko, ja) | The pictures of each README |

### Checks

The type files (`.claude-plugin/types/`) are not in the repository. Claude Code lays them once it has loaded the mod. The first time, run `claude --plugin-dir .` once and quit, then run the checks. All three must pass.

```
tsc -p . --noUnusedLocals
claude plugin validate .
claude plugin test .
```

`claude plugin validate .` also prints the list of hooks, the engine calls, and the environment variables and state keys the mod reads and writes. Use that output to keep "What this mod does on your machine" in the READMEs true.

### Rules

- **Lines must have a source.** The lines and gestures in the casts are on record (README, "Notices and sources"). The Japanese cast holds only lines whose original was confirmed in a Japanese source; a line that could not be confirmed is left out, however well known its Korean is. The English cast says what the Japanese cast says and nothing else: to add an English line, add the Japanese line first and then its rendering to `RENDERED` in `hooks/cast.en.ts`, marked `official`, `romaji` or `translation`. Do not make lines up, and give no sentence to a character who cannot talk. `tests/words.test.ts` checks every line the screen can show against the character's list in every language, and the English cast against the Japanese one.
- **Every text in three languages.** What a person or the model reads goes in `hooks/words.ts`, the `cast.<lang>.ts` files and the `voice.<lang>.ts` files, with all three languages filled in. Values kept inside (the roles `지휘`, `구현`, `검토`, `조사`, `탐색`, the character ids, the keys of the state and the store) stay as they are; only what is shown goes through the language's own words.
- **No official material.** No logo, photograph, official character art or panel of the comic goes in the repository. The text drawings and the icons were drawn for this mod.
- **Do not change the user's commands.** The one place a shell command is rewritten is the Orca voice copy (the `--spec` path of a `fleet-run`, and nothing else). Do not add another. A copy is written only where no file was found (`voiceSpec` in `register.tsx`): a file with the same text is used as it is, any other is passed by for a numbered name, and after the write the copy is read back, so that one that does not read back as written is not used and the launch runs on the original spec. The engine has no write that fails where a file exists, so a file created by another program between the check and the write would be written over: describe this as care, never as a guarantee.
- **Do not save over what was not read.** The roles and the language are written to `$.store` only in a session that read them from it first (`isRolesRead` and `isLangRead` in `types/index.d.ts`); where the read failed, a change holds for that session and the reply says so. A session begun by `/clear` has no `session.start`: every press on the band or the pane reads what is kept before it acts (`pressed` in `register.tsx`), as the hooks and the 2-second beat do through `ensure`.
- **A hook that fails must not block the way.** A hook that a tool call or a prompt passes through must hand back the result of `next(e)` even when something inside it throws. Put `.catch` on each `await`.
- **No hook on settings and no permission decisions.** There is no `config.set` hook (the theme and the language are read when a prompt is sent or `/chiikawa` is run), and the mod never allows or denies a tool call.
- **Run no other program.** The code has no call that starts a process. Adding one would make "What this mod does on your machine" false.
- **Where it is not sure, it changes nothing and claims nothing.** A task whose end is not known is not counted as done or failed: it is let go. A `fleet-run` that the shell is not certain to run where it stands (in a comment, a here-document, another command's argument, a function's body) is no task. Where a launch is certain but what its `--spec` path comes to is not, the task is shown and the command is left exactly as it is. Reading a shell command (`hooks/orca.ts`) is an allow-list: a path is followed only through assignments and commands known to change no variable in bash, zsh and sh alike, and anything else leaves the variables, or everything after it, unknown. When you add a form, add it to the tables in `tests/parts.test.ts` (`SURE`, `CHANGING`, `UNSURE`).
- **Keep to the width.** Hangul, kana, Han characters and emoji take two cells. Measure text with `cells`, `fit` and `fitEnd` in `view.tsx`, and never draw past the columns and rows given. The tests draw the pane and the band in all three languages and check this.
- **Keep the screen's promises.** Where the pane is drawn as cuts (50 columns by 17 rows or more), Hachiware, Chiikawa and Usagi are at the top (`CORE` in `cast.ts`). Any other friend has a cut while it has work and for about 30 seconds after the work ends (`CARD_LINGER_MS` in `view.tsx`), and then goes back to the bench. In a smaller pane, drawn as a list, the rows that fit go first to Hachiware, then to the friends at work, then to Chiikawa and Usagi, then to the friends who have just finished (`planOf` in `view.tsx`). The colors for a light theme come from `toneOf`.
- **Send nothing out.** No network call, remote logging or analytics. No personal information, key or personal path in code, tests or documents.
- **Keep to the directory's checks.** Files other than images and fonts stay at 256 KiB or less. No `.DS_Store`. In documents, point at a picture only with Markdown image syntax, and never write a picture's or an icon's path inside backticks or a code block. Do not use `options` in `userConfig` of `plugin.json` (list the values a setting takes in its description).
- When you change behavior, add a test that pins it, raise the version in `plugin.json`, and bring the three READMEs and this file in line with it (the version, the command and settings tables, "What this mod does on your machine"). The three READMEs keep the same sections, tables and facts. Do not write the number of tests into a document.
- Comments and test names are in English.

### Making the screenshots again

The pictures in the READMEs are not photographs of a screen. They are the output of a real session, run with `claude --plugin-dir .` in a terminal kept off screen (tmux, with `CLAUDE_CODE_TMUX_TRUECOLOR=1`) and captured with `tmux capture-pane -e -p`, then redrawn as pictures character for character and color for color. Each language has its own set, taken with the screen in that language (`/chiikawa lang <en|ko|ja>`, or the `language` setting). When you make them again, run in an example folder, replace the usage figures with example values, and crop so that no account detail, personal path or plan name is in a picture. Keep the file names the READMEs point to (working, pane, sheet, talk, role, band), each language in its own folder (en, ko, ja).
