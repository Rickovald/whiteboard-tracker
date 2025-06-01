import { strokeColor, fillColor, strokeWidth } from "../stores/tool";
import type { Unsubscriber } from "svelte/store";
import { saveToHistory } from "../stores/history";

export class Tool {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    private strokeUnsubscribe: Unsubscriber;
    private fillUnsubscribe: Unsubscriber;
    private widthUnsubscribe: Unsubscriber;
    onDraw: ((data: any) => void) | null = null;
    toolCursor: string = 'default'; // Курсор по умолчанию
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas

        const context = canvas.getContext('2d')
        if (!context) {
            throw new Error('Failed to get 2D context from canvas')
        }
        this.ctx = context;
        
        // Подписка на изменения цвета обводки
        this.strokeUnsubscribe = strokeColor.subscribe(value => {
            this.ctx.strokeStyle = value;
        });
        
        // Подписка на изменения цвета заливки
        this.fillUnsubscribe = fillColor.subscribe(value => {
            this.ctx.fillStyle = value;
        });
        
        // Подписка на изменения толщины линии
        this.widthUnsubscribe = strokeWidth.subscribe(value => {
            this.ctx.lineWidth = value;
        });
        
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = "high";
        
        // Устанавливаем курсор инструмента
        this.setCursor();
    }
    
    // Метод для установки курсора инструмента
    setCursor() {
        if (this.toolCursor !== 'default') {
            this.canvas.style.cursor = this.toolCursor;
        }
    }

    destroy() {
        this.canvas.onmousemove = null;
        this.canvas.onmousedown = null;
        this.canvas.onmouseup = null;
        this.canvas.style.cursor = 'default';
        
        // Отписка от хранилищ при уничтожении инструмента
        if (this.strokeUnsubscribe) this.strokeUnsubscribe();
        if (this.fillUnsubscribe) this.fillUnsubscribe();
        if (this.widthUnsubscribe) this.widthUnsubscribe();
    }

    getCords(event: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return { x, y };
    }
    
    // Метод для сохранения состояния в историю
    saveToHistory(state: ImageData) {
        saveToHistory(state);
    }
}