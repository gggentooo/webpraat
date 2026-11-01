import { StreamLanguage, StringStream } from '@codemirror/language';

const KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'elsif',
  'elif',
  'endif',
  'fi',
  'for',
  'from',
  'to',
  'by',
  'endfor',
  'while',
  'endwhile',
  'repeat',
  'until',
  'procedure',
  'endproc',
  'call',
  'exitScript',
  'stop',
  'assert',
  'nocheck',
  'form',
  'endform',
  'real',
  'positive',
  'integer',
  'natural',
  'word',
  'sentence',
  'text',
  'boolean',
  'choice',
  'comment',
]);

const BUILTINS = new Set([
  'writeInfoLine',
  'writeInfo',
  'appendInfoLine',
  'appendInfo',
  'clearinfo',
  'echo',
  'selectObject',
  'plusObject',
  'minusObject',
  'removeObject',
  'selected',
  'selected$',
  'numberOfSelected',
  'Create',
  'Play',
  'Draw',
  'Get',
  'To',
  'Down',
  'View',
  'Edit',
  'print',
  'printline',
]);

const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'arcsin',
  'arccos',
  'arctan',
  'exp',
  'ln',
  'log10',
  'sqrt',
  'round',
  'floor',
  'ceiling',
  'abs',
  'min',
  'max',
  'randomUniform',
  'randomGauss',
  'length',
  'left$',
  'right$',
  'mid$',
  'startsWith',
  'endsWith',
  'replace$',
  'string$',
  'number',
  'fixed$',
  'percent$',
  'date$',
  'stopwatch',
]);

const ATOMS = new Set(['true', 'false', 'undefined']);

export const praatLanguage = StreamLanguage.define({
  name: 'praat',
  startState() {
    return {
      inComment: false,
    };
  },
  token(stream: StringStream) {
    // Skip spaces
    if (stream.eatSpace()) return null;

    const ch = stream.peek();

    // Comments (#, ;, !)
    if (ch === '#' || ch === ';' || ch === '!') {
      stream.skipToEnd();
      return 'comment';
    }

    // String literals
    if (ch === '"') {
      stream.next();
      while (!stream.eol()) {
        const nextChar = stream.next();
        if (nextChar === '"') {
          if (stream.peek() === '"') {
            stream.next(); // Escaped double quote ""
          } else {
            break;
          }
        }
      }
      return 'string';
    }

    // Variable substitutions with single quotes: 'variable' or 'variable$'
    if (ch === "'") {
      stream.next();
      if (stream.match(/^[a-zA-Z0-9_$.]+'/)) {
        return 'special';
      }
      return null;
    }

    // Numbers (integers, floats, scientific)
    if (stream.match(/^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/)) {
      return 'number';
    }

    // Identifiers & Keywords
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*[$#]?/)) {
      const word = stream.current();

      if (KEYWORDS.has(word)) return 'keyword';
      if (BUILTINS.has(word)) return 'builtin';
      if (FUNCTIONS.has(word)) return 'def';
      if (ATOMS.has(word)) return 'atom';

      return 'variableName';
    }

    // Operators
    if (stream.match(/^(:=|==|!=|<=|>=|<>|[+\-*\/^=<>|&!])/)) {
      return 'operator';
    }

    // Punctuation
    if (stream.match(/^[,:;()\[\]{}]/)) {
      return 'punctuation';
    }

    // Advance 1 character if nothing else matched
    stream.next();
    return null;
  },
});
