import { StatusCodeTonePipe } from './status-code-tone.pipe';

describe('StatusCodeTonePipe', () => {
  const pipe = new StatusCodeTonePipe();

  it('reads 2xx as success', () => {
    expect(pipe.transform(200)).toBe('success');
    expect(pipe.transform(201)).toBe('success');
    expect(pipe.transform(204)).toBe('success');
  });

  it('reads 3xx as a redirect', () => {
    expect(pipe.transform(301)).toBe('warning');
    expect(pipe.transform(304)).toBe('warning');
  });

  it('reads 4xx and 5xx as failures', () => {
    expect(pipe.transform(400)).toBe('danger');
    expect(pipe.transform(404)).toBe('danger');
    expect(pipe.transform(500)).toBe('danger');
  });

  it('treats the boundaries as the design does', () => {
    expect(pipe.transform(299)).toBe('success');
    expect(pipe.transform(300)).toBe('warning');
    expect(pipe.transform(399)).toBe('warning');
    expect(pipe.transform(400)).toBe('danger');
  });

  // A mock with no status code yet is shown greyed out rather than as an error.
  it('has no opinion without a code', () => {
    expect(pipe.transform(null)).toBe('muted');
    expect(pipe.transform(undefined)).toBe('muted');
    expect(pipe.transform(NaN)).toBe('muted');
  });
});
