import { writable } from 'svelte/store';

// Экспортируем хранилища для использования в других компонентах
export const fontSize = writable(16);
export const fontFamily = writable('Arial');