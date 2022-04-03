Setup an Express server to serve files from disk via OhMyMock

### Install

    $> yarn add @scaljeri/ohmymock-sdk
### Run oh-server

    $> node ./node_modules/.bin/oh-server ....

### Custom server
If the `oh-server` does not provide all the flexibility that is needed, a custom server 
can be created using the OhMyMock SDK.

Typescript:

    import express from 'express';
    import * as path from "path";
    import { createServer } from '@scaljeri/ohmymock-sdk';
    import { IOhMySdkResponse, IOhMySdkRequest } from '@scaljeri/ohmymock-sdk';

    const filedir = path.dirname(process.argv[1]).replace(/^\./, '');
    const basePath = __dirname.replace(filedir, '');

    const ohMyServer = createServer({
        port: 8000, 
        listenHandler: () => {
              console.log('Server up and running');
        },
        local: { basePath: path.join(basePath, 'test-site/data') }
    });
    const app = ohMyServer.app;

    ohMyServer.local.add({ // settings
          url: '/users',
          method: 'GET',
          type: 'XHR',
          statusCode: 200,
          path: './users.json',
          handler: (data: IOhMySdkResponse, request: IOhMySdkRequest): void => {
            if (data.response) {
                const resp = JSON.parse(data.response as string);
                resp['1'].name = 'Lucas Calje';
                data.response = JSON.stringify(resp);
            }
          }
    } as any);

    app.get("/", (req: express.Request, res: express.Response) => {
          res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')));
    });

Run the server as follows:

    $> ts-node server.ts

Javascript:

    import * as path from "path";
    import { createServer } from "@scaljeri/ohmymock-sdk";

    const filedir = path.dirname(process.argv[1]).replace(/^\./, "");
    const __dirname = path.resolve(path.dirname(''));

    const basePath = __dirname.replace(filedir, "");

    const ohMyServer = createServer({
      port: 8000,
      listenHandler: () => {
        console.log("Server up and running");
      },
      local: { basePath: path.join(basePath, "test-site/data") },
    });
    const app = ohMyServer.app;

    ohMyServer.local.add({
      // settings
      url: "/users",
      method: "GET",
      type: "XHR",
      statusCode: 200,
      path: "./users.json",
      handler: (data, request) => {
        if (data.response) {
          const resp = JSON.parse(data.response);
          resp["1"].name = "Lucas Calje";
          data.response = JSON.stringify(resp);
        }
      },
    });

    app.get("/", (req, res) => {
      res.sendFile(path.resolve(path.join(__dirname, "html/index.html")));
    });

.

    $> node server.js

It might be required to add `"type":"module"` to package.json
