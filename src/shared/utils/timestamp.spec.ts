import { timestamp } from './timestamp';

// 2021-11-13T14:56:10.352Z
describe('Utils/timestamp', () => {
  let ts: string;
  beforeEach(() => {
    ts = timestamp();
  });
  it('should generate a timestamp', () => {
    expect(ts.length).toBe(24);
  });

  it('should contain a T', () => {
    expect(!!ts.match(/T/)).toBeTruthy();
  });

  it('should end with a Z', () => {
    expect(!!ts.match(/Z$/)).toBeTruthy();
  });
})
