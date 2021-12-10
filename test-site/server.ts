import express from 'express';
import * as path from "path";
import { appRouter } from './routes/routes';
import { createServer } from '../libs/nodejs-sdk';
import { IData, IMock } from '../src/shared/type';
import { IOhMyComputedResponse } from '../src/shared/packet-type';

const filedir = path.dirname(process.argv[1]).replace(/^\./, '');
const basePath = __dirname.replace(filedir, '');

const ohMyServer = createServer({
  port: 8000, listenHandler: () => {
    console.log('Server up and running');
  },
  local: { basePath: path.join(basePath, 'test-site/data') }
});
const app = ohMyServer.app;

ohMyServer.local.add({ // settings
  url: '/users',
  method: 'GET',
  requestType: 'XHR',
  statusCode: 200,
  path: './users.json',
  handler: (respFile: string, data: IOhMyComputedResponse): void => {
    if (respFile) {
      const resp = JSON.parse(respFile);
      resp['1'].name = 'Lucas Calje';
      data.response.response = JSON.stringify(resp);
    }
  }
} as any);

app.get("/", (req: any, res: any) => {
  res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')));
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }))

appRouter(app)

app.get("/", (req: any, res: any) => {
  res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')));
});
