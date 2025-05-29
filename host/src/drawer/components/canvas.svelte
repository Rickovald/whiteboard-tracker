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

        canvasEl.width = parent.clientWidth;
        canvasEl.height = parent.clientHeight;

        const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
        if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
        }
    }

    // Функция для отправки данных рисования через WebSocket
    function sendDrawData(drawData: any) {
        if (!socket || socket.readyState !== WebSocket.OPEN || !$boardsStore.activeBoard) return;
        
        try {
            socket.send(JSON.stringify({
                method: 'draw',
                id: $boardsStore.activeBoard,
                figure: drawData
            }));
            
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
        }, 3000);
    }

    // Следим за изменением активной доски
    boardsStore.subscribe(state => {
        if (lastActiveBoard !== state.activeBoard && state.activeBoard) {
            lastActiveBoard = state.activeBoard;
            
            // Очищаем историю при смене доски
            if (canvasEl) {
                clearHistory();
                
                // Загружаем изображение с сервера
                fetch(`http://localhost:5000/image?id=${state.activeBoard}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Ошибка загрузки изображения');
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (typeof data === 'string' && data.startsWith('data:image')) {
                            const img = new Image();
                            img.onload = () => {
                                const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
                                if (ctx) {
                                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                                    ctx.drawImage(img, 0, 0);
                                    
                                    // После загрузки изображения сохраняем начальное состояние
                                    saveInitialState();
                                    
                                    // Переинициализируем WebSocket соединение для синхронизации
                                    import('../stores/sync').then(module => {
                                        module.initializeSync();
                                    });
                                }
                            };
                            img.src = data;
                        }
                    })
                    .catch(err => {
                        console.error('Ошибка загрузки изображения:', err);
                        saveInitialState();
                    });
            }
        }
    });

    onMount(() => {
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

        window.addEventListener("resize", resizeCanvas);
        
        return () => {
            window.removeEventListener("resize", resizeCanvas);
            if (socketReconnectTimer) {
                clearTimeout(socketReconnectTimer);
            }
            if (socket) {
                socket.onclose = null; // Отключаем обработчик, чтобы избежать повторного вызова
                socket.close();
            }
        };
    });
</script>

<div class="h-[calc(100vh-12.5rem)]">
    <canvas bind:this={canvasEl} class="block bg-white"></canvas>
</div>