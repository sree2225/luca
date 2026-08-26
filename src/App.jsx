import { useEffect, useMemo, useState } from "react";
import "./App.css";

const subjects = [
    {
        id: "tamil",
        code: "LANG I",
        icon: "📖",
        color: "peach",
        name: "Tamil",
        lessons: [
            "தமிழ் இலக்கியம்",
            "சிற்றிலக்கியம்",
            "தமிழ் இலக்கணம்",
            "தமிழ்விடுதூது",
        ],
    },
    {
        id: "english",
        code: "ENG I",
        icon: "📚",
        color: "blue",
        name: "English",
        lessons: [
            "Grammar",
            "Vocabulary",
            "Reading Skills",
            "Writing Skills",
            "Speaking Skills",
        ],
    },
    {
        id: "bioinformatics",
        code: "DCC 1",
        icon: "🧬",
        color: "purple",
        name: "Introduction to Bioinformatics",
        lessons: [
            "Introduction to Bioinformatics",
            "Biological Databases",
            "NCBI Database",
            "Sequence Alignment",
            "BLAST",
            "Protein Databases",
        ],
    },
    {
        id: "computer",
        code: "DCC 2",
        icon: "💻",
        color: "sky",
        name: "Fundamentals of Computer",
        lessons: [
            "Introduction to Computers",
            "Computer Hardware",
            "Computer Software",
            "Operating Systems",
            "Number Systems",
            "Programming Basics",
        ],
    },
    {
        id: "cell",
        code: "MDC 1",
        icon: "🔬",
        color: "pink",
        name: "Introduction to Cell Biology and Biomolecules",
        lessons: [
            "Cell Theory",
            "Cell Structure",
            "Cell Organelles",
            "Carbohydrates",
            "Proteins",
            "Lipids",
            "Nucleic Acids",
        ],
    },
    {
        id: "elective",
        code: "DSE 1",
        icon: "🧪",
        color: "green",
        name: "Biology Specific Elective – I",
        lessons: [
            "Biology Specific Elective – I",
        ],
    },
    {
        id: "bio-lab",
        code: "DCC 1 (Lab)",
        icon: "🧫",
        color: "mint",
        name: "Introduction to Bioinformatics Practical II",
        lessons: [
            "NCBI Database Practical",
            "UniProt Protein Retrieval",
            "Sequence Alignment Practical",
            "BLAST Practical",
            "Protein Structure Retrieval",
        ],
    },
    {
        id: "uhv",
        code: "VAC 1",
        icon: "🌱",
        color: "mint",
        name: "Universal Human Values",
        lessons: [
            "Introduction to Human Values",
            "Self Exploration",
            "Harmony in Relationships",
            "Values in Life",
        ],
    },
    {
        id: "softskills",
        code: "SEC 1",
        icon: "🎯",
        color: "yellow",
        name: "Soft Skills",
        lessons: [
            "Communication Skills",
            "Listening Skills",
            "Body Language and Etiquettes",
            "Group Discussion and Interview Skills",
            "Presentation Skills",
            "Emotional Intelligence Skills",
            "Time Management Skills",
            "CV and Resume Writing",
        ],
    },
];


function renderInlineMarkdown(text) {
    const parts = String(text ?? '').split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);
    return parts.map((part, index) => {
        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if ((part.startsWith('`') && part.endsWith('`'))) {
            return <code key={index}>{part.slice(1, -1)}</code>;
        }
        if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
            return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return <span key={index}>{part}</span>;
    });
}

