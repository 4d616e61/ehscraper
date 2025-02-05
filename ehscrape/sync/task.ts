


export enum TaskType {
    ALL,
    NORM,
    EXH,
}

export function task_type_to_name(task_type : TaskType) : string {
    switch(task_type) {
        case TaskType.ALL:
            return "status_all"
        case TaskType.NORM:
            return "status_normal"
        case TaskType.EXH:
            return "status_exh"
    }
}

//I know this is retarded but Task here refers specifically to pagination tasks
// API queries are just called...queries...
export class Task {

    public start : number;
    public end : number;
    public task_type : TaskType;
    constructor(start : number, end : number, task_type : TaskType) {
        this.start = start;
        this.end = end;
        this.task_type = task_type;
    }
  
}