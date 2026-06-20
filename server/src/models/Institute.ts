import { softDeletePlugin } from "@/plugins/softDelete";
import mongoose from "mongoose";
const { Schema } = mongoose;

const notificationSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

const roleSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    default: { type: Boolean, default: false },
    description: { type: String },
    permissions: [{ type: String, required: true }],
  },
  { timestamps: true }
);

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    email: { type: String, required: true },
    role: { type: String, required: true },
    notifications: [{ type: notificationSchema }],
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const departmentSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  isSample: { type: Boolean, default: false },
});

const auditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    user: { type: String, required: true },
    userId: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "warning", "error", "success"],
      default: "info",
      required: true,
    },
  },
  { timestamps: true }
);

const subscriptionSchema = new Schema({
  type: {
    type: String,
    enum: ["quarterly", "annual", "trial"],
    required: true,
  },
  status: { type: String, enum: ["active", "inactive"], default: "inactive" },
  startedOn: { type: Date, default: Date.now, required: true },
  endsOn: { type: Date, required: true },
  maxStudents: { type: Number, required: true },
  maxFaculty: { type: Number, required: true },
  features: [{ type: String }],
});

const instituteSchema = new Schema(
  {
    name: { required: true, type: String },
    email: { required: true, type: String },
    website: { required: true, type: String },
    logo: { type: String },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      zipCode: { type: String, required: true },
    },

    members: [memberSchema],
    roles: [roleSchema],
    departments: [departmentSchema],
    auditLogs: [auditLogSchema],

    subscription: {
      type: subscriptionSchema,
      required: true,
    },

    drives: [{ type: Schema.Types.ObjectId, ref: "Drive" }],

    companies: [{ type: Schema.Types.ObjectId, ref: "Company" }],
    placementGroups: [{ type: Schema.Types.ObjectId, ref: "PlacementGroup" }],

    candidates: { type: [Schema.Types.ObjectId], ref: "Candidate" },
    pendingCandidates: { type: [Schema.Types.ObjectId], ref: "Candidate" },

    code: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },

    isSample: { type: Boolean, default: false },
    samplePassword: { type: String, default: null },
    sampleSalt: { type: String, default: null },
    mockData: {
      status: {
        type: String,
        enum: ["none", "generating", "ready", "removing", "failed"],
        default: "none",
      },
      generatedAt: { type: Date },
      generationId: { type: String },
      recordCounts: {
        departments: { type: Number, default: 0 },
        students: { type: Number, default: 0 },
        faculty: { type: Number, default: 0 },
        companies: { type: Number, default: 0 },
        placementGroups: { type: Number, default: 0 },
        drives: { type: Number, default: 0 },
        applications: { type: Number, default: 0 },
        assessments: { type: Number, default: 0 },
        interviews: { type: Number, default: 0 },
        placementResults: { type: Number, default: 0 },
      },
      lastError: { type: String },
    },
  },
  { timestamps: true }
);

instituteSchema.index({ email: 1 }, { unique: true });
instituteSchema.index({ name: 1 });
instituteSchema.index({ "members.email": 1 });
instituteSchema.index({ "subscription.status": 1 });
instituteSchema.index({ isDeleted: 1 });

instituteSchema.plugin(softDeletePlugin);
const Institute = mongoose.model("Institute", instituteSchema);
export default Institute;
