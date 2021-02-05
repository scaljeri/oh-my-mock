import { PrettyPrintPipe } from './pretty-print.pipe';

describe('PrettyPrintPipe', () => {
  it('create an instance', () => {
    const pipe = new PrettyPrintPipe();
    expect(pipe).toBeTruthy();
  });
});
