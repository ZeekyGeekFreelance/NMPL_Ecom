type BatchLoaderFn<TKey, TValue> = (
  keys: readonly TKey[]
) => Promise<Map<TKey, TValue>>;

type LoaderResolver<TValue> = {
  resolve: (value: TValue) => void;
  reject: (error: unknown) => void;
};

export class RequestBatchLoader<TKey, TValue> {
  private queuedKeys = new Set<TKey>();
  private queuedResolvers = new Map<TKey, LoaderResolver<TValue>[]>();
  private scheduled = false;
  private cache = new Map<TKey, Promise<TValue>>();

  constructor(private batchLoader: BatchLoaderFn<TKey, TValue>) {}

  load(key: TKey): Promise<TValue> {
    const cachedPromise = this.cache.get(key);
    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = new Promise<TValue>((resolve, reject) => {
      const resolvers = this.queuedResolvers.get(key) || [];
      resolvers.push({ resolve, reject });
      this.queuedResolvers.set(key, resolvers);
      this.queuedKeys.add(key);

      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => {
          void this.flush();
        });
      }
    });

    this.cache.set(key, promise);
    return promise;
  }

  clear(key: TKey): this {
    this.cache.delete(key);
    return this;
  }

  clearAll(): this {
    this.cache.clear();
    return this;
  }

  private async flush(): Promise<void> {
    this.scheduled = false;
    const keys = Array.from(this.queuedKeys);
    this.queuedKeys.clear();

    if (!keys.length) {
      return;
    }

    const resolversSnapshot = new Map(this.queuedResolvers);
    this.queuedResolvers.clear();

    try {
      const result = await this.batchLoader(keys);
      keys.forEach((key) => {
        const value = result.get(key) as TValue;
        const resolvers = resolversSnapshot.get(key) || [];
        resolvers.forEach((resolver) => resolver.resolve(value));
      });
    } catch (error) {
      keys.forEach((key) => {
        const resolvers = resolversSnapshot.get(key) || [];
        resolvers.forEach((resolver) => resolver.reject(error));
      });
    }
  }
}
