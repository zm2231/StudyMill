'use client';

import { Modal } from '@mantine/core';
import { FocusTimer } from './FocusTimer';
import { useTimerContext } from '@/contexts/TimerContext';

export function TimerModal() {
  const { showFullTimer, closeFullTimer } = useTimerContext();

  return (
    <Modal
      opened={showFullTimer}
      onClose={closeFullTimer}
      title="Focus Timer"
      size="lg"
      centered
      closeButtonProps={{ 'aria-label': 'Close timer' }}
    >
      <FocusTimer 
        variant="full" 
        onMinimize={closeFullTimer}
        onClose={closeFullTimer}
      />
    </Modal>
  );
}