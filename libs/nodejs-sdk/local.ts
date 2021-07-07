import * as fs from 'fs';
import * as path from 'path';
import { IData, IOhMyContext, statusCode } from '../../src/shared/type';
import { compareUrls } from '../../src/shared/utils/urls';

const fsPromise = fs.promises;

export interface IOhMyLocalConfig {
  basePath?: string;
}

export type IOhFileContext = Omit<IOhMyContext, 'id' | 'mockId'> &
{
  statusCode: statusCode;
  path: string
};

export class OhMyLocal {
  private context: IOhFileContext;

  constructor(private config: IOhMyLocalConfig) { }

  add(context: IOhFileContext): void {
    this.context = context;
  }

  isMatch(input: IData): boolean {
    return this.context.method === input.method && this.context.type === input.type &&
      compareUrls(input.url, this.context.url);
  }

  async data() {
    const filename = path.join(this.config.basePath, this.context.path);

    const data = await fsPromise.readFile(filename)
      // eslint-disable-next-line no-console
      .catch((err) => console.error('Failed to read file', err));

    return data;
  }
}
