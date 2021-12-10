import * as fs from 'fs';
import * as path from 'path';
import { ohMyMockStatus } from '../../src/shared/constants';
import { IOhMyComputedResponse } from '../../src/shared/packet-type';
import { IData, IOhMyMockContext, statusCode } from '../../src/shared/type';
import { compareUrls } from '../../src/shared/utils/urls';

const fsPromise = fs.promises;

export interface IOhMyLocalConfig {
  basePath?: string;
}

export type IOhFileContext = Omit<IOhMyMockContext, 'id' | 'mockId'> &
{
  statusCode?: statusCode;
  headers?: Record<string, string>;
  path: string
  handler: (fileResponse: string, input: IOhMyComputedResponse) => IOhMyComputedResponse;
};

export class OhMyLocal {
  private contexts: IOhFileContext[] = [];

  constructor(private config: IOhMyLocalConfig) { }

  add(context: IOhFileContext): void {
    this.contexts.push(context);
  }

  findContext(input: Partial<IData>): IOhFileContext | null {
    return (this.contexts.filter(c => {
      return c.method === input.method && c.requestType === input.requestType && compareUrls(input.url, c.url);
    }) || [])[0];
  }

  // If a context is defined for `data`, it will update and return `mock`. If not, the
  // original `mock` object is returned
  async updateMock(data: IOhMyComputedResponse): Promise<IOhMyComputedResponse> {
    const context = this.findContext(data.request);
    if (!context) {
      // eslint-disable-next-line no-console
      console.log(`     no response defined`);

      return data;
    } else {
      // eslint-disable-next-line no-console
      console.log(`     serving response from disk`);
    }

    const respFromFile = await OhMyLocal.loadFile(path.join((this.config.basePath || ''), context.path));

    if (respFromFile) {
      data.response = {
        ...data.response,
        status: ohMyMockStatus.OK,
        response: respFromFile,
        ...(context.statusCode && { statusCode: context.statusCode }),
        ...(context.headers && { headers: context.headers })
      };
      data.response.response = respFromFile;

      if (context.statusCode) {

      }
    }

    return context?.handler(respFromFile, data) || data;
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