function MarkdownText({ text, className = '' }) {
    const source = String(text ?? '').replace(/\r\n/g, '\n').trim();
    if (!source) return null;

    const lines = source.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const raw = lines[i];
        const line = raw.trim();

        if (!line) {
            i += 1;
            continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
            blocks.push(<hr key={`hr-${i}`} />);
            i += 1;
            continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            const level = Math.min(6, heading[1].length);
            const Tag = `h${level}`;
            blocks.push(<Tag key={`h-${i}`}>{renderInlineMarkdown(heading[2])}</Tag>);
            i += 1;
            continue;
        }

        if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
            const tableLines = [line];
            i += 1;
            i += 1; // separator
            while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
                tableLines.push(lines[i].trim());
                i += 1;
            }
            const rows = tableLines.map(row => row.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
            blocks.push(
                <div className="markdown-table-wrap" key={`table-${i}`}>
                    <table className="markdown-table">
                        <thead><tr>{rows[0].map((cell, idx) => <th key={idx}>{renderInlineMarkdown(cell)}</th>)}</tr></thead>
                        <tbody>{rows.slice(1).map((row, r) => <tr key={r}>{rows[0].map((_, c) => <td key={c}>{renderInlineMarkdown(row[c] || '')}</td>)}</tr>)}</tbody>
                    </table>
                </div>
            );
            continue;
        }

        const unordered = line.match(/^[-*•]\s+(.+)$/);
        if (unordered) {
            const items = [];
            while (i < lines.length) {
                const match = lines[i].trim().match(/^[-*•]\s+(.+)$/);
                if (!match) break;
                items.push(match[1]);
                i += 1;
            }
            blocks.push(<ul key={`ul-${i}`}>{items.map((item, idx) => <li key={idx}>{renderInlineMarkdown(item)}</li>)}</ul>);
            continue;
        }

        const ordered = line.match(/^\d+[.)]\s+(.+)$/);
        if (ordered) {
            const items = [];
            while (i < lines.length) {
                const match = lines[i].trim().match(/^\d+[.)]\s+(.+)$/);
                if (!match) break;
                items.push(match[1]);
                i += 1;
            }
            blocks.push(<ol key={`ol-${i}`}>{items.map((item, idx) => <li key={idx}>{renderInlineMarkdown(item)}</li>)}</ol>);
            continue;
        }

        const paragraph = [line];
        i += 1;
        while (i < lines.length) {
            const next = lines[i].trim();
            if (!next || /^(#{1,6})\s+/.test(next) || /^[-*•]\s+/.test(next) || /^\d+[.)]\s+/.test(next) || /^\|.*\|$/.test(next) || /^(-{3,}|\*{3,}|_{3,})$/.test(next)) break;
            paragraph.push(next);
            i += 1;
        }
        blocks.push(<p key={`p-${i}`}>{paragraph.map((part, idx) => <span key={idx}>{idx > 0 ? ' ' : ''}{renderInlineMarkdown(part)}</span>)}</p>);
    }

    return <div className={`markdown-content ${className}`}>{blocks}</div>;
}

async function generateLucaNotes(subject, lesson, mood) {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            subject,
            topic: lesson,
            mood,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Luca could not generate notes.");
    }

    return data;
}

async function askLuca(messages, subject = "", topic = "") {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ask-luca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, subject, topic }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Luca could not answer.");
    return data;
}

function getStorageKey(email, key) { return `luca_${email}_${key}`; }

