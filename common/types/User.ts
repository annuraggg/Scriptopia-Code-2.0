interface User {
  _id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  imageUrl?: string;
  streak?: Date[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type { User };
