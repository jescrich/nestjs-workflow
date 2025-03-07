const WorkflowAction = <E>() => (target: Function) => {
    Reflect.defineMetadata('isWorkflowAction', true, target);    
}
export { WorkflowAction }