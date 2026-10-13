import { describe, expect, it, vi } from 'vitest';
import { cameraVideoConstraints, tuneVideoSender } from './meetMedia';

describe('Meet media quality', () => {
  it('uses compatible ideal constraints up to Full HD without exact aspect ratio cropping', () => {
    expect(cameraVideoConstraints()).toEqual(expect.objectContaining({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
      aspectRatio: { ideal: 16 / 9 },
      facingMode: 'user',
    }));
    expect(cameraVideoConstraints('camera-2')).toEqual(expect.objectContaining({
      deviceId: { exact: 'camera-2' },
      facingMode: undefined,
    }));
  });

  it('starts network video at HD with an adaptive bitrate ceiling', async () => {
    const parameters: RTCRtpSendParameters = { codecs: [], encodings: [], headerExtensions: [], rtcp: {} };
    const setParameters = vi.fn().mockResolvedValue(undefined);
    const sender = {
      track: { kind: 'video', getSettings: () => ({ height: 1080 }) },
      getParameters: () => parameters,
      setParameters,
    } as unknown as RTCRtpSender;

    await tuneVideoSender(sender);

    expect(parameters.encodings[0]).toEqual(expect.objectContaining({
      maxBitrate: 2_000_000,
      maxFramerate: 30,
      scaleResolutionDownBy: 1.5,
    }));
    expect(parameters.degradationPreference).toBe('balanced');
    expect(setParameters).toHaveBeenCalledWith(parameters);
  });

  it('prioritizes resolution and a higher ceiling for screen sharing', async () => {
    const parameters: RTCRtpSendParameters = { codecs: [], encodings: [], headerExtensions: [], rtcp: {} };
    const sender = {
      track: { kind: 'video', getSettings: () => ({ height: 1080 }) },
      getParameters: () => parameters,
      setParameters: vi.fn().mockResolvedValue(undefined),
    } as unknown as RTCRtpSender;

    await tuneVideoSender(sender, { screen: true });

    expect(parameters.encodings[0]).toEqual(expect.objectContaining({ maxBitrate: 4_000_000, maxFramerate: 30 }));
    expect(parameters.degradationPreference).toBe('maintain-resolution');
  });

  it('falls back when a browser rejects advanced sender hints', async () => {
    const first: RTCRtpSendParameters = { codecs: [], encodings: [{}], headerExtensions: [], rtcp: {} };
    const fallback: RTCRtpSendParameters = { codecs: [], encodings: [{}], headerExtensions: [], rtcp: {} };
    const setParameters = vi.fn().mockRejectedValueOnce(new Error('unsupported')).mockResolvedValue(undefined);
    const sender = {
      track: { kind: 'video', getSettings: () => ({ height: 1080 }) },
      getParameters: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(fallback),
      setParameters,
    } as unknown as RTCRtpSender;

    await tuneVideoSender(sender, { level: 'hd' });

    expect(setParameters).toHaveBeenCalledTimes(2);
    expect(fallback.encodings[0]).toEqual(expect.objectContaining({ maxBitrate: 2_000_000, maxFramerate: 30 }));
    expect(fallback.degradationPreference).toBeUndefined();
  });
});
