import { MOCK_JS_CODE, objectTypes } from '../constants';
import { MockUtils } from './mock';

describe('Utils/Response', () => {
  const initFn = MockUtils.init;

  beforeEach(() => {
    MockUtils.init = initFn;
  });

  describe('#init', () => {
    it('should create a response without params', () => {
      const response = MockUtils.init();
      expect(response).toEqual(expect.objectContaining({
        jsCode: MOCK_JS_CODE,
        delay: 0,
        id: expect.any(String),
        createdOn: expect.any(String),
        type: objectTypes.MOCK
      }));
    });

    it('should create a response with a base', () => {
      const response = MockUtils.init({ statusCode: 900, modifiedOn: '90', type: 'yolo' } as any);
      expect(response).toEqual(expect.objectContaining({
        statusCode: 900,
        modifiedOn: null,
        type: objectTypes.MOCK
      }));
    });

    it('should create a response with a base and update', () => {
      const response = MockUtils.init({ statusCode: 900, modifiedOn: '90', type: 'yolo' } as any, { type: 'xyz', statusCode: 1 } as any);
      expect(response).toEqual(expect.objectContaining({
        statusCode: 1,
        modifiedOn: null,
        type: 'xyz'
      }));
    });
  });
  describe('#clone', () => {
    it('should clone a response', () => {
      jest.spyOn(MockUtils, 'init');
      const b = { a: 1 };
      const c = { b: 2 };
      const output = MockUtils.clone(b as any, c as any);

      expect(output).toBeDefined();
      expect(MockUtils.init).toHaveBeenCalledWith(b, c);
    });
  });
  describe('#find', () => {
    let mocks;

    beforeEach(() => {
      mocks = {
        a: { statusCode: 200, id: 'a' },
        b: { statusCode: 200, label: 'yolo'},
        c: { statusCode: 300, label: 'yolo'}
      }
    });

    it('should find by id', () => {
      const out = MockUtils.find(mocks, { id: 'a'});
      expect(out).toBe(mocks.a);
    });

    it('should find by statuscode', () => {
      const out = MockUtils.find(mocks, { statusCode: 300});
      expect(out).toBe(mocks.c);
    });

    it('should find by statuscode and label', () => {
      const out = MockUtils.find(mocks, { statusCode: 200, label: 'yolo'});
      expect(out).toBe(mocks.b);
    });
  });
  describe('#createShallowMock', () => {
    it('should create a shallow response without label and mod date', () => {
      const sr = MockUtils.createShallowMock({ id: 'a', statusCode: 200 });

      expect(sr).toEqual({id: 'a', statusCode: 200});
    });

    it('should create a shallow response with label and mod date', () => {
      const sr = MockUtils.createShallowMock(
        { id: 'a', statusCode: 200, label: 'x', modifiedOn: 'now' });

      expect(sr).toEqual({id: 'a', statusCode: 200, label: 'x', modifiedOn: 'now'});
    });
   });
})
