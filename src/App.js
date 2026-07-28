import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Copy, Share2, Send, Loader2, Clock, Download, Check, Music, VolumeX, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import axios from "axios";
import "@/App.css";

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:absolute;left:-9999px;top:-9999px;opacity:0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    /* ignore */
  }
  document.body.removeChild(textarea);
  return ok ? Promise.resolve() : Promise.reject(new Error("Copy failed"));
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    await fallbackCopy(text);
  }
}

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LEVELS = {
  1: { name: "Sweetly Passive Aggressive", flavour: "You're fine. Totally fine.", indicator: "🙂" },
  2: { name: "Professionally Petty", flavour: "Noted. With disappointment.", indicator: "😒" },
  3: { name: "Barely Holding It Together", flavour: "Per my last email...", indicator: "😤" },
  4: { name: "Corporate Chaos Agent", flavour: "I will not be following up again.", indicator: "🔥" },
  5: { name: "Full Unhinged Villain Arc", flavour: "You have been warned.", indicator: "💀" },
};

const LOADING_MESSAGES = [
  "Consulting HR...",
  "Adding corporate buzzwords...",
  "Weaponizing professionalism...",
  "Preparing passive aggression...",
  "Summoning legal counsel...",
  "Calibrating chaos levels...",
];

const SAMPLE_EMAILS = [
  {
    title: "Missed Deadline",
    body: "Hi team, I wanted to check in on the deliverables that were due last Friday. Let me know when I can expect these.",
  },
  {
    title: "Refund Request",
    body: "Hello, I purchased this item two weeks ago and it arrived damaged. I would like to request a full refund.",
  },
  {
    title: "Salary Negotiation",
    body: "Hi, thank you for the offer. Based on my experience and market research, I was hoping we could discuss a higher base salary.",
  },
  {
    title: "Ghosted Recruiter",
    body: "Hi, I interviewed for this role three weeks ago and haven't heard back. Could you share an update on where things stand?",
  },
  {
    title: "Landlord Complaint",
    body: "Hi, the heating in my apartment has not been working for the past five days despite multiple requests. Please advise on next steps.",
  },
  {
    title: "Apartment Maintenance",
    body: "Hello, I submitted a maintenance request for the leaking faucet last week and no one has come by yet. Could someone follow up?",
  },
  {
    title: "Late Project Update",
    body: "Hi everyone, just circling back on the project status since I haven't received an update in a while. Where do things currently stand?",
  },
];

function riskFromLevel(level) {
  return level * 2;
}

function riskLabel(risk) {
  if (risk <= 2) return "Safe";
  if (risk <= 4) return "Manager Mildly Concerned";
  if (risk <= 6) return "Department Gossip";
  if (risk <= 8) return "HR Summoned";
  return "Career Limiting Move";
}

function useTypewriter(fullText) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!fullText) {
      setDisplayed("");
      return;
    }
    setDisplayed("");
    let i = 0;
    // aim for a natural feel, but cap total duration for long emails
    const stepMs = Math.max(8, Math.min(28, 1800 / fullText.length));
    const interval = setInterval(() => {
      i += 1;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, stepMs);
    return () => clearInterval(interval);
  }, [fullText]);
  return displayed;
}

// Fixed, deliberately slow pace for the intro — this should feel intentional,
// not like the fast adaptive speed used for AI-generated email output.
function useSlowTypewriter(fullText, msPerChar = 140) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!fullText) {
      setDisplayed("");
      return;
    }
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, msPerChar);
    return () => clearInterval(interval);
  }, [fullText, msPerChar]);
  return displayed;
}

function useLoadingMessage(active) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);
  return LOADING_MESSAGES[index];
}

