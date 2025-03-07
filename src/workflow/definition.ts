export interface TransitionEvent<T, P, Event, States> {
  event: Event;
  from: States;
  to: States;
  actions?: ((entity: T, payload?: P | T | object | string) => Promise<T>)[];
  conditions?: ((entity: T, payload?: P | T | object | string) => boolean)[];
}

export interface WorkflowDefinition<T, P, Event, State> {
  Events: Event[];
  States: State[];
  FinalStates: State[];
  IdleStates: State[];
  FailedState: State;
  Transitions: TransitionEvent<T, P, Event, State>[];
  Entity: {
    new: () => T;
    update: (entity: T, status: State) => Promise<T>;
    load: (urn: string) => Promise<T>;
    status: (entity: T) => State;
    urn: (entity: T) => string;
  };
  Fallback?: (entity: T, event: Event, payload?: P | T | object | string) => Promise<T>;
}
