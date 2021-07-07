import  {io} from 'socket.io-client';

// const socket = io('http://localhost:9999');
// eslint-disable-next-line no-console
console.log(io);

export const dispatchRemote = () => {
  // eslint-disable-next-line no-console
  console.log('dispatch remote')
  const socket = io("http://localhost:8000", { query: { source: 'ohmymock' }});
}
