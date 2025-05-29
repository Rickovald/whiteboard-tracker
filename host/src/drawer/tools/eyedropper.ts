import { Tool } from "./base";
import { strokeColor, fillColor } from "../stores/tool";

export class Eyedropper extends Tool {
    isStroke = true; // По умолчанию выбираем цвет обводки
    
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.listen();
    }

    listen() {
        this.canvas.onclick = this.clickHandler.bind(this);
        document.addEventListener('keydown', this.keyDownHandler.bind(this));
        document.addEventListener('keyup', this.keyUpHandler.bind(this));
    }

    clickHandler(event: MouseEvent) {
        const { x, y } = this.getCords(event);
        
        // Получаем цвет пикселя
        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
        const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        
        // Устанавливаем цвет в зависимости от режима
        if (this.isStroke) {
            strokeColor.set(color);
        } else {
            fillColor.set(color);
        }
    }
    
    keyDownHandler(event: KeyboardEvent) {
        if (event.key === 'Alt') {
            this.isStroke = false;
        }
    }
    
    keyUpHandler(event: KeyboardEvent) {
        if (event.key === 'Alt') {
            this.isStroke = true;
        }
    }

    destroy() {
        this.canvas.onclick = null;
        document.removeEventListener('keydown', this.keyDownHandler);
        document.removeEventListener('keyup', this.keyUpHandler);
        super.destroy();
    }
}