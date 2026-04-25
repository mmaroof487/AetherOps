import React, { useState, useEffect, useRef } from 'react';
import { styled, keyframes, fadeUp, pulseGlow } from './stitches.config';

// Ultra-modern Stitches Components
const ChatContainer = styled('div', {
  maxWidth: '700px',
  margin: '40px auto 0',
  height: '420px',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
  backdropFilter: 'blur(12px)',
  borderRadius: '24px',
  boxShadow: '$md',
  border: '1.5px solid $border',
  overflow: 'hidden',
  transition: 'border-color $fast, transform $lazy, box-shadow $lazy',
  '.dark-theme &': {
    background: 'linear-gradient(145deg, rgba(21,34,50,0.85), rgba(13,27,42,0.85))',
  },
  '&:hover': {
    borderColor: '$navy',
    boxShadow: '$glow',
    transform: 'translateY(-2px)'
  }
});

const MessageList = styled('div', {
  flex: 1,
  padding: '24px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

const slideIn = keyframes({
  '0%': { opacity: 0, transform: 'translateY(10px) scale(0.98)' },
  '100%': { opacity: 1, transform: 'translateY(0) scale(1)' }
});

const Bubble = styled('div', {
  padding: '12px 18px',
  borderRadius: '18px',
  fontSize: '14.5px',
  lineHeight: 1.6,
  maxWidth: '85%',
  animation: `${slideIn} 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
  fontFamily: '"DM Sans", sans-serif',
  variants: {
    role: {
      bot: {
        background: '$navy',
        color: '#FFFFFF',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: '4px',
      },
      user: {
        background: '$gold',
        color: '$navyDk',
        alignSelf: 'flex-end',
        borderBottomRightRadius: '4px',
        fontWeight: 500
      }
    }
  }
});

const InputArea = styled('form', {
  display: 'flex',
  padding: '16px 24px',
  gap: '12px',
  background: 'rgba(255,255,255,0.5)',
  borderTop: '1px solid $border',
  backdropFilter: 'blur(10px)',
  alignItems: 'flex-end',
  '.dark-theme &': {
    background: 'rgba(13,27,42,0.5)',
  }
});

const InputBox = styled('textarea', {
  flex: 1,
  background: 'transparent',
  border: 'none',
  resize: 'none',
  color: '$text',
  fontSize: '15px',
  outline: 'none',
  lineHeight: 1.5,
  minHeight: '44px',
  maxHeight: '120px',
  fontFamily: 'inherit',
  '&::placeholder': { color: '$muted' }
});

const SendBtn = styled('button', {
  background: 'linear-gradient(135deg, $navy, $navyDk)',
  color: '#FFF',
  width: '44px',
  height: '44px',
  borderRadius: '14px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexShrink: 0,
  cursor: 'pointer',
  transition: 'transform 0.2s',
  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(33,64,94,0.3)' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed', transform: 'none' }
});

const Typist = styled('div', {
  display: 'flex', gap: '4px', padding: '16px 18px',
  background: 'transparent', width: 'fit-content'
});
const Dot = styled('span', {
  width: '6px', height: '6px', borderRadius: '50%', background: '$navy',
  animation: `${pulseGlow} 1.4s infinite ease-in-out`,
  '&:nth-child(2)': { animationDelay: '0.2s' },
  '&:nth-child(3)': { animationDelay: '0.4s' }
});

const ResultCard = styled('div', {
  marginTop: '20px', padding: '20px',
  borderRadius: '16px', background: 'rgba(45, 139, 90, 0.08)',
  border: '1.5px solid $green', color: '$navy', animation: `${slideIn} 0.4s ease`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
});

export default function ChatOnboarding({ onComplete }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I can set up your complete cloud infrastructure. Tell me a bit about your business. (e.g. "I run a clothing store in Mumbai with roughly 100 visitors a day")' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || extracted) return;
    
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', text: userMsg }];
    setMessages(newHistory);
    setLoading(true);

    try {
      // Hit the AI requirement extraction backend
      const res = await fetch('http://localhost:3001/api/extract-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: newHistory.map(m => ({ role: m.role, content: m.text })) })
      });
      const data = await res.json();
      
      if (data.ok && data.requirements) {
        const reqs = data.requirements;
        if (reqs.missingInfo) {
          // AI needs more info
          setMessages([...newHistory, { role: 'bot', text: reqs.missingInfo }]);
        } else {
          // AI got everything
          setMessages([...newHistory, { role: 'bot', text: `Got it! Based on that, I've designed a ${reqs.summary}` }]);
          setExtracted(reqs);
        }
      }
    } catch (err) {
      setMessages([...newHistory, { role: 'bot', text: "Hmm, I couldn't reach the backend. Are you sure `node backend/server.js` is running?" }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <ChatContainer>
        <MessageList>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role}>{m.text}</Bubble>
          ))}
          {loading && (
            <Typist>
              <Dot /><Dot /><Dot />
            </Typist>
          )}
          <div ref={endRef} />
        </MessageList>
        {!extracted && (
          <InputArea onSubmit={handleSubmit}>
            <InputBox
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer here..."
              rows={1}
            />
            <SendBtn type="submit" disabled={!input.trim() || loading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </SendBtn>
          </InputArea>
        )}
      </ChatContainer>

      {extracted && (
        <ResultCard>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Configuration Ready ✨</div>
            <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
              We'll use a <b>{extracted.bizType || 'custom'}</b> setup tailored for <b>{extracted.traffic || 'starter'}</b> traffic.
            </div>
          </div>
          <button 
            className="btn-acc" 
            onClick={() => onComplete(extracted)}
            style={{ padding: '10px 24px', fontSize: '14px' }}>
            Generate Setup →
          </button>
        </ResultCard>
      )}
    </div>
  );
}
