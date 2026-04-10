export interface MainWindowCloseGuardState {
  installTaskCount: number;
  hasRunningUpdateCenterTasks: boolean;
}

export type MainWindowCloseAction = "hide" | "destroy";

export const shouldPreventMainWindowClose = (
  state: MainWindowCloseGuardState,
): boolean => state.installTaskCount > 0 || state.hasRunningUpdateCenterTasks;

export const getMainWindowCloseAction = (
  state: MainWindowCloseGuardState,
): MainWindowCloseAction =>
  shouldPreventMainWindowClose(state) ? "hide" : "destroy";
