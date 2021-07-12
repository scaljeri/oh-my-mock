import { io } from 'socket.io-client';
import { packetTypes } from '../shared/constants';
import { IData, IMock, IOhMyEvalContext, IOhMyEvalRequest, IPacket, IPacketPayload } from '../shared/type';
import { uniqueId } from '../shared/utils/unique-id';

let isConnected = false;
const socket = io("ws://localhost:8000", { query: { source: 'ohmymock' } });

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
    console.log('Transport:' + socket.io.engine.transport.name);
    if (!isConnected) {
      isConnected = true;
      // eslint-disable-next-line no-console
      console.log('Connected with server');
    }
  });
}

export const dispatchRemote = async (payload: IPacketPayload<IOhMyEvalContext>): Promise<IMock> => {
  const { data, request }: { data: IData, request: IOhMyEvalRequest } = payload.data;

  if (isConnected) {

    return new Promise(resolve => {
      socket.on(payload.context.id, (result: IMock) => {
        socket.off(payload.context.id);
        // eslint-disable-next-line no-console
        console.log('YES, received', result);

        resolve(result);
      });

      socket.emit('data', payload);
    });
  } else {
    return null;
  }
}

