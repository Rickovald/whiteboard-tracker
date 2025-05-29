<script>
    import "../../styles/global.css";
    import { canvas } from "../stores/canvas";
    import { tool } from "../stores/tool";
    import { Brush } from "../tools/brush";
    import { Line } from "../tools/line";
    import { Rect } from "../tools/rect";
    import { Oval } from "../tools/oval";
    import { Eraser } from "../tools/eraser";
    import { Eyedropper } from "../tools/eyedropper";
    import { PaintBucket } from "../tools/paint-bucket";
    import { Import } from "../tools/import";
    import { Airbrush } from "../tools/airbrush";
    import { Pencil } from "../tools/pencil";
    import { Curve } from "../tools/curve";
    import { Polygon } from "../tools/polygon";
    import { Select } from "../tools/select";
    import Colors from "./colors.svelte";
    import { historyStore as history, saveToHistory } from "../stores/history";
    
    let activeTool = 'brush';
    
    function setTool(toolName, ToolClass) {
        // Сохраняем текущее состояние холста перед сменой инструмента
        canvas.subscribe(canvasEl => {
            if (canvasEl) {
                const ctx = canvasEl.getContext('2d');
                if (ctx) {
                    const currentState = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
                    saveToHistory(currentState);
                    
                    // Отправляем обновление другим пользователям
                    import('../stores/sync').then(module => {
                        try {
                            module.sendCanvasUpdate();
                        } catch (e) {
                            console.error('Ошибка отправки обновления:', e);
                        }
                    });
                }
            }
        })();
        
        // Очищаем предыдущий инструмент
        tool.update(currentTool => {
            if (currentTool) {
                currentTool.destroy();
            }
            return null;
        });
        
        // Устанавливаем новый инструмент
        activeTool = toolName;
        canvas.subscribe(canvasEl => {
            if (canvasEl) {
                tool.set(new ToolClass(canvasEl));
            }
        })();
    }
    
    // Функции для инструментов
    function setBrushTool() {
        setTool('brush', Brush);
    }

    function setLineTool() {
        setTool('line', Line);
    }
    
    function setRectTool() {
        setTool('rect', Rect);
    }
    
    function setOvalTool() {
        setTool('oval', Oval);
    }
    
    function setEraserTool() {
        setTool('eraser', Eraser);
    }
    
    function setEyedropperTool() {
        setTool('eyedropper', Eyedropper);
    }
    
    function setPaintBucketTool() {
        setTool('paint_bucket', PaintBucket);
    }
    
    function setTextTool() {
        setTool('text', PaintBucket);
    }
    
    function setAirbrushTool() {
        setTool('airbrush', Airbrush);
    }
    
    function setPencilTool() {
        setTool('pencil', Pencil);
    }
    
    function setCurveTool() {
        setTool('curve', Curve);
    }
    
    function setPolygonTool() {
        setTool('polygon', Polygon);
    }
    
    function setSelectTool() {
        setTool('select', Select);
    }
    
    function importImage() {
        setTool('import', Import);
    }
    
    function saveImage() {
        canvas.subscribe(canvasEl => {
            if (canvasEl) {
                const link = document.createElement('a');
                link.download = 'whiteboard.png';
                link.href = canvasEl.toDataURL('image/png');
                link.click();
            }
        })();
    }
    
    function undo() {
        history.update(h => {
            if (h.past.length > 0) {
                // Получаем последнее состояние из истории
                const lastState = h.past.pop();
                
                canvas.subscribe(canvasEl => {
                    if (canvasEl && lastState) {
                        const ctx = canvasEl.getContext('2d');
                        if (ctx) {
                            // Сохраняем текущее состояние в будущее
                            const currentState = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
                            h.future.push(currentState);
                            
                            // Восстанавливаем предыдущее состояние
                            ctx.putImageData(lastState, 0, 0);
                        }
                    }
                })();
            }
            return h;
        });
        
        // Отправляем обновление другим пользователям
        import('../stores/sync').then(module => {
            try {
                module.sendCanvasUpdate();
            } catch (e) {
                console.error('Ошибка отправки обновления:', e);
            }
        });
    }
    
    function redo() {
        history.update(h => {
            if (h.future.length > 0) {
                // Получаем последнее состояние из будущего
                const nextState = h.future.pop();
                
                canvas.subscribe(canvasEl => {
                    if (canvasEl && nextState) {
                        const ctx = canvasEl.getContext('2d');
                        if (ctx) {
                            // Сохраняем текущее состояние в историю
                            const currentState = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
                            h.past.push(currentState);
                            
                            // Восстанавливаем будущее состояние
                            ctx.putImageData(nextState, 0, 0);
                        }
                    }
                })();
            }
            return h;
        });
        
        // Отправляем обновление другим пользователям
        import('../stores/sync').then(module => {
            try {
                module.sendCanvasUpdate();
            } catch (e) {
                console.error('Ошибка отправки обновления:', e);
            }
        });
    }
