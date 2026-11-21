/** Strips undefined values so optional props satisfy exactOptionalPropertyTypes @lit/react types. */
export type OmitUndefined<T extends object> = {
  [K in keyof T]?: Exclude<T[K], undefined>;
};

export function omitUndefined<T extends object>(props: T): OmitUndefined<T> {
  const result: OmitUndefined<T> = {};
  for (const key in props) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    const value = props[key];
    if (value !== undefined) {
      Reflect.set(result, key, value);
    }
  }
  return result;
}
