<script>
    import "../../styles/global.css";
    import { strokeColor, fillColor, strokeWidth, activeColorMode } from "../stores/tool";
    import { onMount } from "svelte";
    
    // Доступные цвета
    const colors = [
        '#000000', // полностью черный
        '#ffffff', // полностью белый
        '#1f1f1f', // глубокий тёмный
        '#4a4a4a', // графит
        '#9e9e9e', // серый
        '#f5f5f5', // почти белый
        '#ff8a65', // коралл
        '#fdd835', // мягкий жёлтый
        '#81c784', // мятно-зелёный
        '#64b5f6', // небесно-синий
        '#ba68c8', // сиреневый
        'rainbow', // цветовая палитра
        'transparent' // прозрачный
    ];
    
    // Текущие выбранные цвета
    let activeStrokeColor = '#1f1f1f';
    let activeFillColor = '#1f1f1f';
    let currentMode = 'stroke';
    let currentWidth = 5;
    let colorPickerVisible = false;
    let customColor = '#000000';
    
    // Подписываемся на изменения цветов
    strokeColor.subscribe(value => {
        activeStrokeColor = value;
    });
    
    fillColor.subscribe(value => {
        activeFillColor = value;
    });
    
    strokeWidth.subscribe(value => {
        currentWidth = value;
    });
    
    activeColorMode.subscribe(value => {
        currentMode = value;
    });
    
    function setColor(color) {
        if (color === 'rainbow') {
            colorPickerVisible = true;
            return;
        }
        
        if (currentMode === 'stroke') {
            activeStrokeColor = color;
            strokeColor.set(color);
        } else {
            activeFillColor = color;
            fillColor.set(color);
        }
    }
    
    function setStrokeMode() {
        currentMode = 'stroke';
        activeColorMode.set('stroke');
    }
    
    function setFillMode() {
        currentMode = 'fill';
        activeColorMode.set('fill');
    }
    
    function updateWidth(value) {
        strokeWidth.set(value);
    }
    
    function applyCustomColor() {
        setColor(customColor);
        colorPickerVisible = false;
    }
    
    onMount(() => {
        // Инициализация цветов
        strokeColor.set(activeStrokeColor);
        fillColor.set(activeFillColor);
    });
</script>

<div class="flex items-center">
    <!-- Индикатор текущих цветов -->
    <div 
        class="w-10 h-10 rounded-full mx-2 border border-black relative cursor-pointer"
        style="background-color: {activeStrokeColor};"
        on:click={setStrokeMode}
        on:keydown={(e) => e.key === 'Enter' && setStrokeMode()}
        role="button"
        tabindex="0"
        aria-label="Выбрать режим обводки"
    >
        <div 
            class="absolute w-6 h-6 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style="background-color: {activeFillColor};"
            on:click|stopPropagation={setFillMode}
            on:keydown|stopPropagation={(e) => e.key === 'Enter' && setFillMode()}
            role="button"
            tabindex="0"
            aria-label="Выбрать режим заливки"
        ></div>
    </div>
    
    <div class="flex flex-col gap-2">
        <!-- Переключатели режима и толщина -->
        <div class="flex items-center gap-2 mb-1">
            <button 
                class="px-2 py-1 rounded {currentMode === 'stroke' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
                on:click={setStrokeMode}
            >
                Обводка
            </button>
            <button 
                class="px-2 py-1 rounded {currentMode === 'fill' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
                on:click={setFillMode}
            >
                Заливка
            </button>
            
            <div class="ml-4 flex items-center text-white">
                <span class="mr-2 text-sm">Толщина:</span>
                <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    value={currentWidth} 
                    class="w-24"
                    on:input={(e) => updateWidth(parseInt(e.target.value))}
                />
                <span class="ml-1 text-sm">{currentWidth}px</span>
            </div>
        </div>
        
        <!-- Палитра цветов (один ряд) -->
        <div class="flex gap-1">
            {#each colors as color}
                <button 
                    aria-label="Выбрать цвет {color}"
                    class="
                        color-btn 
                        {(currentMode === 'stroke' && activeStrokeColor === color) || 
                         (currentMode === 'fill' && activeFillColor === color) ? 'color-btn-active' : ''}
                        {color === 'transparent' ? 'color-transparent' : ''}
                    "
                    style={color === 'rainbow' ? 
                        'background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);' : 
                        `background-color: ${color !== 'transparent' ? color : 'transparent'};`}
                    on:click={() => setColor(color)}
                ></button>
            {/each}
        </div>
    </div>
</div>

<!-- Модальное окно выбора цвета -->
{#if colorPickerVisible}
<div class="fixed inset-0  bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-4 rounded-lg shadow-lg">
        <h3 class="text-lg font-bold mb-2">Выберите цвет</h3>
        <div class="flex items-center gap-2 mb-4">
            <input 
                type="color" 
                bind:value={customColor} 
                class="w-10 h-10 cursor-pointer"
            />
            <input 
                type="text" 
                bind:value={customColor} 
                class="border border-gray-300 px-2 py-1 rounded"
            />
        </div>
        <div class="flex justify-end gap-2">
            <button 
                class="px-3 py-1 bg-gray-200 rounded"
                on:click={() => colorPickerVisible = false}
            >
                Отмена
            </button>
            <button 
                class="px-3 py-1 bg-blue-500 text-white rounded"
                on:click={applyCustomColor}
            >
                Применить
            </button>
        </div>
    </div>
</div>
{/if}