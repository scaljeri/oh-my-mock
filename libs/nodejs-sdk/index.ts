import express from 'express';
import { Server, Socket } from 'socket.io';
import * as http from 'http';
import { IOhServerConfig, OhMyServer } from './oh-my-server';
import { IOhMyComputedResponse, IPacketPayload } from '../../src/shared/packet-type';

export * from '../../src/shared/type';

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
  const io = new Server(server, { transports: ['websocket'] });
  const myServer = new OhMyServer(app, server, { local: config.local })

  io.on("connection", function (socket: Socket) {
    // console.log(io.engine.transport.name);
    // console.log(socket.conn.transport.name);
    // eslint-disable-next-line no-console
    console.log("Client connected", socket.handshake.query.source);

    socket.on("data", async function (payload: IPacketPayload<IOhMyComputedResponse>) {
      // eslint-disable-next-line no-console
      if (payload.data) {
        const mock = await myServer.local.updateMock(payload.data);

        socket.emit(payload.id || 'data', mock);
      }
    });
  });

  server.listen(port, () => config.listenHandler && config.listenHandler());

  return myServer;
}
