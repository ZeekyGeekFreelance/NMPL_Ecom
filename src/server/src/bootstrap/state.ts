export interface BootState {
  migrationsApplied: boolean;
  configValidated: boolean;
  /** True once createApp() has completed: DB connected, Redis connected, all middleware mounted. */
  serverReady: boolean;
}

const state: BootState = {
  migrationsApplied: false,
  configValidated: false,
  serverReady: false,
};

export const bootState = state;
