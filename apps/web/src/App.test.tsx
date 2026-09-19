import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('lands on the This Week dashboard', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'This Week' })).toBeInTheDocument();
  });
});
