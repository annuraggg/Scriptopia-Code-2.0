import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    streak: { type: [Date] },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
export default User;
