/*
A 'View' is a projection of `state.data`, so it is important that the view
correctly maps to its source of truth. But if a view gets itself in an
invalid state, the app will completely stop working, nothing, nada, noppus.
This, of course, shouldn't ever happen, but it does unfortunately.
As this issue is very hard to solve because it almost never happens, the
below validation should be used to validate the view until we are sure the
issue is solved.
*/
export const isViewValidate = (list: number[], source: unknown[]) => {
  const maxValue = source.length;

  // It should contain the correct number of values
  if (list.length !== maxValue) {
    return false;
  }

  // Does it contain duplicates
  if (maxValue > new Set(list).size) {
    return false;
  }

  // Does it contain values/indices outside
  if (list.some(v => v < 0 || v >= maxValue)) {
    return false;
  }

  return true;
}
