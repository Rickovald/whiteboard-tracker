import { writable } from 'svelte/store';

export interface Board {
  id: string;
  name: string;
  createdAt: Date;
  isEditing?: boolean;
}

export interface BoardsState {
  boards: Board[];
  activeBoard: string | null;
  isConnected: boolean;
}

const initialState: BoardsState = {
  boards: [],
  activeBoard: null,
  isConnected: false
};

export const boardsStore = writable<BoardsState>(initialState);

// Генерация уникального ID для доски
export const generateBoardId = () => {
  return 'f' + Math.random().toString(16).slice(2);
};

// Подключение к WebSocket серверу
let socket: WebSocket | null = null;

// Флаг для отслеживания попыток переподключения
let isReconnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

export const connectToServer = () => {
  if (socket && socket.readyState === WebSocket.OPEN) return;
  if (isReconnecting) return;
  
  // Если есть существующий сокет, закрываем его
  if (socket) {
    try {
      socket.close();
    } catch (e) {
      console.error('Ошибка при закрытии сокета:', e);
    }
    socket = null;
  }
  
  try {
    socket = new WebSocket('ws://localhost:5000/');
    
    socket.onopen = () => {
      boardsStore.update(state => ({ ...state, isConnected: true }));
      console.log('WebSocket соединение установлено');
      
      // Сбрасываем счетчик попыток переподключения
      reconnectAttempts = 0;
      isReconnecting = false;
      
      // Запрашиваем список досок при подключении
      fetchBoards();
    };
    
    socket.onclose = (event) => {
      boardsStore.update(state => ({ ...state, isConnected: false }));
      console.log('WebSocket соединение закрыто', event.code, event.reason);
      
      // Пытаемся переподключиться, если соединение было закрыто неожиданно
      if (!isReconnecting && reconnectAttempts < maxReconnectAttempts) {
        isReconnecting = true;
        reconnectAttempts++;
        
        console.log(`Попытка переподключения ${reconnectAttempts}/${maxReconnectAttempts}...`);
        
        // Увеличиваем задержку с каждой попыткой
        setTimeout(() => {
          isReconnecting = false;
          connectToServer();
        }, 1000 * Math.pow(2, reconnectAttempts - 1));
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('Достигнуто максимальное количество попыток переподключения');
      }
      
      socket = null;
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.method === 'connection') {
          console.log('Подключение к доске:', message.id);
        }
        
        if (message.method === 'draw') {
          // Обработка сообщений рисования происходит в canvas.svelte
        }
        
        if (message.method === 'board-deleted') {
          // Удаляем доску из списка, если она была удалена другим пользователем
          boardsStore.update(state => {
            const updatedBoards = state.boards.filter(board => board.id !== message.id);
            return {
              ...state,
              boards: updatedBoards,
              activeBoard: state.activeBoard === message.id 
                ? (updatedBoards.length > 0 ? updatedBoards[0].id : null)
                : state.activeBoard
            };
          });
        }
        
        if (message.method === 'board-renamed') {
          // Обновляем имя доски, если она была переименована другим пользователем
          boardsStore.update(state => {
            const updatedBoards = state.boards.map(board => 
              board.id === message.id 
                ? { ...board, name: message.name } 
                : board
            );
            return {
              ...state,
              boards: updatedBoards
            };
          });
        }
      } catch (e) {
        console.error('Ошибка обработки сообщения:', e);
      }
    };
  } catch (error) {
    console.error('Ошибка при создании WebSocket соединения:', error);
    boardsStore.update(state => ({ ...state, isConnected: false }));
    
    // Пытаемся переподключиться после ошибки
    if (!isReconnecting && reconnectAttempts < maxReconnectAttempts) {
      isReconnecting = true;
      reconnectAttempts++;
      
      setTimeout(() => {
        isReconnecting = false;
        connectToServer();
      }, 1000 * Math.pow(2, reconnectAttempts - 1));
    }
  }
};

// Очередь сообщений для отправки после переподключения
let messageQueue: any[] = [];

