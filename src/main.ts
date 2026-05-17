import { audioRecorder } from './audio-recorder';
import { generateNotes } from './llm-client';
import { WebSpeechRecognizer } from './web-speech-recognizer';
import type { AppStatus } from './types';

let speechRecognizer: WebSpeechRecognizer | null = null;
let currentStatus: AppStatus = 'ready';

const elements = {
  startBtn: document.getElementById('start-btn') as HTMLButtonElement,
  submitBtn: document.getElementById('submit-btn') as HTMLButtonElement,
  statusText: document.getElementById('status-text') as HTMLSpanElement,
  originalText: document.getElementById('original-text') as HTMLTextAreaElement,
  translationText: document.getElementById('translation-text') as HTMLPreElement,
  notesText: document.getElementById('notes-text') as HTMLPreElement,
  modelProgress: document.getElementById('model-progress') as HTMLDivElement,
  progressBar: document.getElementById('progress-bar') as HTMLDivElement,
};

function setOriginalTextEditable(editable: boolean): void {
  elements.originalText.disabled = !editable;
}

function updateSubmitButtonVisibility(): void {
  const hasText = elements.originalText.value.trim().length > 0;
  const canSubmit = currentStatus !== 'transcribing' && currentStatus !== 'generating';
  
  if (hasText && canSubmit) {
    elements.submitBtn.classList.remove('hidden');
  } else {
    elements.submitBtn.classList.add('hidden');
  }
}

function updateStatus(status: AppStatus, message?: string): void {
  currentStatus = status;
  const statusMessages: Record<AppStatus, string> = {
    ready: '就绪',
    recording: '录音中...',
    transcribing: '转录中...',
    generating: '生成笔记中...',
    complete: '完成',
    error: '错误',
  };

  elements.statusText.textContent = message || statusMessages[status];
  elements.statusText.className = `status-${status}`;

  elements.startBtn.disabled = status === 'transcribing' || status === 'generating';
  elements.startBtn.textContent =
    status === 'recording' ? '停止录音' : '开始录音';

  if (status === 'recording' || status === 'transcribing' || status === 'generating') {
    setOriginalTextEditable(false);
  } else {
    setOriginalTextEditable(true);
  }

  updateSubmitButtonVisibility();
}

function showError(message: string): void {
  console.error('[Main] 错误:', message);
  elements.originalText.value = `❌ 错误\n\n${message}`;
  elements.translationText.textContent = '';
  elements.notesText.textContent = '';
  updateStatus('error', message);
}

function clearResults(): void {
  elements.originalText.value = '';
  elements.translationText.textContent = '';
  elements.notesText.textContent = '';
  elements.submitBtn.classList.add('hidden');
}

function initSpeechRecognizer(): void {
  if (!WebSpeechRecognizer.isSupported()) {
    showError('您的浏览器不支持语音识别功能，请使用Chrome或Edge浏览器');
    elements.startBtn.disabled = true;
    return;
  }

  speechRecognizer = new WebSpeechRecognizer();
  console.log('[Main] Web Speech Recognizer 初始化完成');
}

async function handleStartRecording(): Promise<void> {
  if (currentStatus === 'recording') {
    await handleStopRecording();
    return;
  }

  if (!speechRecognizer) {
    initSpeechRecognizer();
    if (!speechRecognizer) {
      return;
    }
  }

  clearResults();
  updateStatus('recording');

  try {
    console.log('[Main] 开始录音和识别...');
    
    speechRecognizer.start(
      (text, isFinal) => {
        console.log('[Main] 收到语音识别结果:', text, 'isFinal:', isFinal);
        elements.originalText.value = text;
        updateSubmitButtonVisibility();
      },
      (error) => {
        console.error('[Main] 语音识别错误:', error);
        showError(error);
      },
      (listening) => {
        console.log('[Main] 监听状态:', listening);
        if (!listening && currentStatus === 'recording') {
          updateStatus('ready');
        }
      }
    );

    await audioRecorder.start();
    console.log('[Main] 录音已开始');
  } catch (error) {
    console.error('[Main] 启动失败:', error);
    showError(
      `无法开始录音: ${error instanceof Error ? error.message : '未知错误'}`
    );
    updateStatus('ready');
  }
}

async function handleStopRecording(): Promise<void> {
  try {
    console.log('[Main] 停止录音...');
    
    if (speechRecognizer) {
      speechRecognizer.stop();
    }
    
    await audioRecorder.stop();
    console.log('[Main] 录音已停止');

    updateStatus('ready');
  } catch (error) {
    console.error('[Main] 停止录音失败:', error);
    showError(
      `停止录音失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    updateStatus('ready');
  }
}

function handleSubmit(): void {
  const inputText = elements.originalText.value.trim();
  
  if (!inputText) {
    showError('原文为空，请先输入或录制内容');
    return;
  }

  if (currentStatus === 'recording' || currentStatus === 'transcribing' || currentStatus === 'generating') {
    return;
  }

  handleGenerateNotes(inputText);
}

async function handleGenerateNotes(text: string): Promise<void> {
  updateStatus('generating', '生成笔记中...');
  elements.submitBtn.classList.add('hidden');

  try {
    console.log('[Main] 调用LLM生成笔记...');
    const result = await generateNotes(text);
    console.log('[Main] 收到LLM响应');
    elements.translationText.textContent = result.translation;
    elements.notesText.textContent = result.notes;
    updateStatus('complete', '完成');
  } catch (error) {
    console.error('[Main] 生成笔记失败:', error);
    showError(
      `生成笔记失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    updateStatus('ready');
  }
}

function init(): void {
  console.log('[Main] 初始化应用...');
  elements.startBtn.addEventListener('click', handleStartRecording);
  elements.submitBtn.addEventListener('click', handleSubmit);

  elements.originalText.addEventListener('input', () => {
    updateSubmitButtonVisibility();
  });

  elements.originalText.addEventListener('paste', () => {
    setTimeout(updateSubmitButtonVisibility, 0);
  });

  elements.modelProgress.classList.add('hidden');

  updateStatus('ready', '就绪');
  initSpeechRecognizer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
