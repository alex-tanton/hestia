import type { ReactElement } from 'react';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { ListsIndexScreen } from './ListsIndexScreen.tsx';

/**
 * The archived lists (Design › Screens › 7): read-only, each with an unarchive action. It is a
 * pushed screen, so the top bar shows a back control to the list it was opened from.
 */
export function ArchivedListsScreen({ householdId }: { householdId: string }): ReactElement {
  useScreenChrome({ title: 'Archived lists', backTo: '/lists', backLabel: 'Lists' });
  return <ListsIndexScreen householdId={householdId} isArchived />;
}
