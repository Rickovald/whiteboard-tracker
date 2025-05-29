import { Tool } from "./base";

export class Select extends Tool {
    mouseDown = false;
    startX = 0;
    startY = 0;
    endX = 0;
    endY = 0;
    selection: ImageData | null = null;
    originalImageData: ImageData | null = null;
    isMoving = false;
    isResizing = false;
    resizeHandle = '';
    
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
        const { x, y } = this.getCords(event);
        
        if (this.selection) {
            // Проверяем, клик на маркере изменения размера
            const handle = this.getResizeHandle(x, y);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                return;
            }
            
            // Проверяем, клик внутри выделения
            if (this.isInSelection(x, y)) {
                this.isMoving = true;
                this.startX = x;
                this.startY = y;
                return;
            }
        }
        
        // Начинаем новое выделение
        this.mouseDown = true;
        this.startX = x;
        this.startY = y;
        this.endX = x;
        this.endY = y;
        
        // Сохраняем текущее состояние холста
        this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Сбрасываем предыдущее выделение
        this.selection = null;
    }

    mouseMoveHandler(event: MouseEvent) {
        const { x, y } = this.getCords(event);
        
        if (this.mouseDown) {
            // Обновляем выделение
            this.endX = x;
            this.endY = y;
            
            // Восстанавливаем исходное состояние
            if (this.originalImageData) {
                this.ctx.putImageData(this.originalImageData, 0, 0);
            }
            
            // Рисуем рамку выделения
            this.drawSelectionRect();
        } else if (this.isMoving && this.selection) {
            // Перемещаем выделение
            const dx = x - this.startX;
            const dy = y - this.startY;
            
            // Восстанавливаем исходное состояние
            if (this.originalImageData) {
                this.ctx.putImageData(this.originalImageData, 0, 0);
            }
            
            // Рисуем выделение в новой позиции
            this.ctx.putImageData(
                this.selection, 
                this.endX + dx, 
                this.endY + dy
            );
            
            // Рисуем рамку вокруг выделения
            this.drawSelectionBorder(this.endX + dx, this.endY + dy);
        } else if (this.isResizing && this.selection) {
            // Изменяем размер выделения
            this.resizeSelection(x, y);
        } else if (this.selection) {
            // Обновляем курсор при наведении на маркеры
            const handle = this.getResizeHandle(x, y);
            if (handle) {
                switch (handle) {
                    case 'nw': case 'se': this.canvas.style.cursor = 'nwse-resize'; break;
                    case 'ne': case 'sw': this.canvas.style.cursor = 'nesw-resize'; break;
                    case 'n': case 's': this.canvas.style.cursor = 'ns-resize'; break;
                    case 'e': case 'w': this.canvas.style.cursor = 'ew-resize'; break;
                }
            } else if (this.isInSelection(x, y)) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    mouseUpHandler(event: MouseEvent) {
        if (this.mouseDown) {
            // Завершаем выделение
            this.mouseDown = false;
            
            // Создаем выделение
            const x = Math.min(this.startX, this.endX);
            const y = Math.min(this.startY, this.endY);
            const width = Math.abs(this.endX - this.startX);
            const height = Math.abs(this.endY - this.startY);
            
            if (width > 0 && height > 0) {
                this.selection = this.ctx.getImageData(x, y, width, height);
                this.startX = x;
                this.startY = y;
                this.endX = x + width;
                this.endY = y + height;
                
                // Рисуем рамку вокруг выделения
                this.drawSelectionBorder(x, y);
            }
        } else if (this.isMoving) {
            // Завершаем перемещение
            this.isMoving = false;
            
            const { x, y } = this.getCords(event);
            const dx = x - this.startX;
            const dy = y - this.startY;
            
            // Обновляем координаты выделения
            this.startX += dx;
            this.startY += dy;
            this.endX += dx;
            this.endY += dy;
            
            // Обновляем сохраненное состояние
            this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.isResizing) {
            // Завершаем изменение размера
            this.isResizing = false;
            this.resizeHandle = '';
            
            // Обновляем сохраненное состояние
            this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    isInSelection(x: number, y: number): boolean {
        return (
            x >= this.startX && 
            x <= this.endX && 
            y >= this.startY && 
            y <= this.endY
        );
    }
    
    getResizeHandle(x: number, y: number): string {
        const handleSize = 8;
        const halfHandle = handleSize / 2;
        
        // Проверяем углы
        if (Math.abs(x - this.startX) <= halfHandle && Math.abs(y - this.startY) <= halfHandle) return 'nw';
        if (Math.abs(x - this.endX) <= halfHandle && Math.abs(y - this.startY) <= halfHandle) return 'ne';
        if (Math.abs(x - this.startX) <= halfHandle && Math.abs(y - this.endY) <= halfHandle) return 'sw';
        if (Math.abs(x - this.endX) <= halfHandle && Math.abs(y - this.endY) <= halfHandle) return 'se';
        
        // Проверяем стороны
        if (Math.abs(x - (this.startX + this.endX) / 2) <= halfHandle && Math.abs(y - this.startY) <= halfHandle) return 'n';
        if (Math.abs(x - (this.startX + this.endX) / 2) <= halfHandle && Math.abs(y - this.endY) <= halfHandle) return 's';
        if (Math.abs(x - this.startX) <= halfHandle && Math.abs(y - (this.startY + this.endY) / 2) <= halfHandle) return 'w';
        if (Math.abs(x - this.endX) <= halfHandle && Math.abs(y - (this.startY + this.endY) / 2) <= halfHandle) return 'e';
        
        return '';
    }
    
    resizeSelection(x: number, y: number) {
        if (!this.selection || !this.originalImageData) return;
        
        // Восстанавливаем исходное состояние
        this.ctx.putImageData(this.originalImageData, 0, 0);
        
        // Вычисляем новые координаты в зависимости от маркера
        let newStartX = this.startX;
        let newStartY = this.startY;
        let newEndX = this.endX;
        let newEndY = this.endY;
        
        switch (this.resizeHandle) {
            case 'nw': newStartX = x; newStartY = y; break;
            case 'ne': newEndX = x; newStartY = y; break;
            case 'sw': newStartX = x; newEndY = y; break;
            case 'se': newEndX = x; newEndY = y; break;
            case 'n': newStartY = y; break;
            case 's': newEndY = y; break;
            case 'w': newStartX = x; break;
            case 'e': newEndX = x; break;
        }
        
        // Масштабируем выделение
        const width = Math.abs(newEndX - newStartX);
        const height = Math.abs(newEndY - newStartY);
        
        if (width > 0 && height > 0) {
            // Рисуем масштабированное выделение
            this.ctx.drawImage(
                this.createImageFromData(this.selection),
                Math.min(newStartX, newEndX),
                Math.min(newStartY, newEndY),
                width,
                height
            );
            
            // Обновляем координаты
            this.startX = Math.min(newStartX, newEndX);
            this.startY = Math.min(newStartY, newEndY);
            this.endX = Math.max(newStartX, newEndX);
            this.endY = Math.max(newStartY, newEndY);
            
            // Обновляем выделение
            this.selection = this.ctx.getImageData(this.startX, this.startY, width, height);
            
            // Рисуем рамку
            this.drawSelectionBorder(this.startX, this.startY);
        }
    }
    
    createImageFromData(imageData: ImageData): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx?.putImageData(imageData, 0, 0);
        return canvas;
    }
    
    drawSelectionRect() {
        const x = Math.min(this.startX, this.endX);
        const y = Math.min(this.startY, this.endY);
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);
        
        // Рисуем пунктирную рамку
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
    }
    
    drawSelectionBorder(x: number, y: number) {
        if (!this.selection) return;
        
        const width = this.selection.width;
        const height = this.selection.height;
        
        // Рисуем рамку
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
        
        // Рисуем маркеры изменения размера
        this.drawResizeHandles(x, y, width, height);
    }
    
    drawResizeHandles(x: number, y: number, width: number, height: number) {
        const handleSize = 8;
        const halfHandle = handleSize / 2;
        
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        
        // Углы
        this.ctx.fillRect(x - halfHandle, y - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x - halfHandle, y - halfHandle, handleSize, handleSize);
        
        this.ctx.fillRect(x + width - halfHandle, y - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x + width - halfHandle, y - halfHandle, handleSize, handleSize);
        
        this.ctx.fillRect(x - halfHandle, y + height - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x - halfHandle, y + height - halfHandle, handleSize, handleSize);
        
        this.ctx.fillRect(x + width - halfHandle, y + height - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x + width - halfHandle, y + height - halfHandle, handleSize, handleSize);
        
        // Стороны
        this.ctx.fillRect(x + width/2 - halfHandle, y - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x + width/2 - halfHandle, y - halfHandle, handleSize, handleSize);
        
        this.ctx.fillRect(x + width/2 - halfHandle, y + height - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x + width/2 - halfHandle, y + height - halfHandle, handleSize, handleSize);
        
        this.ctx.fillRect(x - halfHandle, y + height/2 - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x - halfHandle, y + height/2 - halfHandle, handleSize, handleSize);
        
        this.ctx.fillRect(x + width - halfHandle, y + height/2 - halfHandle, handleSize, handleSize);
        this.ctx.strokeRect(x + width - halfHandle, y + height/2 - halfHandle, handleSize, handleSize);
    }
    
    destroy() {
        this.canvas.style.cursor = 'default';
        super.destroy();
    }
}