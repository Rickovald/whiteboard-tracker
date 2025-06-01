const express = require('express')
const app = express()
const WSServer = require('express-ws')(app)
const aWss = WSServer.getWss()
const cors = require('cors')
const PORT = process.env.PORT || 5000
const fs = require('fs')
const path = require('path')

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Создаем директорию для файлов, если она не существует
const filesDir = path.resolve(__dirname, 'files')
if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true })
}

// Файл для хранения метаданных досок
const boardsFile = path.resolve(__dirname, 'boards.json')

// Кэш последних состояний досок
const boardsCache = new Map()

// Отслеживание активных соединений по комнатам
const roomConnections = new Map()

// Загрузка метаданных досок
const loadBoardsData = () => {
    try {
        if (fs.existsSync(boardsFile)) {
            const data = fs.readFileSync(boardsFile, 'utf8')
            return JSON.parse(data)
        }
    } catch (e) {
        console.log('Ошибка загрузки метаданных досок:', e)
    }
    return { boards: [] }
}

// Сохранение метаданных досок
const saveBoardsData = (data) => {
    try {
        fs.writeFileSync(boardsFile, JSON.stringify(data, null, 2), 'utf8')
    } catch (e) {
        console.log('Ошибка сохранения метаданных досок:', e)
    }
}

// Получение метаданных доски по ID
const getBoardData = (id) => {
    const data = loadBoardsData()
    return data.boards.find(board => board.id === id)
}

// Обновление метаданных доски
const updateBoardData = (id, updates) => {
    const data = loadBoardsData()
    const index = data.boards.findIndex(board => board.id === id)
    
    if (index !== -1) {
        data.boards[index] = { ...data.boards[index], ...updates }
    } else {
        data.boards.push({ id, ...updates })
    }
    
    saveBoardsData(data)
    return data.boards[index !== -1 ? index : data.boards.length - 1]
}

app.ws('/', (ws, req) => {
    ws.on('message', (msg) => {
        try {
            msg = JSON.parse(msg)
            switch (msg.method) {
                case "connection":
                    connectionHandler(ws, msg)
                    break
                case "draw":
                    broadcastConnection(ws, msg)
                    break
                case "board-deleted":
                    broadcastBoardDeleted(msg)
                    break
                case "board-renamed":
                    updateBoardData(msg.id, { name: msg.name })
                    broadcastConnection(ws, msg)
                    break
            }
        } catch (e) {
            console.log('Ошибка обработки сообщения:', e)
        }
    })
})

