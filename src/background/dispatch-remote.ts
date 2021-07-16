import { io } from 'socket.io-client';
import { IData, IMock, IOhMyEvalContext, IOhMyEvalRequest, IPacketPayload } from '../shared/type';

let isConnected = false;
const socket = io("ws://localhost:8000", { query: { source: 'ohmymock' }, transports: ['websocket'] });

export const connectWithLocalServer = (): void => {

  socket.io.on("error", (error) => {
    // eslint-disable-next-line no-console
    if (isConnected) { // state changed
      // eslint-disable-next-line no-console
      console.log('Lost connection');
      isConnected = false;
    }
  });

  // socket.io.on("reconnect_attempt", (attempt) => {
  //   // eslint-disable-next-line no-console
  //   console.log('reconnecting...');
  // });

  socket.on("connect", () => {
    // eslint-disable-next-line no-console
    console.log('Socket-io Transport:' + socket.io.engine.transport.name);
    if (!isConnected) {
      isConnected = true;
      // eslint-disable-next-line no-console
      console.log('Found server, websocket connected');
    }
  });
}

export const dispatchRemote = async (payload: IPacketPayload<IOhMyEvalContext>): Promise<IMock> => {
//   const { data, request }: { data: IData, request: IOhMyEvalRequest } = payload.data;

  if (isConnected) {

    return new Promise<IMock>(resolve => {
      socket.on(payload.context.id, (result: IMock) => {
        socket.off(payload.context.id);

        resolve(result);
      });

      socket.emit('data', payload);
    });
  } else {
    return null;
  }
}

