import express from 'express';
import { Server, Socket } from 'socket.io';
import * as http from 'http';
import { IOhServerConfig, OhMyServer } from './oh-my-server';
import { IOhMyEvalContext, IPacketPayload } from '../../src/shared/type';

export interface IOhMyServerConfig extends IOhServerConfig {
  port?: number
  listenHandler?: () => void;
}

export const createServer = (config: IOhMyServerConfig): OhMyServer => {
  const app = express();
  const port = process.env.PORT || config.port || 9999;
  // app.set("port", process.env.PORT || config.port || 9999);

  const server = new http.Server(app);
  // const io = new Server(server);
  const io = new Server(server, { transports: ['websocket']});
  const myServer = new OhMyServer(app, server, { local: config.local })

  io.on("connection", function (socket: Socket) {
    // console.log(io.engine.transport.name);
    // console.log(socket.conn.transport.name);
    // eslint-disable-next-line no-console
    console.log("Client connected", socket.handshake.query.source);

    socket.on("data", async function (payload: IPacketPayload<IOhMyEvalContext>) {
      // eslint-disable-next-line no-console
      console.log(`Received request: ${payload.data.data.url} - ${payload.data.data.type} `);
      const data = payload.data.data;

      const mock = await myServer.local.updateMock(data, payload.data.request);

      socket.emit(payload.context.id, mock);
    });
  });

  server.listen(port, () => config.listenHandler && config.listenHandler());

  return myServer;
}
