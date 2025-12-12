// SPDX-License-Identifier: Apache-2.0

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    // surpress cursor icon
    event.dataTransfer.dropEffect = 'none';
  }
};

/**
 * Ignore files that are dropped into the window
 */
export const useIgnoreDrop = () => {
  document.addEventListener('dragover', onDrop);
  document.addEventListener('drop', onDrop);
  return () => {
    document.removeEventListener('dragover', onDrop);
    document.removeEventListener('drop', onDrop);
  };
};
