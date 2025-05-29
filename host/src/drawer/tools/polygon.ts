import { Tool } from "./base";

export class Polygon extends Tool {
    points: {x: number, y: number}[] = [];
    tempImageData: ImageData | null = null;
    
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.listen();
    }

    listen() {
        this.canvas.onclick = this.clickHandler.bind(this);
        this.canvas.onmousemove = this.mouseMoveHandler.bind(this);
        this.canvas.oncontextmenu = this.rightClickHandler.bind(this);
    }

    clickHandler(event: MouseEvent) {
        if (event.button !== 0) return; // Только левый клик
        
        const { x, y } = this.getCords(event);
        
        // Добавляем точку в многоугольник
        this.points.push({x, y});
        
        // Если это первая точка, сохраняем состояние холста
        if (this.points.length === 1) {
            this.tempImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Рисуем линию от предыдущей точки к текущей
            this.drawPolygon(false);
        }
    }

    mouseMoveHandler(event: MouseEvent) {
        if (this.points.length > 0) {
            // Восстанавливаем исходное состояние
            if (this.tempImageData) {
                this.ctx.putImageData(this.tempImageData, 0, 0);
            }
            
            const { x, y } = this.getCords(event);
            
            // Рисуем многоугольник с временной линией к текущей позиции мыши
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[0].x, this.points[0].y);
            
            for (let i = 1; i < this.points.length; i++) {
                this.ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            
            this.ctx.lineTo(x, y);
            
            // Если больше 2 точек, замыкаем к начальной точке для предпросмотра
            if (this.points.length > 2) {
                this.ctx.lineTo(this.points[0].x, this.points[0].y);
            }
            
            this.ctx.stroke();
        }
    }
    
    rightClickHandler(event: MouseEvent) {
        event.preventDefault();
        
        if (this.points.length > 2) {
            // Завершаем многоугольник по правому клику
            this.drawPolygon(true);
            
            // Сохраняем в историю
            if (this.tempImageData) {
                this.saveToHistory(this.tempImageData);
            }
            
            this.points = [];
            this.tempImageData = null;
        }
        
        return false;
    }
    
    drawPolygon(close: boolean) {
        // Восстанавливаем исходное состояние
        if (this.tempImageData) {
            this.ctx.putImageData(this.tempImageData, 0, 0);
        }
        
        // Рисуем многоугольник
        this.ctx.beginPath();
        this.ctx.moveTo(this.points[0].x, this.points[0].y);
        
        for (let i = 1; i < this.points.length; i++) {
            this.ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        
        if (close) {
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        this.ctx.stroke();
    }
    
    destroy() {
        this.canvas.onclick = null;
        this.canvas.oncontextmenu = null;
        super.destroy();
    }
}