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
  syncStatus.set('initializing');
  
  // Предварительно загружаем состояние из локального хранилища, если оно есть
  const cachedState = localStorage.getItem(`whiteboard_state_${roomId}`);
  if (cachedState) {
    try {
      updateCanvasFromSync(cachedState);
      console.log('Загружено кэшированное состояние доски');
    } catch (e) {
      console.error('Ошибка загрузки кэшированного состояния:', e);
    }
  }
  
  try {
    // Используем фиксированный порт 5000 для WebSocket соединения
    socket = new WebSocket(`ws://localhost:5000/whiteboard/${roomId}`);

    // Устанавливаем таймаут для соединения
    const connectionTimeout = setTimeout(() => {
      if (socket && socket.readyState !== WebSocket.OPEN) {
        console.warn('Таймаут соединения WebSocket');
        socket.close();
        handleReconnect();
      }
    }, 5000);

    socket.onopen = () => {
      clearTimeout(connectionTimeout);
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
      }, 15000) as unknown as number;
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
  }, delay) as unknown as number;
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
  
  // Используем утверждение типа, чтобы TypeScript знал, что canvasElement не null
  const canvasEl = canvasElement as HTMLCanvasElement;
  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  
  const img = new Image();
  img.onload = () => {
    // Сохраняем текущие размеры холста
    const { width, height } = canvasElement!;
    
    // Очищаем холст перед отрисовкой
    ctx.clearRect(0, 0, width, height);
    
    // Проверяем, есть ли сохраненное разрешение для этой доски
    const boardResolution = localStorage.getItem(`whiteboard_resolution_${roomId}`);
    let originalWidth = width;
    let originalHeight = height;
    
    if (boardResolution) {
      try {
        const resolution = JSON.parse(boardResolution);
        originalWidth = resolution.width;
        originalHeight = resolution.height;
      } catch (e) {
        console.error('Ошибка при чтении сохраненного разрешения:', e);
      }
    }
    
    // Рисуем изображение с учетом соотношения сторон
    ctx.drawImage(img, 0, 0, width, height);
    
    // Сохраняем изображение в локальное хранилище для быстрой загрузки
    localStorage.setItem(`whiteboard_state_${roomId}`, imageDataUrl);
  };
  img.src = imageDataUrl;
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
  
  if (!canvasElement) return;
  
  // Используем утверждение типа для canvasElement
  const canvasEl = canvasElement as HTMLCanvasElement;
  
  try {
    const imageDataUrl = canvasEl.toDataURL('image/png');
    
    // Сохраняем текущее разрешение доски
    localStorage.setItem(`whiteboard_resolution_${roomId}`, JSON.stringify({
      width: canvasEl.width,
      height: canvasEl.height
    }));
    
    // Сохраняем состояние в локальное хранилище для быстрой загрузки
    localStorage.setItem(`whiteboard_state_${roomId}`, imageDataUrl);
    
    // Отправляем обновление через WebSocket, если соединение открыто
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'canvas_update',
        roomId,
        imageData: imageDataUrl,
        resolution: {
          width: canvasEl.width,
          height: canvasEl.height
        },
        timestamp: now
      }));
      
      // Обновляем время последнего обновления
      lastUpdateTime = now;
    } else if (force) {
      // Если соединение закрыто, но нужно принудительное обновление,
      // пытаемся переподключиться
      handleReconnect();
    }
    
    // Синхронизируем с другими вкладками
    try {
      const bc = new BroadcastChannel('whiteboard-sync');
      bc.postMessage({
        type: 'canvas-update',
        id: roomId,
        imageData: imageDataUrl,
        timestamp: now
      });
      bc.close();
    } catch (e) {
      console.error('Ошибка синхронизации между вкладками:', e);
    }
    
    // Сохраняем на сервере
    saveToServer(imageDataUrl);
  } catch (e) {
    console.error('Ошибка отправки обновления холста:', e);
    if (socket && socket.readyState !== WebSocket.OPEN) {
      handleReconnect();
    }
  }
};

// Сохранение на сервере
const saveToServer = (imageDataUrl: string) => {
  if (!roomId) return;
  
  // Получаем имя доски из URL или используем дефолтное
  const boardName = new URLSearchParams(window.location.search).get('name') || `Доска ${roomId.substring(0, 6)}`;
  
  // Получаем текущее разрешение холста
  let resolution = { width: 800, height: 600 }; // Значения по умолчанию
  
  canvas.subscribe(value => {
    if (value) {
      resolution = {
        width: value.width,
        height: value.height
      };
    }
  })();
  
  fetch(`http://localhost:5000/image?id=${roomId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      img: imageDataUrl,
      name: boardName,
      resolution: resolution
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Ошибка сохранения на сервере');
    }
    return response.json();
  })
  .then(() => {
    console.log('Доска успешно сохранена на сервере');
  })
  .catch((err: unknown) => {
    console.error('Ошибка сохранения:', err);
    // Сохраняем локально в случае ошибки
    localStorage.setItem(`whiteboard_state_${roomId}`, imageDataUrl);
    localStorage.setItem(`whiteboard_resolution_${roomId}`, JSON.stringify(resolution));
  });
};

// Статус синхронизации
export const syncStatus = writable<'connected' | 'disconnected' | 'error' | 'initializing'>('initializing');