import { Tool } from "./base";

export class Rect extends Tool {
    mouseDown = false;
    startX = 0;
    startY = 0;
    currentX = 0;
    currentY = 0;

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

        // Очищаем холст и перерисовываем прямоугольник
        this.redrawRect();
    }

    mouseUpHandler() {
        if (!this.mouseDown) return;

        this.mouseDown = false;
        // Рисуем финальный прямоугольник
        this.drawRect(this.startX, this.startY, this.currentX - this.startX, this.currentY - this.startY);
    }

    // Сохраняем копию холста для восстановления при перерисовке
    imageData: ImageData | null = null;

    redrawRect() {
        if (!this.imageData) return;

        // Восстанавливаем предыдущее состояние холста
        this.ctx.putImageData(this.imageData, 0, 0);

        // Рисуем текущий прямоугольник
        this.drawRect(this.startX, this.startY, this.currentX - this.startX, this.currentY - this.startY);
    }

    drawRect(x: number, y: number, width: number, height: number) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);
        this.ctx.fill();   // Заливка с использованием fillStyle из базового класса
        this.ctx.stroke(); // Обводка с использованием strokeStyle из базового класса
        this.ctx.closePath();
    }
}
