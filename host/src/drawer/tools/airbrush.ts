import { Tool } from "./base";

export class Airbrush extends Tool {
    mouseDown = false;
    density = 30; // Плотность распыления
    spread = 15;  // Разброс точек
    
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
        this.spray(event);
    }

    mouseMoveHandler(event: MouseEvent) {
        if (this.mouseDown) {
            this.spray(event);
        }
    }

    mouseUpHandler() {
        this.mouseDown = false;
    }

    spray(event: MouseEvent) {
        const { x, y } = this.getCords(event);
        
        // Рисуем несколько точек с разным разбросом
        for (let i = 0; i < this.density; i++) {
            const offsetX = Math.random() * 2 * this.spread - this.spread;
            const offsetY = Math.random() * 2 * this.spread - this.spread;
            
            // Уменьшаем непрозрачность для точек дальше от центра
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const opacity = 1 - (distance / this.spread);
            
            if (opacity > 0) {
                const size = Math.random() * 2 + 0.5;
                
                this.ctx.beginPath();
                this.ctx.globalAlpha = opacity * 0.25; // Делаем точки полупрозрачными
                this.ctx.arc(x + offsetX, y + offsetY, size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1.0; // Восстанавливаем непрозрачность
            }
        }
    }
}