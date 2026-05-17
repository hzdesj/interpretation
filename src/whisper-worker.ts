import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: any = null;
let modelLoading = false;

const MODEL_ID = 'Xenova/whisper-tiny.en';

self.onmessage = async (event: MessageEvent) => {
  const { type, audioBlob } = event.data;

  if (type === 'init') {
    if (modelLoading) {
      self.postMessage({
        type: 'error',
        error: '模型正在加载中，请稍候...',
      });
      return;
    }

    if (transcriber) {
      self.postMessage({ type: 'progress', progress: 1 });
      return;
    }

    modelLoading = true;

    try {
      self.postMessage({ type: 'progress', progress: 0.1 });

      console.log('[Whisper Worker] 开始加载模型...');
      console.log('[Whisper Worker] 模型ID:', MODEL_ID);

      transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
        progress_callback: (progressInfo: any) => {
          console.log('[Whisper Worker] 进度:', progressInfo);
          if (progressInfo.status === 'progress') {
            const progressValue = (progressInfo.progress || 0) / 100;
            self.postMessage({
              type: 'progress',
              progress: 0.1 + progressValue * 0.9,
            });
          } else if (progressInfo.status === 'done') {
            console.log('[Whisper Worker] 模型加载完成');
          }
        },
      });

      modelLoading = false;
      self.postMessage({ type: 'progress', progress: 1 });
      console.log('[Whisper Worker] 模型就绪');
    } catch (error) {
      modelLoading = false;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('[Whisper Worker] 模型加载失败:', error);
      console.error('[Whisper Worker] 错误详情:', error);
      self.postMessage({
        type: 'error',
        error: `模型加载失败: ${errorMessage}\n\n可能原因：\n1. 网络连接问题\n2. HuggingFace无法访问\n3. 浏览器不支持WebAssembly`,
      });
    }
  } else if (type === 'transcribe') {
    if (!transcriber) {
      self.postMessage({
        type: 'error',
        error: '模型未加载，请先等待模型加载完成',
      });
      return;
    }

    try {
      console.log('[Whisper Worker] 开始转录...');

      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('[Whisper Worker] 音频数据大小:', arrayBuffer.byteLength, 'bytes');

      const audioContext = new AudioContext();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('[Whisper Worker] 音频采样率:', decodedBuffer.sampleRate);
      console.log('[Whisper Worker] 音频时长:', decodedBuffer.duration, '秒');

      const targetSampleRate = 16000;
      const downsampledBuffer = await downsampleBuffer(
        decodedBuffer,
        targetSampleRate
      );
      console.log('[Whisper Worker] 重采样后采样率:', downsampledBuffer.sampleRate);

      const float32Array = convertToFloat32Array(downsampledBuffer);
      console.log('[Whisper Worker] Float32Array长度:', float32Array.length);

      const result = await transcriber(float32Array, {
        task: 'transcribe',
        language: 'english',
      });

      console.log('[Whisper Worker] 转录结果:', result.text);
      self.postMessage({
        type: 'result',
        text: result.text.trim(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('[Whisper Worker] 转录失败:', error);
      self.postMessage({
        type: 'error',
        error: `转录失败: ${errorMessage}`,
      });
    }
  }
};

async function downsampleBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  const inputSampleRate = audioBuffer.sampleRate;
  const inputChannelData = audioBuffer.getChannelData(0);
  const length = Math.floor(
    (inputChannelData.length * targetSampleRate) / inputSampleRate
  );

  const offlineContext = new OfflineAudioContext(1, length, targetSampleRate);
  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineContext.destination);
  bufferSource.start();

  return await offlineContext.startRendering();
}

function convertToFloat32Array(buffer: AudioBuffer): Float32Array {
  return buffer.getChannelData(0);
}
