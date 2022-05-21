async function loadData(fname): Promise<unknown> {
  return {
    "requests": [
      {
        "id": "zborm2g4g4",
        "lastHit": 1648411105428,
        "method": "GET",
        "mocks": {
          "tzrvoyctex": {
            "id": "tzrvoyctex",
            "label": "",
            "statusCode": 200
          }
        },
        "requestType": "FETCH",
        "type": "request",
        "url": "/users",
        "version": "3.3.5"
      }
    ],
    "responses": [
      {
        "createdOn": "2022-03-27T19:57:39.013Z",
        "delay": 0,
        "domains": [
          "localhost:8000"
        ],
        "headers": {
          "content-length": "341",
          "content-type": "application/json; charset=utf-8",
          "date": "Sun, 27 Mar 2022 19:57:39 GMT",
          "etag": "W/\"155-ijaYXYvIv0CinUuvNl4UaYXfxEQ\"",
          "x-powered-by": "Express"
        },
        "headersMock": {
          "content-length": "341",
          "content-type": "application/json; charset=utf-8",
          "date": "Sun, 27 Mar 2022 19:57:39 GMT",
          "etag": "W/\"155-ijaYXYvIv0CinUuvNl4UaYXfxEQ\"",
          "x-powered-by": "Express"
        },
        "id": "tzrvoyctex",
        "jsCode": "/* This is where OhMyMock creates responses.\nInside this sandbox you have access to the following data:\n  * 'mock' - object with a cached response, header and status code\n  * 'request' - details of the ongoing request\n  * Feel free to use fetch or XMLHttpRequest, but make sure to\n    return a PROMISE in that case!!\n\n- Synchronous example:\n    const response = JSON.parse(mock.response);\n    response[1].name = \"Sync example\";\n    mock.response = JSON.stringify(response);\n    return mock;\n\n- Asynchronous example:\n\n    const response = await fetch(\"/users\");\n    const data = await response.json();\n    data[1].name = \"From custom code\";\n    mock.response = JSON.stringify(r);\n\n    // No need to return a Promise here, \"await\" takes care o this!\n    return mock;\n*/\n\nreturn mock;\n",
        "label": "",
        "modifiedOn": null,
        "origin": "local",
        "response": "{\n  \"1\": {\n    \"name\": \"bar Foo\",\n    \"password\": \"password----\",\n    \"profession\": \"king\",\n    \"id\": 1\n  },\n  \"2\": {\n    \"name\": \"rob kendal\",\n    \"password\": \"password3\",\n    \"profession\": \"code fiddler\",\n    \"id\": 2\n  },\n  \"3\": {\n    \"name\": \"teresa may\",\n    \"password\": \"password2\",\n    \"profession\": \"brexit destroyer\",\n    \"id\": 6\n  }\n}\n",
        "responseMock": "{\n    \"1\": {\n        \"name\": \"bar Foo 2\",\n        \"password\": \"passwordxyz\",\n        \"profession\": \"king\",\n        \"id\": 1\n    },\n    \"2\": {\n        \"name\": \"rob kendal\",\n        \"password\": \"password3\",\n        \"profession\": \"code fiddler\",\n        \"id\": 2\n    },\n    \"3\": {\n        \"name\": \"teresa may\",\n        \"password\": \"password2\",\n        \"profession\": \"brexit destroyer\",\n        \"id\": 6\n    }\n}",
        "rules": [],
        "statusCode": 300,
        "type": "response",
        "version": "3.3.6-beta.110"
      }
    ],
    "version": "3.3.5"
  };
}

export async function populateOhMyMock(filename: string, page): Promise<void> {
  const data = await loadData(filename);

  await page.evaluate(async (json) => {
    let shouldResolve = false;
    return new Promise(resolve => {
      window.addEventListener('message', e => {
        if (e.data.source !== 'content') {
          return;
        }

        if (shouldResolve) {
          return resolve(null);
        }
        shouldResolve = true;

        // window['OhMyMock'].api.upsert(json).then(resolve);
        window.postMessage({
          source: 'external',
          payload: {
            type: 'upsert',
            context: { domain:  window.location.host },
            data: json
          }
        }, '*')
      });

      window.postMessage({
        source: 'external',
        payload: {
          type: 'settings',
          context: { domain: window.location.host },
          data: { active: true }
        },
      }, '*');
    });
  }, data);
}
