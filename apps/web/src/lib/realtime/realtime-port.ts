/**
 * What a screen needs from Supabase Realtime, as an interface, so a component test can drive it
 * without supabase-js — the same reason the auth client is one.
 */
export interface ListRealtimeHandlers {
  /** An insert or update on one of the list's items; the id is the row that changed. */
  onItemChange: (itemId: string | undefined) => void;
  /**
   * A change to the list row itself. A delete on a filtered subscription carries only the primary
   * key, so `list_id=eq.<id>` cannot match it and Realtime never delivers it; the `updated_at`
   * trigger firing on the list row is what a member sees instead (Technical Architecture,
   * "Realtime subscriptions"). It is also what keeps a subtotal right after a change the client
   * cannot reconstruct.
   */
  onListChange: () => void;
}

export interface RealtimePort {
  /** Subscribes to one open list; the returned function tears the channel down. */
  subscribeToList: (listId: string, handlers: ListRealtimeHandlers) => () => void;
}
