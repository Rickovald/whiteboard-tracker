import { Tool } from "./base";

export class Curve extends Tool {
    mouseDown = false;
    points: {x: number, y: number}[] = [];
    tempImageData: ImageData | null = null;
    
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.listen();
    }

    listen() {
        this.canvas.onmousedown = this.mouseDownHandler.bind(this);
        this.canvas.onmousemove = this.mouseMoveHandler.bind(this);
        this.canvas.onmouseup = this.mouseUpHandler.bind(this);
        this.canvas.onclick = this.clickHandler.bind(this);
    }

    mouseDownHandler(event: MouseEvent) {
        if (this.points.length === 0) {
            const { x, y } = this.getCords(event);
            this.points.push({x, y});
            this.mouseDown = true;
        }
    }

    mouseMoveHandler(event: MouseEvent) {
        if (this.points.length > 0) {
            // Сохраняем текущее состояние холста для предпросмотра
            if (!this.tempImageData) {
                this.tempImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            } else {
                this.ctx.putImageData(this.tempImageData, 0, 0);
            }
            
            const { x, y } = this.getCords(event);
            
            if (this.points.length === 1) {
                // Рисуем линию от первой точки до текущей позиции
                this.ctx.beginPath();
                this.ctx.moveTo(this.points[0].x, this.points[0].y);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            } else if (this.points.length === 2) {
                // Рисуем кривую Безье с контрольной точкой
                this.ctx.beginPath();
                this.ctx.moveTo(this.points[0].x, this.points[0].y);
                this.ctx.quadraticCurveTo(
                    this.points[1].x, this.points[1].y,
                    x, y
                );
                this.ctx.stroke();
            }
        }
    }
    
    mouseUpHandler() {
        this.mouseDown = false;
    }
    
    clickHandler(event: MouseEvent) {
        const { x, y } = this.getCords(event);
        
        if (this.points.length === 0) {
            // Первая точка - начало кривой
            this.points.push({x, y});
        } else if (this.points.length === 1) {
            // Вторая точка - контрольная точка
            this.points.push({x, y});
        } else if (this.points.length === 2) {
            // Третья точка - конец кривой
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[0].x, this.points[0].y);
            this.ctx.quadraticCurveTo(
                this.points[1].x, this.points[1].y,
                x, y
            );
            this.ctx.stroke();
            
            // Сбрасываем состояние
            this.points = [];
            this.tempImageData = null;
        }
    }
    
    destroy() {
        this.canvas.onclick = null;
        super.destroy();
    }
}