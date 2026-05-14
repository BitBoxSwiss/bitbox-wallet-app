// SPDX-License-Identifier: Apache-2.0

import type { TConfig } from '@/api/config';

const emptyBackendConfig = (): TConfig['backend'] => ({} as TConfig['backend']);

const emptyFrontendConfig = (): TConfig['frontend'] => ({});

export const mockConfig = (overrides: Partial<TConfig> = {}): TConfig => ({
  backend: { ...emptyBackendConfig(), ...overrides.backend },
  frontend: { ...emptyFrontendConfig(), ...overrides.frontend },
});
