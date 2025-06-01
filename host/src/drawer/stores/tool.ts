import { writable } from 'svelte/store';
import type { Tool } from '../tools/base';

// Настройки инструментов
export const strokeWidth = writable(5); // Толщина обводки
export const tool = writable<Tool | null>(null);

// Цвета
export const color = writable<string>("#000");
export const strokeColor = writable<string>('#000');
export const fillColor = writable<string>('#fff');

// Настройки текста
export const fontSize = writable(16);
export const fontFamily = writable('Arial');

// Активный режим выбора цвета (обводка или заливка)
export const activeColorMode = writable<'stroke' | 'fill'>('stroke');