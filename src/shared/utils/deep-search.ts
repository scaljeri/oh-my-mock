import { IData, IMock } from "../type";
import { StorageUtils } from "./storage";
import { isImage } from './image';
import { getMimeType } from "./mime-type";

export async function deepSearch(data: IData[], words: string[]): Promise<IData[]> {
  const out: IData[] = [];

  dataLoop:
  for (let i = 0; i < data.length; i++) {
    const mocks = Object.keys(data[i].mocks);

    for (let j = 0; j < mocks.length; j++) {
      const mock = await StorageUtils.get(mocks[j]) as IMock;
      const contentType = getMimeType(mock.headersMock);
      if (!isImage(contentType)) {
        try {
          let response = mock.responseMock;
          if (typeof mock.responseMock === 'object') {
            response = JSON.stringify(mock.responseMock);
          }
          response = response.toLowerCase();
          const headers = JSON.stringify(mock.headers).toLowerCase();

          if (words.some(w =>
            response.includes(w) ||
            headers.includes(w) ||
            mock.statusCode.toString().includes(w))) {
            out.push(data[i]);
            continue dataLoop;
          }
        // eslint-disable-next-line no-console
        } catch (err) { console.error('Ooops, something went wrong while searching. Please fill in a bug report!!', err) }
      }
    }
  }
  return out;
}

// !!d.mocks[d.activeMock]?.statusCode.toString().includes(v) TODO * /
          // || !!Object.keys(d.mocks).find(k => d.mocks[k].responseMock?.toLowerCase().includes(v))
