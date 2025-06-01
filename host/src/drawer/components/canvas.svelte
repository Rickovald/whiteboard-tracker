<script lang="ts">
    import "../../styles/global.css";
    import { onMount } from "svelte";
    import { canvas } from "../stores/canvas";
    import { tool } from "../stores/tool";
    import { Brush } from "../tools/brush";
    import { boardsStore } from "../stores/boards";
    import { saveInitialState, clearHistory } from "../stores/history";

    let canvasEl: HTMLCanvasElement;
    let socket: WebSocket | null = null;
    let lastActiveBoard: string | null = null;
    let socketReconnectTimer: number | null = null;

    function resizeCanvas() {
        const parent = canvasEl.parentElement;
        if (!parent) return;
        
        // Получаем ID активной доски
        let activeBoard = null;
        boardsStore.subscribe(state => {
            activeBoard = state.activeBoard;
        })();
        
        // Проверяем, есть ли сохраненное разрешение для этой доски
        let savedWidth = parent.clientWidth;
        let savedHeight = parent.clientHeight;
        
        if (activeBoard) {
            const savedResolution = localStorage.getItem(`whiteboard_resolution_${activeBoard}`);
            if (savedResolution) {
                try {
                    const resolution = JSON.parse(savedResolution);
                    // Используем сохраненное разрешение, если оно есть
                    if (resolution.width && resolution.height) {
                        // Проверяем, подходит ли сохраненное разрешение для текущего экрана
                        if (resolution.width <= parent.clientWidth && resolution.height <= parent.clientHeight) {
                            savedWidth = resolution.width;
                            savedHeight = resolution.height;
                        } else {
                            // Адаптируем под текущий размер с сохранением пропорций
                            const ratio = Math.min(
                                parent.clientWidth / resolution.width,
                                parent.clientHeight / resolution.height
                            );
                            savedWidth = Math.floor(resolution.width * ratio);
                            savedHeight = Math.floor(resolution.height * ratio);
                        }
                    }
                } catch (e) {
                    console.error('Ошибка при чтении сохраненного разрешения:', e);
                }
            }
        }
        
        // Проверяем, мобильное ли устройство
        const isMobile = window.innerWidth <= 768;
        
        // Устанавливаем размеры холста
        if (isMobile) {
            // На мобильных устройствах используем всю доступную ширину
            canvasEl.width = parent.clientWidth;
            canvasEl.height = Math.min(parent.clientHeight, parent.clientWidth * 1.5); // Ограничиваем высоту
        } else {
            // На десктопе используем сохраненное разрешение или доступное пространство
            canvasEl.width = savedWidth;
            canvasEl.height = savedHeight;
        }
        
        // Сохраняем текущее разрешение
        if (activeBoard) {
            localStorage.setItem(`whiteboard_resolution_${activeBoard}`, JSON.stringify({
                width: canvasEl.width,
                height: canvasEl.height
            }));
        }

        const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
        if (ctx) {
            // Сохраняем текущее содержимое, если оно есть
            let imageData = null;
            try {
                imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
            } catch (e) {
                // Игнорируем ошибки, если холст пустой или размеры изменились
            }
            
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
            
            // Восстанавливаем содержимое, если оно было
            if (imageData) {
                try {
                    ctx.putImageData(imageData, 0, 0);
                } catch (e) {
                    console.error('Ошибка восстановления изображения после изменения размера:', e);
                }
            }
        }
    }

    // Функция для отправки данных рисования через WebSocket
    function sendDrawData(drawData: any) {
        if (!socket || socket.readyState !== WebSocket.OPEN || !$boardsStore.activeBoard) return;
        
        try {
            if (socket) {
                socket.send(JSON.stringify({
                    method: 'draw',
                    id: $boardsStore.activeBoard,
                    figure: drawData
                }));
            }
            
            // Также отправляем обновление через модуль синхронизации
            import('../stores/sync').then(module => {
                module.sendCanvasUpdate();
            });
        } catch (e) {
            console.error('Ошибка отправки данных рисования:', e);
            reconnectSocket();
        }
    }

    // Функция для обработки полученных данных рисования
    function handleDrawData(msg: any) {
        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const figure = msg.figure;
        switch (figure.type) {
            case 'brush':
                drawBrush(ctx, figure);
                break;
            case 'dot':
                drawDot(ctx, figure);
                break;
            case 'line':
                drawLine(ctx, figure);
                break;
            case 'rect':
                drawRect(ctx, figure);
                break;
            default:
                console.log('Неизвестный тип фигуры:', figure.type);
        }
    }

    // Функция для рисования кистью
    function drawBrush(ctx: CanvasRenderingContext2D, figure: any) {
        ctx.strokeStyle = figure.strokeStyle;
        ctx.lineWidth = figure.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        ctx.beginPath();
        ctx.moveTo(figure.x, figure.y);
        ctx.lineTo(figure.x2, figure.y2);
        ctx.stroke();
    }
    
    // Функция для рисования точки
    function drawDot(ctx: CanvasRenderingContext2D, figure: any) {
        ctx.strokeStyle = figure.strokeStyle;
        ctx.lineWidth = figure.lineWidth;
        
        const radius = ctx.lineWidth / 25;
        ctx.beginPath();
        ctx.arc(figure.x, figure.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Функция для рисования линии
    function drawLine(ctx: CanvasRenderingContext2D, figure: any) {
        ctx.strokeStyle = figure.strokeStyle;
        ctx.lineWidth = figure.lineWidth;
        ctx.lineCap = "round";
        
        ctx.beginPath();
        ctx.moveTo(figure.x1, figure.y1);
        ctx.lineTo(figure.x2, figure.y2);
        ctx.stroke();
    }
    
    // Функция для рисования прямоугольника
    function drawRect(ctx: CanvasRenderingContext2D, figure: any) {
        ctx.strokeStyle = figure.strokeStyle;
        ctx.lineWidth = figure.lineWidth;
        
        ctx.beginPath();
        ctx.rect(figure.x, figure.y, figure.width, figure.height);
        ctx.stroke();
    }

    // Функция для создания WebSocket соединения
    function createSocketConnection() {
        if (socket) {
            try {
                socket.onclose = null;
                socket.onerror = null;
                socket.onmessage = null;
                socket.onopen = null;
                socket.close();
            } catch (e) {
                console.error('Ошибка при закрытии сокета:', e);
            }
        }
        
        try {
            socket = new WebSocket('ws://localhost:5000/');
            
            socket.onopen = () => {
                console.log('Canvas WebSocket соединение установлено');
                
                // Подключаемся к активной доске
                if ($boardsStore.activeBoard) {
                    try {
                        socket.send(JSON.stringify({
                            method: 'connection',
                            id: $boardsStore.activeBoard,
                            username: 'user'
                        }));
                    } catch (e) {
                        console.error('Ошибка отправки данных подключения:', e);
                    }
                }
            };
            
            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.method === 'draw') {
                        handleDrawData(msg);
                    }
                } catch (e) {
                    console.error('Ошибка обработки сообщения WebSocket:', e);
                }
            };
            
            socket.onclose = (event) => {
                console.log('Canvas WebSocket соединение закрыто', event.code, event.reason);
                reconnectSocket();
            };
            
            socket.onerror = (error) => {
                console.error('Canvas WebSocket ошибка:', error);
                reconnectSocket();
            };
        } catch (e) {
            console.error('Ошибка при создании WebSocket соединения:', e);
            reconnectSocket();
        }
    }
    
    // Функция для переподключения сокета
    function reconnectSocket() {
        if (socketReconnectTimer) {
            clearTimeout(socketReconnectTimer);
        }
        
        socketReconnectTimer = setTimeout(() => {
            createSocketConnection();
        }, 3000) as unknown as number;
    }

    // Следим за изменением активной доски
    boardsStore.subscribe(state => {
        if (lastActiveBoard !== state.activeBoard && state.activeBoard) {
            lastActiveBoard = state.activeBoard;
            
            // Очищаем историю при смене доски
            if (canvasEl) {
                clearHistory();
                
                // Проверяем, есть ли кэшированное состояние для этой доски
                const cachedState = localStorage.getItem(`whiteboard_state_${state.activeBoard}`);
                const cachedResolution = localStorage.getItem(`whiteboard_resolution_${state.activeBoard}`);
                
                // Если есть кэшированное разрешение, применяем его
                if (cachedResolution) {
                    try {
                        const resolution = JSON.parse(cachedResolution);
                        if (resolution.width && resolution.height) {
                            // Адаптируем размер холста под сохраненное разрешение
                            const parent = canvasEl.parentElement;
                            if (parent) {
                                // Проверяем, мобильное ли устройство
                                const isMobile = window.innerWidth <= 768;
                                
                                if (isMobile) {
                                    // На мобильных устройствах адаптируем под экран
                                    canvasEl.width = parent.clientWidth;
                                    canvasEl.height = Math.min(parent.clientHeight, parent.clientWidth * 1.5);
                                } else {
                                    // На десктопе пытаемся сохранить оригинальное разрешение
                                    if (resolution.width <= parent.clientWidth && resolution.height <= parent.clientHeight) {
                                        canvasEl.width = resolution.width;
                                        canvasEl.height = resolution.height;
                                    } else {
                                        // Если не помещается, масштабируем с сохранением пропорций
                                        const ratio = Math.min(
                                            parent.clientWidth / resolution.width,
                                            parent.clientHeight / resolution.height
                                        );
                                        canvasEl.width = Math.floor(resolution.width * ratio);
                                        canvasEl.height = Math.floor(resolution.height * ratio);
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Ошибка при чтении сохраненного разрешения:', e);
                    }
                }
                
                // Если есть кэшированное состояние, используем его для быстрой загрузки
                if (cachedState) {
                    try {
                        const img = new Image();
                        img.onload = () => {
                            const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
                            if (ctx) {
                                ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                                ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
                                saveInitialState();
                                console.log('Загружено кэшированное состояние доски');
                            }
                        };
                        img.src = cachedState;
                    } catch (e) {
                        console.error('Ошибка загрузки кэшированного состояния:', e);
                    }
                }
                
                // Загружаем изображение с сервера (даже если есть кэш, для синхронизации)
                fetch(`http://localhost:5000/image?id=${state.activeBoard}&metadata=true`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Ошибка загрузки изображения');
                        }
                        return response.json();
                    })
                    .then(data => {
                        // Проверяем, получили ли мы объект с метаданными или просто строку с изображением
                        let imageData = data;
                        let metadata = null;
                        
                        if (typeof data === 'object' && data.imageData) {
                            imageData = data.imageData;
                            metadata = data.metadata;
                            
                            // Если есть метаданные с разрешением, сохраняем их
                            if (metadata && metadata.resolution) {
                                localStorage.setItem(`whiteboard_resolution_${state.activeBoard}`, 
                                    JSON.stringify(metadata.resolution));
                            }
                        }
                        
                        if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
                            const img = new Image();
                            img.onload = () => {
                                const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
                                if (ctx) {
                                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                                    ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
                                    
                                    // Сохраняем изображение в локальное хранилище для быстрой загрузки
                                    localStorage.setItem(`whiteboard_state_${state.activeBoard}`, imageData);
                                    
                                    // После загрузки изображения сохраняем начальное состояние
                                    saveInitialState();
                                    
                                    // Переинициализируем WebSocket соединение для синхронизации
                                    import('../stores/sync').then(module => {
                                        module.initializeSync();
                                    });
                                }
                            };
                            img.src = imageData;
                        }
                    })
                    .catch(err => {
                        console.error('Ошибка загрузки изображения:', err);
                        
                        // Если не удалось загрузить с сервера, но есть кэш, используем его
                        if (!cachedState) {
                            // Если нет кэша, создаем пустую доску
                            const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
                            if (ctx) {
                                ctx.fillStyle = "#ffffff";
                                ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
                                saveInitialState();
                            }
                        }
                        
                        // Все равно инициализируем синхронизацию
                        import('../stores/sync').then(module => {
                            module.initializeSync();
                        });
                    });
            }
        }
    });

    onMount(() => {
        // Определяем, является ли устройство мобильным
        const isMobile = window.innerWidth <= 768;
        
        // Настраиваем обработчики для сенсорных событий на мобильных устройствах
        if (isMobile) {
            document.body.classList.add('mobile-device');
        }
        
        resizeCanvas();
        canvas.set(canvasEl);

        requestAnimationFrame(() => {
            const currentTool = new Brush(canvasEl);
            
            // Добавляем обработчик для отправки данных рисования
            currentTool.onDraw = sendDrawData;
            
            tool.set(currentTool);
            
            // Сохраняем начальное состояние для истории
            saveInitialState();
        });

        // Создаем WebSocket соединение
        createSocketConnection();
        
        // Инициализируем синхронизацию с небольшой задержкой для уменьшения нагрузки при запуске
        setTimeout(() => {
            import('../stores/sync').then(module => {
                module.initializeSync();
            });
        }, 300);

        // Добавляем обработчик изменения размера с дебаунсом
        let resizeTimer: number | null = null;
        const handleResize = () => {
            if (resizeTimer) {
                clearTimeout(resizeTimer);
            }
            resizeTimer = setTimeout(() => {
                resizeCanvas();
                // Отправляем обновление после изменения размера
                import('../stores/sync').then(module => {
                    module.sendCanvasUpdate(true);
                });
            }, 250) as unknown as number;
        };
        
        window.addEventListener("resize", handleResize);
        
        // Добавляем обработчики для сенсорных событий на мобильных устройствах
        if (isMobile) {
            canvasEl.addEventListener('touchstart', (e) => {
                // Предотвращаем масштабирование страницы при рисовании
                if (e.touches.length === 1) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
        
        // Настраиваем синхронизацию между вкладками
        let broadcastChannel: BroadcastChannel | null = null;
        try {
            broadcastChannel = new BroadcastChannel('whiteboard-sync');
            broadcastChannel.onmessage = (event) => {
                const message = event.data;
                
                // Обрабатываем сообщения от других вкладок
                if (message.type === 'board-loaded' && message.id === $boardsStore.activeBoard) {
                    // Обновляем холст, если загружена та же доска в другой вкладке
                    const img = new Image();
                    img.onload = () => {
                        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
                        if (ctx) {
                            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                            ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
                            saveInitialState();
                        }
                    };
                    img.src = message.imageData;
                } else if (message.type === 'canvas-update' && message.id === $boardsStore.activeBoard) {
                    // Обновляем холст, если изменена та же доска в другой вкладке
                    const img = new Image();
                    img.onload = () => {
                        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
                        if (ctx) {
                            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                            ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
                        }
                    };
                    img.src = message.imageData;
                }
            };
        } catch (e) {
            console.error('Ошибка инициализации BroadcastChannel:', e);
        }
        
        return () => {
            window.removeEventListener("resize", handleResize);
            if (resizeTimer) {
                clearTimeout(resizeTimer);
            }
            if (socketReconnectTimer) {
                clearTimeout(socketReconnectTimer);
            }
            if (socket) {
                socket.onclose = null; // Отключаем обработчик, чтобы избежать повторного вызова
                socket.close();
            }
            
            // Закрываем канал синхронизации между вкладками
            if (broadcastChannel) {
                broadcastChannel.close();
            }
            
            // Удаляем обработчики сенсорных событий
            if (isMobile) {
                canvasEl.removeEventListener('touchstart', () => {});
                document.body.classList.remove('mobile-device');
            }
        };
    });
</script>

<div class="canvas-container h-[calc(100vh-12.5rem)] overflow-auto">
    <canvas bind:this={canvasEl} class="block bg-white mx-auto my-0"></canvas>
</div>

<style>
    /* Стили для адаптивного отображения холста */
    .canvas-container {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
        height: calc(100vh - 12.5rem);
        overflow: auto;
    }
    
    /* Медиа-запросы для адаптации под разные устройства */
    @media (max-width: 768px) {
        .canvas-container {
            height: calc(100vh - 16rem); /* Больше места для инструментов на мобильных */
            overflow: hidden; /* Предотвращаем прокрутку на мобильных */
        }
        
        canvas {
            touch-action: none; /* Улучшаем работу с сенсорными экранами */
        }
    }
</style>