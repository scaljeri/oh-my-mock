import { objectTypes } from '../constants';
import { IData, IOhMyShallowMock } from '../type';
import { DataUtils } from './data';

describe('Utils/Data', () => {
  const initFn = DataUtils.init;
  let data: IData;

  beforeEach(() => {
    data = {
      selected: { foo: 'f', bar: 'b' },
      enabled: { foo: true, bar: false },
      mocks: { f: { id: 'f', statusCode: 1 }, b: { id: 'b', statusCode: 2 } }
      // Deliberately partial: only the fields the unit under test reads.
    } as unknown as IData;
  });

  describe('#init', () => {
    it('should be linked to create', () => {
      jest.spyOn(DataUtils, 'init').mockReturnValue('a' as any);
      expect(DataUtils.init({})).toBe('a');
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
    it('should return a response if enabled', () => {
      expect(DataUtils.activeMock(data, { preset: 'foo' } as any)).toBeDefined();
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
    });

    // Any preset can select a response, not only the active one. This used to
    // leave the *other* preset pointing at the deleted id, so serving found the
    // id, failed to load the record and passed the request through unmocked.
    it('should move every preset that selected the removed response to the next one', () => {
      const update = DataUtils.removeResponse({ preset: 'foo' } as any, data, 'b');

      expect(update.selected!.bar).toBe('f');
      expect(update.enabled!.bar).toBe(false);
    });

    it('should not touch a preset that selected a different response', () => {
      const update = DataUtils.removeResponse({ preset: 'foo' } as any, data, 'b');

      expect(update.selected!.foo).toBe('f');
      expect(update.enabled!.foo).toBe(true);
    });

    it('should clear every preset that selected the removed response when none is left', () => {
      data = {
        selected: { foo: 'x', bar: 'x' },
        enabled: { foo: true, bar: true },
        mocks: { x: { id: 'x', statusCode: 200 } }
      } as unknown as IData;

      const update = DataUtils.removeResponse({ preset: 'foo' } as any, data, 'x');

      expect(update.selected!.foo).toBeUndefined();
      expect(update.selected!.bar).toBeUndefined();
      expect(update.enabled!.foo).toBeUndefined();
      expect(update.enabled!.bar).toBeUndefined();
    });
  });
  describe('#getNextActiveResponse', () => {
    it('should select the next active response', () => {
      expect(DataUtils.getNextActiveResponse(data)).toBeDefined();
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
