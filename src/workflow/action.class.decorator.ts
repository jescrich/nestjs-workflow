/**
 * A decorator function that marks a class as a workflow action.
 * The decorator sets the `isWorkflowAction` metadata on the target class.
 * This metadata can be used to identify and process workflow actions.
 * 
 * @param <E> - The type parameter for the decorator function.
 * @returns A decorator function that can be applied to a class.
 */
const WorkflowAction = <E>() => (target: Function) => {
    Reflect.defineMetadata('isWorkflowAction', true, target);    
}
export { WorkflowAction }