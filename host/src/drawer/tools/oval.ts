import { Tool } from "./base";

export class Oval extends Tool {
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
        
        // Если нажата клавиша Shift, делаем идеальный круг
        if (event.shiftKey) {
            const width = Math.abs(x - this.startX);
            const direction = y > this.startY ? 1 : -1;
            this.currentY = this.startY + (width * direction);
        } else {
            this.currentY = y;
        }
        
        this.redrawOval();
    }

    mouseUpHandler(event: MouseEvent) {
        if (!this.mouseDown) return;
        
        // Если нажата клавиша Shift, делаем идеальный круг
        if (event.shiftKey) {
            const width = Math.abs(this.currentX - this.startX);
            const direction = this.currentY > this.startY ? 1 : -1;
            this.currentY = this.startY + (width * direction);
        }
        
        this.mouseDown = false;
        this.drawOval();
    }

    redrawOval() {
        if (!this.imageData) return;
        
        // Восстанавливаем предыдущее состояние холста
        this.ctx.putImageData(this.imageData, 0, 0);
        
        // Рисуем текущий овал
        this.drawOval();
    }

    drawOval() {
        const width = this.currentX - this.startX;
        const height = this.currentY - this.startY;
        
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;
        const radiusX = Math.abs(width / 2);
        const radiusY = Math.abs(height / 2);
        
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.closePath();
    }
}