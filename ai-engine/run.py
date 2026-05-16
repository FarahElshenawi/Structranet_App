"""Structranet AI — Entry Point

Usage:
    # Start API server
    uvicorn run:app --reload --port 8000
    
    # Run CLI pipeline
    python run.py --request "Design a campus network"
"""
from structranet.api.app import app  # noqa: F401

if __name__ == "__main__":
    from structranet.orchestrator import main
    main()
