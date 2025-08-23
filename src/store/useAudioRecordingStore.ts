import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopping' | 'uploading' | 'completed' | 'error';

export interface AudioRecordingState {
  status: RecordingStatus;
  startTime: number | null;
  duration: number; // in seconds
  fileName: string | null;
  courseId: string | null;
  courseName: string | null;
  chunks: Blob[];
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  error: string | null;
  uploadProgress: number;
  isMinimized: boolean;
}

export interface AudioRecordingStore extends AudioRecordingState {
  // Actions
  startRecording: (courseId?: string, courseName?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  minimize: () => void;
  maximize: () => void;
  
  // Internal state management
  updateDuration: (duration: number) => void;
  addChunk: (chunk: Blob) => void;
  clearChunks: () => void;
  setError: (error: string | null) => void;
  setUploadProgress: (progress: number) => void;
  reset: () => void;
}

const initialState: AudioRecordingState = {
  status: 'idle',
  startTime: null,
  duration: 0,
  fileName: null,
  courseId: null,
  courseName: null,
  chunks: [],
  mediaRecorder: null,
  stream: null,
  error: null,
  uploadProgress: 0,
  isMinimized: false,
};

export const useAudioRecordingStore = create<AudioRecordingStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      startRecording: async (courseId, courseName) => {
        try {
          const state = get();
          
          // Don't start if already recording
          if (state.status === 'recording') {
            return;
          }

          // Request microphone access
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
            }
          });

          // Create MediaRecorder
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
              ? 'audio/webm;codecs=opus'
              : 'audio/webm'
          });

          const startTime = Date.now();
          const fileName = `recording-${startTime}.webm`;

          // Set up MediaRecorder events
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              get().addChunk(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            // This will be handled by stopRecording
          };

          mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            set({ 
              status: 'error',
              error: 'Recording error occurred'
            });
          };

          // Start recording
          mediaRecorder.start(1000); // Collect data every second

          set({
            status: 'recording',
            mediaRecorder,
            stream,
            startTime,
            fileName,
            courseId,
            courseName,
            chunks: [],
            error: null,
            duration: 0
          });

          // Start duration timer
          const durationTimer = setInterval(() => {
            const currentState = get();
            if (currentState.status === 'recording' && currentState.startTime) {
              const newDuration = Math.floor((Date.now() - currentState.startTime) / 1000);
              currentState.updateDuration(newDuration);
            } else {
              clearInterval(durationTimer);
            }
          }, 1000);

        } catch (error) {
          console.error('Failed to start recording:', error);
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to start recording'
          });
        }
      },

      stopRecording: async () => {
        const state = get();
        
        if (!state.mediaRecorder || state.status !== 'recording') {
          return;
        }

        set({ status: 'stopping' });

        // Stop the MediaRecorder
        state.mediaRecorder.stop();
        
        // Stop all tracks in the stream
        state.stream?.getTracks().forEach(track => track.stop());

        // Wait a moment for final data chunks
        setTimeout(async () => {
          await get().uploadRecording();
        }, 500);
      },

      pauseRecording: () => {
        const state = get();
        if (state.mediaRecorder && state.status === 'recording') {
          state.mediaRecorder.pause();
          set({ status: 'paused' });
        }
      },

      resumeRecording: () => {
        const state = get();
        if (state.mediaRecorder && state.status === 'paused') {
          state.mediaRecorder.resume();
          set({ status: 'recording' });
        }
      },

      cancelRecording: () => {
        const state = get();
        
        // Stop recording
        state.mediaRecorder?.stop();
        state.stream?.getTracks().forEach(track => track.stop());
        
        // Clear state
        set({
          ...initialState,
          status: 'idle'
        });
      },

      minimize: () => set({ isMinimized: true }),
      maximize: () => set({ isMinimized: false }),

      updateDuration: (duration) => set({ duration }),
      
      addChunk: (chunk) => set(state => ({ 
        chunks: [...state.chunks, chunk] 
      })),
      
      clearChunks: () => set({ chunks: [] }),
      
      setError: (error) => set({ error }),
      
      setUploadProgress: (progress) => set({ uploadProgress: progress }),

      reset: () => set(initialState),

      // Upload recording (non-persisted method)
      uploadRecording: async () => {
        const state = get();
        
        if (state.chunks.length === 0) {
          set({ status: 'error', error: 'No audio data to upload' });
          return;
        }

        try {
          set({ status: 'uploading', uploadProgress: 0 });

          // Create blob from chunks
          const audioBlob = new Blob(state.chunks, { type: 'audio/webm' });
          
          // Create FormData for upload
          const formData = new FormData();
          formData.append('audio', audioBlob, state.fileName || 'recording.webm');
          formData.append('title', `Audio Recording - ${new Date().toLocaleString()}`);
          formData.append('description', `Recorded for ${state.duration}s`);
          
          if (state.courseId) {
            formData.append('course_id', state.courseId);
          }

          // Upload to API
          const response = await fetch('/api/v1/audio', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          const result = await response.json();
          
          set({ 
            status: 'completed',
            uploadProgress: 100
          });

          // Reset after a delay
          setTimeout(() => {
            get().reset();
          }, 2000);

          return result;
        } catch (error) {
          console.error('Upload failed:', error);
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          });
        }
      }
    }),
    {
      name: 'audio-recording-storage',
      // Only persist essential state, not MediaRecorder objects
      partialize: (state) => ({
        status: state.status === 'recording' ? 'recording' : 'idle', // Keep recording status across navigation
        startTime: state.startTime,
        duration: state.duration,
        fileName: state.fileName,
        courseId: state.courseId,
        courseName: state.courseName,
        error: state.error,
        uploadProgress: state.uploadProgress,
        isMinimized: state.isMinimized,
        // Don't persist: chunks, mediaRecorder, stream (non-serializable)
      }),
      
      // Custom onRehydrateStorage to handle recording state restoration
      onRehydrateStorage: () => {
        return (state) => {
          if (state && state.status === 'recording') {
            // Recording was interrupted by navigation/refresh
            // We can't restore MediaRecorder state, so mark as error
            state.status = 'error';
            state.error = 'Recording was interrupted. Please start a new recording.';
          }
        };
      },
    }
  )
);