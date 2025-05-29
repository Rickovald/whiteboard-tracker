import { strokeColor, fillColor } from "../stores/tool";
import type { Unsubscriber } from "svelte/store";
import { saveToHistory } from "../stores/history";

export class Tool {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    private strokeUnsubscribe: Unsubscriber;
    private fillUnsubscribe: Unsubscriber;
    onDraw: ((data: any) => void) | null = null;
    
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
        
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = "high";
    }

    destroy() {
        this.canvas.onmousemove = null
        this.canvas.onmousedown = null
        this.canvas.onmouseup = null
        
        // Отписка от хранилищ при уничтожении инструмента
        if (this.strokeUnsubscribe) this.strokeUnsubscribe();
        if (this.fillUnsubscribe) this.fillUnsubscribe();
    }

    getCords(event: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        return { x, y }
    }
    
    // Метод для сохранения состояния в историю
    saveToHistory(state: ImageData) {
        saveToHistory(state);
    }
} 