import express from 'express';
import * as http from 'http';
import { IOhMyLocalConfig, OhMyLocal } from './local';

export interface IOhServerConfig {
  local?: IOhMyLocalConfig;
  cloud?: never;
}

export class OhMyServer {
  private _local: OhMyLocal;

  constructor(public app: express.Application, private server: http.Server, private config: { local: IOhMyLocalConfig }) {
    this._local = new OhMyLocal({ ...this.config.local });
   }

  get local(): OhMyLocal {
    return this._local;
  }
}
