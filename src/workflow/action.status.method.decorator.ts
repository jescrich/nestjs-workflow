const OnStatusChanged = <S>(params: { from: S; to: S }) => {
  const { from, to } = params;
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('from', from, target, propertyKey);
    Reflect.defineMetadata('to', to, target, propertyKey);
    return descriptor;
  };
};
export { OnStatusChanged };
