// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useRef, useState } from 'react';
import style from './dialog.module.css';

const DRAG_CLOSE_THRESHOLD_PERCENT = 0.10;

type TStatus = 'idle' | 'opening' | 'open' | 'closing';

type TProps = {
  children: React.ReactNode;
  status: TStatus;
  canClose: boolean;
  onDragClose: () => void;
  modalClass: string;
  modalRef: React.RefObject<HTMLDivElement>;
  contentContainerRef: React.RefObject<HTMLDivElement>;
};

export const MobileDialog = ({
  children,
  status,
  canClose,
  onDragClose,
  modalClass,
  modalRef,
  contentContainerRef,
}: TProps) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!canClose || status !== 'open') {
      return;
    }

    const contentContainer = contentContainerRef.current;
    if (contentContainer && contentContainer.scrollTop > 0) {
      return;
    }

    const touch = e.touches[0];
    if (touch) {
      dragStartY.current = touch.clientY;
      setIsDragging(true);
    }
  }, [canClose, status, contentContainerRef]);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) {
      return;
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) {
        return;
      }

      const touch = e.touches[0];
      if (touch) {
        const currentY = touch.clientY;
        const deltaY = currentY - dragStartY.current;

        if (deltaY > 0) {
          e.preventDefault();
          setDragY(deltaY);
        } else {
          setIsDragging(false);
          setDragY(0);
        }
      }
    };

    modal.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      modal.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, modalRef]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);
    const threshold = window.innerHeight * DRAG_CLOSE_THRESHOLD_PERCENT;

    if (dragY > threshold) {
      setDragY(0);
      onDragClose();
    } else {
      setDragY(0);
    }
  }, [isDragging, dragY, onDragClose]);

  const handleTouchCancel = useCallback(() => {
    setIsDragging(false);
    setDragY(0);
  }, []);

  const combinedModalClass = `
    ${modalClass}
    ${isDragging && style.dragging || ''}
  `.trim();

  const modalStyle: React.CSSProperties = dragY > 0
    ? { transform: `translateY(${dragY}px)` }
    : {};

  return (
    <div
      className={combinedModalClass}
      ref={modalRef}
      style={modalStyle}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {children}
    </div>
  );
};
