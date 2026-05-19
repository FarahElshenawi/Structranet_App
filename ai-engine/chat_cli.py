"""
chat_cli.py — Interactive CLI for the StructuraNet Conversational Agent.

Uses the LLM Tool Calling architecture (no FSM, no intent router).

Usage:
    cd ai-engine
    python chat_cli.py

Requires:
    - .env file with ROUTER_API_KEY set
    - AI_MODEL must support tool calling (e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet)
    - All structuranet dependencies installed
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from structranet.catalog.appliance_catalog import load_catalog
from structranet.utils import catalog_to_inventory
from structranet.generation.preflight import (
    filter_inventory_by_profile,
    profile_from_dict,
)
from structranet.core.session import Session, SessionStore
from structranet.ai.chat_orchestrator import dispatch as agent_dispatch
from structranet.constants.agent_schemas import AgentSessionData


async def create_session(store: SessionStore) -> Session:
    catalog = load_catalog(None)
    inventory = catalog_to_inventory(catalog)
    profile = profile_from_dict({
        "gns3_version": "2.2",
        "supports_iou": False,
        "supports_qemu": True,
        "supports_docker": False,
        "strict_validation": True,
        "security_profile": "none",
    })
    filtered_inventory, blocked_types = filter_inventory_by_profile(inventory, profile)
    session = await store.create(
        profile=profile,
        catalog=catalog,
        inventory=inventory,
        filtered_inventory=filtered_inventory,
        blocked_types=blocked_types,
    )
    return session


async def event_listener(session: Session, store: SessionStore):
    """Subscribe to SSE events and print them in real-time."""
    queue = store.subscribe(session)
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            if event is None:
                break

            evt_type = event.get("event", "message")
            data = event.get("data", {})

            if evt_type == "phase_change":
                phase = data.get("phase", "")
                sub = data.get("sub_phase", "")
                label = f"{phase}" + (f" / {sub}" if sub else "")
                print(f"\n  [phase] {label}")

            elif evt_type == "thought":
                t_type = data.get("type", "")
                content = data.get("content", "")[:120]
                print(f"  [thought:{t_type}] {content}...")

            elif evt_type == "topology_ready":
                nc = data.get("node_count", "?")
                lc = data.get("link_count", "?")
                print(f"\n  [topology_ready] {nc} nodes, {lc} links")

            elif evt_type == "config_text":
                if data.get("done"):
                    print(f"  [config] {data.get('device_name','')} done")
                elif data.get("start"):
                    print(f"\n  [config] {data.get('device_name','')} streaming...")

            elif evt_type == "complete":
                print(f"\n  [export_complete] download_url: {data.get('download_url','')}")

            elif evt_type == "error":
                print(f"\n  [error] {data.get('message','')}")

            elif evt_type == "agent_message":
                pass  # printed from dispatch

    except asyncio.CancelledError:
        pass
    finally:
        store.unsubscribe(session, queue)


async def chat_repl():
    store = SessionStore()
    session = await create_session(store)

    print("=" * 60)
    print("  StructuraNet AI — LLM Tool Calling CLI")
    print("=" * 60)
    print(f"  Session ID : {session.session_id}")
    print(f"  Output dir : {session.output_dir}")
    print()
    print("  Architecture: No FSM. No Intent Router.")
    print("  The LLM decides which tools to call autonomously.")
    print()
    print("  Available tools:")
    print("    - generate_new_topology(requirements)")
    print("    - modify_current_topology(feedback)")
    print("    - apply_security_and_export(security_profile)")
    print("    - search_cisco_knowledge(topic)")
    print()
    print("  Commands:")
    print("    /context   — Show session context (topology, edits)")
    print("    /history   — Show conversation history")
    print("    /quit      — Exit")
    print()
    print("  Tips:")
    print("    - 'Design a campus network with 3 branches'")
    print("    - 'How do I configure OSPF?'")
    print("    - 'Add a firewall and approve it with enterprise security'")
    print("=" * 60)
    print()

    listener_task = asyncio.create_task(event_listener(session, store))

    try:
        while True:
            try:
                user_input = input("You > ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\nGoodbye!")
                break

            if not user_input:
                continue

            if user_input == "/quit":
                print("\nGoodbye!")
                break

            elif user_input == "/context":
                agent_data = getattr(session, "_agent_data", None)
                if agent_data:
                    print(f"  Has topology: {agent_data.topology_dict is not None}")
                    print(f"  Topology approved: {agent_data.topology_approved}")
                    print(f"  Edit iterations: {agent_data.edit_iterations}/{agent_data.max_edit_iterations}")
                    if agent_data.topology_dict:
                        topo = agent_data.topology_dict.get("topology", {})
                        nodes = topo.get("nodes", [])
                        print(f"  Nodes: {len(nodes)}")
                        print(f"  Devices: {', '.join(n.get('name','?') for n in nodes[:10])}")
                else:
                    print("  (no context yet)")
                continue

            elif user_input == "/history":
                agent_data = getattr(session, "_agent_data", None)
                if agent_data and agent_data.conversation_history:
                    for msg in agent_data.conversation_history:
                        role = msg.get("role", "?").upper()
                        content = msg.get("content", "")
                        tc = msg.get("tool_calls")
                        if tc:
                            tools = [t["function"]["name"] for t in tc]
                            print(f"  [{role}] tool_calls: {tools}")
                        elif content:
                            preview = content[:150]
                            print(f"  [{role}] {preview}{'...' if len(content) > 150 else ''}")
                        else:
                            print(f"  [{role}] (no content)")
                else:
                    print("  (no history)")
                continue

            # Normal dispatch
            print()
            try:
                response = await agent_dispatch(
                    user_message=user_input,
                    session=session,
                    store=store,
                )

                # Print the response
                if response.tool_calls_made:
                    print(f"  [tools called: {', '.join(response.tool_calls_made)}]")
                    print()

                for line in response.message.split("\n"):
                    print(f"  {line}")
                print()

            except Exception as exc:
                print(f"  ERROR: {exc}")

    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.WARNING,
        format="%(name)s [%(levelname)s] %(message)s",
    )
    logging.getLogger("structranet.chat_orchestrator").setLevel(logging.INFO)

    asyncio.run(chat_repl())
