// Minimal ambient types for irc-framework v4.
// The package ships no type declarations and there is no @types/irc-framework
// on npm, so we declare just the surface the bridge uses. Expand as needed.

declare module 'irc-framework' {
  /** SASL PLAIN credentials (Ergo account = nick). */
  export interface IrcAccount {
    account: string;
    password: string;
  }

  /** Options passed to Client#connect (subset we use; extras allowed). */
  export interface ConnectOptions {
    host: string;
    port: number;
    tls?: boolean;
    nick: string;
    username?: string;
    gecos?: string;
    account?: IrcAccount;
    [key: string]: unknown;
  }

  export class Client {
    constructor(options?: Record<string, unknown>);
    /** Connect (or, with no args, reconnect using the stored options). */
    connect(options?: ConnectOptions): void;
    /** Subscribe to an IRC event. Payload shapes are event-specific. */
    on(event: string, handler: (event: any) => void): this;
    /** Run a WHO/WHOX query; the tokened reply carries the channel (unlike a bare WHO). */
    who(target: string, cb?: (event: any) => void): void;
    /** Send a raw IRC line. */
    raw(...args: string[]): void;
    /** Send a PRIVMSG to a target (nick or channel). */
    say(target: string, message: string): void;
    /** Disconnect with an optional QUIT message. */
    quit(message?: string): void;
  }

  export const ircLineParser: unknown;
  export class Message {}
  export const MessageTags: unknown;
  export const Helpers: unknown;
  export class Channel {}
}
