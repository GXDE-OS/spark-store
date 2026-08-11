export type UpdateSource = "aptss" | "apm";

export interface InstalledSourceState {
  aptss: boolean;
  apm: boolean;
}

export interface UpdateCenterItem {
  pkgname: string;
  name?: string;
  source: UpdateSource;
  currentVersion: string;
  nextVersion: string;
  arch?: string;
  category?: string;
  localIcon?: string;
  remoteIcon?: string;
  ignored?: boolean;
  downloadUrl?: string;
  fileName?: string;
  size?: number;
  sha512?: string;
  isMigration?: boolean;
  migrationSource?: UpdateSource;
  migrationTarget?: UpdateSource;
  aptssVersion?: string;
  // 更新发布时间（毫秒时间戳）；由上游解析填充，暂无则缺省
  updateTime?: number;
}
