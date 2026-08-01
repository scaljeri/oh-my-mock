import { io, Socket } from 'socket.io-client';
import { IOhMyDispatchServerRequest, IOhMyPacketContext, IPacketPayload } from '../shared/packet-type';
import { IOhMyMockResponse } from '../shared/types/api-response';
import { ohMyMockStatus } from '../shared/constants';
import { uniqueId } from '../shared/utils/unique-id';
import { log } from './utils';
import { StorageUtils } from '../shared/utils/storage';
import { STORAGE_KEY } from '../shared/constants';
import { IOhMyMock } from '../shared/types/store';

/**
 * Optional link to the NodeJS SDK server (`libs/nodejs-sdk`), which serves mock
 * responses from disk.
 *
 * The connection is bounded on purpose. This module used to open a socket to a
 * hard-coded `ws://localhost:8000` the moment the service worker started, with
 * socket.io's default of unlimited reconnection attempts. For the vast majority
 * of users — everyone who has the extension installed but never runs the SDK —
 * that meant a connection to a port nothing is listening on, retried forever,
 * for as long as the browser was open.
 *
 * Now it gives up after a few attempts and stays quiet until something asks it
 * to try again. `dispatchRemote` already degrades gracefully when there is no
 * server, so a failed connection costs nothing beyond the attempts themselves.
 */

/** Where the SDK server listens. Matches the port used by `createServer`. */
export const DEFAULT_SDK_SERVER_URL = 'ws://localhost:8000';

/**
 * Enough attempts to ride out an SDK server that is still starting up, few
 * enough that a browser with no SDK at all stops knocking almost immediately.
 */
const RECONNECTION_ATTEMPTS = 5;

let isConnected = false;
let socket: Socket | undefined;

function createSocket(url: string): Socket {
  return io(url, {
    query: { source: 'ohmymock' },
    transports: ['websocket'],
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 5_000
  });
}

export const connectWithLocalServer = (url: string = DEFAULT_SDK_SERVER_URL): void => {
  // Repeated calls must not stack up sockets: `background.ts` and
  // `server-dispatcher.ts` both call this during start-up.
  if (socket) {
    return;
  }

  socket = createSocket(url);

  socket.io.on('error', () => {
    if (isConnected) { // state changed
      log('lost connection with the SDK server');
      isConnected = false;
    }
  });

  socket.on('connect', () => {
    if (!isConnected) {
      isConnected = true;
      log(`connected to the SDK server on ${url}`);
    }
  });

  socket.on('disconnect', () => {
    isConnected = false;
  });
};

/**
 * Retries after the attempts have been exhausted — for when the SDK server is
 * started after the browser was already running.
 */
export const reconnectWithLocalServer = (url: string = DEFAULT_SDK_SERVER_URL): void => {
  socket?.close();
  socket = undefined;
  isConnected = false;

  connectWithLocalServer(url);
};

export const isConnectedWithLocalServer = (): boolean => isConnected;

/** Stops trying, and forgets the socket. */
export const disconnectFromLocalServer = (): void => {
  socket?.close();
  socket = undefined;
  isConnected = false;
};

/**
 * Reads the store and connects only if someone has asked for it.
 *
 * The service worker calls this on every start, which is why the check has to
 * live here rather than at the call site: it is the difference between a browser
 * that never touches the network for this and one that knocks six times, and
 * fails six times, every time the worker wakes.
 */
export const connectIfEnabled = async (): Promise<void> => {
  const store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY);

  if (!store?.remote?.enabled) {
    return;
  }

  connectWithLocalServer(store.remote.url || DEFAULT_SDK_SERVER_URL);
};

export const dispatchRemote = async (
  payload: IPacketPayload<IOhMyDispatchServerRequest, IOhMyPacketContext>
): Promise<IOhMyMockResponse> => {
  if (!isConnected || !socket) {
    // No SDK server to ask; the caller falls back to the locally stored mock.
    return { status: ohMyMockStatus.NO_CONTENT };
  }

  // Captured so the callbacks below cannot observe a `socket` that was replaced
  // (or cleared) by `reconnectWithLocalServer` while the request was in flight.
  const activeSocket = socket;

  return new Promise<IOhMyMockResponse>(resolve => {
    const id = uniqueId();

    activeSocket.on(id, (result: IOhMyMockResponse) => {
      activeSocket.off(id);

      resolve(result);
    });

    payload.id = id;

    activeSocket.emit('data', payload);
  });
};
