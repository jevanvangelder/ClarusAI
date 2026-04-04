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
        className={`max-w-[95%] md:max-w-[80%] rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white/5 text-white/85 border border-white/10'
        }`}
      >
        <div className="text-[15px] leading-relaxed">
          {isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-3 text-white" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />,
                h4: ({ node, ...props }) => <h4 className="text-base font-bold mt-2 mb-1 text-white" {...props} />,
                p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                em: ({ node, ...props }) => <em className="italic text-white/60" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc ml-6 mb-3 space-y-1.5" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal ml-6 mb-3 space-y-1.5" {...props} />,
                li: ({ node, ...props }) => <li className="ml-1 pl-1" {...props} />,
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-blue-300" {...props} />
                  ) : (
                    <code className="block bg-white/5 border border-white/10 p-3 rounded-lg my-3 text-sm font-mono overflow-x-auto text-white/80" {...props} />
                  ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-blue-500/50 pl-4 my-3 italic text-white/50" {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a className="text-blue-400 underline hover:text-blue-300 transition-colors" {...props} />
                ),
                hr: ({ node, ...props }) => <hr className="my-4 border-white/10" {...props} />,
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-white/10" {...props} />
                  </div>
                ),
                th: ({ node, ...props }) => (
                  <th className="border border-white/10 px-3 py-2 bg-white/5 font-bold text-left text-white" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-white/10 px-3 py-2 text-white/70" {...props} />
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