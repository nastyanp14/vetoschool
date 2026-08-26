import { render, screen, waitFor } from '@testing-library/react';
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
  vi.unstubAllGlobals();
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

  it('renders a same-origin proxied blob for Supabase signed workbook asset URLs', async () => {
    const signedUrl = 'https://ggflcriakiudnejmiuwh.supabase.co/storage/v1/object/sign/workbook-assets/1785387148381-77xpfb.png?token=new';
    const objectUrl = 'blob:https://vetoschool.eu/workbook-asset';
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['png'], { type: 'image/png' }), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }));
    const createObjectURL = vi.fn(() => objectUrl);
    const revokeObjectURL = vi.fn();
    mocks.signedUrlFor.mockResolvedValue(signedUrl);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });

    const { unmount } = render(
      <WorkbookAssetImage
        path="1785387148381-77xpfb.png"
        alt="Workbook asset"
        surface="TrueFalse"
      />,
    );

    const image = await screen.findByRole('img', { name: 'Workbook asset' });
    expect(fetchMock).toHaveBeenCalledWith('/api/workbook-asset-proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: signedUrl }),
    });
    expect(image).toHaveAttribute('src', objectUrl);

    unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl));
  });
});