function App() {
    const [screen, setScreen] = useState(() => localStorage.getItem("luca_logged_in") === "true" ? "home" : "login");
    const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("luca_user")) || null; } catch { return null; } });
    const [loginMode, setLoginMode] = useState("login");
    const [loginForm, setLoginForm] = useState({ name: "", email: "", password: "" });
    const [subject, setSubject] = useState(null);
    const [lesson, setLesson] = useState(null);
    const [notes, setNotes] = useState(null);
    const [mood, setMood] = useState("😊");
    const [generating, setGenerating] = useState(false);
    const [completed, setCompleted] = useState({});
    const [notesCount, setNotesCount] = useState(0);
    const [chat, setChat] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatSubject, setChatSubject] = useState(null);
    const [chatTopic, setChatTopic] = useState(null);

    const totalLessons = useMemo(() => subjects.reduce((sum, item) => sum + item.lessons.length, 0), []);
    const completedCount = Object.values(completed).filter(Boolean).length;
    const overallProgress = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

    useEffect(() => {
        if (!user) return;
        const key = getStorageKey(user.email, "state");
        try { const saved = JSON.parse(localStorage.getItem(key)) || {}; setCompleted(saved.completed || {}); setNotesCount(saved.notesCount || 0); setChat(saved.chat || []); } catch {}
    }, [user]);

    useEffect(() => {
        if (!user) return;
        localStorage.setItem(getStorageKey(user.email, "state"), JSON.stringify({ completed, notesCount, chat }));
        localStorage.setItem("luca_user", JSON.stringify(user));
        localStorage.setItem("luca_logged_in", "true");
    }, [completed, notesCount, chat, user]);

    const handleLogin = (event) => {
        event.preventDefault();
        const email = loginForm.email.trim().toLowerCase();
        if (!email || !loginForm.password || (loginMode === "signup" && !loginForm.name.trim())) return window.alert("Please fill all required fields.");
        const accounts = JSON.parse(localStorage.getItem("luca_accounts") || "{}");
        if (loginMode === "signup") accounts[email] = { name: loginForm.name.trim(), password: loginForm.password };
        else if (accounts[email] && accounts[email].password !== loginForm.password) return window.alert("Incorrect password.");
        const profile = accounts[email] || { name: loginForm.name.trim() || email.split("@")[0], password: loginForm.password };
        accounts[email] = profile;
        localStorage.setItem("luca_accounts", JSON.stringify(accounts));
        setUser({ name: profile.name, email });
        setScreen("home");
    };

    const logout = () => { localStorage.removeItem("luca_logged_in"); localStorage.removeItem("luca_user"); setUser(null); setScreen("login"); };

    const toggleComplete = () => {
        if (!subject || !lesson) return;
        const key = `${subject.id}::${lesson}`;
        setCompleted((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const openAskLuca = (item = subject, topic = lesson) => { setChatSubject(item || null); setChatTopic(topic || null); setScreen("chat"); };

    const sendChat = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading) return;
        const userMessage = { role: "user", content: text };
        const nextMessages = [...chat, userMessage];
        setChat(nextMessages); setChatInput(""); setChatLoading(true);
        try { const data = await askLuca(nextMessages, chatSubject?.name || subject?.name || "", chatTopic || lesson || ""); setChat((prev) => [...prev, { role: "assistant", content: data.answer }]); }
        catch (error) { setChat((prev) => [...prev, { role: "assistant", content: `Sorry, I couldn't connect right now. ${error.message}` }]); }
        finally { setChatLoading(false); }
    };

    const openSubject = (item) => {
        setSubject(item);
        setLesson(null);
        setNotes(null);
        setScreen("subject");
    };

    const openLesson = (item) => {
        setLesson(item);
        setNotes(null);
        setScreen("lesson");
    };

    const generateNotes = async () => {
        if (!subject || !lesson) return;

        setGenerating(true);
        setNotes(null);

        try {
            const data = await generateLucaNotes(subject.name, lesson, mood);
            setNotes(data);
            setNotesCount((count) => count + 1);
        } catch (error) {
            console.error(error);
            window.alert(error.message || "Unable to generate notes. Make sure the Luca AI server is running.");
        } finally {
            setGenerating(false);
        }
    };

    const goHome = () => {
        setScreen("home");
        setSubject(null);
        setLesson(null);
        setNotes(null);
    };

    return (
        <div className="app">

            {/* NAVBAR */}

            <header className="navbar">

                <button className="brand" onClick={goHome}>
                    <div className="brand-bubble">🧸</div>

                    <div>
                        <strong>Luca</strong>
                        <span>AI Tutor</span>
                    </div>
                </button>

                <nav className="nav-links">
                    <button onClick={goHome}>Home</button>

                    <button
                        onClick={() => {
                            setScreen("home");
                            setTimeout(() => {
                                document
                                    .getElementById("subjects")
                                    ?.scrollIntoView({ behavior: "smooth" });
                            }, 50);
                        }}
                    >
                        Subjects
                    </button>

                    <button onClick={() => setScreen("syllabus")}>
                        My Syllabus
                    </button>

                    <button onClick={() => setScreen("progress")}>
                        Progress
                    </button>
                </nav>

                <div className="nav-user-actions">
                    <button className="ask-nav" onClick={() => openAskLuca()}>🤖 Ask Luca</button>
                    <button className="profile-button" onClick={() => setScreen("profile")}>🌸</button>
                </div>

            </header>

            {/* LOGIN */}
            {screen === "login" && (
                <main className="auth-page">
                    <div className="auth-card">
                        <div className="auth-luca">🧸</div>
                        <span className="eyebrow">WELCOME TO LUCA</span>
                        <h1>{loginMode === "login" ? "Welcome back!" : "Create your Luca account"}</h1>
                        <p>Save your progress, notes and Luca conversations in your own learning space.</p>
                        <form onSubmit={handleLogin}>
                            {loginMode === "signup" && <input placeholder="Your name" value={loginForm.name} onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })} />}
                            <input type="email" placeholder="Email address" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
                            <input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
                            <button className="main-button" type="submit">{loginMode === "login" ? "✨ Login to Luca" : "🌷 Create Account"}</button>
                        </form>
                        <button className="auth-switch" onClick={() => setLoginMode(loginMode === "login" ? "signup" : "login")}>{loginMode === "login" ? "New here? Create an account" : "Already have an account? Login"}</button>
                    </div>
                </main>
            )}

            {/* ASK LUCA CHAT */}
            {screen === "chat" && (
                <main className="inner-page chat-page">
                    <button className="back-button" onClick={() => setScreen(subject ? "subject" : "home")}>← Back</button>
                    <div className="chat-header"><div className="chat-avatar">🧸</div><div><span className="eyebrow">LUCA AI</span><h1>Ask Luca</h1><p>{chatTopic ? `Talking about ${chatTopic}` : "Your ongoing study conversation"}</p></div><button className="soft-button" onClick={() => setChat([])}>🗑 Clear chat</button></div>
                    <div className="chat-window">
                        {chat.length === 0 && <div className="chat-empty"><div>🧸</div><h2>Hi {user?.name || "there"}! I’m Luca. 👋</h2><p>Ask me anything about your subjects. I’ll remember this conversation while you study.</p><div className="suggestions"><button onClick={() => setChatInput("Explain this topic in simple terms")}>Explain simply</button><button onClick={() => setChatInput("Give me an exam-focused explanation")}>Exam mode</button><button onClick={() => setChatInput("Quiz me on this topic")}>Quiz me</button></div></div>}
                        {chat.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "🧸" : "You"}</span><div><MarkdownText text={message.content} /></div></div>)}
                        {chatLoading && <div className="chat-message assistant"><span>🧸</span><div className="typing">Luca is thinking... •••</div></div>}
                    </div>
                    <div className="chat-input-row"><textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} placeholder="Ask Luca anything..." rows="2" /><button className="main-button" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>Send ✨</button></div>
                </main>
            )}

            {/* HOME */}

            {screen === "home" && (
                <main>

                    <section className="hero">

                        <div className="hero-left">

                            <div className="welcome-pill">
                                ✨ Your little AI study buddy
                            </div>

                            <h1>
                                Learn with
                                <span> Luca.</span>
                            </h1>

                            <p className="hero-subtitle">
                                A cute little AI tutor that helps you understand
                                lessons, create notes, prepare for exams and
                                learn at your own pace. 🌷
                            </p>

                            <div className="hero-actions">

                                <button
                                    className="main-button"
                                    onClick={() => {
                                        document
                                            .getElementById("subjects")
                                            ?.scrollIntoView({
                                                behavior: "smooth",
                                            });
                                    }}
                                >
                                    ✨ Start Learning
                                </button>

                                <button
                                    className="soft-button"
                                    onClick={() => setScreen("syllabus")}
                                >
                                    📚 Add Syllabus
                                </button>

                            </div>

                            <div className="mini-stats">

                                <div>
                                    <strong>{subjects.length}</strong>
                                    <span>Subjects</span>
                                </div>

                                <div>
                                    <strong>AI</strong>
                                    <span>Notes</span>
                                </div>

                                <div>
                                    <strong>24/7</strong>
                                    <span>Luca Help</span>
                                </div>

                            </div>

                        </div>

                        <div className="hero-right">

                            <div className="floating-star star-one">✦</div>
                            <div className="floating-star star-two">✧</div>

                            <div className="luca-card">

                                <div className="luca-glow"></div>

                                <div className="luca-character">
                                    🧸
                                </div>

                                <div className="luca-status">
                                    <span></span>
                                    Luca is ready
                                </div>

                                <h2>
                                    Hi! I'm Luca 👋
                                </h2>

                                <p>
                                    What are we learning today?
                                </p>

                                <div className="chat-bubble user">
                                    Explain Cell Theory 🌸
                                </div>

                                <div className="chat-bubble luca">
                                    Of course! Let's make it super easy
                                    to understand. 💜
                                </div>

                                <div className="luca-mood">
                                    <span>Today's mood</span>
                                    <strong>{mood}</strong>
                                </div>

                            </div>

                        </div>

                    </section>

                    {/* MOOD */}

                    <section className="mood-section">

                        <div>
                            <span className="eyebrow">
                                STUDY MOOD
                            </span>

                            <h2>
                                How are you feeling today?
                            </h2>

                            <p>
                                Luca can adjust the learning style based
                                on how you're feeling. 🌷
                            </p>
                        </div>

                        <div className="mood-options">

                            {[
                                ["😵", "Confused"],
                                ["😊", "Okay"],
                                ["🔥", "Exam Mode"],
                            ].map(([emoji, text]) => (

                                <button
                                    className={
                                        mood === emoji
                                            ? "mood active"
                                            : "mood"
                                    }
                                    key={emoji}
                                    onClick={() => setMood(emoji)}
                                >
                                    <span>{emoji}</span>
                                    {text}
                                </button>

                            ))}

                        </div>

                    </section>

                    {/* SUBJECTS */}

                    <section className="subjects-section" id="subjects">

                        <div className="section-heading">

                            <div>
                                <span className="eyebrow">
                                    📚 YOUR LEARNING HUB
                                </span>

                                <h2>
                                    Pick a subject
                                </h2>

                                <p>
                                    Choose what you want to learn today.
                                    Luca is waiting for you! 🧸
                                </p>
                            </div>

                            <div className="subject-count">
                                <strong>{String(subjects.length).padStart(2, "0")}</strong>
                                <span>Subjects</span>
                            </div>

                        </div>

                        <div className="subject-grid">

                            {subjects.map((item) => (

                                <button
                                    className={`subject-card ${item.color}`}
                                    key={item.id}
                                    onClick={() => openSubject(item)}
                                >

                                    <div className="card-top">

                                        <div className="subject-icon">
                                            {item.icon}
                                        </div>

                                        <span className="arrow">
                                            ↗
                                        </span>

                                    </div>

                                    <div className="subject-code">
                                        {item.code}
                                    </div>

                                    <h3>
                                        {item.name}
                                    </h3>

                                    <p>
                                        {item.lessons.length} lessons waiting
                                        for you ✨
                                    </p>

                                    <div className="card-bottom">
                                        <span>Let's learn</span>
                                        <span>→</span>
                                    </div>

                                </button>

                            ))}

                        </div>

                    </section>

                    {/* FEATURES */}

                    <section className="features-section">

                        <div className="section-heading center">

                            <span className="eyebrow">
                                ✨ LUCA FEATURES
                            </span>

                            <h2>
                                More than just notes.
                            </h2>

                            <p>
                                Everything you need for a happier,
                                easier study experience.
                            </p>

                        </div>

                        <div className="feature-grid">

                            <div className="feature">
                                <span>🤖</span>
                                <h3>Ask Luca</h3>
                                <p>
                                    Ask questions and get simple explanations.
                                </p>
                            </div>

                            <div className="feature">
                                <span>📝</span>
                                <h3>AI Notes</h3>
                                <p>
                                    Generate notes for any lesson in seconds.
                                </p>
                            </div>

                            <div className="feature">
                                <span>🎙️</span>
                                <h3>Voice Tutor</h3>
                                <p>
                                    Learn through natural voice interaction.
                                </p>
                            </div>

                            <div className="feature">
                                <span>❓</span>
                                <h3>AI Quiz</h3>
                                <p>
                                    Generate questions and test yourself.
                                </p>
                            </div>

                            <div className="feature">
                                <span>🌷</span>
                                <h3>Study Mood</h3>
                                <p>
                                    Luca changes the learning style based
                                    on your mood.
                                </p>
                            </div>

                            <div className="feature">
                                <span>📊</span>
                                <h3>Progress</h3>
                                <p>
                                    See your learning progress and completed
                                    lessons.
                                </p>
                            </div>

                        </div>

                    </section>

                </main>
            )}

            {/* SUBJECT */}

            {screen === "subject" && subject && (
                <main className="inner-page">

                    <button
                        className="back-button"
                        onClick={goHome}
                    >
                        ← Back to Subjects
                    </button>

                    <div className="subject-hero">

                        <div className={`large-icon ${subject.color}`}>
                            {subject.icon}
                        </div>

                        <div>
                            <span className="eyebrow">
                                YOUR SUBJECT
                            </span>

                            <h1>
                                {subject.name}
                            </h1>

                            <p>
                                Pick a lesson and let Luca help you learn
                                it step by step. 🌸
                            </p>
                        </div>

                    </div>

                    <div className="subject-progress-box">
                        <div><span>Subject progress</span><strong>{Math.round((subject.lessons.filter((item) => completed[`${subject.id}::${item}`]).length / subject.lessons.length) * 100)}%</strong></div>
                        <div className="progress-track"><span style={{ width: `${Math.round((subject.lessons.filter((item) => completed[`${subject.id}::${item}`]).length / subject.lessons.length) * 100)}%` }} /></div>
                    </div>

                    <div className="quick-tools">

                        <button onClick={() => openAskLuca(subject)}>
                            🤖
                            <strong>Ask Luca</strong>
                            <small>Continue conversation</small>
                        </button>

                        <button>
                            ✨
                            <strong>AI Notes</strong>
                            <small>Generate notes</small>
                        </button>

                        <button>
                            ❓
                            <strong>AI Quiz</strong>
                            <small>Test yourself</small>
                        </button>

                        <button>
                            🎙️
                            <strong>Voice Tutor</strong>
                            <small>Learn by voice</small>
                        </button>

                    </div>

                    <div className="lesson-area">

                        <div className="section-heading">

                            <div>
                                <span className="eyebrow">
                                    🌷 LESSONS
                                </span>

                                <h2>
                                    What shall we learn?
                                </h2>
                            </div>

                            <span className="lesson-count">
                                {subject.lessons.length} lessons
                            </span>

                        </div>

                        <div className="lesson-list">

                            {subject.lessons.map((item, index) => (

                                <button
                                    className="lesson-card"
                                    key={item}
                                    onClick={() => openLesson(item)}
                                >

                                    <span className="lesson-number">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>

                                    <div className="lesson-icon">
                                        📖
                                    </div>

                                    <div className="lesson-info">
                                        <h3>{item}</h3>
                                        <p>
                                            Learn this lesson with Luca
                                        </p>
                                    </div>

                                    <span className={`lesson-status ${completed[`${subject.id}::${item}`] ? "done" : ""}`}>
                                        {completed[`${subject.id}::${item}`] ? "✓ Done" : "Start →"}
                                    </span>

                                </button>

                            ))}

                        </div>

                    </div>

                </main>
            )}

            {/* LESSON */}

            {screen === "lesson" && subject && lesson && (
                <main className="inner-page">

                    <button
                        className="back-button"
                        onClick={() => {
                            setNotes(null);
                            setScreen("subject");
                        }}
                    >
                        ← Back to Lessons
                    </button>

                    <div className="lesson-header">

                        <div>

                            <span className="eyebrow">
                                {subject.name}
                            </span>

                            <h1>
                                {lesson}
                            </h1>

                            <p>
                                Your personal learning space for this topic.
                                💜
                            </p>

                        </div>

                        <div className="lesson-luca">
                            🧸
                        </div>

                    </div>

                    <div className="mood-message">

                        {mood === "😵" && (
                            <>
                                🧸 <strong>Luca:</strong> Don't worry!
                                I'll explain everything in tiny,
                                easy steps. 🌷
                            </>
                        )}

                        {mood === "😊" && (
                            <>
                                🧸 <strong>Luca:</strong> Perfect!
                                Let's understand this topic together. ✨
                            </>
                        )}

                        {mood === "🔥" && (
                            <>
                                🧸 <strong>Luca:</strong> Exam mode ON!
                                Let's focus on important points and questions. 🔥
                            </>
                        )}

                    </div>

                    <div className="lesson-actions-row">
                        <button className={`complete-button ${completed[`${subject.id}::${lesson}`] ? "completed" : ""}`} onClick={toggleComplete}>
                            {completed[`${subject.id}::${lesson}`] ? "✓ Topic Completed" : "○ Mark Topic Complete"}
                        </button>
                        <button className="soft-button" onClick={() => openAskLuca(subject, lesson)}>🤖 Ask Luca about this topic</button>
                    </div>

                    {!notes && !generating && (
                        <div className="generate-card">

                            <div className="generate-character">
                                🧸
                            </div>

                            <div>

                                <span className="eyebrow">
                                    AI STUDY ASSISTANT
                                </span>

                                <h2>
                                    Ready to study {lesson}?
                                </h2>

                                <p>
                                    Luca can create easy explanations,
                                    key concepts, exam notes and important
                                    questions for you.
                                </p>

                                <button
                                    className="main-button"
                                    onClick={generateNotes}
                                >
                                    ✨ Generate My Notes
                                </button>

                            </div>

                        </div>
                    )}

                    {generating && (
                        <div className="generating">

                            <div className="loading-luca">
                                🧸
                            </div>

                            <h2>
                                Luca is preparing your notes...
                            </h2>

                            <p>
                                Making everything simple and exam-friendly
                                for you. 🌸
                            </p>

                            <div className="loading-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>

                        </div>
                    )}

                    {notes && (
                        <div className="notes-layout">

                            <article className="notes-card">

                                <div className="ai-generated">✨ GROQ AI • LUCA NOTES</div>

                                <h2>🌷 {notes.title || lesson}</h2>
                                <MarkdownText text={notes.overview} />

                                <h2>🔍 Detailed Explanation</h2>
                                <MarkdownText text={notes.detailedExplanation} />
                                {(notes.sections || []).map((section, index) => (
                                    <section className="structured-section" key={`${section.heading}-${index}`}>
                                        <h3>{section.heading}</h3>
                                        {section.subheading && <h4>{section.subheading}</h4>}
                                        {section.explanation && <MarkdownText text={section.explanation} />}
                                        {section.bullets?.length > 0 && <ul>{section.bullets.map((point, i) => <li key={i}>{point}</li>)}</ul>}
                                    </section>
                                ))}

                                <h2>🧠 Key Concepts</h2>
                                <div className="concept-list">
                                    {(notes.keyConcepts || []).map((item, index) => (
                                        <div key={`${item}-${index}`}>
                                            <span>{index + 1}</span>
                                            <MarkdownText text={item} />
                                        </div>
                                    ))}
                                </div>

                                <h2>📚 Important Terms</h2>
                                <div className="term-chips">
                                    {(notes.importantTerms || []).map((item, index) => (
                                        <span key={`${item}-${index}`}>{item}</span>
                                    ))}
                                </div>

                                <h2>💡 Examples & Applications</h2>
                                <div className="concept-list">
                                    {(notes.examples || []).map((item, index) => (
                                        <div key={`${item}-${index}`}>
                                            <span>•</span>
                                            <MarkdownText text={item} />
                                        </div>
                                    ))}
                                </div>

                                <h2>🎓 Examination Points</h2>
                                <div className="exam-note">
                                    <ul>
                                        {(notes.examPoints || []).map((item, index) => (
                                            <li key={`${item}-${index}`}>{item}</li>
                                        ))}
                                    </ul>
                                </div>

                                <h2>❓ Important Questions</h2>
                                <div className="question-list">
                                    {(notes.shortQuestions || []).map((question, index) => (
                                        <div key={`${question}-${index}`}>
                                            <span>2M</span>
                                            <MarkdownText text={question} />
                                        </div>
                                    ))}
                                    {(notes.longQuestions || []).map((question, index) => (
                                        <div key={`${question}-${index}`}>
                                            <span>15M</span>
                                            <MarkdownText text={question} />
                                        </div>
                                    ))}
                                </div>

                                <div className="revision">
                                    <h3>⚡ Quick Revision</h3>
                                    <div className="revision-points">
                                        {(notes.quickRevision || []).map((item, index) => (
                                            <span key={`${item}-${index}`}>{item}</span>
                                        ))}
                                    </div>
                                </div>

                                <button className="main-button regenerate-button" onClick={generateNotes}>
                                    ✨ Regenerate with Luca
                                </button>

                            </article>

                            <aside className="notes-menu">
                                <div className="mini-luca">🧸</div>
                                <h3>Study with Luca</h3>
                                <p>Your notes are generated specifically for this topic.</p>
                                <button onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(`${notes.title || lesson}. ${notes.overview}. ${notes.detailedExplanation}`))}>
                                    🔊 Read Notes Aloud
                                </button>
                                <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(notes, null, 2))}>
                                    📋 Copy Notes
                                </button>
                                <button onClick={() => setNotes(null)}>
                                    ← Back to Topic
                                </button>
                            </aside>

                        </div>
                    )}

                </main>
            )}

            {/* PROGRESS */}

            {screen === "progress" && (
                <main className="inner-page">

                    <button
                        className="back-button"
                        onClick={goHome}
                    >
                        ← Home
                    </button>

                    <div className="page-title">
                        <span className="eyebrow">
                            📊 YOUR JOURNEY
                        </span>

                        <h1>
                            My Progress
                        </h1>

                        <p>
                            Look how far you've come! 🌷
                        </p>
                    </div>

                    <div className="progress-grid">

                        <div className="progress-card big">
                            <span>🌸</span>
                            <strong>{overallProgress}%</strong>
                            <div className="progress-track"><span style={{ width: `${overallProgress}%` }} /></div>
                            <p>Overall Progress</p>
                        </div>

                        <div className="progress-card">
                            <span>📖</span>
                            <strong>{completedCount}</strong>
                            <p>Lessons Completed</p>
                        </div>

                        <div className="progress-card">
                            <span>📝</span>
                            <strong>{notesCount}</strong>
                            <p>Notes Generated</p>
                        </div>

                        <div className="progress-card">
                            <span>❓</span>
                            <strong>{completedCount}</strong>
                            <p>Quizzes Completed</p>
                        </div>

                    </div>

                    <div className="subject-progress-list">
                        <h2>Subject-wise progress</h2>
                        {subjects.map((item) => {
                            const done = item.lessons.filter((l) => completed[`${item.id}::${l}`]).length;
                            const pct = Math.round((done / item.lessons.length) * 100);
                            return <div className="subject-progress-row" key={item.id}>
                                <div><span>{item.icon} {item.name}</span><strong>{pct}%</strong></div>
                                <div className="progress-track"><span style={{ width: `${pct}%` }} /></div>
                            </div>;
                        })}
                    </div>

                </main>
            )}

            {/* PROFILE */}

            {screen === "profile" && (
                <main className="inner-page">

                    <button
                        className="back-button"
                        onClick={goHome}
                    >
                        ← Home
                    </button>

                    <div className="profile-card">

                        <div className="profile-avatar">
                            🌸
                        </div>

                        <h1>
                            {user?.name || "My Learning Space"}
                        </h1>

                        <p>
                            Welcome to your personal Luca study space. 💜
                        </p>

                        <div className="profile-info">

                            <div>
                                <span>Subjects</span>
                                <strong>{subjects.length}</strong>
                            </div>

                            <div>
                                <span>Lessons</span>
                                <strong>0</strong>
                            </div>

                            <div>
                                <span>Study Streak</span>
                                <strong>{overallProgress}% 🔥</strong>
                            </div>

                        </div>

                    <button className="main-button" onClick={logout}>Log out</button>

                    </div>

                </main>
            )}

            <footer>
                <div className="footer-luca">
                    🧸
                </div>

                <strong>
                    Luca AI Tutor
                </strong>

                <p>
                    Your little AI study buddy. 🌸
                </p>

                <span>
                    Learn • Grow • Achieve
                </span>
            </footer>

        </div>
    );
}

export default App;
