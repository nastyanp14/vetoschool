import { useCallback, useEffect, useRef, useState } from 'react';

export type OwlPlayerState = 'idle' | 'intro' | 'wave' | 'correct' | 'wrong' | 'hint' | 'thinking' | 'finishPerfect' | 'finishIdle' | 'finish';

type OwlAsset = {
  src: string;
  type: 'video' | 'image';
};

type Slot = 0 | 1;

type OwlVideoElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

type PlaybackPlan = {
  mode: 'idle' | 'one-shot';
  sources: string[];
  index: number;
  state: OwlPlayerState;
};

const idleOwlAsset: OwlAsset = {
  src: '/owl/vetoschool-owl-idle.mov',
  type: 'video',
};

const idleOwlPlaylist = [
  '/owl/vetoschool-owl-idle.mov',
  '/owl/vetoschool-owl-idle-2.mov',
  '/owl/vetoschool-owl-idle-3.mov',
];
const POST_REACTION_IDLE_INDEX = idleOwlPlaylist.length > 1 ? 1 : 0;

const owlAssets: Partial<Record<OwlPlayerState, OwlAsset>> = {
  idle: idleOwlAsset,
  intro: {
    src: '/owl/vetoschool-owl-intro.mov',
    type: 'video',
  },
  thinking: {
    src: '/owl/vetoschool-owl-thinking.mov',
    type: 'video',
  },
  correct: {
    src: '/owl/vetoschool-owl-correct.mov',
    type: 'video',
  },
  finishPerfect: {
    src: '/owl/vetoschool-owl-finish-perfect.mov',
    type: 'video',
  },
  finishIdle: {
    src: '/owl/vetoschool-owl-finish-idle.mov',
    type: 'video',
  },
};

const INITIAL_SLOT_SRC = idleOwlPlaylist[0];
const FIRST_VISIBLE_FRAME_OFFSET_SECONDS = 0.06;
const END_HANDOFF_OFFSET_SECONDS = 0.1;
const CROSSFADE_MS = 140;
const READY_TIMEOUT_MS = 2200;

type OwlPlayerProps = {
  state: OwlPlayerState;
  onStateComplete?: (state: OwlPlayerState) => void;
  className?: string;
};

const buildIdlePlaybackPlan = (index = 0): PlaybackPlan => ({
  mode: 'idle',
  sources: idleOwlPlaylist,
  index: Math.min(Math.max(index, 0), idleOwlPlaylist.length - 1),
  state: 'idle',
});

const buildPlaybackPlan = (state: OwlPlayerState): PlaybackPlan => {
  const asset = owlAssets[state];

  if (state === 'finishIdle' && asset?.type === 'video') {
    return {
      mode: 'idle',
      sources: [asset.src],
      index: 0,
      state: 'finishIdle',
    };
  }

  if (asset?.type === 'video' && (state as string) !== 'idle') {
    return {
      mode: 'one-shot',
      sources: [asset.src],
      index: 0,
      state,
    };
  }

  return buildIdlePlaybackPlan();
};

const otherSlot = (slot: Slot): Slot => slot === 0 ? 1 : 0;

const waitForVideoEvent = (
  video: HTMLVideoElement,
  events: Array<keyof HTMLMediaElementEventMap>,
  isReady: () => boolean,
) => new Promise<void>(resolve => {
  if (isReady()) {
    resolve();
    return;
  }

  let done = false;
  const cleanup = () => {
    events.forEach(event => video.removeEventListener(event, handleReady));
    video.removeEventListener('error', handleReady);
    window.clearTimeout(timeout);
  };
  const handleReady = () => {
    if (done) return;
    done = true;
    cleanup();
    resolve();
  };
  const timeout = window.setTimeout(handleReady, READY_TIMEOUT_MS);

  events.forEach(event => video.addEventListener(event, handleReady, { once: true }));
  video.addEventListener('error', handleReady, { once: true });
});

const waitForMetadata = (video: HTMLVideoElement) => waitForVideoEvent(
  video,
  ['loadedmetadata', 'loadeddata', 'canplay'],
  () => video.readyState >= HTMLMediaElement.HAVE_METADATA,
);

const waitForPlayableFrame = (video: HTMLVideoElement) => waitForVideoEvent(
  video,
  ['loadeddata', 'canplay', 'playing'],
  () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
);

const waitForDecodedVideoFrame = (video: OwlVideoElement) => new Promise<void>(resolve => {
  if (!video.requestVideoFrameCallback) {
    void waitForPlayableFrame(video).then(resolve);
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    resolve();
  };
  const frameHandle = video.requestVideoFrameCallback(() => finish());
  const timeout = window.setTimeout(() => {
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameHandle);
    finish();
  }, READY_TIMEOUT_MS);
});

