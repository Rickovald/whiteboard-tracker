import { Tool } from "./base";

export class Eraser extends Tool {
    mouseDown = false;
    lastX = 0;
    lastY = 0;
    originalStrokeStyle: string | CanvasGradient | CanvasPattern;
    originalLineWidth: number;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.listen();
        this.lastX = 0;
        this.lastY = 0;
        
        // Сохраняем оригинальные стили
        this.originalStrokeStyle = this.ctx.strokeStyle;
        this.originalLineWidth = this.ctx.lineWidth;
        
        // Настройки для ластика
        this.ctx.lineWidth = 20; // Ластик обычно толще кисти
    }

    listen() {
        this.canvas.onmousedown = this.mouseDownHandler.bind(this);
        this.canvas.onmousemove = this.mouseMoveHandler.bind(this);
        this.canvas.onmouseup = this.mouseUpHandler.bind(this);
    }

    mouseDownHandler(event: MouseEvent) {
        this.mouseDown = true;
        const { x, y } = this.getCords(event);
        
        // Сохраняем текущий цвет и устанавливаем белый для ластика
        this.originalStrokeStyle = this.ctx.strokeStyle;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.globalCompositeOperation = "destination-out";
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.lastX = x;
        this.lastY = y;
    }

    mouseMoveHandler(event: MouseEvent) {
        if (!this.mouseDown) return;

        const { x, y } = this.getCords(event);
        
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
    }
    
    mouseUpHandler() {
        this.mouseDown = false;
        this.ctx.closePath();
        
        // Восстанавливаем оригинальные настройки
        this.ctx.strokeStyle = this.originalStrokeStyle;
        this.ctx.globalCompositeOperation = "source-over";
    }
    
    destroy() {
        super.destroy();
        // Восстанавливаем оригинальные настройки при уничтожении
        this.ctx.strokeStyle = this.originalStrokeStyle;
        this.ctx.lineWidth = this.originalLineWidth;
        this.ctx.globalCompositeOperation = "source-over";
    }
}