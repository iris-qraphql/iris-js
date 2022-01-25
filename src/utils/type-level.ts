import type { ObjMap } from '../jsutils/ObjMap';

export type Override<T, T2> = Omit<T, keyof T2> & T2;

export type ConfigMap<T> = ObjMap<ConfigMapValue<T>>;

export type ConfigMapValue<T> = Omit<T, 'name'>;
