import { writable } from 'svelte/store';
// Оставляем счетчик для обратной совместимости
export const counter = writable(0);