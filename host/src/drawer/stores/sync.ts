import { writable } from 'svelte/store';
import { canvas } from './canvas';

// Создаем WebSocket соединение
let socket: WebSocket | null = null;
let roomId: string | null = null;
let reconnectTimer: number | null = null;
let lastUpdateTime = 0;
const UPDATE_THROTTLE = 100; // Минимальный интервал между обновлениями в мс

// Получаем ID комнаты из URL
const getRoomId = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
};

// Инициализация WebSocket соединения
export const initializeSync = () => {
  roomId = getRoomId();
  if (!roomId) return;

  // Очищаем предыдущий таймер переподключения, если он есть
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Для Netlify используем REST API вместо WebSocket
  syncStatus.set('connected');
};

// Отправка обновления холста другим пользователям
export const sendCanvasUpdate = (force = false) => {
  const now = Date.now();
  
  // Проверяем, прошло ли достаточно времени с последнего обновления
  if (!force && now - lastUpdateTime < UPDATE_THROTTLE) return;
  
  let canvasElement: HTMLCanvasElement | null = null;
  
  canvas.subscribe(value => {
    canvasElement = value;
  })();
  
  if (!canvasElement || !roomId) return;
  
  try {
    const imageDataUrl = canvasElement.toDataURL('image/png');
    
    // Сохраняем на сервере
    saveToServer(imageDataUrl);
    
    // Обновляем время последнего обновления
    lastUpdateTime = now;
  } catch (e) {
    console.error('Ошибка отправки обновления холста:', e);
  }
};

// Сохранение на сервере
const saveToServer = (imageDataUrl: string) => {
  if (!roomId) return;
  
  // Получаем имя доски из URL или используем дефолтное
  const boardName = new URLSearchParams(window.location.search).get('name') || `Доска ${roomId.substring(0, 6)}`;
  
  fetch(`/api/image?id=${roomId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      img: imageDataUrl,
      name: boardName
    })
  }).catch(err => console.error('Ошибка сохранения:', err));
};

// Статус синхронизации
export const syncStatus = writable<'connected' | 'disconnected' | 'error' | 'initializing'>('initializing');