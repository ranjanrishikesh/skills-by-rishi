#!/usr/bin/env node
// agentclaw pre-publish gate, ADVISORY half.
//
// Registered as a PreToolUse(Bash) hook. It guesses from the command string
// whether a publish is about to happen, and if so runs the same checks the
// pre-push hook runs, so an agent is told before it wastes a round trip.
//
// IT IS NOT THE ENFORCEMENT POINT, and must not be treated as one.
// .githooks/pre-push is. Git invokes that on the real publish, after the shell
// has resolved quoting, command substitution, heredocs, aliases and escapes,
// so it cannot be fooled by spelling.
//
// That demotion was earned. Three review cycles each found a NEW way past this
// string matcher, every one verified executing for real:
//   - command substitution inside a double-quoted argument
//   - a heredoc body whose apostrophe paired with a later one, erasing the push
//   - a backslash-escaped command name, the standard alias-bypass idiom
//   - ANSI-C $'...' quoting
//   - a branch name containing a keyword the exclusion list matched as a bare
//     substring, which exempted a genuine publish
// The lesson is not "write a better regex". You cannot decide what a shell will
// do by pattern-matching its text. So this became a hint, and the real check
// moved to where git tells us the truth.
//
// This hook still matters for one thing no git hook sees: `gh pr create`.
//
// Both entry points call runChecks() from publish-checks.mjs, so their verdicts
// cannot disagree.

import { readFileSync } from 'node:fs';
import { runChecks, formatBlock, formatContainerNotice } from './publish-checks.mjs';

function allow() { process.exit(0); }

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// 1. Read the PreToolUse payload from stdin.
let payload = {};
try {
  const raw = readFileSync(0, 'utf8');
  payload = raw ? JSON.parse(raw) : {};
} catch { allow(); }

const toolName = payload.tool_name || '';
const command = (payload.tool_input && payload.tool_input.command) || '';
if (toolName !== 'Bash') allow();

// 2. Blank out quoted spans so quoted text is not read as a command.
//
// A left-to-right scan, not a regex pair: a regex pairs apostrophes
// positionally, so an apostrophe inside a double-quoted string pairs with the
// next one anywhere on the line and eats everything between, silently
// swallowing a real publish.
//
// Outside quotes a backslash escapes the next character, so the BACKSLASH is
// dropped and the character is KEPT. Dropping both turned an escaped command
// name into an unrecognisable fragment that matched nothing.
// Quoting a word does not stop the shell from running it: `gh $'pr' create`,
// `gh 'pr' create` and `gh pr create` are the same command. Blanking every
// quoted span therefore erased the very tokens being matched. But keeping every
// span would make `echo "git push"` look like a publish.
//
// The distinguishing signal is whitespace. A quoted span with no whitespace is
// a quoted WORD, which the shell concatenates into the command, so keep it. A
// span containing whitespace is a message or a multi-word argument, so drop it.
//
// This is a heuristic and it is allowed to be, because this hook is advisory.
// `git push` is backstopped by .githooks/pre-push regardless of spelling. The
// reason it is worth getting close is `gh pr create`, which no git hook sees.
function stripQuoted(str) {
  let out = '', quote = null, buf = '';
  const closeSpan = () => {
    if (!/\s/.test(buf)) out += buf;   // quoted word: the shell runs it
    buf = '';                          // otherwise it was an argument
  };
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote) {
      if (c === '\\' && quote === '"') { i++; continue; }
      if (c === quote) { quote = null; closeSpan(); continue; }
      buf += c;
      continue;
    }
    if (c === '\\') {                             // escape outside quotes
      const next = str[i + 1];
      if (next !== undefined) out += next;        // keep the escaped character
      i++;
      continue;
    }
    // ANSI-C quoting: $'...' is its own form, and expands to a bare word.
    if (c === '$' && str[i + 1] === "'") { quote = "'"; i++; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    out += c;
  }
  return quote ? str : out;   // unbalanced quoting is ambiguous: fail closed
}

// Heredoc bodies and shell comments are text, not commands, but the scanner
// had no model for either. Writing a file whose body mentions a publish, or
// appending to this repo's own CLAUDE.md (which literally contains the line
// "Only then `gh pr create`"), was classified as a publish attempt and blocked.
// That fired repeatedly during this project's own development.
function stripInertText(str) {
  const out = [];
  let heredocEnd = null;
  for (const line of str.split('\n')) {
    if (heredocEnd !== null) {
      if (line.trim() === heredocEnd) heredocEnd = null;
      continue;                                  // drop the body entirely
    }
    const hd = line.match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/);
    if (hd) heredocEnd = hd[1];
    // A comment runs to end of line. Only treat # as a comment opener at the
    // start of the line or after whitespace, so it does not eat a URL fragment.
    out.push(line.replace(/(^|\s)#.*$/, '$1'));
  }
  return out.join('\n');
}

const scan = stripQuoted(stripInertText(command));

// 3. Anchor to SUBCOMMAND POSITION rather than excluding keywords.
//
// The previous attempt kept a list of words meaning "not a publish" and matched
// them anywhere in the segment, so a branch name containing one of those words
// exempted a genuine publish. Requiring the subcommand to sit right after git's
// own global flags is exact rather than heuristic, and it removes the need to
// enumerate `stash`, `grep`, `log`, `config` and `remote` at all: those simply
// have a different subcommand.
const GIT_GLOBAL_FLAG = String.raw`(?:-[Cc]\s+\S+|--[A-Za-z-]+=\S+|-{1,2}[A-Za-z-]+)`;
// Case-insensitive: PATH lookup is case-insensitive on macOS and Windows, so
// `GIT push` invokes the real binary and really publishes.
const IS_GIT_PUBLISH = new RegExp(String.raw`\bgit\b(?:\s+${GIT_GLOBAL_FLAG})*\s+push\b`, 'i');
const IS_GH_PUBLISH = new RegExp(String.raw`\bgh\b(?:\s+\S+)*?\s+pr\s+create\b`, 'i');

if (!IS_GIT_PUBLISH.test(scan) && !IS_GH_PUBLISH.test(scan)) allow();

// 4. Run the shared checks. Same code path as pre-push, so no disagreement.
const result = runChecks(process.env.CLAUDE_PROJECT_DIR || process.cwd());

if (result.ok) {
  // Must go to stdout as JSON. PreToolUse discards stderr entirely on exit 0,
  // so a stderr-only notice meant the agent that just published had no signal
  // at all that what it shipped was unreviewed.
  const systemMessage = result.waived
    ? 'REVIEW WAIVED: this change set was NOT reviewed. A waiver was recorded at explicit user request. Say so when reporting what you published.'
    : formatContainerNotice(result);
  if (systemMessage) process.stdout.write(JSON.stringify({ systemMessage }));
  allow();
}

deny(formatBlock(result));
