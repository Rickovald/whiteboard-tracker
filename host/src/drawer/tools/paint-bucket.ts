import { Tool } from "./base";

export class PaintBucket extends Tool {
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.listen();
    }

    listen() {
        this.canvas.onclick = this.clickHandler.bind(this);
    }

    clickHandler(event: MouseEvent) {
        const { x, y } = this.getCords(event);
        
        // Сохраняем текущее состояние для истории
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Выполняем заливку
        this.fill(Math.floor(x), Math.floor(y));
        
        // Сохраняем в историю
        this.saveToHistory(imageData);
    }

    fill(startX: number, startY: number) {
        // Получаем данные изображения
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Получаем цвет начальной точки
        const startPos = (startY * width + startX) * 4;
        const startR = data[startPos];
        const startG = data[startPos + 1];
        const startB = data[startPos + 2];
        
        // Получаем цвет заливки
        let fillColor = this.ctx.fillStyle.toString();
        let fillR = 0, fillG = 0, fillB = 0;
        
        // Преобразуем цвет заливки в RGB
        if (fillColor.startsWith('#')) {
            const r = parseInt(fillColor.slice(1, 3), 16);
            const g = parseInt(fillColor.slice(3, 5), 16);
            const b = parseInt(fillColor.slice(5, 7), 16);
            fillR = r;
            fillG = g;
            fillB = b;
        } else if (fillColor.startsWith('rgb')) {
            const match = fillColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                fillR = parseInt(match[1]);
                fillG = parseInt(match[2]);
                fillB = parseInt(match[3]);
            }
        }
        
        // Если начальный цвет совпадает с цветом заливки, ничего не делаем
        if (startR === fillR && startG === fillG && startB === fillB) {
            return;
        }
        
        // Простой алгоритм заливки
        const queue = [[startX, startY]];
        const visited = new Set<string>();
        
        while (queue.length > 0) {
            const [x, y] = queue.shift()!;
            const key = `${x},${y}`;
            
            if (
                x < 0 || x >= width || y < 0 || y >= height || // За пределами холста
                visited.has(key) // Уже посещена
            ) {
                continue;
            }
            
            const pos = (y * width + x) * 4;
            
            // Проверяем, совпадает ли цвет с начальным
            if (
                data[pos] !== startR ||
                data[pos + 1] !== startG ||
                data[pos + 2] !== startB
            ) {
                continue;
            }
            
            // Устанавливаем новый цвет
            data[pos] = fillR;
            data[pos + 1] = fillG;
            data[pos + 2] = fillB;
            data[pos + 3] = 255;
            
            visited.add(key);
            
            // Добавляем соседние пиксели
            queue.push([x + 1, y]);
            queue.push([x - 1, y]);
            queue.push([x, y + 1]);
            queue.push([x, y - 1]);
        }
        
        // Обновляем изображение
        this.ctx.putImageData(imageData, 0, 0);
    }

    destroy() {
        this.canvas.onclick = null;
        super.destroy();
    }
}