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
  url: '/usersx',
  method: 'GET',
  statusCode: 201,
  path: './users.json',
  handler: (output: IOhMyMockResponse<string>, data: IOhMyDispatchServerRequest): IOhMyMockResponse => {
    if (output.response) {
      const resp = JSON.parse(output.response);
      resp['1'].name = 'Lucas Calje';
      console.log(output);
      output.response = JSON.stringify(resp);
      output.headers = { 'content-type': 'application/json', source: 'nodejs/oh-my-mock-sdk' };
    }

    return output;
  }
} as any);

app.get("/", (req: any, res: any) => {
  res.cookie("secureCookie", JSON.stringify({ x: 10 }), {
    secure: true, // process.env.NODE_ENV !== "development",
    // httpOnly: true,
    expires: new Date(Date.now() + 100000),
  });
  console.log('set secure cookie');

  res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')), {
    headers: {
      'Content-Security-Policy': "script-src self http://localhost:8000  'sha256-Y0Ko9LKZfaEAS30EibFdh13KX/GKjZrZcny1T0bsrxA='"
    }
    });
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }))

appRouter(app)
