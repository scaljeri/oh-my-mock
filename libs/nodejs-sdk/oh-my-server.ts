import express from 'express';
import * as http from 'http';
import { IOhMyLocalConfig, OhMyLocal } from './local';

export interface IOhServerConfig {
  local?: IOhMyLocalConfig;
  cloud?: never;
}

export class OhMyServer {
  constructor(public app: express.Application, private server: http.Server, private config: { local: IOhMyLocalConfig }) { }

  get local(): OhMyLocal {
    return new OhMyLocal({ ...this.config.local });
  }
}
