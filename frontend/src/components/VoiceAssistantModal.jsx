import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Printer, PlusCircle } from 'lucide-react';
import { processVoiceCommand } from '../services/voiceParser';
import { toast } from 'react-hot-toast';

const VoiceAssistantModal = ({ isOpen, onClose, menuItems = [], tables = [], onExecuteAction }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [language, setLanguage] = useState('hi-IN'); // Hindi / Hinglish default

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = language;

        rec.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        rec.onerror = (event) => {
          console.warn('[SPEECH RECOGNITION ERROR]', event.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, [language]);

  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setParsedResult(null);
      startListening();
    } else {
      stopListening();
    }
  }, [isOpen]);

  const startListening = () => {
    if (recognition) {
      try {
        setTranscript('');
        setParsedResult(null);
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition already started', err);
      }
    } else {
      toast.error('Voice recognition is not supported in this browser/device.');
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (err) {}
      setIsListening(false);
    }
  };

  const handleProcessVoice = async (textToProcess) => {
    const speechText = textToProcess || transcript;
    if (!speechText || !speechText.trim()) {
      toast.error('Please speak a command first');
      return;
    }

    stopListening();
    setIsProcessing(true);
    try {
      const result = await processVoiceCommand(speechText, menuItems, tables);
      setParsedResult(result);
    } catch (err) {
      toast.error('Failed to parse voice command');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAction = () => {
    if (!parsedResult) return;
    onExecuteAction(parsedResult);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        color: '#f8fafc',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '460px',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>BestBill AI Voice</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Gemini 2.5 Flash Voice Command</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={() => setLanguage('hi-IN')}
            style={{
              flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
              backgroundColor: language === 'hi-IN' ? '#6366f1' : '#334155',
              color: '#ffffff', border: 'none', cursor: 'pointer'
            }}
          >
            🇮🇳 Hindi / Hinglish
          </button>
          <button
            onClick={() => setLanguage('en-US')}
            style={{
              flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
              backgroundColor: language === 'en-US' ? '#6366f1' : '#334155',
              color: '#ffffff', border: 'none', cursor: 'pointer'
            }}
          >
            🌐 English
          </button>
        </div>

        {/* Animated Mic Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
          <button
            onClick={isListening ? stopListening : startListening}
            style={{
              width: '84px', height: '84px', borderRadius: '50%',
              backgroundColor: isListening ? '#ef4444' : '#6366f1',
              color: '#ffffff', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isListening
                ? '0 0 0 12px rgba(239, 68, 68, 0.25), 0 0 0 24px rgba(239, 68, 68, 0.15)'
                : '0 0 0 8px rgba(99, 102, 241, 0.2)',
              transition: 'all 0.3s ease'
            }}
          >
            {isListening ? <Mic size={38} className="animate-pulse" /> : <MicOff size={38} />}
          </button>
          <p style={{ marginTop: '14px', fontSize: '13px', color: isListening ? '#f87171' : '#94a3b8', fontWeight: 700 }}>
            {isListening ? 'Listening... Speak your command now' : 'Tap Mic to Start Listening'}
          </p>
        </div>

        {/* Live Speech Transcript Box */}
        <div style={{
          backgroundColor: '#0f172a', borderRadius: '14px', padding: '14px',
          minHeight: '70px', maxHeight: '100px', overflowY: 'auto',
          border: '1px solid #334155', marginBottom: '16px'
        }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Live Speech Transcript:
          </p>
          <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: transcript ? '#f1f5f9' : '#475569', fontStyle: transcript ? 'normal' : 'italic' }}>
            {transcript || '"Table 4 pe 2 chicken thali or 4 roti add karo" / "Table 3 ka print nikalo"'}
          </p>
        </div>

        {/* Example Chips */}
        {!parsedResult && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Try saying:</span>
            {[
              "Add 2 Paneer Masala to table 1",
              "Table 4 pe 2 chicken thali add karo",
              "Table 3 ka print nikalo"
            ].map((ex, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTranscript(ex);
                  handleProcessVoice(ex);
                }}
                style={{
                  fontSize: '11px', backgroundColor: '#334155', color: '#cbd5e1',
                  border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer'
                }}
              >
                "{ex}"
              </button>
            ))}
          </div>
        )}

        {/* Process Button */}
        {transcript && !parsedResult && (
          <button
            onClick={() => handleProcessVoice(transcript)}
            disabled={isProcessing}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px',
              backgroundColor: '#10b981', color: '#ffffff', border: 'none',
              fontWeight: 800, fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {isProcessing ? 'Analyzing with Gemini 2.5 Flash...' : 'Process Voice Command'}
          </button>
        )}

        {/* Parsed Result Card */}
        {parsedResult && (
          <div style={{
            backgroundColor: parsedResult.action !== 'UNKNOWN' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${parsedResult.action !== 'UNKNOWN' ? '#10b981' : '#ef4444'}`,
            borderRadius: '14px', padding: '14px', marginTop: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {parsedResult.action !== 'UNKNOWN' ? (
                <CheckCircle2 size={20} color="#10b981" />
              ) : (
                <AlertCircle size={20} color="#ef4444" />
              )}
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: parsedResult.action !== 'UNKNOWN' ? '#34d399' : '#f87171' }}>
                {parsedResult.action === 'ADD_ITEMS' ? 'Add Items Command Recognized' : parsedResult.action === 'PRINT_BILL' ? 'Print Bill Command Recognized' : 'Command Not Recognized'}
              </h4>
            </div>

            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#cbd5e1' }}>
              {parsedResult.message}
            </p>

            {parsedResult.items && parsedResult.items.length > 0 && (
              <div style={{ backgroundColor: '#0f172a', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>ITEMS TO ADD:</div>
                {parsedResult.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                    <span>• {it.name}</span>
                    <span style={{ color: '#818cf8' }}>x{it.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => setParsedResult(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  backgroundColor: '#334155', color: '#ffffff', border: 'none',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Try Again
              </button>
              {parsedResult.action !== 'UNKNOWN' && (
                <button
                  onClick={handleApplyAction}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '10px',
                    backgroundColor: '#6366f1', color: '#ffffff', border: 'none',
                    fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  {parsedResult.action === 'PRINT_BILL' ? <Printer size={16} /> : <PlusCircle size={16} />}
                  Confirm & Execute Action
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistantModal;