// WebSocket эндпоинт для синхронизации между пользователями
app.ws('/whiteboard/:id', (ws, req) => {
    const roomId = req.params.id;
    ws.roomId = roomId;
    ws.isAlive = true;
    
    // Добавляем соединение в отслеживание
    if (!roomConnections.has(roomId)) {
        roomConnections.set(roomId, new Set());
    }
    roomConnections.get(roomId).add(ws);
    
    // Получаем метаданные доски
    const boardData = getBoardData(roomId);
    
    console.log(`Пользователь подключился к доске ${roomId}. Всего подключений: ${roomConnections.get(roomId).size}`);
    
    // Отправляем запрос на получение текущего состояния доски
    try {
        ws.send(JSON.stringify({
            type: 'initial_state_request'
        }));
    } catch (e) {
        console.error('Ошибка отправки initial_state_request:', e);
    }
    
    // Обработка пинга для проверки активности соединения
    const pingInterval = setInterval(() => {
        if (!ws.isAlive) {
            clearInterval(pingInterval);
            try {
                ws.terminate();
            } catch (e) {
                console.error('Ошибка при terminate сокета:', e);
            }
            return;
        }
        
        ws.isAlive = false;
        try {
            ws.send(JSON.stringify({ type: 'pong' }));
        } catch (e) {
            clearInterval(pingInterval);
            try {
                ws.terminate();
            } catch (err) {
                console.error('Ошибка при terminate сокета после ошибки отправки:', err);
            }
        }
    }, 15000);
    
    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            
            // Сбрасываем флаг активности при любом сообщении
            ws.isAlive = true;
            
            if (data.type === 'ping') {
                // Отвечаем на пинг
                try {
                    ws.send(JSON.stringify({ type: 'pong' }));
                } catch (e) {
                    console.error('Ошибка отправки pong:', e);
                }
            } else if (data.type === 'canvas_update') {
                // Сохраняем последнее состояние доски в кэш
                boardsCache.set(roomId, data.imageData);
                
                // Отправляем обновление всем клиентам в этой комнате
                if (roomConnections.has(roomId)) {
                    roomConnections.get(roomId).forEach(client => {
                        if (client !== ws && client.readyState === 1) { // WebSocket.OPEN = 1
                            try {
                                client.send(msg);
                            } catch (e) {
                                console.error('Ошибка отправки обновления клиенту:', e);
                            }
                        }
                    });
                }
                
                // Автоматически сохраняем изображение на диск
                saveImageToDisk(roomId, data.imageData);
            } else if (data.type === 'initial_state_request') {
                // Получаем метаданные доски
                const boardData = getBoardData(roomId);
                
                // Отправляем последнее известное состояние доски
                const cachedState = boardsCache.get(roomId);
                if (cachedState) {
                    try {
                        ws.send(JSON.stringify({
                            type: 'canvas_update',
                            roomId,
                            imageData: cachedState,
                            metadata: boardData || {}
                        }));
                    } catch (e) {
                        console.error('Ошибка отправки кэшированного состояния:', e);
                    }
                } else {
                    // Если в кэше нет, пытаемся загрузить с диска
                    const filePath = path.resolve(__dirname, 'files', `${roomId}.jpg`);
                    if (fs.existsSync(filePath)) {
                        try {
                            const file = fs.readFileSync(filePath);
                            const imageData = `data:image/png;base64,` + file.toString('base64');
                            ws.send(JSON.stringify({
                                type: 'canvas_update',
                                roomId,
                                imageData,
                                metadata: boardData || {}
                            }));
                            
                            // Сохраняем в кэш
                            boardsCache.set(roomId, imageData);
                        } catch (e) {
                            console.error('Ошибка загрузки изображения с диска:', e);
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Ошибка обработки сообщения синхронизации:', e);
        }
    });
    
    ws.on('close', () => {
        // Удаляем соединение из отслеживания
        if (roomConnections.has(roomId)) {
            roomConnections.get(roomId).delete(ws);
            console.log(`Пользователь отключился от доски ${roomId}. Осталось подключений: ${roomConnections.get(roomId).size}`);
            
            // Если больше нет подключений к комнате, удаляем её из отслеживания
            if (roomConnections.get(roomId).size === 0) {
                roomConnections.delete(roomId);
            }
        }
        
        clearInterval(pingInterval);
    });
    
    ws.on('error', (error) => {
        console.error(`Ошибка WebSocket для доски ${roomId}:`, error);
        clearInterval(pingInterval);
    });
});

// Функция для сохранения изображения на диск
const saveImageToDisk = (id, imageDataUrl) => {
    try {
        const data = imageDataUrl.replace(`data:image/png;base64,`, '');
        fs.writeFileSync(path.resolve(__dirname, 'files', `${id}.jpg`), data, 'base64');
        
        // Обновляем метаданные доски
        updateBoardData(id, { 
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error('Ошибка сохранения изображения:', e);
    }
};

// Получение списка досок
app.get('/boards', (req, res) => {
    try {
        const filesDir = path.resolve(__dirname, 'files')
        
        // Проверяем существование директории
        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true })
            return res.json({ boards: [] })
        }
        
        // Получаем список файлов
        const files = fs.readdirSync(filesDir)
        
        // Загружаем метаданные досок
        const boardsData = loadBoardsData()
        
        // Преобразуем файлы в доски
        const boards = files
            .filter(file => file.endsWith('.jpg'))
            .map(file => {
                const id = file.replace('.jpg', '')
                const stats = fs.statSync(path.join(filesDir, file))
                const boardData = getBoardData(id) || {}
                
                return {
                    id,
                    name: boardData.name || `Доска ${id.substring(0, 6)}`,
                    createdAt: boardData.createdAt || stats.birthtime,
                    updatedAt: boardData.updatedAt || stats.mtime
                }
            })
        
        // Обновляем метаданные досок
        boardsData.boards = boards
        saveBoardsData(boardsData)
        
        res.json({ boards })
    } catch (e) {
        console.log('Ошибка получения списка досок:', e)
        return res.status(500).json({ error: 'Ошибка получения списка досок' })
    }
})

