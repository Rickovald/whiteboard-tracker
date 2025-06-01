import { writable } from 'svelte/store';
import { canvas } from './canvas';
import { sendCanvasUpdate } from './sync';

interface HistoryState {
  past: ImageData[];
  future: ImageData[];
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: HistoryState = {
  past: [],
  future: [],
  canUndo: false,
  canRedo: false
};

export const historyStore = writable<HistoryState>(initialState);
export const history = historyStore; // Экспортируем как history для совместимости

// Максимальное количество состояний в истории
const MAX_HISTORY_LENGTH = 20;

// Сохранение текущего состояния в историю
export const saveToHistory = (state: ImageData) => {
  historyStore.update(history => {
    // Добавляем текущее состояние в прошлое
    const newPast = [...history.past, state];
    
    // Ограничиваем размер истории
    const limitedPast = newPast.length > MAX_HISTORY_LENGTH 
      ? newPast.slice(newPast.length - MAX_HISTORY_LENGTH) 
      : newPast;
    
    // Очищаем будущее при новом действии
    return {
      past: limitedPast,
      future: [],
      canUndo: limitedPast.length > 0,
      canRedo: false
    };
  });
  
  // Отправляем обновление другим пользователям
  try {
    sendCanvasUpdate();
  } catch (e) {
    console.error('Ошибка отправки обновления:', e);
  }
};

// Отмена последнего действия
export const undo = () => {
  let canvasElement: HTMLCanvasElement | null = null;
  
  canvas.subscribe(value => {
    canvasElement = value;
  })();
  
  if (!canvasElement) return;
  
  historyStore.update(history => {
    if (history.past.length === 0) return history;
    
    // Получаем последнее состояние из прошлого
    const lastState = history.past[history.past.length - 1];
    
    // Сохраняем текущее состояние для возможности повтора
    const ctx = canvasElement!.getContext('2d');
    if (!ctx) return history;
    
    const currentState = ctx.getImageData(0, 0, canvasElement!.width, canvasElement!.height);
    
    // Восстанавливаем предыдущее состояние
    ctx.putImageData(lastState, 0, 0);
    
    // Обновляем историю
    return {
      past: history.past.slice(0, -1),
      future: [...history.future, currentState],
      canUndo: history.past.length > 1,
      canRedo: true
    };
  });
  
  // Отправляем обновление другим пользователям
  try {
    sendCanvasUpdate();
  } catch (e) {
    console.error('Ошибка отправки обновления при отмене:', e);
  }
};

// Повтор отмененного действия
export const redo = () => {
  let canvasElement: HTMLCanvasElement | null = null;
  
  canvas.subscribe(value => {
    canvasElement = value;
  })();
  
  if (!canvasElement) return;
  
  historyStore.update(history => {
    if (history.future.length === 0) return history;
    
    // Получаем последнее состояние из будущего
    const nextState = history.future[history.future.length - 1];
    
    // Сохраняем текущее состояние для возможности отмены
    const ctx = canvasElement!.getContext('2d');
    if (!ctx) return history;
    
    const currentState = ctx.getImageData(0, 0, canvasElement!.width, canvasElement!.height);
    
    // Восстанавливаем следующее состояние
    ctx.putImageData(nextState, 0, 0);
    
    // Обновляем историю
    return {
      past: [...history.past, currentState],
      future: history.future.slice(0, -1),
      canUndo: true,
      canRedo: history.future.length > 1
    };
  });
  
  // Отправляем обновление другим пользователям
  try {
    sendCanvasUpdate();
  } catch (e) {
    console.error('Ошибка отправки обновления при повторе:', e);
  }
};

// Сохранение начального состояния при загрузке доски
export const saveInitialState = () => {
  let canvasElement: HTMLCanvasElement | null = null;
  
  canvas.subscribe(value => {
    canvasElement = value;
  })();
  
  if (!canvasElement) return;
  
  const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  
  const initialState = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
  
  historyStore.update(() => ({
    past: [initialState],
    future: [],
    canUndo: false,
    canRedo: false
  }));
};

// Очистка истории при смене доски
export const clearHistory = () => {
  historyStore.set(initialState);
};