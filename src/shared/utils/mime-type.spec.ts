import * as MimeType from './mime-type';
describe('Utils/MimeType', () => {
  let mt: string;

  beforeEach(() => {
    mt = 'application/json; charset=utf-8';
  });

  it('should split', () => {
    expect(MimeType.splitMimeType(mt)).toEqual({ mimeType: 'application', mimeSubType: 'json' });
  });

  it('should detect a json mime type', () => {
    expect(MimeType.isMimeTypeJSON(mt)).toBeTruthy();
  });

  it('should detect if it is not json', () => {
    expect(MimeType.isMimeTypeJSON('image/svg+xml')).toBeFalsy();
  });

  it('should detect if it is not json', () => {
    expect(MimeType.extractMimeType(mt)).toBe('json');
  });

  it('should cleanup', () => {
    expect(MimeType.strip(mt)).toBe('application/json');
  });

  it('should cleanup', () => {
    expect(MimeType.update(mt, 'x/y')).toBe('x/y; charset=utf-8');
  });
});
