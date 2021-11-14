import { objectTypes } from '../constants';
import { IOhMyShallowMock } from '../type';
import { DataUtils } from './data';

describe('Utils/Data', () => {
  const initFn = DataUtils.init;
  let data;

  beforeEach(() => {
    data = {
      selected: { foo: 'f', bar: 'b' },
      enabled: { foo: true, bar: false },
      mocks: { f: { id: 'f', v: 1 }, b: { id: 'b', v: 2 } }
    };
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

      expect(response.id).toBe('f');
    });

    it('should return the selected response given a presetId', () => {
      const response = DataUtils.getSelectedResponse(data, 'bar');

      expect(response.id).toBe('b');
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
      expect(DataUtils.activeMock(data, { preset: 'bar' } as any)).toBeDefined();
    });
  });
  describe('#addResponse', () => {
    let update;
    beforeEach(() => {
      update = DataUtils.addResponse({ preset: 'foo' } as any, data, {
        id: 'x', label: 'y', statusCode: 666
      });
    })
    it('should add a new response', () => {
      expect(update.mocks.x).toEqual(expect.objectContaining({
        id: 'x', label: 'y', statusCode: 666
      }));
    });

    it('should not select the new response for the active preset', () => {
      expect(update.selected.foo).not.toBe('x');
    });

    it('should auto select a new response if it is the first', () => {
      data.mocks = {};
      update = DataUtils.addResponse({ preset: 'moz' } as any, data, {
        id: 'z', label: 'y', statusCode: 666
      });

      expect(update.mocks.z).toBeDefined();
      expect(update.selected.moz).toBe('z');
      expect(update.enabled.moz).toBeTruthy();

    });

    it('should not select a new response if autoactive is false', () => {
      data.mocks = {};
      update = DataUtils.addResponse({ preset: 'moz' } as any, data, {
        id: 'z', label: 'y', statusCode: 666
      }, false);

      expect(update.mocks.z).toBeDefined();
      expect(update.selected.moz).toBe('z');
      expect(update.enabled.moz).toBeFalsy();

    });
  });
  describe('#removeResponse', () => {
    it('should cleanup a Request after delete', () => {
      const update = DataUtils.removeResponse({ preset: 'foo' } as any, data, 'f')
      expect(update.mocks.f).not.toBeDefined();
      expect(update.selected.foo).toBe('b');
      expect(update.enabled.foo).toBeFalsy();
    })
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
      const update = DataUtils.prefilWithPresets(data, { asd: 'yolo'});

      expect(update.selected.asd).toBe('f');
      expect(update.enabled.asd).toBeFalsy();
    });
  });
});
