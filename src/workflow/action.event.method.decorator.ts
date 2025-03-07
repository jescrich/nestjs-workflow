const OnEvent = <E>(params: { event: E }) => {
    const { event } = params;
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // Reflect.defineMetadata('onEvent', event, target.method, propertyKey);
        return descriptor;
    }
}
export { OnEvent }