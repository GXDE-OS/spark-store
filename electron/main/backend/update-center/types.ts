export type UpdateSource = "aptss" | "apm";

export interface InstalledSourceState {
  aptss: boolean;
  apm: boolean;
}

export interface UpdateCenterItem {
  pkgname: string;
  source: UpdateSource;
  currentVersion: string;
  nextVersion: string;
  ignored?: boolean;
  downloadUrl?: string;
  fileName?: string;
  size?: number;
  sha512?: string;
  isMigration?: boolean;
  migrationSource?: UpdateSource;
  migrationTarget?: UpdateSource;
  aptssVersion?: string;
}