export default function OwlPlayer({ state, onStateComplete, className = '' }: OwlPlayerProps) {
  const videoRefs = useRef<[OwlVideoElement | null, OwlVideoElement | null]>([null, null]);
  const sourceBySlotRef = useRef<Record<Slot, string>>({ 0: INITIAL_SLOT_SRC, 1: '' });
  const activePlanRef = useRef<PlaybackPlan>(buildPlaybackPlan('idle'));
  const visibleSlotRef = useRef<Slot>(0);
  const transitionTokenRef = useRef(0);
  const handoffInProgressRef = useRef(false);
  const onStateCompleteRef = useRef(onStateComplete);
  const [visibleSlot, setVisibleSlotState] = useState<Slot>(0);

  useEffect(() => {
    onStateCompleteRef.current = onStateComplete;
  }, [onStateComplete]);

  const setVisibleSlot = useCallback((slot: Slot) => {
    visibleSlotRef.current = slot;
    setVisibleSlotState(slot);
  }, []);

  const prepareSlot = useCallback(async (slot: Slot, src: string, token: number) => {
    const video = videoRefs.current[slot];
    if (!video) return false;

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = false;

    if (sourceBySlotRef.current[slot] !== src) {
      sourceBySlotRef.current[slot] = src;
      video.src = src;
      video.load();
    }

    await waitForMetadata(video);
    if (token !== transitionTokenRef.current) return false;

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const startOffset = duration > 0.35
      ? Math.min(FIRST_VISIBLE_FRAME_OFFSET_SECONDS, duration * 0.18)
      : 0;

    if (Math.abs(video.currentTime - startOffset) > 0.012) {
      video.currentTime = startOffset;
      await waitForPlayableFrame(video);
    }

    if (token !== transitionTokenRef.current) return false;

    await video.play().catch(() => undefined);
    await waitForDecodedVideoFrame(video);

    return token === transitionTokenRef.current;
  }, []);

  const transitionToSource = useCallback(async (src: string, token: number) => {
    const currentSlot = visibleSlotRef.current;
    const nextSlot = otherSlot(currentSlot);
    const isReady = await prepareSlot(nextSlot, src, token);

    if (!isReady || token !== transitionTokenRef.current) return false;

    setVisibleSlot(nextSlot);

    window.setTimeout(() => {
      const previousVideo = videoRefs.current[currentSlot];
      if (!previousVideo || visibleSlotRef.current === currentSlot) return;
      previousVideo.pause();
    }, CROSSFADE_MS);

    return true;
  }, [prepareSlot, setVisibleSlot]);

  const completeCurrentSegment = useCallback(async (slot: Slot) => {
    if (slot !== visibleSlotRef.current || handoffInProgressRef.current) return;

    handoffInProgressRef.current = true;
    const plan = activePlanRef.current;
    const completedState = plan.state;
    const nextPlan = plan.mode === 'one-shot'
      ? plan.state === 'finishPerfect'
        ? buildPlaybackPlan('finishIdle')
        : buildIdlePlaybackPlan(plan.state === 'intro' ? 0 : POST_REACTION_IDLE_INDEX)
      : {
        ...plan,
        index: (plan.index + 1) % plan.sources.length,
      };
    const token = transitionTokenRef.current + 1;
    transitionTokenRef.current = token;

    const switched = await transitionToSource(nextPlan.sources[nextPlan.index], token);
    if (switched) {
      activePlanRef.current = nextPlan;
      if (plan.mode === 'one-shot') onStateCompleteRef.current?.(completedState);
    }

    handoffInProgressRef.current = false;
  }, [transitionToSource]);

  useEffect(() => {
    const visibleVideo = videoRefs.current[visibleSlot];
    if (!visibleVideo) return undefined;

    let cancelled = false;
    let frameHandle: number | undefined;
    let timeout: number | undefined;

    const schedule = () => {
      if (cancelled) return;

      const duration = Number.isFinite(visibleVideo.duration) ? visibleVideo.duration : 0;
      const shouldHandoff = duration > 0.35
        && visibleVideo.currentTime >= duration - END_HANDOFF_OFFSET_SECONDS;

      if (shouldHandoff || visibleVideo.ended) {
        void completeCurrentSegment(visibleSlot);
        return;
      }

      if (visibleVideo.requestVideoFrameCallback) {
        frameHandle = visibleVideo.requestVideoFrameCallback(() => schedule());
      } else {
        timeout = window.setTimeout(schedule, 50);
      }
    };

    schedule();

    return () => {
      cancelled = true;
      if (frameHandle && visibleVideo.cancelVideoFrameCallback) {
        visibleVideo.cancelVideoFrameCallback(frameHandle);
      }
      if (timeout) window.clearTimeout(timeout);
    };
  }, [completeCurrentSegment, visibleSlot]);

  useEffect(() => {
    const token = transitionTokenRef.current;
    void prepareSlot(0, INITIAL_SLOT_SRC, token);
    void prepareSlot(1, idleOwlPlaylist[1] || INITIAL_SLOT_SRC, token);
  }, [prepareSlot]);

  useEffect(() => {
    const requestedPlan = buildPlaybackPlan(state);
    const activePlan = activePlanRef.current;
    const requestedHasOwnVideo = (state as string) === 'idle'
      || Boolean(owlAssets[state]?.type === 'video');

    if (
      requestedPlan.mode === activePlan.mode
      && requestedPlan.sources[requestedPlan.index] === activePlan.sources[activePlan.index]
    ) {
      if (!requestedHasOwnVideo && (state as string) !== 'idle') {
        const timeout = window.setTimeout(() => onStateCompleteRef.current?.(state), 400);
        return () => window.clearTimeout(timeout);
      }
      return undefined;
    }

    const token = transitionTokenRef.current + 1;
    transitionTokenRef.current = token;
    let cancelled = false;

    void transitionToSource(requestedPlan.sources[0], token).then(switched => {
      if (cancelled || !switched) return;
      activePlanRef.current = requestedPlan;
      if (!requestedHasOwnVideo && (state as string) !== 'idle') {
        window.setTimeout(() => onStateCompleteRef.current?.(state), 400);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [state, transitionToSource]);

  const owlMediaClass = 'h-full w-full origin-bottom bg-transparent object-contain object-bottom translate-x-[7%] translate-y-[13%] scale-[1.46] md:translate-x-[10%] md:translate-y-[17%] md:scale-[1.54]';
  const showDarkThinkingEffect = state === 'thinking';
  const showDarkFinishEffect = state === 'finishPerfect';

  return (
    <div className={`relative flex w-full items-end justify-center overflow-visible bg-transparent ${className}`}>
      <div className="relative h-full w-full overflow-visible bg-transparent">
        {showDarkThinkingEffect && (
          <div className="pointer-events-none absolute left-[48%] top-[7%] z-20 hidden h-[clamp(5.5rem,10vw,8.5rem)] w-[clamp(5.5rem,10vw,8.5rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.72)_0%,rgba(250,204,21,0.34)_31%,rgba(168,85,247,0.18)_55%,rgba(168,85,247,0)_73%)] blur-[1px] dark:block animate-pulse" />
        )}
        {showDarkFinishEffect && (
          <div className="pointer-events-none absolute inset-0 z-20 hidden dark:block" aria-hidden="true">
            <img src="/ui/reward-star.png" alt="" draggable={false} className="absolute left-[22%] top-[18%] h-[clamp(2.1rem,4.2vw,3.7rem)] w-[clamp(2.1rem,4.2vw,3.7rem)] animate-bounce object-contain drop-shadow-[0_0_22px_rgba(250,204,21,0.75)]" />
            <img src="/ui/reward-star.png" alt="" draggable={false} className="absolute right-[18%] top-[24%] h-[clamp(1.65rem,3.2vw,2.9rem)] w-[clamp(1.65rem,3.2vw,2.9rem)] animate-pulse object-contain drop-shadow-[0_0_20px_rgba(250,204,21,0.7)]" />
            <img src="/ui/reward-star.png" alt="" draggable={false} className="absolute right-[28%] top-[8%] h-[clamp(1.35rem,2.65vw,2.35rem)] w-[clamp(1.35rem,2.65vw,2.35rem)] animate-bounce object-contain drop-shadow-[0_0_18px_rgba(250,204,21,0.68)] delay-300" />
            <span className="absolute left-[34%] top-[31%] h-3 w-3 rounded-full bg-fuchsia-200 shadow-[0_0_18px_rgba(232,121,249,0.95)] animate-ping" />
            <span className="absolute right-[34%] top-[42%] h-2.5 w-2.5 rounded-full bg-sky-200 shadow-[0_0_18px_rgba(125,211,252,0.9)] animate-ping delay-500" />
          </div>
        )}
        <video
          ref={node => {
            videoRefs.current[0] = node as OwlVideoElement | null;
          }}
          className={`${owlMediaClass} absolute inset-0 transition-opacity duration-150 ease-linear ${visibleSlot === 0 ? 'opacity-100' : 'opacity-0'}`}
          src={INITIAL_SLOT_SRC}
          muted
          playsInline
          preload="auto"
          autoPlay
          loop={false}
          controls={false}
          onEnded={() => void completeCurrentSegment(0)}
          onError={() => void completeCurrentSegment(0)}
        />
        <video
          ref={node => {
            videoRefs.current[1] = node as OwlVideoElement | null;
          }}
          className={`${owlMediaClass} absolute inset-0 transition-opacity duration-150 ease-linear ${visibleSlot === 1 ? 'opacity-100' : 'opacity-0'}`}
          muted
          playsInline
          preload="auto"
          loop={false}
          controls={false}
          onEnded={() => void completeCurrentSegment(1)}
          onError={() => void completeCurrentSegment(1)}
        />
      </div>
    </div>
  );
}
