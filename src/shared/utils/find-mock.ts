export const findMock = (state, url, method, type, statusCode = null) => {
  const urlRe = new RegExp(url);
  const responses = (state?.responses || []).find(resp => {
    return method === resp.method && type === resp.method && resp.url.match(urlRe);
  });

  if (!responses) {
    return null;
  }

  const sc = Object.keys(responses.mocks).find(k => {
    return statusCode === k || !statusCode && responses.mock[k].enabled;
  });

  return responses.mock[sc];
}
