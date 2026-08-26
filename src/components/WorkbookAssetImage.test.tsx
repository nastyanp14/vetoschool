import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbookAssetImage } from './WorkbookAssetImage';

const mocks = vi.hoisted(() => ({
  signedUrlFor: vi.fn(),
  workbookAssetDebugLog: vi.fn(),
}));

vi.mock('../lib/workbooks', () => ({
  signedUrlFor: mocks.signedUrlFor,
  sanitizeWorkbookAssetUrl: (value: string | null | undefined) => ({ pathname: value || null }),
  workbookAssetDebugLog: mocks.workbookAssetDebugLog,
}));

afterEach(() => {
  vi.restoreAllMocks();
  mocks.signedUrlFor.mockReset();
  mocks.workbookAssetDebugLog.mockReset();
});

describe('WorkbookAssetImage', () => {
  it('renders the signed URL returned for a workbook asset relative path', async () => {
    const signedUrl = 'https://ggflcriakiudnejmiuwh.supabase.co/storage/v1/object/sign/workbook-assets/1785387148381-77xpfb.png?token=new';
    mocks.signedUrlFor.mockResolvedValue(signedUrl);

    render(
      <WorkbookAssetImage
        path="1785387148381-77xpfb.png"
        alt="Workbook asset"
        className="asset-image"
        surface="TrueFalse"
      />,
    );

    const image = await screen.findByRole('img', { name: 'Workbook asset' });
    expect(mocks.signedUrlFor).toHaveBeenCalledWith('1785387148381-77xpfb.png');
    expect(image).toHaveAttribute('src', signedUrl);
    expect(image).toHaveClass('asset-image');
  });
});