// Создание или обновление изображения доски
app.post('/image', (req, res) => {
    try {
        const id = req.query.id
        const data = req.body.img.replace(`data:image/png;base64,`, '')
        
        // Сохраняем изображение
        fs.writeFileSync(path.resolve(__dirname, 'files', `${id}.jpg`), data, 'base64')
        
        // Обновляем кэш
        boardsCache.set(id, req.body.img);
        
        // Обновляем метаданные доски
        const boardName = req.body.name || `Доска ${id.substring(0, 6)}`
        const resolution = req.body.resolution || { width: 800, height: 600 }
        const isNewBoard = req.body.isNewBoard || false
        
        // Если это новая доска, очищаем предыдущие данные
        if (isNewBoard) {
            console.log(`Инициализация новой доски: ${id}`);
        }
        
        updateBoardData(id, { 
            name: boardName,
            updatedAt: new Date().toISOString(),
            resolution: resolution,
            createdAt: isNewBoard ? new Date().toISOString() : undefined
        })
        
        return res.status(200).json({
            message: "Загружено",
            id: id,
            name: boardName,
            resolution: resolution
        })
    } catch (e) {
        console.log(e)
        return res.status(500).json('error')
    }
})

// Получение изображения доски
app.get('/image', (req, res) => {
    try {
        const id = req.query.id;
        
        // Получаем метаданные доски, включая разрешение
        const boardData = getBoardData(id);
        
        // Сначала проверяем кэш
        if (boardsCache.has(id)) {
            const cachedData = boardsCache.get(id);
            
            // Если запрошены метаданные, возвращаем их вместе с изображением
            if (req.query.metadata === 'true') {
                return res.json({
                    imageData: cachedData,
                    metadata: boardData || {}
                });
            }
            
            return res.json(cachedData);
        }
        
        const filePath = path.resolve(__dirname, 'files', `${id}.jpg`)
        
        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            // Если файл не существует, возвращаем ошибку 404
            return res.status(404).json({ 
                error: 'Изображение не найдено',
                id: id,
                metadata: boardData || {}
            });
        }
        
        const file = fs.readFileSync(filePath)
        const data = `data:image/png;base64,` + file.toString('base64')
        
        // Сохраняем в кэш
        boardsCache.set(id, data);
        
        // Если запрошены метаданные, возвращаем их вместе с изображением
        if (req.query.metadata === 'true') {
            return res.json({
                imageData: data,
                metadata: boardData || {}
            });
        }
        
        res.json(data)
    } catch (e) {
        console.log(e)
        return res.status(500).json({
            error: 'Ошибка при получении изображения',
            message: e.message
        })
    }
})

// Удаление доски
app.delete('/board', (req, res) => {
    try {
        const id = req.query.id
        const filePath = path.resolve(__dirname, 'files', `${id}.jpg`)
        
        // Удаляем файл, если он существует
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
        
        // Удаляем из кэша
        boardsCache.delete(id);
        
        // Удаляем метаданные доски
        const data = loadBoardsData()
        data.boards = data.boards.filter(board => board.id !== id)
        saveBoardsData(data)
        
        res.status(200).json({ message: 'Доска удалена' })
    } catch (e) {
        console.log('Ошибка удаления доски:', e)
        return res.status(500).json({ error: 'Ошибка удаления доски' })
    }
})

app.listen(PORT, () => console.log(`server started on PORT ${PORT}`))

const connectionHandler = (ws, msg) => {
    ws.id = msg.id
    broadcastConnection(ws, msg)
}

const broadcastConnection = (ws, msg) => {
    aWss.clients.forEach(client => {
        if (client.id === msg.id) {
            client.send(JSON.stringify(msg))
        }
    })
}

const broadcastBoardDeleted = (msg) => {
    aWss.clients.forEach(client => {
        client.send(JSON.stringify(msg))
    })
}