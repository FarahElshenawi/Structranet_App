import "./dashboardPage.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { createSession, startGeneration } from "../../lib/api";

const DashboardPage = () => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [greeting, setGreeting] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const username = userData?.username || "User";
    const hasVisited = localStorage.getItem("hasVisitedStructraNet");

    if (!hasVisited) {
      setGreeting(`👋 Hello, ${username}! Welcome to StructuraNet AI`);
      localStorage.setItem("hasVisitedStructraNet", "true");
    } else {
      setGreeting(`👋 Welcome back, ${username}!`);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !text.trim()) return;

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/sign-in");

      // Create chat in Express backend
      const createResponse = await fetch("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      const chat = await createResponse.json();
      window.dispatchEvent(new CustomEvent("chat-created"));

      // Create session in FastAPI
      const session = await createSession();

      // Start generation
      await startGeneration(session.session_id, text);

      // Save session ID in chat metadata
      await fetch(`http://localhost:3000/api/chats/${chat._id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: text, images: [] },
            { role: "assistant", content: "Topology generation started", images: [], sessionId: session.session_id },
          ],
        }),
      });

      navigate(`/dashboard/chats/${chat._id}`);
    } catch (error) {
      console.error(error);
      alert("Failed to start: " + error.message);
    } finally {
      setLoading(false);
      setText("");
    }
  };

  return (
    <div className="dashboardPage">
      <div className="texts">
        <div className="logo">
          <img src="/logo.png" alt="" />
          <h1>StructuraNet AI</h1>
        </div>

        <h2 className="greeting">{greeting}</h2>

        <div className="options">
          <div className="option">
            <img src="/chat.png" alt="" />
            <span>Generate Network Topology</span>
          </div>
          <div className="option">
            <img src="/image.png" alt="" />
            <span>Design from Description</span>
          </div>
        </div>
      </div>

      <div className="formContainer">
        <form onSubmit={handleSubmit}>
          <div className="input-row">
            <input
              type="text"
              placeholder={loading ? "Generating topology..." : "Describe the network you want to build..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !text.trim()}>
              <img src="/arrow.png" alt="send" className="send-icon" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DashboardPage;
