import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot,
  Send,
  Sparkles,
  User,
  Brain,
  ShieldCheck,
  RotateCcw,
  Lightbulb,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  source?: string;
}

const SAMPLE_QUESTIONS = [
  'What should the manager do today?',
  'Why is EQX1002 anomalous?',
  'Which assets are overdue for return?',
  'Which site has the highest demand?',
  'Which machines are under-utilized?',
  'Which equipment should we move next?',
];

export default function CopilotPage() {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'copilot',
      text: `👋 Hello! I am your **CatRent AI Operations Copilot**.\n\nI am grounded directly in live fleet telemetry, overdue return monitors, anomaly scores, and demand forecasts. What would you like to inspect today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'CatRent Grounded Engine',
    },
  ]);

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      return (await api.post('/copilot/ask', { question })).data;
    },
    onSuccess: (data) => {
      const copilotMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'copilot',
        text: data.data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.data.source,
      };
      setMessages((prev) => [...prev, copilotMsg]);
    },
  });

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || inputMessage).trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    askMutation.mutate(q);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-foreground">AI Operations Copilot</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-cat-yellow/15 px-2.5 py-0.5 text-xs font-bold text-cat-yellow border border-cat-yellow/30">
              <Sparkles className="h-3.5 w-3.5" /> Grounded Operational Intelligence
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time conversational assistant strictly grounded in database telemetry and predictive ML results.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setMessages([
              {
                id: 'msg-1',
                sender: 'copilot',
                text: `👋 Hello! I am your **CatRent AI Operations Copilot**.\n\nI am grounded directly in live fleet telemetry, overdue return monitors, anomaly scores, and demand forecasts. What would you like to inspect today?`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                source: 'CatRent Grounded Engine',
              },
            ])
          }
          className="gap-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear Chat
        </Button>
      </div>

      {/* Suggestion Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 whitespace-nowrap">
          <Lightbulb className="h-3.5 w-3.5 text-cat-yellow" /> Suggestions:
        </span>
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            className="rounded-full border border-border bg-muted/40 hover:bg-cat-yellow/10 hover:border-cat-yellow/40 hover:text-cat-yellow px-3 py-1 text-xs whitespace-nowrap transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'copilot' && (
              <div className="h-8 w-8 rounded-lg bg-cat-yellow flex items-center justify-center text-cat-black font-bold flex-shrink-0 mt-0.5">
                <Bot className="h-5 w-5" />
              </div>
            )}

            <div
              className={`rounded-xl p-4 max-w-[85%] text-xs space-y-2 leading-relaxed shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-cat-yellow text-cat-black font-semibold rounded-tr-none'
                  : 'bg-card border border-border text-foreground rounded-tl-none'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
              <div
                className={`flex items-center justify-between text-[10px] pt-1 border-t ${
                  msg.sender === 'user' ? 'border-cat-black/20 text-cat-black/70' : 'border-border text-muted-foreground'
                }`}
              >
                <span>{msg.timestamp}</span>
                {msg.source && <span className="font-mono">{msg.source}</span>}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold flex-shrink-0 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {askMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="h-8 w-8 rounded-lg bg-cat-yellow flex items-center justify-center text-cat-black flex-shrink-0">
              <Bot className="h-5 w-5 animate-pulse" />
            </div>
            <div className="rounded-xl p-3 bg-card border border-border text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cat-yellow animate-spin" />
              Synthesizing live fleet database insights...
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Bar */}
      <div className="flex gap-2 flex-shrink-0 pt-2 border-t border-border">
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about overdue equipment, anomalies, demand shortages, or manager actions..."
          className="text-xs h-10"
        />
        <Button
          variant="cat"
          size="sm"
          onClick={() => handleSend()}
          disabled={!inputMessage.trim() || askMutation.isPending}
          className="h-10 px-4 font-bold gap-1.5"
        >
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
