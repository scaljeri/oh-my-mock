import { io } from 'socket.io-client';
import { IOhMyDispatchServerRequest, IPacketPayload } from '../shared/packet-type';
import { IOhMyMockResponse } from '../shared/type';
import { uniqueId } from '../shared/utils/unique-id';

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

export const dispatchRemote = async (payload: IPacketPayload<IOhMyDispatchServerRequest>): Promise<IOhMyMockResponse> => {
  //   const { data, request }: { data: IData, request: IOhMyEvalRequest } = payload.data;

  if (isConnected) {
    return new Promise<IOhMyMockResponse>(resolve => {
      const id = uniqueId();
      socket.on(id, (result: IOhMyMockResponse) => {
        socket.off(payload.context.id);

        resolve(result);
      });

      payload.id = id;
      socket.emit('data', payload);
    });
  } else {
    return (payload as any).data.response as IOhMyMockResponse;
  }
}

