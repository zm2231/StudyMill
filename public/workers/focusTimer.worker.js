// Focus Timer Web Worker
// Keeps timer running independently of main thread
// Survives page navigation and tab focus changes

let timerId = null;
let timerState = {
  isRunning: false,
  isPaused: false,
  mode: 'focus', // 'focus', 'shortBreak', 'longBreak'
  timeRemaining: 25 * 60, // 25 minutes in seconds
  totalTime: 25 * 60,
  pomodoroCount: 0,
  startTime: null,
  lastUpdateTime: null
};

// Timer modes with default durations (in seconds)
const TIMER_MODES = {
  focus: 25 * 60,        // 25 minutes
  shortBreak: 5 * 60,    // 5 minutes
  longBreak: 15 * 60     // 15 minutes
};

// Restore state from localStorage on worker start
function restoreState() {
  try {
    // Note: Web Workers can't access localStorage directly
    // State will be sent from main thread on initialization
  } catch (error) {
    console.error('Failed to restore timer state:', error);
  }
}

function saveState() {
  // Send current state to main thread for localStorage persistence
  self.postMessage({
    type: 'SAVE_STATE',
    state: { ...timerState }
  });
}

function startTimer() {
  if (timerId) {
    clearInterval(timerId);
  }
  
  timerState.isRunning = true;
  timerState.isPaused = false;
  timerState.startTime = Date.now();
  timerState.lastUpdateTime = Date.now();
  
  // Update every second
  timerId = setInterval(() => {
    const now = Date.now();
    const elapsed = Math.floor((now - timerState.lastUpdateTime) / 1000);
    
    if (elapsed >= 1) {
      timerState.timeRemaining -= elapsed;
      timerState.lastUpdateTime = now;
      
      // Send update to main thread
      self.postMessage({
        type: 'TIMER_UPDATE',
        state: { ...timerState }
      });
      
      // Check if timer finished
      if (timerState.timeRemaining <= 0) {
        completeTimer();
      }
      
      // Save state periodically
      if (timerState.timeRemaining % 30 === 0) {
        saveState();
      }
    }
  }, 1000);
  
  saveState();
}

function pauseTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  
  timerState.isRunning = false;
  timerState.isPaused = true;
  
  self.postMessage({
    type: 'TIMER_PAUSED',
    state: { ...timerState }
  });
  
  saveState();
}

function resumeTimer() {
  if (timerState.timeRemaining > 0) {
    startTimer();
  }
}

function resetTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.timeRemaining = timerState.totalTime;
  timerState.startTime = null;
  timerState.lastUpdateTime = null;
  
  self.postMessage({
    type: 'TIMER_RESET',
    state: { ...timerState }
  });
  
  saveState();
}

function completeTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  
  const wasInFocusMode = timerState.mode === 'focus';
  
  // Update pomodoro count if completing focus session
  if (wasInFocusMode) {
    timerState.pomodoroCount++;
  }
  
  // Auto-switch to break mode
  let nextMode;
  if (wasInFocusMode) {
    // After focus: short break, or long break after 4 pomodoros
    nextMode = (timerState.pomodoroCount % 4 === 0) ? 'longBreak' : 'shortBreak';
  } else {
    // After any break: back to focus
    nextMode = 'focus';
  }
  
  timerState.mode = nextMode;
  timerState.totalTime = TIMER_MODES[nextMode];
  timerState.timeRemaining = TIMER_MODES[nextMode];
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.startTime = null;
  timerState.lastUpdateTime = null;
  
  self.postMessage({
    type: 'TIMER_COMPLETED',
    state: { ...timerState },
    completedMode: wasInFocusMode ? 'focus' : 'break',
    nextMode: nextMode
  });
  
  saveState();
}

function changeMode(mode, duration) {
  const wasRunning = timerState.isRunning;
  
  // Stop current timer
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  
  // Update state
  timerState.mode = mode;
  timerState.totalTime = duration || TIMER_MODES[mode];
  timerState.timeRemaining = timerState.totalTime;
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.startTime = null;
  timerState.lastUpdateTime = null;
  
  self.postMessage({
    type: 'MODE_CHANGED',
    state: { ...timerState }
  });
  
  // Auto-start if it was running before
  if (wasRunning) {
    startTimer();
  }
  
  saveState();
}

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'INIT':
      // Initialize with saved state from main thread
      if (payload.savedState) {
        timerState = { ...timerState, ...payload.savedState };
        
        // Resume timer if it was running
        if (timerState.isRunning && !timerState.isPaused) {
          // Calculate time that passed while worker was not running
          const now = Date.now();
          if (timerState.lastUpdateTime) {
            const timePassed = Math.floor((now - timerState.lastUpdateTime) / 1000);
            timerState.timeRemaining = Math.max(0, timerState.timeRemaining - timePassed);
            
            if (timerState.timeRemaining > 0) {
              timerState.lastUpdateTime = now;
              startTimer();
            } else {
              completeTimer();
            }
          }
        }
      }
      
      // Send initial state
      self.postMessage({
        type: 'INITIALIZED',
        state: { ...timerState }
      });
      break;
      
    case 'START':
      startTimer();
      break;
      
    case 'PAUSE':
      pauseTimer();
      break;
      
    case 'RESUME':
      resumeTimer();
      break;
      
    case 'RESET':
      resetTimer();
      break;
      
    case 'CHANGE_MODE':
      changeMode(payload.mode, payload.duration);
      break;
      
    case 'UPDATE_SETTINGS':
      // Update timer durations
      if (payload.settings) {
        Object.keys(payload.settings).forEach(key => {
          if (TIMER_MODES[key] !== undefined) {
            TIMER_MODES[key] = payload.settings[key] * 60; // Convert minutes to seconds
          }
        });
        
        // Update current timer if same mode
        if (payload.settings[timerState.mode] && !timerState.isRunning) {
          timerState.totalTime = TIMER_MODES[timerState.mode];
          timerState.timeRemaining = timerState.totalTime;
        }
      }
      break;
      
    case 'GET_STATE':
      self.postMessage({
        type: 'STATE_UPDATE',
        state: { ...timerState }
      });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};

// Initialize
restoreState();