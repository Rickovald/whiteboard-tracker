import { Tool } from "./base";

export class Line extends Tool {
    mouseDown = false;
    startX = 0;
    startY = 0;
    currentX = 0;
    currentY = 0;
    imageData: ImageData | null = null;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.listen();
    }

    listen() {
        this.canvas.onmousedown = this.mouseDownHandler.bind(this);
        this.canvas.onmousemove = this.mouseMoveHandler.bind(this);
        this.canvas.onmouseup = this.mouseUpHandler.bind(this);
    }

    mouseDownHandler(event: MouseEvent) {
        this.mouseDown = true;
        const { x, y } = this.getCords(event);
        this.startX = x;
        this.startY = y;
        this.currentX = x;
        this.currentY = y;
        
        // Сохраняем текущее состояние холста
        this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    mouseMoveHandler(event: MouseEvent) {
        if (!this.mouseDown) return;

        const { x, y } = this.getCords(event);
        this.currentX = x;
        this.currentY = y;
        
        this.redrawLine();
    }

    mouseUpHandler() {
        if (!this.mouseDown) return;
        
        this.mouseDown = false;
        this.drawLine(this.startX, this.startY, this.currentX, this.currentY);
    }

    redrawLine() {
        if (!this.imageData) return;
        
        // Восстанавливаем предыдущее состояние холста
        this.ctx.putImageData(this.imageData, 0, 0);
        
        // Рисуем текущую линию
        this.drawLine(this.startX, this.startY, this.currentX, this.currentY);
    }

    drawLine(startX: number, startY: number, endX: number, endY: number) {
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        this.ctx.closePath();
    }
}