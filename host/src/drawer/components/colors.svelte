<script>
    import "../../styles/global.css";
    import { strokeColor, fillColor } from "../stores/tool";
    
    // Доступные цвета
    const colors = [
        '#1f1f1f', // глубокий тёмный
        '#4a4a4a', // графит
        '#9e9e9e', // серый
        '#f5f5f5', // почти белый
        '#ff8a65', // коралл
        '#fdd835', // мягкий жёлтый
        '#81c784', // мятно-зелёный
        '#64b5f6', // небесно-синий
        '#ba68c8', // сиреневый
        'transparent' // прозрачный
    ];
    // Текущие выбранные цвета
    let activeStrokeColor = '#000000';
    let activeFillColor = '#ffffff';
    
    function setStrokeColor(color) {
        activeStrokeColor = color;
        strokeColor.set(color);
    }
    
    function setFillColor(color) {
        activeFillColor = color;
        fillColor.set(color);
    }
</script>

<div class="flex items-center">
    <!-- Индикатор текущих цветов -->
    <div 
        class="w-10 h-10 rounded-full mx-2 border border-black relative"
        style="background-color: {activeStrokeColor};"
    >
        <div 
            class="absolute w-6 h-6 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style="background-color: {activeFillColor};"
        ></div>
    </div>
    <div class="flex flex-col gap-2">
        <!-- Цвета обводки -->
        <div class="flex  gap-1">
            {#each colors as color}
                <button 
                    aria-label="Выбрать цвет обводки {color}"
                    class="
                        color-btn 
                        {activeFillColor === color ? 'color-btn-active' : ''}
                        {color === 'transparent' ? 'color-transparent' : ''}
                    "
                    style="background-color: {color};"
                    on:click={() => setStrokeColor(color)}
                ></button>
            {/each}
        </div>
    
        <!-- Цвета заливки -->
        <div class="flex gap-1" >
            {#each colors as color}
                <button 
                    aria-label="Выбрать цвет заливки {color}"
                    class="
                        color-btn 
                        {activeFillColor === color ? 'color-btn-active' : ''}
                        {color === 'transparent' ? 'color-transparent' : ''}
                    "
                    style="background-color: {color !== 'transparent' ? color : 'transparent'};"
                    on:click={() => setFillColor(color)}
                ></button>
            {/each}
        </div>
    </div>
</div>