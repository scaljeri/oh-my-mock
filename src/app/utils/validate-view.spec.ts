import { isViewValidate } from './validate-view';

describe('Validate View', () => {
  const source = ['a', 'b', 'c', 'd', 'e'];
  it('should pass a valid view', () => {
    expect(isViewValidate([4, 2, 3, 0, 1], source)).toBeTruthy();
  });

  it('should fail if the lengths mismatch', () => {
    expect(isViewValidate([0, 4, 3, 0], source)).toBeFalsy();
  });

  it('should fail if it contains a duplicate', () => {
    expect(isViewValidate([0, 4, 3, 0, 1], source)).toBeFalsy();
  });

  it('should fail if a value is outside the range', () => {
    expect(isViewValidate([0, 4, 3, 6, 1], source)).toBeFalsy();
  });


  it('should fail if a value is negative', () => {
    expect(isViewValidate([0, 4, -1, 2, 3], source)).toBeFalsy();
  });
});
