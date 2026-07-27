export type themes = 'vs' | 'vs-dark' | 'hc-black';

export interface IOhMyCodeEditOptions {
  // A mock may have no body or no custom code yet, so the editor opens empty.
  code: string | Record<string, string> | undefined;
  type: string;
  allowErrors?: boolean;
  readonly?: boolean;
  theme?: themes;
  base?: string;
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
