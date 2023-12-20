import * as fs from 'fs';
import * as path from 'path';
import { OhMyResponseStatus } from '../../src/shared/constants';
import { IOhMyDispatchServerRequest } from '../../src/shared/packet-type';
import { IOhMyMockResponse, IOhMyStatusCode, IOhMyAPIRequest, IOhMyRequest } from '../../src/shared/types';
import { compareUrls } from '../../src/shared/utils/urls';

const fsPromise = fs.promises;

export interface IOhMyLocalConfig {
  basePath?: string;
}

export type IOhMySdkResponse = IOhMyMockResponse;
export type IOhMySdkRequest = IOhMyDispatchServerRequest;

export type IOhFileContext = Omit<IOhMyAPIRequest, 'id' | 'mockId'> &
{
  statusCode?: IOhMyStatusCode;
  headers?: Record<string, string>;
  path?: string
  handler: (output: IOhMySdkResponse, input: IOhMySdkRequest) => IOhMySdkResponse;
};

export class OhMyLocal {
  private contexts: IOhFileContext[] = [];

  constructor(private config: IOhMyLocalConfig) { }

  add(context: IOhFileContext): void {
    this.contexts.push(context);
  }

  findContext(input: Partial<IOhMyRequest>): IOhFileContext | null {
    return (this.contexts.filter(c => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (!input.requestMethod || c.requestMethod === input.requestMethod) && compareUrls(input.url!, c.url!);
    }) || [])[0];
  }

  // If a context is defined for `data`, it will update and return `mock`. If not, the
  // original `mock` object is returned
  async updateMock(data: IOhMyDispatchServerRequest): Promise<IOhMySdkResponse> {
    const context = this.findContext(data.request);
    if (!context) {
      // eslint-disable-next-line no-console
      console.log(`     no response defined`);

      return { status: OhMyResponseStatus.NO_CONTENT };
    } else {
      // eslint-disable-next-line no-console
      console.log(`     serving response from disk`);
    }

    const output = {
      status: OhMyResponseStatus.NO_CONTENT,
      ...(context.statusCode && { statusCode: context.statusCode }),
      ...(context.headers && { headers: context.headers })
    } as IOhMyMockResponse;

    if (context.path) {
      const respFromFile = await OhMyLocal.loadFile(path.join((this.config.basePath || ''), context.path));

      if (respFromFile) {
        output.response = respFromFile;
        output.status = OhMyResponseStatus.OK;
      }
    }

    return context ? (context.handler?.(output, data) || output) : { status: OhMyResponseStatus.NO_CONTENT };
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

    return null;
  }
}
