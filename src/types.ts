export type AppStatus = 'ready' | 'recording' | 'transcribing' | 'generating' | 'complete' | 'error';

export interface WorkerMessage {
  type: 'init' | 'progress' | 'result' | 'error';
  progress?: number;
  text?: string;
  error?: string;
}

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  temperature?: number;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface ParsedLLMResult {
  translation: string;
  notes: string;
}

export interface AudioRecorderState {
  isRecording: boolean;
  stream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
}
