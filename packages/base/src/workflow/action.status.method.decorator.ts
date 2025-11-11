/**
 * A decorator function that attaches metadata to a method, indicating that the method should be called when a specific status change occurs.
 * The `from` and `to` parameters specify the status change that should trigger the method, indicating the method should be called when the status changes from one state to another.
 * The decorator stores the event and order metadata on the target object and property using the `Reflect.defineMetadata` function.
 * Since this handler acts after the event action and after the entity status is updated, it can be used to perform additional actions or validations based on the status change.
 * If if throws an error, the transition will fail and the entity will be updated to the failed state.
 */
const OnStatusChanged = <S>(params: { from: S; to: S, failOnError?: boolean }) => {
  const { from, to } = params;
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('onStatusChanged', true, target, propertyKey);
    Reflect.defineMetadata('failOnError', params.failOnError ?? true, target, propertyKey);
    Reflect.defineMetadata('from', from, target, propertyKey);
    Reflect.defineMetadata('to', to, target, propertyKey);
    return descriptor;
  };
};
export { OnStatusChanged };
