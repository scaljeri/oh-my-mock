TODO

Setup an Express server to be able to serve files from disk via OhMyMock

### Install

    $> yarn add @scaljeri/ohmymock-sdk

### Example

    import express from 'express';
    import { createServer, IData, IMock, IOhMyEvalRequest } from '@scaljeri/ohmymock-sdk';

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
	      handler: (data: IData, request: IOhMyEvalRequest, mock: IMock): void => {
		        if (data) {
			          const resp = JSON.parse(mock.responseMock!);
			          resp['1'].name = 'Lucas Calje';
			          mock.responseMock = JSON.stringify(resp);
		        }
	      }
    } as any);

    app.get("/", (req: express.Request, res: express.Response) => {
	      res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')));
    });
    ...
