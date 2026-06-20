import { softDeletePlugin } from "@/plugins/softDelete";
import mongoose from "mongoose";

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
    preferences: {
      theme: { type: String, enum: ["system", "light", "dark"], default: "system" },
      locale: { type: String, default: "en-IN" },
      timezone: { type: String, default: "Asia/Kolkata" },
      reducedMotion: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true },
      productNotifications: { type: Boolean, default: true },
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      lastPasswordChangeAt: { type: Date },
    },
    accountActivity: {
      type: [
        {
          action: { type: String, required: true },
          platform: { type: String, default: "accounts" },
          ipAddress: { type: String, default: "" },
          userAgent: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    resetToken: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    streak: { type: [Date] },
    isSample: { type: Boolean, default: false },
    sampleInstituteId: { type: mongoose.Schema.Types.ObjectId, ref: "Institute" },
  },
  { timestamps: true }
);

userSchema.plugin(softDeletePlugin);
const User = mongoose.model("User", userSchema);
export default User;
