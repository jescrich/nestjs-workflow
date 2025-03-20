import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class EntityService<T, State> {
  /**
   * Creates a new instance of the entity
   * @returns A new entity instance
   */
  abstract new(): T;

  /**
   * Updates the status of an entity
   * @param entity The entity to update
   * @param status The new status
   * @returns The updated entity
   */
  abstract update(entity: T, status: State): Promise<T>;

  /**
   * Loads an entity by its URN
   * @param urn The unique resource name of the entity
   * @returns The loaded entity
   */
  abstract load(urn: string): Promise<T>;

  /**
   * Gets the current status of an entity
   * @param entity The entity
   * @returns The current status
   */
  abstract status(entity: T): State;

  /**
   * Gets the URN of an entity
   * @param entity The entity
   * @returns The entity's URN
   */
  abstract urn(entity: T): string;
}
