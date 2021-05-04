import { DEMO_TEST_DOMAIN } from './constants';
import { IState } from './type';

export const testDataMock: IState = {
  views: {
    "hits": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    "normal": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  },
  toggles: {},
  "data": [
    {
      "id": "a",
      "url": "/users",
      "type": "XHR",
      "method": "GET",
      "mocks": {
        "200": {
          "jsCode": "\n",
          "delay": 0,
          "response": "{\n  \"1\": {\n    \"name\": \"king arthur\",\n    \"password\": \"password1\",\n    \"profession\": \"king\",\n    \"id\": 1\n  },\n  \"2\": {\n    \"name\": \"rob kendal\",\n    \"password\": \"password3\",\n    \"profession\": \"code fiddler\",\n    \"id\": 2\n  },\n  \"3\": {\n    \"name\": \"teresa may\",\n    \"password\": \"password2\",\n    \"profession\": \"brexit destroyer\",\n    \"id\": 6\n  }\n}\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "345",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:16 GMT",
            "etag": "W/\"159-x02NuvXuvjwBAxeFVEry8Rh2ALA\"",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:16.135Z",
          "responseMock": "{\n  \"1\": {\n    \"name\": \"king arthur\",\n    \"password\": \"password1\",\n    \"profession\": \"king\",\n    \"id\": 1\n  },\n  \"2\": {\n    \"name\": \"rob kendal\",\n    \"password\": \"password3\",\n    \"profession\": \"code fiddler\",\n    \"id\": 2\n  },\n  \"3\": {\n    \"name\": \"teresa may\",\n    \"password\": \"password2\",\n    \"profession\": \"brexit destroyer\",\n    \"id\": 6\n  }\n}\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "345",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:16 GMT",
            "etag": "W/\"159-x02NuvXuvjwBAxeFVEry8Rh2ALA\"",
            "x-powered-by": "Express"
          },
          "type": "application",
          "subType": "json"
        }
      },
      "activeStatusCode": 200
    },
    {
      "id": "b",
      "url": "/site",
      "type": "XHR",
      "method": "GET",
      "mocks": {
        "200": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<h1>Yolo</h1>\n",
          "headers": {
            "content-length": "14",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:30 GMT",
            "etag": "W/\"e-BnDCkeJVC9Hva7UP+CBhsU1G7Os\"",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:30.659Z",
          "responseMock": "<h1>Yolo</h1>\n",
          "headersMock": {
            "content-length": "14",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:30 GMT",
            "etag": "W/\"e-BnDCkeJVC9Hva7UP+CBhsU1G7Os\"",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 200
    },
    {
      "id": "c",
      "url": "/site",
      "type": "XHR",
      "method": "POST",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /site</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:39 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:39.049Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /site</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:39 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "d",
      "url": "/users",
      "type": "XHR",
      "method": "POST",
      "mocks": {
        "200": {
          "jsCode": "\n",
          "delay": 0,
          "response": "{\"msg\":\"success\"}",
          "headers": {
            "connection": "keep-alive",
            "content-length": "17",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:42 GMT",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:42.966Z",
          "responseMock": "{\"msg\":\"success\"}",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "17",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:42 GMT",
            "x-powered-by": "Express"
          },
          "type": "application",
          "subType": "json"
        }
      },
      "activeStatusCode": 200
    },
    {
      "id": "e",
      "url": "/users",
      "type": "XHR",
      "method": "PUT",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /users</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:46 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:46.238Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /users</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:46 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "f",
      "url": "/site",
      "type": "XHR",
      "method": "PUT",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /site</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "143",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:49 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:49.248Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /site</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "143",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:49 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "g",
      "url": "/site",
      "type": "XHR",
      "method": "DELETE",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /site</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "146",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:53 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:53.924Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /site</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "146",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:53 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "h",
      "url": "/users",
      "type": "XHR",
      "method": "DELETE",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /users</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "147",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:57 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:14:57.841Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /users</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "147",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:14:57 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "i",
      "url": "/users",
      "type": "FETCH",
      "method": "GET",
      "mocks": {
        "200": {
          "jsCode": "\n",
          "delay": 0,
          "response": "{\n  \"1\": {\n    \"name\": \"king arthur\",\n    \"password\": \"password1\",\n    \"profession\": \"king\",\n    \"id\": 1\n  },\n  \"2\": {\n    \"name\": \"rob kendal\",\n    \"password\": \"password3\",\n    \"profession\": \"code fiddler\",\n    \"id\": 2\n  },\n  \"3\": {\n    \"name\": \"teresa may\",\n    \"password\": \"password2\",\n    \"profession\": \"brexit destroyer\",\n    \"id\": 6\n  }\n}\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "345",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:03 GMT",
            "etag": "W/\"159-x02NuvXuvjwBAxeFVEry8Rh2ALA\"",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:03.483Z",
          "responseMock": "{\n  \"1\": {\n    \"name\": \"king arthur\",\n    \"password\": \"password1\",\n    \"profession\": \"king\",\n    \"id\": 1\n  },\n  \"2\": {\n    \"name\": \"rob kendal\",\n    \"password\": \"password3\",\n    \"profession\": \"code fiddler\",\n    \"id\": 2\n  },\n  \"3\": {\n    \"name\": \"teresa may\",\n    \"password\": \"password2\",\n    \"profession\": \"brexit destroyer\",\n    \"id\": 6\n  }\n}\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "345",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:03 GMT",
            "etag": "W/\"159-x02NuvXuvjwBAxeFVEry8Rh2ALA\"",
            "x-powered-by": "Express"
          },
          "type": "application",
          "subType": "json"
        }
      },
      "activeStatusCode": 200
    },
    {
      "id": "j",
      "url": "/site",
      "type": "FETCH",
      "method": "GET",
      "mocks": {
        "200": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<h1>Yolo</h1>\n",
          "headers": {
            "content-length": "14",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:07 GMT",
            "etag": "W/\"e-BnDCkeJVC9Hva7UP+CBhsU1G7Os\"",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:07.641Z",
          "responseMock": "<h1>Yolo</h1>\n",
          "headersMock": {
            "content-length": "14",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:07 GMT",
            "etag": "W/\"e-BnDCkeJVC9Hva7UP+CBhsU1G7Os\"",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 200
    },
    {
      "id": "k",
      "url": "/site",
      "type": "FETCH",
      "method": "POST",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /site</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:16 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:16.254Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /site</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:16 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "l",
      "url": "/users",
      "type": "FETCH",
      "method": "POST",
      "mocks": {
        "200": {
          "jsCode": "\n",
          "delay": 0,
          "response": "{\"msg\":\"success\"}",
          "headers": {
            "connection": "keep-alive",
            "content-length": "17",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:19 GMT",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:19.055Z",
          "responseMock": "{\"msg\":\"success\"}",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "17",
            "content-type": "application/json; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:19 GMT",
            "x-powered-by": "Express"
          },
          "type": "application",
          "subType": "json"
        }
      },
      "activeStatusCode": 200
    },
    {
      "id": "m",
      "url": "/users",
      "type": "FETCH",
      "method": "PUT",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /users</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:22 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:22.561Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /users</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "144",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:22 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "n",
      "url": "/site",
      "type": "FETCH",
      "method": "PUT",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /site</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "143",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:25 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:25.022Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /site</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "143",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:25 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "o",
      "url": "/users",
      "type": "FETCH",
      "method": "DELETE",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /users</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "147",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:32 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:32.710Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /users</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "147",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:32 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    },
    {
      "id": "p",
      "url": "/site",
      "method": "DELETE",
      "type": "FETCH",
      "mocks": {
        "404": {
          "jsCode": "\n",
          "delay": 0,
          "response": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /site</pre>\n</body>\n</html>\n",
          "headers": {
            "connection": "keep-alive",
            "content-length": "146",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:36 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "createdOn": "2021-04-13T20:15:36.367Z",
          "responseMock": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot DELETE /site</pre>\n</body>\n</html>\n",
          "headersMock": {
            "connection": "keep-alive",
            "content-length": "146",
            "content-security-policy": "default-src 'none'",
            "content-type": "text/html; charset=utf-8",
            "date": "Tue, 13 Apr 2021 20:15:36 GMT",
            "x-content-type-options": "nosniff",
            "x-powered-by": "Express"
          },
          "type": "text",
          "subType": "html"
        }
      },
      "activeStatusCode": 404
    }
  ],
  "domain": DEMO_TEST_DOMAIN
};
