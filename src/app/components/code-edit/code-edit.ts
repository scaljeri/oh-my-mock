export type themes = 'vs' | 'vs-dark' | 'hc-black';

export interface IOhMyCodeEditOptions {
  code: string | Record<string, string>;
  type: string;
  theme?: themes;
  allowErrors?: boolean;
}

export interface IMarker {
  owner: string;
  resource: unknown;
  severity: number;
  code?: string | {
    value: string;
    target: unknown;
  };
  message: string;
  source?: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  relatedInformation?: unknown[];
  tags?: unknown[];
}
