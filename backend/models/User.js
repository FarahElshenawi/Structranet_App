import mongoose from "mongoose";

const imageSubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },       // e.g. "c7200"
    filename: { type: String, default: "" },       // e.g. "c7200-adventerprisek9-mz.124-24.T5.image"
  },
  { _id: false }
);

const gns3ProfileSchema = new mongoose.Schema(
  {
    version: { type: String, default: "" },        // e.g. "2.2.43"
    features: {
      iou: { type: Boolean, default: false },
      qemu: { type: Boolean, default: true },
      docker: { type: Boolean, default: false },
    },
    images: [imageSubSchema],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    gns3Profile: {
      type: gns3ProfileSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);