import { teamPairKey } from './team-name';

describe('teamPairKey', () => {
  it('produces the same key regardless of argument order', () => {
    expect(teamPairKey('a', 'b')).toBe(teamPairKey('b', 'a'));
  });

  it('orders the key with the lexicographically lower id first', () => {
    expect(teamPairKey('b', 'a')).toBe('a|b');
    expect(teamPairKey('a', 'b')).toBe('a|b');
  });

  it('joins the two ids with a pipe', () => {
    expect(teamPairKey('player-1', 'player-2')).toBe('player-1|player-2');
  });

  it('handles equal ids (degenerate case) without throwing', () => {
    expect(teamPairKey('a', 'a')).toBe('a|a');
  });
});
