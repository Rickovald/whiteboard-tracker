<script>
    import { onMount } from 'svelte';
    import "../styles/global.css";
    import Canvas from './components/canvas.svelte';
    import Sidebar from "./components/sidebar.svelte";
    import Toolbar from "./components/toolbar.svelte";
    import { boardsStore, createBoard, selectBoard } from './stores/boards';
    import { initializeSync } from './stores/sync';
    
    // Автоматическое создание доски при загрузке, если нет ID в URL
    onMount(() => {
        // Инициализация WebSocket для синхронизации между пользователями
        initializeSync();
        
        // Автосохранение каждые 10 секунд (более частое сохранение)
        const autoSaveInterval = setInterval(() => {
            if ($boardsStore.activeBoard) {
                const canvasElement = document.querySelector('canvas');
                if (canvasElement) {
                    const dataUrl = canvasElement.toDataURL();
                    
                    fetch(`http://localhost:5000/image?id=${$boardsStore.activeBoard}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            img: dataUrl,
                            name: $boardsStore.boards.find(b => b.id === $boardsStore.activeBoard)?.name || 'Новая доска'
                        })
                    }).catch(err => console.error('Ошибка автосохранения:', err));
                }
            }
        }, 10000);
        
        // Обработчик перед закрытием страницы для сохранения
        window.addEventListener('beforeunload', () => {
            if ($boardsStore.activeBoard) {
                const canvasElement = document.querySelector('canvas');
                if (canvasElement) {
                    const dataUrl = canvasElement.toDataURL();
                    
                    // Используем синхронный XMLHttpRequest для гарантированного сохранения перед закрытием
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `http://localhost:5000/image?id=${$boardsStore.activeBoard}`, false);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(JSON.stringify({
                        img: dataUrl,
                        name: $boardsStore.boards.find(b => b.id === $boardsStore.activeBoard)?.name || 'Новая доска'
                    }));
                }
            }
        });
        
        return () => {
            clearInterval(autoSaveInterval);
        };
    });
</script>

<div class="flex w-full h-[calc(100vh-5rem)] bg-zinc-200 ">
    <Sidebar />
    <div class="w-full h-full">
        <Toolbar />
        <Canvas />
    </div>
</div>