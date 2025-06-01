import { Tool } from "./base";
import { saveToHistory } from "../stores/history";

export class Brush extends Tool {
    mouseDown = false;
    lastX: number;
    lastY: number;
    onDraw: ((data: any) => void) | null = null;
    initialState: ImageData | null = null;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.toolCursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><circle cx=\'12\' cy=\'12\' r=\'6\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'/><circle cx=\'12\' cy=\'12\' r=\'2\' fill=\'black\'/></svg>") 12 12, auto';
        this.listen();
        this.lastX = 0;
        this.lastY = 0;

        // Настройки для сглаживания линий
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";
        this.ctx.shadowBlur = 1;
        this.ctx.shadowColor = this.ctx.strokeStyle.toString();
    }

    listen() {
        this.canvas.onmousedown = this.mouseDownHandler.bind(this);
        this.canvas.onmousemove = this.mouseMoveHandler.bind(this);
        this.canvas.onmouseup = this.mouseUpHandler.bind(this);
        this.canvas.onmouseleave = this.mouseUpHandler.bind(this);
    }

    mouseDownHandler(event: MouseEvent) {
        this.mouseDown = true;
        const { x, y } = this.getCords(event);

        // Сохраняем состояние перед началом рисования для истории
        this.initialState = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.lastX = x;
        this.lastY = y;
        this.drawDot(x, y); // Сразу по клику

        // Отправляем данные о точке через WebSocket
        if (this.onDraw) {
            this.onDraw({
                type: 'dot',
                x: x,
                y: y,
                strokeStyle: this.ctx.strokeStyle.toString(),
                lineWidth: this.ctx.lineWidth
            });
        }
    }

    mouseMoveHandler(event: MouseEvent) {
        // Обновляем курсор в соответствии с текущим размером кисти
        const brushSize = Math.max(6, Math.min(20, this.ctx.lineWidth / 2));
        this.canvas.style.cursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${brushSize * 2}' height='${brushSize * 2}' viewBox='0 0 ${brushSize * 2} ${brushSize * 2}'><circle cx='${brushSize}' cy='${brushSize}' r='${brushSize - 1}' fill='none' stroke='white' stroke-width='2'/><circle cx='${brushSize}' cy='${brushSize}' r='${brushSize / 3}' fill='white'/><circle cx='${brushSize}' cy='${brushSize}' r='${brushSize - 1}' fill='none' stroke='black' stroke-width='1'/></svg>") ${brushSize} ${brushSize}, auto`;

        if (!this.mouseDown) return;

        const { x, y } = this.getCords(event);

        // Обновляем цвет тени в соответствии с текущим цветом обводки
        this.ctx.shadowColor = this.ctx.strokeStyle.toString();

        // Используем квадратичные кривые Безье для сглаживания
        this.ctx.quadraticCurveTo(
            this.lastX,
            this.lastY,
            (this.lastX + x) / 2,
            (this.lastY + y) / 2
        );

        this.ctx.stroke();

        // Отправляем данные о рисовании через WebSocket
        if (this.onDraw) {
            this.onDraw({
                type: 'brush',
                x: this.lastX,
                y: this.lastY,
                x2: x,
                y2: y,
                strokeStyle: this.ctx.strokeStyle.toString(),
                lineWidth: this.ctx.lineWidth
            });
        }

        this.lastX = x;
        this.lastY = y;
    }

    mouseUpHandler() {
        if (!this.mouseDown) return;

        this.mouseDown = false;
        this.ctx.closePath();

        // Сохраняем состояние в историю после завершения рисования
        if (this.initialState) {
            saveToHistory(this.initialState);
            this.initialState = null;
        }
    }

    drawDot(x: number, y: number) {
        const radius = this.ctx.lineWidth / 25;

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.closePath();
    }
}
