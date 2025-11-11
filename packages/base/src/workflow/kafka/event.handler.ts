export interface EventMessage {
  key: Buffer | null;
  value: Buffer | null;
  timestamp: string;
  attributes: number;
  offset: string;
  headers: Record<string, Buffer>;
  size?: never;
}

export interface IEventHandler<T>  {
  handle(params: { key: string, event: T, payload?: EventMessage }): Promise<void>;
}
