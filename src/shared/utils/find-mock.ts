export const findActiveData = (state, url, method, type) => {
  const data = (state?.data || []).find(item => {
    return method === item.method && type === item.type && item.activeStatusCode &&
      url.match(new RegExp(item.url));
  });

  if (!data) {
    return null;
  }

  return data;
}
