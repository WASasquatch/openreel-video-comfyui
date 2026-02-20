export type ClockState = "stopped" | "playing" | "paused";

export interface ClockSubscriber {
  onTimeUpdate: (time: number) => void;
  onStateChange?: (state: ClockState) => void;
}

export interface ClockOptions {
  audioContext?: AudioContext;
  frameRate?: number;
}

export class MasterTimelineClock {
  private audioContext: AudioContext;
  private state: ClockState = "stopped";
  private playbackRate: number = 1.0;

  private startAudioContextTime: number = 0;
  private startTimelineTime: number = 0;
  private pausedAt: number = 0;

  private duration: number = 0;
  private loopEnabled: boolean = false;
  private loopStart: number = 0;
  private loopEnd: number = 0;

  private subscribers: Set<ClockSubscriber> = new Set();
  private animationFrameId: number | null = null;

  private frameRate: number;
  private frameDuration: number;

  private _lastVideoTime: number = 0;
  private driftMs: number = 0;

  constructor(options: ClockOptions = {}) {
    this.audioContext = options.audioContext || new AudioContext();
    this.frameRate = options.frameRate || 30;
    this.frameDuration = 1000 / this.frameRate;
  }

  get currentTime(): number {
    if (this.state === "stopped" || this.state === "paused")
      return this.pausedAt;

    const elapsed =
      (this.audioContext.currentTime - this.startAudioContextTime) *
      this.playbackRate;
    let time = this.startTimelineTime + elapsed;

    if (this.loopEnabled && this.loopEnd > this.loopStart) {
      if (time >= this.loopEnd) {
        const loopDuration = this.loopEnd - this.loopStart;
        time = this.loopStart + ((time - this.loopStart) % loopDuration);
      }
    }

    return Math.max(0, Math.min(time, this.duration || Infinity));
  }

  get isPlaying(): boolean {
    return this.state === "playing";
  }

  get isPaused(): boolean {
    return this.state === "paused";
  }

  get isStopped(): boolean {
    return this.state === "stopped";
  }

  get rate(): number {
    return this.playbackRate;
  }

  get drift(): number {
    return this.driftMs;
  }

  get lastReportedVideoTime(): number {
    return this._lastVideoTime;
  }

  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  setDuration(duration: number): void {
    // console.log(`[MasterClock] setDuration called - changing from ${this.duration}s to ${duration}s`);
    // console.trace('[MasterClock] setDuration call stack');
    this.duration = duration;
  }

  setLoop(enabled: boolean, start: number = 0, end: number = 0): void {
    this.loopEnabled = enabled;
    this.loopStart = start;
    this.loopEnd = end;
  }

  setPlaybackRate(rate: number): void {
    if (this.state === "playing") {
      const currentTime = this.currentTime;
      this.startTimelineTime = currentTime;
      this.startAudioContextTime = this.audioContext.currentTime;
    }
    this.playbackRate = Math.max(0.1, Math.min(rate, 16));
  }

  async play(): Promise<void> {
    if (this.state === "playing") return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.startTimelineTime = this.pausedAt;
    this.startAudioContextTime = this.audioContext.currentTime;
    this.state = "playing";

    this.notifyStateChange();
    this.startUpdateLoop();
  }

  pause(): void {
    if (this.state !== "playing") return;

    this.pausedAt = this.currentTime;
    this.state = "paused";

    this.stopUpdateLoop();
    this.notifyStateChange();
  }

  stop(): void {
    this.pausedAt = 0;
    this.state = "stopped";

    this.stopUpdateLoop();
    this.notifyStateChange();
    this.notifyTimeUpdate(0);
  }

  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this.duration || Infinity));

    if (this.state === "playing") {
      this.startTimelineTime = clampedTime;
      this.startAudioContextTime = this.audioContext.currentTime;
    } else {
      this.pausedAt = clampedTime;
    }

    this.notifyTimeUpdate(clampedTime);
  }

  seekRelative(delta: number): void {
    this.seek(this.currentTime + delta);
  }

  subscribe(subscriber: ClockSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  reportVideoTime(videoTime: number): void {
    this._lastVideoTime = videoTime;
    const audioTime = this.currentTime;
    this.driftMs = (audioTime - videoTime) * 1000;
  }

  shouldSkipFrame(): boolean {
    return this.driftMs > this.frameDuration;
  }

  shouldRepeatFrame(): boolean {
    return this.driftMs < -this.frameDuration;
  }

  private startUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      console.log(`[MasterClock] startUpdateLoop called but animation frame already exists`);
      return;
    }

    // console.log(`[MasterClock] Starting update loop - duration: ${this.duration}s, loopEnabled: ${this.loopEnabled}`);

    const update = () => {
      if (this.state !== "playing") {
        console.log(`[MasterClock] Update loop stopped - state is ${this.state}`);
        return;
      }

      // Calculate unclamped time for duration check
      const elapsed =
        (this.audioContext.currentTime - this.startAudioContextTime) *
        this.playbackRate;
      const unclampedTime = this.startTimelineTime + elapsed;

      // Stop if we've reached the duration (check unclamped time)
      if (this.duration > 0 && unclampedTime >= this.duration && !this.loopEnabled) {
        // console.log(`[MasterClock] ⛔ STOPPING PLAYBACK - unclamped: ${unclampedTime.toFixed(3)}s >= duration: ${this.duration}s, loop: ${this.loopEnabled}`);
        // Pause and seek to exact duration
        this.pausedAt = this.duration;
        this.state = "paused";
        this.notifyStateChange();
        // console.log(`[MasterClock] State set to paused, notifying subscribers`);
        this.notifyStateChange();
        this.notifyTimeUpdate(this.duration);
        // console.log(`[MasterClock] Pause complete - final time: ${this.duration}s`);
        return;
      }

      const time = this.currentTime;
      
      // Log every second
      // if (Math.floor(time) !== Math.floor(time - 0.033)) {
      //   console.log(`[MasterClock] Playing - time: ${time.toFixed(2)}s, unclamped: ${unclampedTime.toFixed(2)}s, duration: ${this.duration}s`);
      // }
      
      this.notifyTimeUpdate(time);
      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  private stopUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private notifyTimeUpdate(time: number): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.onTimeUpdate(time);
      } catch (error) {
        console.error("[MasterClock] Subscriber error:", error);
      }
    }
  }

  private notifyStateChange(): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.onStateChange?.(this.state);
      } catch (error) {
        console.error("[MasterClock] Subscriber error:", error);
      }
    }
  }

  dispose(): void {
    this.stopUpdateLoop();
    this.subscribers.clear();
    this.state = "stopped";
  }
}

let masterClockInstance: MasterTimelineClock | null = null;

export function getMasterClock(): MasterTimelineClock {
  if (!masterClockInstance) {
    masterClockInstance = new MasterTimelineClock();
  }
  return masterClockInstance;
}

export function initializeMasterClock(
  options: ClockOptions = {},
): MasterTimelineClock {
  if (masterClockInstance) {
    masterClockInstance.dispose();
  }
  masterClockInstance = new MasterTimelineClock(options);
  return masterClockInstance;
}

export function disposeMasterClock(): void {
  if (masterClockInstance) {
    masterClockInstance.dispose();
    masterClockInstance = null;
  }
}
