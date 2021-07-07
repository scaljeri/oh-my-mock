import express from 'express';
import { Server, Socket } from 'socket.io';
import * as http from 'http';
import { IOhServerConfig, OhMyServer } from './oh-my-server';
import { IPacket } from '../../src/shared/type';

export interface IOhMyServerConfig extends IOhServerConfig {
  port?: number
  listenHandler?: () => void;
}

export const createServer = (config: IOhMyServerConfig): OhMyServer => {
  const app = express();
  const port = process.env.PORT || config.port || 9999;
  // app.set("port", process.env.PORT || config.port || 9999);

  const server = new http.Server(app);
  const io = new Server(server, {});

  io.on("connection", function (socket: Socket) {
    // eslint-disable-next-line no-console
    console.log("Client connected", socket.handshake.query.source);

    socket.on("message", function (message: IPacket) {
      // eslint-disable-next-line no-console
      console.log(message);

      socket.emit("message", message + ' echo');
    });
  });


  server.listen(port, () => config.listenHandler && config.listenHandler());

  return new OhMyServer(app, server, { local: config.local });
}
