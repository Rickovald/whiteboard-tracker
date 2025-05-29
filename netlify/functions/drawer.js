const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Инициализация Express приложения
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Путь к файлам в Netlify Functions
const filesDir = path.join('/tmp/drawer-files');
const boardsFile = path.join('/tmp/boards.json');

// Создаем директорию для файлов, если она не существует
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}

// Создаем пустой файл boards.json, если он не существует
if (!fs.existsSync(boardsFile)) {
  fs.writeFileSync(boardsFile, JSON.stringify({ boards: [] }), 'utf8');
}

// Кэш последних состояний досок
const boardsCache = new Map();

// Загрузка метаданных досок
const loadBoardsData = () => {
  try {
    if (fs.existsSync(boardsFile)) {
      const data = fs.readFileSync(boardsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.log('Ошибка загрузки метаданных досок:', e);
  }
  return { boards: [] };
};

// Сохранение метаданных досок
const saveBoardsData = (data) => {
  try {
    fs.writeFileSync(boardsFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.log('Ошибка сохранения метаданных досок:', e);
  }
};

// Получение метаданных доски по ID
const getBoardData = (id) => {
  const data = loadBoardsData();
  return data.boards.find(board => board.id === id);
};

// Обновление метаданных доски
const updateBoardData = (id, updates) => {
  const data = loadBoardsData();
  const index = data.boards.findIndex(board => board.id === id);
  
  if (index !== -1) {
    data.boards[index] = { ...data.boards[index], ...updates };
  } else {
    data.boards.push({ id, ...updates });
  }
  
  saveBoardsData(data);
  return data.boards[index !== -1 ? index : data.boards.length - 1];
};

// Функция для сохранения изображения на диск
const saveImageToDisk = (id, imageDataUrl) => {
  try {
    const data = imageDataUrl.replace(`data:image/png;base64,`, '');
    fs.writeFileSync(path.join(filesDir, `${id}.jpg`), data, 'base64');
    
    // Обновляем метаданные доски
    updateBoardData(id, { 
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Ошибка сохранения изображения:', e);
  }
};

// Получение списка досок
app.get('/api/boards', (req, res) => {
  try {
    // Проверяем существование директории
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
      return res.json({ boards: [] });
    }
    
    // Получаем список файлов
    const files = fs.readdirSync(filesDir);
    
    // Загружаем метаданные досок
    const boardsData = loadBoardsData();
    
    // Преобразуем файлы в доски
    const boards = files
      .filter(file => file.endsWith('.jpg'))
      .map(file => {
        const id = file.replace('.jpg', '');
        const stats = fs.statSync(path.join(filesDir, file));
        const boardData = getBoardData(id) || {};
        
        return {
          id,
          name: boardData.name || `Доска ${id.substring(0, 6)}`,
          createdAt: boardData.createdAt || stats.birthtime,
          updatedAt: boardData.updatedAt || stats.mtime
        };
      });
    
    // Обновляем метаданные досок
    boardsData.boards = boards;
    saveBoardsData(boardsData);
    
    res.json({ boards });
  } catch (e) {
    console.log('Ошибка получения списка досок:', e);
    return res.status(500).json({ error: 'Ошибка получения списка досок' });
  }
});

// Создание или обновление изображения доски
app.post('/api/image', (req, res) => {
  try {
    const id = req.query.id;
    const data = req.body.img.replace(`data:image/png;base64,`, '');
    
    // Сохраняем изображение
    fs.writeFileSync(path.join(filesDir, `${id}.jpg`), data, 'base64');
    
    // Обновляем кэш
    boardsCache.set(id, req.body.img);
    
    // Обновляем метаданные доски
    const boardName = req.body.name || `Доска ${id.substring(0, 6)}`;
    updateBoardData(id, { 
      name: boardName,
      updatedAt: new Date().toISOString()
    });
    
    return res.status(200).json({message: "Загружено"});
  } catch (e) {
    console.log(e);
    return res.status(500).json('error');
  }
});

// Получение изображения доски
app.get('/api/image', (req, res) => {
  try {
    const id = req.query.id;
    
    // Сначала проверяем кэш
    if (boardsCache.has(id)) {
      return res.json(boardsCache.get(id));
    }
    
    const filePath = path.join(filesDir, `${id}.jpg`);
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      // Если файл не существует, возвращаем пустое изображение
      return res.status(404).json({ error: 'Изображение не найдено' });
    }
    
    const file = fs.readFileSync(filePath);
    const data = `data:image/png;base64,` + file.toString('base64');
    
    // Сохраняем в кэш
    boardsCache.set(id, data);
    
    res.json(data);
  } catch (e) {
    console.log(e);
    return res.status(500).json('error');
  }
});

// Удаление доски
app.delete('/api/board', (req, res) => {
  try {
    const id = req.query.id;
    const filePath = path.join(filesDir, `${id}.jpg`);
    
    // Удаляем файл, если он существует
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Удаляем из кэша
    boardsCache.delete(id);
    
    // Удаляем метаданные доски
    const data = loadBoardsData();
    data.boards = data.boards.filter(board => board.id !== id);
    saveBoardsData(data);
    
    res.status(200).json({ message: 'Доска удалена' });
  } catch (e) {
    console.log('Ошибка удаления доски:', e);
    return res.status(500).json({ error: 'Ошибка удаления доски' });
  }
});

// Экспорт обработчика для Netlify Functions
module.exports.handler = serverless(app);