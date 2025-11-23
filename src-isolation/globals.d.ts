export {};

type IsolationPayload = {
  cmd: string;
};

declare global {
  interface Window {
    __TAURI_ISOLATION_HOOK__: (payload: IsolationPayload) => IsolationPayload;
    E2E: MockData;
  }
}
