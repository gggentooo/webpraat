/**
 * Web Audio Playback Engine Hook for WebPraat.
 * Drives audio playback with sub-millisecond precision and synchronizes
 * an animated playhead cursor via requestAnimationFrame.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseAudioOptions {
  sampleRate: number;
  channels: Float64Array[];
  duration: number;
}

export interface UseAudioReturn {
  isPlaying: boolean;
  playheadTime: number;
  play: (startTime?: number, endTime?: number) => Promise<void>;
  stop: () => void;
  seek: (time: number) => void;
}

export function useAudio(options: UseAudioOptions | null): UseAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Playback tracking
  const startTimeRef = useRef<number>(0); // AudioContext.currentTime when playback started
  const startOffsetRef = useRef<number>(0); // Position in sound (seconds) when playback started
  const endOffsetRef = useRef<number>(0); // Position in sound (seconds) when playback should stop

  // Build or update AudioBuffer when options change
  useEffect(() => {
    if (!options || options.channels.length === 0 || options.duration <= 0) {
      audioBufferRef.current = null;
      return;
    }

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContextClass();
    }

    const ctx = audioCtxRef.current;
    const numChannels = options.channels.length;
    const numSamples = options.channels[0].length;

    try {
      const buffer = ctx.createBuffer(numChannels, numSamples, options.sampleRate);
      for (let ch = 0; ch < numChannels; ++ch) {
        const chData = buffer.getChannelData(ch);
        const sourceData = options.channels[ch];
        for (let i = 0; i < numSamples; ++i) {
          chData[i] = sourceData[i];
        }
      }
      audioBufferRef.current = buffer;
    } catch (err) {
      console.error('Failed to create AudioBuffer:', err);
    }
  }, [options]);

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }

    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    stop();
    setPlayheadTime(time);
  }, [stop]);

  const updatePlayhead = useCallback(() => {
    if (!audioCtxRef.current) return;

    const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
    const current = startOffsetRef.current + elapsed;

    if (current >= endOffsetRef.current) {
      setPlayheadTime(endOffsetRef.current);
      stop();
    } else {
      setPlayheadTime(current);
      rafIdRef.current = requestAnimationFrame(updatePlayhead);
    }
  }, [stop]);

  const play = useCallback(
    async (start?: number, end?: number) => {
      stop();

      if (!options || !audioBufferRef.current || options.duration <= 0) return;

      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const tStart = Math.max(0, Math.min(start ?? playheadTime, options.duration));
      let tEnd = end !== undefined ? Math.min(end, options.duration) : options.duration;
      if (tEnd <= tStart) {
        tEnd = options.duration;
      }
      const playDuration = tEnd - tStart;
      if (playDuration <= 0.001) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(ctx.destination);

      source.onended = () => {
        if (sourceNodeRef.current === source) {
          stop();
        }
      };

      startOffsetRef.current = tStart;
      endOffsetRef.current = tEnd;
      startTimeRef.current = ctx.currentTime;

      source.start(0, tStart, playDuration);
      sourceNodeRef.current = source;
      setIsPlaying(true);
      setPlayheadTime(tStart);

      rafIdRef.current = requestAnimationFrame(updatePlayhead);
    },
    [options, playheadTime, stop, updatePlayhead]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
    };
  }, [stop]);

  return {
    isPlaying,
    playheadTime,
    play,
    stop,
    seek,
  };
}
