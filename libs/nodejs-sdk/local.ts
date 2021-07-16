import * as fs from 'fs';
import * as path from 'path';
import { IData, IMock, IOhMyContext, IOhMyEvalRequest, statusCode } from '../../src/shared/type';
import { compareUrls } from '../../src/shared/utils/urls';

const fsPromise = fs.promises;

export interface IOhMyLocalConfig {
  basePath?: string;
}

export type IOhFileContext = Omit<IOhMyContext, 'id' | 'mockId'> &
{
  statusCode: statusCode;
  path: string
  handler: (data: IData, request: IOhMyEvalRequest, mock: IMock) => IMock;
};

export class OhMyLocal {
  private contexts: IOhFileContext[] = [];

  constructor(private config: IOhMyLocalConfig) { }

  add(context: IOhFileContext): void {
    // eslint-disable-next-line no-console
    this.contexts.push(context);
  }

  findContext(input: IData): IOhFileContext | null {
    return (this.contexts.filter(c => {
      // eslint-disable-next-line no-console

      return c.method === input.method && c.type === input.type && compareUrls(input.url, c.url);
    }) || [])[0];
  }

  // If a context is defined for `data`, it will update and return `mock`. If not, the
  // original `mock` object is returned
  async updateMock(data: IData, request: IOhMyEvalRequest): Promise<IMock> {
    const context = this.findContext(data);
    const mock = data.mocks[data.activeMock];

    if (!context) {
      // eslint-disable-next-line no-console
      console.log(`     no response defined`);

      return mock;
    } else {
      // eslint-disable-next-line no-console
      console.log(`     serving response from disk`);
    }

    const responseMock = await OhMyLocal.loadFile(path.join((this.config.basePath || ''), context.path));

    if (responseMock) {
      mock.responseMock = responseMock;
    }

    return context?.handler(data, request, mock) || mock;
  }

  static async loadFile(filename: string): Promise<string | null> {
    try {
      if (fs.existsSync(filename)) {
        const buffer = await fsPromise.readFile(filename)
          // eslint-disable-next-line no-console
          .catch((err) => console.error('Failed to read file', err));

        return buffer ? (buffer as Buffer).toString('utf8') : null;
      } else {
        // eslint-disable-next-line no-console
        console.warn(`Oooops, the fie ${filename} does not exist`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
    }
  }
}
