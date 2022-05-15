import { io } from 'socket.io-client';
import { IOhMyDispatchServerRequest, IOhMyPacketContext, IPacketPayload } from '../shared/packet-type';
import { IOhMyMockResponse } from '../shared/type';
import { uniqueId } from '../shared/utils/unique-id';

let isConnected = false;

const socket = io("ws://localhost:8000", { query: { source: 'ohmymock' }, transports: ['websocket'] });
// socket.on('connect_error' as any, err => (err) => {});
// eslint-disable-next-line no-console
// socket.on('connect_failed', err => (err) => { }); //  console.error('WebSocket connection failed', err) })
// eslint-disable-next-line no-console
// socket.on('disconnect', err => (err) => { });// console.log('Websocket disconnected', err) })

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

export const dispatchRemote = async (payload: IPacketPayload<IOhMyDispatchServerRequest, IOhMyPacketContext>): Promise<IOhMyMockResponse> => {
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

