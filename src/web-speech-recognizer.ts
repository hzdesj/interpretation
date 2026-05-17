export class WebSpeechRecognizer {
  private recognition: any = null;
  private isListening = false;
  private onResultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onStatusChange: ((listening: boolean) => void) | null = null;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('您的浏览器不支持语音识别功能，请使用Chrome或Edge浏览器');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      
      const isFinal = event.results[event.results.length - 1].isFinal;
      
      if (this.onResultCallback) {
        this.onResultCallback(transcript, isFinal);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[WebSpeech] 语音识别错误:', event.error);
      this.stop();
      
      let errorMessage = '语音识别出错';
      switch (event.error) {
        case 'not-allowed':
          errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
          break;
        case 'no-speech':
          errorMessage = '未检测到语音输入';
          break;
        case 'aborted':
          errorMessage = '语音识别被中止';
          break;
        case 'audio-capture':
          errorMessage = '无法访问麦克风设备';
          break;
        case 'network':
          errorMessage = '网络连接失败，请检查网络';
          break;
      }

      if (this.onErrorCallback) {
        this.onErrorCallback(errorMessage);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStatusChange) {
        this.onStatusChange(false);
      }
    };
  }

  start(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onStatusChange: (listening: boolean) => void
  ) {
    if (this.isListening) {
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onStatusChange = onStatusChange;

    this.isListening = true;
    onStatusChange(true);
    
    try {
      this.recognition.start();
      console.log('[WebSpeech] 开始语音识别...');
    } catch (error) {
      this.isListening = false;
      onStatusChange(false);
      const errorMessage = error instanceof Error ? error.message : '启动失败';
      onError(errorMessage);
    }
  }

  stop() {
    if (!this.isListening) {
      return;
    }

    try {
      this.recognition.stop();
      this.isListening = false;
      if (this.onStatusChange) {
        this.onStatusChange(false);
      }
      console.log('[WebSpeech] 停止语音识别');
    } catch (error) {
      console.error('[WebSpeech] 停止时出错:', error);
    }
  }

  get isListeningNow() {
    return this.isListening;
  }

  static isSupported(): boolean {
    return !!(
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition
    );
  }
}