// Real-time water-height-field simulation (classic two-buffer ripple algorithm),
// rendered at low resolution and scaled up by the browser for a soft, watery look.
// Reacts to mouse/touch movement; purely decorative, pointer-events disabled.
function WaterRipple() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const SIM_SCALE = 0.12;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let bufferA = new Float32Array(0);
    let bufferB = new Float32Array(0);
    let imageData = null;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      cols = Math.max(4, Math.floor(width * SIM_SCALE));
      rows = Math.max(4, Math.floor(height * SIM_SCALE));
      canvas.width = cols;
      canvas.height = rows;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      bufferA = new Float32Array(cols * rows);
      bufferB = new Float32Array(cols * rows);
      imageData = ctx.createImageData(cols, rows);
    }
    resize();
    window.addEventListener("resize", resize);

    function splash(clientX, clientY, strength) {
      const cx = Math.floor((clientX / width) * cols);
      const cy = Math.floor((clientY / height) * rows);
      if (cx > 1 && cx < cols - 2 && cy > 1 && cy < rows - 2) {
        const i = cy * cols + cx;
        bufferA[i] += strength;
      }
    }

    let lastX = null;
    let lastY = null;
    function onMove(e) {
      const point = e.touches && e.touches[0] ? e.touches[0] : e;
      const x = point.clientX;
      const y = point.clientY;
      if (typeof x !== "number" || typeof y !== "number") return;
      if (lastX !== null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) splash(x, y, Math.min(2.2, dist * 0.045));
      }
      lastX = x;
      lastY = y;
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });

    // Ambient splashes so the water reads as "alive" even before the cursor moves,
    // instead of being invisible until interaction.
    const ambient = setInterval(() => {
      splash(Math.random() * width, Math.random() * height, 1.1 + Math.random());
    }, 2400);

    let raf;
    let frameCount = 0;
    function step() {
      frameCount += 1;
      // Only advance the physics every 3rd frame — keeps propagation slow
      // and deliberate instead of flickering.
      if (frameCount % 3 === 0) {
        for (let y = 1; y < rows - 1; y++) {
          for (let x = 1; x < cols - 1; x++) {
            const i = y * cols + x;
            bufferB[i] =
              (bufferA[i - 1] + bufferA[i + 1] + bufferA[i - cols] + bufferA[i + cols]) / 2 - bufferB[i];
            bufferB[i] *= 0.965;
          }
        }
        const tmp = bufferA;
        bufferA = bufferB;
        bufferB = tmp;

        // Real highlight/shadow shading (not flat single-tone alpha) — wave
        // crests render bright/white, troughs render dark, like light
        // actually catching on moving water. This is what makes it visible
        // against both light and dark theme backgrounds.
        const data = imageData.data;
        for (let i = 0; i < cols * rows; i++) {
          const v = bufferA[i];
          const idx = i * 4;
          if (v >= 0) {
            const t = Math.min(1, v * 0.5);
            data[idx] = 175 + t * 80;
            data[idx + 1] = 217 + t * 38;
            data[idx + 2] = 255;
          } else {
            const t = Math.min(1, -v * 0.5);
            data[idx] = 175 - t * 120;
            data[idx + 1] = 217 - t * 140;
            data[idx + 2] = 255 - t * 80;
          }
          data[idx + 3] = Math.max(0, Math.min(150, Math.abs(v) * 55));
        }
        ctx.putImageData(imageData, 0, 0);
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(ambient);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="water-ripple-canvas" aria-hidden="true" />;
}

function SampleDeck({ onPick }) {
  const [order, setOrder] = useState(SAMPLE_EMAILS.map((_, i) => i));
  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);

  const advance = useCallback(() => {
    setOrder((prev) => [...prev.slice(1), prev[0]]);
    setDragX(0);
  }, []);

  const onPointerDown = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    setDragX(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    dragging.current = false;
    if (Math.abs(dragX) > 90) {
      advance();
    } else {
      setDragX(0);
    }
  };

  const topThree = order.slice(0, 3);

  return (
    <div className="sample-deck" aria-label="Sample email examples, swipe to browse">
      {topThree
        .slice()
        .reverse()
        .map((sampleIdx, stackPos) => {
          const isTop = stackPos === topThree.length - 1;
          const sample = SAMPLE_EMAILS[sampleIdx];
          const depth = topThree.length - 1 - stackPos;
          const style = isTop
            ? {
                transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)`,
                transition: dragging.current ? "none" : "transform 300ms ease",
              }
            : {
                transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                opacity: 1 - depth * 0.25,
              };
          return (
            <div
              key={sampleIdx}
              className="sample-card"
              style={style}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerLeave={isTop ? onPointerUp : undefined}
            >
              <span className="sample-card-title">{sample.title}</span>
              <p className="sample-card-body">{sample.body}</p>
              {isTop && (
                <button
                  type="button"
                  className="sample-card-use"
                  onClick={() => onPick(sample.body)}
                >
                  Use this
                </button>
              )}
            </div>
          );
        })}
      <p className="sample-deck-hint">swipe or drag ↔</p>
    </div>
  );
}

function SampleChips({ onPick }) {
  return (
    <div className="sample-chips" role="list" aria-label="Sample email examples">
      {SAMPLE_EMAILS.map((sample) => (
        <button
          key={sample.title}
          type="button"
          className="sample-chip"
          onClick={() => onPick(sample.body)}
        >
          {sample.title}
        </button>
      ))}
    </div>
  );
}

function RiskMeter({ risk }) {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimatedWidth(risk * 10), 80);
    return () => clearTimeout(t);
  }, [risk]);

  return (
    <div className="risk-meter">
      <div className="risk-meter-top">
        <span className="risk-meter-label">HR Risk Meter</span>
        <span className="risk-meter-score">{risk}/10</span>
      </div>
      <div className="risk-meter-track">
        <div className="risk-meter-fill" style={{ width: `${animatedWidth}%` }} />
      </div>
      <p className="risk-meter-verdict">{riskLabel(risk)}</p>
    </div>
  );
}

function EmailEscalator() {
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState(1);
  const [rewritten, setRewritten] = useState("");
  const [loading, setLoading] = useState(false);
  const [originalForShare, setOriginalForShare] = useState("");
  const [rateLimitDialog, setRateLimitDialog] = useState({ open: false, retryAfter: "" });
  const [copied, setCopied] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef(null);
  const loadingMessage = useLoadingMessage(loading);
  const typedEmail = useTypewriter(rewritten);
  const risk = riskFromLevel(level);

  // Intro sequence: type "_nour.exe_" center screen on red splash, then move it
  // to its resting corner position while the app slides down from above.
  const HANDLE_TEXT = "_nour.exe_";
  const [introPhase, setIntroPhase] = useState("typing"); // typing -> holding -> moving -> done
  const typedHandle = useSlowTypewriter(HANDLE_TEXT, 220);
  const introTypingDone = typedHandle.length === HANDLE_TEXT.length;

  useEffect(() => {
    if (introTypingDone && introPhase === "typing") {
      // Hold the fully-typed name on screen for a beat before it moves —
      // this pause is what makes the motion feel deliberate rather than rushed.
      const t = setTimeout(() => setIntroPhase("moving"), 1300);
      return () => clearTimeout(t);
    }
  }, [introTypingDone, introPhase]);

  useEffect(() => {
    if (introPhase === "moving") {
      const t = setTimeout(() => setIntroPhase("done"), 1700);
      return () => clearTimeout(t);
    }
  }, [introPhase]);

  // Volume scales with drama level while the track is playing
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(0.65, 0.12 + level * 0.1);
    }
  }, [level]);

  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (audioOn) {
      audioRef.current.pause();
      setAudioOn(false);
    } else {
      audioRef.current.play().catch(() => {
        toast.error("Add a classical track at public/classical-loop.mp3 to enable music");
      });
      setAudioOn(true);
    }
  }, [audioOn]);

  const handleEscalate = useCallback(async () => {
    if (!email.trim()) {
      toast.error("Paste an email first");
      return;
    }
    setLoading(true);
    setRewritten("");
    try {
      const res = await axios.post(`${API}/escalate`, { email: email.trim(), level });
      setRewritten(res.data.rewritten);
      setOriginalForShare(email.trim());
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 429 && detail?.type === "rate_limit") {
        setRateLimitDialog({ open: true, retryAfter: detail.retry_after });
      } else {
        const msg = typeof detail === "string" ? detail : detail?.message || "Something went wrong";
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [email, level]);

  const handleCopy = useCallback(() => {
    if (!rewritten) return;
    copyToClipboard(rewritten)
      .then(() => {
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Failed to copy"));
  }, [rewritten]);

  const handleDownload = useCallback(() => {
    if (!rewritten) return;
    const blob = new Blob([rewritten], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escalated-email-level-${level}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }, [rewritten, level]);

  const handleShare = useCallback(async () => {
    if (!rewritten) return;
    try {
      const res = await axios.post(`${API}/share`, {
        original_email: originalForShare,
        rewritten_email: rewritten,
        level,
      });
      const shareUrl = `${window.location.origin}/shared/${res.data.id}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: `Email Escalator - ${LEVELS[level].name}`, text: rewritten, url: shareUrl });
        } catch (shareErr) {
          if (shareErr.name !== "AbortError") {
            copyToClipboard(shareUrl)
              .then(() => toast.success("Share link copied to clipboard"))
              .catch(() => toast.error("Failed to copy share link"));
          }
        }
      } else {
        copyToClipboard(shareUrl)
          .then(() => toast.success("Share link copied to clipboard"))
          .catch(() => toast.error("Failed to copy share link"));
      }
    } catch {
      toast.error("Failed to create share link");
    }
  }, [rewritten, originalForShare, level]);

  return (
    <div className="escalator-app" data-theme={level}>
      <audio ref={audioRef} loop src="/classical-loop.mp3" />

      <div className="bg-blobs" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
      </div>

      <div className="grain-overlay" aria-hidden="true" />

      <WaterRipple />

      <div
        className={`intro-overlay ${introPhase !== "typing" ? "intro-overlay-hidden" : ""}`}
        aria-hidden="true"
      />
      <span className={`nour-tag ${introPhase === "typing" ? "nour-tag-center" : "nour-tag-final"}`}>
        {introPhase === "typing" ? typedHandle : HANDLE_TEXT}
      </span>

      <button type="button" className="audio-toggle" onClick={toggleAudio} aria-label={audioOn ? "Mute music" : "Play music"}>
        {audioOn ? <Music className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      <div className={`escalator-container app-reveal ${introPhase !== "typing" ? "app-reveal-visible" : ""}`}>
        <header className="escalator-header">
          <div className="logo-row">
            <Sparkles className="logo-sparkle" />
            <h1 className="escalator-title" data-testid="app-title">
              Email Escalator
            </h1>
            <Sparkles className="logo-sparkle logo-sparkle-right" />
          </div>
          <p className="escalator-subtitle">say what you mean. just... more.</p>
        </header>

        <div className="sample-row">
          <div className="sample-row-main">
            <SampleChips onPick={setEmail} />

            <section className="mb-10">
              <label className="block text-sm font-medium mb-3 opacity-70" htmlFor="email-input">
                Paste your email
              </label>
              <textarea
                id="email-input"
                data-testid="email-input"
                className="email-textarea"
                placeholder="Dear team, I wanted to follow up on the deliverables that were due last Friday..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                rows={6}
              />
            </section>
          </div>
          <SampleDeck onPick={setEmail} />
        </div>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span data-testid="drama-indicator" className={`indicator indicator-${level}`}>
                {LEVELS[level].indicator}
              </span>
              <span data-testid="drama-level-text" className="level-label">
                {level} — {LEVELS[level].name}
              </span>
            </div>
          </div>
          <input
            data-testid="drama-slider"
            type="range"
            min="1"
            max="5"
            step="1"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="drama-slider"
          />
          <div className="slider-ticks mt-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`slider-tick ${n === level ? "active" : ""}`}>
                {n}
              </span>
            ))}
          </div>
          <p data-testid="flavour-text" className="flavour-text mt-4">
            "{LEVELS[level].flavour}"
          </p>
        </section>

        <section className="mb-12">
          <button
            data-testid="escalate-button"
            className="escalate-btn"
            onClick={handleEscalate}
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="inline w-5 h-5 animate-spin" />
                {loadingMessage}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Send className="inline w-5 h-5" />
                Escalate This Email
              </span>
            )}
          </button>
        </section>

        {(rewritten || loading) && (
          <section className="mb-10">
            <div data-testid="output-card" className="output-card">
              <div className="output-card-topbar">
                <span className="traffic-dot red" />
                <span className="traffic-dot yellow" />
                <span className="traffic-dot green" />
                <span className="ml-3 text-xs font-medium opacity-50">Escalated Draft</span>
              </div>

              {!loading && (
                <div className="output-card-risk">
                  <RiskMeter risk={risk} />
                </div>
              )}

              <div className="output-card-header">
                <div>
                  <span className="font-semibold">Level:</span> {LEVELS[level].name}
                </div>
              </div>
              <div className="output-card-body">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="loading-dots">
                      <span className="loading-dot" />
                      <span className="loading-dot" />
                      <span className="loading-dot" />
                    </div>
                  </div>
                ) : (
                  <p data-testid="rewritten-email-content">{typedEmail}</p>
                )}
              </div>
              {rewritten && (
                <div className="output-card-actions">
                  <button data-testid="copy-button" className={`action-btn ${copied ? "action-btn-success" : ""}`} onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button className="action-btn" onClick={handleDownload}>
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button data-testid="share-button" className="action-btn" onClick={handleShare}>
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        <footer className="text-center pt-4 pb-8 opacity-30 text-xs">no emails were harmed in the making of this app (probably)</footer>
      </div>

      <Dialog open={rateLimitDialog.open} onOpenChange={(open) => setRateLimitDialog((prev) => ({ ...prev, open }))}>
        <DialogContent data-testid="rate-limit-dialog" className="sm:max-w-md border-2 rounded-2xl rate-limit-dialog-content">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <span className="text-5xl rate-limit-hand">✋</span>
            </div>
            <DialogTitle className="text-center text-xl font-bold rate-limit-dialog-title">Whoa there, Drama Queen!</DialogTitle>
            <DialogDescription asChild>
              <div className="text-center text-sm pt-3 rate-limit-dialog-desc">
                <p>Uh-uh! Cannot escalate your email right now.</p>
                <p className="mt-1">
                  You've burned through all <strong>5 rewrites</strong> this hour.
                </p>
                <p className="mt-1 italic opacity-70">Even chaos needs a cooldown.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="rate-limit-timer-box flex items-center justify-center gap-3 p-4 rounded-xl mt-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-semibold">
              Try again at <strong>{rateLimitDialog.retryAfter}</strong> IST
            </span>
          </div>
          <p className="text-center text-xs opacity-50 mt-1">Maybe go touch grass in the meantime?</p>
          <DialogFooter className="mt-3">
            <button
              data-testid="rate-limit-close-button"
              onClick={() => setRateLimitDialog({ open: false, retryAfter: "" })}
              className="rate-limit-close-btn w-full"
            >
              Fine, I'll Wait (Impatiently)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-center" richColors />
    </div>
  );
}

