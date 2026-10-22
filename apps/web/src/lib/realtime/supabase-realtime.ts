import type { SupabaseAuthClient } from '../auth/auth-client.ts';
import type { ListRealtimeHandlers, RealtimePort } from './realtime-port.ts';

/**
 * The real port. An open shopping list subscribes to one channel, `list:<listId>`, with the two
 * `postgres_changes` bindings (the list's items and the list row). Channels are named after the
 * resource rather than the household, so switching household tears down exactly the
 * subscriptions that belonged to the previous one.
 *
 * RLS is the only thing between a stream and another household's data: Realtime evaluates each
 * subscriber's policies as that user, with the claims on the access token the channel carries.
 */
export function createRealtimePort(client: Promise<SupabaseAuthClient>): RealtimePort {
  return {
    subscribeToList(listId, handlers: ListRealtimeHandlers) {
      let teardown: (() => void) | undefined;
      let isCancelled = false;

      void client
        .then((supabase) => {
          if (isCancelled) return;
          const channel = supabase
            .channel(`list:${listId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'shopping_list_item',
                filter: `list_id=eq.${listId}`,
              },
              (payload) => {
                handlers.onItemChange(rowId(payload.new) ?? rowId(payload.old));
              },
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'shopping_list', filter: `id=eq.${listId}` },
              () => {
                handlers.onListChange();
              },
            )
            .subscribe();

          teardown = () => {
            void supabase.removeChannel(channel);
          };
        })
        .catch(() => {
          // Without the client there is no stream; the list still polls and still writes.
        });

      return () => {
        isCancelled = true;
        teardown?.();
      };
    },
  };
}

function rowId(row: unknown): string | undefined {
  if (typeof row !== 'object' || row === null) return undefined;
  const id: unknown = (row as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
}
