import { IData, IOhMyCookie, IOhMyPresets, IOhMyRequests, IState } from '../type';
import { IOhMyCookieRecords, PresetUtils } from './preset';

describe('Utils/Preset', () => {
  let presets: IOhMyPresets;
  beforeEach(() => {
    presets = {
      a: '1',
      b: '2',
      c: '3',
    }
  });

  describe('#add', () => {
    it('should not add an existing label', () => {
      const update = PresetUtils.add(presets, 'x', '2');

      expect(Object.keys(update).length).toBe(3);
      expect(update.x).not.toBeDefined();
      expect(update).toBe(presets);
    });

    it('should add an new label', () => {
      const update = PresetUtils.add(presets, 'x', '4');

      expect(Object.keys(update).length).toBe(4);
      expect(update.x).toBeDefined();
    });

  });
  describe('#findId', () => {
    it('should return undefined if not found', () => {
      expect(PresetUtils.findId(presets, '-')).toBeUndefined();
    });

    it('should return an id', () => {
      expect(PresetUtils.findId(presets, '2')).toBe('b');
    });
  });
  describe('#create', () => {
    it('should create a copy', () => {
      const np = PresetUtils.create(presets, 'b');
      expect(np).toEqual(expect.objectContaining({
        id: expect.any(String),
        value: 'b copy'
      }));
    });

    it('should increment copy number if it exists', () => {
      presets.x = 'b copy';
      presets.y = 'b copy 1';
      const np = PresetUtils.create(presets, 'b copy');
      expect(np).toEqual(expect.objectContaining({
        id: expect.any(String),
        value: 'b copy 2'
      }));
    });

    it('should add if label is empty', () => {
      const np = PresetUtils.create(presets, '');
      expect(np).toEqual(expect.objectContaining({
        id: expect.any(String),
        value: 'New Preset'
      }));
    });

    it('should increment copy number if it exists', () => {
      presets.x = 'New Preset';
      presets.y = 'New Preset copy';
      const np = PresetUtils.create(presets, '');
      expect(np).toEqual(expect.objectContaining({
        id: expect.any(String),
        value: 'New Preset copy 1'
      }));
    });
  });
  describe('#update', () => {
    it('shoud add a new preset', () => {
      const p = PresetUtils.update('x', 'z', presets);
      expect(Object.keys(p).length).toBe(4);
      expect(p.x).toBe('z');
    });
  });
  describe('#delete', () => {
    let state: IState;
    let requests: IOhMyRequests;
    let cookies: IOhMyCookieRecords;
    let input: IState;
    let inputRequests: IOhMyRequests;
    let inputCookies: IOhMyCookieRecords;

    beforeEach(() => {
      input = {
        requests: ['qwerty'],
        cookies: ['c1', 'c2'],
        context: { preset: 'b' },
        presets: { a: '1', b: '2' }
      } as unknown as IState;
      inputRequests = {
        qwerty: {
          id: 'qwerty',
          enabled: { a: false, b: true },
          selected: { a: '123', b: '456' }
        } as unknown as IData
      };
      inputCookies = {
        c1: { id: 'c1', name: 'session', enabled: { a: true, b: true } } as unknown as IOhMyCookie,
        c2: { id: 'c2', name: 'other', enabled: { a: true } } as unknown as IOhMyCookie
      };

      ({ state, requests, cookies } = PresetUtils.delete(input, inputRequests, inputCookies, 'b'));
    });

    it('should remove the preset from the preset list', () => {
      expect(state.presets.b).toBeUndefined();
    });

    it('should remove a preset from the context', () => {
      expect(state.context.preset).toBeUndefined();
    });

    it('should remove the preset from the requests', () => {
      expect(requests.qwerty.enabled.b).toBeUndefined();
      expect(requests.qwerty.selected.b).toBeUndefined();
    });

    it('should not modify the requests it was given', () => {
      expect(inputRequests.qwerty.enabled.b).toBe(true);
    });

    // Not removed: the cookie write channel merges `enabled` per key, so an
    // absent key would be resurrected from the stored record on the way back.
    // `false` survives the merge and reads the same as absent everywhere.
    it('should switch the preset off on every cookie that knew it', () => {
      expect(cookies.c1.enabled.b).toBe(false);
      expect(cookies.c1.enabled.a).toBe(true);
    });

    it('should keep the identity of a cookie the preset never touched', () => {
      expect(cookies.c2).toBe(inputCookies.c2);
    });

    it('should not modify the cookies it was given', () => {
      expect(inputCookies.c1.enabled.b).toBe(true);
    });
  });
});
