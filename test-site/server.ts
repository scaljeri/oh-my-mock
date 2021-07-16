import express from 'express';
import * as socketio from "socket.io";
import * as path from "path";
import { appRouter } from './routes/routes';
import { createServer } from '../libs/nodejs-sdk';
import { IData, IMock, IOhMyEvalRequest } from '../src/shared/type';

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
  type: 'XHR',
  statusCode: 200,
  path: './users.json',
  handler: (data: IData, request: IOhMyEvalRequest, mock: IMock): void => {
    if (data) {
      const resp = JSON.parse(mock.responseMock);
      resp['1'] = 'Lucas Calje';
      mock.responseMock = JSON.stringify(resp);
    }
  }
} as any);

app.get("/", (req: any, res: any) => {
  res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')));
});


// app.set("port", process.env.PORT || 8000);
// let http = require("http").Server(app);

// let io = require("socket.io")(http);


app.use(express.json());
app.use(express.urlencoded({ extended: true }))

appRouter(app)

app.get("/", (req: any, res: any) => {
  res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')));
});


// whenever a user connects on port 3000 via
// a websocket, log that a user has connected
// io.on("connection", function (socket: any) {
//   console.log("a user connected");

//   socket.on("message", function (message: any) {
//     console.log(message);

//     socket.emit("message", message + ' echo');
//   });
// });

// ohMyServer.start(() => {
//   console.log("listening on *:8000");
// })
// const server = http.listen(8000, function () {
// });