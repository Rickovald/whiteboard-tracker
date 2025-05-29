import { writable } from 'svelte/store';
import { canvas } from './canvas';

// Создаем WebSocket соединение
let socket: WebSocket | null = null;
let roomId: string | null = null;
let reconnectTimer: number | null = null;
let lastUpdateTime = 0;
let connectionAttempts = 0;
const UPDATE_THROTTLE = 100; // Минимальный интервал между обновлениями в мс
let isReconnecting = false;
let heartbeatInterval: number | null = null;

// Получаем ID комнаты из URL
const getRoomId = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
};

// Инициализация WebSocket соединения
export const initializeSync = () => {
  // Если уже идет процесс переподключения, не запускаем новый
  if (isReconnecting) return;
  
  roomId = getRoomId();
  if (!roomId) return;

  // Очищаем предыдущий таймер переподключения, если он есть
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Очищаем интервал проверки соединения
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Закрываем предыдущее соединение, если оно есть
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.onopen = null;
    try {
      socket.close();
    } catch (e) {
      console.error('Ошибка при закрытии сокета:', e);
    }
    socket = null;
  }

  isReconnecting = true;
  
  try {
    // Используем фиксированный порт 5000 для WebSocket соединения
    socket = new WebSocket(`ws://localhost:5000/whiteboard/${roomId}`);

    socket.onopen = () => {
      console.log('WebSocket соединение установлено');
      syncStatus.set('connected');
      connectionAttempts = 0;
      isReconnecting = false;
      
      // Запрашиваем текущее состояние доски при подключении
      requestInitialState();
      
      // Устанавливаем интервал для отправки heartbeat
      heartbeatInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {
            console.error('Ошибка отправки пинга:', e);
            clearInterval(heartbeatInterval!);
            handleReconnect();
          }
        } else {
          clearInterval(heartbeatInterval!);
          handleReconnect();
        }
      }, 15000);
    };

    socket.onclose = (event) => {
      console.log('WebSocket соединение закрыто', event.code, event.reason);
      syncStatus.set('disconnected');
      handleReconnect();
    };

    socket.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
      syncStatus.set('error');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'canvas_update') {
          updateCanvasFromSync(data.imageData);
        } else if (data.type === 'initial_state_request') {
          sendCanvasUpdate(true);
        } else if (data.type === 'pong') {
          // Получили ответ на пинг, соединение активно
        }
      } catch (error) {
        console.error('Ошибка при обработке сообщения:', error);
      }
    };
  } catch (e) {
    console.error('Ошибка инициализации WebSocket:', e);
    syncStatus.set('error');
    isReconnecting = false;
    handleReconnect();
  }
};

// Обработка переподключения
const handleReconnect = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  isReconnecting = true;
  connectionAttempts++;
  
  // Фиксированная задержка 3 секунды
  const delay = 3000;
  
  console.log(`Переподключение через ${delay}мс (попытка ${connectionAttempts})`);
  reconnectTimer = setTimeout(() => {
    initializeSync();
  }, delay);
};

// Запрос начального состояния доски
const requestInitialState = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  
  try {
    socket.send(JSON.stringify({
      type: 'initial_state_request',
      roomId
    }));
  } catch (e) {
    console.error('Ошибка запроса начального состояния:', e);
    handleReconnect();
  }
};

// Обновление холста из полученных данных
const updateCanvasFromSync = (imageDataUrl: string) => {
  let canvasElement: HTMLCanvasElement | null = null;
  
  canvas.subscribe(value => {
    canvasElement = value;
  })();
  
  if (!canvasElement) return;
  
  const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
  };
  img.src = imageDataUrl;
};

// Отправка обновления холста другим пользователям
export const sendCanvasUpdate = (force = false) => {
  const now = Date.now();
  
  // Проверяем, прошло ли достаточно времени с последнего обновления
  if (!force && now - lastUpdateTime < UPDATE_THROTTLE) return;
  
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  
  let canvasElement: HTMLCanvasElement | null = null;
  
  canvas.subscribe(value => {
    canvasElement = value;
  })();
  
  if (!canvasElement) return;
  
  try {
    const imageDataUrl = canvasElement.toDataURL('image/png');
    
    socket.send(JSON.stringify({
      type: 'canvas_update',
      roomId,
      imageData: imageDataUrl,
      timestamp: now
    }));
    
    // Обновляем время последнего обновления
    lastUpdateTime = now;
    
    // Сохраняем на сервере
    saveToServer(imageDataUrl);
  } catch (e) {
    console.error('Ошибка отправки обновления холста:', e);
    handleReconnect();
  }
};

// Сохранение на сервере
const saveToServer = (imageDataUrl: string) => {
  if (!roomId) return;
  
  // Получаем имя доски из URL или используем дефолтное
  const boardName = new URLSearchParams(window.location.search).get('name') || `Доска ${roomId.substring(0, 6)}`;
  
  fetch(`http://localhost:5000/image?id=${roomId}`, {
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