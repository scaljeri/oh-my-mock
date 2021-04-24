import * as views from './views';

describe('Views', () => {
  let input;
  beforeEach(() => {
    input = [0, 3, 1, 2, 4, 5];
  });
  describe('#init', () => {
    it('should create a list with correct length and incremental values', () => {
      const output = views.init(input as any);
      expect(output).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe('#add', () => {
    it('should add new item at the beginning', () => {
      const output = views.add(3, input, 0);
      expect(output).toEqual([3, 0, 4, 1, 2, 5, 6]);
    });

    it('should add new item at the beginning without providing a position', () => {
      const output = views.add(3, input);
      expect(output).toEqual([3, 0, 4, 1, 2, 5, 6]);
    });

    it('should add new item at the correct position', () => {
      const output = views.add(3, input, 4);
      expect(output).toEqual([0, 4, 1, 2, 3, 5, 6]);
    });

    it('should add new item at the end if defined by position', () => {
      const output = views.add(3, input, 6);
      expect(output).toEqual([0, 4, 1, 2, 5, 6, 3]);
    });
  });
});
