import type { Label } from '../entities/Label';

export interface ILabelRepository {
  findAll(): Promise<Label[]>;
  findById(id: number): Promise<Label | null>;
  create(name: string): Promise<Label>;
  update(id: number, name: string): Promise<Label>;
  delete(id: number): Promise<void>;
}
