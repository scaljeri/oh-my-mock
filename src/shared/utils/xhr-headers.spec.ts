import { getHeaderKeys, getHeaderValues, parse, stringify } from "./xhr-headers";

describe('Utils/XhrHeaders', () => {
  let headersStr;

  beforeEach(() => {
    headersStr = `content-length: 345\r\ncontent-type: application/json; charset=utf-8\r\ndate: Sat, 13 Nov 2021 11:10:26 GMT\r\netag: W/"159-UDsqIzQL6Dpxgnp6vckXI4BKJ0Q"\r\nx-powered-by: Express\r\n`;
  });
  describe('#parse', () => {
    it('should parse the headers string', () => {
      const out = parse(headersStr);
      expect(out['content-length']).toBe('345');
      expect(out['content-type']).toBe('application/json; charset=utf-8');
      expect(out['x-powered-by']).toBe('Express');
    })
  });
  describe('#stringify', () => {
    let headers;
    beforeEach(() => {
      headers = { a: 10, b: 20 };
    });

    it('should stringify a header object', () => {
      const str = stringify(headers);
      expect(str).toBe(`a: 10\r\nb: 20\r\n`);
    });

    it ('should return empty string if no headers are provided', () => {
      const str = stringify(undefined);
      expect(str).toBe('');
    });
  });
  describe('#getHeaderKeys', () => {
    it('should extract all header keys', () => {
      const keys = getHeaderKeys(headersStr);
      expect(keys).toEqual([ 'content-length', 'content-type', 'date', 'etag', 'x-powered-by' ]);
    })
  });
  describe('#getHeaderValues', () => {
    it('should extract all header values', () => {
      const keys = getHeaderValues(headersStr);
      expect(keys).toEqual([ '345', 'application/json; charset=utf-8', 'Sat, 13 Nov 2021 11:10:26 GMT', 'W/"159-UDsqIzQL6Dpxgnp6vckXI4BKJ0Q', 'Express' ]);
    })
  });
});
