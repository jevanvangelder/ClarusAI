import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user'
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-card-foreground border border-border'
        }`}
      >
        <div className="text-[15px] leading-relaxed">
          {isUser ? (
            // User messages: plain text with line breaks
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            // Assistant messages: full Markdown rendering
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Headings
                h1: ({ node, ...props }) => (
                  <h1 className="text-2xl font-bold mt-4 mb-3 text-foreground" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-xl font-bold mt-4 mb-2 text-foreground" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-lg font-bold mt-3 mb-2 text-foreground" {...props} />
                ),
                h4: ({ node, ...props }) => (
                  <h4 className="text-base font-bold mt-2 mb-1 text-foreground" {...props} />
                ),
                
                // Paragraphs
                p: ({ node, ...props }) => (
                  <p className="mb-3 last:mb-0" {...props} />
                ),
                
                // Bold and Italic
                strong: ({ node, ...props }) => (
                  <strong className="font-bold text-foreground" {...props} />
                ),
                em: ({ node, ...props }) => (
                  <em className="italic text-muted-foreground" {...props} />
                ),
                
                // Lists - IMPROVED!
                ul: ({ node, ...props }) => (
                  <ul className="list-disc ml-6 mb-3 space-y-1.5" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal ml-6 mb-3 space-y-1.5" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="ml-1 pl-1" {...props} />
                ),
                
                // Code blocks
                code: ({ node, inline, ...props }: any) => 
                  inline ? (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary" {...props} />
                  ) : (
                    <code className="block bg-muted p-3 rounded-md my-3 text-sm font-mono overflow-x-auto" {...props} />
                  ),
                
                // Blockquotes
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-primary pl-4 my-3 italic text-muted-foreground" {...props} />
                ),
                
                // Links
                a: ({ node, ...props }) => (
                  <a className="text-primary underline hover:text-primary/80 transition-colors" {...props} />
                ),
                
                // Horizontal rule
                hr: ({ node, ...props }) => (
                  <hr className="my-4 border-border" {...props} />
                ),
                
                // Tables (with remarkGfm)
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-border" {...props} />
                  </div>
                ),
                th: ({ node, ...props }) => (
                  <th className="border border-border px-3 py-2 bg-muted font-bold text-left" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-border px-3 py-2" {...props} />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </motion.div>
  )
}