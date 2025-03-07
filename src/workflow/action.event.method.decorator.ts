const OnEvent = <E>(params: { event: E, order?: number }) => {
    const { event, order } = params;
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        Reflect.defineMetadata('onEvent', event, target, propertyKey);
        Reflect.defineMetadata('onEventOrder', order, target, propertyKey);
        return descriptor;
    }
}
export { OnEvent }