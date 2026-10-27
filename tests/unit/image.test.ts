import { describe, expect, it } from 'vitest';
import { validateImage, outputFilename } from '../../src/image';

const image = (type: string, name = 'photo.png', content = 'pixels') => new File([content], name, { type });

describe('image validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts %s', (type) => {
    expect(validateImage(image(type))).toBeNull();
  });
  it('rejects non-image files', () => {
    expect(validateImage(image('text/plain', 'notes.txt'))).toBeTruthy();
  });
  it('rejects empty files', () => {
    expect(validateImage(image('image/png', 'empty.png', ''))).toBeTruthy();
  });
  it('rejects oversized files', () => {
    const file = image('image/png');
    Object.defineProperty(file, 'size', { value: 100 * 1024 * 1024 });
    expect(validateImage(file)).toBeTruthy();
  });
});

describe('PNG filenames', () => {
  it.each(['portrait.jpg', 'product.webp', 'many.dots.png', 'clipboard', ''])('creates a PNG filename for %j', (name) => {
    expect(outputFilename(name)).toMatch(/.+\.png$/);
    expect(outputFilename(name)).not.toMatch(/\.(jpg|webp)\.png$/);
  });
});
