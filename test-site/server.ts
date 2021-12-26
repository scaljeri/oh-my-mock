import express from 'express';
import * as path from "path";
import { appRouter } from './routes/routes';
import { createServer } from '../libs/nodejs-sdk';
import { IOhMyMockResponse } from '../src/shared/type';
import { IOhMyDispatchServerRequest } from '../src/shared/packet-type';

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
  url: '/site',
  method: 'POST',
  requestType: 'FETCH',
  statusCode: 201,
  path: './users.json',
  handler: (output: IOhMyMockResponse<string>, data: IOhMyDispatchServerRequest): IOhMyMockResponse => {
    if (output.response) {
      const resp = JSON.parse(output.response);
      resp['1'].name = 'Lucas Calje';
      console.log(output);
      output.headers = { 'content-type': 'application/json', source: 'nodejs/oh-my-mock-sdk' };
      output.response = JSON.stringify(resp);
    }

    return output;
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
