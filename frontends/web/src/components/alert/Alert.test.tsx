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

import { render, fireEvent, act } from '@testing-library/react';
import I18NWrapper from '../../i18n/forTests/i18nwrapper';
import { Alert, alertUser } from './Alert';

describe('Alert', () => {

  beforeAll(() => {
    window.matchMedia = window.matchMedia || function(query) {
      return {
        matches: false,
        media: query,
        onchange: null,
        // addListener: jest.fn(), // deprecated
        // removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    };
  });

  function renderAlert() {
    return render(<Alert/>, { wrapper: I18NWrapper });
  }

  it('should render the Alert component properly', () => {
    // render the Alert component
    const { getByText, getByRole } = renderAlert();

    act(() => {
      // trigger the alertUser function
      alertUser('This is a test alert message');
    });

    // assert that the message and the OK button are rendered
    expect(getByText('This is a test alert message')).toBeInTheDocument();
    expect(getByRole('button')).toBeInTheDocument();
  });

  it('should call the callback function when OK button is clicked', () => {
    // define a mock callback function
    const mockCallback = jest.fn();

    // render the Alert component
    const { getByRole, container } = renderAlert();

    act(() => {
      // trigger the alertUser function
      alertUser('This is a test alert message', { callback: mockCallback });
    });

    // simulate clicking on the OK button
    fireEvent.click(getByRole('button'));

    // assert that the mock callback function was called
    expect(mockCallback).toHaveBeenCalled();

    // assert that the alert has been dismissed
    expect(container.firstChild).toBeNull();
  });

  it('should use the asDialog option when specified', () => {
    // render the Alert component
    const { container } = renderAlert();

    act(() => {
      // trigger the alertUser function with asDialog: false
      alertUser('This is a test alert message', { asDialog: false });
    });

    // assert that the element is not rendered as a dialog
    expect(container.querySelector('.dialog')).not.toBeInTheDocument();
  });
});