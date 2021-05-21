/**
 * Array which keeps the objects sorted on a given field/key within that object.
 * Use the _upsert to add or update an item.
 * Use _get to retrieve an item (in log time).
 */
export class SortedArray<
  K extends string,
  T extends Record<K, string>
> extends Array<T> {
  private readonly _key: K;

  public constructor(key: K, ...items: T[]) {
    super(...items);
    this._key = key;
  }

  public _has(key: T[K]): boolean {
    const { found } = this._binarySearch(key);
    return found;
  }

  public _get(key: T[K]): T | null {
    const { index, found } = this._binarySearch(key);
    if (found) {
      return this[index];
    }
    return null;
  }

  public _upsert(item: T): void {
    const { index, found } = this._binarySearch(item[this._key]);
    if (found) {
      this[index] = item;
    } else {
      this.splice(index, 0, item);
    }
  }

  public _delete(key: T[K]): void {
    const { index, found } = this._binarySearch(key);
    if (found) {
      this.splice(index, 1);
    }
  }

  private _binarySearch(value: T[K]): { index: number; found: boolean } {
    let start = 0;
    let end = this.length - 1;
    while (start <= end) {
      const index = Math.floor((start + end) / 2);
      if (value > this[index][this._key]) {
        start = index + 1;
      } else if (value < this[index][this._key]) {
        end = index - 1;
      } else {
        return {
          index: index,
          found: true,
        };
      }
    }
    return {
      index: start,
      found: false,
    };
  }
}
