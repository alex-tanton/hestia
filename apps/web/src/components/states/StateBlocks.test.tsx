import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getMdButton } from '../../test/md-queries.ts';
import { EmptyState, ErrorState, OfflineState } from './StateBlocks.tsx';

describe('StateBlocks', () => {
  describe('EmptyState', () => {
    it('renders page layout with 48dp icon container, heading, message, and primary button', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();

      const { container } = render(
        <EmptyState
          icon="shopping_cart"
          heading="No shopping lists"
          message="Create your first list to start tracking groceries."
          action={{ label: 'Create list', onAction }}
          layout="page"
        />,
      );

      expect(
        screen.getByRole('heading', { level: 2, name: 'No shopping lists' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Create your first list to start tracking groceries.'),
      ).toBeInTheDocument();

      const actionButton = getMdButton('Create list');
      expect(actionButton).toBeInTheDocument();
      await user.click(actionButton);
      expect(onAction).toHaveBeenCalledTimes(1);

      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('width', '48');
      expect(icon).toHaveAttribute('height', '48');
      expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    });

    it('renders card layout with 32dp icon, compact copy, and ghost button', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();

      const { container } = render(
        <EmptyState
          icon="receipt_long"
          message="No upcoming bills this week."
          action={{ label: 'Add bill', onAction }}
          layout="card"
        />,
      );

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.getByText('No upcoming bills this week.')).toBeInTheDocument();

      const actionButton = getMdButton('Add bill');
      expect(actionButton).toBeInTheDocument();
      await user.click(actionButton);
      expect(onAction).toHaveBeenCalledTimes(1);

      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('width', '32');
      expect(icon).toHaveAttribute('height', '32');
      expect(container.querySelector('.rounded-full')).not.toBeInTheDocument();
    });
  });

  describe('ErrorState', () => {
    it('renders page layout with message, retry button, and alternative action', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const onAlt = vi.fn();

      render(
        <ErrorState
          message="Failed to load deals."
          onRetry={onRetry}
          retryLabel="Try again"
          alternative={{ label: 'View cached deals', onAction: onAlt }}
          layout="page"
        />,
      );

      expect(screen.getByText('Failed to load deals.')).toBeInTheDocument();

      const retryButton = getMdButton('Try again');
      await user.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);

      const altButton = getMdButton('View cached deals');
      await user.click(altButton);
      expect(onAlt).toHaveBeenCalledTimes(1);
    });

    it('renders card layout with compact styling and retry', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      const { container } = render(
        <ErrorState message="Error loading chores card." onRetry={onRetry} layout="card" />,
      );

      expect(screen.getByText('Error loading chores card.')).toBeInTheDocument();
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('width', '24');

      const retryButton = getMdButton('Try again');
      await user.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('OfflineState', () => {
    it('renders page layout with 48dp wifi_off icon and message', () => {
      const { container } = render(
        <OfflineState
          message="Deal search needs a connection. Your lists still work."
          layout="page"
        />,
      );

      expect(
        screen.getByText('Deal search needs a connection. Your lists still work.'),
      ).toBeInTheDocument();
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('width', '48');
      expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    });

    it('renders card layout with 32dp wifi_off icon and compact styling', () => {
      const { container } = render(<OfflineState message="Pantry is offline." layout="card" />);

      expect(screen.getByText('Pantry is offline.')).toBeInTheDocument();
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('width', '32');
      expect(container.querySelector('.rounded-full')).not.toBeInTheDocument();
    });
  });
});
