/**
 * definitions.js — OpenAI-compatible tool definitions for StructuraNet AI.
 *
 * These 4 tools are sent to the LLM along with the conversation history.
 * The LLM decides autonomously which tools to call (if any).
 *
 * Ported from: structranet/constants/agent_schemas.py → TOOL_DEFINITIONS
 */

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "generate_new_topology",
      description:
        "Design and generate a new network topology from scratch based on " +
        "the user's requirements. This creates the logical topology, assigns " +
        "hardware, patches VLANs, and produces a GNS3-compatible draft. " +
        "Call this whenever the user wants to create or design a new network. " +
        "If the user also mentions a security profile in the same message " +
        '(e.g., "design X with enterprise security"), call this tool first, ' +
        "wait for the result, then call apply_security_and_export.",
      parameters: {
        type: "object",
        properties: {
          requirements: {
            type: "string",
            description:
              "The user's network design requirements in natural language. " +
              "Include all details: topology type, number of devices, " +
              "connections, protocols, etc.",
          },
        },
        required: ["requirements"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_current_topology",
      description:
        "Modify the current topology draft based on user feedback. " +
        "Only call this when a topology draft already exists and the user " +
        "wants to change, add, or remove something. If no topology exists, " +
        "call generate_new_topology instead.",
      parameters: {
        type: "object",
        properties: {
          feedback: {
            type: "string",
            description:
              "The specific changes the user wants to make to the " +
              "current topology. Be precise about what to add, remove, " +
              "or modify.",
          },
        },
        required: ["feedback"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_security_and_export",
      description:
        "Apply a security hardening profile to the approved topology, " +
        "generate full device configurations (IP addressing, routing, " +
        "security configs), and export the complete GNS3 project file. " +
        "Call this when the user is satisfied with the topology design and " +
        "wants to finalize and export. You must specify which security " +
        "profile to use. If the user has not specified one, ask them first.",
      parameters: {
        type: "object",
        properties: {
          security_profile: {
            type: "string",
            enum: ["none", "basic", "enterprise"],
            description:
              "The security hardening profile to apply:\n" +
              "- 'none': No hardening — pure lab topology\n" +
              "- 'basic': SSH, AAA, banners, NTP, Syslog\n" +
              "- 'enterprise': Full ZBF, ACLs, DAI, DHCP Snooping, " +
              "SNMPv3, HSRP, uRPF, OSPF auth",
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
      description:
        "Search the Cisco IOS knowledge base for specific commands, " +
        "protocol configurations, or troubleshooting steps. Call this when " +
        "the user asks about how to configure something on a Cisco device " +
        "(e.g., OSPF, VLANs, ACLs, NAT, HSRP). Returns formatted Markdown " +
        "with IOS command examples.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              "The networking topic or protocol to search for. " +
              'Examples: "OSPF configuration", "VLAN trunking", ' +
              '"HSRP setup", "NAT overload", "access-list"',
          },
        },
        required: ["topic"],
      },
    },
  },
];

export { TOOL_DEFINITIONS };
