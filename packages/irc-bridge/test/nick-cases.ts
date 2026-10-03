/**
 * Projected-nick cases (ADR-007), shared by the bridge's test/channels.test.ts
 * and the api's test/nicks.test.ts. The two packages each check nicks, and must
 * agree: an api that accepted what the bridge refuses would 503 a valid-looking
 * set. Not a *.test.ts file, so importing it registers no tests.
 */
export const VALID_NICKS = ['kai', 'Kai_', 'a', '[away]', 'foo|bar', 'x^y', 'n-1', '1abc', 'a'.repeat(32)];
export const INVALID_NICKS = [
  '',
  'two words',
  'a,b',
  ':kai',
  'kai!x@y',
  'k@i',
  'ka*',
  'ka?',
  'kai\r\nKICK #c-1 x',
  'kai\u0000',
  'kaïi',
  'a'.repeat(33),
];

