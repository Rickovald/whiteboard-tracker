import { Tool } from "./base";

export class Import extends Tool {
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.initImport();
    }

    initImport() {
        // Создаем скрытый input для выбора файла
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/jpeg,image/gif';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // Обработчик выбора файла
        fileInput.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                this.loadImage(target.files[0]);
            }
        });

        // Запускаем диалог выбора файла
        fileInput.click();

        // Удаляем input после использования
        setTimeout(() => {
            document.body.removeChild(fileInput);
        }, 1000);
    }

    loadImage(file: File) {
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();

            img.onload = () => {
                // Сохраняем текущее состояние холста
                const originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

                // Центрируем изображение на холсте
                const x = (this.canvas.width - img.width) / 2;
                const y = (this.canvas.height - img.height) / 2;

                // Рисуем изображение с сохранением прозрачности
                this.ctx.drawImage(img, x, y);

                // Создаем выделение из импортированного изображения
                const selection = this.ctx.getImageData(x, y, img.width, img.height);

                // Восстанавливаем исходное состояние
                this.ctx.putImageData(originalImageData, 0, 0);

                // Создаем инструмент выделения
                // Рисуем выделение
                this.ctx.putImageData(selection, x, y);

                // Заменяем текущий инструмент на инструмент выделения
            };

            // Устанавливаем источник изображения
            img.src = event.target?.result as string;
        };

        // Читаем файл как Data URL
        reader.readAsDataURL(file);
    }
}