// Отправка сообщения на сервер
export const sendMessage = (message: any) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket не подключен, сообщение добавлено в очередь');
    
    // Добавляем сообщение в очередь
    messageQueue.push(message);
    
    // Пытаемся переподключиться
    connectToServer();
    
    // Добавляем обработчик для отправки сообщений из очереди после подключения
    if (socket) {
      const onOpenHandler = () => {
        // Отправляем все сообщения из очереди
        while (messageQueue.length > 0) {
          const queuedMessage = messageQueue.shift();
          try {
            socket.send(JSON.stringify(queuedMessage));
          } catch (e) {
            console.error('Ошибка отправки сообщения из очереди:', e);
          }
        }
        socket?.removeEventListener('open', onOpenHandler);
      };
      socket.addEventListener('open', onOpenHandler);
    }
    
    return;
  }
  
  try {
    socket.send(JSON.stringify(message));
  } catch (e) {
    console.error('Ошибка отправки сообщения:', e);
    messageQueue.push(message);
  }
};

// Получение списка досок
export const fetchBoards = async () => {
  try {
    // Проверяем, запущен ли сервер
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Таймаут 3 секунды
    
    try {
      // Получаем список файлов с сервера
      const response = await fetch('http://localhost:5000/boards', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        // Преобразуем список файлов в доски
        const boards = data.boards.map((board: any) => ({
          id: board.id,
          name: board.name || `Новая доска`,
          createdAt: new Date(board.createdAt || Date.now())
        }));
        
        boardsStore.update(state => ({
          ...state,
          boards
        }));
        
        // Сохраняем доски в локальное хранилище
        localStorage.setItem('whiteboardBoards', JSON.stringify(boards));
        
        return boards;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.warn('Запрос к серверу превысил время ожидания. Сервер не запущен?');
      } else {
        console.error('Ошибка при получении списка досок:', fetchError);
      }
    }
    
    // Если не удалось получить список досок с сервера, проверяем локальное хранилище
    const savedBoards = localStorage.getItem('whiteboardBoards');
    if (savedBoards) {
      try {
        const boards = JSON.parse(savedBoards);
        boardsStore.update(state => ({
          ...state,
          boards
        }));
        return boards;
      } catch (e) {
        console.error('Ошибка парсинга локальных досок:', e);
      }
    }
    
    // Если нет сохраненных досок, создаем пустой список
    return [];
  } catch (error) {
    console.error('Ошибка получения списка досок:', error);
    return [];
  }
};

// Создание новой доски
export const createBoard = (name: string = 'Новая доска') => {
  const id = generateBoardId();
  const boardName = name.trim() || 'Новая доска';
  
  const newBoard: Board = {
    id,
    name: boardName,
    createdAt: new Date()
  };
  
  boardsStore.update(state => {
    const updatedBoards = [...state.boards, newBoard];
    
    // Сохраняем доски в локальное хранилище
    localStorage.setItem('whiteboardBoards', JSON.stringify(updatedBoards));
    
    return {
      ...state,
      boards: updatedBoards,
      activeBoard: id
    };
  });
  
  // Отправляем сообщение о создании доски
  sendMessage({
    method: 'connection',
    id,
    username: 'user'
  });
  
  // Инициализируем пустую доску на сервере
  initEmptyBoard(id, boardName);
  
  return id;
};

// Инициализация пустой доски на сервере
export const initEmptyBoard = async (id: string, name: string = 'Новая доска') => {
  const canvasElement = document.querySelector('canvas');
  if (!canvasElement) return;
  
  try {
    const dataUrl = canvasElement.toDataURL();
    
    await fetch(`http://localhost:5000/image?id=${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        img: dataUrl,
        name: name
      })
    });
    
    console.log('Пустая доска инициализирована');
  } catch (error) {
    console.error('Ошибка инициализации доски:', error);
  }
};

// Удаление доски
export const deleteBoard = async (id: string) => {
  try {
    // Удаляем доску на сервере
    const response = await fetch(`http://localhost:5000/board?id=${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Удаляем доску из локального состояния
      boardsStore.update(state => {
        const updatedBoards = state.boards.filter(board => board.id !== id);
        
        // Сохраняем обновленный список досок в локальное хранилище
        localStorage.setItem('whiteboardBoards', JSON.stringify(updatedBoards));
        
        // Если удаляем активную доску, выбираем первую из оставшихся или null
        const newActiveBoard = id === state.activeBoard 
          ? (updatedBoards.length > 0 ? updatedBoards[0].id : null)
          : state.activeBoard;
          
        return {
          ...state,
          boards: updatedBoards,
          activeBoard: newActiveBoard
        };
      });
      
      // Уведомляем других пользователей об удалении доски
      sendMessage({
        method: 'board-deleted',
        id
      });
      
      // Если есть активная доска после удаления, подключаемся к ней
      let newActiveBoard = null;
      boardsStore.update(state => {
        newActiveBoard = state.activeBoard;
        return state;
      });
      
      if (newActiveBoard) {
        selectBoard(newActiveBoard);
        // Обновляем URL
        window.history.pushState({}, "", `/drawer?id=${newActiveBoard}`);
      } else {
        // Если нет активной доски, создаем новую
        const newId = createBoard('Новая доска');
        window.history.pushState({}, "", `/drawer?id=${newId}`);
      }
    }
  } catch (error) {
    console.error('Ошибка удаления доски:', error);
  }
};

