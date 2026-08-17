/**
 * 显示设置：全局字体大小档位（仅字号，不含整体缩放/字体族）。
 *
 * 实现原理：Tailwind 4 的 `text-*` 字号类均为 rem 单位（如 text-sm = 0.875rem），
 * 因此修改根元素 `html` 的 font-size 即可让全部 rem 字号类联动缩放。
 * 取值范围：14px(小) ~ 18px(特大)，默认 16px(标准)。
 *
 * 持久化：localStorage key = "spark-store-font-size"，存档位枚举字符串。
 */
export type FontSizeOption = "small" | "medium" | "large" | "xlarge" | "xxlarge";

interface FontSizeMeta {
  /** 应用到 html 的 font-size（px） */
  px: number;
  label: string;
}

export const FONT_SIZE_OPTIONS: Array<{
  value: FontSizeOption;
  label: string;
}> = [
  { value: "small", label: "小" },
  { value: "medium", label: "标准" },
  { value: "large", label: "大" },
  { value: "xlarge", label: "特大" },
  { value: "xxlarge", label: "超大" },
];

// 各档位对应的根字号。medium 保持现状 16px，向上放大、向下略缩。
const FONT_SIZE_MAP: Record<FontSizeOption, FontSizeMeta> = {
  small: { px: 15, label: "小" },
  medium: { px: 16, label: "标准" },
  large: { px: 17, label: "大" },
  xlarge: { px: 18, label: "特大" },
  xxlarge: { px: 20, label: "超大" },
};

const FONT_SIZE_STORAGE_KEY = "spark-store-font-size";
const DEFAULT_FONT_SIZE: FontSizeOption = "medium";

const isValidFontSize = (v: unknown): v is FontSizeOption =>
  typeof v === "string" && v in FONT_SIZE_MAP;

/** 读取持久化的字号档位（无/非法时回退默认「标准」） */
export const getFontSize = (): FontSizeOption => {
  try {
    const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (isValidFontSize(raw)) return raw;
  } catch {
    // localStorage 不可用时忽略，使用默认
  }
  return DEFAULT_FONT_SIZE;
};

/** 将字号档位应用到根元素 html（写入 inline font-size） */
export const applyFontSize = (option: FontSizeOption): void => {
  const meta = FONT_SIZE_MAP[option] ?? FONT_SIZE_MAP[DEFAULT_FONT_SIZE];
  document.documentElement.style.fontSize = `${meta.px}px`;
};

/** 选择并持久化字号档位，同时立即应用 */
export const setFontSize = (option: FontSizeOption): void => {
  applyFontSize(option);
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, option);
  } catch {
    // 持久化失败时仍已应用当前会话，忽略写入错误
  }
};

/**
 * 应用启动时初始化：从持久化恢复并使用，避免渲染瞬间闪烁。
 * 应在 App.vue 的 onMounted 最前调用（与 initTagPriorityStrategy 同级）。
 */
export const initFontSize = (): void => {
  applyFontSize(getFontSize());
};

/* ------------------------------------------------------------------ *
 * 界面整体缩放（Electron webContents.setZoomFactor）
 *
 * 与「字体大小」正交：字号只改 html font-size（rem 字号类），
 * 而界面缩放会连图标、间距、布局一起等比放大/缩小（逻辑分辨率变化）。
 * 实际缩放由主进程 setZoomFactor 执行；渲染端仅负责持久化档位偏好，
 * 并在启动时把档位换算的系数通过 IPC 告知主进程。
 * ------------------------------------------------------------------ */

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
 * 需在 App.vue onMounted 调用（initFontSize 之后或同级均可），
 * 主进程 createWindow 阶段已自有兜底（默认 1），此处确保渲染端偏好生效。
 */
export const initUiScale = async (): Promise<void> => {
  const factor = uiScaleToFactor(getUiScale());
  try {
    await window.ipcRenderer.invoke("set-zoom-factor", factor);
  } catch {
    // 主进程 IPC 不可用时忽略（主进程启动兜底已设为 1）
  }
};
