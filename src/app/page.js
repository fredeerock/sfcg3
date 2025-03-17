'use client'

import { useState, useEffect, useRef } from 'react'
import Progress from './components/Progress'
import ReactMarkdown from 'react-markdown'

export default function Home() {
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const worker = useRef(null);
  const chatContainerRef = useRef(null);

  // Load saved conversation on initial render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pentest_conversation');
        if (saved) {
          setConversation(JSON.parse(saved));
        }
        
        const savedModelState = localStorage.getItem('pentest_model_loaded');
        if (savedModelState === 'true') {
          setModelLoaded(true);
          setStatus('ready');
        }
      } catch (e) {
        console.error("Error loading saved data:", e);
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

  // Removed heartbeat mechanism

  useEffect(() => {
    if (!worker.current) {
      try {
        worker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      } catch (error) {
        setError("Failed to initialize AI model worker: " + error.message);
      }
    }

    if (worker.current) {
      const onMessageReceived = (e) => {
        // Removed heartbeat check
        const { status, output, message, overall } = e.data;

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
            if (typeof window !== 'undefined') {
              localStorage.setItem('pentest_model_loaded', 'true');
            }
            break;
          case 'complete':
            setIsLoading(false);
            if (output && output[0] && output[0].generated_text) {
              const newConvo = [...conversation, { type: 'bot', text: output[0].generated_text }];
              setConversation(newConvo);
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
      worker.current.addEventListener('error', (error) => {
        setError("Worker error: " + error.message);
      });

      return () => {
        if (worker.current) {
          worker.current.removeEventListener('message', onMessageReceived);
          worker.current.removeEventListener('error', (error) => {
            setError("Worker cleanup error: " + error.message);
          });
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
      
      const newMessage = { type: 'user', text: text.trim() };
      const newConvo = [...conversation, newMessage];
      setConversation(newConvo);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('pentest_conversation', JSON.stringify(newConvo));
      }
      
      try {
        worker.current.postMessage({ text: text.trim() });
      } catch (error) {
        setError("Failed to send message to model: " + error.message);
        setIsLoading(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!isLoading && inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Local Gemma 3 Demo</h1>

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
            <strong>{msg.type === 'user' ? 'You' : 'Bot'}:</strong>
            <div className={msg.type === 'user' ? '' : 'mt-1 prose prose-sm max-w-none'}>
              {msg.type === 'user' ? (
                <span>{msg.text}</span>
              ) : (
                <ReactMarkdown components={{
                  // Add custom styling to elements as needed
                  pre: ({node, ...props}) => (
                    <pre className="overflow-x-auto p-2 bg-gray-50 rounded" {...props} />
                  ),
                  code: ({node, inline, ...props}) => (
                    inline 
                      ? <code className="bg-gray-50 px-1 py-0.5 rounded text-sm" {...props} />
                      : <code className="block" {...props} />
                  )
                }}>
                  {msg.text}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && status === 'ready' && (
          <div className="text-left bg-blue-50 rounded-lg p-2 mb-2">
            <em>Bot is typing...</em>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md flex">
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
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-r disabled:bg-gray-300"
          disabled={isLoading || !inputText.trim()}
        >
          Send
        </button>
      </form>

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
    </main>
  );
}