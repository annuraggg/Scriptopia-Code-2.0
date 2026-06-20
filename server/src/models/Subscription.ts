import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      enum: ["user", "organization", "institute"],
      required: true,
    },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    planKey: { type: String, required: true, index: true },
    state: {
      type: String,
      enum: ["trialing", "active", "past_due", "paused", "canceled", "expired"],
      default: "trialing",
    },
    startsAt: { type: Date, default: Date.now },
    currentPeriodEndsAt: { type: Date },
    provider: { type: String },
    providerReference: { type: String },
    metadata: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

subscriptionSchema.index({ subjectType: 1, subjectId: 1 }, { unique: true });

export default mongoose.model("Subscription", subscriptionSchema);
