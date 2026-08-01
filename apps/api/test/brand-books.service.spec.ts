import { describe, expect, it, vi } from 'vitest';
import { BrandBooksService } from '../src/brand-books/brand-books.service';

describe('BrandBooksService', () => {
  it('returns an empty current result when a version has no generated brand book yet', async () => {
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([])
    };
    const service = new BrandBooksService(dataSource as never, {} as never, {} as never, {} as never);

    await expect(service.getCurrent('workspace-id', 'project-id', 'version-id')).resolves.toEqual({
      brandBook: null,
      exports: []
    });
  });
});
