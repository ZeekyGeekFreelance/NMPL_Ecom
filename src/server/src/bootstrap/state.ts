export interface BootState {
  migrationsApplied: boolean;
  configValidated: boolean;
}

const state: BootState = {
  migrationsApplied: false,
  configValidated: false,
};

export const bootState = state;
