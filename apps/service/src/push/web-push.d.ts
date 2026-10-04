// The `web-push` package ships no type declarations. Only the surface the service uses is declared
// here, rather than adding a second dependency for it: the request options and the error class.
declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  export interface WebPushError extends Error {
    readonly statusCode: number;
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly endpoint: string;
  }

  export type WebPushErrorClass = new (
    message: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
    endpoint: string,
  ) => WebPushError;

  const webPush: {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    generateVAPIDKeys: () => { publicKey: string; privateKey: string };
    sendNotification: (subscription: PushSubscription, payload: string) => Promise<unknown>;
    WebPushError: WebPushErrorClass;
  };
  export default webPush;
}
