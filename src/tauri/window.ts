import { computed, ref, watch } from 'vue';
import { getCurrentWindow, ProgressBarStatus, UserAttentionType } from '@tauri-apps/api/window';
import { useMediaProgressStore } from '../stores/media/progress';
import { MediaState, useMediaStateStore } from '../stores/media/state';

export function startWindowSync(): void {
  const windowHandle = getCurrentWindow();
  const progressStore = useMediaProgressStore();
  const stateStore = useMediaStateStore();

  const previousActiveDownloadCount = ref(0);
  const attentionCooldownUntilMs = ref(0);
  const aggregateProgress = computed(() => progressStore.findAllProgress());

  function clampPercent0to100(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  function computeAggregatePercent(done: number, total: number): number | undefined {
    if (total <= 0) return undefined;
    return Math.round(clampPercent0to100((done / total) * 100));
  }

  function findActiveItemPercentIfSingleDownloading(): number | undefined {
    const entries = Object.entries(progressStore.progress);

    for (const [mediaId, itemProgress] of entries) {
      const mediaState = stateStore.getState(mediaId);

      if (mediaState === MediaState.downloading || mediaState === MediaState.downloadingList) {
        const percent = itemProgress.percentage;

        if (typeof percent === 'number' && Number.isFinite(percent)) {
          return Math.round(clampPercent0to100(percent));
        }

        return undefined;
      }
    }

    return undefined;
  }

  async function setDockOrTaskbarBadge(activeDownloadCount: number): Promise<void> {
    try {
      await windowHandle.setBadgeCount(activeDownloadCount > 0 ? activeDownloadCount : undefined);
    } catch {
      // ignore (some platforms may not support this)
    }
  }

  async function setProgressBarState(params: {
    activeDownloadCount: number;
    doneCount: number;
    totalCount: number;
  }): Promise<void> {
    const { activeDownloadCount, doneCount, totalCount } = params;

    try {
      if (activeDownloadCount <= 0) {
        await windowHandle.setProgressBar({ status: ProgressBarStatus.None });
        return;
      }

      if (activeDownloadCount === 1) {
        const singleItemPercent = findActiveItemPercentIfSingleDownloading();
        if (typeof singleItemPercent === 'number') {
          await windowHandle.setProgressBar({
            status: ProgressBarStatus.Normal,
            progress: singleItemPercent,
          });
          return;
        }
      }

      const aggregatePercent = computeAggregatePercent(doneCount, totalCount);
      if (typeof aggregatePercent === 'number') {
        await windowHandle.setProgressBar({
          status: ProgressBarStatus.Normal,
          progress: aggregatePercent,
        });
        return;
      }

      await windowHandle.setProgressBar({ status: ProgressBarStatus.Indeterminate });
    } catch {
      // ignore (some platforms may not support this)
    }
  }

  async function maybeRequestUserAttention(params: {
    activeDownloadCount: number;
    readyCount: number;
  }): Promise<void> {
    const { activeDownloadCount, readyCount } = params;

    const wasPreviouslyDownloading = previousActiveDownloadCount.value > 0;
    const queueIsFinished = activeDownloadCount === 0 && readyCount === 0;

    if (!wasPreviouslyDownloading || !queueIsFinished) return;

    const nowMs = Date.now();
    if (nowMs < attentionCooldownUntilMs.value) return;

    attentionCooldownUntilMs.value = nowMs + 2000;
    try {
      await windowHandle.requestUserAttention(UserAttentionType.Informational);
    } catch {
      // ignore
    }
  }

  async function syncWindowState(): Promise<void> {
    const activeDownloadCount = aggregateProgress.value.downloading ?? 0;
    const doneCount = aggregateProgress.value.done ?? 0;
    const totalCount = aggregateProgress.value.total ?? 0;
    const readyCount = aggregateProgress.value.ready ?? 0;

    await setDockOrTaskbarBadge(activeDownloadCount + readyCount);

    await setProgressBarState({
      activeDownloadCount,
      doneCount,
      totalCount,
    });

    await maybeRequestUserAttention({
      activeDownloadCount,
      readyCount,
    });

    previousActiveDownloadCount.value = activeDownloadCount;
  }

  watch(
    () => ({
      aggregate: aggregateProgress.value,
      perItem: progressStore.progress,
    }),
    () => {
      void syncWindowState();
    },
    { immediate: true, deep: true },
  );
}
