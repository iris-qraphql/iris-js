import { Lexer, TokenKind } from 'graphql';

const isPunctuatorTokenKind = (kind: TokenKind): boolean =>
  kind === TokenKind.BANG ||
  kind === TokenKind.DOLLAR ||
  kind === TokenKind.AMP ||
  kind === TokenKind.PAREN_L ||
  kind === TokenKind.PAREN_R ||
  kind === TokenKind.SPREAD ||
  kind === TokenKind.COLON ||
  kind === TokenKind.EQUALS ||
  kind === TokenKind.AT ||
  kind === TokenKind.BRACKET_L ||
  kind === TokenKind.BRACKET_R ||
  kind === TokenKind.BRACE_L ||
  kind === TokenKind.PIPE ||
  kind === TokenKind.BRACE_R;

export { Lexer, isPunctuatorTokenKind };
