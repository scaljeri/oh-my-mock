import { IData, IMock } from "../type";
import { isImage } from './image';
import { getMimeType } from "./mime-type";

// const QUOTE_RE = /(?<=")([^"]+)(?=")(\s|\b)/gi;
const QUOTE_RE = /(?<=")([^"]+)(?=")/gi;
const RM_QUOTE_RE = /"[^"]+"\s{0,}/g;

export function splitIntoSearchTerms(input: string): string[] {
  const qwords = (input.match(QUOTE_RE) || []);
  const words = input.replace(RM_QUOTE_RE, '').split(' ')
    .map(s => s.replace(/("")+/g, '').trim())
    .filter(w => w !== '"');

  return [...qwords, ...words].filter(t => !!t);
}

export function shallowSearch(data: Record<string, IData>, words: string[]): Record<string, IData> {
  return Object.fromEntries<IData>(
    Object.entries(data).filter(kv =>
      words.filter(v => v !== undefined && v !== '')
        .some(v => {
          const value = kv[1];
          return !value.url.toLowerCase().includes(v) &&
            !value.requestType.toLowerCase().includes(v) &&
            !value.method?.toLowerCase().includes(v)
        })
    )
  );
}

export async function deepSearch(data: Record<string, IData>, words: string[], mocks: Record<string, IMock> = {}): Promise<IData[]> {
  const out: IData[] = [];
  const values = Object.values(data);

  if (Object.keys(mocks).length === 0) {
    return values
  }

  dataLoop:
  for (let i = 0; i < values.length; i++) {
    const dataMocks = Object.keys(values[i].mocks);

    for (let j = 0; j < dataMocks.length; j++) {
      const mock = mocks[dataMocks[j]];
      const contentType = getMimeType(mock.headersMock);
      try {
        if (words.every(w => {
          if (!isImage(contentType)) {
            if (!mock['responseRreadyForSearch']) {
              if (typeof mock.responseMock === 'object') {
                mock.responseMock = JSON.stringify(mock.responseMock).toLowerCase();
              } else if (typeof mock.responseMock === 'string') {
                mock.responseMock = mock.responseMock.toLowerCase();
              }

              mock['responseReadyForSearch'] = true;
            }

            if (mock.responseMock.includes(w)) {
              return false; // We only keep the ones not matching!
            }
          }

          if (typeof mock.headers === 'object') {
            mock.headers = JSON.stringify(mock.headers).toLowerCase() as any;
          }

          if ((mock.headers as any as string).includes(w)) {
            return false;
          }

          return !mock.statusCode.toString().includes(w);
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
