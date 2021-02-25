export const mockStatusCodeFn = function (url: string, method: string, statusCode): number {
    const mock = this.state?.urls[url] || {};
    return (mock.isStatusCodeActive ? mock?.statusCodes : null) || statusCode;
  }
