/**
 * 显示设置：界面整体缩放（Electron webContents.setZoomFactor）
 *
 * 通过 Electron 的 setZoomFactor 整体缩放渲染内容，连图标、间距、布局
 * 一起等比放大/缩小（逻辑分辨率变化），不会破坏布局；与单纯改字号相比
 * 更稳定，故本应用只提供此一种显示放大入口。
 *
 * 实际缩放由主进程 setZoomFactor 执行；渲染端仅负责持久化档位偏好，
 * 并在启动时把档位换算的系数通过 IPC 告知主进程。
 */

export type UiScaleOption = "90" | "100" | "110" | "125" | "150";

// 档位 → 缩放系数（与 Electron setZoomFactor 一致，1 = 100%）
const UI_SCALE_MAP: Record<UiScaleOption, number> = {
  "90": 0.9,
  "100": 1,
  "110": 1.1,
  "125": 1.25,
  "150": 1.5,
};

export const UI_SCALE_OPTIONS: Array<{
  value: UiScaleOption;
  label: string;
}> = [
  { value: "90", label: "90%" },
  { value: "100", label: "100%" },
  { value: "110", label: "110%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150%" },
];

const UI_SCALE_STORAGE_KEY = "spark-store-ui-scale";
const DEFAULT_UI_SCALE: UiScaleOption = "100";

const isValidUiScale = (v: unknown): v is UiScaleOption =>
  typeof v === "string" && v in UI_SCALE_MAP;

/** 读取持久化的界面缩放档位（无/非法时回退默认「100%」） */
export const getUiScale = (): UiScaleOption => {
  try {
    const raw = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (isValidUiScale(raw)) return raw;
  } catch {
    // localStorage 不可用时忽略，使用默认
  }
  return DEFAULT_UI_SCALE;
};

/** 将档位换算为 Electron 缩放系数 */
export const uiScaleToFactor = (option: UiScaleOption): number =>
  UI_SCALE_MAP[option] ?? UI_SCALE_MAP[DEFAULT_UI_SCALE];

/** 选择并持久化界面缩放档位（不在此直接调用主进程，由调用方经 IPC 应用） */
export const setUiScale = (option: UiScaleOption): void => {
  try {
    localStorage.setItem(UI_SCALE_STORAGE_KEY, option);
  } catch {
    // 持久化失败时仍已在会话内选定，忽略写入错误
  }
};

/**
 * 应用启动时初始化：从持久化恢复档位，并经 IPC 告知主进程应用缩放。
 * 需在 App.vue onMounted 调用，主进程 createWindow 阶段已自有兜底（默认 1），
 * 此处确保渲染端偏好生效。
 */
export const initUiScale = async (): Promise<void> => {
  const factor = uiScaleToFactor(getUiScale());
  try {
    await window.ipcRenderer.invoke("set-zoom-factor", factor);
  } catch {
    // 主进程 IPC 不可用时忽略（主进程启动兜底已设为 1）
  }
};
