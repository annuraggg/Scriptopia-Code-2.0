interface Candidate {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeUrl: string;
  queries?: string[];
  status?: string;
  receivedDate?: string;
}

export default Candidate;