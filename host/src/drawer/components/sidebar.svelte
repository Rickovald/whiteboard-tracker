<script lang="ts">
    import "../../styles/global.css";
    import { onMount } from "svelte";
    import { 
        boardsStore, 
        connectToServer, 
        createBoard, 
        deleteBoard, 
        selectBoard, 
        saveBoardImage,
        fetchBoards,
        toggleBoardEditing,
        updateBoardName,
        type Board
    } from '../stores/boards';

    let boardName = "";
    let isCreating = false;

    // Создание новой доски
    const handleCreateBoard = () => {
        const boardId = createBoard(boardName || "Новая доска");
        boardName = "";
        
        // Обновляем URL
        window.history.pushState({}, "", `/drawer?id=${boardId}`);
    };

    // Удаление доски
    const handleDeleteBoard = (id: string) => {
        if (confirm('Вы уверены, что хотите удалить эту доску?')) {
            deleteBoard(id);
        }
    };

    // Выбор доски
    const handleSelectBoard = (id: string) => {
        // Сохраняем текущую доску перед переключением
        if ($boardsStore.activeBoard) {
            saveBoardImage($boardsStore.activeBoard);
        }
        
        selectBoard(id);
        
        // Обновляем URL
        window.history.pushState({}, "", `/drawer?id=${id}`);
    };

    // Начать редактирование имени доски
    const startEditingName = (board: Board) => {
        toggleBoardEditing(board.id, true);
    };

    // Сохранить новое имя доски
    const saveBoardName = (board: Board, newName: string) => {
        if (newName && newName.trim()) {
            updateBoardName(board.id, newName);
        } else {
            updateBoardName(board.id, `Новая доска`);
        }
    };

    // Обработка нажатия Enter при редактировании имени
    const handleKeyDown = (event: KeyboardEvent, board: Board, newName: string) => {
        if (event.key === 'Enter') {
            saveBoardName(board, newName);
        }
    };

    // Автосохранение активной доски каждые 30 секунд
    let autoSaveInterval: number;
    
    const startAutoSave = () => {
        autoSaveInterval = setInterval(() => {
            if ($boardsStore.activeBoard) {
                saveBoardImage($boardsStore.activeBoard);
            }
        }, 30000) as unknown as number;
    };

    // Проверяем URL при загрузке
    const checkUrlForBoardId = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const boardId = urlParams.get('id');
        
        if (boardId) {
            // Если в URL есть ID доски, проверяем, существует ли она
            const boardExists = $boardsStore.boards.some(board => board.id === boardId);
            
            if (boardExists) {
                // Если доска существует, выбираем её
                selectBoard(boardId);
            } else {
                // Если доска не существует, создаем новую
                isCreating = true;
                setTimeout(() => {
                    const newBoardId = createBoard("Новая доска");
                    window.history.pushState({}, "", `/drawer?id=${newBoardId}`);
                    isCreating = false;
                }, 500);
            }
        } else {
            // Если нет ID, создаем новую доску
            isCreating = true;
            setTimeout(() => {
                const newBoardId = createBoard("Новая доска");
                window.history.pushState({}, "", `/drawer?id=${newBoardId}`);
                isCreating = false;
            }, 500);
        }
    };

    onMount(() => {
        // Подключаемся к WebSocket серверу
        connectToServer();
        
        // Загружаем список досок
        fetchBoards().then(() => {
            // После загрузки списка досок проверяем URL
            checkUrlForBoardId();
        });
        
        // Запускаем автосохранение
        startAutoSave();
        
        // Обрабатываем навигацию по истории браузера
        window.addEventListener('popstate', checkUrlForBoardId);
        
        return () => {
            // Очищаем интервал при уничтожении компонента
            clearInterval(autoSaveInterval);
            window.removeEventListener('popstate', checkUrlForBoardId);
        };
    });
</script>

<div class="w-64 h-full bg-zinc-800 text-white p-4 flex flex-col">
    <!-- Список досок -->
    <div class="flex-1 overflow-y-auto mb-4">
        {#if $boardsStore.boards.length === 0}
            <p class="text-gray-400 text-center">Нет досок</p>
        {:else}
            <ul class="space-y-2">
                {#each $boardsStore.boards as board}
                    <li 
                        class={`p-2 rounded cursor-pointer ${
                            $boardsStore.activeBoard === board.id ? 'bg-blue-700' : 'bg-zinc-700 hover:bg-zinc-600'
                        }`}
                    >
                        <div class="flex justify-between items-center">
                            {#if board.isEditing}
                                <input 
                                    type="text" 
                                    value={board.name} 
                                    class="bg-zinc-600 text-white px-2 py-1 rounded flex-1 mr-2"
                                    on:blur={(e) => saveBoardName(board, (e.target as HTMLInputElement).value)}
                                    on:keydown={(e) => handleKeyDown(e, board, (e.target as HTMLInputElement).value)}
                                />
                            {:else}
                                <button 
                                    class="truncate flex-1 text-left"
                                    on:click={() => handleSelectBoard(board.id)}
                                >
                                    {board.name}
                                </button>
                                <div class="flex">
                                    <button 
                                        class="text-blue-400 hover:text-blue-300 mr-2"
                                        on:click|stopPropagation={() => startEditingName(board)}
                                        title="Переименовать"
                                    >
                                        ✎
                                    </button>
                                    <button 
                                        class="text-red-400 hover:text-red-300"
                                        on:click|stopPropagation={() => handleDeleteBoard(board.id)}
                                        title="Удалить"
                                    >
                                        ✕
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
    
    <!-- Кнопка создания новой доски -->
    <button 
        class="bg-blue-600 hover:bg-blue-700 py-2 rounded w-full disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isCreating}
        on:click={handleCreateBoard}
    >
        {isCreating ? 'Создание...' : 'Новая доска'}
    </button>
</div>