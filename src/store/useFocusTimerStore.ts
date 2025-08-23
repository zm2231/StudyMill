import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerSettings {
  focus: number;      // Duration in minutes
  shortBreak: number;
  longBreak: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  notifications: boolean;
  soundEnabled: boolean;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  mode: TimerMode;
  timeRemaining: number; // seconds
  totalTime: number;     // seconds  
  pomodoroCount: number;
  startTime: number | null;
  lastUpdateTime: number | null;
  status: TimerStatus;
}

export interface FocusTimerStore {
  // State
  worker: Worker | null;
  timerState: TimerState;
  settings: TimerSettings;
  isMinimized: boolean;
  
  // Actions
  initializeWorker: () => void;
  terminateWorker: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  changeMode: (mode: TimerMode) => void;
  updateSettings: (settings: Partial<TimerSettings>) => void;
  setMinimized: (minimized: boolean) => void;
  
  // Computed
  getFormattedTime: () => string;
  getProgress: () => number;
  getStatusText: () => string;
}

const DEFAULT_SETTINGS: TimerSettings = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  notifications: true,
  soundEnabled: true
};

const DEFAULT_TIMER_STATE: TimerState = {
  isRunning: false,
  isPaused: false,
  mode: 'focus',
  timeRemaining: 25 * 60,
  totalTime: 25 * 60,
  pomodoroCount: 0,
  startTime: null,
  lastUpdateTime: null,
  status: 'idle'
};

export const useFocusTimerStore = create<FocusTimerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      worker: null,
      timerState: DEFAULT_TIMER_STATE,
      settings: DEFAULT_SETTINGS,
      isMinimized: false,

      // Initialize Web Worker
      initializeWorker: () => {
        const state = get();
        
        // Don't initialize if already exists
        if (state.worker) return;
        
        try {
          const worker = new Worker('/workers/focusTimer.worker.js');
          
          worker.onmessage = (e) => {
            const { type, state: workerState, payload } = e.data;
            
            switch (type) {
              case 'INITIALIZED':
              case 'TIMER_UPDATE':
              case 'STATE_UPDATE':
                set((prevState) => ({
                  timerState: {
                    ...prevState.timerState,
                    ...workerState,
                    status: workerState.isRunning ? 'running' : 
                           workerState.isPaused ? 'paused' : 'idle'
                  }
                }));
                break;
                
              case 'TIMER_PAUSED':
                set((prevState) => ({
                  timerState: {
                    ...prevState.timerState,
                    ...workerState,
                    status: 'paused'
                  }
                }));
                break;
                
              case 'TIMER_RESET':
                set((prevState) => ({
                  timerState: {
                    ...prevState.timerState,
                    ...workerState,
                    status: 'idle'
                  }
                }));
                break;
                
              case 'TIMER_COMPLETED':
                const { completedMode, nextMode } = e.data;
                
                set((prevState) => ({
                  timerState: {
                    ...prevState.timerState,
                    ...workerState,
                    status: 'completed'
                  }
                }));
                
                // Show notification
                if (get().settings.notifications && 'Notification' in window) {
                  const message = completedMode === 'focus' 
                    ? `Great work! Time for a ${nextMode === 'longBreak' ? 'long' : 'short'} break.`
                    : 'Break time is over! Ready for another focus session?';
                    
                  new Notification('StudyMill Focus Timer', {
                    body: message,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png'
                  });
                }
                
                // Play sound if enabled
                if (get().settings.soundEnabled) {
                  // Create a simple beep sound
                  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const oscillator = audioContext.createOscillator();
                  const gainNode = audioContext.createGain();
                  
                  oscillator.connect(gainNode);
                  gainNode.connect(audioContext.destination);
                  
                  oscillator.frequency.value = completedMode === 'focus' ? 800 : 400;
                  oscillator.type = 'sine';
                  
                  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                  
                  oscillator.start(audioContext.currentTime);
                  oscillator.stop(audioContext.currentTime + 0.5);
                }
                
                // Auto-start next session if enabled
                setTimeout(() => {
                  const currentSettings = get().settings;
                  const shouldAutoStart = completedMode === 'focus' 
                    ? currentSettings.autoStartBreaks
                    : currentSettings.autoStartPomodoros;
                    
                  if (shouldAutoStart) {
                    get().startTimer();
                  }
                }, 1000);
                break;
                
              case 'MODE_CHANGED':
                set((prevState) => ({
                  timerState: {
                    ...prevState.timerState,
                    ...workerState,
                    status: 'idle'
                  }
                }));
                break;
                
              case 'SAVE_STATE':
                // Worker requested state save - this happens automatically via persist
                break;
                
              default:
                console.warn('Unknown worker message type:', type);
            }
          };
          
          worker.onerror = (error) => {
            console.error('Focus timer worker error:', error);
          };
          
          // Initialize worker with saved state
          worker.postMessage({
            type: 'INIT',
            payload: {
              savedState: {
                ...state.timerState,
                lastUpdateTime: Date.now()
              }
            }
          });
          
          set({ worker });
        } catch (error) {
          console.error('Failed to initialize focus timer worker:', error);
        }
      },

      // Terminate worker
      terminateWorker: () => {
        const { worker } = get();
        if (worker) {
          worker.terminate();
          set({ worker: null });
        }
      },

      // Timer controls
      startTimer: () => {
        const { worker } = get();
        worker?.postMessage({ type: 'START' });
      },

      pauseTimer: () => {
        const { worker } = get();
        worker?.postMessage({ type: 'PAUSE' });
      },

      resumeTimer: () => {
        const { worker } = get();
        worker?.postMessage({ type: 'RESUME' });
      },

      resetTimer: () => {
        const { worker } = get();
        worker?.postMessage({ type: 'RESET' });
      },

      changeMode: (mode: TimerMode) => {
        const { worker, settings } = get();
        const duration = settings[mode] * 60; // Convert to seconds
        worker?.postMessage({ 
          type: 'CHANGE_MODE', 
          payload: { mode, duration } 
        });
      },

      updateSettings: (newSettings: Partial<TimerSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
        
        // Update worker with new durations
        const { worker } = get();
        worker?.postMessage({
          type: 'UPDATE_SETTINGS',
          payload: { settings: get().settings }
        });
      },

      setMinimized: (minimized: boolean) => {
        set({ isMinimized: minimized });
      },

      // Computed values
      getFormattedTime: () => {
        const { timeRemaining } = get().timerState;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      },

      getProgress: () => {
        const { timeRemaining, totalTime } = get().timerState;
        if (totalTime === 0) return 0;
        return ((totalTime - timeRemaining) / totalTime) * 100;
      },

      getStatusText: () => {
        const { mode, status, pomodoroCount } = get().timerState;
        
        const modeText = {
          focus: 'Focus Time',
          shortBreak: 'Short Break',
          longBreak: 'Long Break'
        }[mode];
        
        const statusText = {
          idle: 'Ready',
          running: 'Active',
          paused: 'Paused',
          completed: 'Complete'
        }[status];
        
        return `${modeText} • ${statusText} • ${pomodoroCount} completed`;
      }
    }),
    {
      name: 'focus-timer-storage',
      partialize: (state) => ({
        timerState: state.timerState,
        settings: state.settings,
        isMinimized: state.isMinimized
      })
    }
  )
);

// Request notification permission on first use
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission === 'denied') {
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};