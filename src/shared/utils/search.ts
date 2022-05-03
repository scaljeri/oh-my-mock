import { IData, IMock } from "../type";
import { isImage } from './image';
import { getMimeType } from "./mime-type";

// const QUOTE_RE = /(?<=")([^"]+)(?=")(\s|\b)/gi;
const QUOTE_RE = /(?<=")([^"]+)(?=")/gi;
const RM_QUOTE_RE = /"[^"]+"\s{0,}/g;

export function splitIntoSearchTerms(input = ''): string[] {
  const qwords = (input.match(QUOTE_RE) || []);
  const words = input.replace(RM_QUOTE_RE, '').split(' ')
    .map(s => s.replace(/("")+/g, '').trim())
    .filter(w => w !== '"');

  return [...qwords, ...words].filter(t => !!t).map(w => w.toLowerCase());
}

export function shallowSearch(data: Record<string, IData>, words: string[], includes: Record<string, boolean>): Record<string, IData> {
  return Object.fromEntries<IData>(
    Object.entries(data).filter(kv =>
      words.some(v => {
        const value = kv[1];
        return value.url.toLowerCase().includes(v) && includes['url'] ||
          value.requestType.toLowerCase().includes(v) && includes['requestType'] ||
          value.method?.toLowerCase().includes(v) && includes['requestMethod']
      })
    )
  );
}

export async function deepSearch(data: Record<string, IData>, words: string[], includes: Record<string, boolean>, mocks: Record<string, IMock> = {}): Promise<IData[]> {
  const out: IData[] = [];
  const values = Object.values(data);

  if (Object.keys(mocks).length === 0) {
    return [];
  }

  dataLoop:
  for (let i = 0; i < values.length; i++) {
    const dataMocks = Object.keys(values[i].mocks);

    for (let j = 0; j < dataMocks.length; j++) {
      const mock = mocks[dataMocks[j]];

      if (!mock) {
        console.warn('WebWorker could not find mock with id ' + dataMocks[j]);
        continue;
      }

      const contentType = getMimeType(mock.headersMock);
      try {
        if (words.some(w => {
          if (!isImage(contentType)) {
            if (!mock['responseRreadyForSearch'] && includes.response) {
              if (typeof mock.responseMock === 'object') {
                mock.responseMock = JSON.stringify(mock.responseMock).toLowerCase();
              } else if (typeof mock.responseMock === 'string') {
                mock.responseMock = mock.responseMock.toLowerCase();
              }

              mock.label = mock.label?.toLowerCase() ?? '';

              mock['responseReadyForSearch'] = true;
            }

            if (includes.response && mock.responseMock.includes(w)) {
              return true;
            }
          }

          if (typeof mock.headers === 'object') {
            mock.headers = JSON.stringify(mock.headers).toLowerCase() as any;
          }

          if (includes.headers && (mock.headers as any as string).includes(w)) {
            return true;
          }

          if (includes.label && mock.label.includes(w)) {
            return true;
          }

          return includes.statusCode && mock.statusCode.toString().includes(w);
        })) {
          out.push(values[i]);
          continue dataLoop;
        }
        // eslint-disable-next-line no-console
      } catch (err) { console.error('Ooops, something went wrong while searching. Please fill in a bug report!!', err) }
    }
  }

  return out;
}
