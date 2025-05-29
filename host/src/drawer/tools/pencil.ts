import { Tool } from "./base";

export class Pencil extends Tool {
    mouseDown = false;
    lastX = 0;
    lastY = 0;
    
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.listen();
        
        // Сохраняем оригинальную толщину линии
        this.originalLineWidth = this.ctx.lineWidth;
        
        // Настройки для карандаша
        this.ctx.lineWidth = 1;
    }

    private originalLineWidth: number;

    listen() {
        this.canvas.onmousedown = this.mouseDownHandler.bind(this);
        this.canvas.onmousemove = this.mouseMoveHandler.bind(this);
        this.canvas.onmouseup = this.mouseUpHandler.bind(this);
    }

    mouseDownHandler(event: MouseEvent) {
        this.mouseDown = true;
        const { x, y } = this.getCords(event);
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.lastX = x;
        this.lastY = y;
        this.ctx.stroke();
    }

    mouseMoveHandler(event: MouseEvent) {
        if (!this.mouseDown) return;
        
        const { x, y } = this.getCords(event);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
    }
    
    mouseUpHandler() {
        this.mouseDown = false;
    }
    
    destroy() {
        // Восстанавливаем исходную толщину линии
        this.ctx.lineWidth = this.originalLineWidth;
        super.destroy();
    }
}