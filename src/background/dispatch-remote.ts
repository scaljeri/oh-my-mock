import { io, Socket } from 'socket.io-client';
import { IOhMyDispatchServerRequest, IOhMyPacketContext, IPacketPayload } from '../shared/packet-type';
import { IOhMyMockResponse } from '../shared/types/api-response';
import { ohMyMockStatus } from '../shared/constants';
import { uniqueId } from '../shared/utils/unique-id';
import { log, warn } from './utils';
import { StorageUtils } from '../shared/utils/storage';
import { STORAGE_KEY } from '../shared/constants';
import { IOhMyMock, IOhMyRemote, OH_MY_REMOTE_DEFAULTS } from '../shared/types/store';

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

/**
 * Where a mock server lives, from what the user filled in.
 *
 * Only `ws://` — the SDK speaks socket.io over a websocket, and the host is
 * whatever the user typed: `localhost`, or the IP of a machine on the network
 * running the SDK for a whole team.
 */
export const remoteUrl = (remote?: IOhMyRemote): string => {
  const host = remote?.host || OH_MY_REMOTE_DEFAULTS.host;
  const port = remote?.port || OH_MY_REMOTE_DEFAULTS.port;

  return `ws://${host}:${port}`;
};

/** Where the SDK server listens unless told otherwise. */
export const DEFAULT_SDK_SERVER_URL = remoteUrl();

/**
 * Enough attempts to ride out an SDK server that is still starting up, few
 * enough that a browser with no SDK at all stops knocking almost immediately.
 */
const RECONNECTION_ATTEMPTS = 5;

let isConnected = false;
let socket: Socket | undefined;
/** Where `socket` was opened to, so a changed address can be noticed. */
let connectedUrl: string | undefined;

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
  connectedUrl = url;

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
  connectedUrl = undefined;
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

  // Only the local server is something to dial. `extension` needs no
  // connection at all, and the cloud service does not exist yet — saying so
  // here, rather than in the page, keeps the page from being the only thing
  // standing between a half-built feature and a socket to nowhere.
  if (store?.remote?.target !== 'server') {
    return;
  }

  const url = remoteUrl(store.remote);

  // `connectWithLocalServer` is a no-op while a socket exists, which is right
  // for repeated calls and wrong for a changed address: typing a new host or
  // port would leave the old socket in place and the new address ignored.
  if (socket && connectedUrl !== url) {
    disconnectFromLocalServer();
  }

  connectWithLocalServer(url);
};

/**
 * How long to wait for the SDK server.
 *
 * Short compared to the injected script's own backstop: this is a socket to a
 * process on the developer's own machine, so a second is already a long time,
 * and every millisecond here is one the page's request spends waiting.
 */
const SERVER_TIMEOUT = 3_000;

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
    let settled = false;
    // A holder, because `answer` is defined before the timer it clears and that
    // timer's callback calls `answer`.
    const timeout: { id?: ReturnType<typeof setTimeout> } = {};

    // Answers once, and takes the socket listener with it whichever way it
    // happened. Without the timeout an SDK server that accepted the emit and
    // never replied left this promise pending, the listener registered for the
    // life of the socket, and — through `server-dispatcher` and the content
    // script — the page's own request unanswered.
    const answer = (result: IOhMyMockResponse): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout.id);
      activeSocket.off(id);
      resolve(result);
    };

    timeout.id = setTimeout(() => {
      warn(`The mock server did not answer within ${SERVER_TIMEOUT}ms`, payload);

      // `NO_CONTENT` is what an absent server gives, so a server that has gone
      // quiet behaves like one that is not there: the request goes on to the
      // real endpoint rather than waiting on a socket that may never speak.
      answer({ status: ohMyMockStatus.NO_CONTENT });
    }, SERVER_TIMEOUT);

    activeSocket.on(id, (result: IOhMyMockResponse) => answer(result));

    payload.id = id;

    activeSocket.emit('data', payload);
  });
};
