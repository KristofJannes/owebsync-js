export const synchronized = <T>(
  target: any,
  propertyName: string,
  propertyDesciptor: TypedPropertyDescriptor<(...args: any[]) => Promise<T>>
): PropertyDescriptor => {
  const f: () => T | Promise<T> = propertyDesciptor.value!;

  const isBusy = Symbol();
  const waiting = Symbol();

  propertyDesciptor.value = async function (...args: []): Promise<T> {
    const t = this as any;
    if (!(isBusy in t)) {
      t[isBusy] = false;
    }
    if (!(waiting in t)) {
      t[waiting] = [];
    }

    if (t[isBusy]) {
      await new Promise((resolve): void => {
        t[waiting].push(resolve);
      });
    }
    t[isBusy] = true;
    try {
      return await f.apply(this, args);
    } finally {
      if (t[waiting].length > 0) {
        t[waiting].shift()!();
      } else {
        t[isBusy] = false;
      }
    }
  };
  return propertyDesciptor;
};
