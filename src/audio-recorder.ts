import type { AudioRecorderState } from './types';

class AudioRecorder {
  private state: AudioRecorderState = {
    isRecording: false,
    stream: null,
    mediaRecorder: null,
    chunks: [],
  };

  async start(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.state.stream = stream;
      this.state.chunks = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      this.state.mediaRecorder = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.state.chunks.push(event.data);
        }
      };

      mediaRecorder.start(100);
      this.state.isRecording = true;
    } catch (error) {
      this.cleanup();
      throw new Error(
        `无法访问麦克风: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.state.mediaRecorder || !this.state.isRecording) {
        reject(new Error('未在录音状态'));
        return;
      }

      const mediaRecorder = this.state.mediaRecorder;

      mediaRecorder.onstop = () => {
        const blob = new Blob(this.state.chunks, {
          type: 'audio/webm',
        });
        this.cleanup();
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        this.cleanup();
        reject(new Error(`录音错误: ${event}`));
      };

      mediaRecorder.stop();
      this.state.isRecording = false;
    });
  }

  private cleanup(): void {
    if (this.state.stream) {
      this.state.stream.getTracks().forEach((track) => track.stop());
      this.state.stream = null;
    }
    this.state.mediaRecorder = null;
    this.state.chunks = [];
    this.state.isRecording = false;
  }

  isRecording(): boolean {
    return this.state.isRecording;
  }
}

export const audioRecorder = new AudioRecorder();
