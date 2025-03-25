/**
 * Copyright 2022 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMountedRef } from './mount';

describe('useMountedRef', () => {
  it('should return true on mount and false on unmount', () => {
    const { result, unmount } = renderHook(() => useMountedRef());
    expect(result.current).toEqual({ current: true });
    unmount();
    expect(result.current).toEqual({ current: false });
  });
});