function SharedView() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/share/${shareId}`);
        setData(res.data);
      } catch {
        setError("This shared email could not be found.");
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  const level = data?.level || 1;

  const handleCopy = () => {
    if (!data?.rewritten_email) return;
    copyToClipboard(data.rewritten_email)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Failed to copy"));
  };

  if (loading) {
    return (
      <div className="escalator-app" data-theme="1">
        <div className="escalator-container text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "var(--theme-accent)" }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="escalator-app" data-theme="1">
        <div className="escalator-container text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Oops</h2>
          <p className="opacity-60">{error}</p>
          <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: "var(--theme-accent)" }}>
            Go back to Email Escalator
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="escalator-app" data-theme={level}>
      <div className="escalator-container">
        <header className="escalator-header">
          <a href="/" className="no-underline">
            <h1 className="escalator-title">Email Escalator</h1>
          </a>
          <div className="shared-badge mx-auto w-fit">
            <span className={`indicator indicator-${level}`}>{LEVELS[level]?.indicator}</span>
            {LEVELS[level]?.name}
          </div>
        </header>
        <div data-testid="output-card" className="output-card">
          <div className="output-card-topbar">
            <span className="traffic-dot red" />
            <span className="traffic-dot yellow" />
            <span className="traffic-dot green" />
            <span className="ml-3 text-xs font-medium opacity-50">Shared Escalated Draft</span>
          </div>
          <div className="output-card-risk">
            <RiskMeter risk={riskFromLevel(level)} />
          </div>
          <div className="output-card-header">
            <div>
              <span className="font-semibold">Level {data.level}:</span> {data.level_name}
            </div>
          </div>
          <div className="output-card-body">
            <p data-testid="rewritten-email-content">{data.rewritten_email}</p>
          </div>
          <div className="output-card-actions">
            <button data-testid="copy-button" className="action-btn" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <a href="/" className="action-btn no-underline" data-testid="try-it-button">
              Try it yourself
            </a>
          </div>
        </div>
        <footer className="text-center py-8 opacity-30 text-xs">no emails were harmed in the making of this app (probably)</footer>
      </div>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EmailEscalator />} />
        <Route path="/shared/:shareId" element={<SharedView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
