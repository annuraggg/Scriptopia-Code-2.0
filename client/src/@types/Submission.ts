export interface IResult {
  _id: string;
  caseNo: number;
  caseId: string;
  output: string;
  isSample: boolean;
  memory: number;
  time: number;
  passed: boolean;
  console?: string;
}

export interface IDriverMeta {
  _id: string;
  driver: string;
  timestamp: Date;
}

export interface ISubmission {
  _id: string;
  problem: string;
  user: string;
  code: string;
  language: string;
  status: "FAILED" | "SUCCESS";
  avgMemory: number;
  avgTime: number;
  failedCaseNumber: number;
  results: IResult[];
  meta: IDriverMeta;
  createdAt: Date;
}
