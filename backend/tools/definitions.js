/**
 * definitions.js — OpenAI-compatible tool definitions for StructuraNet AI.
 * 4 tools: generate_new_topology, modify_current_topology,
 * apply_security_and_export, search_cisco_knowledge
 */

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "generate_new_topology",
      description: "Design and generate a new network topology from scratch based on the user's requirements.",
      parameters: {
        type: "object",
        properties: {
          requirements: { type: "string", description: "The user's network design requirements in natural language." },
        },
        required: ["requirements"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_current_topology",
      description: "Modify the current topology draft based on user feedback.",
      parameters: {
        type: "object",
        properties: {
          feedback: { type: "string", description: "The specific changes the user wants to make." },
        },
        required: ["feedback"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_security_and_export",
      description: "Apply a security hardening profile, generate device configurations, and export the GNS3 project file.",
      parameters: {
        type: "object",
        properties: {
          security_profile: {
            type: "string",
            enum: ["none", "basic", "enterprise"],
            description: "The security hardening profile to apply.",
          },
        },
        required: ["security_profile"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_cisco_knowledge",
      description: "Search the Cisco IOS knowledge base for specific commands, protocol configurations, or troubleshooting steps.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "The networking topic or protocol to search for." },
        },
        required: ["topic"],
      },
    },
  },
];

export { TOOL_DEFINITIONS };
