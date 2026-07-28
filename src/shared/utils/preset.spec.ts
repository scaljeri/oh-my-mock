import { IData, IOhMyPresets, IOhMyRequests, IState } from '../type';
import { PresetUtils } from './preset';

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
    let input: IState;
    let inputRequests: IOhMyRequests;

    beforeEach(() => {
      input = {
        requests: ['qwerty'],
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

      ({ state, requests } = PresetUtils.delete(input, inputRequests, 'b'));
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
  });
});