// Выбор активной доски
export const selectBoard = (id: string) => {
  boardsStore.update(state => ({
    ...state,
    activeBoard: id
  }));
  
  // Проверяем соединение перед отправкой сообщения
  if (socket && socket.readyState === WebSocket.OPEN) {
    // Отправляем сообщение о подключении к доске
    sendMessage({
      method: 'connection',
      id,
      username: 'user'
    });
  } else {
    // Если соединение закрыто, пытаемся переподключиться
    connectToServer();
    // Добавляем обработчик для отправки сообщения после подключения
    if (socket) {
      const onOpenHandler = () => {
        sendMessage({
          method: 'connection',
          id,
          username: 'user'
        });
        socket?.removeEventListener('open', onOpenHandler);
      };
      socket.addEventListener('open', onOpenHandler);
    }
  }
  
  // Загружаем изображение доски с сервера
  loadBoardImage(id);
};

// Изменение имени доски
export const updateBoardName = (id: string, newName: string) => {
  boardsStore.update(state => {
    const updatedBoards = state.boards.map(board => 
      board.id === id 
        ? { ...board, name: newName, isEditing: false } 
        : board
    );
    
    // Сохраняем обновленный список досок в локальное хранилище
    localStorage.setItem('whiteboardBoards', JSON.stringify(updatedBoards));
    
    return {
      ...state,
      boards: updatedBoards
    };
  });
  
  // Отправляем сообщение о переименовании доски
  sendMessage({
    method: 'board-renamed',
    id,
    name: newName
  });
  
  // Сохраняем доску с новым именем
  saveBoardImage(id);
};

// Включение/выключение режима редактирования имени доски
export const toggleBoardEditing = (id: string, isEditing: boolean) => {
  boardsStore.update(state => {
    const updatedBoards = state.boards.map(board => 
      board.id === id 
        ? { ...board, isEditing } 
        : { ...board, isEditing: false }
    );
    
    return {
      ...state,
      boards: updatedBoards
    };
  });
};

// Загрузка изображения доски с сервера
export const loadBoardImage = async (id: string) => {
  try {
    // Проверяем, запущен ли сервер
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Таймаут 3 секунды
    
    try {
      const response = await fetch(`http://localhost:5000/image?id=${id}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const img = new Image();
        img.src = data;
        
        img.onload = () => {
          const canvasElement = document.querySelector('canvas');
          if (canvasElement) {
            const ctx = canvasElement.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
              ctx.drawImage(img, 0, 0, canvasElement.width, canvasElement.height);
            }
          }
        };
      } else if (response.status === 404) {
        // Если изображение не найдено, создаем пустую доску
        console.log('Изображение доски не найдено, создаем пустую доску');
        initEmptyBoard(id);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.warn('Запрос к серверу превысил время ожидания. Сервер не запущен?');
      } else {
        console.error('Ошибка при загрузке изображения:', fetchError);
      }
      
      // Если сервер недоступен, создаем пустую доску локально
      const canvasElement = document.querySelector('canvas');
      if (canvasElement) {
        const ctx = canvasElement.getContext('2d');
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки изображения доски:', error);
  }
};

// Сохранение текущего состояния доски
export const saveBoardImage = async (id: string) => {
  if (!id) return;
  
  const canvasElement = document.querySelector('canvas');
  if (!canvasElement) return;
  
  try {
    const dataUrl = canvasElement.toDataURL();
    
    // Получаем имя доски из текущего состояния
    let boardName = 'Новая доска';
    boardsStore.update(state => {
      const board = state.boards.find(b => b.id === id);
      boardName = board ? board.name : 'Новая доска';
      return state;
    });
    
    await fetch(`http://localhost:5000/image?id=${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        img: dataUrl,
        name: boardName
      })
    });
    
    console.log('Доска сохранена');
    return true;
  } catch (error) {
    console.error('Ошибка сохранения доски:', error);
    return false;
  }
};