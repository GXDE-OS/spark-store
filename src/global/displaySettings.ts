/**
 * 显示设置：全局字体大小档位（仅字号，不含整体缩放/字体族）。
 *
 * 实现原理：Tailwind 4 的 `text-*` 字号类均为 rem 单位（如 text-sm = 0.875rem），
 * 因此修改根元素 `html` 的 font-size 即可让全部 rem 字号类联动缩放。
 * 取值范围：14px(小) ~ 18px(特大)，默认 16px(标准)。
 *
 * 持久化：localStorage key = "spark-store-font-size"，存档位枚举字符串。
 */
export type FontSizeOption = "small" | "medium" | "large" | "xlarge";

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
];

// 各档位对应的根字号。medium 保持现状 16px，向上放大、向下略缩。
const FONT_SIZE_MAP: Record<FontSizeOption, FontSizeMeta> = {
  small: { px: 15, label: "小" },
  medium: { px: 16, label: "标准" },
  large: { px: 17, label: "大" },
  xlarge: { px: 18, label: "特大" },
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
