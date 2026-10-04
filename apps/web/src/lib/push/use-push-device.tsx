import { createContext, useCallback, useContext, type ReactElement, type ReactNode } from 'react';
import { useApi } from '../api/api-context.tsx';
import { ensurePushSubscription, type EnableOutcome } from './device-subscription.ts';
import { browserPushPort, type PushPort, type PushSupport } from './push-port.ts';

const PushPortContext = createContext<PushPort>(browserPushPort);

/** Supplies the push port; the browser's by default, a double in tests. */
export function PushPortProvider({
  port,
  children,
}: {
  port: PushPort;
  children: ReactNode;
}): ReactElement {
  return <PushPortContext value={port}>{children}</PushPortContext>;
}

/** The port itself, for the one caller that acts on the device outside the toggles: sign-out. */
export function usePushPort(): PushPort {
  return useContext(PushPortContext);
}

export interface PushDevice {
  support: PushSupport;
  /**
   * The browser's permission as it is now, read on every render, so a remount after a refusal or a
   * dismissal shows what the browser actually holds. `undefined` where push is not supported.
   */
  permission: NotificationPermission | undefined;
  /** Registers this device after a type was turned on. Never called on load. */
  enable: () => Promise<EnableOutcome>;
}

/** This device's push state and the one action that changes it (Design › Screens › 4). */
export function usePushDevice(): PushDevice {
  const port = useContext(PushPortContext);
  const api = useApi();
  const support = port.support();
  const permission = support === 'supported' ? port.permission() : undefined;

  const enable = useCallback(
    (): Promise<EnableOutcome> => ensurePushSubscription(port, api),
    [port, api],
  );

  return { support, permission, enable };
}
