import mongoose from "mongoose";

const usageRecordSchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      enum: ["user", "organization", "institute"],
      required: true,
    },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    metric: { type: String, required: true },
    period: { type: String, required: true },
    quantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

usageRecordSchema.index(
  { subjectType: 1, subjectId: 1, metric: 1, period: 1 },
  { unique: true }
);

export default mongoose.model("UsageRecord", usageRecordSchema);
