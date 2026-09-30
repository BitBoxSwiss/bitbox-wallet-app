// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../../__mocks__/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Note } from './note';

it('keeps failed note edits and clears the error on editing or retrying', async () => {
  i18n.addResource('en', 'translation', 'unknownError', 'An unknown error occurred: {{errorMessage}}');
  const user = userEvent.setup();
  const onSave = vi.fn<(note: string) => Promise<void>>()
    .mockRejectedValue(new Error('Could not write notes'));
  render(<Note note="Saved note" onSave={onSave} />);
  const input = screen.getByRole('textbox', { name: 'note.title' });

  await user.clear(input);
  await user.type(input, 'Updated note');
  await user.tab();

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not write notes');
  expect(input).toHaveValue('Updated note');
  expect(onSave).toHaveBeenCalledWith('Updated note');

  await user.type(input, ' again');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not write notes');
  expect(input).toHaveValue('Updated note again');

  onSave.mockReturnValueOnce(new Promise<void>(() => {}));
  await user.keyboard('{Enter}');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(onSave).toHaveBeenCalledTimes(3);
  expect(onSave).toHaveBeenLastCalledWith('Updated note again');
  expect(input).toHaveValue('Updated note again');
});
