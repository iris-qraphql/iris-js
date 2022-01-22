export type Override<T, T2> = Omit<T, keyof T2> & T2;
