/**
 * A decorator function that attaches metadata to a method, indicating that the method should be called when a specific event occurs.
 * The `event` parameter specifies the event that should trigger the method, and the `order` parameter (optional) specifies the order in which the method should be executed relative to other event handlers.
 * The decorator stores the event and order metadata on the target object and property using the `Reflect.defineMetadata` function.
 */
const OnEvent = <E>(params: { event: E, order?: number }) => {
    const { event, order } = params;
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        Reflect.defineMetadata('onEvent', event, target, propertyKey);
        Reflect.defineMetadata('onEventOrder', order, target, propertyKey);
        return descriptor;
    }
}
export { OnEvent }