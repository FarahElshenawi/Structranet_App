import { useState, useRef } from "react";
import "./newPrompt.css";

/**
 * NewPrompt — Input bar for sending topology generation requests to FastAPI.
 *
 * Props:
 *   onSubmit: (text: string) => void
 *   isLoading: boolean
 */
const NewPrompt = ({ onSubmit, isLoading }) => {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoading || !text.trim()) return;
    onSubmit(text.trim());
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't support speech recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText((prev) => prev + (prev ? " " : "") + transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <div className="newPrompt">
      <form onSubmit={handleSubmit}>
        <div className="input-row">
          <button
            type="button"
            className={`mic-btn ${isListening ? "listening" : ""}`}
            onClick={startListening}
            disabled={isLoading}
            title="Voice input"
          >
            <img src="/microphone.png" alt="mic" className="mic-icon" />
          </button>

          <input
            type="text"
            className="text-input"
            placeholder={
              isLoading
                ? "Generating topology..."
                : "Describe the network topology you want to build..."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />

          <button
            type="submit"
            className="send-btn"
            disabled={isLoading || !text.trim()}
          >
            <img src="/arrow.png" alt="send" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewPrompt;
