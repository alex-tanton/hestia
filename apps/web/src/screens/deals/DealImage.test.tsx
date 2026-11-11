import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DealImage, isAllowedImageUrl } from './DealImage.tsx';

describe('isAllowedImageUrl re-export', () => {
  it('correctly validates URLs via centralized @hestia/shared validator', () => {
    expect(isAllowedImageUrl('https://dam.flipp.com/item.png')).toBe(true);
    expect(isAllowedImageUrl('https://flipp-image-retrieval.flipp.com/image.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://images.openfoodfacts.org/item.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://f.wishabi.net/flyer.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://images.wishabi.net/logo.png')).toBe(true);

    expect(isAllowedImageUrl(null)).toBe(false);
    expect(isAllowedImageUrl('https://attacker-flipp.com/test.png')).toBe(false);
    expect(isAllowedImageUrl('http://dam.flipp.com/item.png')).toBe(false);
    expect(isAllowedImageUrl('not-a-url')).toBe(false);
  });
});

describe('DealImage component', () => {
  it('renders placeholder container with ImageOff icon when url is null', () => {
    render(<DealImage url={null} />);

    const placeholder = screen.getByTestId('deal-image-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveClass('shrink-0', 'overflow-hidden', 'rounded-sm', 'bg-raised');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders placeholder container when url is from a disallowed domain', () => {
    render(<DealImage url="https://attacker-flipp.com/test.png" />);

    const placeholder = screen.getByTestId('deal-image-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders placeholder container when url is insecure HTTP', () => {
    render(<DealImage url="http://dam.flipp.com/item.png" />);

    const placeholder = screen.getByTestId('deal-image-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders <img> with lazy loading and async decoding for valid Flipp CDN URL', () => {
    const validUrl = 'https://dam.flipp.com/item.png';
    const { container } = render(<DealImage url={validUrl} className="size-16" />);

    expect(screen.queryByTestId('deal-image-placeholder')).toBeNull();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', validUrl);
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveClass('size-16', 'object-contain', 'shrink-0', 'rounded-sm');
  });

  it('renders <img> for valid Open Food Facts CDN URL', () => {
    const validUrl = 'https://images.openfoodfacts.org/item.jpg';
    const { container } = render(<DealImage url={validUrl} />);

    expect(screen.queryByTestId('deal-image-placeholder')).toBeNull();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', validUrl);
    expect(img).toHaveAttribute('alt', '');
  });

  it('flips state to render placeholder container when img triggers onError', () => {
    const validUrl = 'https://dam.flipp.com/item.png';
    const { container } = render(<DealImage url={validUrl} />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    fireEvent.error(img!);

    expect(screen.getByTestId('deal-image-placeholder')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('resets error state when url changes to a new valid image URL', () => {
    const firstUrl = 'https://f.wishabi.net/broken.jpg';
    const secondUrl = 'https://f.wishabi.net/recovered.jpg';
    const { container, rerender } = render(<DealImage url={firstUrl} />);

    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByTestId('deal-image-placeholder')).toBeInTheDocument();

    rerender(<DealImage url={secondUrl} />);
    expect(screen.queryByTestId('deal-image-placeholder')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', secondUrl);
  });
});
