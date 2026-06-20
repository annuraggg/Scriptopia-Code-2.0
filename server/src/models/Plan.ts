import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    entitlements: { type: [String], default: [] },
    limits: { type: Map, of: Number, default: {} },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Plan", planSchema);
