import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) { setCopyError(true); return; }
    navigator.clipboard.writeText(code).then(() => {
      setCopyError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => setCopyError(true));
  }, [code]);

  return (
    <div className="code-block">
      <div className="code-header">
        <div className="code-header-left">
          <div className="code-dots" aria-hidden="true">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="code-lang">
            <span className="code-lang-dot" />
            {language.toUpperCase()}
          </span>
        </div>

        <button
          className={`copy-btn ${copied ? "copied" : ""}`}
          onClick={handleCopy}
          title="Copy code"
          aria-label="Copy code snippet"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {copyError && <p className="code-copy-error" role="status">Copy unavailable. Select the code to copy manually.</p>}

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 12px 12px",
          fontSize: "0.86rem",
          lineHeight: "1.65",
          padding: "16px 18px",
          background: "#12141c",
        }}
        showLineNumbers={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownMessage({ message }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          const child = React.Children.toArray(children)[0];
          if (!React.isValidElement(child)) return <pre>{children}</pre>;
          const match = /language-([^\s]+)/.exec(child.props.className || "");
          return <CodeBlock language={match?.[1] || "text"} code={String(child.props.children).replace(/\n$/, "")} />;
        },
        code: ({ children, className }) => <code className={className || "inline-code"}>{children}</code>,
      }}
    >
      {message}
    </ReactMarkdown>
  );
}
