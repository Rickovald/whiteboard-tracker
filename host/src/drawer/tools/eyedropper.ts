import { Tool } from "./base";
import { strokeColor, fillColor, activeColorMode } from "../stores/tool";

export class Eyedropper extends Tool {
    previewElement: HTMLDivElement | null = null;
    
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.toolCursor = 'crosshair';
        this.listen();
        this.createPreviewElement();
    }

    listen() {
        this.canvas.onclick = this.clickHandler.bind(this);
        this.canvas.onmousemove = this.mouseMoveHandler.bind(this);
    }

    createPreviewElement() {
        // Создаем элемент для предпросмотра цвета
        this.previewElement = document.createElement('div');
        this.previewElement.style.position = 'absolute';
        this.previewElement.style.width = '30px';
        this.previewElement.style.height = '30px';
        this.previewElement.style.borderRadius = '50%';
        this.previewElement.style.border = '2px solid white';
        this.previewElement.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
        this.previewElement.style.pointerEvents = 'none';
        this.previewElement.style.zIndex = '1000';
        this.previewElement.style.display = 'none';
        document.body.appendChild(this.previewElement);
    }

    clickHandler(event: MouseEvent) {
        const { x, y } = this.getCords(event);
        this.pickColor(x, y);
    }
    
    mouseMoveHandler(event: MouseEvent) {
        // Показываем предварительный просмотр цвета при движении мыши
        const { x, y } = this.getCords(event);
        
        try {
            // Получаем цвет пикселя под курсором
            const pixel = this.ctx.getImageData(x, y, 1, 1).data;
            const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
            
            // Обновляем предпросмотр цвета
            if (this.previewElement) {
                this.previewElement.style.display = 'block';
                this.previewElement.style.backgroundColor = color;
                this.previewElement.style.left = `${event.clientX + 15}px`;
                this.previewElement.style.top = `${event.clientY + 15}px`;
            }
            
            // Меняем курсор на пипетку с цветом
            this.canvas.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%23000" d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L14.13,6.12L18.88,10.87L21.71,8.04C22.1,7.65 22.1,7 21.71,6.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z"/><circle cx="5" cy="19" r="3" fill="${encodeURIComponent(color)}" stroke="white" stroke-width="1"/></svg>') 0 24, auto`;
        } catch (e) {
            // Если не удалось получить цвет, скрываем предпросмотр
            if (this.previewElement) {
                this.previewElement.style.display = 'none';
            }
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    pickColor(x: number, y: number) {
        try {
            // Получаем цвет пикселя
            const pixel = this.ctx.getImageData(x, y, 1, 1).data;
            const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
            
            // Получаем текущий режим выбора цвета
            let currentMode = 'stroke';
            activeColorMode.subscribe(mode => {
                currentMode = mode;
            })();
            
            // Устанавливаем цвет в зависимости от режима
            if (currentMode === 'stroke') {
                strokeColor.set(color);
            } else {
                fillColor.set(color);
            }
            
            // Показываем уведомление о выбранном цвете
            this.showColorNotification(color, currentMode);
        } catch (e) {
            console.error('Ошибка при выборе цвета:', e);
        }
    }
    
    showColorNotification(color: string, mode: string) {
        // Создаем временное уведомление о выбранном цвете
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'rgba(0,0,0,0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '1000';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.gap = '10px';
        
        const colorPreview = document.createElement('div');
        colorPreview.style.width = '20px';
        colorPreview.style.height = '20px';
        colorPreview.style.backgroundColor = color;
        colorPreview.style.border = '1px solid white';
        colorPreview.style.borderRadius = '3px';
        
        const text = document.createElement('span');
        text.textContent = `Цвет ${mode === 'stroke' ? 'обводки' : 'заливки'}: ${color}`;
        
        notification.appendChild(colorPreview);
        notification.appendChild(text);
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 2 секунды
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }

    destroy() {
        this.canvas.onclick = null;
        this.canvas.onmousemove = null;
        
        // Удаляем элемент предпросмотра
        if (this.previewElement) {
            document.body.removeChild(this.previewElement);
            this.previewElement = null;
        }
        
        super.destroy();
    }
}