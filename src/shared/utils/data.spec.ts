import { objectTypes } from '../constants';
import { IData, IOhMyShallowMock } from '../type';
import { DataUtils } from './data';

describe('Utils/Data', () => {
  let data: IData;

  beforeEach(() => {
    data = {
      selected: { foo: 'f', bar: 'b' },
      enabled: { foo: true, bar: false },
      mocks: { f: { id: 'f', statusCode: 1 }, b: { id: 'b', statusCode: 2 } }
      // Deliberately partial: only the fields the unit under test reads.
    } as unknown as IData;
  });

  // Spies on `DataUtils` statics stick to the shared class object — leaving one
  // behind poisons every suite that runs after this file.
  afterEach(() => jest.restoreAllMocks());

  describe('#init', () => {
    // This used to mock `init` and assert the mock — green no matter what the
    // real `init` did. The claim is delegation, so the spy calls through and
    // the *real* result is asserted alongside it.
    it('delegates to create, normalisation included', () => {
      const create = jest.spyOn(DataUtils, 'create');

      const request = DataUtils.init({ url: 'a.b/c' });

      expect(create).toHaveBeenCalledWith({ url: 'a.b/c' });
      expect(request).toEqual(expect.objectContaining({
        id: expect.any(String),
        type: objectTypes.REQUEST,
        url: 'a\\.b/c'
      }));
    })
  });
  describe('#getSelectedResponse', () => {
    it('should return the selected response given a context', () => {
      const response = DataUtils.getSelectedResponse(data,
        { preset: 'foo' } as any);

      expect(response!.id).toBe('f');
    });

    it('should return the selected response given a presetId', () => {
      const response = DataUtils.getSelectedResponse(data, 'bar');

      expect(response!.id).toBe('b');
    });
  });
  describe('#isSPresetEnabled', () => {
    it('should return falsy if diabled', () => {
      const isEnabled = DataUtils.isSPresetEnabled(data, { preset: 'bar' } as any);
      expect(isEnabled).toBeFalsy();
    });
  });
  describe('#activeMock', () => {
    // *Which* mock is the whole claim — `toBeDefined()` passed just as happily
    // for the wrong preset's selection.
    it('should return the selected response of the enabled preset', () => {
      expect(DataUtils.activeMock(data, { preset: 'foo' } as any)).toBe('f');
    });

    it('should return nothing if disabled', () => {
      expect(DataUtils.activeMock(data, { preset: 'bar' } as any)).toBeUndefined();
    });
  });
  describe('#addResponse', () => {
    let update: Partial<IData>;
    beforeEach(() => {
      update = DataUtils.addResponse({ preset: 'foo' } as any, data, {
        id: 'x', label: 'y', statusCode: 666
      });
    })
    it('should add a new response', () => {
      expect(update.mocks!.x).toEqual(expect.objectContaining({
        id: 'x', label: 'y', statusCode: 666
      }));
    });

    it('should not select the new response for the active preset', () => {
      expect(update.selected!.foo).not.toBe('x');
    });

    it('should auto select a new response if it is the first', () => {
      data.mocks = {};
      update = DataUtils.addResponse({ preset: 'moz' } as any, data, {
        id: 'z', label: 'y', statusCode: 666
      });

      expect(update.mocks!.z).toBeDefined();
      expect(update.selected!.moz).toBe('z');
      expect(update.enabled!.moz).toBeTruthy();

    });

    it('should not select a new response if autoactive is false', () => {
      data.mocks = {};
      update = DataUtils.addResponse({ preset: 'moz' } as any, data, {
        id: 'z', label: 'y', statusCode: 666
      }, false);

      expect(update.mocks!.z).toBeDefined();
      expect(update.selected!.moz).toBe('z');
      expect(update.enabled!.moz).toBeFalsy();

    });
  });
  describe('#removeResponse', () => {
    it('should cleanup a Request after delete', () => {
      const update = DataUtils.removeResponse({ preset: 'foo' } as any, data, 'f')
      expect(update.mocks!.f).not.toBeDefined();
      expect(update.selected!.foo).toBe('b');
      expect(update.enabled!.foo).toBeFalsy();
    })
  });
  describe('#getNextActiveResponse', () => {
    // Insertion order deliberately disagrees with status order: an
    // implementation answering "the first mock" instead of "the lowest status
    // code" must fail here, which `toBeDefined()` on the shared fixture never
    // could.
    it('should select the response with the lowest status code', () => {
      const outOfOrder = {
        mocks: {
          f: { id: 'f', statusCode: 500 },
          b: { id: 'b', statusCode: 200 }
        }
      } as unknown as IData;

      expect(DataUtils.getNextActiveResponse(outOfOrder)!.id).toBe('b');
    });

    it('should return nothing when no mocks are left', () => {
      data.mocks = {};

      expect(DataUtils.getNextActiveResponse(data)).toBeUndefined();
    });
  });
  describe('#create', () => {
    it('should create a request', () => {
      const req = DataUtils.create({
        type: 'b' as any, url: 'a.b/c'
      });

      expect(req).toEqual(expect.objectContaining({
        id: expect.any(String),
        enabled: {},
        selected: {},
        mocks: {},
        type: objectTypes.REQUEST,
        url: 'a\\.b/c'
      }));
    });
  });
  describe('#statusCodeSort', () => {
    it('should sort low to high', () => {
      const output = [{ statusCode: 300 }, { statusCode: 200 }].sort(DataUtils.statusCodeSort) as IOhMyShallowMock[];
      expect(output[0].statusCode).toBe(200);
      expect(output[1].statusCode).toBe(300);
    })
  });
  describe('#prefilWithPresets', () => {
    it('should init with new preset', () => {
      const update = DataUtils.prefillWithPresets(data, { asd: 'yolo'});

      expect(update.selected!.asd).toBe('f');
      expect(update.enabled!.asd).toBeFalsy();
    });
  });
});
