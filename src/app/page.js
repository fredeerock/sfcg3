'use client'

import { useState, useEffect, useRef } from 'react'
import Progress from './components/Progress'

// App configuration - simplified with fixed token limit
const APP_CONFIG = {
  MODEL_TIMEOUT_MS: 60000  // 60 seconds model loading timeout
};

export default function Home() {
  // Use localStorage instead of sessionStorage for better iOS compatibility
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const worker = useRef(null);
  const chatContainerRef = useRef(null);
  
  // Removed maxTokens state since we'll use a fixed value

  // Load saved conversation on initial render
  useEffect(() => {
    // Check if Safari
    const isSafariBrowser = 
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
      (navigator.userAgent.includes('AppleWebKit') && !navigator.userAgent.includes('Chrome'));
    
    setIsSafari(isSafariBrowser);
    console.log("Browser detected as Safari:", isSafariBrowser);
    
    // Load saved conversation
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pentest_conversation');
        if (saved) {
          const parsedConversation = JSON.parse(saved);
          setConversation(parsedConversation);
          console.log("Loaded saved conversation:", parsedConversation);
        }
        
        // Check for saved model state
        const savedModelState = localStorage.getItem('pentest_model_loaded');
        if (savedModelState === 'true') {
          setModelLoaded(true);
          setStatus('ready');
        }
      } catch (e) {
        console.error("Error loading saved conversation:", e);
      }
    }
  }, []);

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && conversation.length > 0) {
      localStorage.setItem('pentest_conversation', JSON.stringify(conversation));
    }
  }, [conversation]);
  
  // Save model state
  useEffect(() => {
    if (modelLoaded) {
      localStorage.setItem('pentest_model_loaded', 'true');
    }
  }, [modelLoaded]);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  useEffect(() => {
    // Create worker only once and if it doesn't exist yet
    if (!worker.current) {
      try {
        // Create a new worker
        worker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        console.log("Worker created successfully");
      } catch (error) {
        console.error("Failed to create worker:", error);
        setError("Failed to initialize AI model worker: " + error.message);
      }
    }

    // Only set up message handler if worker exists
    if (worker.current) {
      const onMessageReceived = (e) => {
        const { status, output, message, overall } = e.data;
        console.log("Received message from worker:", e.data);

        // Update overall progress whenever it's included
        if (overall !== undefined) {
          setOverallProgress(Number(overall));
        }

        switch (status) {
          case 'initiate':
            setStatus('loading');
            setIsLoading(true);
            break;
          case 'ready':
            setStatus('ready');
            setModelLoaded(true);
            // Save model loaded state
            if (typeof window !== 'undefined') {
              localStorage.setItem('pentest_model_loaded', 'true');
            }
            break;
          case 'complete':
            setIsLoading(false);
            if (output && output[0] && output[0].generated_text) {
              // Add bot message
              const newConvo = [...conversation, { type: 'bot', text: output[0].generated_text }];
              setConversation(newConvo);
              // Save immediately
              if (typeof window !== 'undefined') {
                localStorage.setItem('pentest_conversation', JSON.stringify(newConvo));
              }
            } else {
              setError("Received empty response from model");
            }
            break;
          case 'error':
            setIsLoading(false);
            setError(message);
            break;
        }
      };

      worker.current.addEventListener('message', onMessageReceived);
      
      return () => {
        if (worker.current) {
          worker.current.removeEventListener('message', onMessageReceived);
        }
      };
    }
  }, [conversation]);

  const sendMessage = (text) => {
    if (!worker.current) {
      setError("Model worker not initialized. Please refresh the page.");
      return;
    }
    
    if (text.trim()) {
      setIsLoading(true);
      setError(null);
      
      // Add user message to conversation and save immediately
      const newMessage = { type: 'user', text: text.trim() };
      const newConvo = [...conversation, newMessage];
      setConversation(newConvo);
      
      // Save immediately to prevent losing the message on refresh
      if (typeof window !== 'undefined') {
        localStorage.setItem('pentest_conversation', JSON.stringify(newConvo));
      }
      
      try {
        // No longer passing maxTokens to worker - using fixed value in worker
        worker.current.postMessage({ 
          text: text.trim()
        });
      } catch (error) {
        console.error("Error sending message to worker:", error);
        setError("Failed to send message to model: " + error.message);
        setIsLoading(false);
      }
    }
  };

  // Safari-safe form submission handler
  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault(); // Prevent form submission
      e.stopPropagation(); // Stop event propagation
    }
    
    if (!isLoading && inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
    
    // Return false to prevent form submission in old browsers
    return false;
  };

  // Safari-safe button click handler
  const handleButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isLoading && inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
    
    return false;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">The Pen Test</h1>
      <h2 className="text-2xl mb-4 text-center">Is the Pen Mightier than the LLM?</h2>

      <div 
        ref={chatContainerRef}
        className="w-full max-w-md p-4 border border-gray-300 rounded mb-4 h-64 overflow-y-auto"
      >
        {conversation.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            Send a message to start a conversation
          </div>
        )}
        
        {conversation.map((msg, index) => (
          <div key={index} className={`p-2 mb-2 ${msg.type === 'user' ? 'text-right bg-gray-100 rounded-lg' : 'text-left bg-blue-100 rounded-lg'}`}>
            <strong>{msg.type === 'user' ? 'You' : 'Bot'}:</strong> {msg.text}
          </div>
        ))}
        
        {isLoading && status === 'ready' && (
          <div className="text-left bg-blue-50 rounded-lg p-2 mb-2">
            <em>Bot is typing...</em>
          </div>
        )}
      </div>

      {/* Safari-safe form design */}
      {isSafari ? (
        <div className="w-full max-w-md flex">
          <input
            className="flex-grow p-2 border border-gray-300 rounded-l"
            type="text"
            placeholder="Enter your message"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!isLoading && inputText.trim()) {
                  sendMessage(inputText);
                  setInputText('');
                }
              }
            }}
            disabled={isLoading && status === 'loading'}
          />
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded-r disabled:bg-gray-300"
            onClick={handleButtonClick}
            disabled={isLoading || !inputText.trim()}
            type="button" 
          >
            Send
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-md flex">
          <input
            className="flex-grow p-2 border border-gray-300 rounded-l"
            type="text"
            placeholder="Enter your message"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading && status === 'loading'}
          />
          <button 
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-r disabled:bg-gray-300"
            disabled={isLoading || !inputText.trim()}
          >
            Send
          </button>
        </form>
      )}

      {/* Show overall progress while loading */}
      {status === 'loading' && (
        <div className="w-full max-w-md mt-4">
          <Progress 
            text="Loading Model" 
            percentage={overallProgress} 
          />
        </div>
      )}

      {error && (
        <div className="w-full max-w-md p-2 bg-red-100 text-red-700 rounded mt-4">
          Error: {error}
        </div>
      )}
      
      {modelLoaded && (
        <div className="w-full max-w-md p-2 text-green-700 text-center mt-2 text-sm">
          Model loaded successfully
        </div>
      )}
      
      {/* Clear conversation button */}
      {conversation.length > 0 && (
        <button
          className="mt-4 px-3 py-1 bg-red-100 text-red-700 text-sm rounded"
          onClick={() => {
            if (confirm('Are you sure you want to clear the conversation?')) {
              setConversation([]);
              localStorage.removeItem('pentest_conversation');
            }
          }}
        >
          Clear Conversation
        </button>
      )}

      {/* Removed settings section with dropdown */}
    </main>
  );
}