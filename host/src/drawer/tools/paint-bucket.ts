import { Tool } from "./base";
import { get } from 'svelte/store';
import { fillColor } from '../stores/tool';

export class PaintBucket extends Tool {
    toolCursor: string = 'crosshair';
    private boundHandleMouseDown: (event: MouseEvent) => void;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
    }

    private handleMouseDown(event: MouseEvent) {
        const { x, y } = this.getCords(event);
        this.floodFill(Math.floor(x), Math.floor(y));
    }

    private async floodFill(startX: number, startY: number) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Проверка координат
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

        const index = (startY * width + startX) * 4;
        const targetColor = [
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3]
        ];

        // Получаем цвет заливки
        const newColor = this.parseColor(get(fillColor));

        // Если цвета совпадают — выходим
        if (this.colorsMatch(targetColor, newColor)) return;

        // Сохраняем состояние в историю
        this.saveToHistory(imageData);

        // Используем Uint8Array для ускорения
        const visited = new Uint8Array(width * height);
        const queue: number[] = [];

        // Добавляем начальную точку
        queue.push(startX, startY);
        visited[startY * width + startX] = 1;

        // Асинхронный BFS для предотвращения блокировки UI
        const processChunk = () => {
            const chunkSize = 1000; // Обрабатываем по 1000 пикселей за раз
            let iterations = 0;

            while (queue.length > 0 && iterations < chunkSize) {
                const y = queue.pop()!;
                const x = queue.pop()!;

                const currentIndex = (y * width + x) * 4;

                // Обновляем цвет
                data[currentIndex] = newColor[0];
                data[currentIndex + 1] = newColor[1];
                data[currentIndex + 2] = newColor[2];
                data[currentIndex + 3] = newColor[3];

                // Проверяем соседей
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                    const nKey = ny * width + nx;
                    if (visited[nKey]) continue;

                    const nIndex = nKey * 4;
                    if (
                        data[nIndex] === targetColor[0] &&
                        data[nIndex + 1] === targetColor[1] &&
                        data[nIndex + 2] === targetColor[2] &&
                        data[nIndex + 3] === targetColor[3]
                    ) {
                        queue.push(nx, ny);
                        visited[nKey] = 1;
                    }
                }
                iterations++;
            }

            // Обновляем холст
            this.ctx.putImageData(imageData, 0, 0);

            // Продолжаем обработку, если очередь не пуста
            if (queue.length > 0) {
                requestAnimationFrame(processChunk);
            }
        };

        requestAnimationFrame(processChunk);
    }

    // Преобразует строку цвета в RGBA массив
    private parseColor(color: string): [number, number, number, number] {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1;
        tempCanvas.height = 1;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.fillStyle = color;
        tempCtx.fillRect(0, 0, 1, 1);
        const data = tempCtx.getImageData(0, 0, 1, 1).data;
        return [data[0], data[1], data[2], data[3]];
    }

    // Сравнивает два цвета
    private colorsMatch(a: number[], b: number[]): boolean {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }

    // Перезаписываем destroy для удаления обработчика
    destroy() {
        super.destroy();
        this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
    }
}