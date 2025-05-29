import { writable } from 'svelte/store';
import type { Tool } from '../tools/base';

export const width = writable(1);
export const tool = writable<Tool | null>(null)


export const color = writable<string>("#000")
export const strokeColor = writable<string>('#000')
export const fillColor = writable<string>('#fff')
export const fontSize = writable(16);
export const fontFamily = writable('Arial');