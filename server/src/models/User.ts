import { softDeletePlugin } from "@/plugins/softDelete";
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

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    name: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    lastLoginAt: { type: Date },
    sessions: {
      type: [
        {
          id: { type: String, required: true },
          userAgent: { type: String, default: "" },
          ipAddress: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now },
          lastSeenAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    loginHistory: {
      type: [
        {
          at: { type: Date, default: Date.now },
          ipAddress: { type: String, default: "" },
          userAgent: { type: String, default: "" },
          status: { type: String, default: "success" },
        },
      ],
      default: [],
    },
    resetToken: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    streak: { type: [Date] },
    wallet: { type: WalletSchema, default: null },

    isSample: { type: Boolean, default: false },
    sampleInstituteId: { type: mongoose.Schema.Types.ObjectId, ref: "Institute" },
  },
  { timestamps: true }
);

userSchema.plugin(softDeletePlugin);
const User = mongoose.model("User", userSchema);
export default User;