</script>

<div class="flex w-full bg-zinc-800 p-2 items-center gap-5">
    <div class="">
        <h3 class="text-white text-xs mb-1">Инструменты рисования</h3>
        <div class="flex flex-wrap">
            <button 
                aria-label="Выбрать кисть"
                class="tool {activeTool === 'brush' ? 'tool-active' : ''}"
                on:click={setBrushTool}
            >
                <img src="/assets/img/brush.svg" alt="Кисть">
            </button>
            <button 
                aria-label="Выбрать аэрограф"
                class="tool {activeTool === 'airbrush' ? 'tool-active' : ''}"
                on:click={setAirbrushTool}
            >
                <img src="/assets/img/airbrush.svg" alt="Аэрограф">
            </button>
            <button 
                aria-label="Выбрать карандаш"
                class="tool {activeTool === 'pencil' ? 'tool-active' : ''}"
                on:click={setPencilTool}
            >
                <img src="/assets/img/pencil.svg" alt="Карандаш">
            </button>
            <button 
                aria-label="Выбрать линию"
                class="tool {activeTool === 'line' ? 'tool-active' : ''}"
                on:click={setLineTool}
            >
                <img src="/assets/img/line.svg" alt="Линия">
            </button>
            <button 
                aria-label="Выбрать кривую"
                class="tool {activeTool === 'curve' ? 'tool-active' : ''}"
                on:click={setCurveTool}
            >
                <img src="/assets/img/curve.svg" alt="Кривая">
            </button>
        </div>
        <div class="flex flex-wrap mt-1">
            <button 
                aria-label="Выбрать прямоугольник"
                class="tool {activeTool === 'rect' ? 'tool-active' : ''}"
                on:click={setRectTool}
            >
                <img src="/assets/img/rounded_rect.svg" alt="Прямоугольник">
            </button>
            <button 
                aria-label="Выбрать овал"
                class="tool {activeTool === 'oval' ? 'tool-active' : ''}"
                on:click={setOvalTool}
            >
                <img src="/assets/img/oval.svg" alt="Овал">
            </button>
            <button 
                aria-label="Выбрать многоугольник"
                class="tool {activeTool === 'polygon' ? 'tool-active' : ''}"
                on:click={setPolygonTool}
            >
                <img src="/assets/img/polygon.svg" alt="Многоугольник">
            </button>
            <button 
                aria-label="Выбрать текст"
                class="tool {activeTool === 'text' ? 'tool-active' : ''}"
                on:click={setTextTool}
            >
                <img src="/assets/img/text.svg" alt="Текст">
            </button>
        </div>
    </div>
    
    <!-- Утилиты -->
    <div>
        <h3 class="text-white text-xs mb-1">Утилиты</h3>
        <div class="flex flex-wrap">
            <button 
                aria-label="Выбрать ластик"
                class="tool {activeTool === 'eraser' ? 'tool-active' : ''}"
                on:click={setEraserTool}
            >
                <img src="/assets/img/eraser.svg" alt="Ластик">
            </button>
            <button 
                aria-label="Выбрать заливку"
                class="tool {activeTool === 'paint_bucket' ? 'tool-active' : ''}"
                on:click={setPaintBucketTool}
            >
                <img src="/assets/img/paint_bucket.svg" alt="Заливка">
            </button>
            <button 
                aria-label="Выбрать пипетку"
                class="tool {activeTool === 'eyedropper' ? 'tool-active' : ''}"
                on:click={setEyedropperTool}
            >
                <img src="/assets/img/eyedropper.svg" alt="Пипетка">
            </button>
            <button 
                aria-label="Выбрать выделение"
                class="tool {activeTool === 'select' ? 'tool-active' : ''}"
                on:click={setSelectTool}
            >
                <img src="/assets/img/select.svg" alt="Выделение">
            </button>
            <button 
                aria-label="Выбрать произвольное выделение"
                class="tool {activeTool === 'freeform_select' ? 'tool-active' : ''}"
                on:click={setBrushTool}
            >
                <img src="/assets/img/freeform_select.svg" alt="Произвольное выделение">
            </button>
        </div>
        <div class="flex flex-wrap mt-1">
            <button 
                aria-label="Отменить"
                class="tool"
                on:click={undo}
            >
                <img src="/assets/img/undo.svg" alt="Отменить">
            </button>
            <button 
                aria-label="Повторить"
                class="tool"
                on:click={redo}
            >
                <img src="/assets/img/redo.svg" alt="Повторить">
            </button>
            <button 
                aria-label="Сохранить"
                class="tool"
                on:click={saveImage}
            >
                <img src="/assets/img/save.svg" alt="Сохранить">
            </button>
            <button 
                aria-label="Импортировать"
                class="tool"
                on:click={importImage}
            >
                <img src="/assets/img/import.svg" alt="Импортировать">
            </button>
        </div>
    </div>
    
    <Colors />
</div>