import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    problemId: { type: String, required: true },
  },
  { timestamps: true }
);

const WalletSchema = new mongoose.Schema({
  address: { type: String, required: true },
  privateKey: { type: String, required: true, select: false },
  balance: { type: Number, default: 0 },
  transactions: { type: [TransactionSchema], required: false },
});

const UserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    streak: { type: [Date] },
    wallet: { type: WalletSchema, default: null },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
export default User;
