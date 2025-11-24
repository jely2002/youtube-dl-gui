import * as Sentry from '@sentry/browser';
import { Scope } from '@sentry/core';
import { computed, Ref, ref } from 'vue';
import { useToastStore } from '../stores/toast.ts';
import { useI18n } from 'vue-i18n';
import { useMediaDiagnosticsStore } from '../stores/media/diagnostics.ts';
import { firstSentence } from '../helpers/diagnostics.ts';
import { useLinkify } from './useLinkify.ts';

type DisplayDiagnostic = {
  shortMessage: string;
  message: string;
  raw: string;
};

export function useDiagnostic(diagnostic: Ref<MediaDiagnostic>, short = false) {
  const toastStore = useToastStore();
  const diagnosticsStore = useMediaDiagnosticsStore();

  const i18n = useI18n();
  const t = i18n.t;

  const { linkify } = useLinkify();

  const diagnosticDisplay = computed((): DisplayDiagnostic => {
    const i18nValues: Record<string, Record<string, string>> = i18n.tm('errors.runner');

    const message = diagnostic.value?.message ?? t('errors.runner.unknown.message');
    const linkifiedMessage = linkify(message);

    const raw = diagnostic.value?.raw ?? '';
    const linkifiedRaw = linkify(raw);

    const shortMessage = diagnostic.value.message
      ? firstSentence(diagnostic.value.message)
      : t('errors.runner.unknown.shortMessage');

    if (diagnostic.value?.code && diagnostic.value.code !== 'unknown') {
      return {
        message: linkifiedMessage,
        shortMessage,
        ...i18nValues[diagnostic.value.code],
        raw: linkifiedRaw,
      };
    } else if (short) {
      return {
        message: t('errors.runner.unknown.message'),
        shortMessage: t('errors.runner.unknown.shortMessage'),
        raw: linkifiedRaw,
      };
    } else {
      return {
        message: linkifiedMessage,
        shortMessage,
        raw: linkifiedRaw,
      };
    }
  });

  function report() {
    isReporting.value = true;
    try {
      Sentry.captureMessage(diagnosticDisplay.value.message, (scope: Scope) => {
        scope.setLevel('error');
        scope.setTag('user-reported', 'true');
        return scope;
      });
      toastStore.showToast(t('media.view.logs.toasts.reported'), { style: 'success' });
    } catch (e) {
      toastStore.showToast(t('media.view.logs.toasts.error'), { style: 'error' });
      console.error(e);
    } finally {
      isReporting.value = false;
      hasReported.value = true;
    }
  }

  const isReporting = ref(false);
  const hasReported = ref(false);

  const isReportable = computed(() => {
    return diagnostic.value.level === 'error' && diagnostic.value.code === 'unknown';
  });

  const relatedFatal = computed(() => {
    const fatals = diagnosticsStore.findFatalsByGroupId(diagnostic.value.groupId);
    return fatals.find(fatal => fatal.id === diagnostic.value?.id);
  });

  return { report, relatedFatal, isReportable, diagnosticDisplay, isReporting, hasReported };
}
