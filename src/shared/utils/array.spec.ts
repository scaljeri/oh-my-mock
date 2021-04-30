import { arrayAddItem, arrayMoveItem } from './array';

describe('Array utils', () => {
  let input;
  beforeEach(() => {
    input = [1, 2, 3, 4, 5];
  });

  describe('#move', () => {
    it('should move if from < to', () => {
      const output = arrayMoveItem(input, 1, 4);
      expect(output).toEqual([1, 3, 4, 5, 2])
    });

    it('should move if from > to', () => {
      const output = arrayMoveItem(input, 3, 1);
      expect(output).toEqual([1, 4, 2, 3, 5])
    });

    it('should do nothing if from === to', () => {
      const output = arrayMoveItem(input, 3, 3);
      expect(output).toEqual(input)
    });

    it('should append from element at the end if input.length < to', () => {
      const output = arrayMoveItem(input, 3, 7);
      expect(output).toEqual([1, 2, 3, 5, 4])
    });

    it('should do nothing if `from` is bigger than `input.length`', () => {
      const output = arrayMoveItem(input, 7, 1);
      expect(output).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('#arrayAddItem', () => {
    it('should add element in the middle', () => {
      const output = arrayAddItem<unknown>(input, 'x', 2);
      expect(output).toEqual([1, 2, 'x', 3, 4, 5]);
    });
    it('should add element in the begin', () => {
      const output = arrayAddItem<unknown>(input, 'x', 0);
      expect(output).toEqual(['x', 1, 2, 3, 4, 5]);
    });

    it('should add element in the end', () => {
      const output = arrayAddItem<unknown>(input, 'x', 5);
      expect(output).toEqual([1, 2, 3, 4, 5, 'x']);
    });

    it('should add element in the end if index is omitted', () => {
      const output = arrayAddItem<unknown>(input, 'x');
      expect(output).toEqual([1, 2, 3, 4, 5, 'x']);
    });
  });
});
