import mongoose from "mongoose";

/**
 * User model — aligned with StructuraNet-AI-Full-Walkthrough.md
 *
 * GNS3 Profile:
 *   - version:  GNS3 version string (e.g. "2.2")
 *   - features: { iou, qemu, docker } toggle flags
 *   - images:   Map<templateName, imageFilename>
 *               e.g. { "Cisco 7200": "c7200-adventerprisek9-mz.124-24.T5.image" }
 *               This map becomes template_image_map when creating AI sessions.
 *   - security_profile: "none" | "basic" | "enterprise" (default "none")
 *
 * Walkthrough spec:
 *   PUT /api/profile with { version, features, images }
 *   images is a map: {"Cisco 7200": "c7200-adventerprisek9-mz.124-24.T5.image", ...}
 *   This images map becomes template_image_map when creating AI sessions.
 *   Priority: Profile image name > appliance.py default
 */

const gns3ProfileSchema = new mongoose.Schema(
  {
    version: { type: String, default: "" },
    features: {
      iou: { type: Boolean, default: false },
      qemu: { type: Boolean, default: true },
      docker: { type: Boolean, default: false },
    },
    // Map format: { "Cisco 7200": "c7200-adventerprisek9-mz.124-24.T5.image" }
    // Key = template_name (exact match to appliance catalog)
    // Value = user's actual IOS image filename on their GNS3 install
    // This maps directly to FastAPI's ProfileInput.template_image_map
    images: {
      type: Map,
      of: String,
      default: () => ({}),
    },
    // Security profile — selected in profile popup or at generation time
    security_profile: {
      type: String,
      enum: ["none", "basic", "enterprise"],
      default: "none",
    },
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
