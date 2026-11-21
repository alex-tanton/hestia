import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon.tsx';
import { FILLED_ICON_PATHS, ICON_PATHS, type IconName } from './icon-paths.ts';

describe('Icon', () => {
  it.each(['add', 'error', 'more_vert', 'close'] as const)(
    'renders outline SVG for %s with aria-hidden and no ligature text',
    (name) => {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('viewBox', '0 -960 960 960');
      expect(svg).toHaveAttribute('fill', 'currentColor');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
      expect(svg).toHaveClass('shrink-0');
      expect(svg?.textContent).toBe('');

      const path = svg?.querySelector('path');
      expect(path).not.toBeNull();
      expect(path).toHaveAttribute('d', ICON_PATHS[name]);
      expect(path?.getAttribute('d')).toBeTruthy();
    },
  );

  it.each(['star', 'home', 'notifications', 'favorite', 'storefront'] as const)(
    'switches to filled path geometry when filled=true for %s',
    (name) => {
      const { container } = render(<Icon name={name} filled />);
      const path = container.querySelector('svg > path');
      expect(path).not.toBeNull();
      expect(path).toHaveAttribute('d', FILLED_ICON_PATHS[name]);
      expect(FILLED_ICON_PATHS[name]).not.toBe(ICON_PATHS[name]);
    },
  );

  it.each(['close', 'add', 'search'] as const)(
    'falls back to outline path when filled=true for outline-only icon %s',
    (name) => {
      const { container } = render(<Icon name={name} filled />);
      const path = container.querySelector('svg > path');
      expect(path).toHaveAttribute('d', ICON_PATHS[name]);
    },
  );

  it('applies custom size and className while preserving shrink-0', () => {
    const { container } = render(<Icon name="settings" size={24} className="text-primary" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(svg).toHaveClass('shrink-0', 'text-primary');
  });

  it('has valid non-empty path strings for every registered IconName', () => {
    const names = Object.keys(ICON_PATHS) as IconName[];
    expect(names.length).toBeGreaterThanOrEqual(54);
    for (const name of names) {
      expect(ICON_PATHS[name].length).toBeGreaterThan(0);
    }
  });
});
