import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonStore<T extends { id: string }> {
	private items: T[] = [];
	private loaded = false;
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly filePath: string) {}

	async load(): Promise<void> {
		try {
			const raw = await readFile(this.filePath, "utf-8");
			this.items = JSON.parse(raw) as T[];
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
				console.warn(`[JsonStore] Failed to load ${this.filePath}: ${err}. Starting with empty store.`);
			}
			this.items = [];
		}
		this.loaded = true;
	}

	private ensureLoaded(): void {
		if (!this.loaded) {
			throw new Error(`Store not loaded. Call load() first for ${this.filePath}`);
		}
	}

	getAll(): T[] {
		this.ensureLoaded();
		return [...this.items];
	}

	getById(id: string): T | undefined {
		this.ensureLoaded();
		return this.items.find((item) => item.id === id);
	}

	getByField<K extends keyof T>(field: K, value: T[K]): T[] {
		this.ensureLoaded();
		return this.items.filter((item) => item[field] === value);
	}

	async add(item: T): Promise<T> {
		this.ensureLoaded();
		this.items.push(item);
		await this.save();
		return item;
	}

	async update(id: string, updates: Partial<T>): Promise<T | undefined> {
		this.ensureLoaded();
		const index = this.items.findIndex((item) => item.id === id);
		if (index === -1) return undefined;
		this.items[index] = { ...this.items[index], ...updates };
		await this.save();
		return this.items[index];
	}

	async remove(id: string): Promise<boolean> {
		this.ensureLoaded();
		const before = this.items.length;
		this.items = this.items.filter((item) => item.id !== id);
		if (this.items.length < before) {
			await this.save();
			return true;
		}
		return false;
	}

	private async save(): Promise<void> {
		this.writeQueue = this.writeQueue.then(async () => {
			await mkdir(dirname(this.filePath), { recursive: true });
			await writeFile(this.filePath, JSON.stringify(this.items, null, 2), "utf-8");
		});
		await this.writeQueue;
	}
}
